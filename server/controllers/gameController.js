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
 * Creates a marked grid for the card based on called numbers.
 * @param {Array<Array<number|string>>} cardNumbers - 5x5 nested array of card numbers
 * @param {Array<number>} calledNumbers - Array of numbers already called
 * @returns {Array<Array<boolean>>} 5x5 grid of marked statuses
 */
const getMarkedGrid = (cardNumbers, calledNumbers) => {
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
  const lineProgress = []; // Can expand if needed

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
const getNumbersForPattern = (
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
      selectedIndices = [0]; // Arbitrary, since not line-based
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
      selectedIndices = [10]; // Diagonal index
      break;
    case "other_diagonal":
      numbers.push(
        ...[0, 1, 2, 3, 4].map((i) => grid[i][4 - i]).filter(unmarkedFilter)
      );
      selectedIndices = [11];
      break;
    case "horizontal_line":
      // Similar to old "line"
      const rows = grid;
      if (selectSpecificLine && targetIndices.length > 0) {
        const rowIndex = targetIndices[0];
        if (rows[rowIndex]) {
          numbers.push(...rows[rowIndex].filter(unmarkedFilter));
          selectedIndices = [rowIndex];
        }
      } else {
        // Choose row with max unmarked
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
        selectedIndices = [colIndex + 5]; // Column indices 5-9
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
      // For pattern "all", select a random valid pattern (excluding "all") and get its numbers
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
      // Backward compatibility for old patterns
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

  return { numbers: [...new Set(numbers)], selectedIndices }; // Unique numbers
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

const getRandomNumber = (calledNumbers, exclude = []) => {
  const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1).filter(
    (n) => !calledNumbers.includes(n) && !exclude.includes(n)
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
      pattern = "horizontal_line",
      betAmount = 10,
      houseFeePercentage = 15,
      moderatorWinnerCardId = null,
      jackpotEnabled = true,
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
      console.log(`[createGame] Invalid pattern: ${pattern}`);
      return res.status(400).json({
        message: "Invalid pattern type",
        errorCode: "INVALID_PATTERN",
      });
    }

    // Validate selectedCards
    if (!Array.isArray(selectedCards) || selectedCards.length === 0) {
      console.log("[createGame] Invalid card selection");
      return res.status(400).json({
        message: "Game must have at least one card",
        errorCode: "INVALID_CARDS",
      });
    }

    // Validate card data from database
    const foundCardIds = selectedCards.map((card) => card.id);
    const cardsFromDB = await Card.find({
      card_number: { $in: foundCardIds },
    }).lean();
    if (cardsFromDB.length !== foundCardIds.length) {
      console.log(
        "[createGame] Some cards not found in database:",
        foundCardIds
      );
      return res.status(400).json({
        message: "Some cards not found in database",
        errorCode: "CARDS_NOT_FOUND",
      });
    }

    // Validate numbers field for each card
    for (const card of cardsFromDB) {
      if (
        !Array.isArray(card.numbers) ||
        card.numbers.length !== 5 ||
        card.numbers.some((row) => !Array.isArray(row) || row.length !== 5)
      ) {
        console.log(
          `[createGame] Invalid numbers for card ${card.card_number}`
        );
        return res.status(400).json({
          message: `Invalid numbers for card ${card.card_number}`,
          errorCode: "INVALID_CARD_NUMBERS",
        });
      }
    }

    // Map cards to include numbers
    const validatedCards = cardsFromDB.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    const assignedGameNumber = await getNextGameNumber();

    // Rest of the createGame logic remains unchanged
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
              : jackpotEnabled;

          console.log(
            `[createGame] Assigned predefined winner for game #${assignedGameNumber}: card ${winnerCardId}, jackpotEnabled: ${finalJackpotEnabled}`
          );
        }
      }
    }

    let selectedWinnerRowIndices = [];
    let forcedPattern = null;

    if (winnerCardId) {
      const winnerCard = validatedCards.find(
        (card) => card.id === winnerCardId
      );
      if (winnerCard) {
        let usePattern = pattern;

        if (pattern === "all") {
          const patternChoices = validPatterns.filter((p) => p !== "all");
          usePattern =
            patternChoices[Math.floor(Math.random() * patternChoices.length)];
          forcedPattern = usePattern;

          console.log(
            `[createGame] Selected random pattern for "all": ${usePattern}`
          );
        }

        const { selectedIndices } = getNumbersForPattern(
          winnerCard.numbers,
          usePattern,
          [],
          true
        );

        selectedWinnerRowIndices = selectedIndices;
      }
    }

    const totalPot = betAmount * validatedCards.length;
    const houseFee = (totalPot * houseFeePercentage) / 100;
    const potentialJackpot = finalJackpotEnabled ? totalPot * 0.1 : 0;
    const prizePool = totalPot - houseFee - potentialJackpot;

    const game = new Game({
      gameNumber: assignedGameNumber,
      betAmount,
      houseFeePercentage,
      houseFee,
      selectedCards: validatedCards,
      pattern,
      prizePool,
      potentialJackpot: finalJackpotEnabled ? totalPot * 0.1 : 0,
      status: "pending",
      calledNumbers: [],
      calledNumbersLog: [],
      forcedCallSequence: [],
      moderatorWinnerCardId: winnerCardId,
      selectedWinnerRowIndices,
      forcedPattern,
      jackpotEnabled: finalJackpotEnabled,
      winner: null,
    });

    const savedGame = await game.save();

    console.log(
      `[createGame] Game created: ID=${savedGame._id}, Number=${savedGame.gameNumber}, ` +
        `WinnerCardId=${winnerCardId}, ForcedPattern=${forcedPattern}, ` +
        `JackpotEnabled=${savedGame.jackpotEnabled}`
    );

    if (winnerCardId && moderatorWinnerCardId === null) {
      await Counter.deleteOne({ _id: `futureWinning_${assignedGameNumber}` });
      console.log(
        `[createGame] Cleaned up future winner entry for game #${assignedGameNumber}`
      );
    }

    await GameLog.create({
      gameId: savedGame._id,
      action: "createGame",
      status: "success",
      details: {
        gameNumber: savedGame.gameNumber,
        pattern,
        selectedCardIds: validatedCards.map((card) => card.id),
        jackpotEnabled: savedGame.jackpotEnabled,
        forcedPattern: forcedPattern,
      },
    });

    res.status(201).json({
      message: "Game created successfully",
      data: savedGame,
    });
  } catch (error) {
    console.error("[createGame] Error creating game:", error);
    if (!(error.name === "ValidationError")) {
      await GameLog.create({
        gameId: null,
        action: "createGame",
        status: "failed",
        details: { error: error.message || "Internal server error" },
      });
    }
    next(error);
  }
};

