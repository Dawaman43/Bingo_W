// controllers/bingoController.js (Full optimized for Step 2 - .lean(), projections, batch updates; FIXED: Include gameNumber in selects)
import mongoose from "mongoose";
import {
  checkCardBingo,
  getMarkedGrid,
  getNumbersForPattern,
  getCashierIdFromUser,
  logJackpotUpdate,
  generateQuickWinSequence,
  logNumberCall,
  getSpecificLineInfo,
  checkSpecificLineCompletion,
  detectLateCallOpportunity,
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Result from "../models/Result.js";
import Jackpot from "../models/Jackpot.js";
import JackpotLog from "../models/JackpotLog.js";
import Card from "../models/Card.js";
import GameLog from "../models/GameLog.js";
import FutureWinner from "../models/FutureWinner.js";

export const getCard = async (req, res) => {
  try {
    const { id } = req.params;
    const card = await Card.findOne({ card_number: Number(id) })
      .select("numbers card_number")
      .lean();
    if (!card) return res.status(404).json({ message: "Card not found" });
    res.json(card);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const callNumber = async (req, res, next) => {
  try {
    const { gameId } = req.params;

    if (!gameId) {
      return res.status(400).json({ message: "Game ID is required" });
    }

    // Load only essential fields
    const game = await Game.findById(gameId)
      .select(
        "gameNumber status calledNumbers calledNumbersLog forcedCallSequence forcedCallIndex pattern forcedPattern moderatorWinnerCardId prizePool"
      )
      .lean();

    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "active")
      return res.status(400).json({ message: `Game is ${game.status}` });

    let nextNumber;
    let callSource = "random";
    let isUsingForcedSequence = false;

    const calledNumbersCopy = game.calledNumbers || [];
    const callsMade = calledNumbersCopy.length;

    // --- Forced sequence logic ---
    if (
      game.forcedCallSequence?.length &&
      game.forcedCallIndex < game.forcedCallSequence.length
    ) {
      const remainingForced =
        game.forcedCallSequence.length - game.forcedCallIndex;

      if (callsMade + remainingForced >= 14 || Math.random() < 0.4) {
        nextNumber = game.forcedCallSequence[game.forcedCallIndex];
        callSource = "forced";
        isUsingForcedSequence = true;
      }
    }

    // --- Random number if no forced number ---
    if (!nextNumber) {
      const remainingNumbers = Array.from(
        { length: 75 },
        (_, i) => i + 1
      ).filter(
        (n) =>
          !calledNumbersCopy.includes(n) &&
          !(game.forcedCallSequence || []).includes(n)
      );

      if (!remainingNumbers.length)
        return res.status(400).json({ message: "No numbers left to call" });

      nextNumber =
        remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
      callSource = "random";
    }

    // --- Atomic update to prevent duplicate numbers ---
    const updateData = {
      $addToSet: { calledNumbers: nextNumber }, // ensures uniqueness
      $push: { calledNumbersLog: { number: nextNumber, calledAt: new Date() } },
      ...(isUsingForcedSequence ? { $inc: { forcedCallIndex: 1 } } : {}),
    };

    const updatedGame = await Game.findByIdAndUpdate(gameId, updateData, {
      new: true,
      runValidators: true,
    })
      .select(
        "gameNumber status calledNumbers calledNumbersLog forcedCallIndex pattern forcedPattern moderatorWinnerCardId prizePool"
      )
      .lean();

    // --- Log the action ---
    await GameLog.create({
      gameId,
      action: "callNumber",
      status: "success",
      details: {
        calledNumber: nextNumber,
        type: callSource,
        forcedCallIndex: updatedGame.forcedCallIndex,
        forcedCallLength: game.forcedCallSequence?.length || 0,
        pattern: game.forcedPattern || game.pattern,
        moderatorWinnerCardId: game.moderatorWinnerCardId,
        timestamp: new Date(),
      },
    });

    return res.json({
      game: updatedGame,
      calledNumber: nextNumber,
      callSource,
      isUsingForcedSequence,
      patternUsed: game.forcedPattern || game.pattern,
      forcedCallIndex: updatedGame.forcedCallIndex,
      forcedCallSequenceLength: game.forcedCallSequence?.length || 0,
    });
  } catch (err) {
    console.error("[callNumber] ❌ ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// controllers/bingoController.js — Full corrected checkBingo with enhanced logs and fixes
// controllers/bingoController.js — Full corrected checkBingo with enhanced logs and fixes
export const checkBingo = async (req, res, next) => {
  try {
    const { cardId, preferredPattern } = req.body;
    const gameId = req.params.id;

    if (!cardId) {
      return res.status(400).json({ message: "Card identifier is required" });
    }

    const game = await Game.findById(gameId)
      .select(
        "gameNumber status calledNumbers calledNumbersLog selectedCards forced* pattern winner prizePool"
      )
      .lean();

    if (!game) {
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: { error: "Game not found", timestamp: new Date() },
      });
      return res.status(404).json({ message: "Game not found" });
    }

    const lastCalledNumber =
      game.calledNumbersLog?.[game.calledNumbersLog.length - 1] || null;
    if (!lastCalledNumber) {
      return res.json({
        isBingo: false,
        message: "No numbers called yet",
        winners: [],
        game,
      });
    }

    // Find the specific card in selectedCards
    const selectedCard = game.selectedCards.find(
      (sc) => sc.id === parseInt(cardId)
    );
    if (!selectedCard) {
      return res
        .status(404)
        .json({ message: "Card not found in selected cards" });
    }

    // Fetch full card
    const fullCard = await Card.findOne({ card_number: parseInt(cardId) })
      .select("numbers")
      .lean();
    if (!fullCard?.numbers) {
      return res.status(404).json({ message: "Full card data not found" });
    }

    // 🚨 FIXED: Removed FutureWinner check — now allows any selected card to bingo
    // If needed, add back as optional: const requireScheduled = req.query.requireScheduled === 'true';
    // Then fetch/validate only if true, else log warning and proceed.

    // Use preferredPattern or fallback to game pattern
    const expectedPattern = preferredPattern || game.pattern || "all";

    // Log if no future winner scheduled (for auditing)
    // await GameLog.create({ gameId, action: "checkBingo", status: "unscheduled_check", details: { cardId: parseInt(cardId), pattern: expectedPattern } });

    // Check card state
    let checkCount = selectedCard.checkCount || 0;
    let disqualified = selectedCard.disqualified || false;
    const lastCheckTime = selectedCard.lastCheckTime || null;

    // Reset checkCount if checking after last call
    if (
      lastCheckTime &&
      lastCalledNumber.calledAt &&
      new Date(lastCheckTime) < new Date(lastCalledNumber.calledAt)
    ) {
      checkCount += 1;
    } else {
      checkCount = 1;
      disqualified = false;
    }

    // Update the specific card
    const currentTime = new Date();
    const index = game.selectedCards.findIndex(
      (sc) => sc.id === parseInt(cardId)
    ); // Safer index lookup
    if (index === -1) {
      return res
        .status(404)
        .json({ message: "Card index not found in selectedCards" });
    }
    await Game.findByIdAndUpdate(gameId, {
      $set: {
        [`selectedCards.${index}.checkCount`]: checkCount,
        [`selectedCards.${index}.lastCheckTime`]: currentTime,
        [`selectedCards.${index}.disqualified`]: disqualified,
      },
    });

    if (disqualified || checkCount > 1) {
      return res.json({
        isBingo: false,
        message: "Card disqualified or multiple checks",
        winners: [],
        game,
      });
    }

    // Check if pattern is complete with all called numbers
    const [isComplete, detectedPattern] = checkCardBingo(
      fullCard.numbers,
      game.calledNumbers,
      expectedPattern,
      lastCalledNumber?.number
    );

    const actualPattern =
      expectedPattern === "all" ? detectedPattern : expectedPattern;

    if (!isComplete) {
      return res.json({
        isBingo: false,
        message: "Pattern not complete",
        winners: [],
        game,
      });
    }

    // Late call check: determine if completed by last number or earlier
    const lateCallResult = await detectLateCallForCurrentPattern(
      fullCard.numbers,
      actualPattern,
      game.calledNumbers,
      gameId
    );

    const completingNumber =
      lateCallResult?.completingNumber || lastCalledNumber.number;

    if (lateCallResult?.hasMissedOpportunity) {
      // Mark as late call
      disqualified = true;
      await Game.findByIdAndUpdate(gameId, {
        $set: {
          [`selectedCards.${index}.disqualified`]: true,
        },
      });

      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "late_call",
        details: {
          cardId: parseInt(cardId),
          pattern: actualPattern,
          completingNumber,
          lateCallMessage: lateCallResult.message,
          timestamp: new Date(),
        },
      });

      return res.json({
        isBingo: false,
        message: "Late call detected",
        winners: [
          {
            cardId: parseInt(cardId),
            numbers: fullCard.numbers,
            winningPattern: actualPattern,
            disqualified: true,
            completingNumber,
            lateCall: true,
            lateCallMessage: lateCallResult.message,
            jackpotEnabled: false, // Default since no fw
          },
        ],
        gameStatus: game.status,
      });
    }

    // It's a valid bingo, completed by last number
    const winningCard = {
      cardId: parseInt(cardId),
      numbers: fullCard.numbers,
      winningPattern: actualPattern,
      disqualified: false,
      completingNumber,
      lateCall: false,
      lateCallMessage: null,
      jackpotEnabled: false, // Default since no fw
    };

    // Save winner to Game & Result
    const session = await Game.startSession();
    try {
      await session.withTransaction(async () => {
        const freshGame = await Game.findById(gameId).session(session);
        freshGame.status = "completed";
        freshGame.winnerCards = [
          // Assuming winnerCards as per earlier note; adjust to winner if standardized
          {
            cardId: winningCard.cardId,
            winningPattern: winningCard.winningPattern,
            numbers: winningCard.numbers,
            jackpotEnabled: winningCard.jackpotEnabled,
          },
        ];
        await freshGame.save({ session });

        await Result.create(
          [
            {
              gameId: freshGame._id,
              winnerCardId: winningCard.cardId,
              userId: req.user?._id || null,
              identifier: cardId || `${freshGame._id}-${winningCard.cardId}`,
              prize: freshGame.prizePool,
              isJackpot: winningCard.jackpotEnabled,
              winningPattern: winningCard.winningPattern,
              lastCalledNumber: winningCard.completingNumber,
              timestamp: new Date(),
            },
          ],
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    await GameLog.create({
      gameId,
      action: "checkBingo",
      status: "success",
      details: {
        cardId: parseInt(cardId),
        pattern: actualPattern,
        completingNumber,
        timestamp: new Date(),
      },
    });

    return res.json({
      isBingo: true,
      winners: [winningCard],
      gameStatus: "completed",
    });
  } catch (err) {
    console.error("[checkBingo] ❌ ERROR:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};

// ✅ UPDATED FUNCTION: Pattern-specific late call detection — Now always returns completingNumber when applicable
// ✅ UPDATED FUNCTION: Pattern-specific late call detection — Now always returns completingNumber when applicable
function getNumbersForPattern(
  cardNumbers,
  pattern,
  calledNumbers = [],
  selectSpecificLine = false,
  targetIndices = [],
  includeMarked = false,
  lastCalledNumber = null
) {
  if (pattern === "all") {
    console.error(
      `[getNumbersForPattern] CRITICAL: "all" pattern passed directly. Convert to real pattern first.`
    );
    throw new Error(`"all" pattern is forbidden here. Use a real pattern.`);
  }

  console.log(
    `[getNumbersForPattern] START — Pattern: "${pattern}", Called: [${calledNumbers.join(
      ", "
    )}], includeMarked: ${includeMarked}, lastCalledNumber: ${lastCalledNumber}`
  );

  if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) {
    console.warn("[getNumbersForPattern] Invalid or empty cardNumbers");
    return { numbers: [], selectedIndices: [] };
  }

  // Convert all to strings for safe comparison
  const grid = cardNumbers.map((row) =>
    Array.isArray(row) ? row.map((num) => String(num)) : []
  );

  const numbers = [];
  const selectedIndices = [];

  // Filter logic now depends on includeMarked
  const filterFn = includeMarked
    ? (n) => n !== "FREE" // Return all non-FREE numbers in pattern
    : (n) => n !== "FREE" && !calledNumbers.includes(Number(n)); // Only unmarked

  console.log(`[getNumbersForPattern] Grid prepared:`, grid);

  // Helper function to find line containing lastCalledNumber
  const findLineContainingNumber = (lastCalledNumber, grid) => {
    if (!lastCalledNumber) return null;

    const lastCalledStr = String(lastCalledNumber);

    // Check rows first (horizontal lines)
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        if (grid[row][col] === lastCalledStr) {
          return { type: "row", index: row, col: col };
        }
      }
    }

    // Check columns (vertical lines)
    for (let col = 0; col < grid[0].length; col++) {
      for (let row = 0; row < grid.length; row++) {
        if (grid[row][col] === lastCalledStr) {
          return { type: "col", index: col, row: row };
        }
      }
    }

    return null;
  };

  // Helper function to check if a line is complete (all numbers called)
  const isLineComplete = (lineNumbers, calledNumbers) => {
    return lineNumbers.every(
      (num) => num === "FREE" || calledNumbers.includes(Number(num))
    );
  };

  let selectedRow = null;

  // STEP 1: If we have lastCalledNumber, find the exact row that contains it
  if (lastCalledNumber) {
    const lineInfo = findLineContainingNumber(lastCalledNumber, grid);
    if (lineInfo && lineInfo.type === "row") {
      selectedRow = lineInfo.index;
      console.log(
        `[getNumbersForPattern] Found lastCalledNumber ${lastCalledNumber} in row ${selectedRow}`
      );
    }
  }

  // STEP 2: If no specific row found, check for complete lines
  if (!selectedRow) {
    // Check each row for completion
    for (let row = 0; row < 5; row++) {
      const rowNumbers = grid[row];
      const complete = isLineComplete(rowNumbers, calledNumbers);
      console.log(
        `[DEBUG] Row ${row} complete? ${complete} (nums: [${rowNumbers.join(
          ", "
        )}])`
      );
      if (complete) {
        selectedRow = row;
        console.log(
          `[getNumbersForPattern] Found complete row ${row}: [${rowNumbers.join(
            ", "
          )}]`
        );
        break; // Take first complete row
      }
    }
  }

  // STEP 3: If still no row found, use specified target or first row as fallback
  if (!selectedRow && selectSpecificLine && targetIndices.length > 0) {
    selectedRow = targetIndices[0];
    console.log(`[getNumbersForPattern] Using specified row ${selectedRow}`);
  }

  if (!selectedRow && grid.length > 0) {
    selectedRow = 0; // Default to first row
    console.log(
      `[getNumbersForPattern] No complete/specific row found, using default row 0`
    );
  }

  // STEP 4: Process the selected row
  if (selectedRow !== null && selectedRow >= 0 && selectedRow < grid.length) {
    const rowNumbers = grid[selectedRow].filter(filterFn);
    numbers.push(...rowNumbers);
    for (let j = 0; j < 5; j++) {
      if (filterFn(grid[selectedRow][j])) {
        selectedIndices.push(selectedRow * 5 + j);
      }
    }
    console.log(
      `[getNumbersForPattern] Pattern "horizontal_line" (row ${selectedRow}) → Numbers: [${numbers.join(
        ", "
      )}], Indices: [${selectedIndices.join(", ")}]`
    );
  } else {
    console.warn(
      "[getNumbersForPattern] No valid row found for horizontal_line"
    );
  }

  const result = {
    numbers: numbers.map(String),
    selectedIndices,
  };

  console.log(`[getNumbersForPattern] END — Returning:`, result);
  return result;
}
// Other functions (finishGame, pauseGame, updateGameStatus) – OPTIMIZED with lean/select where possible
export const finishGame = async (req, res) => {
  const gameId = req.params.id;

  const safeLog = async (logData) => {
    try {
      await GameLog.create(logData);
    } catch (err) {
      console.error("Failed to log game action:", err.message);
    }
  };

  try {
    const cashierId = req.user?.id;
    if (!cashierId) {
      console.warn(`[finishGame] cashierId missing for game ${gameId}`);
    }

    if (!mongoose.isValidObjectId(gameId)) {
      await safeLog({
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

    const game = await Game.findOne({ _id: gameId, cashierId })
      .select(
        "gameNumber status winner moderatorWinnerCardId winnerCardNumbers selectedWinnerNumbers"
      )
      .lean();

    if (!game) {
      await safeLog({
        gameId,
        action: "finishGame",
        status: "failed",
        details: { error: "Game not found or unauthorized" },
      });
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    if (!["active", "paused"].includes(game.status)) {
      await safeLog({
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

    const updatedGame = await Game.findByIdAndUpdate(
      gameId,
      { status: "completed" },
      { new: true }
    )
      .select("gameNumber")
      .lean();

    // 🚫 Jackpot logic disabled — intentionally not modifying jackpot or logs
    if (game.jackpotEnabled && game.winner) {
      console.log(
        `[finishGame] Jackpot processing skipped for game ${gameId} (disabled logic)`
      );
    }

    await safeLog({
      gameId,
      action: "gameCompleted",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        winnerCardId: game.winner?.cardId ?? null,
        prize: game.winner?.prize ?? null,
        moderatorWinnerCardId: game.moderatorWinnerCardId ?? null,
        winnerCardNumbers: game.winnerCardNumbers ?? [],
        selectedWinnerNumbers: game.selectedWinnerNumbers ?? [],
      },
    });

    res.json({
      message: "Game completed successfully",
      game: {
        ...updatedGame,
        winnerCardNumbers: game.winnerCardNumbers ?? [],
        selectedWinnerNumbers: game.selectedWinnerNumbers ?? [],
      },
    });
  } catch (error) {
    console.error("[finishGame] Unexpected error:", error?.message ?? error);

    await safeLog({
      gameId,
      action: "finishGame",
      status: "failed",
      details: { error: error?.message ?? "Unknown error" },
    });

    res.status(500).json({
      message: "Internal server error",
      error: error?.message ?? "Unknown error",
    });
  }
};

export const pauseGame = async (req, res, next) => {
  try {
    const { id: gameId } = req.params; // ✅ FIXED param name

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    // FIXED: Include gameNumber in select
    // OPTIMIZED: Lean for read
    const game = await Game.findOne({ _id: gameId, cashierId })
      .select(
        "gameNumber status winner moderatorWinnerCardId winnerCardNumbers selectedWinnerNumbers"
      )
      .lean();

    if (!game) {
      await GameLog.create({
        gameId,
        action: "pauseGame",
        status: "failed",
        details: { error: "Game not found or unauthorized" },
      });
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
      });
    }

    if (game.status !== "active") {
      await GameLog.create({
        gameId,
        action: "pauseGame",
        status: "failed",
        details: { error: "Game must be active to pause", status: game.status },
      });
      return res.status(400).json({ message: "Game must be active to pause" });
    }

    // OPTIMIZED: Atomic update
    const updatedGame = await Game.findByIdAndUpdate(
      gameId,
      { status: "paused" },
      { new: true }
    )
      .select("gameNumber") // ✅ Include
      .lean();

    await GameLog.create({
      gameId,
      action: "pauseGame",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
      },
    });

    res.json({
      message: `Game ${game.gameNumber} paused successfully`,
      game: {
        ...updatedGame,
        status: "paused",
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
      },
    });
  } catch (error) {
    console.error("[pauseGame] Error pausing game:", error);
    await GameLog.create({
      gameId: req.params.id,
      action: "pauseGame",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};

export const updateGameStatus = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { status } = req.body;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (!mongoose.isValidObjectId(gameId)) {
      await GameLog.create({
        gameId,
        action: "updateGameStatus",
        status: "failed",
        details: { error: "Invalid game ID format" },
      });
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    if (!["active", "paused"].includes(status)) {
      await GameLog.create({
        gameId,
        action: "updateGameStatus",
        status: "failed",
        details: { error: `Invalid status: ${status}` },
      });
      return res.status(400).json({
        message: `Invalid status: ${status}. Must be 'active' or 'paused'`,
        errorCode: "INVALID_STATUS",
      });
    }

    // FIXED: Include gameNumber in select
    // OPTIMIZED: Lean for read
    const game = await Game.findOne({ _id: gameId, cashierId })
      .select("gameNumber status") // ✅ Include status to check
      .lean();
    if (!game) {
      await GameLog.create({
        gameId,
        action: "updateGameStatus",
        status: "failed",
        details: { error: "Game not found or unauthorized" },
      });
      return res.status(404).json({
        message: "Game not found or you are not authorized to access it",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    if (game.status === "completed") {
      await GameLog.create({
        gameId,
        action: "updateGameStatus",
        status: "failed",
        details: {
          error: "Cannot modify completed game",
          currentStatus: game.status,
        },
      });
      return res.status(400).json({
        message: "Cannot modify a completed game",
        errorCode: "GAME_COMPLETED",
      });
    }

    if (game.status === status) {
      await GameLog.create({
        gameId,
        action: "updateGameStatus",
        status: "failed",
        details: { error: `Game is already ${status}` },
      });
      return res.status(400).json({
        message: `Game is already ${status}`,
        errorCode: "STATUS_UNCHANGED",
      });
    }

    // OPTIMIZED: Atomic update
    const updatedGame = await Game.findByIdAndUpdate(
      gameId,
      { status },
      { new: true }
    )
      .select("gameNumber")
      .lean();

    await GameLog.create({
      gameId,
      action: "updateGameStatus",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        newStatus: status,
        timestamp: new Date(),
      },
    });

    res.json({
      message: `Game ${game.gameNumber} ${status} successfully`,
      game: {
        ...updatedGame,
        status,
      },
    });
  } catch (error) {
    console.error("[updateGameStatus] Error updating game status:", error);
    await GameLog.create({
      gameId: req.params.gameId || gameId,
      action: "updateGameStatus",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};
