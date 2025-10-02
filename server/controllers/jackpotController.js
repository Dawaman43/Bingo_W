import { getCashierIdFromUser } from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import FutureWinner from "../models/FutureWinner.js";
import { validationResult } from "express-validator";
import mongoose from "mongoose";

// Get current jackpot
export const getJackpot = async (req, res) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const jackpot = await Jackpot.findOne({ cashierId });
    if (!jackpot) return res.status(404).json({ message: "Jackpot not found" });

    const activeGames = await Game.countDocuments({
      cashierId,
      isActive: true,
    });

    res.json({
      message: "Jackpot retrieved successfully",
      data: {
        amount: jackpot.amount,
        baseAmount: jackpot.baseAmount || 0,
        enabled: jackpot.enabled,
        lastUpdated: jackpot.lastUpdated || new Date(),
        activeGames,
        jackpotExists: true,
        winnerCardId: jackpot.winnerCardId || null,
        winnerMessage: jackpot.winnerMessage || null,
        lastAwardedAmount: jackpot.drawAmount || 0,
        lastAwardedTimestamp: jackpot.drawTimestamp || null,
      },
    });
  } catch (error) {
    console.error("[getJackpot] Error:", error);
    res.status(500).json({ message: "Server error" });
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

    const { amount, gameId } = req.body;

    if (typeof amount !== "number" || amount < 0) {
      return res.status(400).json({
        message: "Amount must be a positive number",
      });
    }

    // Validate gameId (gameNumber) if provided
    if (gameId !== undefined) {
      if (typeof gameId !== "number") {
        return res.status(400).json({
          message: "gameId must be a number",
        });
      }
      const gameExists = await Game.findOne({ gameNumber: gameId, cashierId });
      if (!gameExists) {
        return res.status(400).json({
          message: `Game with gameNumber ${gameId} not found for cashier`,
        });
      }
    }

    let jackpot = await Jackpot.findOne({ cashierId });
    const oldAmount = jackpot ? jackpot.amount : 0;
    const changeAmount = amount - oldAmount;

    if (!jackpot) {
      jackpot = new Jackpot({
        cashierId,
        amount,
        baseAmount: amount,
        enabled: true,
        lastUpdated: new Date(),
      });
    } else {
      jackpot.amount = amount;
      jackpot.baseAmount = amount;
      jackpot.lastUpdated = new Date();
    }

    await jackpot.save();

    await JackpotLog.create({
      cashierId,
      amount: changeAmount,
      reason: `Manual jackpot update by moderator - set to ${amount}${
        gameId !== undefined ? ` for game ${gameId}` : ""
      }`,
      gameId:
        gameId !== undefined
          ? (
              await Game.findOne({ gameNumber: gameId, cashierId })
            )._id
          : null,
    });

    console.log(
      `[setJackpotAmount] Moderator set jackpot to ${amount} (change: ${changeAmount})${
        gameId !== undefined ? ` for game ${gameId}` : ""
      }`
    );

    res.json({
      message: "Jackpot amount updated successfully",
      data: {
        oldAmount,
        newAmount: amount,
        changeAmount,
        totalJackpot: jackpot.amount,
        gameId: gameId !== undefined ? gameId : null,
      },
    });
  } catch (error) {
    console.error("[setJackpotAmount] Error:", error);
    next(error);
  }
};

// Add contribution to existing jackpot
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
      jackpot = new Jackpot({
        cashierId,
        amount: contributionAmount,
        baseAmount: contributionAmount,
        enabled: true,
        lastUpdated: new Date(),
      });
    } else {
      const oldAmount = jackpot.amount;
      jackpot.amount += contributionAmount;
      jackpot.lastUpdated = new Date();
    }

    await jackpot.save();

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