/**
 * Calls a single number for a bingo game.
 * Forced numbers are called in a natural mixed sequence with random numbers.
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
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const game = await Game.findById(gameId);

    if (!game) {
      console.log(`[${now()}] [callNumber] Game not found: ${gameId}`);
      return res.status(404).json({
        message: "Game not found",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    if (game.status !== "active") {
      console.log(`[${now()}] [callNumber] Game not active: ${game.status}`);
      return res.status(400).json({
        message: "Game is not active",
        errorCode: "GAME_NOT_ACTIVE",
      });
    }

    let calledNumber = null;
    let isForcedCall = false;

    // --- Forced winner numbers with natural mixing ---
    if (game.moderatorWinnerCardId) {
      const winnerCard = game.selectedCards.find(
        (c) => c.id === game.moderatorWinnerCardId
      );

      if (winnerCard && Array.isArray(winnerCard.numbers)) {
        // CRITICAL FIX: Only initialize sequence ONCE per game
        if (
          !Array.isArray(game.forcedCallSequence) ||
          game.forcedCallSequence.length === 0
        ) {
          // Use consistent pattern throughout the game
          let usePattern = game.forcedPattern || game.pattern;

          // If pattern is "all" but no forcedPattern was set, select and save a specific pattern
          if (game.pattern === "all" && !game.forcedPattern) {
            const validPatterns = [
              "four_corners_center",
              "cross",
              "main_diagonal",
              "other_diagonal",
              "horizontal_line",
              "vertical_line",
            ];
            usePattern =
              validPatterns[Math.floor(Math.random() * validPatterns.length)];
            game.forcedPattern = usePattern;

            // Save the chosen pattern immediately
            await game.save();
          }

          const { numbers: forcedNums } = getNumbersForPattern(
            winnerCard.numbers,
            usePattern,
            game.calledNumbers,
            true,
            game.selectedWinnerRowIndices.length
              ? game.selectedWinnerRowIndices
              : undefined
          );

          // Handle empty forced numbers case
          if (Array.isArray(forcedNums) && forcedNums.length > 0) {
            // Create a proper mixed sequence (forced + random numbers)
            const sequence = createMixedCallSequence(
              forcedNums,
              game.calledNumbers
            );

            game.forcedCallSequence = sequence;

            // Ensure winner row indices are set
            if (
              !game.selectedWinnerRowIndices ||
              game.selectedWinnerRowIndices.length === 0
            ) {
              const { selectedIndices } = getNumbersForPattern(
                winnerCard.numbers,
                usePattern,
                game.calledNumbers,
                true
              );
              game.selectedWinnerRowIndices = selectedIndices;
            }

            console.log(
              `[${now()}] [callNumber] Forced sequence initialized for pattern ${usePattern}: ${game.forcedCallSequence.join(
                ", "
              )}`
            );

            // Save the game with the new sequence
            await game.save();
          }
        }

        // Only call from sequence if it exists and has numbers
        if (
          Array.isArray(game.forcedCallSequence) &&
          game.forcedCallSequence.length > 0
        ) {
          calledNumber = game.forcedCallSequence.shift();
          isForcedCall = true;
          console.log(
            `[${now()}] [callNumber] Called from sequence: ${calledNumber}`
          );

          // Save the updated sequence after shifting
          await game.save();
        }
      }
    }

    // --- Random number fallback ---
    if (calledNumber === null) {
      const randomNumber = getRandomNumber(game.calledNumbers);
      if (randomNumber === null) {
        console.log(`[${now()}] [callNumber] No uncalled numbers left.`);
        return res.status(400).json({
          message: "No uncalled numbers available",
          errorCode: "NO_NUMBERS_LEFT",
        });
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
        // If moderator winner is set, only that card can win
        if (
          game.moderatorWinnerCardId &&
          winnerCard.id !== game.moderatorWinnerCardId
        ) {
          console.log(
            `[${now()}] [callNumber] Card ${
              winnerCard.id
            } has bingo but is not the designated winner.`
          );
        } else {
          game.winner = {
            cardId: winnerCard.id,
            prize:
              game.prizePool +
              (game.jackpotEnabled ? game.potentialJackpot : 0),
          };
          game.status = "completed";
          console.log(
            `[${now()}] [callNumber] Winner found! CardId=${
              winnerCard.id
            }, Prize=${game.winner.prize}`
          );
        }
      }
    }

    await game.save(); // Final save of game state
    res.json({
      message: `Number ${calledNumber} called`,
      data: {
        game,
        calledNumber,
        isForcedCall,
        patternUsed: game.forcedPattern || game.pattern,
      },
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [callNumber] Error:`, error);
    next(error);
  }
};

/**
 * Helper function to create a mixed sequence of forced and random numbers
 * @param {number[]} forcedNums - The numbers needed for the winner card to win
 * @param {number[]} calledNumbers - Already called numbers
 * @returns {number[]} A mixed sequence with forced numbers distributed naturally
 */
