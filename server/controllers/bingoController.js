// controllers/bingoController.js
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
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Result from "../models/Result.js";
import Jackpot from "../models/Jackpot.js";
import GameLog from "../models/GameLog.js";
import FutureWinner from "../models/FutureWinner.js";

export const callNumber = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    console.log(`[callNumber] 🔵 START — Request for gameId: ${gameId}`);

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "active") {
      return res.status(400).json({
        message: `Cannot call number: Game is ${game.status}`,
        errorCode: "GAME_NOT_ACTIVE",
      });
    }

    if (!game.calledNumbers) game.calledNumbers = [];
    if (!game.calledNumbersLog) game.calledNumbersLog = [];
    if (!game.forcedCallIndex) game.forcedCallIndex = 0;

    let nextNumber;
    let callSource = "random";
    let isUsingForcedSequence = false;

    // 👉 Ensure winner forced sequence is injected before 14 calls
    const winnerLimit = 14;
    const callsMade = game.calledNumbers.length;

    if (
      game.forcedCallSequence &&
      Array.isArray(game.forcedCallSequence) &&
      game.forcedCallIndex < game.forcedCallSequence.length
    ) {
      const remainingForced =
        game.forcedCallSequence.length - game.forcedCallIndex;

      // If we're close to the winner limit, FORCE winner numbers
      if (callsMade + remainingForced >= winnerLimit || Math.random() < 0.4) {
        nextNumber = game.forcedCallSequence[game.forcedCallIndex];
        game.forcedCallIndex++;
        callSource = "forced";
        isUsingForcedSequence = true;
        console.log(
          `[callNumber] 🔄 FORCED CALL: Number ${nextNumber} (Index ${game.forcedCallIndex})`
        );
      }
    }

    // Fallback → random number
    if (!nextNumber) {
      const remainingNumbers = Array.from(
        { length: 75 },
        (_, i) => i + 1
      ).filter(
        (n) =>
          !game.calledNumbers.includes(n) &&
          !(game.forcedCallSequence || []).includes(n)
      );

      if (remainingNumbers.length === 0) {
        return res.status(400).json({ message: "No numbers left to call" });
      }

      nextNumber =
        remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
      callSource = "random";
      console.log(`[callNumber] 🎲 RANDOM CALL: Number ${nextNumber}`);
    }

    // Save call
    game.calledNumbers.push(Number(nextNumber));
    game.calledNumbersLog.push({
      number: Number(nextNumber),
      calledAt: new Date(),
    });

    await game.save();

    // Log
    await GameLog.create({
      gameId: game._id,
      action: "callNumber",
      status: "success",
      details: {
        calledNumber: Number(nextNumber),
        type: callSource,
        forcedCallIndex: game.forcedCallIndex,
        forcedCallLength: game.forcedCallSequence?.length || 0,
        pattern: game.forcedPattern || game.pattern,
        moderatorWinnerCardId: game.moderatorWinnerCardId,
        timestamp: new Date(),
      },
    });

    res.json({
      game,
      calledNumber: Number(nextNumber),
      callSource,
      isUsingForcedSequence,
      patternUsed: game.forcedPattern || game.pattern,
      forcedCallIndex: game.forcedCallIndex,
      forcedCallSequenceLength: game.forcedCallSequence?.length || 0,
    });
  } catch (err) {
    console.error("[callNumber] ❌ ERROR:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const checkBingo = async (req, res, next) => {
  try {
    const { cardId, identifier, preferredPattern } = req.body;
    const gameId = req.params.id;

    const game = await Game.findById(gameId);
    if (!game) {
      console.warn(`[checkBingo] ❌ Game not found: ${gameId}`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: "Game not found",
          timestamp: new Date(),
        },
      });
      return res.status(404).json({ message: "Game not found" });
    }

    const numericCardId = Number(cardId);
    const card = game.selectedCards.find((c) => c.id === numericCardId);
    if (!card) {
      console.warn(`[checkBingo] ❌ Card not in game: ${numericCardId}`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: `Card ${numericCardId} not in game`,
          timestamp: new Date(),
        },
      });
      return res.status(400).json({ message: "Card not in game" });
    }

    if (!["active", "paused", "completed"].includes(game.status)) {
      console.warn(`[checkBingo] ❌ Game not checkable: status=${game.status}`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: `Game not checkable, status: ${game.status}`,
          timestamp: new Date(),
        },
      });
      return res.status(400).json({ message: "Game not checkable" });
    }

    const lastCalledNumber = game.calledNumbersLog.length
      ? game.calledNumbersLog[game.calledNumbersLog.length - 1].number
      : null;
    const callsMade = game.calledNumbers.length;

    // 🔑 CRITICAL: If no last called number, cannot win
    if (!lastCalledNumber) {
      console.log(`[checkBingo] ❌ No last called number - cannot check bingo`);
      return res.json({
        isBingo: false,
        message: "No numbers called yet",
        winningPattern: null,
        validBingoPatterns: [],
        game: {
          ...game.toObject(),
          winnerCardNumbers: game.winnerCardNumbers || [],
          selectedWinnerNumbers: game.selectedWinnerNumbers || [],
        },
      });
    }

    console.log(
      `[checkBingo] 🧪 DEBUG — lastCalledNumber: ${lastCalledNumber} (${typeof lastCalledNumber})`
    );
    console.log(
      `[checkBingo] 🧪 DEBUG — game.pattern: ${game.pattern}, forcedPattern: ${game.forcedPattern}`
    );
    console.log(`[checkBingo] 🧪 DEBUG — card.numbers:`, card.numbers);
    console.log(
      `[checkBingo] 🧪 DEBUG — preferredPattern: ${preferredPattern}`
    );

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

    console.log(`[checkBingo] Patterns to check: ${patternsToCheck}`);

    let isBingo = false;
    let winningPattern = null;
    let markedGrid = null;
    const validBingoPatterns = [];

    // 🔑 Create previous called numbers (all except last)
    const previousCalledNumbers = game.calledNumbers.slice(0, -1);
    console.log(
      `[checkBingo] Previous called: [${previousCalledNumbers
        .slice(-5)
        .join(", ")}...]`
    );

    // Perform bingo check for the provided card
    for (const pattern of patternsToCheck) {
      if (!validPatterns.includes(pattern)) {
        console.error(`[checkBingo] ❌ Invalid pattern: ${pattern}`);
        continue;
      }

      try {
        markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);

        // 🔑 STEP 1: Get the specific line info for this pattern and lastCalledNumber
        const specificLineInfo = getSpecificLineInfo(
          card.numbers,
          pattern,
          lastCalledNumber
        );
        console.log(
          `[checkBingo] Pattern ${pattern}: specificLineInfo=`,
          specificLineInfo
        );

        if (!specificLineInfo) {
          console.log(
            `[checkBingo] ❌ Last called ${lastCalledNumber} not part of pattern ${pattern}`
          );
          continue; // Last number not even in this pattern
        }

        // 🔑 STEP 2: Check if the SPECIFIC line is complete NOW (with lastCalledNumber)
        const currentLineComplete = checkSpecificLineCompletion(
          card.numbers,
          game.calledNumbers,
          pattern,
          specificLineInfo
        );

        console.log(
          `[checkBingo] Pattern ${pattern}: currentLineComplete=${currentLineComplete} (${specificLineInfo.lineType} ${specificLineInfo.lineIndex})`
        );

        if (!currentLineComplete) {
          console.log(
            `[checkBingo] ❌ Specific line for ${pattern} not complete currently`
          );
          continue; // The specific line containing lastCalledNumber is not complete
        }

        // 🔑 STEP 3: Check if the SPECIFIC line was NOT complete before last call
        const wasSpecificLinePreviouslyComplete = checkSpecificLineCompletion(
          card.numbers,
          previousCalledNumbers,
          pattern,
          specificLineInfo
        );

        console.log(
          `[checkBingo] Pattern ${pattern}: wasSpecificLinePreviouslyComplete=${wasSpecificLinePreviouslyComplete}`
        );

        if (wasSpecificLinePreviouslyComplete) {
          console.log(
            `[checkBingo] ❌ Specific line for ${pattern} was already complete before last call`
          );
          continue; // This specific line was already complete
        }

        // 🎉 ALL CONDITIONS MET! This is a valid bingo!
        console.log(
          `[checkBingo] ✅ VALID BINGO! Pattern ${pattern} - specific line ${specificLineInfo.lineType} ${specificLineInfo.lineIndex} completed by last call ${lastCalledNumber}`
        );
        validBingoPatterns.push(pattern);

        if (preferredPattern && preferredPattern === pattern) {
          isBingo = true;
          winningPattern = pattern;
          break;
        }
      } catch (err) {
        console.error(
          `[checkBingo] ❌ Error checking pattern ${pattern}:`,
          err
        );
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "failed",
          details: {
            cardId: numericCardId,
            callsMade,
            lastCalledNumber,
            error: `Pattern check failed: ${err.message}`,
            pattern,
            timestamp: new Date(),
          },
        });
      }
    }

    // Choose winning pattern (prefer user's choice if available)
    if (validBingoPatterns.length > 0) {
      isBingo = true;
      winningPattern = validBingoPatterns.includes(preferredPattern)
        ? preferredPattern
        : validBingoPatterns[0];
      console.log(
        `[checkBingo] 🎯 WINNER! Card ${numericCardId} wins with pattern "${winningPattern}"`
      );
    } else {
      console.log(
        `[checkBingo] 😔 No valid bingo for card ${numericCardId} - last call didn't complete any new specific line`
      );
    }

    // Initialize response object
    const response = {
      isBingo,
      winningPattern,
      validBingoPatterns,
      effectivePattern: winningPattern || patternsToCheck[0],
      lastCalledNumber,
      game: {
        ...game.toObject(),
        winnerCardNumbers: game.winnerCardNumbers || [],
        selectedWinnerNumbers: game.selectedWinnerNumbers || [],
      },
      winner: null,
      previousWinner: null,
    };

    // If game is completed, retrieve existing winner details
    if (game.status === "completed") {
      if (game.winner && game.winner.cardId) {
        const result = await Result.findOne({
          gameId: game._id,
          winnerCardId: game.winner.cardId,
        }).lean();
        response.previousWinner = {
          cardId: game.winner.cardId,
          prize: game.winner.prize,
          winningPattern: result?.winningPattern || null,
          userId: result?.userId || null,
          identifier: result?.identifier || null,
          isJackpot: result?.isJackpot || false,
        };
      }

      // Log the check for the provided card
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: isBingo ? "success" : "failed",
        details: {
          cardId: numericCardId,
          callsMade,
          lastCalledNumber,
          message: isBingo ? `Bingo with ${winningPattern}` : "No valid bingo",
          winningPattern: isBingo ? winningPattern : null,
          validBingoPatterns,
          patternsChecked: patternsToCheck,
          markedGrid: JSON.stringify(markedGrid),
          timestamp: new Date(),
        },
      });

      // Return response without modifying game state
      response.winner = isBingo
        ? {
            cardId: numericCardId,
            prize: game.prizePool,
            winningPattern,
            userId: req.user?._id || null,
            identifier: identifier || `${game._id}-${numericCardId}`,
          }
        : null;

      return res.json(response);
    }

    // If game is active or paused and bingo is found, update game state
    if (isBingo) {
      console.log(
        `[checkBingo] 🏆 FINALIZING WIN - Card ${numericCardId} is the winner!`
      );

      // 🔑 CRITICAL: Double-check that no other card has already won
      // 🔑 CRITICAL: Double-check that no other card has already won
      if (game.winner?.cardId) {
        // 👈 Use optional chaining
        console.warn(
          `[checkBingo] ⚠️ Game already has winner: ${game.winner.cardId}`
        );
        response.winner = null;
        response.isBingo = false;
        response.message = "Game already completed with another winner";
        return res.json(response);
      }

      game.winner = {
        cardId: numericCardId,
        prize: game.prizePool,
      };
      game.selectedWinnerNumbers = game.selectedWinnerNumbers || [];
      game.winnerCardNumbers = card.numbers;

      let jackpotAwarded = false;
      if (game.jackpotEnabled) {
        const jackpot = await Jackpot.findOne({ cashierId: game.cashierId });
        if (jackpot && jackpot.amount > 0) {
          game.winner.prize += jackpot.amount;
          jackpotAwarded = true;
          await logJackpotUpdate(-jackpot.amount, "Awarded", gameId);
          jackpot.amount = 0;
          await jackpot.save();
        }
      }

      game.status = "completed";
      await game.save();

      const resultIdentifier = identifier || `${game._id}-${numericCardId}`;
      await Result.create({
        gameId: game._id,
        winnerCardId: numericCardId,
        userId: req.user?._id || null,
        identifier: resultIdentifier,
        prize: game.winner.prize,
        isJackpot: jackpotAwarded,
        winningPattern,
        lastCalledNumber,
        timestamp: new Date(),
      });

      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "success",
        details: {
          cardId: numericCardId,
          callsMade,
          lastCalledNumber,
          jackpotAwarded,
          winningPattern,
          validBingoPatterns,
          identifier: resultIdentifier,
          completedByLastCall: true,
          timestamp: new Date(),
        },
      });

      response.winner = {
        cardId: numericCardId,
        prize: game.winner.prize,
        winningPattern,
        userId: req.user?._id || null,
        identifier: resultIdentifier,
        isJackpot: jackpotAwarded,
        completedByLastCall: true,
      };

      console.log(
        `[checkBingo] ✅ Game completed! Winner: Card ${numericCardId} with pattern "${winningPattern}" on call ${lastCalledNumber}`
      );
    } else {
      if (!markedGrid) {
        markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);
      }
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          cardId: numericCardId,
          callsMade,
          lastCalledNumber,
          message:
            "No valid bingo - last call didn't complete any new specific line",
          patternsChecked: patternsToCheck,
          validBingoPatterns,
          markedGrid: JSON.stringify(markedGrid),
          timestamp: new Date(),
        },
      });
    }

    res.json(response);
  } catch (err) {
    console.error("[checkBingo] ❌ ERROR:", err);
    await GameLog.create({
      gameId: req.params.id,
      action: "checkBingo",
      status: "failed",
      details: { error: err.message, timestamp: new Date() },
    });
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
      game: null,
    });
  }
};