export const awardJackpot = async (req, res) => {
  let session = null;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const user = req.user;
    if (!user || !user.role) {
      return res
        .status(401)
        .json({ message: "Unauthorized. User role missing." });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;
    const { cardId, drawAmount, message, gameId } = req.body;

    session = await mongoose.startSession();
    const result = await session.withTransaction(async () => {
      const jackpot = await Jackpot.findOne({ cashierId }).session(session);
      if (!jackpot || !jackpot.enabled) {
        throw new Error("Jackpot is not enabled");
      }

      // Determine if this is a future game
      let gameDoc = null;
      let isFutureGame = false;
      if (gameId !== undefined && gameId !== null) {
        if (typeof gameId !== "number") {
          throw new Error("Game ID must be a number (gameNumber)");
        }
        gameDoc = await Game.findOne({ gameNumber: gameId, cashierId }).session(
          session
        );
        if (!gameDoc) {
          isFutureGame = true;
          console.log(
            `[awardJackpot] Configuring jackpot for future game ${gameId}`
          );
        }
      }

      if (user.role !== "moderator") {
        throw new Error("Only moderators can set jackpot winners");
      }

      if (!cardId || !drawAmount || !message) {
        throw new Error("cardId, drawAmount, and message are required");
      }

      if (drawAmount > jackpot.baseAmount) {
        throw new Error(
          `Draw amount cannot exceed total jackpot (${jackpot.baseAmount.toLocaleString()} BIRR)`
        );
      }

      let actualDrawAmount = drawAmount;
      let winnerCardId = cardId.toString();
      let winnerMessage = message;

      if (isFutureGame) {
        // FUTURE GAME: Store configuration only
        await FutureWinner.findOneAndUpdate(
          { gameNumber: gameId, cashierId },
          {
            $set: {
              gameNumber: gameId,
              cashierId,
              cardId: parseInt(cardId),
              jackpotEnabled: true,
              jackpotDrawAmount: actualDrawAmount,
              jackpotMessage: winnerMessage,
              configuredBy: user.id,
              used: false,
            },
          },
          { upsert: true, session, new: true }
        );

        console.log(
          `[awardJackpot] 💰 Stored jackpot config for future game ${gameId}`
        );
      } else {
        // CURRENT GAME: Deduct from jackpot.amount
        if (actualDrawAmount > jackpot.amount) {
          throw new Error("Draw amount cannot exceed current jackpot amount");
        }

        jackpot.amount -= actualDrawAmount;
        jackpot.lastUpdated = new Date();
        jackpot.lastAwardedAmount = actualDrawAmount;
        jackpot.drawTimestamp = new Date();
        jackpot.winnerCardId = winnerCardId;
        jackpot.winnerMessage = winnerMessage;
        await jackpot.save({ session });

        // Log the award
        await JackpotLog.create(
          [
            {
              cashierId,
              amount: -actualDrawAmount,
              reason: `Jackpot awarded to card ${winnerCardId}: ${actualDrawAmount} birr - ${winnerMessage}`,
              gameId: gameDoc ? gameDoc._id : null,
              isAward: true,
              winnerCardId,
              message: winnerMessage,
              triggeredByCashier: false,
              timestamp: new Date(),
            },
          ],
          { session }
        );

        // Store result
        await Result.create(
          [
            {
              gameId: gameDoc ? gameDoc._id : null,
              winnerCardId,
              prize: actualDrawAmount,
              isJackpot: true,
              message: winnerMessage,
              identifier: `jackpot_${Date.now()}_${winnerCardId}`,
              timestamp: new Date(),
            },
          ],
          { session }
        );
      }

      return {
        gameId: gameId ?? null,
        cardId: winnerCardId,
        drawAmount: actualDrawAmount,
        remainingJackpot: jackpot.amount,
        message: winnerMessage,
        isFutureGame,
      };
    });

    return res.json({
      message: `Jackpot awarded successfully to card ${result.cardId}${
        result.isFutureGame ? " (configured for future game)" : ""
      }`,
      data: result,
    });
  } catch (error) {
    console.error("[awardJackpot] Error:", error);
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error("[awardJackpot] Abort error:", abortErr);
      }
      await session.endSession();
    }
    return res.status(400).json({ message: error.message });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

export const getJackpotHistory = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const logs = await JackpotLog.find({ cashierId, isAward: true })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate("gameId", "gameNumber status");

    const formattedLogs = logs.map((log) => ({
      _id: log._id,
      timestamp: log.timestamp,
      amount: log.amount,
      reason: log.reason,
      game: log.gameId
        ? { gameNumber: log.gameId.gameNumber, status: log.gameId.status }
        : null,
      winnerCardId: log.winnerCardId,
      message: log.message,
      triggeredByCashier: log.triggeredByCashier || false,
      cashierId: log.cashierId,
    }));

    res.json({
      message: "Jackpot award history retrieved successfully",
      data: formattedLogs,
    });
  } catch (error) {
    console.error("[getJackpotHistory] Error:", error);
    next(error);
  }
};

