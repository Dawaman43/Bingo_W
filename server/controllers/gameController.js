import { validationResult } from "express-validator";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import Result from "../models/Result.js";
import Card from "../models/Card.js";
import Counter from "../models/Counter.js";

// Utility function to get sequential game number
const getNextGameNumber = async () => {
  const counter = await Counter.findByIdAndUpdate(
    "gameNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true } // create if not exists
  );
  return counter.seq;
};

export const createGame = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const {
      selectedCards = [],
      pattern,
      betAmount = 10,
      houseFeePercentage = 15,
    } = req.body;
    if (!selectedCards || selectedCards.length === 0)
      return res
        .status(400)
        .json({ message: "Please select at least one card" });

    const cardIds = selectedCards.map((c) =>
      typeof c === "object" ? Number(c.id) : Number(c)
    );
    const cards = await Card.find({ card_number: { $in: cardIds } });
    if (cards.length !== cardIds.length)
      return res
        .status(400)
        .json({ message: "One or more selected card IDs are invalid" });

    const validPatterns = ["single_line", "double_line", "full_house"];
    if (!pattern || !validPatterns.includes(pattern))
      return res.status(400).json({ message: "Invalid pattern" });

    const gameCards = cards.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    const totalPot = parseFloat(betAmount) * gameCards.length;
    const houseFee = (totalPot * parseFloat(houseFeePercentage)) / 100;
    const potentialJackpot = gameCards.length > 0 ? parseFloat(betAmount) : 0;
    const prizePool = totalPot - houseFee - potentialJackpot;

    // Sequential game number starting from 1
    const gameNumber = await getNextGameNumber();

    const game = new Game({
      gameNumber,
      betAmount,
      houseFeePercentage,
      selectedCards: gameCards,
      pattern,
      prizePool,
      potentialJackpot,
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

export const getGame = async (req, res, next) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: "Game not found" });
    res.json({ message: "Game retrieved successfully", data: game });
  } catch (error) {
    next(error);
  }
};

export const getAllGames = async (req, res, next) => {
  try {
    const games = await Game.find();
    res.json({ message: "All games retrieved successfully", data: games });
  } catch (error) {
    next(error);
  }
};

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

export const callNumber = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { number } = req.body;
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active")
      return res.status(400).json({ message: "Game not active or not found" });

    let calledNumber;
    if (number) {
      calledNumber = parseInt(number, 10);
      if (isNaN(calledNumber) || calledNumber < 1 || calledNumber > 75)
        return res.status(400).json({ message: "Invalid number" });
      if (game.calledNumbers.includes(calledNumber))
        return res.status(400).json({ message: "Number already called" });
    } else {
      const availableNumbers = Array.from(
        { length: 75 },
        (_, i) => i + 1
      ).filter((n) => !game.calledNumbers.includes(n));
      if (!availableNumbers.length)
        return res.status(400).json({ message: "All numbers already called" });
      calledNumber =
        availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    }

    game.calledNumbers.push(calledNumber);
    game.calledNumbersLog.push({ number: calledNumber, calledAt: new Date() });
    await game.save();

    res.json({
      message: `Number ${calledNumber} called`,
      data: { game, calledNumber },
    });
  } catch (error) {
    next(error);
  }
};

export const checkBingo = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { cardId } = req.body;
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active")
      return res.status(400).json({ message: "Game not active or not found" });

    const card = game.selectedCards.find((c) => c.cardId === cardId);
    if (!card) return res.status(400).json({ message: "Invalid card ID" });

    const grid = [];
    for (let i = 0; i < 5; i++)
      grid.push(card.numbers.slice(i * 5, (i + 1) * 5));

    let isWinner = false;

    if (game.pattern === "single_line") {
      for (let i = 0; i < 5; i++)
        if (
          grid[i].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        ) {
          isWinner = true;
          break;
        }
      for (let j = 0; j < 5 && !isWinner; j++)
        if (
          [grid[0][j], grid[1][j], grid[2][j], grid[3][j], grid[4][j]].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        )
          isWinner = true;
    } else if (game.pattern === "double_line") {
      let linesMatched = 0;
      for (let i = 0; i < 5; i++)
        if (
          grid[i].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        )
          linesMatched++;
      for (let j = 0; j < 5; j++)
        if (
          [grid[0][j], grid[1][j], grid[2][j], grid[3][j], grid[4][j]].every(
            (num) => num === "FREE" || game.calledNumbers.includes(num)
          )
        )
          linesMatched++;
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

      const jackpot = await Jackpot.findOne();
      if (jackpot) {
        jackpot.amount = jackpot.seed;
        jackpot.lastUpdated = Date.now();
        await jackpot.save();
      }

      await Result.create({ gameId: game._id, winnerCardId: cardId, prize });
      return res.json({
        message: `Bingo! Card ${cardId} wins!`,
        data: { winner: true, game },
      });
    }

    res.json({
      message: `No bingo for card ${cardId}`,
      data: { winner: false, game },
    });
  } catch (error) {
    next(error);
  }
};

export const finishGame = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active")
      return res.status(400).json({ message: "Game not active or not found" });

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

export const selectWinner = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { cardId } = req.body;
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active")
      return res.status(400).json({ message: "Game not active or not found" });

    const card = game.selectedCards.find((c) => c.cardId === cardId);
    if (!card) return res.status(400).json({ message: "Invalid card ID" });

    const numbersToCall = getNumbersForPattern(card.numbers, game.pattern);
    numbersToCall.forEach((number) => {
      if (!game.calledNumbers.includes(number)) {
        game.calledNumbers.push(number);
        game.calledNumbersLog.push({ number, cardId, calledAt: new Date() });
      }
    });

    const prize = game.prizePool + game.potentialJackpot;
    game.status = "completed";
    game.winner = { cardId, prize };
    await game.save();

    const jackpot = await Jackpot.findOne();
    if (jackpot) {
      jackpot.amount = jackpot.seed;
      jackpot.lastUpdated = Date.now();
      await jackpot.save();
    }

    await Result.create({ gameId: game._id, winnerCardId: cardId, prize });
    res.json({
      message: `Card ${cardId} selected as winner!`,
      data: { winner: true, game },
    });
  } catch (error) {
    next(error);
  }
};

const getNumbersForPattern = (cardNumbers, pattern) => {
  const grid = [];
  for (let i = 0; i < 5; i++) grid.push(cardNumbers.slice(i * 5, (i + 1) * 5));
  const numbers = [];
  if (pattern === "single_line")
    numbers.push(...grid[0].filter((n) => n !== "FREE"));
  else if (pattern === "double_line")
    numbers.push(
      ...grid[0].filter((n) => n !== "FREE"),
      ...grid[1].filter((n) => n !== "FREE")
    );
  else if (pattern === "full_house")
    numbers.push(...cardNumbers.filter((n) => n !== "FREE"));
  return numbers;
};
