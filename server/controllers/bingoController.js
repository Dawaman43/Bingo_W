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
    const { cardId, identifier, preferredPattern } = req.body;
    const gameId = req.params.id;

    console.log(
      `[checkBingo] 🔵 START — cardId: ${cardId}, identifier: ${identifier}, preferredPattern: ${preferredPattern}, gameId: ${gameId}`
    );

    // OPTIMIZED: Lean + select (essentials only)
    const game = await Game.findById(gameId)
      .select(
        "gameNumber status calledNumbers calledNumbersLog selectedCards forced* pattern winner prizePool"
      )
      .lean();

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

    console.log(
      `[checkBingo] 📊 Game details: status=${game.status}, pattern=${
        game.pattern || game.forcedPattern
      }, calledNumbers.length=${
        game.calledNumbers?.length || 0
      }, selectedCards.length=${game.selectedCards?.length || 0}`
    );

    const numericCardId = Number(cardId);
    console.log(
      `[checkBingo] 🔍 Searching for cardId: ${cardId} (parsed: ${numericCardId})`
    );

    // ENHANCED LOG: List available IDs for debugging
    const availableCardIds =
      game.selectedCards?.map((c) => ({ id: c.id, type: typeof c.id })) || [];
    console.log(
      `[checkBingo] 📋 Available cards: ${JSON.stringify(
        availableCardIds.slice(0, 5)
      )}... (total: ${availableCardIds.length})`
    );

    // FIXED: Handle potential string IDs
    let cardRef = game.selectedCards?.find(
      (c) => c.id === numericCardId || String(c.id) === String(cardId)
    );
    if (!cardRef) {
      console.warn(
        `[checkBingo] ❌ Card not in game: ${numericCardId} (${cardId})`
      );
      console.log(`[checkBingo] ❌ No match in available IDs`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: `Card ${numericCardId} (${cardId}) not in game`,
          availableIds: availableCardIds.map((c) => c.id),
          timestamp: new Date(),
        },
      });
      return res
        .status(400)
        .json({ message: "Chosen card not selected in this game" });
    }

    // NEW: Fetch full card by card_number (per schema)
    const fullCard = await Card.findOne({ card_number: numericCardId })
      .select("numbers") // OPTIMIZED: Only fetch grid
      .lean();
    if (
      !fullCard ||
      !fullCard.numbers ||
      !Array.isArray(fullCard.numbers) ||
      fullCard.numbers.length !== 5
    ) {
      console.warn(
        `[checkBingo] ❌ Full card invalid/missing numbers: ${numericCardId} (grid: ${
          fullCard?.numbers?.length || 0
        }x? )`
      );
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: {
          error: `Invalid card grid for ${numericCardId}`,
          timestamp: new Date(),
        },
      });
      return res
        .status(404)
        .json({ message: "Card grid not found or invalid" });
    }

    // Merge lightweight ref with full card (per-game state + static grid)
    const card = {
      ...fullCard,
      checkCount: cardRef.checkCount || 0,
      disqualified: cardRef.disqualified || false,
      lastCheckTime: cardRef.lastCheckTime || null,
    };

    console.log(
      `[checkBingo] ✅ Found card ${numericCardId}: numbers[0][0]=${
        card.numbers[0][0] // FIXED: Safe access to 2D grid
      }, checkCount=${card.checkCount}, disqualified=${card.disqualified}`
    );

    // OPTIMIZED: Collect updates for batch atomic save
    let cardUpdate = {};
    let updateNeeded = false;
    const currentTime = new Date();
    const lastCalledNumber =
      game.calledNumbersLog?.[game.calledNumbersLog.length - 1] || null;
    const lastCalledTime = lastCalledNumber?.calledAt;

    console.log(
      `[checkBingo] ⏰ Timestamps: lastCheck=${card.lastCheckTime}, lastCalled=${lastCalledTime}`
    );

    if (
      card.lastCheckTime &&
      lastCalledTime &&
      new Date(card.lastCheckTime) >= new Date(lastCalledTime)
    ) {
      console.log(
        `[checkBingo] 🔄 No new number since last check for card ${numericCardId}. Resetting checkCount/disqualified.`
      );
      card.checkCount = 1;
      card.disqualified = false;
      cardUpdate.checkCount = 1;
      cardUpdate.disqualified = false;
      updateNeeded = true;
    } else {
      card.checkCount = (card.checkCount || 0) + 1;
      cardUpdate.checkCount = card.checkCount;
      updateNeeded = true;
    }

    card.lastCheckTime = currentTime;
    cardUpdate.lastCheckTime = currentTime;
    updateNeeded = true;

    // Check disqualification or excessive checks
    if (card.disqualified || card.checkCount > 1) {
      console.log(
        `[checkBingo] ❌ Card ${numericCardId} disqualified (disqualified: ${card.disqualified}, checkCount: ${card.checkCount})`
      );
      if (updateNeeded) {
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.disqualified`]: true,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
      }
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "disqualified",
        details: {
          cardId: numericCardId,
          message: card.disqualified
            ? "Already disqualified"
            : "Multiple checks",
          checkCount: card.checkCount,
          disqualified: true,
          timestamp: new Date(),
        },
      });
      return res.json({
        isBingo: false,
        message: card.disqualified
          ? "Card is disqualified and cannot win"
          : "Card cannot win due to multiple checks",
        winningPattern: null,
        validBingoPatterns: [],
        completedPatterns: [],
        disqualified: true,
        checkCount: card.checkCount,
        game: {
          ...game,
          winnerCardNumbers: game.winnerCardNumbers || [],
          selectedWinnerNumbers: game.selectedWinnerNumbers || [],
        },
      });
    }

    if (!["active", "paused", "completed"].includes(game.status)) {
      console.warn(`[checkBingo] ❌ Game not checkable: status=${game.status}`);
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "failed",
        details: { error: `Status: ${game.status}`, timestamp: new Date() },
      });
      return res.status(400).json({ message: "Game not checkable" });
    }

    if (!lastCalledNumber) {
      console.log(`[checkBingo] ❌ No calls yet`);
      return res.json({
        isBingo: false,
        message: "No numbers called yet",
        winningPattern: null,
        validBingoPatterns: [],
        completedPatterns: [],
        disqualified: false,
        checkCount: card.checkCount,
        game: {
          ...game,
          winnerCardNumbers: game.winnerCardNumbers || [],
          selectedWinnerNumbers: game.selectedWinnerNumbers || [],
        },
      });
    }

    console.log(
      `[checkBingo] 🎯 Last called: ${lastCalledNumber.number} at ${lastCalledTime}`
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
    console.log(
      `[checkBingo] 🔄 Patterns to check: [${patternsToCheck.join(", ")}]`
    );

    let isBingo = false;
    let winningPattern = null;
    let markedGrid = getMarkedGrid(card.numbers, game.calledNumbers); // FIXED: Uses full 2D grid
    const validBingoPatterns = [];
    const completedPatterns = [];
    let winningLineInfo = null;

    const previousCalledNumbers = game.calledNumbers.slice(0, -1);
    console.log(
      `[checkBingo] 📈 Previous called count: ${previousCalledNumbers.length}`
    );

    // Check all patterns for completion
    for (const pattern of patternsToCheck) {
      if (!validPatterns.includes(pattern)) {
        console.error(`[checkBingo] ❌ Invalid pattern: ${pattern}`);
        continue;
      }
      try {
        const [isComplete] = checkCardBingo(
          card.numbers, // FIXED: Full 2D grid
          game.calledNumbers,
          pattern
        );
        if (isComplete) {
          console.log(`[checkBingo] ✅ Pattern ${pattern} complete`);
          completedPatterns.push({ pattern });
        }
      } catch (err) {
        console.error(`[checkBingo] ❌ Error checking ${pattern}:`, err);
      }
    }

    // Check for bingo by last call
    let specificLineInfo = null;
    for (const pattern of patternsToCheck) {
      if (!validPatterns.includes(pattern)) continue;
      try {
        specificLineInfo = getSpecificLineInfo(
          card.numbers, // FIXED: Full grid
          pattern,
          lastCalledNumber.number
        );
        console.log(
          `[checkBingo] 🎲 Pattern ${pattern}: lineInfo=${JSON.stringify(
            specificLineInfo
          )}`
        );

        if (!specificLineInfo) {
          console.log(
            `[checkBingo] ❌ Last call ${lastCalledNumber.number} not in ${pattern}`
          );
          continue;
        }

        const currentLineComplete = checkSpecificLineCompletion(
          card.numbers, // FIXED
          game.calledNumbers,
          pattern,
          specificLineInfo
        );
        console.log(
          `[checkBingo] 📊 ${pattern}: current=${currentLineComplete} (${
            specificLineInfo.lineType
          } ${specificLineInfo.lineIndex || ""})`
        );

        if (!currentLineComplete) continue;

        const wasPreviouslyComplete = checkSpecificLineCompletion(
          card.numbers, // FIXED
          previousCalledNumbers,
          pattern,
          specificLineInfo
        );
        console.log(
          `[checkBingo] 📊 ${pattern}: previous=${wasPreviouslyComplete}`
        );

        if (wasPreviouslyComplete) {
          console.log(
            `[checkBingo] ❌ ${pattern} already complete before last call`
          );
          continue;
        }

        console.log(
          `[checkBingo] 🏆 VALID BINGO! ${pattern} completed by ${lastCalledNumber.number}`
        );
        validBingoPatterns.push(pattern);

        if (!winningLineInfo) {
          const patternResult = getNumbersForPattern(
            card.numbers, // FIXED
            pattern,
            game.calledNumbers,
            true,
            specificLineInfo.lineIndex ? [specificLineInfo.lineIndex] : [],
            true
          );
          winningLineInfo = {
            pattern,
            lineInfo: specificLineInfo,
            ...patternResult,
          };
          console.log(
            `[checkBingo] 📝 Winning line:`,
            JSON.stringify(winningLineInfo, null, 2)
          );
        }

        if (preferredPattern === pattern) {
          isBingo = true;
          winningPattern = pattern;
          break;
        }
      } catch (err) {
        console.error(`[checkBingo] ❌ Error in ${pattern}:`, err);
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "failed",
          details: {
            cardId: numericCardId,
            callsMade: game.calledNumbers.length,
            lastCalled: lastCalledNumber?.number,
            error: err.message,
            pattern,
            timestamp: new Date(),
          },
        });
      }
    }

    if (validBingoPatterns.length > 0) {
      isBingo = true;
      winningPattern = validBingoPatterns.includes(preferredPattern)
        ? preferredPattern
        : validBingoPatterns[0];
      console.log(
        `[checkBingo] 🎯 WINNER! Card ${numericCardId} with ${winningPattern}`
      );
    } else {
      console.log(`[checkBingo] 😔 No valid bingo for ${numericCardId}`);
    }

    // Response init
    let response = {
      isBingo,
      winningPattern,
      validBingoPatterns,
      completedPatterns,
      effectivePattern: winningPattern || patternsToCheck[0],
      lastCalledNumber: lastCalledNumber?.number,
      winningLineInfo: winningLineInfo || null,
      game: {
        ...game,
        winnerCardNumbers: game.winnerCardNumbers || [],
        selectedWinnerNumbers: game.selectedWinnerNumbers || [],
      },
      winner: null,
      previousWinner: null,
      lateCall: false,
      lateCallMessage: null,
      wouldHaveWon: null,
      disqualified: card.disqualified || false,
      checkCount: card.checkCount,
    };

    let lateCallMessage = null;
    let wouldHaveWon = null;

    // Late call check for potential win
    if (isBingo && winningPattern) {
      if (card.disqualified || card.checkCount > 1) {
        console.log(
          `[checkBingo] ❌ Disqualified despite bingo: ${numericCardId}`
        );
        response.isBingo = false;
        response.winningPattern = null;
        response.winningLineInfo = null;
        response.message = card.disqualified
          ? "Card disqualified"
          : "Multiple checks";
        response.disqualified = true;
        response.checkCount = card.checkCount;
        // Batch update (as before)
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1 && updateNeeded) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.disqualified`]: true,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "disqualified",
          details: {
            cardId: numericCardId,
            message: card.disqualified
              ? "Already disqualified"
              : "Multiple checks",
            checkCount: card.checkCount,
            disqualified: true,
            timestamp: new Date(),
          },
        });
        return res.json(response);
      }

      // FIXED: Pass 2D numbers + lineInfo
      const lateCallResult = await detectLateCallForCurrentPattern(
        card.numbers, // 2D from fullCard
        winningPattern,
        game.calledNumbers,
        gameId,
        specificLineInfo // From loop
      );

      console.log(
        `[checkBingo] 🕒 Late result for ${winningPattern}:`,
        JSON.stringify(lateCallResult, null, 2)
      );

      if (lateCallResult && lateCallResult.hasMissedOpportunity) {
        cardUpdate.disqualified = true;
        updateNeeded = true;
        lateCallMessage = lateCallResult.message;
        wouldHaveWon = lateCallResult.details;
        response.lateCall = true;
        response.lateCallMessage = lateCallMessage;
        response.wouldHaveWon = wouldHaveWon;
        response.isBingo = false;
        response.winningPattern = null;
        response.winningLineInfo = null;
        response.disqualified = true;
        response.message = `Disqualified: ${lateCallMessage}`;
        // Batch save & log
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.disqualified`]:
                cardUpdate.disqualified,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "late_call",
          details: {
            cardId: numericCardId,
            message: lateCallMessage,
            wouldHaveWon,
            timestamp: new Date(),
          },
        });
        return res.json(response);
      } else {
        console.log(`[checkBingo] ✅ Legit win: no late call`);
      }
    } else if (completedPatterns.length > 0 || game.status === "completed") {
      // FIXED: Use fixed detectLateCallOpportunity with full grid
      const lateCallResult = await detectLateCallOpportunity(
        card.numbers, // 2D
        game.calledNumbers,
        game.calledNumbersLog,
        patternsToCheck,
        lastCalledNumber?.number
      );
      if (lateCallResult && lateCallResult.hasMissedOpportunity) {
        // Disqualify & return (similar to above)
        cardUpdate.disqualified = true;
        updateNeeded = true;
        lateCallMessage = lateCallResult.message;
        wouldHaveWon = lateCallResult.details;
        response.lateCall = true;
        response.lateCallMessage = lateCallMessage;
        response.wouldHaveWon = wouldHaveWon;
        response.disqualified = true;
        response.message = `Late call detected: ${lateCallMessage}`;
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.disqualified`]: true,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "late_call",
          details: {
            cardId: numericCardId,
            message: lateCallMessage,
            wouldHaveWon,
            timestamp: new Date(),
          },
        });
        return res.json(response);
      }
    }

    // Completed game handling
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
      // Log & batch save
      if (updateNeeded) {
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
      }
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: "completed_check",
        details: {
          cardId: numericCardId,
          message: "Checked in completed game",
          timestamp: new Date(),
        },
      });
      return res.json(response);
    }

    if (isBingo) {
      // Final disqual check (safe)
      if (card.disqualified || card.checkCount > 1) {
        // Handle as above (disqual response)
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1 && updateNeeded) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.disqualified`]: true,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "disqualified",
          details: {
            cardId: numericCardId,
            message: "Disqualified on win attempt",
            checkCount: card.checkCount,
            timestamp: new Date(),
          },
        });
        response.isBingo = false;
        response.message = "Disqualified";
        return res.json(response);
      }

      console.log(`[checkBingo] 🏆 FINAL WIN PROCESS for ${numericCardId}`);

      // Transaction for atomic win
      const session = await Game.startSession();
      let winnerAssigned = false;
      let txError = null;
      try {
        await session.withTransaction(
          async () => {
            const freshGameDoc = await Game.findById(gameId).session(session);
            if (!freshGameDoc) throw new Error("Game not found");
            if (freshGameDoc.winner?.cardId)
              throw new Error("already has a winner");
            freshGameDoc.winner = {
              cardId: numericCardId,
              prize: freshGameDoc.prizePool,
            };
            freshGameDoc.selectedWinnerNumbers =
              freshGameDoc.selectedWinnerNumbers || [];
            freshGameDoc.winnerCardNumbers = card.numbers; // FIXED: Full grid from Card
            freshGameDoc.status = "completed";
            await freshGameDoc.save({ session });
            const resultIdentifier =
              identifier || `${freshGameDoc._id}-${numericCardId}`;
            await Result.create(
              [
                {
                  gameId: freshGameDoc._id,
                  winnerCardId: numericCardId,
                  userId: req.user?._id || null,
                  identifier: resultIdentifier,
                  prize: freshGameDoc.winner.prize,
                  isJackpot: false,
                  winningPattern,
                  lastCalledNumber: lastCalledNumber?.number,
                  timestamp: new Date(),
                },
              ],
              { session }
            );
            winnerAssigned = true;
          },
          { readPreference: "primary", maxTimeMS: 5000, retryWrites: true }
        );
      } catch (error) {
        txError = error;
        await session.abortTransaction();
        console.error(`[checkBingo] ❌ Tx failed for ${numericCardId}:`, error);
      } finally {
        await session.endSession();
      }

      if (winnerAssigned) {
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "success",
          details: {
            cardId: numericCardId,
            callsMade: game.calledNumbers.length,
            lastCalledNumber: lastCalledNumber?.number,
            jackpotAwarded: false,
            winningPattern,
            validBingoPatterns,
            identifier: identifier || `${game._id}-${numericCardId}`,
            completedByLastCall: true,
            winningLineInfo,
            disqualified: false,
            checkCount: card.checkCount,
            timestamp: new Date(),
          },
        });
        response.winner = {
          cardId: numericCardId,
          prize: game.prizePool,
          winningPattern,
          userId: req.user?._id || null,
          identifier: identifier || `${game._id}-${numericCardId}`,
          isJackpot: false,
          completedByLastCall: true,
        };
        response.checkCount = card.checkCount;
        console.log(
          `[checkBingo] ✅ WIN ASSIGNED! Game completed, winner: ${numericCardId} (${winningPattern})`
        );
      } else {
        response.isBingo = false;
        response.winningPattern = null;
        response.winningLineInfo = null;
        response.winner = null;
        response.message =
          txError.message === "already has a winner"
            ? "Already winner found"
            : "System error in win processing";
        console.error(`[checkBingo] ❌ Win failed: ${txError?.message}`);
        // Log failure
        await GameLog.create({
          gameId,
          action: "checkBingo",
          status: "failed",
          details: {
            cardId: numericCardId,
            error: txError?.message,
            timestamp: new Date(),
          },
        });
        // Batch save if needed
        if (updateNeeded) {
          const cardIndex = game.selectedCards.findIndex(
            (c) => c.id === numericCardId || String(c.id) === String(cardId)
          );
          if (cardIndex > -1) {
            await Game.findByIdAndUpdate(gameId, {
              $set: {
                [`selectedCards.${cardIndex}.checkCount`]:
                  cardUpdate.checkCount,
                [`selectedCards.${cardIndex}.lastCheckTime`]:
                  cardUpdate.lastCheckTime,
              },
            });
          }
        }
        return res.json(response);
      }
    } else {
      await GameLog.create({
        gameId,
        action: "checkBingo",
        status: lateCallMessage ? "late_call" : "failed",
        details: {
          cardId: numericCardId,
          callsMade: game.calledNumbers.length,
          lastCalledNumber: lastCalledNumber?.number,
          message: lateCallMessage || "No valid bingo",
          patternsChecked: patternsToCheck,
          validBingoPatterns,
          completedPatterns,
          lateCall: !!lateCallMessage,
          lateCallDetails: wouldHaveWon,
          disqualified: card.disqualified || false,
          checkCount: card.checkCount,
          markedGrid: JSON.stringify(markedGrid),
          timestamp: new Date(),
        },
      });
      // Batch save
      if (updateNeeded) {
        const cardIndex = game.selectedCards.findIndex(
          (c) => c.id === numericCardId || String(c.id) === String(cardId)
        );
        if (cardIndex > -1) {
          await Game.findByIdAndUpdate(gameId, {
            $set: {
              [`selectedCards.${cardIndex}.checkCount`]: cardUpdate.checkCount,
              [`selectedCards.${cardIndex}.lastCheckTime`]:
                cardUpdate.lastCheckTime,
            },
          });
        }
      }
    }

    console.log(
      `[checkBingo] 🟢 END — Response: isBingo=${response.isBingo}, lateCall=${response.lateCall}, disqualified=${response.disqualified}`
    );
    return res.json(response);
  } catch (err) {
    console.error("[checkBingo] ❌ CRITICAL ERROR:", err);
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

  // Helper to log safely without throwing
  const safeLog = async (logData) => {
    try {
      await GameLog.create(logData);
    } catch (err) {
      console.error("Failed to log game action:", err.message);
    }
  };

  try {
    // ✅ Get cashierId directly from token payload
    const cashierId = req.user?.id;
    if (!cashierId) {
      console.warn(`[finishGame] cashierId missing for game ${gameId}`);
    }

    // ✅ Validate gameId
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

    // FIXED: Include gameNumber in select
    // OPTIMIZED: Lean for read
    const game = await Game.findOne({ _id: gameId, cashierId })
      .select("gameNumber") // ✅ Light include
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

    // ✅ Check game status
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

    // OPTIMIZED: Atomic update for status
    const updatedGame = await Game.findByIdAndUpdate(
      gameId,
      { status: "completed" },
      { new: true }
    )
      .select("gameNumber") // ✅ Include
      .lean();

    // ✅ Handle jackpot safely
    if (game.jackpotEnabled && game.winner) {
      try {
        if (!cashierId) throw new Error("Missing cashierId for jackpot");

        // OPTIMIZED: Lean on Jackpot
        let jackpot = await Jackpot.findOne({ cashierId }).lean();
        if (jackpot) {
          const newAmount =
            (jackpot.amount ?? 0) + (game.potentialJackpot ?? 0);
          await Jackpot.findByIdAndUpdate(jackpot._id, { amount: newAmount });

          if (cashierId) {
            try {
              await JackpotLog.create({
                cashierId,
                amount: game.potentialJackpot ?? 0,
                reason: "Game contribution",
                gameId,
              });
            } catch (err) {
              console.error(
                `[finishGame] JackpotLog creation failed:`,
                err.message
              );
            }
          }
        } else {
          console.warn(
            `[finishGame] No jackpot found for cashierId ${cashierId}`
          );
        }
      } catch (err) {
        console.error(`[finishGame] Jackpot processing error:`, err.message);
      }
    }

    // ✅ Log success
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

    // ✅ Respond
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

    // ✅ Always return JSON, never HTML
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
      .select("gameNumber") // ✅ Light include
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