// Delete a jackpot award log (moderator-only, non-triggered awards only)
export const deleteJackpotLog = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const user = req.user;
    if (!user || user.role !== "moderator") {
      return res
        .status(403)
        .json({ message: "Unauthorized. Moderator role required." });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;
    const { logId } = req.params;

    const log = await JackpotLog.findOne({
      _id: logId,
      cashierId,
      isAward: true,
    });
    if (!log) {
      return res.status(404).json({ message: "Jackpot award log not found" });
    }

    if (log.triggeredByCashier) {
      return res
        .status(403)
        .json({ message: "Cannot delete cashier-triggered award" });
    }

    const jackpot = await Jackpot.findOne({ cashierId });
    if (!jackpot) {
      return res.status(400).json({ message: "Jackpot not found" });
    }

    const awardAmount = -log.amount;
    jackpot.amount += awardAmount;
    jackpot.lastUpdated = new Date();

    const latestAward = await JackpotLog.findOne({
      cashierId,
      isAward: true,
      timestamp: { $gt: log.timestamp },
    });
    if (!latestAward) {
      jackpot.winnerCardId = null;
      jackpot.winnerMessage = null;
    }

    await jackpot.save();
    await JackpotLog.deleteOne({ _id: logId });
    await Result.deleteOne({
      identifier: log.reason.match(/jackpot_\d+_\d+/)[0],
    });

    console.log(
      `[deleteJackpotLog] Moderator deleted award log ${logId}, restored ${awardAmount} to jackpot`
    );

    res.json({
      message: "Jackpot award log deleted successfully",
      data: {
        restoredAmount: awardAmount,
        newJackpotAmount: jackpot.amount,
      },
    });
  } catch (error) {
    console.error("[deleteJackpotLog] Error:", error);
    next(error);
  }
};

// Update a jackpot award log (moderator-only, non-triggered awards only)
export const updateJackpotLog = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const user = req.user;
    if (!user || user.role !== "moderator") {
      return res
        .status(403)
        .json({ message: "Unauthorized. Moderator role required." });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;
    const { logId } = req.params;
    const { amount, winnerCardId, message } = req.body;

    const log = await JackpotLog.findOne({
      _id: logId,
      cashierId,
      isAward: true,
    });
    if (!log) {
      return res.status(404).json({ message: "Jackpot award log not found" });
    }

    if (log.triggeredByCashier) {
      return res
        .status(403)
        .json({ message: "Cannot update cashier-triggered award" });
    }

    const jackpot = await Jackpot.findOne({ cashierId });
    if (!jackpot) {
      return res.status(400).json({ message: "Jackpot not found" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Amount must be positive" });
    }

    if (amount > jackpot.amount + -log.amount) {
      return res.status(400).json({
        message: "Updated amount cannot exceed available jackpot amount",
      });
    }

    if (!winnerCardId || !message) {
      return res.status(400).json({
        message: "winnerCardId and message are required",
      });
    }

    const oldAmount = -log.amount;
    const newAmount = amount;
    const amountDifference = oldAmount - newAmount;

    log.amount = -newAmount;
    log.winnerCardId = winnerCardId;
    log.message = message;
    log.reason = `Jackpot awarded to card ${winnerCardId}: ${newAmount} birr - ${message}`;
    await log.save();

    jackpot.amount += amountDifference;
    jackpot.lastUpdated = new Date();

    const latestAward = await JackpotLog.findOne({
      cashierId,
      isAward: true,
      timestamp: { $gt: log.timestamp },
    });
    if (!latestAward) {
      jackpot.winnerCardId = winnerCardId;
      jackpot.winnerMessage = message;
    }

    await jackpot.save();

    await Result.updateOne(
      { identifier: log.reason.match(/jackpot_\d+_\d+/)[0] },
      {
        winnerCardId,
        prize: newAmount,
        message,
      }
    );

    console.log(
      `[updateJackpotLog] Moderator updated award log ${logId}: amount ${newAmount}, card ${winnerCardId}`
    );

    res.json({
      message: "Jackpot award log updated successfully",
      data: {
        amount: newAmount,
        winnerCardId,
        message,
        newJackpotAmount: jackpot.amount,
      },
    });
  } catch (error) {
    console.error("[updateJackpotLog] Error:", error);
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

// Update jackpot settings
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

    if (amount !== undefined) {
      if (typeof amount !== "number" || amount < 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const currentJackpot = await Jackpot.findOne({ cashierId });
      const currentAmount = currentJackpot ? currentJackpot.amount : 0;
      const changeAmount = amount - currentAmount;

      update.amount = amount;
      update.baseAmount = amount;

      logs.push({
        cashierId,
        amount: changeAmount,
        reason: `Jackpot updated to ${amount} by moderator`,
        gameId: null,
      });
    }

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

    if (amount === undefined && enabled === undefined) {
      return res.status(400).json({
        message: "No valid updates provided (amount or enabled required)",
      });
    }

    const jackpot = await Jackpot.findOneAndUpdate({ cashierId }, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });

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

// adminController.js
export const getJackpotStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid game ID" });
    }

    const game = await Game.findById(id).lean();
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    console.log(`[getJackpotStatus] Fetched game ${id}:`, {
      gameNumber: game.gameNumber,
      jackpotEnabled: game.jackpotEnabled,
    });

    res.json({
      message: "Jackpot status retrieved successfully",
      jackpotEnabled: !!game.jackpotEnabled,
    });
  } catch (error) {
    console.error("[getJackpotStatus] Error:", error);
    next(error);
  }
};
