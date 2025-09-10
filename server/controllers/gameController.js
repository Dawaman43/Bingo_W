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
 * @returns {{ lines: boolean[], lineProgress: number[] }} Object with lines completion status and progress
 */
const countCompletedLines = (cardNumbers, calledNumbers) => {
  const grid = cardNumbers.map((row) => row.map((num) => num.toString()));
  const isMarked = (num) =>
    num === "FREE" || calledNumbers.includes(Number(num));
  const lines = [];
  const lineProgress = [];

  // Rows
  for (let i = 0; i < 5; i++) {
    lines.push(grid[i].every(isMarked));
    lineProgress.push(
      grid[i].reduce((sum, num) => sum + (isMarked(num) ? 1 : 0), 0)
    );
  }

  // Columns
  for (let j = 0; j < 5; j++) {
    lines.push([0, 1, 2, 3, 4].every((i) => isMarked(grid[i][j])));
    lineProgress.push(
      [0, 1, 2, 3, 4].reduce(
        (sum, i) => sum + (isMarked(grid[i][j]) ? 1 : 0),
        0
      )
    );
  }

  // Diagonals
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

  return { lines, lineProgress };
};

/**
 * Extracts numbers from a card based on the specified pattern.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {string} pattern - Pattern type: 'single_line', 'double_line', or 'full_house'
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @returns {string[]} Array of numbers for the pattern
 */
const getNumbersForPattern = (cardNumbers, pattern, calledNumbers) => {
  const grid = cardNumbers.map((row) => row.map((num) => num.toString()));
  const numbers = [];

  if (pattern === "single_line") {
    const lines = [
      ...grid, // Rows
      ...[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2, 3, 4].map((row) => grid[row][col])
      ), // Columns
      [0, 1, 2, 3, 4].map((i) => grid[i][i]), // Diagonal top-left to bottom-right
      [0, 1, 2, 3, 4].map((i) => grid[i][4 - i]), // Diagonal top-right to bottom-left
    ];
    const firstLine = lines.find((line) => line.some((n) => n !== "FREE"));
    numbers.push(...(firstLine ? firstLine.filter((n) => n !== "FREE") : []));
  } else if (pattern === "double_line") {
    const { lines } = countCompletedLines(cardNumbers, calledNumbers);
    const completedLineIndices = lines
      .map((complete, index) => (complete ? index : -1))
      .filter((index) => index !== -1)
      .slice(0, 2); // Get up to two completed lines
    for (const index of completedLineIndices) {
      if (index < 5) {
        numbers.push(...grid[index].filter((n) => n !== "FREE")); // Rows
      } else if (index < 10) {
        numbers.push(
          ...[0, 1, 2, 3, 4]
            .map((i) => grid[i][index - 5])
            .filter((n) => n !== "FREE")
        ); // Columns
      } else {
        const diag =
          index === 10
            ? [0, 1, 2, 3, 4].map((i) => grid[i][i])
            : [0, 1, 2, 3, 4].map((i) => grid[i][4 - i]);
        numbers.push(...diag.filter((n) => n !== "FREE"));
      }
    }
  } else if (pattern === "full_house") {
    numbers.push(...grid.flat().filter((n) => n !== "FREE"));
  }

  return numbers;
};

/**
 * Gets the next game number atomically.
 * @param {number} [startFromGameNumber] - Optional starting game number
 * @returns {Promise<number>} The next game number
 * @throws {Error} If counter state is invalid
 */
