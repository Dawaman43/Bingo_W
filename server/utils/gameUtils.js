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
// utils/gameUtils.js
export const getMarkedGrid = (cardNumbers, calledNumbers) => {
  console.log(`[getMarkedGrid] cardNumbers:`, cardNumbers);
  console.log(`[getMarkedGrid] calledNumbers:`, calledNumbers);
  if (
    !Array.isArray(cardNumbers) ||
    cardNumbers.length !== 5 ||
    cardNumbers.some((row) => !Array.isArray(row) || row.length !== 5) ||
    !Array.isArray(calledNumbers)
  ) {
    console.error(`[getMarkedGrid] Invalid input format`);
    return Array(5)
      .fill()
      .map(() => Array(5).fill(false));
  }
  const normalizedCalled = calledNumbers.map(Number); // Ensure calledNumbers are numbers
  const marked = cardNumbers.map((row, i) =>
    row.map((cell, j) => {
      if (i === 2 && j === 2) return null; // Free space
      return normalizedCalled.includes(Number(cell));
    })
  );
  console.log(`[getMarkedGrid] Marked grid:`, marked);
  return marked;
};

export const checkCardBingo = (cardNumbers, calledNumbers, pattern) => {
  console.log(
    `[checkCardBingo] Checking pattern: ${pattern}, cardNumbers:`,
    cardNumbers,
    `calledNumbers:`,
    calledNumbers
  );

  const validPatterns = [
    "four_corners_center",
    "cross",
    "main_diagonal",
    "other_diagonal",
    "inner_corners",
    "horizontal_line",
    "vertical_line",
    "all",
  ];

  if (!pattern || !validPatterns.includes(pattern)) {
    console.error(`[checkCardBingo] Invalid or undefined pattern: ${pattern}`);
    return [false, null];
  }

  if (
    !Array.isArray(cardNumbers) ||
    cardNumbers.length !== 5 ||
    cardNumbers.some((row) => !Array.isArray(row) || row.length !== 5)
  ) {
    console.error(`[checkCardBingo] Invalid cardNumbers format`);
    return [false, null];
  }

  const marked = getMarkedGrid(cardNumbers, calledNumbers);
  console.log(`[checkCardBingo] Marked grid:`, marked);

  if (
    !Array.isArray(marked) ||
    marked.length !== 5 ||
    marked.some((row) => !Array.isArray(row) || row.length !== 5)
  ) {
    console.error(`[checkCardBingo] Invalid marked grid format`);
    return [false, null];
  }

  let isBingo = false;
  let winningPattern = pattern;

  const isFourCornersCenter =
    marked[0][0] &&
    marked[0][4] &&
    marked[4][0] &&
    marked[4][4] &&
    (marked[2][2] === null || marked[2][2]);
  const isCross =
    marked[1][1] &&
    marked[1][3] &&
    marked[3][1] &&
    marked[3][3] &&
    (marked[2][2] === null || marked[2][2]);
  const isMainDiagonal =
    marked[0][0] &&
    marked[1][1] &&
    (marked[2][2] === null || marked[2][2]) &&
    marked[3][3] &&
    marked[4][4];
  const isOtherDiagonal =
    marked[0][4] &&
    marked[1][3] &&
    (marked[2][2] === null || marked[2][2]) &&
    marked[3][1] &&
    marked[4][0];
  const isInnerCorners =
    marked[1][1] && marked[1][3] && marked[3][1] && marked[3][3];
  const isAnyHorizontal = marked.some((row) =>
    row.every((cell) => cell || cell === null)
  );
  const isAnyVertical = [0, 1, 2, 3, 4].some((col) =>
    marked.every((row) => row[col] || row[col] === null)
  );

  switch (pattern) {
    case "four_corners_center":
      isBingo = isFourCornersCenter;
      break;
    case "cross":
      isBingo = isCross;
      break;
    case "main_diagonal":
      isBingo = isMainDiagonal;
      break;
    case "other_diagonal":
      isBingo = isOtherDiagonal;
      break;
    case "inner_corners":
      isBingo = isInnerCorners;
      console.log(
        `[checkCardBingo] Inner corners check: isBingo=${isBingo}, positions=[1][1]:${marked[1][1]}, [1][3]:${marked[1][3]}, [3][1]:${marked[3][1]}, [3][3]:${marked[3][3]}`
      );
      break;
    case "horizontal_line":
      isBingo = isAnyHorizontal;
      break;
    case "vertical_line":
      isBingo = isAnyVertical;
      break;
    case "all":
      isBingo = marked.every((row, i) =>
        row.every((cell, j) => cell === true || (i === 2 && j === 2))
      );
      console.log(
        `[checkCardBingo] All pattern check: isBingo=${isBingo}, marked grid=${JSON.stringify(
          marked
        )}`
      );
      break;
    default:
      console.error(`[checkCardBingo] Unknown pattern: "${pattern}"`);
      return [false, null];
  }

  console.log(
    `[checkCardBingo] Result: isBingo=${isBingo}, winningPattern=${winningPattern}`
  );
  return [isBingo, winningPattern];
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
  calledNumbers = [],
  selectSpecificLine = false,
  targetIndices = [],
  includeMarked = false // 👈 NEW: if true, returns ALL pattern numbers (ignores calledNumbers)
) => {
  // ✅ SAFETY: Block "all" — should never reach here
  if (pattern === "all") {
    console.error(
      `[getNumbersForPattern] ❌ CRITICAL: "all" pattern passed directly. Convert to real pattern first.`
    );
    throw new Error(`"all" pattern is forbidden here. Use a real pattern.`);
  }

  console.log(
    `[getNumbersForPattern] 🟡 START — Pattern: "${pattern}", Called: [${calledNumbers.join(
      ", "
    )}], includeMarked: ${includeMarked}`
  );

  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) {
    console.warn("[getNumbersForPattern] ❌ Invalid or empty cardNumbers");
    return { numbers: [], selectedIndices: [] };
  }

  // Convert all to strings for safe comparison
  const grid = cardNumbers.map((row) =>
    Array.isArray(row) ? row.map((num) => String(num)) : []
  );

  const numbers = [];
  const selectedIndices = [];

  // 👇 Filter logic now depends on includeMarked
  const filterFn = includeMarked
    ? (n) => n !== "FREE" // Return all non-FREE numbers in pattern
    : (n) => n !== "FREE" && !calledNumbers.includes(Number(n)); // Only unmarked

  console.log(`[getNumbersForPattern] 🟦 Grid prepared:`, grid);

  switch (pattern) {
    case "four_corners_center":
      const cornersAndCenter = [
        grid[0][0], // top-left (B1)
        grid[0][4], // top-right (O1)
        grid[4][0], // bottom-left (B5)
        grid[4][4], // bottom-right (O5)
        grid[2][2], // center (N3)
      ].filter(filterFn);
      numbers.push(...cornersAndCenter);
      selectedIndices.push(0, 4, 20, 24, 12); // Indices: 0,4,20,24,12
      console.log(
        `[getNumbersForPattern] ✅ Pattern "four_corners_center" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "inner_corners":
      const innerCorners = [
        grid[1][1], // I2 (index 6)
        grid[1][3], // O2 (index 8)
        grid[3][1], // I4 (index 16)
        grid[3][3], // O4 (index 18)
      ].filter(filterFn);
      numbers.push(...innerCorners);
      selectedIndices.push(6, 8, 16, 18); // Indices for I2, O2, I4, O4
      console.log(
        `[getNumbersForPattern] ✅ Pattern "inner_corners" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "main_diagonal":
      const mainDiag = [0, 1, 2, 3, 4].map((i) => grid[i][i]).filter(filterFn);
      numbers.push(...mainDiag);
      selectedIndices.push(0, 6, 12, 18, 24); // Diagonal: B1, I2, N3, G4, O5
      console.log(
        `[getNumbersForPattern] ✅ Pattern "main_diagonal" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "other_diagonal":
      const otherDiag = [0, 1, 2, 3, 4]
        .map((i) => grid[i][4 - i])
        .filter(filterFn);
      numbers.push(...otherDiag);
      selectedIndices.push(4, 8, 12, 16, 20); // Diagonal: O1, G2, N3, I4, B5
      console.log(
        `[getNumbersForPattern] ✅ Pattern "other_diagonal" → Numbers: [${numbers.join(
          ", "
        )}], Indices: [${selectedIndices.join(", ")}]`
      );
      break;

    case "horizontal_line":
      const rows = grid;
      let selectedRow;
      if (selectSpecificLine && targetIndices.length > 0) {
        selectedRow = targetIndices[0];
        if (selectedRow >= 0 && selectedRow < 5) {
          const rowNumbers = rows[selectedRow].filter(filterFn);
          numbers.push(...rowNumbers);
          for (let j = 0; j < 5; j++) {
            if (filterFn(rows[selectedRow][j])) {
              selectedIndices.push(selectedRow * 5 + j);
            }
          }
          console.log(
            `[getNumbersForPattern] ✅ Pattern "horizontal_line" (row ${selectedRow}) → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
        } else {
          console.warn(
            `[getNumbersForPattern] ❌ Invalid row index: ${selectedRow}`
          );
        }
      } else {
        const rowUnmarked = rows.map((row) => row.filter(filterFn).length);
        const maxUnmarked = Math.max(...rowUnmarked);
        const eligibleRows = rowUnmarked
          .map((u, i) => (u === maxUnmarked ? i : -1))
          .filter((i) => i !== -1);
        selectedRow =
          eligibleRows[Math.floor(Math.random() * eligibleRows.length)];
        if (selectedRow !== undefined && selectedRow !== -1) {
          const rowNumbers = rows[selectedRow].filter(filterFn);
          numbers.push(...rowNumbers);
          for (let j = 0; j < 5; j++) {
            if (filterFn(rows[selectedRow][j])) {
              selectedIndices.push(selectedRow * 5 + j);
            }
          }
          console.log(
            `[getNumbersForPattern] ✅ Pattern "horizontal_line" (random row ${selectedRow}) → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
        } else {
          console.warn(
            "[getNumbersForPattern] ❌ No valid row found for horizontal_line"
          );
        }
      }
      break;

    case "vertical_line":
      const cols = [0, 1, 2, 3, 4];
      let selectedCol;
      if (selectSpecificLine && targetIndices.length > 0) {
        selectedCol = targetIndices[0];
        if (selectedCol >= 0 && selectedCol <= 4) {
          const colNumbers = cols
            .map((_, row) => grid[row][selectedCol])
            .filter(filterFn);
          numbers.push(...colNumbers);
          for (let i = 0; i < 5; i++) {
            if (filterFn(grid[i][selectedCol])) {
              selectedIndices.push(i * 5 + selectedCol);
            }
          }
          console.log(
            `[getNumbersForPattern] ✅ Pattern "vertical_line" (col ${selectedCol}) → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
        } else {
          console.warn(
            `[getNumbersForPattern] ❌ Invalid col index: ${selectedCol}`
          );
        }
      } else {
        const colUnmarked = cols.map(
          (col) => grid.filter((row) => filterFn(row[col])).length
        );
        const maxUnmarkedCol = Math.max(...colUnmarked);
        const eligibleCols = colUnmarked
          .map((u, i) => (u === maxUnmarkedCol ? i : -1))
          .filter((i) => i !== -1);
        selectedCol =
          eligibleCols[Math.floor(Math.random() * eligibleCols.length)];
        if (selectedCol !== undefined && selectedCol !== -1) {
          const colNumbers = cols
            .map((_, row) => grid[row][selectedCol])
            .filter(filterFn);
          numbers.push(...colNumbers);
          for (let i = 0; i < 5; i++) {
            if (filterFn(grid[i][selectedCol])) {
              selectedIndices.push(i * 5 + selectedCol);
            }
          }
          console.log(
            `[getNumbersForPattern] ✅ Pattern "vertical_line" (random col ${selectedCol}) → Numbers: [${numbers.join(
              ", "
            )}], Indices: [${selectedIndices.join(", ")}]`
          );
        } else {
          console.warn(
            "[getNumbersForPattern] ❌ No valid col found for vertical_line"
          );
        }
      }
      break;

    default:
      console.warn(
        `[getNumbersForPattern] ❌ Unknown pattern: "${pattern}" — returning empty`
      );
      return { numbers: [], selectedIndices: [] };
  }

  const result = {
    numbers: numbers.map(String),
    selectedIndices,
  };

  console.log(`[getNumbersForPattern] 🟢 END — Returning:`, result);
  return result;
};

