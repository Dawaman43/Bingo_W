import { validationResult } from "express-validator";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import Result from "../models/Result.js";
import Card from "../models/Card.js";
import Counter from "../models/Counter.js";

// ----------------- Utils -----------------
const getNextGameNumber = async () => {
  const counter = await Counter.findByIdAndUpdate(
    "gameNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

const getNumbersForPattern = (cardNumbers, pattern) => {
  const grid = [];
  for (let i = 0; i < 5; i++) grid.push(cardNumbers.slice(i * 5, (i + 1) * 5));
  const numbers = [];

  if (pattern === "single_line") {
    // pick first line (row, column, or diagonal) that can win
    const lines = [
      ...grid, // rows
      [0, 1, 2, 3, 4].map((i) => grid[i][0]),
      [0, 1, 2, 3, 4].map((i) => grid[i][1]),
      [0, 1, 2, 3, 4].map((i) => grid[i][2]),
      [0, 1, 2, 3, 4].map((i) => grid[i][3]),
      [0, 1, 2, 3, 4].map((i) => grid[i][4]),
      [0, 1, 2, 3, 4].map((i) => grid[i][i]), // diagonal
      [0, 1, 2, 3, 4].map((i) => grid[i][4 - i]), // anti-diagonal
    ];
    const firstLine = lines.find((line) => line.some((n) => n !== "FREE"));
    numbers.push(...firstLine.filter((n) => n !== "FREE"));
  } else if (pattern === "double_line") {
    // pick first two lines
    const lines = [
      ...grid, // rows
      [0, 1, 2, 3, 4].map((i) => grid[i][0]),
      [0, 1, 2, 3, 4].map((i) => grid[i][1]),
      [0, 1, 2, 3, 4].map((i) => grid[i][2]),
      [0, 1, 2, 3, 4].map((i) => grid[i][3]),
      [0, 1, 2, 3, 4].map((i) => grid[i][4]),
      [0, 1, 2, 3, 4].map((i) => grid[i][i]), // diagonal
      [0, 1, 2, 3, 4].map((i) => grid[i][4 - i]), // anti-diagonal
    ];
    numbers.push(
      ...lines[0].filter((n) => n !== "FREE"),
      ...lines[1].filter((n) => n !== "FREE")
    );
  } else if (pattern === "full_house") {
    numbers.push(...cardNumbers.filter((n) => n !== "FREE"));
  }

  return numbers;
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
      moderatorWinnerCardId,
      jackpotEnabled = true,
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

    const gameNumber = await getNextGameNumber();

    let calledNumbers = [];
    let calledNumbersLog = [];
    if (moderatorWinnerCardId) {
      const winnerCard = gameCards.find(
        (c) => c.id === Number(moderatorWinnerCardId)
      );
      if (!winnerCard)
        return res
          .status(400)
          .json({ message: "Invalid moderator winner card ID" });

      calledNumbers = getNumbersForPattern(winnerCard.numbers, pattern);
      calledNumbersLog = calledNumbers.map((n) => ({
        number: n,
        cardId: moderatorWinnerCardId,
        calledAt: new Date(),
      }));
    }

    const game = new Game({
      gameNumber,
      betAmount,
      houseFeePercentage,
      selectedCards: gameCards,
      pattern,
      prizePool,
      potentialJackpot,
      status: moderatorWinnerCardId ? "completed" : "active",
      calledNumbers,
      calledNumbersLog,
      moderatorWinnerCardId: moderatorWinnerCardId
        ? Number(moderatorWinnerCardId)
        : null,
      jackpotEnabled,
      winner: moderatorWinnerCardId
        ? {
            cardId: Number(moderatorWinnerCardId),
            prize: prizePool + (jackpotEnabled ? potentialJackpot : 0),
          }
        : null,
    });

    await game.save();

    // --- Ensure jackpot exists ---
    if (jackpotEnabled) {
      let jackpot = await Jackpot.findOne();
      if (!jackpot) {
        jackpot = new Jackpot({
          amount: potentialJackpot,
          seed: potentialJackpot,
          lastUpdated: Date.now(),
        });
        await jackpot.save();
      } else if (moderatorWinnerCardId) {
        // reset if game completed by moderator
        jackpot.amount = jackpot.seed;
        jackpot.lastUpdated = Date.now();
        await jackpot.save();
      }
    }

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

export const callNumber = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { number } = req.body;
    const game = await Game.findById(req.params.id);
    if (!game || game.status !== "active")
      return res.status(400).json({ message: "Game not active or not found" });

    // If moderator pre-selected a winner, do not allow manual calling
    if (game.moderatorWinnerCardId)
      return res.status(400).json({
        message:
          "This game is controlled by moderator. Numbers are pre-selected.",
      });

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

const checkCardBingo = (cardNumbers, calledNumbers, pattern) => {
  const grid = [];
  for (let i = 0; i < 5; i++) grid.push(cardNumbers.slice(i * 5, (i + 1) * 5));

  const isMarked = (num) => num === "FREE" || calledNumbers.includes(num);

  const lines = [];

  // Rows
  for (let i = 0; i < 5; i++) lines.push(grid[i].every(isMarked));
  // Columns
  for (let j = 0; j < 5; j++)
    lines.push([0, 1, 2, 3, 4].every((i) => isMarked(grid[i][j])));
  // Diagonals
  lines.push([0, 1, 2, 3, 4].every((i) => isMarked(grid[i][i])));
  lines.push([0, 1, 2, 3, 4].every((i) => isMarked(grid[i][4 - i])));

  if (pattern === "single_line") {
    return lines.some(Boolean); // Any single line completed
  } else if (pattern === "double_line") {
    const completedLines = lines.filter(Boolean).length;
    return completedLines >= 2; // At least two lines
  } else if (pattern === "full_house") {
    return cardNumbers.every(isMarked); // All numbers marked
  }

  return false;
};

export const checkBingo = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { cardId } = req.body;
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(400).json({ message: "Game not found" });

    // If game is completed already, return winner info
    if (game.status === "completed") {
      const isWinner = game.winner?.cardId === Number(cardId);
      return res.json({
        message: isWinner
          ? `Bingo! Card ${cardId} wins!`
          : `No bingo for card ${cardId}`,
        data: { winner: isWinner, game },
      });
    }

    // Normal bingo checking for active games
    if (game.status !== "active")
      return res.status(400).json({ message: "Game not active" });

    const card = game.selectedCards.find((c) => c.id === Number(cardId));
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
      const prize =
        game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0);
      game.status = "completed";
      game.winner = { cardId, prize };
      await game.save();

      if (game.jackpotEnabled) {
        const jackpot = await Jackpot.findOne();
        if (jackpot) {
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

    const card = game.selectedCards.find((c) => c.id === cardId);
    if (!card) return res.status(400).json({ message: "Invalid card ID" });

    // Get numbers to call for the chosen pattern
    const numbersToCall = getNumbersForPattern(card.numbers, game.pattern);

    // Call only numbers needed for this card
    numbersToCall.forEach((n) => {
      if (!game.calledNumbers.includes(n)) {
        game.calledNumbers.push(n);
        game.calledNumbersLog.push({ number: n, cardId, calledAt: new Date() });
      }
    });

    const prize =
      game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0);
    game.status = "completed";
    game.winner = { cardId, prize };
    await game.save();

    // Reset jackpot if enabled
    if (game.jackpotEnabled) {
      const jackpot = await Jackpot.findOne();
      if (jackpot) {
        jackpot.amount = jackpot.seed;
        jackpot.lastUpdated = Date.now();
        await jackpot.save();
      }
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

export const updateGame = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const {
      calledNumbers,
      calledNumbersLog,
      moderatorWinnerCardId,
      jackpotEnabled,
    } = req.body;
    const updateData = {};
    if (calledNumbers) updateData.calledNumbers = calledNumbers;
    if (calledNumbersLog) updateData.calledNumbersLog = calledNumbersLog;
    if (moderatorWinnerCardId !== undefined)
      updateData.moderatorWinnerCardId = moderatorWinnerCardId;
    if (jackpotEnabled !== undefined)
      updateData.jackpotEnabled = jackpotEnabled;

    const game = await Game.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!game) return res.status(404).json({ message: "Game not found" });

    res.json({ message: "Game updated successfully", data: game });
  } catch (error) {
    next(error);
  }
};

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
