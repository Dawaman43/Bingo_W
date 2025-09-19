import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Game from "../models/Game.js";
import Jackpot from "../models/Jackpot.js";
import Result from "../models/Result.js";
import Card from "../models/Card.js";
import Counter from "../models/Counter.js";
import JackpotLog from "../models/JackpotLog.js";
import GameLog from "../models/GameLog.js";
import JackpotCandidate from "../models/JackpotCandidate.js";
import User from "../models/User.js";

// --- Helper Functions ---

/**
 * Creates a marked grid for the card based on called numbers.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @returns {Array<Array<boolean>>} 5x5 grid of marked statuses
 */
export const getMarkedGrid = (cardNumbers, calledNumbers) => {
  return cardNumbers.map((row) =>
    row.map((num) => num === "FREE" || calledNumbers.includes(Number(num)))
  );
};

/**
 * Checks if a card has bingo based on the pattern.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @param {string} pattern - Pattern type
 * @returns {{ isBingo: boolean, completedLines: number, lineProgress: number[] }}
 */
export const checkCardBingo = (cardNumbers, calledNumbers, pattern) => {
  const marked = getMarkedGrid(cardNumbers, calledNumbers);
  let isBingo = false;
  let completedLines = 0;
  const lineProgress = [];

  // Helper checks
  const isFourCornersCenter =
    marked[0][0] &&
    marked[0][4] &&
    marked[4][0] &&
    marked[4][4] &&
    marked[2][2];
  const isCross =
    marked[1][1] &&
    marked[1][3] &&
    marked[3][1] &&
    marked[3][3] &&
    marked[2][2];
  const isMainDiagonal =
    marked[0][0] &&
    marked[1][1] &&
    marked[2][2] &&
    marked[3][3] &&
    marked[4][4];
  const isOtherDiagonal =
    marked[0][4] &&
    marked[1][3] &&
    marked[2][2] &&
    marked[3][1] &&
    marked[4][0];
  const isAnyHorizontal = marked.some((row) => row.every((cell) => cell));
  const isAnyVertical = [0, 1, 2, 3, 4].some((col) =>
    marked.every((row) => row[col])
  );
  const isAnyDiagonal = isMainDiagonal || isOtherDiagonal;

  switch (pattern) {
    case "four_corners_center":
      isBingo = isFourCornersCenter;
      completedLines = isBingo ? 1 : 0;
      break;
    case "cross":
      isBingo = isCross;
      completedLines = isBingo ? 1 : 0;
      break;
    case "main_diagonal":
      isBingo = isMainDiagonal;
      completedLines = isBingo ? 1 : 0;
      break;
    case "other_diagonal":
      isBingo = isOtherDiagonal;
      completedLines = isBingo ? 1 : 0;
      break;
    case "horizontal_line":
      isBingo = isAnyHorizontal;
      completedLines = marked.filter((row) => row.every((cell) => cell)).length;
      break;
    case "vertical_line":
      isBingo = isAnyVertical;
      completedLines = [0, 1, 2, 3, 4].filter((col) =>
        marked.every((row) => row[col])
      ).length;
      break;
    case "all":
      isBingo =
        isFourCornersCenter ||
        isCross ||
        isMainDiagonal ||
        isOtherDiagonal ||
        isAnyHorizontal ||
        isAnyVertical;
      completedLines =
        (isFourCornersCenter ? 1 : 0) +
        (isCross ? 1 : 0) +
        (isMainDiagonal ? 1 : 0) +
        (isOtherDiagonal ? 1 : 0) +
        (isAnyHorizontal ? 1 : 0) +
        (isAnyVertical ? 1 : 0);
      break;
    default:
      // Backward compatibility for old patterns
      if (pattern === "line") isBingo = isAnyHorizontal;
      if (pattern === "diagonal") isBingo = isAnyDiagonal;
      if (pattern === "x_pattern") isBingo = isMainDiagonal && isOtherDiagonal;
      completedLines = isBingo ? 1 : 0;
  }

  return { isBingo, completedLines, lineProgress };
};

