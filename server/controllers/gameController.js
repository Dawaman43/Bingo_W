import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import Result from "../models/Result.js";
import Card from "../models/Card.js";
import Counter from "../models/Counter.js";
import JackpotLog from "../models/JackpotLog.js";
import GameLog from "../models/GameLog.js";

// --- Helper Functions ---

/**
 * Counts completed lines and progress for a bingo card.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @returns {{ lines: boolean[], lineProgress: number[], lineIndices: number[] }} Object with lines completion status, progress, and indices
 */
const countCompletedLines = (cardNumbers, calledNumbers) => {
  const grid = cardNumbers.map((row) => row.map((num) => num.toString()));
  const isMarked = (num) =>
    num === "FREE" || calledNumbers.includes(Number(num));
  const lines = [];
  const lineProgress = [];
  const lineIndices = [];

  // Rows (indices 0-4)
  for (let i = 0; i < 5; i++) {
    lines.push(grid[i].every(isMarked));
    lineProgress.push(
      grid[i].reduce((sum, num) => sum + (isMarked(num) ? 1 : 0), 0)
    );
    lineIndices.push(i);
  }

  // Columns (indices 5-9)
  for (let j = 0; j < 5; j++) {
    lines.push([0, 1, 2, 3, 4].every((i) => isMarked(grid[i][j])));
    lineProgress.push(
      [0, 1, 2, 3, 4].reduce(
        (sum, i) => sum + (isMarked(grid[i][j]) ? 1 : 0),
        0
      )
    );
    lineIndices.push(j + 5);
  }

  // Diagonals (indices 10, 11)
  const diag1 = [0, 1, 2, 3, 4].every((i) => isMarked(grid[i][i]));
  const diag2 = [0, 1, 2, 3, 4].every((i) => isMarked(grid[i][4 - i]));
  lines.push(diag1, diag2);
  lineProgress.push(
    [0, 1, 2, 3, 4].reduce((sum, i) => sum + (isMarked(grid[i][i]) ? 1 : 0), 0)
  );
  lineProgress.push(
    [0, 1, 2, 3, 4].reduce(
      (sum, i) => sum + (isMarked(grid[i][4 - i]) ? 1 : 0),
      0
    )
  );
  lineIndices.push(10, 11);

  return { lines, lineProgress, lineIndices };
};

/**
 * Extracts numbers from a card based on the specified pattern, prioritizing specific lines when requested.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {string} pattern - Pattern type: 'line', 'diagonal', or 'x_pattern'
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @param {boolean} selectSpecificLine - Whether to select numbers from specific lines
 * @param {number[]} [targetIndices] - Specific line indices to target (e.g., [1] for row 1, [10, 11] for x_pattern)
 * @returns {{ numbers: string[], selectedIndices: number[] }} Array of numbers for the pattern and selected line indices
 */
const getNumbersForPattern = (
  cardNumbers,
  pattern,
  calledNumbers,
  selectSpecificLine = false,
  targetIndices = []
) => {
  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) {
    console.warn(
      "[getNumbersForPattern] cardNumbers invalid or empty",
      cardNumbers
    );
    return { numbers: [], selectedIndices: [] };
  }

  // Ensure every row is an array
  const grid = cardNumbers.map((row) =>
    Array.isArray(row) ? row.map((num) => num.toString()) : []
  );

  const numbers = [];
  let selectedIndices = [];

  const { lineProgress, lineIndices } = countCompletedLines(
    cardNumbers,
    calledNumbers || []
  );

  if (pattern === "line") {
    const rows = grid; // Rows (indices 0-4)
    if (selectSpecificLine && targetIndices.length > 0) {
      const rowIndex = targetIndices[0];
      if (rows[rowIndex]) {
        numbers.push(
          ...rows[rowIndex].filter(
            (n) => n !== "FREE" && !calledNumbers.includes(Number(n))
          )
        );
        selectedIndices = [rowIndex];
      }
    } else {
      const rowIndices = [0, 1, 2, 3, 4].filter((i) => rows[i]);
      const rowProgress = lineProgress.slice(0, rowIndices.length);
      const maxUnmarked = Math.max(...rowProgress.map((p) => 5 - p));
      const eligibleRowIndices = rowIndices.filter(
        (i) => 5 - rowProgress[i] === maxUnmarked
      );
      const bestRowIndex =
        eligibleRowIndices[
          Math.floor(Math.random() * eligibleRowIndices.length)
        ] || rowIndices[0];
      if (rows[bestRowIndex]) {
        numbers.push(
          ...rows[bestRowIndex].filter(
            (n) => n !== "FREE" && !calledNumbers.includes(Number(n))
          )
        );
        selectedIndices = [bestRowIndex];
      }
    }
  } else if (pattern === "diagonal" || pattern === "x_pattern") {
    const diagonals = [
      [0, 1, 2, 3, 4].map((i) => grid[i]?.[i]).filter((n) => n !== undefined),
      [0, 1, 2, 3, 4]
        .map((i) => grid[i]?.[4 - i])
        .filter((n) => n !== undefined),
    ];

    if (selectSpecificLine && targetIndices.length > 0) {
      for (const diagIndex of targetIndices) {
        const lineIndex = diagIndex - 10;
        if (diagonals[lineIndex]) {
          numbers.push(
            ...diagonals[lineIndex].filter(
              (n) => n !== "FREE" && !calledNumbers.includes(Number(n))
            )
          );
        }
      }
      selectedIndices = targetIndices;
    } else {
      numbers.push(
        ...diagonals
          .flat()
          .filter((n) => n !== "FREE" && !calledNumbers.includes(Number(n)))
      );
      selectedIndices = pattern === "x_pattern" ? [10, 11] : [10];
    }
  }

  return { numbers, selectedIndices };
};

/**
 * Gets the next game number atomically, ensuring no gaps by checking existing games.
 * @param {number} [startFromGameNumber] - Optional starting game number
 * @returns {Promise<number>} The next game number
 * @throws {Error} If counter state is invalid
 */
