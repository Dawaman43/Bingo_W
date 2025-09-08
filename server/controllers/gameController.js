import { validationResult } from "express-validator";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import Result from "../models/Result.js";
import Card from "../models/Card.js";

// Create a new game
export const createGame = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { cardIds, pattern, prizePool, potentialJackpot } = req.body;

  try {
    // Validate cardIds
    const cards = await Card.find({ card_number: { $in: cardIds } });
    if (cards.length !== cardIds.length) {
      return res
        .status(400)
        .json({ message: "One or more card IDs are invalid" });
    }

    // Validate pattern
    const validPatterns = ["single_line", "double_line", "full_house"];
    if (!validPatterns.includes(pattern)) {
      return res.status(400).json({ message: "Invalid pattern" });
    }

    // Create game
    const game = new Game({
      selectedCards: cards.map((card) => ({
        id: card.card_number,
        numbers: card.numbers,
      })),
      pattern,
      prizePool: prizePool || 0,
      potentialJackpot: potentialJackpot || 0,
      status: "active",
      calledNumbers: [],
      calledNumbersLog: [],
    });

    await game.save();
    res.status(201).json({ message: "Game created successfully", data: game });
  } catch (error) {
    next(error);
  }
};

// Get a single game by ID
export const getGame = async (req, res, next) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    res.json({
      message: "Game retrieved successfully",
      data: {
        gameId: game._id,
        status: game.status,
        calledNumbers: game.calledNumbers,
        selectedCards: game.selectedCards,
        pattern: game.pattern,
        prizePool: game.prizePool,
        potentialJackpot: game.potentialJackpot,
        winner: game.winner,
        calledNumbersLog: game.calledNumbersLog,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all games
export const getAllGames = async (req, res, next) => {
  try {
    const games = await Game.find();
    res.json({
      message: "All games retrieved successfully",
      data: games.map((game) => ({
        gameId: game._id,
        status: game.status,
        calledNumbers: game.calledNumbers,
        selectedCards: game.selectedCards,
        pattern: game.pattern,
        prizePool: game.prizePool,
        potentialJackpot: game.potentialJackpot,
        winner: game.winner,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Get all cards
export const getAllCards = async (req, res, next) => {
  try {
    const cards = await Card.find();
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

// Call a number in the game
export const callNumber = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { number } = req.body;

  try {
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active") {
      return res.status(400).json({ message: "Game not active or not found" });
    }

    // Validate number (1-75 or 'FREE')
    if (number !== "FREE" && (isNaN(number) || number < 1 || number > 75)) {
      return res.status(400).json({ message: "Invalid number" });
    }

    // Check if number was already called
    if (game.calledNumbers.includes(number)) {
      return res.status(400).json({ message: "Number already called" });
    }

    // Add number to calledNumbers and log
    game.calledNumbers.push(number);
    game.calledNumbersLog.push({ number, calledAt: new Date() });

    await game.save();
    res.json({
      message: `Number ${number} called`,
      data: { game, calledNumber: number },
    });
  } catch (error) {
    next(error);
  }
};

// Check for bingo
export const checkBingo = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { cardId } = req.body;

  try {
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active") {
      return res.status(400).json({ message: "Game not active or not found" });
    }

    const card = game.selectedCards.find((c) => c.id === cardId);
    if (!card) {
      return res.status(400).json({ message: "Invalid card ID" });
    }

    // Convert flat numbers array to 5x5 grid
    const grid = [];
    for (let i = 0; i < 5; i++) {
      grid.push(card.numbers.slice(i * 5, (i + 1) * 5));
    }

    let isWinner = false;
    if (game.pattern === "single_line") {
      // Check rows
      for (let i = 0; i < 5; i++) {
        if (
          grid[i].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        ) {
          isWinner = true;
          break;
        }
      }
      // Check columns
      for (let j = 0; j < 5; j++) {
        if (
          [grid[0][j], grid[1][j], grid[2][j], grid[3][j], grid[4][j]].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        ) {
          isWinner = true;
          break;
        }
      }
    } else if (game.pattern === "double_line") {
      let linesMatched = 0;
      // Check rows
      for (let i = 0; i < 5; i++) {
        if (
          grid[i].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        ) {
          linesMatched++;
        }
      }
      // Check columns
      for (let j = 0; j < 5; j++) {
        if (
          [grid[0][j], grid[1][j], grid[2][j], grid[3][j], grid[4][j]].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        ) {
          linesMatched++;
        }
      }
      isWinner = linesMatched >= 2;
    } else if (game.pattern === "full_house") {
      isWinner = card.numbers.every(
        (num) => num === "FREE" || game.calledNumbers.includes(num)
      );
    }

    if (isWinner) {
      const prize = game.prizePool + game.potentialJackpot;
      game.status = "completed";
      game.winner = { cardId, prize };
      await game.save();

      let jackpot = await Jackpot.findOne();
      if (jackpot) {
        jackpot.amount = jackpot.seed;
        jackpot.lastUpdated = Date.now();
        await jackpot.save();
      }

      await Result.create({
        gameId: game._id,
        winnerCardId: cardId,
        prize,
      });

      return res.json({
        message: `Bingo! Card ${cardId} wins!`,
        data: { winner: true, game, calledNumbers: game.calledNumbers },
      });
    }

    res.json({
      message: `No bingo for card ${cardId}`,
      data: { winner: false, game, calledNumbers: game.calledNumbers },
    });
  } catch (error) {
    next(error);
  }
};

// Select a winner (moderator action)
export const selectWinner = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { cardId } = req.body;

  try {
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active") {
      return res.status(400).json({ message: "Game not active or not found" });
    }

    const card = game.selectedCards.find((c) => c.id === cardId);
    if (!card) {
      return res.status(400).json({ message: "Invalid card ID" });
    }

    // Simulate calling numbers to achieve the winning pattern
    const numbersToCall = getNumbersForPattern(card.numbers, game.pattern);
    for (const number of numbersToCall) {
      if (!game.calledNumbers.includes(number)) {
        game.calledNumbers.push(number);
        game.calledNumbersLog.push({ number, cardId, calledAt: new Date() });
      }
    }

    const prize = game.prizePool + game.potentialJackpot;
    game.status = "completed";
    game.winner = { cardId, prize };
    await game.save();

    let jackpot = await Jackpot.findOne();
    if (jackpot) {
      jackpot.amount = jackpot.seed;
      jackpot.lastUpdated = Date.now();
      await jackpot.save();
    }

    await Result.create({
      gameId: game._id,
      winnerCardId: cardId,
      prize,
    });

    res.json({
      message: `Card ${cardId} selected as winner!`,
      data: { winner: true, game, calledNumbers: game.calledNumbers },
    });
  } catch (error) {
    next(error);
  }
};

// Finish a game (moderator action)
export const finishGame = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active") {
      return res.status(400).json({ message: "Game not active or not found" });
    }

    game.status = "completed";
    await game.save();

    res.json({
      message: "Game finished successfully",
      data: { gameId: game._id, status: game.status },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get numbers needed for a pattern
const getNumbersForPattern = (cardNumbers, pattern) => {
  const grid = [];
  for (let i = 0; i < 5; i++) {
    grid.push(cardNumbers.slice(i * 5, (i + 1) * 5));
  }
  const numbers = [];
  if (pattern === "single_line") {
    // Use first row for simplicity
    numbers.push(...grid[0].filter((n) => n !== "FREE"));
  } else if (pattern === "double_line") {
    // Use first two rows
    numbers.push(...grid[0].filter((n) => n !== "FREE"));
    numbers.push(...grid[1].filter((n) => n !== "FREE"));
  } else if (pattern === "full_house") {
    // All numbers except FREE
    numbers.push(...cardNumbers.filter((n) => n !== "FREE"));
  }
  return numbers;
};
