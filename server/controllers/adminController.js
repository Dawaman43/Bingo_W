import User from "../models/User.js";
import Game from "../models/Game.js";
import GameLog from "../models/GameLog.js";
import JackpotCandidate from "../models/JackpotCandidate.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";
import Result from "../models/Result.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import FutureWinner from "../models/FutureWinner.js";

import {
  getNextGameNumber,
  getCurrentGameNumber,
  createGameRecord,
  getCashierIdFromUser,
  generateQuickWinSequence,
} from "../utils/gameUtils.js";
import Counter from "../models/Counter.js";
import Card from "../models/Card.js";
import {
  getNumbersForPattern,
  computeForcedSequence,
} from "../utils/bingoUtils.js";

export const addUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cashier, moderator } = req.body;

    if (
      !cashier?.name ||
      !cashier?.email ||
      !cashier?.password ||
      !moderator?.name ||
      !moderator?.email ||
      !moderator?.password
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          "Name, email, and password are required for both cashier and moderator",
      });
    }

    if (cashier.role !== "cashier" || moderator.role !== "moderator") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid roles specified" });
    }

    // Check for existing emails
    const [existingCashier, existingModerator] = await Promise.all([
      User.findOne({ email: cashier.email }).session(session),
      User.findOne({ email: moderator.email }).session(session),
    ]);

    if (existingCashier || existingModerator) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Email already exists in the database" });
    }

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const hashedCashierPassword = await bcrypt.hash(cashier.password, salt);
    const hashedModeratorPassword = await bcrypt.hash(moderator.password, salt);

    // Create cashier
    const newCashier = await User.create(
      [
        {
          name: cashier.name,
          email: cashier.email,
          password: hashedCashierPassword,
          role: "cashier",
        },
      ],
      { session }
    );

    // Create moderator linked to cashier
    const newModerator = await User.create(
      [
        {
          name: moderator.name,
          email: moderator.email,
          password: hashedModeratorPassword,
          role: "moderator",
          managedCashier: newCashier[0]._id,
        },
      ],
      { session }
    );

    // Update cashier with moderatorId
    await User.findByIdAndUpdate(
      newCashier[0]._id,
      { moderatorId: newModerator[0]._id },
      { session }
    );

    const { password: cPass, ...cashierWithoutPassword } =
      newCashier[0].toObject();
    const { password: mPass, ...moderatorWithoutPassword } =
      newModerator[0].toObject();

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Cashier and Moderator registered successfully",
      users: [cashierWithoutPassword, moderatorWithoutPassword],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding users:", error);
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const requestingUser = req.user;
    let users;

    if (requestingUser.role === "moderator") {
      const pairedCashier = await User.findById(requestingUser.managedCashier);

      if (!pairedCashier) {
        return res.status(404).json({ message: "No paired cashier found" });
      }

      users = [pairedCashier, requestingUser];
    } else {
      users = await User.find(
        { role: { $in: ["cashier", "moderator"] } },
        "-password"
      ).sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const user = await User.findById(id).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Cannot delete an admin" });
    }

    let cashier = null;
    let moderator = null;

    if (user.role === "cashier") {
      cashier = user;
      moderator = await User.findById(user.moderatorId).session(session);
    } else if (user.role === "moderator") {
      moderator = user;
      cashier = await User.findById(user.managedCashier).session(session);
    }

    if (cashier) {
      const gameIds = await Game.find({ cashierId: cashier._id })
        .distinct("_id")
        .session(session);

      if (gameIds.length) {
        await GameLog.deleteMany({ gameId: { $in: gameIds } }).session(session);
        await JackpotCandidate.deleteMany({ gameId: { $in: gameIds } }).session(
          session
        );
        await Game.deleteMany({ cashierId: cashier._id }).session(session);
      }
    }

    if (cashier) {
      await User.findByIdAndDelete(cashier._id).session(session);
    }
    if (moderator) {
      await User.findByIdAndDelete(moderator._id).session(session);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "User and their linked pair deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting user:", error);
    next(error);
  }
};

