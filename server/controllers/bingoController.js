import mongoose from "mongoose";
import {
  checkCardBingo,
  getMarkedGrid,
  getNumbersForPattern,
  getCashierIdFromUser,
  logJackpotUpdate,
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Result from "../models/Result.js";
import Jackpot from "../models/Jackpot.js";
import GameLog from "../models/GameLog.js";

// Call number
export const callNumber = async (req, res, next) => {
  try {
    const { gameId } = req.params;
    const { number } = req.body;
    const moderatorId = req.user?._id; // safe

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }
    if (game.status !== "active") {
      return res.status(400).json({ message: "Game is not active" });
    }

    const calledNumbers = game.calledNumbers || [];
    let numberToCall;
    let numberSource = "random";

    // --- forcedCallSequence logic ---
    if (game.forcedCallSequence && game.forcedCallSequence.length > 0) {
      if (number) {
        const num = Number(number);
        if (isNaN(num) || num < 1 || num > 75) {
          return res
            .status(400)
            .json({ message: "Invalid number. Must be between 1 and 75" });
        }
        if (!game.forcedCallSequence.includes(num)) {
          return res.status(400).json({
            message: "Provided number is not in the forced call sequence",
            forcedCallSequence: game.forcedCallSequence,
          });
        }
        if (calledNumbers.includes(num)) {
          return res.status(400).json({ message: "Number already called" });
        }
        numberToCall = num;
        numberSource = "manual";
        game.forcedCallSequence = game.forcedCallSequence.filter(
          (n) => n !== num
        );
      } else {
        numberToCall = game.forcedCallSequence[0];
        if (!numberToCall) {
          return res
            .status(400)
            .json({ message: "Forced call sequence is exhausted" });
        }
        if (calledNumbers.includes(numberToCall)) {
          game.forcedCallSequence = game.forcedCallSequence.slice(1);
          await game.save();
          return res.status(400).json({
            message: "Next number in sequence already called, try again",
          });
        }
        numberSource = "forced";
        game.forcedCallSequence = game.forcedCallSequence.slice(1);
      }
    } else {
      // --- manual/random ---
      if (number) {
        const num = Number(number);
        if (isNaN(num) || num < 1 || num > 75) {
          return res
            .status(400)
            .json({ message: "Invalid number. Must be between 1 and 75" });
        }
        if (calledNumbers.includes(num)) {
          return res.status(400).json({ message: "Number already called" });
        }
        numberToCall = num;
        numberSource = "manual";
      } else {
        const remainingNumbers = Array.from(
          { length: 75 },
          (_, i) => i + 1
        ).filter((n) => !calledNumbers.includes(n));
        if (remainingNumbers.length === 0) {
          return res.status(400).json({ message: "No numbers left to call" });
        }
        numberToCall =
          remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
        numberSource = "random";
      }
    }

    game.calledNumbers = [...calledNumbers, numberToCall];
    await game.save();

    await GameLog.create({
      gameId: game._id,
      action: "callNumber",
      status: "success",
      details: {
        gameNumber: game.gameNumber,
        moderatorId: moderatorId ? moderatorId.toString() : "unknown",
        calledNumber: numberToCall,
        numberSource,
        forcedCallSequence: game.forcedCallSequence,
        calledNumbers: game.calledNumbers,
        timestamp: new Date(),
      },
    });

    console.log(
      `[callNumber] Moderator ${
        moderatorId || "unknown"
      } called number ${numberToCall} for game ${
        game.gameNumber
      } (Source: ${numberSource}). Remaining forced sequence: ${JSON.stringify(
        game.forcedCallSequence
      )}`
    );

    res.json({
      message: "Number called successfully",
      game: {
        ...game.toObject(),
        calledNumbers: game.calledNumbers,
        forcedCallSequence: game.forcedCallSequence,
      },
    });
  } catch (error) {
    console.error("[callNumber] Error:", error);
    await GameLog.create({
      gameId: req.params?.gameId || null,
      action: "callNumber",
      status: "failed",
      details: {
        moderatorId: req.user?._id?.toString() || "unknown",
        error: error.message || "Internal server error",
        timestamp: new Date(),
      },
    });
    next(error);
  }
};