/**
 * Extracts numbers from a card based on the specified pattern, prioritizing specific lines when requested.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {string} pattern - Pattern type
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @param {boolean} selectSpecificLine - Whether to select numbers from specific lines
 * @param {number[]} [targetIndices] - Specific line indices to target
 * @returns {{ numbers: string[], selectedIndices: number[] }} Array of numbers for the pattern and selected line indices
 */
export const getNumbersForPattern = (
  cardNumbers,
  pattern,
  calledNumbers,
  selectSpecificLine = false,
  targetIndices = []
) => {
  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) {
    return { numbers: [], selectedIndices: [] };
  }

  const grid = cardNumbers.map((row) =>
    Array.isArray(row) ? row.map((num) => num.toString()) : []
  );

  const numbers = [];
  let selectedIndices = [];

  const unmarkedFilter = (n) =>
    n !== "FREE" && !calledNumbers.includes(Number(n));

  switch (pattern) {
    case "four_corners_center":
      numbers.push(
        ...[grid[0][0], grid[0][4], grid[4][0], grid[4][4], grid[2][2]].filter(
          unmarkedFilter
        )
      );
      selectedIndices = [0];
      break;
    case "cross":
      numbers.push(
        ...[grid[1][1], grid[1][3], grid[3][1], grid[3][3], grid[2][2]].filter(
          unmarkedFilter
        )
      );
      selectedIndices = [0];
      break;
    case "main_diagonal":
      numbers.push(
        ...[0, 1, 2, 3, 4].map((i) => grid[i][i]).filter(unmarkedFilter)
      );
      selectedIndices = [10];
      break;
    case "other_diagonal":
      numbers.push(
        ...[0, 1, 2, 3, 4].map((i) => grid[i][4 - i]).filter(unmarkedFilter)
      );
      selectedIndices = [11];
      break;
    case "horizontal_line":
      const rows = grid;
      if (selectSpecificLine && targetIndices.length > 0) {
        const rowIndex = targetIndices[0];
        if (rows[rowIndex]) {
          numbers.push(...rows[rowIndex].filter(unmarkedFilter));
          selectedIndices = [rowIndex];
        }
      } else {
        const rowUnmarked = rows.map(
          (row) => row.filter(unmarkedFilter).length
        );
        const maxUnmarked = Math.max(...rowUnmarked);
        const eligibleRows = rowUnmarked
          .map((u, i) => (u === maxUnmarked ? i : null))
          .filter((i) => i !== null);
        const bestRow =
          eligibleRows[Math.floor(Math.random() * eligibleRows.length)];
        numbers.push(...rows[bestRow].filter(unmarkedFilter));
        selectedIndices = [bestRow];
      }
      break;
    case "vertical_line":
      if (selectSpecificLine && targetIndices.length > 0) {
        const colIndex = targetIndices[0];
        numbers.push(
          ...[0, 1, 2, 3, 4]
            .map((i) => grid[i][colIndex])
            .filter(unmarkedFilter)
        );
        selectedIndices = [colIndex + 5];
      } else {
        const colUnmarked = [0, 1, 2, 3, 4].map(
          (col) =>
            [0, 1, 2, 3, 4].filter((i) => unmarkedFilter(grid[i][col])).length
        );
        const maxUnmarked = Math.max(...colUnmarked);
        const eligibleCols = colUnmarked
          .map((u, j) => (u === maxUnmarked ? j : null))
          .filter((j) => j !== null);
        const bestCol =
          eligibleCols[Math.floor(Math.random() * eligibleCols.length)];
        numbers.push(
          ...[0, 1, 2, 3, 4].map((i) => grid[i][bestCol]).filter(unmarkedFilter)
        );
        selectedIndices = [bestCol + 5];
      }
      break;
    case "all":
      const patternChoices = [
        "four_corners_center",
        "cross",
        "main_diagonal",
        "other_diagonal",
        "horizontal_line",
        "vertical_line",
      ];
      const selectedPattern =
        patternChoices[Math.floor(Math.random() * patternChoices.length)];
      const patternResult = getNumbersForPattern(
        cardNumbers,
        selectedPattern,
        calledNumbers,
        selectSpecificLine,
        targetIndices
      );
      numbers.push(...patternResult.numbers);
      selectedIndices = patternResult.selectedIndices;
      break;
    default:
      if (pattern === "line")
        return getNumbersForPattern(
          cardNumbers,
          "horizontal_line",
          calledNumbers,
          selectSpecificLine,
          targetIndices
        );
      if (pattern === "diagonal" || pattern === "x_pattern") {
        const diags = [
          [0, 1, 2, 3, 4].map((i) => grid[i][i]),
          [0, 1, 2, 3, 4].map((i) => grid[i][4 - i]),
        ];
        numbers.push(...diags.flat().filter(unmarkedFilter));
        selectedIndices = pattern === "x_pattern" ? [10, 11] : [10];
      }
  }

  return { numbers: [...new Set(numbers)], selectedIndices };
};

