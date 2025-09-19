import mongoose from "mongoose";
import { getCashierIdFromUser } from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import { validationResult } from "express-validator";
import { emitJackpotAwarded } from "../socket.js";

// Get current jackpot
export const getJackpot = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const jackpot = await Jackpot.findOne({ cashierId });
    const activeGames = await Game.countDocuments({
      status: { $in: ["active", "pending"] },
      cashierId,
    });

    const amount = jackpot ? (activeGames === 0 ? 0 : jackpot.amount) : 0;
    const enabled = jackpot ? jackpot.enabled : true;

    res.json({
      message: "Jackpot retrieved successfully",
      data: {
        amount,
        baseAmount: jackpot ? jackpot.baseAmount : 0,
        enabled,
        lastUpdated: jackpot ? jackpot.lastUpdated : new Date(),
      },
    });
  } catch (error) {
    console.error("[getJackpot] Error:", error);
    next(error);
  }
};

// Moderator can manually set or update jackpot amount
export const setJackpotAmount = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { amount } = req.body;

    if (typeof amount !== "number" || amount < 0) {
      return res.status(400).json({
        message: "Amount must be a positive number",
      });
    }

    let jackpot = await Jackpot.findOne({ cashierId });
    const oldAmount = jackpot ? jackpot.amount : 0;
    const changeAmount = amount - oldAmount;

    if (!jackpot) {
      // Create new jackpot
      jackpot = new Jackpot({
        cashierId,
        amount,
        baseAmount: amount,
        enabled: true,
        lastUpdated: new Date(),
      });
    } else {
      // Update existing jackpot
      jackpot.amount = amount;
      jackpot.baseAmount = amount; // Reset base amount when manually set
      jackpot.lastUpdated = new Date();
    }

    await jackpot.save();

    // Log the manual update
    await JackpotLog.create({
      cashierId,
      amount: changeAmount,
      reason: `Manual jackpot update by moderator - set to ${amount}`,
      gameId: null,
    });

    console.log(
      `[setJackpotAmount] Moderator set jackpot to ${amount} (change: ${changeAmount})`
    );

    res.json({
      message: "Jackpot amount updated successfully",
      data: {
        oldAmount,
        newAmount: amount,
        changeAmount,
        totalJackpot: jackpot.amount,
      },
    });
  } catch (error) {
    console.error("[setJackpotAmount] Error:", error);
    next(error);
  }
};

// Add contribution to existing jackpot (called from game creation)
export const addJackpotContribution = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { contributionAmount, gameId } = req.body;

    if (!contributionAmount || contributionAmount <= 0) {
      return res.status(400).json({
        message: "Valid contribution amount required",
      });
    }

    let jackpot = await Jackpot.findOne({ cashierId });

    if (!jackpot) {
      // Create jackpot if it doesn't exist
      jackpot = new Jackpot({
        cashierId,
        amount: contributionAmount,
        baseAmount: contributionAmount,
        enabled: true,
        lastUpdated: new Date(),
      });
    } else {
      // Add to existing jackpot
      const oldAmount = jackpot.amount;
      jackpot.amount += contributionAmount;
      jackpot.lastUpdated = new Date();
    }

    await jackpot.save();

    // Log the contribution
    await JackpotLog.create({
      cashierId,
      amount: contributionAmount,
      reason: `Game contribution added - Game ${gameId}`,
      gameId,
    });

    console.log(
      `[addJackpotContribution] Added ${contributionAmount} to jackpot. New total: ${jackpot.amount}`
    );

    res.json({
      message: "Jackpot contribution added successfully",
      data: {
        contributionAmount,
        previousAmount: jackpot.amount - contributionAmount,
        newTotal: jackpot.amount,
      },
    });
  } catch (error) {
    console.error("[addJackpotContribution] Error:", error);
    next(error);
  }
};

// Toggle jackpot enabled/disabled
export const toggleJackpot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        message: "Enabled must be a boolean value",
      });
    }

    const jackpot = await Jackpot.findOneAndUpdate(
      { cashierId },
      {
        enabled,
        lastUpdated: new Date(),
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    // Log the status change
    await JackpotLog.create({
      cashierId,
      amount: 0,
      reason: `Jackpot ${enabled ? "enabled" : "disabled"} by moderator`,
      gameId: null,
    });

    console.log(`[toggleJackpot] Jackpot ${enabled ? "enabled" : "disabled"}`);

    res.json({
      message: `Jackpot ${enabled ? "enabled" : "disabled"} successfully`,
      data: {
        enabled: jackpot.enabled,
        amount: jackpot.amount,
      },
    });
  } catch (error) {
    console.error("[toggleJackpot] Error:", error);
    next(error);
  }
};