// Check bingo
export const checkBingo = async (req, res, next) => {
  try {
    const { cardId } = req.body;
    const gameId = req.params.id;

    if (!mongoose.isValidObjectId(gameId)) {
      return res.status(400).json({
        message: "Invalid game ID format",
        errorCode: "INVALID_GAME_ID",
      });
    }

    const numericCardId = Number(cardId);
    if (isNaN(numericCardId) || numericCardId < 1) {
      return res.status(400).json({
        message: "Invalid card ID",
        errorCode: "INVALID_CARD_ID",
      });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({
        message: "Game not found",
        errorCode: "GAME_NOT_FOUND",
      });
    }

    const card = game.selectedCards.find((c) => c.id === numericCardId);
    if (!card) {
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
      return res.status(400).json({
        message: `Invalid card numbers for card ${numericCardId}`,
        errorCode: "INVALID_CARD_NUMBERS",
      });
    }

    // For completed games, only allow the designated winner
    if (game.status === "completed") {
      const isWinner =
        (game.winner?.cardId && game.winner.cardId === numericCardId) ||
        (game.moderatorWinnerCardId &&
          game.moderatorWinnerCardId === numericCardId) ||
        (game.jackpotWinner?.cardId &&
          game.jackpotWinner.cardId === numericCardId);
      const markedGrid = getMarkedGrid(card.numbers, game.calledNumbers);
      const actualWinnerCardId =
        game.winner?.cardId ||
        game.moderatorWinnerCardId ||
        game.jackpotWinner?.cardId ||
        null;
      const actualWinnerCard = game.selectedCards.find(
        (c) => c.id === actualWinnerCardId
      );
      const winPattern = game.forcedPattern || game.pattern;

      return res.json({
        message: isWinner
          ? `Bingo! Card ${numericCardId} wins!`
          : `Card ${numericCardId} is not the winner`,
        game: {
          ...game.toObject(),
          winner: isWinner,
          prize: game.winner?.prize || game.jackpotWinner?.prize,
          winnerCardId: actualWinnerCardId,
          isYourCardWinner: isWinner,
          yourCardNumbers: card.numbers,
          winnerCardNumbers: actualWinnerCard ? actualWinnerCard.numbers : null,
          markedGrid,
          calledNumbers: game.calledNumbers,
          winPattern,
          freeMiddle: true, // Center is always free
        },
      });
    }

    if (!["active", "paused"].includes(game.status)) {
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
        }
      } else {
        winner = {
          cardId: numericCardId,
          prize:
            game.prizePool + (game.jackpotEnabled ? game.potentialJackpot : 0),
        };
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
    const actualWinnerCardId = game.winner?.cardId || null;
    const actualWinnerCard = game.selectedCards.find(
      (c) => c.id === actualWinnerCardId
    );
    const winPattern = game.forcedPattern || game.pattern;

    return res.json({
      message: winner
        ? `Bingo! Card ${numericCardId} wins!`
        : `No bingo yet for card ${numericCardId}`,
      game: {
        ...game.toObject(),
        winner: !!winner,
        prize: winner ? winner.prize : null,
        winnerCardId: actualWinnerCardId,
        isYourCardWinner: winner && winner.cardId === numericCardId,
        yourCardNumbers: card.numbers,
        winnerCardNumbers: actualWinnerCard ? actualWinnerCard.numbers : null,
        markedGrid,
        calledNumbers: game.calledNumbers,
        winPattern,
        freeMiddle: true, // Center is always free
      },
    });
  } catch (error) {
    console.error("[checkBingo] Error in checkBingo:", error);
    next(error);
  }
};

// Finish game
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
      },
    });

    res.json({
      message: "Game completed",
      game: {
        ...game.toObject(),
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

// Pause game
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
      details: { gameNumber: game.gameNumber },
    });

    res.json({
      message: `Game ${game.gameNumber} paused successfully`,
      game: {
        ...game.toObject(),
        status: "paused",
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
