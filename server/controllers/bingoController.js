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
export const checkBingo = async (req, res, next) => {
  try {
    const { identifier, preferredPattern } = req.body;
    const gameId = req.params.id;

    const game = await Game.findById(gameId)
      .select(
        "gameNumber status calledNumbers calledNumbersLog selectedCards forcedPattern pattern winnerCards prizePool"
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

    const validPatterns = [
      "four_corners_center",
      "main_diagonal",
      "other_diagonal",
      "horizontal_line",
      "vertical_line",
      "inner_corners",
      "all",
    ];

    const patternsToCheck =
      game.pattern === "all" && !game.forcedPattern
        ? validPatterns.filter((p) => p !== "all")
        : [game.forcedPattern || game.pattern];

    // Fetch all selected cards in one query
    const selectedCardIds = game.selectedCards.map((c) => c.id);
    const allCards = await Card.find({ card_number: { $in: selectedCardIds } })
      .select("card_number numbers")
      .lean();

    // Map cards by card_number for O(1) lookup
    const cardMap = {};
    allCards.forEach((card) => (cardMap[card.card_number] = card.numbers));

    const winningCards = [];
    const bulkUpdateOps = [];

    for (const c of game.selectedCards) {
      if (c.disqualified) continue;

      const fullCardNumbers = cardMap[c.id];
      if (!fullCardNumbers) continue;

      // Skip if already checked for this called number
      if (
        c.lastCheckTime &&
        new Date(c.lastCheckTime) >= new Date(lastCalledNumber.calledAt)
      )
        continue;

      // Check bingo patterns
      let winningPattern = null;
      for (const pattern of patternsToCheck) {
        if (!validPatterns.includes(pattern)) continue;

        const [isComplete] = checkCardBingo(
          fullCardNumbers,
          game.calledNumbers,
          pattern
        );

        if (isComplete) {
          if (!winningPattern || pattern === preferredPattern) {
            winningPattern = pattern;
          }
        }
      }

      if (!winningPattern) {
        // No bingo, just update lastCheckTime
        bulkUpdateOps.push({
          updateOne: {
            filter: { _id: gameId, "selectedCards.id": c.id },
            update: { $set: { "selectedCards.$.lastCheckTime": new Date() } },
          },
        });
        continue;
      }

      // Check for late call
      const lateCallResult = await detectLateCallForCurrentPattern(
        fullCardNumbers,
        winningPattern,
        game.calledNumbers,
        gameId
      );

      if (lateCallResult?.hasMissedOpportunity) {
        bulkUpdateOps.push({
          updateOne: {
            filter: { _id: gameId, "selectedCards.id": c.id },
            update: {
              $set: {
                "selectedCards.$.lastCheckTime": new Date(),
                "selectedCards.$.disqualified": true,
              },
            },
          },
        });
        continue;
      }

      // Valid winner
      winningCards.push({
        cardId: c.id,
        numbers: fullCardNumbers,
        winningPattern,
      });

      bulkUpdateOps.push({
        updateOne: {
          filter: { _id: gameId, "selectedCards.id": c.id },
          update: { $set: { "selectedCards.$.lastCheckTime": new Date() } },
        },
      });
    }

    // Apply all updates in bulk
    if (bulkUpdateOps.length > 0) {
      await Game.bulkWrite(bulkUpdateOps);
    }

    // Save winners and results
    if (winningCards.length > 0) {
      const session = await Game.startSession();
      try {
        await session.withTransaction(async () => {
          const freshGame = await Game.findById(gameId).session(session);

          // Merge new winners with existing winnerCards
          freshGame.winnerCards = [
            ...(freshGame.winnerCards || []),
            ...winningCards.map((w) => ({
              cardId: w.cardId,
              winningPattern: w.winningPattern,
              numbers: w.numbers,
            })),
          ];

          await freshGame.save({ session });

          for (const winner of winningCards) {
            await Result.create(
              [
                {
                  gameId: freshGame._id,
                  winnerCardId: winner.cardId,
                  userId: req.user?._id || null,
                  identifier:
                    identifier || `${freshGame._id}-${winner.cardId}`,
                  prize: freshGame.prizePool,
                  isJackpot: false,
                  winningPattern: winner.winningPattern,
                  lastCalledNumber: lastCalledNumber.number,
                  timestamp: new Date(),
                },
              ],
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }
    }

    await GameLog.create({
      gameId,
      action: "checkBingo",
      status: winningCards.length > 0 ? "success" : "checked",
      details: {
        lastCalledNumber: lastCalledNumber.number,
        winners: winningCards,
        timestamp: new Date(),
      },
    });

    return res.json({
      isBingo: winningCards.length > 0,
      winners: winningCards,
      gameStatus: game.status,
    });
  } catch (err) {
    console.error("[checkBingo] ❌ ERROR:", err);
    return res
      .status(500)
      .json({ message: "Internal server error", error: err.message });
  }
};


// ✅ NEW FUNCTION: Pattern-specific late call detection
const detectLateCallForCurrentPattern = async (
  cardNumbers,
  currentPattern,
  calledNumbers,
  gameId,
  lineInfo = null
) => {
  try {
    console.log(
      `[detectLateCallForCurrentPattern] 🔍 Pattern "${currentPattern}", lineInfo: ${JSON.stringify(
        lineInfo
      )}`
    );

    const targetIndices =
      lineInfo && lineInfo.lineIndex ? [lineInfo.lineIndex] : [];
    const { numbers: patternNumbers } = getNumbersForPattern(
      cardNumbers, // 2D
      currentPattern,
      [], // Full required
      true, // Use specific line
      targetIndices,
      false // Unmarked for required
    );

    const requiredNumbers = patternNumbers
      .filter((num) => num !== "FREE" && !isNaN(parseInt(num)))
      .map((num) => parseInt(num));

    console.log(
      `[detectLateCallForCurrentPattern] 📝 Required: [${requiredNumbers.join(
        ", "
      )}]`
    );

    if (requiredNumbers.length === 0) {
      console.log(`[detectLateCallForCurrentPattern] ⚠️ No required numbers`);
      return null;
    }

    const callHistory = [];
    requiredNumbers.forEach((reqNum) => {
      const callIndex = calledNumbers.findIndex((num) => num === reqNum);
      if (callIndex !== -1) {
        callHistory.push({ number: reqNum, callIndex: callIndex + 1 });
      }
    });

    if (callHistory.length < requiredNumbers.length) {
      console.log(`[detectLateCallForCurrentPattern] ⚠️ Not fully called`);
      return null;
    }

    callHistory.sort((a, b) => a.callIndex - b.callIndex);
    const completionCallIndex = Math.max(
      ...callHistory.map((c) => c.callIndex)
    );
    const currentCallIndex = calledNumbers.length;
    const wasCompleteEarlier = completionCallIndex < currentCallIndex;

    console.log(
      `[detectLateCallForCurrentPattern] 📊 Completion call #${completionCallIndex}, current #${currentCallIndex}, earlier? ${wasCompleteEarlier}`
    );

    if (wasCompleteEarlier) {
      const completingNumber = callHistory.find(
        (c) => c.callIndex === completionCallIndex
      )?.number;
      const message = `You won before with ${currentPattern.replace(
        "_",
        " "
      )} pattern on call #${completionCallIndex} (number ${completingNumber})`;
      console.log(`[detectLateCallForCurrentPattern] 🚨 LATE CALL: ${message}`);
      return {
        hasMissedOpportunity: true,
        message,
        details: {
          pattern: currentPattern,
          completingNumber,
          callIndex: completionCallIndex,
          validPatterns: [currentPattern],
          numbersCalledBefore: callHistory.slice(0, -1).map((c) => c.number),
          totalRequired: requiredNumbers.length,
        },
        earliestCallIndex: completionCallIndex,
      };
    }

    console.log(
      `[detectLateCallForCurrentPattern] ✅ Completed on current call`
    );
    return null;
  } catch (error) {
    console.error("[detectLateCallForCurrentPattern] ❌ Error:", error);
    return null;
  }
};

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
      .select("gameNumber") // ✅ Light include
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
      .select("gameNumber") // ✅ Include
      .lean();

    await GameLog.create({
      gameId,
      action: "updateGameStatus",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        newStatus: status,
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
        timestamp: new Date(),
      },
    });

    res.json({
      message: `Game ${game.gameNumber} ${status} successfully`,
      game: {
        ...updatedGame,
        status,
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
      },
    });
  } catch (error) {
    console.error("[updateGameStatus] Error updating game status:", error);
    await GameLog.create({
      gameId: req.params.gameId,
      action: "updateGameStatus",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    next(error);
  }
};
