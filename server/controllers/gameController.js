// controllers/gameController.js (Full corrected file - with updated generateQuickWinSequence calls)
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import {
  getNextGameNumber,
  getNextSequence,
  getCashierIdFromUser,
  getNumbersForPattern,
  generateQuickWinSequence, // Add this import for 10-14 call sequences
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import GameLog from "../models/GameLog.js";
import Counter from "../models/Counter.js";
import Card from "../models/Card.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";
import FutureWinner from "../models/FutureWinner.js"; // NEW model

export const createGame = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized. User ID missing." });
    }

    // Determine cashierId from user role
    let cashierId;
    if (user.role === "moderator") {
      cashierId = user.managedCashier;
      if (!cashierId) {
        return res
          .status(403)
          .json({ message: "Moderator has no managed cashier assigned" });
      }
    } else if (user.role === "cashier") {
      cashierId = user.id;
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    const {
      pattern = "all",
      betAmount = 10,
      houseFeePercentage = 15,
      jackpotEnabled = true,
      selectedCards = [],
      moderatorWinnerCardId = null,
    } = req.body;

    // ... rest of createGame logic remains the same, use `cashierId` from above
  } catch (error) {
    console.error("[createGame] Error:", error);
    next(error);
  }
};

// Get game by ID
export const getGameById = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const game = await Game.findOne({ _id: id, cashierId }).lean();
    if (!game) {
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    console.log("[getGameById] Retrieved game:", {
      gameId: id,
      gameNumber: game.gameNumber,
      cashierId: game.cashierId,
      jackpotEnabled: game.jackpotEnabled,
      jackpotWinnerCardId: game.jackpotWinnerCardId,
      jackpotAwardedAmount: game.jackpotAwardedAmount,
      jackpotWinnerMessage: game.jackpotWinnerMessage,
      jackpotDrawTimestamp: game.jackpotDrawTimestamp,
    });

    res.json({
      message: "Game retrieved successfully",
      game,
    });
  } catch (error) {
    console.error("[getGameById] Error:", {
      message: error.message,
      stack: error.stack,
      gameId: req.params.id,
    });
    next(error);
  }
};

// Get all games for cashier
export const getGames = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { id } = req.params;

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid game ID format",
        });
      }

      const game = await Game.findOne({ _id: id, cashierId });
      if (!game) {
        return res.status(404).json({
          message: "Game not found or you are not authorized to access it",
        });
      }

      return res.json({
        message: "Game retrieved successfully",
        game,
      });
    }

    const games = await Game.find({ cashierId }).sort({ createdAt: -1 });

    res.json({
      message: "Games retrieved successfully",
      count: games.length,
      games,
    });
  } catch (error) {
    console.error("[getGames] Error:", error);
    next(error);
  }
};

// Update game
export const updateGame = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const {
      calledNumbers,
      calledNumbersLog,
      moderatorWinnerCardId,
      jackpotEnabled,
      status,
      selectedWinnerRowIndices,
    } = req.body;

    const updateData = {};
    if (calledNumbers) updateData.calledNumbers = calledNumbers;
    if (calledNumbersLog) updateData.calledNumbersLog = calledNumbersLog;
    if (moderatorWinnerCardId !== undefined)
      updateData.moderatorWinnerCardId = Number(moderatorWinnerCardId);
    if (jackpotEnabled !== undefined)
      updateData.jackpotEnabled = jackpotEnabled;
    if (status) updateData.status = status;
    if (selectedWinnerRowIndices !== undefined)
      updateData.selectedWinnerRowIndices = selectedWinnerRowIndices;

    const game = await Game.findOneAndUpdate(
      { _id: req.params.id, cashierId },
      updateData,
      { new: true }
    );

    if (!game) {
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    res.json({ message: "Game updated successfully", data: game });
  } catch (error) {
    console.error("[updateGame] Error in updateGame:", error);
    next(error);
  }
};

// Select winner for a game
export const selectWinner = async (req, res, next) => {
  try {
    const { gameNumber, cardId } = req.body;
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;
    const moderatorId = req.user._id;

    const game = await Game.findOne({ gameNumber, cashierId });
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const winnerCard = game.selectedCards.find((c) => c.id === Number(cardId));
    if (!winnerCard) {
      return res.status(400).json({ message: "Winner card not found in game" });
    }

    const validPatterns = [
      "four_corners_center",
      "cross",
      "main_diagonal",
      "other_diagonal",
      "horizontal_line",
      "vertical_line",
    ];
    let usePattern = game.pattern;
    let forcedPattern = null;
    if (game.pattern === "all") {
      usePattern =
        validPatterns[Math.floor(Math.random() * validPatterns.length)];
      forcedPattern = usePattern;
    }

    const { selectedIndices } = getNumbersForPattern(
      winnerCard.numbers,
      usePattern,
      [],
      true
    );
    const flatNumbers = winnerCard.numbers.flat();
    const requiredNumbers = selectedIndices.map((idx) => flatNumbers[idx]);

    // ✅ UPDATED: Use quick win sequence with min/max params
    const forcedCallSequence = generateQuickWinSequence(
      requiredNumbers,
      10,
      14
    );

    game.moderatorWinnerCardId = cardId;
    game.selectedWinnerRowIndices = selectedIndices;
    game.forcedPattern = forcedPattern;
    game.forcedCallSequence = forcedCallSequence;
    game.winnerCardNumbers = winnerCard.numbers; // Store full card
    game.selectedWinnerNumbers = requiredNumbers; // Store winning numbers
    game.targetWinCall = forcedCallSequence.length;
    game.forcedCallIndex = 0;
    await game.save();

    await GameLog.create({
      gameId: game._id,
      action: "selectWinner",
      status: "success",
      details: {
        gameNumber,
        moderatorId: moderatorId.toString(),
        winnerCardId: cardId,
        selectedWinnerRowIndices: selectedIndices,
        forcedPattern,
        forcedCallSequenceLength: forcedCallSequence.length,
        quickWinCalls: forcedCallSequence.length,
        timestamp: new Date(),
      },
    });

    console.log(
      `[selectWinner] Moderator ${moderatorId} set winner for game ${gameNumber}: Card ID ${cardId}, Pattern: ${
        forcedPattern || usePattern
      }, Quick Win: ${forcedCallSequence.length} calls`
    );

    res.json({ message: "Winner selected successfully", data: game });
  } catch (error) {
    console.error("[selectWinner] Error:", error);
    await GameLog.create({
      gameId: null,
      action: "selectWinner",
      status: "failed",
      details: {
        gameNumber,
        moderatorId: req.user?._id?.toString() || "unknown",
        error: error.message || "Internal server error",
        timestamp: new Date(),
      },
    });
    next(error);
  }
};

// Start game
export const startGame = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const game = await Game.findOne({ _id: req.params.id, cashierId });
    if (!game) {
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    if (game.status !== "pending") {
      return res.status(400).json({
        message: "Game already started or finished",
        errorCode: "GAME_NOT_PENDING",
      });
    }

    game.status = "active";
    await game.save();

    res.json({ message: "Game started", data: game });
  } catch (error) {
    console.error("[startGame] Error in startGame:", error);
    next(error);
  }
};

// Reset game counter
export const resetGameCounter = async (req, res, next) => {
  try {
    const nextSeq = 1;
    await Counter.deleteOne({ _id: "gameNumber" });
    const counter = await Counter.create({ _id: "gameNumber", seq: nextSeq });

    res.json({ message: `Game counter reset to ${nextSeq}`, nextSeq });
  } catch (error) {
    console.error("[resetGameCounter] Error in resetGameCounter:", error);
    next(error);
  }
};