export const getAllGames = async (req, res, next) => {
  try {
    const games = await Game.find().sort({ gameNumber: 1 });
    console.log("[getAllGames] Retrieved games count:", games.length);
    res.json({ message: "All games retrieved successfully", data: games });
  } catch (error) {
    console.error("[getAllGames] Error in getAllGames:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getNextPendingGame = async (req, res, next) => {
  try {
    const game = await Game.findOne({ status: "pending" })
      .sort({ gameNumber: 1 })
      .lean();
    if (!game) {
      return res.status(404).json({ message: "No pending games found" });
    }
    res.json({ message: "Next pending game retrieved", data: game });
  } catch (error) {
    console.error("[getNextPendingGame] Error in getNextPendingGame:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllCards = async (req, res, next) => {
  try {
    const cards = await Card.find().sort({ card_number: 1 });
    res.json({ message: "All cards retrieved successfully", data: cards });
  } catch (error) {
    console.error("[getAllCards] Error:", error);
    next(error);
  }
};

export const createSequentialGames = async (req, res, next) => {
  let session = null;
  try {
    const {
      betAmount = 10,
      houseFeePercentage = 15,
      pattern = "horizontal_line",
      jackpotEnabled = true,
      cardPool = [],
      moderatorWinnerCardId = null,
    } = req.body;

    // Validate inputs
    if (!cardPool.length) {
      return res.status(400).json({ message: "cardPool required" });
    }
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      return res.status(400).json({ message: "Invalid betAmount" });
    }
    if (
      !Number.isFinite(houseFeePercentage) ||
      houseFeePercentage < 0 ||
      houseFeePercentage > 100
    ) {
      return res.status(400).json({ message: "Invalid houseFeePercentage" });
    }

    // Get cashierId
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    // Fetch cards
    const cards = await Card.find({ card_number: { $in: cardPool } });
    if (cards.length !== cardPool.length) {
      return res.status(400).json({ message: "Some cards not found" });
    }

    const gameCards = cards.map((c) => ({
      id: c.card_number,
      numbers: c.numbers,
    }));

    // Calculate financials
    const bet = parseFloat(betAmount);
    const percentage = parseFloat(houseFeePercentage);
    const selectedCount = gameCards.length;
    const totalPot = bet * selectedCount;
    const jackpotContribution = jackpotEnabled ? bet : 0;
    const remainingAmount = totalPot - jackpotContribution;
    const houseFee = (remainingAmount * percentage) / 100;
    const prizePool = remainingAmount - houseFee;

    console.log("[createSequentialGames] Input payload:", {
      betAmount,
      houseFeePercentage,
      cardPoolLength: cardPool.length,
      jackpotEnabled,
    });
    console.log("[createSequentialGames] Calculated financials:", {
      totalPot,
      jackpotContribution,
      remainingAmount,
      houseFee,
      prizePool,
    });

    // Validate houseFee
    if (!Number.isFinite(houseFee) || houseFee < 0) {
      console.error("[createSequentialGames] Invalid houseFee:", houseFee);
      return res.status(500).json({ message: "Invalid house fee calculation" });
    }

    // Get next available game number
    const lastGame = await Game.findOne({ cashierId })
      .sort({ gameNumber: -1 })
      .lean();
    const gameNumber = lastGame ? lastGame.gameNumber + 1 : 1;

    // Load future winner config if exists
    let futureWinner = await FutureWinner.findOne({
      gameNumber,
      cashierId,
      used: false,
    });

    let winnerCardId = moderatorWinnerCardId || futureWinner?.cardId || null;
    let winnerCardNumbers = futureWinner?.fullCardNumbers || null;
    let forcedCallSequence = futureWinner?.forcedCallSequence || [];
    let selectedWinnerNumbers = futureWinner?.playableNumbers || [];
    let selectedWinnerRowIndices = futureWinner?.selectedWinnerRowIndices || [];

    // Create the game with jackpot fields
    const game = await createGameRecord({
      gameNumber,
      cashierId,
      betAmount,
      houseFeePercentage,
      houseFee: parseFloat(houseFee.toFixed(2)),
      selectedCards: gameCards,
      pattern,
      prizePool: parseFloat(prizePool.toFixed(2)),
      jackpotEnabled,
      jackpotContribution: parseFloat(jackpotContribution.toFixed(2)),
      moderatorWinnerCardId: winnerCardId,
      forcedCallSequence,
      selectedWinnerNumbers,
      selectedWinnerRowIndices,
      targetWinCall: forcedCallSequence.length || null,
      forcedCallIndex: 0,
      winnerCardNumbers,
      // Initialize jackpot fields
      jackpotWinnerCardId: null,
      jackpotAwardedAmount: 0,
      jackpotWinnerMessage: null,
      jackpotDrawTimestamp: null,
    });

    console.log("[createSequentialGames] Stored game:", {
      gameNumber: game.gameNumber,
      houseFee: game.houseFee,
      cardPoolLength: game.selectedCards.length,
      prizePool: game.prizePool,
      jackpotContribution: game.jackpotContribution,
      jackpotWinnerCardId: game.jackpotWinnerCardId,
      jackpotAwardedAmount: game.jackpotAwardedAmount,
    });

    // Apply jackpot award if configured in FutureWinner
    if (
      futureWinner &&
      futureWinner.jackpotEnabled &&
      futureWinner.jackpotDrawAmount > 0
    ) {
      session = await mongoose.startSession();
      await session.withTransaction(async () => {
        const jackpot = await Jackpot.findOne({ cashierId }).session(session);
        if (!jackpot || !jackpot.enabled) {
          throw new Error("Jackpot is not enabled for award");
        }

        // Use live jackpot amount instead of baseAmount
        if (futureWinner.jackpotDrawAmount > jackpot.amount) {
          throw new Error(
            `Configured jackpot draw amount (${futureWinner.jackpotDrawAmount}) exceeds available jackpot (${jackpot.amount})`
          );
        }

        const actualDrawAmount = futureWinner.jackpotDrawAmount;
        const winnerCardIdStr = futureWinner.cardId.toString();
        const winnerMessage =
          futureWinner.jackpotMessage ||
          `Jackpot won by card ${winnerCardIdStr}`;

        // Update jackpot
        jackpot.winnerCardId = winnerCardIdStr;
        jackpot.winnerMessage = winnerMessage;
        jackpot.amount -= actualDrawAmount; // <- draw from actual amount
        jackpot.lastUpdated = new Date();
        jackpot.lastAwardedAmount = actualDrawAmount;
        jackpot.drawTimestamp = new Date();
        await jackpot.save({ session });

        // Create JackpotLog
        const logData = {
          cashierId,
          amount: -actualDrawAmount,
          reason: `Jackpot pre-awarded for game ${gameNumber} to card ${winnerCardIdStr}: ${actualDrawAmount} birr - ${winnerMessage}`,
          gameId: game._id,
          isAward: true,
          winnerCardId: winnerCardIdStr,
          message: winnerMessage,
          triggeredByCashier: false,
          timestamp: new Date(),
        };
        await JackpotLog.create([logData], { session });

        // Create Result
        await Result.create(
          [
            {
              gameId: game._id,
              winnerCardId: winnerCardIdStr,
              prize: actualDrawAmount,
              isJackpot: true,
              message: winnerMessage,
              identifier: `jackpot_${Date.now()}_${winnerCardIdStr}`,
              timestamp: new Date(),
            },
          ],
          { session }
        );

        // Update game with jackpot details
        await Game.findByIdAndUpdate(
          game._id,
          {
            $set: {
              jackpotWinnerCardId: winnerCardIdStr,
              jackpotAwardedAmount: actualDrawAmount,
              jackpotWinnerMessage: winnerMessage,
              jackpotDrawTimestamp: new Date(),
            },
          },
          { session }
        );

        console.log(
          `[createSequentialGames] 💰 Applied configured jackpot award for game ${gameNumber}: card ${winnerCardIdStr}, amount ${actualDrawAmount}`
        );
      });
    }

    // Mark future winner as used
    if (futureWinner) {
      await FutureWinner.findByIdAndUpdate(
        futureWinner._id,
        {
          $set: {
            used: true,
            usedAt: new Date(),
            gameId: game._id,
          },
        },
        { new: true }
      );
      console.log(
        `[createSequentialGames] Marked FutureWinner (incl. jackpot) for game ${gameNumber} as used`
      );
    } else {
      console.log(
        `[createSequentialGames] 🎲 No future winner, Game ${gameNumber} is random`
      );
    }

    // Verify stored houseFee
    const expectedHouseFee = (remainingAmount * percentage) / 100;
    if (Math.abs(game.houseFee - expectedHouseFee) > 0.01) {
      console.error("[createSequentialGames] House fee mismatch:", {
        stored: game.houseFee,
        expected: expectedHouseFee,
      });
      return res.status(500).json({ message: "House fee storage error" });
    }

    res.json({ message: "Game created successfully", game });
  } catch (err) {
    console.error("[createSequentialGames] Error:", err);
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        console.error("[createSequentialGames] Abort error:", abortErr);
      }
      await session.endSession();
    }
    next(err);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

export const moderatorConfigureNextGameNumber = async (req, res, next) => {
  try {
    const { startNumber } = req.body;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (typeof startNumber !== "number" || startNumber < 1) {
      await GameLog.create({
        gameId: null,
        action: "configureNextGameNumber",
        status: "failed",
        details: { error: "Invalid starting number", startNumber },
      });
      return res.status(400).json({
        message: "Invalid starting number",
        errorCode: "INVALID_START_NUMBER",
      });
    }

    const lastGame = await Game.findOne({ cashierId })
      .sort({ gameNumber: -1 })
      .lean();
    if (lastGame && lastGame.gameNumber >= startNumber) {
      await GameLog.create({
        gameId: null,
        action: "configureNextGameNumber",
        status: "failed",
        details: {
          error: "Cannot set counter lower than existing game numbers",
          startNumber,
          highestGameNumber: lastGame.gameNumber,
        },
      });
      return res.status(400).json({
        message: `Cannot set counter to ${startNumber}. Existing games have higher numbers (up to ${lastGame.gameNumber}).`,
        errorCode: "INVALID_COUNTER_VALUE",
      });
    }

    await Counter.findOneAndUpdate(
      { _id: `gameNumber_${cashierId}` },
      { seq: startNumber, cashierId },
      { upsert: true, new: true }
    );

    await GameLog.create({
      gameId: null,
      action: "configureNextGameNumber",
      status: "success",
      details: { startNumber, cashierId },
    });

    res.json({
      message: `Next game will start from ${startNumber}`,
      data: { nextGameNumber: startNumber },
    });
  } catch (error) {
    console.error(
      "[moderatorConfigureNextGameNumber] Error in configureNextGameNumber:",
      error
    );
    await GameLog.create({
      gameId: null,
      action: "configureNextGameNumber",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};

export const getFinishedGames = async (req, res, next) => {
  try {
    const finishedGames = await Game.find({ status: "completed" })
      .sort({ gameNumber: 1 })
      .select(
        "_id gameNumber winner moderatorWinnerCardId winnerCardNumbers selectedWinnerNumbers"
      );

    const finishedIds = finishedGames.map((g) => g._id);
    res.json({
      message: "Finished games retrieved",
      data: { finishedGames, finishedIds },
    });
  } catch (error) {
    console.error("[getFinishedGames] Error in getFinishedGames:", error);
    next(error);
  }
};

export const getGameLogs = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const logs = await GameLog.find({
      gameId: { $in: await Game.find({ cashierId }).distinct("_id") },
    }).sort({ timestamp: -1 });

    res.json({
      message: "Game logs retrieved successfully",
      data: logs,
    });
  } catch (error) {
    console.error("[getGameLogs] Error:", error);
    next(error);
  }
};

export const configureFutureWinners = async (req, res) => {
  const { games } = req.body;

  if (!Array.isArray(games)) {
    console.error(
      "[configureFutureWinners] Invalid input: games is not an array",
      { games }
    );
    return res
      .status(400)
      .json({ message: "Invalid input: games must be an array" });
  }

  const moderatorId = req.user.id;

  try {
    const moderator = await User.findById(moderatorId).select(
      "managedCashier role"
    );
    if (!moderator) throw new Error("Moderator not found");
    if (moderator.role !== "moderator")
      throw new Error("User is not a moderator");
    if (!moderator.managedCashier)
      throw new Error("No cashier assigned to this moderator");

    const cashierId = moderator.managedCashier;
    console.log("[configureFutureWinners] Fetched cashierId:", cashierId);

    const futureWinners = [];

    for (const {
      gameNumber,
      cardId,
      jackpotEnabled,
      pattern = "all",
    } of games) {
      console.log("[configureFutureWinners] Processing game:", {
        gameNumber,
        cardId,
        jackpotEnabled,
        pattern,
      });

      if (!Number.isInteger(gameNumber) || gameNumber < 1)
        throw new Error(`Invalid game number: ${gameNumber}`);
      if (!Number.isInteger(cardId) || cardId < 1)
        throw new Error(`Invalid card ID: ${cardId}`);

      const card = await Card.findOne({ card_number: cardId });
      if (!card) throw new Error(`Card not found for ID: ${cardId}`);
      console.log("[configureFutureWinners] Fetched card:", {
        cardId,
        numbers: card.numbers,
      });

      let chosenPattern = pattern;
      if (pattern === "all") {
        const easyPatterns = [
          "horizontal_line",
          "vertical_line",
          "main_diagonal",
          "other_diagonal",
          "four_corners_center",
        ];
        chosenPattern =
          easyPatterns[Math.floor(Math.random() * easyPatterns.length)];
        console.log(
          `[configureFutureWinners] 🎯 "all" → converted to: ${chosenPattern}`
        );
      }

      const { selectedNumbers, selectedIndices } = getNumbersForPattern(
        card.numbers,
        chosenPattern,
        [],
        true
      );

      console.log(
        `[configureFutureWinners] ✅ Numbers for pattern "${chosenPattern}": [${selectedNumbers.join(
          ", "
        )}]`
      );

      if (!selectedNumbers || selectedNumbers.length === 0) {
        throw new Error(`No numbers returned for pattern "${chosenPattern}"`);
      }

      const forcedCallSequence = generateQuickWinSequence(
        selectedNumbers.map(Number),
        selectedNumbers.length,
        10,
        14
      );

      console.log(
        `[configureFutureWinners] 🚀 Generated forcedCallSequence (${forcedCallSequence.length} calls):`,
        forcedCallSequence
      );

      const gameDoc = await Game.findOneAndUpdate(
        { gameNumber },
        {
          $set: {
            forcedCallSequence,
            forcedCallIndex: 0,
            forcedPattern: chosenPattern,
            moderatorWinnerCardId: cardId,
          },
        },
        { new: true }
      );

      if (!gameDoc) {
        console.warn(
          `[configureFutureWinners] ⚠ Game not found for gameNumber ${gameNumber}. Forced sequence not synced.`
        );
      } else {
        console.log(
          `[configureFutureWinners] 🔗 Synced forced sequence into Game ${gameNumber}`,
          {
            forcedCallSequence: gameDoc.forcedCallSequence,
            forcedPattern: gameDoc.forcedPattern,
          }
        );
      }

      futureWinners.push({
        gameNumber,
        cardId,
        moderatorId,
        cashierId,
        fullCardNumbers: card.numbers.map((row) =>
          row.map((v) => (v === "FREE" ? null : v))
        ),
        playableNumbers: selectedNumbers,
        forcedCallSequence,
        pattern: chosenPattern,
        jackpotEnabled,
        selectedWinnerRowIndices: selectedIndices,
      });
    }

    const savedWinners = await FutureWinner.create(futureWinners);

    console.log(
      `[configureFutureWinners] Saved winners with playableNumbers:`,
      savedWinners.map((w) => ({
        gameNumber: w.gameNumber,
        playableNumbers: w.playableNumbers,
      }))
    );

    console.log(
      "[configureFutureWinners] ✅ Saved future winners:",
      savedWinners.map((w) => ({
        gameNumber: w.gameNumber,
        cardId: w.cardId,
        pattern: w.pattern,
        sequenceLength: w.forcedCallSequence.length,
      }))
    );

    return res.status(201).json({
      message: "Future winners configured successfully",
      winners: savedWinners,
    });
  } catch (error) {
    console.error("[configureFutureWinners] ❌ Error:", error);
    return res
      .status(400)
      .json({ message: error.message || "Failed to configure future winners" });
  }
};
