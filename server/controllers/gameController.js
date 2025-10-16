// controllers/gameController.js (Fixed: Removed -numbers; Added populate for Step 3 refs)
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import {
  getNextGameNumber,
  getNextSequence,
  getCashierIdFromUser,
  getNumbersForPattern,
  generateQuickWinSequence,
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import GameLog from "../models/GameLog.js";
import Counter from "../models/Counter.js";
import Card from "../models/Card.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";
import FutureWinner from "../models/FutureWinner.js";

export const createGame = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.id) {
      return res
        .status(401)
        .json({ message: "Unauthorized. User ID missing." });
    }

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
      selectedCards = [], // Expect {id, cardRef} format
      moderatorWinnerCardId = null,
    } = req.body;

    // ... rest of createGame logic (use createGameRecord with refs)
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

    // FIXED: Removed -selectedCards.numbers (non-existent); Added populate for refs if needed
    const game = await Game.findOne({ _id: id, cashierId })
      .populate("selectedCards.cardRef", "numbers") // ✅ Step 3: Load numbers on-demand
      .lean();
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

// Get all games for cashier (with pagination)
export const getGames = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid game ID format",
        });
      }

      // FIXED: Removed -numbers; No populate for lists (light)
      const game = await Game.findOne({ _id: id, cashierId }).lean();
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

    // FIXED: Removed -numbers; No populate for lists
    const games = await Game.find({ cashierId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Game.countDocuments({ cashierId });

    res.json({
      message: "Games retrieved successfully",
      count: games.length,
      total,
      pages: Math.ceil(total / limit),
      page,
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

    // FIXED: No select needed for update (returns full doc)
    const game = await Game.findOneAndUpdate(
      { _id: req.params.id, cashierId },
      updateData,
      { new: true, runValidators: true }
    ).lean();

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

    // FIXED: Populate for numbers access
    const game = await Game.findOne({ gameNumber, cashierId })
      .populate("selectedCards.cardRef", "numbers") // ✅ Load refs
      .lean();
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
      winnerCard.cardRef.numbers, // ✅ Use populated
      usePattern,
      [],
      true
    );
    const flatNumbers = winnerCard.cardRef.numbers.flat();
    const requiredNumbers = selectedIndices.map((idx) => flatNumbers[idx]);

    const forcedCallSequence = generateQuickWinSequence(
      requiredNumbers,
      10,
      14
    );

    const updatedGame = await Game.findOneAndUpdate(
      { gameNumber, cashierId },
      {
        moderatorWinnerCardId: cardId,
        selectedWinnerRowIndices: selectedIndices,
        forcedPattern,
        forcedCallSequence,
        winnerCardNumbers: winnerCard.cardRef.numbers,
        selectedWinnerNumbers: requiredNumbers,
        targetWinCall: forcedCallSequence.length,
        forcedCallIndex: 0,
      },
      { new: true, runValidators: true }
    ).lean();

    await GameLog.create({
      gameId: updatedGame._id,
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

    res.json({ message: "Winner selected successfully", data: updatedGame });
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

    const game = await Game.findOneAndUpdate(
      { _id: req.params.id, cashierId, status: "pending" },
      { status: "active" },
      { new: true, runValidators: true }
    ).lean();

    if (!game) {
      return res.status(400).json({
        message: "Game not found, not authorized, or already started/finished",
        errorCode: "GAME_NOT_PENDING",
      });
    }

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