export const finishGame = async (req, res, next) => {
  try {
    const gameId = req.params.id;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (!mongoose.isValidObjectId(gameId)) {
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

    const game = await Game.findOne({ _id: gameId, cashierId });
    if (!game) {
      await GameLog.create({
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

    if (game.status !== "active" && game.status !== "paused") {
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
      const jackpot = await Jackpot.findOne({ cashierId });
      if (jackpot) {
        await logJackpotUpdate(
          game.potentialJackpot,
          "Game contribution",
          gameId
        );
        jackpot.amount += game.potentialJackpot;
        await jackpot.save();
      }
    }

    await game.save();

    await GameLog.create({
      gameId,
      action: "gameCompleted",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        winnerCardId: game.winner?.cardId,
        prize: game.winner?.prize,
        moderatorWinnerCardId: game.moderatorWinnerCardId,
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
      },
    });

    res.json({
      message: "Game completed",
      game: {
        ...game.toObject(),
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
      },
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

export const pauseGame = async (req, res, next) => {
  try {
    const { gameId } = req.params;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const game = await Game.findOne({ _id: gameId, cashierId });
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

    game.status = "paused";
    await game.save();

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
        ...game.toObject(),
        status: "paused",
        winnerCardNumbers: game.winnerCardNumbers,
        selectedWinnerNumbers: game.selectedWinnerNumbers,
      },
    });
  } catch (error) {
    console.error("[pauseGame] Error pausing game:", error);
    await GameLog.create({
      gameId: req.params.gameId,
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

    const game = await Game.findOne({ _id: gameId, cashierId });
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

    game.status = status;
    await game.save();

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
        ...game.toObject(),
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