/**
 * Get the next sequence number for a specific counter and cashier.
 * @param {String} counterType - e.g., "gameNumber" or "cardId"
 * @param {mongoose.Types.ObjectId} cashierId - The cashier's _id
 * @param {mongoose.ClientSession} session - Optional mongoose session for transactions
 * @returns {Number} - The next sequence number
 */
export const getNextSequence = async (
  counterType,
  cashierId,
  session = null
) => {
  const counterId = `${counterType}_${cashierId.toString()}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId, cashierId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  return counter.seq;
};

/**
 * Gets the next game number atomically, ensuring no gaps by checking existing games.
 * @param {number} [startFromGameNumber] - Optional starting game number
 * @returns {Promise<number>} The next game number
 */
export const getNextGameNumber = async (startFromGameNumber = null) => {
  console.log("[getNextGameNumber] Starting game number assignment");
  console.log(
    "[getNextGameNumber] Requested startFromGameNumber:",
    startFromGameNumber
  );

  const allGames = await Game.find().sort({ gameNumber: 1 }).lean();
  const existingNumbers = new Set(allGames.map((g) => g.gameNumber));

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
    return startFromGameNumber;
  }

  let nextNumber = 1;
  while (existingNumbers.has(nextNumber)) {
    nextNumber++;
  }

  await Counter.findOneAndUpdate(
    { _id: "gameNumber" },
    { seq: nextNumber },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return nextNumber;
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
  return counter.seq;
};

const getRandomNumber = (calledNumbers, exclude = []) => {
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !calledNumbers.includes(n) && !exclude.includes(n)
  );
  if (availableNumbers.length === 0) return null;
  return availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
};

/**
 * Creates a mixed sequence of forced and random numbers
 * @param {number[]} forcedNums - Numbers needed for the winner card to win
 * @param {number[]} calledNumbers - Already called numbers
 * @returns {number[]} A mixed sequence with forced numbers distributed naturally
 */
export const createMixedCallSequence = (forcedNums, calledNumbers) => {
  const shuffledForced = [...forcedNums].sort(() => Math.random() - 0.5);
  const numForced = shuffledForced.length;
  const totalCalls = Math.max(numForced, Math.floor(Math.random() * 6) + 20);
  const numRandom = totalCalls - numForced;
  const randomNums = [];

  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !calledNumbers.includes(n) && !shuffledForced.includes(n)
  );
  while (randomNums.length < numRandom && availableNumbers.length > 0) {
    const randIndex = Math.floor(Math.random() * availableNumbers.length);
    randomNums.push(availableNumbers.splice(randIndex, 1)[0]);
  }

  const sequence = new Array(totalCalls).fill(null);
  const forcedPositions = [];
  while (forcedPositions.length < numForced - 1) {
    const pos = Math.floor(Math.random() * (totalCalls - 1));
    if (!forcedPositions.includes(pos)) forcedPositions.push(pos);
  }
  forcedPositions.push(totalCalls - 1);

  forcedPositions.forEach((pos, idx) => {
    sequence[pos] = Number(shuffledForced[idx]);
  });

  let randomIndex = 0;
  for (let i = 0; i < totalCalls; i++) {
    if (sequence[i] === null && randomIndex < randomNums.length) {
      sequence[i] = randomNums[randomIndex++];
    }
  }

  return sequence
    .filter((num) => num !== null)
    .filter((num, index, self) => self.indexOf(num) === index);
};

/**
 * Check bingo for a specific card in a game
 */
export const checkBingoForGame = (game, cardId) => {
  const numericCardId = Number(cardId);
  const card = game.selectedCards.find((c) => c.id === numericCardId);
  if (!card) return { hasBingo: false, winnerCards: [], winnerPattern: null };

  const { isBingo } = checkCardBingo(
    card.numbers,
    game.calledNumbers,
    game.pattern
  );
  return {
    hasBingo: isBingo,
    winnerCards: isBingo ? [numericCardId] : [],
    winnerPattern: isBingo ? game.pattern : null,
  };
};

/**
 * Logs a jackpot update.
 */
export const logJackpotUpdate = async (amount, reason, gameId = null) => {
  await JackpotLog.create({
    amount,
    reason,
    gameId,
    timestamp: new Date(),
  });
};

/**
 * Creates a new game record with provided configuration.
 */
export const createGameRecord = async ({
  gameNumber,
  cashierId,
  betAmount,
  houseFeePercentage,
  selectedCards,
  pattern,
  prizePool,
  potentialJackpot,
  moderatorWinnerCardId,
  selectedWinnerRowIndices = [],
  jackpotEnabled = true,
}) => {
  if (
    !selectedCards ||
    !Array.isArray(selectedCards) ||
    selectedCards.length === 0
  ) {
    throw new Error("Game cards must be a non-empty array");
  }

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
    throw new Error("Invalid pattern type");
  }

  if (!mongoose.isValidObjectId(cashierId)) {
    throw new Error("Invalid cashier ID");
  }

  const houseFee =
    betAmount * (houseFeePercentage / 100) * selectedCards.length;

  const game = new Game({
    gameNumber,
    cashierId,
    betAmount,
    houseFeePercentage,
    houseFee,
    selectedCards,
    pattern,
    prizePool,
    potentialJackpot,
    status: "pending",
    calledNumbers: [],
    calledNumbersLog: [],
    moderatorWinnerCardId,
    selectedWinnerRowIndices,
    jackpotEnabled,
    winner: null,
  });

  await game.save();

  await GameLog.create({
    gameId: game._id,
    action: "createGameRecord",
    status: "success",
    details: {
      gameNumber: game.gameNumber,
      pattern,
      selectedCardIds: selectedCards.map((card) => card.id),
      jackpotEnabled: game.jackpotEnabled,
    },
  });

  if (moderatorWinnerCardId) {
    await Counter.deleteOne({
      _id: `futureWinning_${gameNumber}_${cashierId}`,
    });
  }

  return game;
};

/**
 * Validates user authorization and returns cashierId
 */
export const getCashierIdFromUser = (req, res, next) => {
  const user = req.user;

  if (!user || !user.id) {
    return res.status(401).json({ message: "Unauthorized. User ID missing." });
  }

  let cashierId;
  if (user.role === "moderator") {
    cashierId = user.managedCashier;
    if (!cashierId) {
      return res.status(403).json({
        message: "No managed cashier assigned to this moderator",
      });
    }
  } else if (user.role === "cashier") {
    cashierId = user.id;
  } else {
    return res.status(403).json({ message: "Unauthorized role" });
  }

  req.cashierId = cashierId;
  next();
};

export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const computeForcedSequence = (
  requiredNumbers,
  minCalls = 10,
  maxCalls = 15
) => {
  if (!requiredNumbers || requiredNumbers.length === 0) return [];
  const K = requiredNumbers.length;
  // Randomly choose number of calls between minCalls and maxCalls
  let winCall =
    Math.floor(Math.random() * (maxCalls - minCalls + 1)) + minCalls;
  if (winCall < K) winCall = K; // Ensure at least K calls
  const shuffledReq = shuffle(requiredNumbers);
  const lastReq = shuffledReq.pop(); // Last required number
  const firstReq = shuffledReq; // K-1 required numbers
  const numFillers = winCall - K; // Number of filler numbers
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1);
  const possibleFillers = allNums.filter((n) => !requiredNumbers.includes(n));
  const fillers = shuffle(possibleFillers).slice(0, numFillers);
  const preItems = [...firstReq, ...fillers];
  shuffle(preItems);
  return [...preItems, lastReq]; // Last call ensures win
};