export const getNextGameNumber = async (startFromGameNumber = null) => {
  console.log("[getNextGameNumber] Starting game number assignment");
  console.log(
    "[getNextGameNumber] Requested startFromGameNumber:",
    startFromGameNumber
  );

  const allGames = await Game.find().sort({ gameNumber: 1 }).lean();
  const existingNumbers = new Set(allGames.map((g) => g.gameNumber));
  console.log(
    "[getNextGameNumber] Existing game numbers:",
    Array.from(existingNumbers)
  );

  if (startFromGameNumber && !existingNumbers.has(startFromGameNumber)) {
    console.log(
      "[getNextGameNumber] Using provided startFromGameNumber:",
      startFromGameNumber
    );
    await Counter.findOneAndUpdate(
      { _id: "gameNumber" },
      { $max: { seq: startFromGameNumber } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("[getNextGameNumber] Counter updated to:", startFromGameNumber);
    return startFromGameNumber;
  } else if (startFromGameNumber) {
    console.log(
      "[getNextGameNumber] startFromGameNumber already exists:",
      startFromGameNumber
    );
  }

  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }
  console.log("[getNextGameNumber] Lowest missing number found:", nextNumber);

  await Counter.findOneAndUpdate(
    { _id: "gameNumber" },
    { seq: nextNumber },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log("[getNextGameNumber] Counter updated to:", nextNumber);

  return nextNumber;
};

/**
 * Logs a jackpot update.
 * @param {number} amount - New jackpot amount
 * @param {string} reason - Reason for the update
 * @param {string} [gameId] - Associated game ID
 * @returns {Promise<void>}
 */
const logJackpotUpdate = async (amount, reason, gameId = null) => {
  await JackpotLog.create({
    amount,
    reason,
    gameId,
    timestamp: new Date(),
  });
};

/**
 * Gets the current game number without incrementing.
 * @returns {Promise<number>} The current game number
 */
export const getCurrentGameNumber = async () => {
  const counter = await Counter.findById("gameNumber").lean();
  if (!counter) {
    console.log("[getCurrentGameNumber] No counter found, returning 1");
    return 1;
  }
  console.log("[getCurrentGameNumber] Current game number:", counter.seq);
  return counter.seq;
};

const getRandomNumber = (calledNumbers) => {
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !calledNumbers.includes(n)
  );
  if (availableNumbers.length === 0) return null;
  return availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
};

/**
 * Creates a new bingo game.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const createGame = async (req, res, next) => {
  try {
    console.log("[createGame] Creating new game with request body:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[createGame] Validation errors:", errors.array());
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const {
      selectedCards = [],
      pattern = "line",
      betAmount = 10,
      houseFeePercentage = 15,
      moderatorWinnerCardId = null,
      jackpotEnabled = true, // Default to true
    } = req.body;

    if (!["line", "diagonal", "x_pattern"].includes(pattern)) {
      return res.status(400).json({ message: "Invalid game pattern" });
    }

    if (!selectedCards.length) {
      return res.status(400).json({ message: "No cards selected" });
    }

    const cardIds = selectedCards
      .map((c) =>
        typeof c === "object" && c !== null && "id" in c
          ? Number(c.id)
          : Number(c)
      )
      .filter((id) => !isNaN(id));

    const cards = await Card.find({ card_number: { $in: cardIds } }).lean();
    if (!cards.length) {
      return res
        .status(400)
        .json({ message: "No valid cards found for the provided IDs" });
    }

    const foundCardIds = cards.map((c) => c.card_number);
    const missingCardIds = cardIds.filter((id) => !foundCardIds.includes(id));
    if (missingCardIds.length) {
      return res
        .status(400)
        .json({ message: `Cards not found: ${missingCardIds.join(", ")}` });
    }

    const gameCards = cards.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    // --- Calculate totals ---
    const totalPot = Number(betAmount) * gameCards.length;
    const houseFee = (totalPot * Number(houseFeePercentage)) / 100;
    const potentialJackpot = jackpotEnabled ? totalPot * 0.1 : 0;
    const prizePool = totalPot - houseFee - potentialJackpot;

    // --- Assign game number first ---
    const assignedGameNumber = await getNextGameNumber();

    // --- Assign winnerCardId and jackpotEnabled ---
    let winnerCardId = moderatorWinnerCardId
      ? Number(moderatorWinnerCardId)
      : null;
    let finalJackpotEnabled = jackpotEnabled;
    if (!winnerCardId) {
      const futureWinning = await Counter.findOne({
        _id: `futureWinning_${assignedGameNumber}`,
      }).lean();
      if (futureWinning && futureWinning.cardId !== undefined) {
        const parsedWinnerCardId = Number(futureWinning.cardId);
        if (foundCardIds.includes(parsedWinnerCardId)) {
          winnerCardId = parsedWinnerCardId;
          finalJackpotEnabled =
            futureWinning.jackpotEnabled !== undefined
              ? futureWinning.jackpotEnabled
              : jackpotEnabled; // Use stored jackpotEnabled if available
          console.log(
            `[createGame] Assigned predefined winner for game #${assignedGameNumber}: card ${winnerCardId}, jackpotEnabled: ${finalJackpotEnabled}`
          );
        }
      }
    }

    // --- Determine selectedWinnerRowIndices for winner card ---
    let selectedWinnerRowIndices = [];
    if (winnerCardId) {
      const winnerCard = gameCards.find((card) => card.id === winnerCardId);
      if (winnerCard) {
        const { selectedIndices } = getNumbersForPattern(
          winnerCard.numbers,
          pattern,
          [],
          true
        );
        selectedWinnerRowIndices = selectedIndices;
      }
    }

    // --- Create game ---
    const game = new Game({
      gameNumber: assignedGameNumber,
      betAmount,
      houseFeePercentage,
      selectedCards: gameCards,
      pattern,
      prizePool,
      potentialJackpot: finalJackpotEnabled ? totalPot * 0.1 : 0, // Adjust based on finalJackpotEnabled
      status: "pending",
      calledNumbers: [],
      calledNumbersLog: [],
      moderatorWinnerCardId: winnerCardId,
      selectedWinnerRowIndices,
      jackpotEnabled: finalJackpotEnabled,
      winner: null,
    });

    await game.save();
    console.log(
      `[createGame] Game created: ID=${game._id}, Number=${game.gameNumber}, WinnerCardId=${winnerCardId}, JackpotEnabled=${game.jackpotEnabled}`
    );

    // --- Cleanup future winner entry if assigned ---
    if (winnerCardId && !moderatorWinnerCardId) {
      await Counter.deleteOne({ _id: `futureWinning_${assignedGameNumber}` });
      console.log(
        `[createGame] Cleaned up future winner entry for game #${assignedGameNumber}`
      );
    }

    res.status(201).json({
      message: "Game created successfully",
      data: {
        id: game._id.toString(),
        gameNumber: game.gameNumber,
        moderatorWinnerCardId: game.moderatorWinnerCardId,
        pattern: game.pattern,
        jackpotEnabled: game.jackpotEnabled,
      },
    });
  } catch (error) {
    console.error("[createGame] Error creating game:", error);
    await GameLog.create({
      gameId: null,
      action: "createGame",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};

/**
 * Calls a single number for a bingo game.
 * Forced numbers are called first based on the winner card and selected pattern.
 * Once exhausted, random numbers are called.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const callNumber = async (req, res, next) => {
  try {
    const gameId = req.params.id;
    const now = () => new Date().toISOString(); // timestamp helper

    if (!mongoose.isValidObjectId(gameId)) {
      console.log(`[${now()}] [callNumber] Invalid game ID: ${gameId}`);
      return res.status(400).json({ message: "Invalid game ID format" });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      console.log(`[${now()}] [callNumber] Game not found: ${gameId}`);
      return res.status(404).json({ message: "Game not found" });
    }
    if (game.status !== "active") {
      console.log(`[${now()}] [callNumber] Game not active: ${game.status}`);
      return res.status(400).json({ message: "Game is not active" });
    }

    let calledNumber = null;
    let isForcedCall = false;

    // --- Forced winner numbers ---
    if (game.moderatorWinnerCardId) {
      const winnerCard = game.selectedCards.find(
        (c) => c.id === game.moderatorWinnerCardId
      );
      if (winnerCard && Array.isArray(winnerCard.numbers)) {
        if (
          !Array.isArray(game.forcedNumbersQueue) ||
          game.forcedNumbersQueue.length === 0
        ) {
          const { numbers, selectedIndices } = getNumbersForPattern(
            winnerCard.numbers,
            game.pattern,
            game.calledNumbers,
            true,
            game.selectedWinnerRowIndices.length
              ? game.selectedWinnerRowIndices
              : undefined
          );
          game.forcedNumbersQueue = numbers;
          if (!game.selectedWinnerRowIndices.length) {
            game.selectedWinnerRowIndices = selectedIndices;
          }
          console.log(
            `[${now()}] [callNumber] Forced numbers initialized: ${numbers}`
          );
        }

        if (game.forcedNumbersQueue.length > 0) {
          calledNumber = Number(game.forcedNumbersQueue.shift());
          isForcedCall = true;
          console.log(
            `[${now()}] [callNumber] Forced number called: ${calledNumber} (pattern: ${
              game.pattern
            }, indices: ${game.selectedWinnerRowIndices}, cardId: ${
              winnerCard.id
            })`
          );
        }
      }
    }

    // --- Random number fallback ---
    if (calledNumber === null) {
      const randomNumber = getRandomNumber(game.calledNumbers);
      if (randomNumber === null) {
        console.log(`[${now()}] [callNumber] No uncalled numbers left.`);
        return res
          .status(400)
          .json({ message: "No uncalled numbers available" });
      }
      calledNumber = randomNumber;
      console.log(
        `[${now()}] [callNumber] Random number called: ${calledNumber}`
      );
    }

    // --- Update game state ---
    game.calledNumbers.push(calledNumber);
    game.calledNumbersLog.push({ number: calledNumber, calledAt: new Date() });

    // --- Check winner ---
    if (!game.winner) {
      const winnerCard = game.selectedCards.find(
        (card) =>
          checkCardBingo(card.numbers, game.calledNumbers, game.pattern).isBingo
      );
      if (winnerCard) {
        game.winner = { cardId: winnerCard.id, prize: game.prizePool };
        game.status = "completed";
        console.log(
          `[${now()}] [callNumber] Winner found! CardId=${
            winnerCard.id
          }, Prize=${game.prizePool}`
        );
      }
    }

    await game.save(); // Only one save per call

    res.json({
      message: `Number ${calledNumber} called`,
      data: { game, calledNumber, isForcedCall },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [callNumber] Error:`, error);
    next(error);
  }
};

/**
 * Finishes the game by setting its status to completed.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const finishGame = async (req, res, next) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.isValidObjectId(gameId)) {
      console.log("[finishGame] Invalid game ID format:", gameId);
      await GameLog.create({
        gameId,
        action: "finishGame",
        status: "failed",
        details: { error: "Invalid game ID format" },
      });
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      console.log("[finishGame] Game not found:", gameId);
      await GameLog.create({
        gameId,
        action: "finishGame",
        status: "failed",
        details: { error: "Game not found" },
      });
      return res.status(404).json({
        message: "Game not found",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    if (game.status !== "active") {
      console.log("[finishGame] Game not active:", game.status);
      await GameLog.create({
        gameId,
        action: "finishGame",
        status: "failed",
        details: { error: "Game not active", status: game.status },
      });
      return res.status(400).json({
        message: "Game is not active",
        errorCode: "GAME_NOT_ACTIVE",
      });
    }

    game.status = "completed";
    if (game.jackpotEnabled && game.winner) {
      await Jackpot.findOneAndUpdate(
        {},
        { $inc: { amount: game.potentialJackpot } },
        { upsert: true }
      );
      await logJackpotUpdate(
        game.potentialJackpot,
        "Game contribution",
        gameId
      );
    }

    await game.save();
    console.log(`[finishGame] Game completed: Number=${game.gameNumber}`);
    await GameLog.create({
      gameId,
      action: "gameCompleted",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        winnerCardId: game.winner?.cardId,
        prize: game.winner?.prize,
      },
    });

    res.json({
      message: "Game completed",
      data: { game },
    });
  } catch (error) {
    console.error("[finishGame] Error in finishGame:", error);
    await GameLog.create({
      gameId: req.params.id,
      action: "finishGame",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};

/**
 * Resets the game counter to 1.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const resetGameCounter = async (req, res, next) => {
  try {
    const nextSeq = 1;
    console.log("[resetGameCounter] Resetting game counter to:", nextSeq);
    await Counter.deleteOne({ _id: "gameNumber" });
    const counter = await Counter.create({ _id: "gameNumber", seq: nextSeq });
    console.log("[resetGameCounter] Game counter reset to:", nextSeq);
    res.json({ message: `Game counter reset to ${nextSeq}`, nextSeq });
  } catch (error) {
    console.error("[resetGameCounter] Error in resetGameCounter:", error);
    next(error);
  }
};

/**
 * Retrieves a game by ID.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getGame = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      console.log("[getGame] Invalid game ID format:", req.params.id);
      return res.status(400).json({ message: "Invalid game ID format" });
    }
    const game = await Game.findById(req.params.id);
    if (!game) {
      console.log("[getGame] Game not found for ID:", req.params.id);
      return res.status(404).json({ message: "Game not found" });
    }
    console.log(
      "[getGame] Game retrieved: ID=",
      game._id,
      "Number=",
      game.gameNumber
    );
    res.json({ message: "Game retrieved successfully", data: game });
  } catch (error) {
    console.error("[getGame] Error in getGame:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Retrieves all games.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
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

/**
 * Retrieves the next pending game in sequence.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getNextPendingGame = async (req, res, next) => {
  try {
    const game = await Game.findOne({ status: "pending" })
      .sort({ gameNumber: 1 })
      .lean();
    if (!game) {
      console.log("[getNextPendingGame] No pending games found");
      return res.status(404).json({ message: "No pending games found" });
    }
    console.log("[getNextPendingGame] Next pending game:", game.gameNumber);
    res.json({ message: "Next pending game retrieved", data: game });
  } catch (error) {
    console.error("[getNextPendingGame] Error in getNextPendingGame:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Retrieves all bingo cards.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getAllCards = async (req, res, next) => {
  try {
    const cards = await Card.find().lean();
    console.log("[getAllCards] Retrieved cards count:", cards.length);
    res.json({
      message: "All cards retrieved successfully",
      data: cards.map((card) => ({
        cardId: card.card_number,
        numbers: card.numbers,
      })),
    });
  } catch (error) {
    console.error("[getAllCards] Error in getAllCards:", error);
    next(error);
  }
};

/**
 * Creates sequential games with optional future winners.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const createSequentialGames = async (req, res, next) => {
  try {
    const {
      count,
      pattern = "line",
      betAmount = 10,
      houseFeePercentage = 15,
      jackpotEnabled = true,
      selectedCards = [],
      moderatorWinnerCardIds = [],
    } = req.body;

    if (!["line", "diagonal", "x_pattern"].includes(pattern)) {
      console.log("[createSequentialGames] Invalid pattern:", pattern);
      return res.status(400).json({ message: "Invalid game pattern" });
    }

    if (!count || count <= 0) {
      console.log("[createSequentialGames] Invalid count:", count);
      return res.status(400).json({ message: "Count must be > 0" });
    }

    if (!selectedCards.length) {
      console.log("[createSequentialGames] No cards selected");
      return res.status(400).json({ message: "No cards selected" });
    }

    const cardIds = selectedCards
      .map((c) =>
        typeof c === "object" && "id" in c ? Number(c.id) : Number(c)
      )
      .filter((id) => !isNaN(id));

    const cards = await Card.find({ card_number: { $in: cardIds } });
    if (!cards.length) {
      console.log(
        "[createSequentialGames] No valid cards found for IDs:",
        cardIds
      );
      return res.status(400).json({ message: "No valid cards found" });
    }

    const gameCards = cards.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    const createdGames = [];
    let currentGameNumber = await getCurrentGameNumber();
    if (!currentGameNumber) currentGameNumber = 1;
    console.log(
      "[createSequentialGames] Starting game creation with current game number:",
      currentGameNumber
    );

    for (let i = 0; i < count; i++) {
      const gameNumber = await getNextGameNumber(currentGameNumber + i);
      console.log(`[createSequentialGames] Creating game #${gameNumber}`);

      const totalPot = betAmount * gameCards.length;
      const houseFee = (totalPot * houseFeePercentage) / 100;
      const potentialJackpot = jackpotEnabled ? totalPot * 0.1 : 0;
      const prizePool = totalPot - houseFee - potentialJackpot;

      let moderatorWinnerCardId = moderatorWinnerCardIds[i]
        ? Number(moderatorWinnerCardIds[i])
        : null;
      let finalJackpotEnabled = jackpotEnabled;
      if (!moderatorWinnerCardId) {
        const futureWinning = await Counter.findOne({
          _id: `futureWinning_${gameNumber}`,
        });
        if (futureWinning && futureWinning.cardId !== undefined) {
          moderatorWinnerCardId = Number(futureWinning.cardId);
          finalJackpotEnabled =
            futureWinning.jackpotEnabled !== undefined
              ? futureWinning.jackpotEnabled
              : jackpotEnabled; // Use stored jackpotEnabled
          console.log(
            `[createSequentialGames] Checked for predefined winner for game #${gameNumber}: card=${moderatorWinnerCardId}, jackpotEnabled=${finalJackpotEnabled}`
          );
        }
      }

      if (
        moderatorWinnerCardId &&
        !gameCards.some((card) => card.id === Number(moderatorWinnerCardId))
      ) {
        console.log(
          `[createSequentialGames] Invalid winnerCardId for game #${gameNumber}: ${moderatorWinnerCardId}`
        );
        continue;
      }

      // Determine selectedWinnerRowIndices for the game
      let selectedWinnerRowIndices = [];
      if (moderatorWinnerCardId) {
        const winnerCard = gameCards.find(
          (card) => card.id === moderatorWinnerCardId
        );
        if (winnerCard) {
          const { selectedIndices } = getNumbersForPattern(
            winnerCard.numbers,
            pattern,
            [],
            true
          );
          selectedWinnerRowIndices = selectedIndices;
          console.log(
            `[createSequentialGames] Selected indices for winner card ${moderatorWinnerCardId} in game #${gameNumber}:`,
            selectedWinnerRowIndices
          );
        }
      }

      const game = new Game({
        gameNumber,
        pattern,
        betAmount,
        houseFeePercentage,
        selectedCards: gameCards,
        prizePool,
        potentialJackpot: finalJackpotEnabled ? totalPot * 0.1 : 0, // Adjust based on finalJackpotEnabled
        jackpotEnabled: finalJackpotEnabled,
        status: "pending",
        calledNumbers: [],
        calledNumbersLog: [],
        moderatorWinnerCardId,
        selectedWinnerRowIndices,
        winner: null,
      });

      await game.save();
      console.log(
        `[createSequentialGames] Saved game #${gameNumber} with ID: ${game._id}, JackpotEnabled: ${game.jackpotEnabled}`
      );

      if (moderatorWinnerCardId && !moderatorWinnerCardIds[i]) {
        await Counter.deleteOne({ _id: `futureWinning_${gameNumber}` });
        console.log(
          `[createSequentialGames] Cleaned up future winner entry for game #${gameNumber}`
        );
      }

      createdGames.push(game);
    }

    console.log(
      "[createSequentialGames] Sequential games created:",
      createdGames.length
    );
    res.json({ message: "Sequential games created", data: createdGames });
  } catch (error) {
    console.error(
      "[createSequentialGames] Error in createSequentialGames:",
      error
    );
    next(error);
  }
};
/**
 * Checks if a card has bingo based on the pattern.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @param {string} pattern - Pattern type: 'line', 'diagonal', or 'x_pattern'
 * @returns {{ isBingo: boolean, completedLines: number, lineProgress: number[] }}
 */
export const checkCardBingo = (cardNumbers, calledNumbers, pattern) => {
  const { lines, lineProgress } = countCompletedLines(
    cardNumbers,
    calledNumbers
  );
  let isBingo = false;

  if (pattern === "line") {
    isBingo = lines.slice(0, 5).some(Boolean); // Check rows
  } else if (pattern === "diagonal") {
    isBingo = lines.slice(10, 12).some(Boolean); // Check diagonals
  } else if (pattern === "x_pattern") {
    isBingo = lines[10] && lines[11]; // Both diagonals must be complete
  }

  return {
    isBingo,
    completedLines: lines.filter(Boolean).length,
    lineProgress,
  };
};

/**
 * Checks bingo status for a specific card in a game, declaring the winner correctly.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const checkBingo = async (req, res, next) => {
  try {
    const { cardId } = req.body;
    const gameId = req.params.id;

    if (!mongoose.isValidObjectId(gameId)) {
      console.log("[checkBingo] Invalid game ID format:", gameId);
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const numericCardId = Number(cardId);
    if (isNaN(numericCardId) || numericCardId < 1) {
      console.log("[checkBingo] Invalid card ID:", cardId);
      return res.status(400).json({
        message: "Invalid card ID",
        errorCode: "INVALID_CARD_ID",
      });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      console.log("[checkBingo] Game not found:", gameId);
      return res.status(404).json({
        message: "Game not found",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    const card = game.selectedCards.find((c) => c.id === numericCardId);
    if (!card) {
      console.log("[checkBingo] Card not found in game:", numericCardId);
      return res.status(400).json({
        message: `Card ${numericCardId} not found in game`,
        errorCode: "INVALID_CARD_ID",
      });
    }

    // For completed games, only allow the designated winner
    if (game.status === "completed") {
      if (
        (game.winner?.cardId && game.winner.cardId === numericCardId) ||
        (game.moderatorWinnerCardId &&
          game.moderatorWinnerCardId === numericCardId)
      ) {
        console.log(
          `[checkBingo] Winner confirmed for completed game #${game.gameNumber}: Card ${numericCardId}`
        );
        return res.json({
          message: `Bingo! Card ${numericCardId} wins!`,
          data: {
            winner: true,
            game,
            winnerCardId: numericCardId,
            isYourCardWinner: true,
          },
        });
      } else {
        console.log(
          `[checkBingo] Card ${numericCardId} is not the winner for completed game #${game.gameNumber}`
        );
        return res.json({
          message: `Card ${numericCardId} is not the winner`,
          data: {
            winner: false,
            game,
            winnerCardId:
              game.winner?.cardId || game.moderatorWinnerCardId || null,
            isYourCardWinner: false,
          },
        });
      }
    }

    // For active games, check bingo and enforce moderatorWinnerCardId if set
    if (game.status !== "active") {
      console.log("[checkBingo] Game not active:", game.status);
      return res.status(400).json({
        message: `Game is ${game.status}, cannot check bingo`,
        errorCode: "GAME_NOT_ACTIVE",
      });
    }

    const { isBingo } = checkCardBingo(
      card.numbers,
      game.calledNumbers,
      game.pattern
    );
    let winner = null;

    if (isBingo) {
      // If moderatorWinnerCardId is set, only that card can win
      if (game.moderatorWinnerCardId) {
        if (game.moderatorWinnerCardId === numericCardId) {
          winner = {
            cardId: numericCardId,
            prize:
              game.prizePool +
              (game.jackpotEnabled ? game.potentialJackpot : 0),
          };
          console.log(
            `[checkBingo] Moderator-designated winner confirmed for game #${game.gameNumber}: Card ${numericCardId}`
          );
        } else {
          console.log(
            `[checkBingo] Card ${numericCardId} has bingo but is not the designated winner for game #${game.gameNumber}`
          );
          return res.json({
            message: `Card ${numericCardId} is not the designated winner`,
            data: {
              winner: false,
              game,
              winnerCardId: game.moderatorWinnerCardId,
              isYourCardWinner: false,
            },
          });
        }
      } else {
        // No moderatorWinnerCardId, first card with bingo wins
        winner = {
          cardId: numericCardId,
          prize:
            game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0),
        };
        console.log(
          `[checkBingo] First bingo winner found for game #${game.gameNumber}: Card ${numericCardId}`
        );
      }
    }

    // Update game if a winner is found
    if (winner && !game.winner) {
      game.winner = winner;
      game.status = "completed";
      await game.save();

      if (game.jackpotEnabled) {
        const jackpot = await Jackpot.findOne();
        if (jackpot) {
          await logJackpotUpdate(
            jackpot.seed,
            "Reset after bingo win",
            game._id
          );
          jackpot.amount = jackpot.seed;
          jackpot.lastUpdated = Date.now();
          await jackpot.save();
        }
      }

      await Result.create({
        gameId: game._id,
        winnerCardId: winner.cardId,
        prize: winner.prize,
      });
    }

    return res.json({
      message: winner
        ? `Bingo! Card ${numericCardId} wins!`
        : `No bingo yet for card ${numericCardId}`,
      data: {
        winner: !!winner,
        game,
        winnerCardId: winner ? winner.cardId : null,
        isYourCardWinner: winner && winner.cardId === numericCardId,
      },
    });
  } catch (error) {
    console.error("[checkBingo] Error in checkBingo:", error);
    next(error);
  }
};

/**
 * Selects a winner for a pending game.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const selectWinner = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[selectWinner] Validation errors:", errors.array());
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const { cardId, gameNumber } = req.body;
    let game;
    if (req.params.id) {
      if (!mongoose.isValidObjectId(req.params.id)) {
        console.log("[selectWinner] Invalid game ID format:", req.params.id);
        return res.status(400).json({
          message: "Invalid game ID format",
          errorCode: "INVALID_GAME_ID",
        });
      }
      game = await Game.findById(req.params.id);
    } else if (gameNumber) {
      game = await Game.findOne({ gameNumber });
    } else {
      console.log("[selectWinner] No game ID or game number provided");
      return res.status(400).json({
        message: "Provide either game ID or game number",
        errorCode: "MISSING_FIELDS",
      });
    }

    if (!game || game.status !== "pending") {
      console.log(
        "[selectWinner] Game must be pending, found status:",
        game?.status
      );
      return res.status(400).json({
        message: "Game must be pending",
        errorCode: "GAME_NOT_PENDING",
      });
    }

    const card = game.selectedCards.find((c) => c.id === Number(cardId));
    if (!card) {
      console.log("[selectWinner] Invalid card ID:", cardId);
      return res
        .status(400)
        .json({ message: "Invalid card ID", errorCode: "INVALID_CARD_ID" });
    }

    if (
      game.moderatorWinnerCardId &&
      game.moderatorWinnerCardId !== Number(cardId)
    ) {
      console.log(
        "[selectWinner] Winner already selected for game:",
        game.moderatorWinnerCardId
      );
      return res.status(400).json({
        message: "A winner has already been selected for this game",
        errorCode: "WINNER_ALREADY_SELECTED",
      });
    }

    // Set selectedWinnerRowIndices when selecting a winner
    const { selectedIndices } = getNumbersForPattern(
      card.numbers,
      game.pattern,
      [],
      true
    );
    game.moderatorWinnerCardId = Number(cardId);
    game.selectedWinnerRowIndices = selectedIndices;
    await game.save();
    console.log(
      `[selectWinner] Card ${cardId} selected as winner for game ${game.gameNumber}, indices: ${selectedIndices}`
    );
    res.json({
      message: `Card ${cardId} selected as intended winner for game ${game.gameNumber}`,
      data: { game },
    });
  } catch (error) {
    console.error("[selectWinner] Error in selectWinner:", error);
    next(error);
  }
};

/**
 * Updates game details.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const updateGame = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("[updateGame] Validation errors:", errors.array());
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      console.log("[updateGame] Invalid game ID format:", req.params.id);
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

    const game = await Game.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!game) {
      console.log("[updateGame] Game not found:", req.params.id);
      return res
        .status(404)
        .json({ message: "Game not found", errorCode: "GAME_NOT_FOUND" });
    }

    console.log("[updateGame] Game updated:", game.gameNumber);
    res.json({ message: "Game updated successfully", data: game });
  } catch (error) {
    console.error("[updateGame] Error in updateGame:", error);
    next(error);
  }
};

/**
 * Retrieves the current jackpot.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getJackpot = async (req, res, next) => {
  try {
    const jackpot = await Jackpot.findOne();
    if (!jackpot) {
      console.log("[getJackpot] Jackpot not found");
      return res.status(404).json({ message: "Jackpot not found" });
    }
    console.log("[getJackpot] Jackpot retrieved:", jackpot.amount);
    res.json({ message: "Jackpot retrieved successfully", data: jackpot });
  } catch (error) {
    console.error("[getJackpot] Error in getJackpot:", error);
    next(error);
  }
};

/**
 * Starts a pending game.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const startGame = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      console.log("[startGame] Invalid game ID format:", req.params.id);
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const game = await Game.findById(req.params.id);
    if (!game) {
      console.log("[startGame] Game not found:", req.params.id);
      return res
        .status(404)
        .json({ message: "Game not found", errorCode: "GAME_NOT_FOUND" });
    }

    if (game.status !== "pending") {
      console.log("[startGame] Game already started or finished:", game.status);
      return res.status(400).json({
        message: "Game already started or finished",
        errorCode: "GAME_NOT_PENDING",
      });
    }

    game.status = "active";
    await game.save();
    console.log(
      "[startGame] Game started: Number=",
      game.gameNumber,
      "ID=",
      game._id
    );
    res.json({ message: "Game started", data: game });
  } catch (error) {
    console.error("[startGame] Error in startGame:", error);
    next(error);
  }
};

/**
 * Retrieves all finished games.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getFinishedGames = async (req, res, next) => {
  try {
    const finishedGames = await Game.find({ status: "completed" })
      .sort({ gameNumber: 1 })
      .select("_id gameNumber winner moderatorWinnerCardId");
    console.log(
      "[getFinishedGames] Retrieved finished games count:",
      finishedGames.length
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

/**
 * Configures winners for future games.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const configureFutureWinners = async (req, res, next) => {
  try {
    const { winners } = req.body;
    if (!Array.isArray(winners) || winners.length === 0) {
      console.log("[configureFutureWinners] Invalid winners array:", winners);
      return res.status(400).json({
        message: "Provide a non-empty array of future winners",
        errorCode: "INVALID_WINNERS",
      });
    }

    const configuredGames = [];
    for (const winnerConfig of winners) {
      const { gameNumber, cardId, jackpotEnabled = true } = winnerConfig; // Default to true
      if (!gameNumber || !cardId) {
        console.log(
          "[configureFutureWinners] Skipping invalid config:",
          winnerConfig
        );
        continue;
      }

      const parsedCardId = Number(cardId);
      if (isNaN(parsedCardId) || parsedCardId < 1) {
        console.log(
          `[configureFutureWinners] Invalid cardId for game #${gameNumber}: ${cardId}`
        );
        continue;
      }

      const card = await Card.findOne({ card_number: parsedCardId }).lean();
      if (!card) {
        console.log(
          `[configureFutureWinners] Card not found for game #${gameNumber}: ${parsedCardId}`
        );
        continue;
      }

      console.log(
        `[configureFutureWinners] Configuring winner for game #${gameNumber}, cardId: ${parsedCardId}, jackpotEnabled: ${jackpotEnabled}`
      );
      const counter = await Counter.findOneAndUpdate(
        { _id: `futureWinning_${gameNumber}` },
        { cardId: parsedCardId, jackpotEnabled }, // Store jackpotEnabled
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log(
        `[configureFutureWinners] Saved winner for game #${gameNumber} with card: ${parsedCardId}, jackpotEnabled: ${jackpotEnabled}`,
        counter
      );
      configuredGames.push({
        gameNumber,
        moderatorWinnerCardId: parsedCardId,
        jackpotEnabled,
      });
    }

    if (!configuredGames.length) {
      console.log("[configureFutureWinners] No valid winners configured");
      return res.status(400).json({
        message: "No valid winners configured",
        errorCode: "NO_VALID_WINNERS",
      });
    }

    console.log("[configureFutureWinners] Configured games:", configuredGames);
    res.json({
      message: "Future winners configured successfully",
      data: configuredGames,
    });
  } catch (error) {
    console.error(
      "[configureFutureWinners] Error in configureFutureWinners:",
      error
    );
    await GameLog.create({
      gameId: null,
      action: "configureFutureWinners",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};

/**
 * Configures the next game number.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const moderatorConfigureNextGameNumber = async (req, res, next) => {
  try {
    const { startNumber } = req.body;
    console.log(
      "[moderatorConfigureNextGameNumber] Configuring next game number to:",
      startNumber
    );
    if (typeof startNumber !== "number" || startNumber < 1) {
      console.log(
        "[moderatorConfigureNextGameNumber] Invalid starting number:",
        startNumber
      );
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

    const lastGame = await Game.findOne().sort({ gameNumber: -1 }).lean();
    if (lastGame && lastGame.gameNumber >= startNumber) {
      console.log(
        `[moderatorConfigureNextGameNumber] Cannot set counter to ${startNumber}, higher game exists: ${lastGame.gameNumber}`
      );
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
      { _id: "gameNumber" },
      { seq: startNumber },
      { upsert: true, new: true }
    );

    console.log(
      "[moderatorConfigureNextGameNumber] Successfully set next game number to:",
      startNumber
    );
    await GameLog.create({
      gameId: null,
      action: "configureNextGameNumber",
      status: "success",
      details: { startNumber },
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

/**
 * Creates future games with specified configurations.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const createFutureGames = async (req, res, next) => {
  try {
    const { games, startFromGameNumber } = req.body;
    console.log(
      "[createFutureGames] Creating future games, startFromGameNumber:",
      startFromGameNumber
    );
    const results = [];
    let nextNumber = startFromGameNumber || (await getNextGameNumber());

    for (const g of games) {
      const gameNumber = await getNextGameNumber(nextNumber++);
      console.log("[createFutureGames] Assigning game number:", gameNumber);
      const newGame = await createGameRecord({
        ...g,
        startFromGameNumber: gameNumber,
      });
      results.push(newGame);
    }

    console.log("[createFutureGames] Future games created:", results.length);
    res.json({ message: "Future games created", data: results });
  } catch (error) {
    console.error("[createFutureGames] Error in createFutureGames:", error);
    next(error);
  }
};

/**
 * Creates a new game record with provided configuration.
 * @param {Object} config - Game configuration
 * @returns {Promise<Object>} Created game object
 */
export const createGameRecord = async (
  gameNumber,
  betAmount,
  houseFeePercentage,
  gameCards,
  pattern,
  prizePool,
  potentialJackpot,
  winnerCardId,
  selectedWinnerRowIndices = [],
  jackpotEnabled = true
) => {
  if (!gameCards || !Array.isArray(gameCards) || gameCards.length === 0) {
    throw new Error("Game cards must be a non-empty array");
  }

  // Validate pattern
  if (!["line", "diagonal", "x_pattern"].includes(pattern)) {
    throw new Error("Invalid pattern type");
  }

  // Calculate houseFee
  const houseFee = betAmount * (houseFeePercentage / 100) * gameCards.length;

  const game = new Game({
    gameNumber,
    betAmount,
    houseFeePercentage,
    houseFee, // Set the computed houseFee
    selectedCards: gameCards,
    pattern,
    prizePool,
    potentialJackpot,
    status: "pending",
    calledNumbers: [],
    calledNumbersLog: [],
    moderatorWinnerCardId: winnerCardId,
    selectedWinnerRowIndices,
    jackpotEnabled,
    winner: null,
  });

  await game.save();
  console.log(
    `[createGameRecord] Game created: ID=${game._id}, Number=${game.gameNumber}, Pattern=${pattern}, WinnerCardId=${game.moderatorWinnerCardId}, SelectedIndices=${game.selectedWinnerRowIndices}`
  );

  if (winnerCardId && !moderatorWinnerCardId) {
    await Counter.deleteOne({ _id: `futureWinning_${gameNumber}` });
    console.log(
      `[createGameRecord] Cleaned up future winner entry for game #${gameNumber}`
    );
  }

  return game;
};
/**
 * Gets report data with filters and aggregations for cashier reports.
 * @param {Object} req - Express request object with query params: status, pattern, startDate, endDate
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const getReportData = async (req, res, next) => {
  try {
    console.log(
      "[getReportData] Fetching report data with filters:",
      req.query
    );

    const { status, pattern, startDate, endDate } = req.query;

    // Build filter object
    const filter = { status: { $ne: null } }; // All games by default

    if (status && status !== "") {
      filter.status = status === "finished" ? "completed" : status; // Map 'finished' to 'completed'
    }

    if (pattern && pattern !== "") {
      filter.pattern = pattern;
    }

    if (startDate) {
      filter.createdAt = { ...filter.createdAt, $gte: new Date(startDate) };
    }
    if (endDate) {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$lte = new Date(endDate);
    }

    // Fetch all matching games
    const games = await Game.find(filter)
      .select(
        "gameNumber betAmount houseFeePercentage houseFee prizePool status pattern createdAt startedAt winner"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!games || games.length === 0) {
      return res.json({
        message: "Report data retrieved",
        data: {
          totalGames: 0,
          activeGames: 0,
          totalHouseFee: 0,
          games: [],
        },
      });
    }

    // Aggregations
    const totalGames = games.length;
    const activeGames = games.filter(
      (g) => g.status === "active" || g.status === "pending"
    ).length;
    const totalHouseFee = games.reduce(
      (sum, game) => sum + (game.houseFee || 0),
      0
    );

    // Map fields for frontend (use createdAt as date if startedAt not present)
    const mappedGames = games.map((game) => ({
      id: game._id,
      gameNumber: game.gameNumber,
      status: game.status === "completed" ? "finished" : game.status,
      started_at: game.startedAt || game.createdAt, // Fallback to createdAt
      bet_amount: game.betAmount,
      house_percentage: game.houseFeePercentage,
      winning_pattern: game.pattern, // Assume pattern is winning_pattern
      house_fee: game.houseFee,
      prize_pool: game.prizePool,
      // Add more fields if needed, e.g., total_pot: game.totalPot (calculate if not stored)
    }));

    console.log(
      `[getReportData] Retrieved ${totalGames} games, ${activeGames} active, total house fee: ${totalHouseFee}`
    );

    res.json({
      message: "Report data retrieved successfully",
      data: {
        totalGames,
        activeGames,
        totalHouseFee: totalHouseFee.toFixed(2),
        games: mappedGames,
      },
    });
  } catch (error) {
    console.error("[getReportData] Error fetching report data:", error);
    next(error);
  }
};

export const pauseGame = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    console.log("[pauseGame] Pausing game:", gameId);

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    if (game.status !== "active") {
      return res.status(400).json({ message: "Game must be active to pause" });
    }

    game.status = "paused";
    await game.save();

    // Log the action (if GameLog exists)
    if (GameLog) {
      await GameLog.create({
        gameId,
        action: "pauseGame",
        status: "success",
        details: { gameNumber: game.gameNumber },
      });
    }

    res.json({
      message: `Game ${game.gameNumber} paused successfully`,
      status: "paused",
    });
  } catch (error) {
    console.error("[pauseGame] Error pausing game:", error);
    if (GameLog) {
      await GameLog.create({
        gameId: req.params.gameId,
        action: "pauseGame",
        status: "failed",
        details: { error: error.message || "Internal server error" },
      });
    }
    next(error);
  }
};

/**
 * Selects a random jackpot winner from the game's selected cards.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const selectJackpotWinner = async (req, res, next) => {
  try {
    const gameId = req.params.id;
    if (!mongoose.isValidObjectId(gameId)) {
      console.log("[selectJackpotWinner] Invalid game ID format:", gameId);
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      console.log("[selectJackpotWinner] Game not found:", gameId);
      return res.status(404).json({
        message: "Game not found",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    if (game.status !== "active") {
      console.log("[selectJackpotWinner] Game not active:", game.status);
      return res.status(400).json({
        message: "Game must be active to select jackpot winner",
        errorCode: "GAME_NOT_ACTIVE",
      });
    }

    if (!game.jackpotEnabled) {
      console.log(
        "[selectJackpotWinner] Jackpot not enabled for game:",
        gameId
      );
      return res.status(400).json({
        message: "Jackpot is not enabled for this game",
        errorCode: "JACKPOT_NOT_ENABLED",
      });
    }

    if (game.jackpotWinner) {
      console.log(
        "[selectJackpotWinner] Jackpot winner already selected for game:",
        game.jackpotWinner.cardId
      );
      return res.status(400).json({
        message: "Jackpot winner already selected",
        errorCode: "JACKPOT_WINNER_ALREADY_SELECTED",
      });
    }

    const jackpot = await Jackpot.findOne();
    if (!jackpot) {
      console.log("[selectJackpotWinner] Jackpot not found");
      return res.status(404).json({
        message: "Jackpot not found",
        errorCode: "JACKPOT_NOT_FOUND",
      });
    }

    const eligibleCards = game.selectedCards.filter(
      (card) =>
        !game.moderatorWinnerCardId || card.id !== game.moderatorWinnerCardId
    );
    if (eligibleCards.length === 0) {
      console.log("[selectJackpotWinner] No eligible cards for jackpot");
      return res.status(400).json({
        message: "No eligible cards available for jackpot",
        errorCode: "NO_ELIGIBLE_CARDS",
      });
    }

    const randomIndex = Math.floor(Math.random() * eligibleCards.length);
    const jackpotWinnerCard = eligibleCards[randomIndex];

    game.jackpotWinner = {
      cardId: jackpotWinnerCard.id,
      prize: jackpot.amount,
    };

    await game.save();

    await logJackpotUpdate(
      jackpot.amount,
      `Jackpot awarded to card ${jackpotWinnerCard.id}`,
      gameId
    );

    // Reset jackpot to seed value
    jackpot.amount = jackpot.seed;
    jackpot.lastUpdated = Date.now();
    await jackpot.save();

    await Result.create({
      gameId: game._id,
      winnerCardId: jackpotWinnerCard.id,
      prize: jackpot.amount,
      isJackpot: true,
    });

    console.log(
      `[selectJackpotWinner] Jackpot winner selected for game #${game.gameNumber}: Card ${jackpotWinnerCard.id}, Prize=${jackpot.amount}`
    );

    res.json({
      message: `Jackpot winner selected: Card ${jackpotWinnerCard.id}`,
      data: {
        game,
        jackpotWinner: game.jackpotWinner,
      },
    });
  } catch (error) {
    console.error("[selectJackpotWinner] Error in selectJackpotWinner:", error);
    await GameLog.create({
      gameId,
      action: "selectJackpotWinner",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};
