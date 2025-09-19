import { validationResult } from "express-validator";
import mongoose from "mongoose";
import {
  getNextSequence,
  getCashierIdFromUser,
  getNumbersForPattern,
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import GameLog from "../models/GameLog.js";
import Counter from "../models/Counter.js";
import Card from "../models/Card.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";

// Create a new game
// Create a new game
export const createGame = async (req, res, next) => {
  try {
    const {
      pattern = "horizontal_line",
      betAmount = 10,
      houseFeePercentage = 15,
      jackpotEnabled = true,
      selectedCards = [],
      moderatorWinnerCardId = null,
    } = req.body;

    const validPatterns = [
      "four_corners_center",
      "cross",
      "main_diagonal",
      "other_diagonal",
      "horizontal_line",
      "vertical_line",
      "all",
    ];

    if (!validPatterns.includes(pattern)) {
      return res.status(400).json({ message: "Invalid game pattern" });
    }

    if (!selectedCards.length) {
      return res.status(400).json({ message: "No cards selected" });
    }

    // Extract card IDs
    const cardIds = selectedCards
      .map((c) =>
        typeof c === "object" && "id" in c ? Number(c.id) : Number(c)
      )
      .filter((id) => !isNaN(id));

    const cards = await Card.find({ card_number: { $in: cardIds } });
    if (!cards.length) {
      return res.status(400).json({ message: "No valid cards found" });
    }

    const gameCards = cards.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    // Get cashier ID
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const totalPot = betAmount * gameCards.length;
    const houseFee = (totalPot * houseFeePercentage) / 100;
    const potentialJackpot = jackpotEnabled ? totalPot * 0.1 : 0;
    const prizePool = totalPot - houseFee - potentialJackpot;

    let forcedPattern = null;
    let selectedWinnerRowIndices = [];
    let forcedCallSequence = [];

    if (moderatorWinnerCardId) {
      const winnerCard = gameCards.find(
        (card) => card.id === Number(moderatorWinnerCardId)
      );
      if (!winnerCard) {
        return res
          .status(400)
          .json({ message: "Winner card not found in selected cards" });
      }

      let usePattern = pattern;
      if (pattern === "all") {
        const patternChoices = validPatterns.filter((p) => p !== "all");
        usePattern =
          patternChoices[Math.floor(Math.random() * patternChoices.length)];
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
      forcedCallSequence = computeForcedSequence(requiredNumbers);
      selectedWinnerRowIndices = selectedIndices;
    }

    // ✅ Auto-generate gameNumber
    const lastGame = await Game.findOne().sort({ createdAt: -1 });
    const nextGameNumber = lastGame ? lastGame.gameNumber + 1 : 1;

    const game = await Game.create({
      gameNumber: nextGameNumber,
      cashierId,
      betAmount,
      houseFeePercentage,
      houseFee,
      selectedCards: gameCards,
      pattern,
      prizePool,
      potentialJackpot,
      jackpotEnabled,
      moderatorWinnerCardId,
      selectedWinnerRowIndices,
      forcedPattern,
      forcedCallSequence,
    });

    await GameLog.create({
      gameId: game._id,
      action: "createGame",
      status: "success",
      details: {
        gameNumber: nextGameNumber,
        cashierId,
        pattern,
        selectedCards: gameCards.map((c) => c.id),
      },
    });

    res.status(201).json({ message: "Game created successfully", data: game });
  } catch (error) {
    console.error("[createGame] Error:", error);
    await GameLog.create({
      gameId: null,
      action: "createGame",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};

// Get game by ID
export const getGameById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const game = await Game.findOne({ _id: id, cashierId }).lean();
    if (!game) {
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    res.json({
      message: "Game retrieved successfully",
      game,
    });
  } catch (error) {
    console.error("[getGameById] Error:", error);
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
    const moderatorId = req.user._id; // Get moderator ID from authenticated user

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
    const forcedCallSequence = computeForcedSequence(requiredNumbers);

    game.moderatorWinnerCardId = cardId;
    game.selectedWinnerRowIndices = selectedIndices;
    game.forcedPattern = forcedPattern;
    game.forcedCallSequence = forcedCallSequence;
    await game.save();

    // Enhanced logging for winner selection
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
        forcedCallSequence,
        timestamp: new Date(),
      },
    });

    console.log(
      `[selectWinner] Moderator ${moderatorId} set winner for game ${gameNumber}: Card ID ${cardId}, Pattern: ${
        forcedPattern || usePattern
      }, Forced Call Sequence: ${JSON.stringify(forcedCallSequence)}`
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