function createMixedCallSequence(forcedNums, calledNumbers) {
  const shuffledForced = [...forcedNums].sort(() => Math.random() - 0.5);
  const numForced = shuffledForced.length;

  // Total calls should be between 20-25, but at least numForced + 1
  const totalCalls = Math.max(
    numForced + 1,
    Math.floor(Math.random() * 6) + 20 // 20-25
  );

  const numRandom = totalCalls - numForced;
  const randomNums = [];

  // Generate unique random numbers
  while (randomNums.length < numRandom) {
    const rand = getRandomNumber(calledNumbers, [
      ...shuffledForced,
      ...randomNums,
    ]);
    if (rand !== null && !randomNums.includes(rand)) {
      randomNums.push(rand);
    } else {
      break;
    }
  }

  // Create sequence with forced numbers distributed throughout
  const sequence = new Array(totalCalls).fill(null);

  // Place forced numbers (ensuring last number is forced to trigger win)
  const forcedPositions = [];
  while (forcedPositions.length < numForced - 1) {
    const pos = Math.floor(Math.random() * (totalCalls - 1));
    if (!forcedPositions.includes(pos)) forcedPositions.push(pos);
  }
  forcedPositions.push(totalCalls - 1); // Last position must be forced

  // Fill sequence
  forcedPositions.forEach((pos, idx) => {
    sequence[pos] = Number(shuffledForced[idx]);
  });

  // Fill remaining positions with random numbers
  let randomIndex = 0;
  for (let i = 0; i < totalCalls; i++) {
    if (sequence[i] === null && randomIndex < randomNums.length) {
      sequence[i] = randomNums[randomIndex++];
    }
  }

  // Filter out any null values and ensure uniqueness
  return sequence
    .filter((num) => num !== null)
    .filter((num, index, self) => self.indexOf(num) === index);
}

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

    if (game.status !== "active" && game.status !== "paused") {
      console.log("[finishGame] Game not active or paused:", game.status);
      await GameLog.create({
        gameId,
        action: "finishGame",
        status: "failed",
        details: { error: "Game not active or paused", status: game.status },
      });
      return res.status(400).json({
        message: "Game is not active or paused",
        errorCode: "GAME_NOT_ACTIVE_OR_PAUSED",
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
      pattern = "horizontal_line",
      betAmount = 10,
      houseFeePercentage = 15,
      jackpotEnabled = true,
      selectedCards = [],
      moderatorWinnerCardIds = [],
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

      // Determine selectedWinnerRowIndices and forcedPattern for the game
      let selectedWinnerRowIndices = [];
      let forcedPattern = null;
      if (moderatorWinnerCardId) {
        const winnerCard = gameCards.find(
          (card) => card.id === moderatorWinnerCardId
        );
        if (winnerCard) {
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
        houseFee,
        selectedCards: gameCards,
        prizePool,
        potentialJackpot: finalJackpotEnabled ? totalPot * 0.1 : 0,
        jackpotEnabled: finalJackpotEnabled,
        status: "pending",
        calledNumbers: [],
        calledNumbersLog: [],
        moderatorWinnerCardId,
        selectedWinnerRowIndices,
        forcedPattern,
        winner: null,
      });

      await game.save();
      console.log(
        `[createSequentialGames] Saved game #${gameNumber} with ID: ${game._id}, JackpotEnabled: ${game.jackpotEnabled}`
      );

      // Create GameLog entry
      await GameLog.create({
        gameId: game._id,
        action: "createGame",
        status: "success",
        details: {
          gameNumber: game.gameNumber,
          pattern,
          selectedCardIds: gameCards.map((card) => card.id),
          jackpotEnabled: game.jackpotEnabled,
        },
      });

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
    // Only log GameLog for non-validation errors
    if (!(error.name === "ValidationError")) {
      await GameLog.create({
        gameId: null,
        action: "createSequentialGames",
        status: "failed",
        details: { error: error.message || "Internal server error" },
      });
    }
    next(error);
  }
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
        message: "The provided card is not in the game",
        errorCode: "INVALID_CARD_ID",
      });
    }

    if (
      !Array.isArray(card.numbers) ||
      card.numbers.length !== 5 ||
      card.numbers.some((row) => !Array.isArray(row) || row.length !== 5)
    ) {
      console.log(
        `[checkBingo] Invalid card numbers for cardId: ${numericCardId}`,
        card.numbers
      );
      return res.status(400).json({
        message: `Invalid card numbers for card ${numericCardId}`,
        errorCode: "INVALID_CARD_NUMBERS",
      });
    }

    // For completed games, only allow the designated winner
    if (game.status === "completed") {
      if (
        (game.winner?.cardId && game.winner.cardId === numericCardId) ||
        (game.moderatorWinnerCardId &&
          game.moderatorWinnerCardId === numericCardId) ||
        (game.jackpotWinner?.cardId &&
          game.jackpotWinner.cardId === numericCardId)
      ) {
        const markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);
        console.log(
          `[checkBingo] Winner confirmed for completed game #${game.gameNumber}: Card ${numericCardId}`
        );
        return res.json({
          message: `Bingo! Card ${numericCardId} wins!`,
          data: {
            winner: true,
            prize: game.winner?.prize || game.jackpotWinner?.prize,
            game,
            winnerCardId: numericCardId,
            isYourCardWinner: true,
            winnerCardNumbers: card.numbers,
            markedGrid,
          },
        });
      } else {
        const markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);
        console.log(
          `[checkBingo] Card ${numericCardId} is not the winner for completed game #${game.gameNumber}`
        );
        return res.json({
          message: `Card ${numericCardId} is not the winner`,
          data: {
            winner: false,
            game,
            winnerCardId:
              game.winner?.cardId ||
              game.moderatorWinnerCardId ||
              game.jackpotWinner?.cardId ||
              null,
            isYourCardWinner: false,
            winnerCardNumbers: card.numbers,
            markedGrid,
          },
        });
      }
    }

    // Allow check for active or paused
    if (!["active", "paused"].includes(game.status)) {
      console.log("[checkBingo] Game not checkable:", game.status);
      return res.status(400).json({
        message: `Game is ${game.status}, cannot check bingo`,
        errorCode: "GAME_NOT_CHECKABLE",
      });
    }

    const { isBingo } = checkCardBingo(
      card.numbers,
      game.calledNumbers,
      game.pattern
    );
    let winner = null;

    if (isBingo) {
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
          const markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);
          return res.json({
            message: `Card ${numericCardId} is not the designated winner`,
            data: {
              winner: false,
              game,
              winnerCardId: game.moderatorWinnerCardId,
              isYourCardWinner: false,
              winnerCardNumbers: card.numbers,
              markedGrid,
            },
          });
        }
      } else {
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

    const markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);
    return res.json({
      message: winner
        ? `Bingo! Card ${numericCardId} wins!`
        : `No bingo yet for card ${numericCardId}`,
      data: {
        winner: !!winner,
        prize: winner ? winner.prize : null,
        game,
        winnerCardId: winner ? winner.cardId : null,
        isYourCardWinner: winner && winner.cardId === numericCardId,
        winnerCardNumbers: card.numbers,
        markedGrid,
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

    // Set selectedWinnerRowIndices and forcedPattern when selecting a winner
    let usePattern = game.pattern;
    let forcedPattern = null;
    if (game.pattern === "all") {
      const patternChoices = [
        "four_corners_center",
        "cross",
        "main_diagonal",
        "other_diagonal",
        "horizontal_line",
        "vertical_line",
      ];
      usePattern =
        patternChoices[Math.floor(Math.random() * patternChoices.length)];
      forcedPattern = usePattern;
    }
    const { selectedIndices } = getNumbersForPattern(
      card.numbers,
      usePattern,
      [],
      true
    );
    game.moderatorWinnerCardId = Number(cardId);
    game.selectedWinnerRowIndices = selectedIndices;
    game.forcedPattern = forcedPattern;
    await game.save();
    console.log(
      `[selectWinner] Card ${cardId} selected as winner for game ${game.gameNumber}, indices: ${selectedIndices}, forcedPattern: ${forcedPattern}`
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
export const createGameRecord = async ({
  gameNumber,
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

  // Validate pattern
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

  // Calculate houseFee
  const houseFee =
    betAmount * (houseFeePercentage / 100) * selectedCards.length;

  const game = new Game({
    gameNumber,
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
  console.log(
    `[createGameRecord] Game created: ID=${game._id}, Number=${game.gameNumber}, Pattern=${pattern}, WinnerCardId=${game.moderatorWinnerCardId}, SelectedIndices=${game.selectedWinnerRowIndices}`
  );

  // Create GameLog entry
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

  if (moderatorWinnerCardId && !moderatorWinnerCardId) {
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