// Award jackpot to specific card (with or without game context)
export const awardJackpot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { gameId, cardId, drawAmount, message } = req.body;

    if (!cardId || !drawAmount) {
      return res.status(400).json({
        message: "cardId and drawAmount are required",
      });
    }

    if (drawAmount <= 0) {
      return res.status(400).json({ message: "Draw amount must be positive" });
    }

    const jackpot = await Jackpot.findOne({ cashierId });
    if (!jackpot || !jackpot.enabled) {
      return res.status(400).json({ message: "Jackpot is not enabled" });
    }

    if (drawAmount > jackpot.amount) {
      return res.status(400).json({
        message: "Draw amount cannot exceed available jackpot amount",
      });
    }

    let game = null;
    if (gameId) {
      game = await Game.findById(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const selectedCard = game.selectedCards.find((c) => c.id === cardId);
      if (!selectedCard) {
        return res.status(400).json({ message: "Card not found in game" });
      }

      if (game.jackpotWinner) {
        return res.status(400).json({
          message: "Jackpot winner already selected for this game",
        });
      }
    }

    const actualDrawAmount = Math.min(drawAmount, jackpot.amount);

    // Update game if provided
    if (game) {
      game.jackpotWinner = {
        cardId,
        prize: actualDrawAmount,
        message: message || `Jackpot win! Card ${cardId}`,
      };
      await game.save();
    }

    // Deduct jackpot
    const oldJackpotAmount = jackpot.amount;
    jackpot.amount -= actualDrawAmount;
    jackpot.lastUpdated = new Date();
    await jackpot.save();

    // Log jackpot award
    await JackpotLog.create({
      cashierId,
      amount: -actualDrawAmount,
      reason: `Jackpot awarded to card ${cardId}: ${actualDrawAmount} birr - ${
        message || "Manual jackpot award"
      }`,
      gameId: gameId || null,
    });

    // Create result record with required identifier
    await Result.create({
      gameId: gameId || null,
      winnerCardId: cardId,
      prize: actualDrawAmount,
      isJackpot: true,
      message: message || `Jackpot win! Card ${cardId}`,
      identifier: `jackpot_${Date.now()}_${cardId}`, // Required field
    });

    console.log(
      `[awardJackpot] Awarded ${actualDrawAmount} to card ${cardId} from jackpot ${oldJackpotAmount}${
        gameId ? ` for game ${gameId}` : " (manual award)"
      }`
    );

    // Emit Socket.IO event to notify clients
    emitJackpotAwarded(cashierId, {
      userId: cardId, // Map cardId to userId for frontend compatibility
      prize: actualDrawAmount,
      drawDate: new Date().toISOString(),
      message: message || `Jackpot win! Card ${cardId}`,
      gameId: gameId || null,
      remainingJackpot: jackpot.amount,
    });

    res.json({
      message: `Jackpot awarded successfully to card ${cardId}`,
      data: {
        gameId: gameId || null,
        cardId,
        drawAmount: actualDrawAmount,
        previousJackpot: oldJackpotAmount,
        remainingJackpot: jackpot.amount,
        message: message || `Jackpot win! Card ${cardId}`,
      },
    });
  } catch (error) {
    console.error("[awardJackpot] Error:", error);
    next(error);
  }
};
// Get jackpot award history
export const getJackpotHistory = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    // Get jackpot logs for this cashier
    const logs = await JackpotLog.find({ cashierId })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate("gameId", "gameNumber status");

    // Filter and format logs for better display
    const formattedLogs = logs.map((log) => ({
      timestamp: log.timestamp,
      amount: log.amount,
      reason: log.reason,
      game: log.gameId
        ? {
            gameNumber: log.gameId.gameNumber,
            status: log.gameId.status,
          }
        : null,
      isContribution: log.amount > 0 && log.reason.includes("contribution"),
      isAward: log.amount < 0 && log.reason.includes("awarded"),
      isManual: log.reason.includes("Manual jackpot update"),
    }));

    res.json({
      message: "Jackpot history retrieved successfully",
      data: formattedLogs,
    });
  } catch (error) {
    console.error("[getJackpotHistory] Error:", error);
    next(error);
  }
};

// Get paired cashier for moderator
export const getPairedCashier = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized. User ID missing." });
    }

    if (user.role !== "moderator") {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    if (!user.managedCashier) {
      return res.status(403).json({
        message: "No managed cashier assigned to this moderator",
        errorCode: "NO_MANAGED_CASHIER",
      });
    }

    const cashier = await User.findById(user.managedCashier)
      .select("name email")
      .lean();
    if (!cashier) {
      return res.status(404).json({
        message: "Cashier not found",
        errorCode: "CASHIER_NOT_FOUND",
      });
    }

    res.json({
      message: "Paired cashier retrieved successfully",
      data: {
        cashierId: user.managedCashier,
        name: cashier.name,
        email: cashier.email,
      },
    });
  } catch (error) {
    console.error("[getPairedCashier] Error:", error);
    next(error);
  }
};

// Update jackpot amount or status
export const updateJackpot = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { amount, enabled } = req.body;
    const update = { lastUpdated: new Date() };
    const logs = [];

    // Handle amount update - set exact amount
    if (amount !== undefined) {
      if (typeof amount !== "number" || amount < 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      // Get current amount to calculate change
      const currentJackpot = await Jackpot.findOne({ cashierId });
      const currentAmount = currentJackpot ? currentJackpot.amount : 0;
      const changeAmount = amount - currentAmount;

      update.amount = amount;
      update.baseAmount = amount; // Reset base amount when manually updated

      logs.push({
        cashierId,
        amount: changeAmount,
        reason: `Jackpot updated to ${amount} by moderator`,
        gameId: null,
      });
    }

    // Handle enabled status
    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "Invalid enabled value" });
      }
      update.enabled = enabled;
      logs.push({
        cashierId,
        amount: 0,
        reason: `Jackpot ${enabled ? "enabled" : "disabled"}`,
        gameId: null,
      });
    }

    // If no changes, return error
    if (!update.amount && !update.enabled) {
      return res.status(400).json({
        message: "No valid updates provided (amount or enabled required)",
      });
    }

    const jackpot = await Jackpot.findOneAndUpdate({ cashierId }, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

    // Create logs for changes
    for (const log of logs) {
      await JackpotLog.create(log);
    }

    console.log(
      `[updateJackpot] Updated jackpot - Amount: ${jackpot.amount}, Enabled: ${jackpot.enabled}`
    );

    res.json({
      message: "Jackpot updated successfully",
      data: {
        amount: jackpot.amount,
        baseAmount: jackpot.baseAmount,
        enabled: jackpot.enabled,
        lastUpdated: jackpot.lastUpdated,
      },
    });
  } catch (error) {
    console.error("[updateJackpot] Error:", error);
    next(error);
  }
};