const getNextGameNumber = async (startFromGameNumber = null) => {
  const update = startFromGameNumber
    ? { $max: { seq: startFromGameNumber }, $inc: { seq: 1 } }
    : { $inc: { seq: 1 } };
  const counter = await Counter.findOneAndUpdate(
    { _id: "gameNumber" },
    update,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (!counter || typeof counter.seq !== "number") {
    throw new Error("Invalid counter state");
  }
  return counter.seq;
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
 * Creates a new bingo game.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const createGame = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("Validation errors:", errors.array());
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    // Destructure request body with defaults
    const {
      selectedCards = [],
      pattern = "single_line",
      betAmount = 10,
      houseFeePercentage = 15,
      moderatorWinnerCardId = null,
      jackpotEnabled = true,
      startFromGameNumber,
    } = req.body;

    // Ensure some cards were selected
    if (!selectedCards.length) {
      console.log("No cards selected in request");
      return res.status(400).json({ message: "No cards selected" });
    }

    // Convert selectedCards to array of numbers, handling both objects and numbers
    const cardIds = selectedCards
      .map((c) => {
        if (typeof c === "object" && c !== null && "id" in c) {
          return Number(c.id);
        } else if (typeof c === "number") {
          return c;
        }
        return NaN;
      })
      .filter((id) => !isNaN(id));

    if (!cardIds.length) {
      console.log("Invalid card IDs provided:", selectedCards);
      return res.status(400).json({ message: "Invalid card IDs provided" });
    }

    // Fetch cards from DB
    const cards = await Card.find({ card_number: { $in: cardIds } });

    if (!cards.length) {
      console.log("No valid cards found for IDs:", cardIds);
      return res
        .status(400)
        .json({ message: "No valid cards found for the provided IDs" });
    }

    // Check if all requested card IDs exist
    const foundCardIds = cards.map((card) => card.card_number);
    const missingCardIds = cardIds.filter((id) => !foundCardIds.includes(id));
    if (missingCardIds.length) {
      console.log("Missing card IDs:", missingCardIds);
      return res
        .status(400)
        .json({ message: `Cards not found: ${missingCardIds.join(", ")}` });
    }

    // Assign a unique game number
    const assignedGameNumber = await getNextGameNumber(startFromGameNumber);

    // Prepare card data for game
    const gameCards = cards.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    // Calculate totals
    const totalPot = Number(betAmount) * gameCards.length;
    const houseFee = (totalPot * Number(houseFeePercentage)) / 100;
    const potentialJackpot = jackpotEnabled ? totalPot * 0.1 : 0;
    const prizePool = totalPot - houseFee - potentialJackpot;

    // Create new game document
    const game = new Game({
      gameNumber: assignedGameNumber,
      betAmount,
      houseFeePercentage,
      selectedCards: gameCards,
      pattern,
      prizePool,
      potentialJackpot,
      status: "pending",
      calledNumbers: [],
      calledNumbersLog: [],
      moderatorWinnerCardId: moderatorWinnerCardId
        ? Number(moderatorWinnerCardId)
        : null,
      jackpotEnabled,
      winner: null,
    });

    await game.save();

    // Log successful game creation
    console.log(`Game created: ID=${game._id}, Number=${game.gameNumber}`);

    // Return game info with consistent id, gameId, and _id
    res.status(201).json({
      message: "Game created successfully",
      data: {
        id: game._id.toString(), // Added for frontend compatibility
        gameId: game._id.toString(), // Alias for _id
        _id: game._id.toString(), // Original field
        gameNumber: game.gameNumber,
      },
    });
  } catch (error) {
    console.error("Error creating game:", error);
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
    await Counter.deleteOne({ _id: "gameNumber" });
    const counter = await Counter.create({ _id: "gameNumber", seq: nextSeq });
    console.log(`Game counter reset to: ${nextSeq}`);
    res.json({ message: `Game counter reset to ${nextSeq}`, nextSeq });
  } catch (error) {
    console.error("Error in resetGameCounter:", error);
    next(new Error("Failed to reset game counter"));
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
      return res.status(400).json({ message: "Invalid game ID format" });
    }
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json({ message: "Game retrieved successfully", data: game });
  } catch (error) {
    console.error("Error in getGame:", error);
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
    const games = await Game.find();
    res.json({ message: "All games retrieved successfully", data: games });
  } catch (error) {
    console.error("Error in getAllGames:", error);
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
    res.json({
      message: "All cards retrieved successfully",
      data: cards.map((card) => ({
        cardId: card.card_number,
        numbers: card.numbers,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calls a number in an active game.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const callNumber = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const { number } = req.body;
    const { id: gameId } = req.params;
    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({ message: "Invalid game ID" });
    }

    const game = await Game.findById(gameId);
    if (!game || game.status !== "active") {
      return res.status(400).json({ message: "Game not active or not found" });
    }

    // Determine called number
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
      (n) => !game.calledNumbers.includes(n)
    );
    if (!availableNumbers.length) {
      return res.status(400).json({ message: "All numbers called" });
    }

    let calledNumber = number ? Number(number) : null;
    if (calledNumber) {
      if (isNaN(calledNumber) || !availableNumbers.includes(calledNumber)) {
        return res
          .status(400)
          .json({ message: "Invalid number or already called" });
      }
    } else {
      // Moderator winner logic
      if (game.moderatorWinnerCardId) {
        const winningCard = game.selectedCards.find(
          (c) => c.id === game.moderatorWinnerCardId
        );
        if (winningCard) {
          const remainingWinningNumbers = getNumbersForPattern(
            winningCard.numbers,
            game.pattern,
            game.calledNumbers
          )
            .map(Number)
            .filter((n) => !game.calledNumbers.includes(n));

          if (remainingWinningNumbers.length) {
            // 80% chance to pick winning number
            calledNumber =
              Math.random() < 0.8
                ? remainingWinningNumbers[
                    Math.floor(Math.random() * remainingWinningNumbers.length)
                  ]
                : availableNumbers[
                    Math.floor(Math.random() * availableNumbers.length)
                  ];
          }
        }
      }
      if (!calledNumber) {
        calledNumber =
          availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
      }
    }

    // Update game
    game.calledNumbers.push(calledNumber);
    game.calledNumbersLog.push({ number: calledNumber, calledAt: new Date() });

    // Check for bingo
    let winnerCard = null;
    for (const card of game.selectedCards) {
      const { isBingo } = checkCardBingo(
        card.numbers,
        game.calledNumbers,
        game.pattern
      );
      if (
        isBingo &&
        (!game.moderatorWinnerCardId || card.id === game.moderatorWinnerCardId)
      ) {
        winnerCard = card;
        break;
      }
    }

    if (winnerCard) {
      const prize =
        game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0);
      game.status = "completed";
      game.winner = { cardId: winnerCard.id, prize };
      game.moderatorWinnerCardId = winnerCard.id;
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
        winnerCardId: winnerCard.id,
        prize,
      });
      return res.json({
        message: `Number ${calledNumber} called. Bingo! Card ${winnerCard.id} wins!`,
        data: { game, calledNumber, winner: winnerCard.id },
      });
    }

    await game.save();
    res.json({
      message: `Number ${calledNumber} called`,
      data: { game, calledNumber },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates sequential games.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const createSequentialGames = async (req, res, next) => {
  try {
    const {
      count,
      pattern = "single_line",
      betAmount = 10,
      houseFeePercentage = 15,
    } = req.body;
    if (!count || count <= 0) {
      return res
        .status(400)
        .json({ message: "Count must be a positive number" });
    }

    const createdGames = [];
    for (let i = 0; i < count; i++) {
      const gameNumber = await getNextGameNumber(); // atomic increment
      const game = new Game({
        gameNumber,
        pattern,
        betAmount,
        houseFeePercentage,
        status: "pending",
        selectedCards: [],
        calledNumbers: [],
        calledNumbersLog: [],
      });
      await game.save();
      createdGames.push(game);
    }

    res.json({ message: "Sequential games created", data: createdGames });
  } catch (error) {
    next(error);
  }
};

/**
 * Checks if a card has bingo based on the pattern.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @param {string} pattern - Pattern type: 'single_line', 'double_line', or 'full_house'
 * @returns {{ isBingo: boolean, completedLines: number, lineProgress: number[] }}
 */
export const checkCardBingo = (cardNumbers, calledNumbers, pattern) => {
  const { lines, lineProgress } = countCompletedLines(
    cardNumbers,
    calledNumbers
  );
  let isBingo = false;

  if (pattern === "single_line") {
    isBingo = lines.some(Boolean);
  } else if (pattern === "double_line") {
    isBingo = lines.filter(Boolean).length >= 2;
  } else if (pattern === "full_house") {
    isBingo = lineProgress.every((n) => n === 5);
  }

  return {
    isBingo,
    completedLines: lines.filter(Boolean).length,
    lineProgress,
  };
};

/**
 * Checks bingo status for a specific card in a game.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const checkBingo = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid game ID format" });
    }

    const { cardId } = req.body;
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(400).json({ message: "Game not found" });
    }

    if (game.status === "completed") {
      const isWinner = game.winner?.cardId === Number(cardId);
      return res.json({
        message: isWinner
          ? `Bingo! Card ${cardId} wins!`
          : `No bingo for card ${cardId}`,
        data: { winner: isWinner, game },
      });
    }

    if (game.status !== "active") {
      return res.status(400).json({ message: "Game not active" });
    }

    const card = game.selectedCards.find((c) => c.id === Number(cardId));
    if (!card) {
      return res.status(400).json({ message: "Invalid card ID" });
    }

    const { isBingo } = checkCardBingo(
      card.numbers,
      game.calledNumbers,
      game.pattern
    );
    if (!isBingo) {
      return res.json({
        message: `No bingo for card ${cardId}`,
        data: { winner: false, game },
      });
    }

    if (
      game.moderatorWinnerCardId &&
      Number(cardId) !== Number(game.moderatorWinnerCardId)
    ) {
      return res.json({
        message: `No bingo for card ${cardId}: Does not match moderator's selection`,
        data: { winner: false, game },
      });
    }

    const prize =
      game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0);
    game.status = "completed";
    game.winner = { cardId: Number(cardId), prize };
    game.moderatorWinnerCardId = Number(cardId);
    await game.save();

    if (game.jackpotEnabled) {
      const jackpot = await Jackpot.findOne();
      if (jackpot) {
        await logJackpotUpdate(jackpot.seed, "Reset after bingo win", game._id);
        jackpot.amount = jackpot.seed;
        jackpot.lastUpdated = Date.now();
        await jackpot.save();
      }
    }

    await Result.create({ gameId: game._id, winnerCardId: cardId, prize });
    return res.json({
      message: `Bingo! Card ${cardId} wins!`,
      data: { winner: true, game },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Finishes an active game, selecting a winner if provided.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const finishGame = async (req, res, next) => {
  try {
    // Log the incoming request
    await GameLog.create({
      gameId: req.params.id,
      action: "finishGame",
      status: "initiated",
      details: { requestBody: req.body, params: req.params },
    });

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await GameLog.create({
        gameId: req.params.id,
        action: "finishGame",
        status: "failed",
        details: {
          error: "Validation failed",
          validationErrors: errors.array(),
        },
      });
      return res.status(400).json({
        message: "Validation failed",
        errorCode: "VALIDATION_ERROR",
        errors: errors.array(),
      });
    }

    // Validate game ID
    if (!mongoose.isValidObjectId(req.params.id)) {
      await GameLog.create({
        gameId: req.params.id,
        action: "finishGame",
        status: "failed",
        details: { error: "Invalid game ID format" },
      });
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    // Safely handle req.body
    const { moderatorCardId = null } = req.body || {};

    // Fetch game
    const game = await Game.findById(req.params.id);
    if (!game) {
      await GameLog.create({
        gameId: req.params.id,
        action: "finishGame",
        status: "failed",
        details: { error: "Game not found" },
      });
      return res
        .status(404)
        .json({ message: "Game not found", errorCode: "GAME_NOT_FOUND" });
    }

    // Check game status
    if (game.status !== "active") {
      await GameLog.create({
        gameId: req.params.id,
        action: "finishGame",
        status: "failed",
        details: { error: "Game is not active", gameStatus: game.status },
      });
      return res
        .status(400)
        .json({ message: "Game is not active", errorCode: "GAME_NOT_ACTIVE" });
    }

    // Check if cards are available
    if (!game.selectedCards || game.selectedCards.length === 0) {
      await GameLog.create({
        gameId: req.params.id,
        action: "finishGame",
        status: "failed",
        details: { error: "No cards available in the game" },
      });
      return res.status(400).json({
        message: "No cards available in the game",
        errorCode: "NO_CARDS_AVAILABLE",
      });
    }

    // Determine winner
    let winnerCardId = moderatorCardId ? Number(moderatorCardId) : null;
    if (winnerCardId) {
      const cardExists = game.selectedCards.some((c) => c.id === winnerCardId);
      if (!cardExists) {
        await GameLog.create({
          gameId: req.params.id,
          action: "finishGame",
          status: "failed",
          details: { error: "Invalid moderator card ID", moderatorCardId },
        });
        return res.status(400).json({
          message: "Invalid moderator card ID",
          errorCode: "INVALID_MODERATOR_CARD_ID",
        });
      }
    } else {
      // Check for bingo winners
      for (const card of game.selectedCards) {
        const { isBingo } = checkCardBingo(
          card.numbers,
          game.calledNumbers,
          game.pattern
        );
        if (isBingo) {
          winnerCardId = card.id;
          break;
        }
      }
      // If no bingo winner, select a random card
      if (!winnerCardId) {
        winnerCardId =
          game.selectedCards[
            Math.floor(Math.random() * game.selectedCards.length)
          ].id;
      }
    }

    // Calculate prize
    const prize =
      game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0);

    // Update game
    game.status = "completed";
    game.winner = { cardId: winnerCardId, prize };
    game.moderatorWinnerCardId = winnerCardId;
    await game.save();

    // Handle jackpot reset
    if (game.jackpotEnabled) {
      const jackpot = await Jackpot.findOne();
      if (jackpot) {
        await logJackpotUpdate(
          jackpot.seed,
          "Reset after game completion",
          game._id
        );
        jackpot.amount = jackpot.seed;
        jackpot.lastUpdated = Date.now();
        await jackpot.save();
      }
    }

    // Save result
    await Result.create({ gameId: game._id, winnerCardId, prize });

    // Log successful completion
    await GameLog.create({
      gameId: game._id,
      action: "finishGame",
      status: "success",
      details: { winnerCardId, prize, gameNumber: game.gameNumber },
    });

    // Respond
    res.json({
      message: `Game completed. Winner card: ${winnerCardId}`,
      data: {
        gameId: game._id,
        winnerCardId,
        status: game.status,
        gameNumber: game.gameNumber,
      },
    });
  } catch (error) {
    // Log error
    await GameLog.create({
      gameId: req.params.id,
      action: "finishGame",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    console.error("Error in finishGame:", error);
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
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    const { cardId, gameNumber } = req.body;
    let game;
    if (req.params.id) {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid game ID format" });
      }
      game = await Game.findById(req.params.id);
    } else if (gameNumber) {
      game = await Game.findOne({ gameNumber });
    } else {
      return res
        .status(400)
        .json({ message: "Provide either game ID or game number" });
    }

    if (!game || game.status !== "pending") {
      return res.status(400).json({ message: "Game must be pending" });
    }

    const card = game.selectedCards.find((c) => c.id === Number(cardId));
    if (!card) {
      return res.status(400).json({ message: "Invalid card ID" });
    }

    if (
      game.moderatorWinnerCardId &&
      game.moderatorWinnerCardId !== Number(cardId)
    ) {
      return res
        .status(400)
        .json({ message: "A winner has already been selected for this game" });
    }

    game.moderatorWinnerCardId = Number(cardId);
    await game.save();
    res.json({
      message: `Card ${cardId} selected as intended winner for game ${game.gameNumber}`,
      data: { game },
    });
  } catch (error) {
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
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid game ID format" });
    }

    const {
      calledNumbers,
      calledNumbersLog,
      moderatorWinnerCardId,
      jackpotEnabled,
      status,
    } = req.body;
    const updateData = {};
    if (calledNumbers) updateData.calledNumbers = calledNumbers;
    if (calledNumbersLog) updateData.calledNumbersLog = calledNumbersLog;
    if (moderatorWinnerCardId !== undefined)
      updateData.moderatorWinnerCardId = moderatorWinnerCardId;
    if (jackpotEnabled !== undefined)
      updateData.jackpotEnabled = jackpotEnabled;
    if (status) updateData.status = status;

    const game = await Game.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json({ message: "Game updated successfully", data: game });
  } catch (error) {
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
      return res.status(404).json({ message: "Jackpot not found" });
    }
    res.json({ message: "Jackpot retrieved successfully", data: jackpot });
  } catch (error) {
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
      return res.status(400).json({ message: "Invalid game ID format" });
    }

    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "pending") {
      return res
        .status(400)
        .json({ message: "Game already started or finished" });
    }

    game.status = "active";
    await game.save();
    res.json({ message: "Game started", data: game });
  } catch (error) {
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
    const finishedIds = finishedGames.map((g) => g._id);
    res.json({
      message: "Finished games retrieved",
      data: { finishedGames, finishedIds },
    });
  } catch (error) {
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
      return res.status(400).json({ message: "Provide future winners array" });
    }

    const configuredGames = [];
    for (const winnerConfig of winners) {
      const { gameNumber, cardId } = winnerConfig;
      if (!gameNumber || !cardId) continue;

      let game = await Game.findOne({ gameNumber });
      if (!game) {
        game = new Game({
          gameNumber,
          betAmount: 10,
          houseFeePercentage: 15,
          pattern: "single_line",
          selectedCards: [],
          status: "pending",
        });
      }

      game.moderatorWinnerCardId = Number(cardId);
      await game.save();
      configuredGames.push({ gameNumber, moderatorWinnerCardId: cardId });
    }

    res.json({
      message: "Future winners configured successfully",
      data: configuredGames,
    });
  } catch (error) {
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
    if (typeof startNumber !== "number" || startNumber < 1) {
      return res.status(400).json({ message: "Invalid starting number" });
    }

    await Counter.findOneAndUpdate(
      { _id: "gameNumber" },
      { seq: startNumber },
      { upsert: true, new: true }
    );

    res.json({ message: `Next game will start from ${startNumber}` });
  } catch (error) {
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
    const results = [];
    let nextNumber = startFromGameNumber || (await getNextGameNumber());

    for (const g of games) {
      const gameNumber = await getNextGameNumber(nextNumber++);
      const newGame = await createGameRecord({
        ...g,
        startFromGameNumber: gameNumber,
      });
      results.push(newGame);
    }

    res.json({ message: "Future games created", data: results });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a new game record with provided configuration.
 * @param {Object} config - Game configuration
 * @returns {Promise<Object>} Created game object
 */
export const createGameRecord = async ({
  selectedCards = [],
  pattern = "single_line",
  betAmount = 10,
  houseFeePercentage = 15,
  moderatorWinnerCardId = null,
  jackpotEnabled = true,
  startFromGameNumber = null,
}) => {
  const cardIds = selectedCards
    .map((c) => {
      if (typeof c === "object" && c !== null && "id" in c) {
        return Number(c.id);
      } else if (typeof c === "number") {
        return c;
      }
      return NaN;
    })
    .filter((id) => !isNaN(id));

  const cards = await Card.find({ card_number: { $in: cardIds } });

  const assignedGameNumber = await getNextGameNumber(startFromGameNumber);
  const gameCards = cards.map((card) => ({
    id: card.card_number,
    numbers: card.numbers,
  }));

  const totalPot = Number(betAmount) * gameCards.length;
  const houseFee = (totalPot * Number(houseFeePercentage)) / 100;
  const potentialJackpot = jackpotEnabled ? totalPot * 0.1 : 0;
  const prizePool = totalPot - houseFee - potentialJackpot;

  const game = new Game({
    gameNumber: assignedGameNumber,
    betAmount,
    houseFeePercentage,
    selectedCards: gameCards,
    pattern,
    prizePool,
    potentialJackpot,
    status: "pending",
    calledNumbers: [],
    calledNumbersLog: [],
    moderatorWinnerCardId: moderatorWinnerCardId
      ? Number(moderatorWinnerCardId)
      : null,
    jackpotEnabled,
    winner: null,
  });

  await game.save();
  return game;
};