/**
 * Get the next sequence number for a specific counter and cashier.
 * @param {String} counterType - e.g., "gameNumber" or "cardId"
 * @param {mongoose.Types.ObjectId} cashierId - The cashier's _id
 * @param {mongoose.ClientSession} session - Optional mongoose session for transactions
 * @returns {Number} - The next sequence number
 */
export const getNextSequence = async (counterName) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
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
  forcedCallSequence = [],
  forcedPattern = null,
  winnerCardNumbers = null,
  selectedWinnerNumbers = [],
  targetWinCall = null,
  forcedCallIndex = 0,
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

  console.log(
    `[createGameRecord] Creating game with selectedWinnerNumbers:`,
    selectedWinnerNumbers
  );
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
    forcedPattern,
    forcedCallSequence,
    forcedCallIndex,
    targetWinCall,
    jackpotEnabled,
    winnerCardNumbers,
    selectedWinnerNumbers,
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

/**
 * Generate a quick win sequence for Bingo
 * @param {number[]} requiredNumbers - Numbers that must appear for the winner card to win
 * @param {number} totalCalls - Total calls to finish the game (e.g., 10)
 * @param {number} maxRandomNumbers - Maximum random numbers to interleave
 * @returns {number[]} Forced sequence with random numbers
 */
export function generateQuickWinSequence(requiredNumbers, minCalls, maxCalls) {
  if (!requiredNumbers || requiredNumbers.length === 0) {
    console.warn("[generateQuickWinSequence] No required numbers provided");
    return [];
  }

  const K = requiredNumbers.length;
  // Randomly choose total calls (ensure >= K)
  const totalCalls = Math.max(
    K,
    Math.floor(Math.random() * (maxCalls - minCalls + 1)) + minCalls
  );

  console.log(
    `[generateQuickWinSequence] Generating sequence: ${K} required nums, totalCalls=${totalCalls} (min=${minCalls}, max=${maxCalls})`
  );

  // Choose completing number (random from required)
  const completingIdx = Math.floor(Math.random() * requiredNumbers.length);
  const completingNum = requiredNumbers[completingIdx];
  const otherRequired = requiredNumbers.filter(
    (_, idx) => idx !== completingIdx
  );

  // Fillers: totalCalls - K (non-required numbers)
  const numFillers = totalCalls - K;
  const allNums = Array.from({ length: 75 }, (_, i) => i + 1);
  const possibleFillers = allNums.filter((n) => !requiredNumbers.includes(n));
  const shuffledFillers = shuffle(possibleFillers).slice(0, numFillers); // Use existing shuffle util

  // Pre-sequence: shuffle otherRequired + fillers
  const preItems = [...otherRequired, ...shuffledFillers];
  shuffle(preItems);

  const sequence = [...preItems, completingNum]; // Last call completes win

  console.log(
    `[generateQuickWinSequence] Sequence ready: ${sequence.length} calls, completing num=${completingNum}, fillers=${numFillers}`
  );
  console.log(
    `[generateQuickWinSequence] Full sequence preview: ${sequence.slice(0, 5)}${
      sequence.length > 5 ? "..." : ""
    } -> ${completingNum}`
  );

  return sequence;
}

// utils/gameUtils.js - Add these functions

export const logFutureWinnerUsage = async (
  futureWinnerId,
  gameId,
  success = true
) => {
  try {
    await GameLog.create({
      gameId,
      action: "useFutureWinner",
      status: success ? "success" : "failed",
      details: {
        futureWinnerId,
        gameId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error logging future winner usage:", error);
  }
};

export const logNumberCall = async (
  gameId,
  calledNumber,
  isForced = false,
  callIndex = null
) => {
  try {
    await GameLog.create({
      gameId,
      action: "callNumber",
      status: "success",
      details: {
        calledNumber,
        isForced,
        callIndex,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error logging number call:", error);
  }
};
