import User from "../models/User.js";
import Game from "../models/Game.js";
import GameLog from "../models/GameLog.js";
import JackpotCandidate from "../models/JackpotCandidate.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import {
  getNextGameNumber,
  getCurrentGameNumber,
  createGameRecord,
  getCashierIdFromUser,
} from "../utils/gameUtils.js";
import Counter from "../models/Counter.js";
import Card from "../models/Card.js";
import {
  getNumbersForPattern,
  computeForcedSequence,
} from "../utils/bingoUtils.js";

export const addUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cashier, moderator } = req.body;

    if (
      !cashier?.name ||
      !cashier?.email ||
      !cashier?.password ||
      !moderator?.name ||
      !moderator?.email ||
      !moderator?.password
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          "Name, email, and password are required for both cashier and moderator",
      });
    }

    if (cashier.role !== "cashier" || moderator.role !== "moderator") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid roles specified" });
    }

    // Check for existing emails
    const [existingCashier, existingModerator] = await Promise.all([
      User.findOne({ email: cashier.email }).session(session),
      User.findOne({ email: moderator.email }).session(session),
    ]);

    if (existingCashier || existingModerator) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Email already exists in the database" });
    }

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const hashedCashierPassword = await bcrypt.hash(cashier.password, salt);
    const hashedModeratorPassword = await bcrypt.hash(moderator.password, salt);

    // Create cashier
    const newCashier = await User.create(
      [
        {
          name: cashier.name,
          email: cashier.email,
          password: hashedCashierPassword,
          role: "cashier",
        },
      ],
      { session }
    );

    // Create moderator linked to cashier
    const newModerator = await User.create(
      [
        {
          name: moderator.name,
          email: moderator.email,
          password: hashedModeratorPassword,
          role: "moderator",
          managedCashier: newCashier[0]._id,
        },
      ],
      { session }
    );

    // Update cashier with moderatorId
    await User.findByIdAndUpdate(
      newCashier[0]._id,
      { moderatorId: newModerator[0]._id },
      { session }
    );

    const { password: cPass, ...cashierWithoutPassword } =
      newCashier[0].toObject();
    const { password: mPass, ...moderatorWithoutPassword } =
      newModerator[0].toObject();

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Cashier and Moderator registered successfully",
      users: [cashierWithoutPassword, moderatorWithoutPassword],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding users:", error);
    next(error);
  }
};

// Get all users (only cashier and moderator)
export const getUsers = async (req, res, next) => {
  try {
    const requestingUser = req.user; // Assuming req.user is the logged-in user
    let users;

    if (requestingUser.role === "moderator") {
      // Find the paired cashier using managedCashier
      const pairedCashier = await User.findById(requestingUser.managedCashier);

      if (!pairedCashier) {
        return res.status(404).json({ message: "No paired cashier found" });
      }

      users = [pairedCashier, requestingUser];
    } else {
      users = await User.find(
        { role: { $in: ["cashier", "moderator"] } },
        "-password"
      ).sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const user = await User.findById(id).session(session);

    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Cannot delete an admin" });
    }

    // Identify linked pair
    let cashier = null;
    let moderator = null;

    if (user.role === "cashier") {
      cashier = user;
      moderator = await User.findById(user.moderatorId).session(session);
    } else if (user.role === "moderator") {
      moderator = user;
      cashier = await User.findById(user.managedCashier).session(session);
    }

    // If deleting a cashier -> cleanup games
    if (cashier) {
      const gameIds = await Game.find({ cashierId: cashier._id })
        .distinct("_id")
        .session(session);

      if (gameIds.length) {
        await GameLog.deleteMany({ gameId: { $in: gameIds } }).session(session);
        await JackpotCandidate.deleteMany({ gameId: { $in: gameIds } }).session(
          session
        );
        await Game.deleteMany({ cashierId: cashier._id }).session(session);
      }
    }

    // Delete both sides of the pair safely
    if (cashier) {
      await User.findByIdAndDelete(cashier._id).session(session);
    }
    if (moderator) {
      await User.findByIdAndDelete(moderator._id).session(session);
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "User and their linked pair deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting user:", error);
    next(error);
  }
};

// Get all games (admin only)
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

// Get next pending game
export const getNextPendingGame = async (req, res, next) => {
  try {
    const game = await Game.findOne({ status: "pending" })
      .sort({ gameNumber: 1 })
      .lean();
    if (!game) {
      return res.status(404).json({ message: "No pending games found" });
    }
    res.json({ message: "Next pending game retrieved", data: game });
  } catch (error) {
    console.error("[getNextPendingGame] Error in getNextPendingGame:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get all cards
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
    console.error("[getAllCards] Error in getAllCards:", error);
    next(error);
  }
};

// Create sequential games
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
      return res.status(400).json({ message: "Invalid game pattern" });
    }

    if (!count || count <= 0) {
      return res.status(400).json({ message: "Count must be > 0" });
    }

    if (!selectedCards.length) {
      return res.status(400).json({ message: "No cards selected" });
    }

    const cardIds = selectedCards
      .map((c) =>
        typeof c === "object" && "id" in c ? Number(c.id) : Number(c)
      )
      .filter((id) => !isNaN(id));

    const cards = await Card.find({ card_number: { $in: cardIds } });
    if (!cards.length) {
      return res.status(400).json({ message: "No valid cards found" });
    }

    const gameCards = cards.map((card) => ({
      id: card.card_number,
      numbers: card.numbers,
    }));

    const createdGames = [];
    let currentGameNumber = await getCurrentGameNumber();
    if (!currentGameNumber) currentGameNumber = 1;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    for (let i = 0; i < count; i++) {
      const gameNumber = await getNextGameNumber(currentGameNumber + i);
      const totalPot = betAmount * gameCards.length;
      const houseFee = (totalPot * houseFeePercentage) / 100;
      const potentialJackpot = jackpotEnabled ? totalPot * 0.1 : 0;
      const prizePool = totalPot - houseFee - potentialJackpot;

      let moderatorWinnerCardId = moderatorWinnerCardIds[i]
        ? Number(moderatorWinnerCardIds[i])
        : null;
      let finalJackpotEnabled = jackpotEnabled;
      let forcedPattern = null;
      let selectedWinnerRowIndices = [];
      let forcedCallSequence = [];

      if (!moderatorWinnerCardId) {
        const futureWinning = await Counter.findOne({
          _id: `futureWinning_${gameNumber}`,
        });
        if (futureWinning && futureWinning.cardId !== undefined) {
          moderatorWinnerCardId = Number(futureWinning.cardId);
          finalJackpotEnabled =
            futureWinning.jackpotEnabled !== undefined
              ? futureWinning.jackpotEnabled
              : jackpotEnabled;
          // Compute sequence for future winner
          if (futureWinning.numbers) {
            let usePattern = pattern;
            if (pattern === "all") {
              const patternChoices = validPatterns.filter((p) => p !== "all");
              usePattern =
                patternChoices[
                  Math.floor(Math.random() * patternChoices.length)
                ];
              forcedPattern = usePattern;
            }
            const { selectedIndices } = getNumbersForPattern(
              futureWinning.numbers,
              usePattern,
              [],
              true
            );
            const flatNumbers = futureWinning.numbers.flat();
            const required_numbers = selectedIndices.map(
              (idx) => flatNumbers[idx]
            );
            forcedCallSequence = computeForcedSequence(required_numbers);
            selectedWinnerRowIndices = selectedIndices;
          }
        }
      }

      if (
        moderatorWinnerCardId &&
        !gameCards.some((card) => card.id === Number(moderatorWinnerCardId))
      ) {
        continue;
      }

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
          const flatNumbers = winnerCard.numbers.flat();
          const required_numbers = selectedIndices.map(
            (idx) => flatNumbers[idx]
          );
          forcedCallSequence = computeForcedSequence(required_numbers);
          selectedWinnerRowIndices = selectedIndices;
        }
      }

      const game = await createGameRecord({
        gameNumber,
        cashierId,
        betAmount,
        houseFeePercentage,
        houseFee,
        selectedCards: gameCards,
        pattern,
        prizePool,
        potentialJackpot: finalJackpotEnabled ? totalPot * 0.1 : 0,
        moderatorWinnerCardId,
        selectedWinnerRowIndices,
        forcedPattern,
        forcedCallSequence,
        jackpotEnabled: finalJackpotEnabled,
      });

      createdGames.push(game);
    }

    res.json({ message: "Sequential games created", data: createdGames });
  } catch (error) {
    console.error(
      "[createSequentialGames] Error in createSequentialGames:",
      error
    );
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

// Configure future winners
export const configureFutureWinners = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { winners } = req.body;

    // Normalize moderatorId (JWT may have "id" instead of "_id")
    const moderatorId = req.user?._id || req.user?.id;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (!Array.isArray(winners) || winners.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid winners array" });
    }

    const configured = [];
    const validPatterns = [
      "four_corners_center",
      "cross",
      "main_diagonal",
      "other_diagonal",
      "horizontal_line",
      "vertical_line",
    ];

    for (const { gameNumber, cardId, jackpotEnabled = true } of winners) {
      if (!gameNumber || !cardId) {
        console.log(
          `[configureFutureWinners] Skipping invalid entry: gameNumber=${gameNumber}, cardId=${cardId}`
        );
        continue;
      }

      const parsedCardId = Number(cardId);
      if (isNaN(parsedCardId)) {
        console.log(`[configureFutureWinners] Invalid cardId: ${cardId}`);
        continue;
      }

      const card = await Card.findOne({ card_number: parsedCardId }).session(
        session
      );
      if (!card) {
        console.log(`[configureFutureWinners] Card not found: ${parsedCardId}`);
        continue;
      }

      let game = await Game.findOne({ gameNumber, cashierId }).session(session);

      if (game) {
        const winnerCard = game.selectedCards.find(
          (c) => c.id === parsedCardId
        );
        if (!winnerCard) {
          console.log(
            `[configureFutureWinners] Winner card ${parsedCardId} not in game ${gameNumber}`
          );
          continue;
        }

        let usePattern = game.pattern;
        let forcedPattern = null;
        if (game.pattern === "all") {
          usePattern =
            validPatterns[Math.floor(Math.random() * validPatterns.length)];
          forcedPattern = usePattern;
          console.log(
            `[configureFutureWinners] Pattern 'all' detected for game ${gameNumber}, selected: ${forcedPattern}`
          );
        }

        const { selectedIndices, selectedNumbers } = getNumbersForPattern(
          winnerCard.numbers,
          usePattern,
          [],
          true
        );
        console.log(
          `[configureFutureWinners] Required numbers for pattern ${usePattern} in game ${gameNumber}: ${selectedNumbers}`
        );

        const forcedCallSequence = computeForcedSequence(
          selectedNumbers,
          10,
          15
        );
        console.log(
          `[configureFutureWinners] Forced call sequence for game ${gameNumber}: ${JSON.stringify(
            forcedCallSequence
          )}`
        );

        game.moderatorWinnerCardId = parsedCardId;
        game.selectedWinnerRowIndices = selectedIndices;
        game.forcedPattern = forcedPattern;
        game.forcedCallSequence = forcedCallSequence;
        game.jackpotEnabled = jackpotEnabled;
        await game.save({ session });

        await GameLog.create(
          [
            {
              gameId: game._id,
              action: "configureFutureWinner",
              status: "success",
              details: {
                gameNumber,
                moderatorId: moderatorId ? moderatorId.toString() : "unknown",
                winnerCardId: parsedCardId,
                gameStatus: game.status,
                selectedWinnerRowIndices: selectedIndices,
                forcedPattern,
                forcedCallSequence,
                jackpotEnabled,
                timestamp: new Date(),
              },
            },
          ],
          { session }
        );

        console.log(
          `[configureFutureWinners] Moderator ${
            moderatorId || "unknown"
          } configured winner for game ${gameNumber} (Status: ${
            game.status
          }): Card ID ${parsedCardId}, Pattern: ${
            forcedPattern || usePattern
          }, Forced Call Sequence: ${JSON.stringify(forcedCallSequence)}`
        );

        configured.push(game);
      } else {
        const counterId = `${cashierId}_futureWinning_${gameNumber}`;
        await Counter.findOneAndUpdate(
          { _id: counterId },
          { cardId: parsedCardId, jackpotEnabled, numbers: card.numbers },
          { upsert: true, new: true, session }
        );

        await GameLog.create(
          [
            {
              gameId: null,
              action: "configureFutureWinner",
              status: "success",
              details: {
                gameNumber,
                moderatorId: moderatorId ? moderatorId.toString() : "unknown",
                winnerCardId: parsedCardId,
                numbers: card.numbers,
                jackpotEnabled,
                timestamp: new Date(),
              },
            },
          ],
          { session }
        );

        console.log(
          `[configureFutureWinners] Moderator ${
            moderatorId || "unknown"
          } configured future winner for non-existent game ${gameNumber}: Card ID ${parsedCardId}, Jackpot Enabled: ${jackpotEnabled}`
        );

        configured.push({ gameNumber, cardId: parsedCardId, jackpotEnabled });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "Future winners configured", data: configured });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("[configureFutureWinners] Error:", error);
    await GameLog.create({
      gameId: null,
      action: "configureFutureWinner",
      status: "failed",
      details: {
        moderatorId:
          req.user?._id?.toString?.() ||
          req.user?.id?.toString?.() ||
          "unknown",
        error: error.message || "Internal server error",
        timestamp: new Date(),
      },
    });
    next(error);
  }
};

// Moderator configure next game number
export const moderatorConfigureNextGameNumber = async (req, res, next) => {
  try {
    const { startNumber } = req.body;

    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    if (typeof startNumber !== "number" || startNumber < 1) {
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

    const lastGame = await Game.findOne({ cashierId })
      .sort({ gameNumber: -1 })
      .lean();
    if (lastGame && lastGame.gameNumber >= startNumber) {
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
      { _id: `gameNumber_${cashierId}` },
      { seq: startNumber, cashierId },
      { upsert: true, new: true }
    );

    await GameLog.create({
      gameId: null,
      action: "configureNextGameNumber",
      status: "success",
      details: { startNumber, cashierId },
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

// Get finished games
export const getFinishedGames = async (req, res, next) => {
  try {
    const finishedGames = await Game.find({ status: "completed" })
      .sort({ gameNumber: 1 })
      .select("_id gameNumber winner moderatorWinnerCardId");

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

// Get game logs
export const getGameLogs = async (req, res, next) => {
  try {
    await getCashierIdFromUser(req, res, () => {});
    const cashierId = req.cashierId;

    const logs = await GameLog.find({
      gameId: { $in: await Game.find({ cashierId }).distinct("_id") },
    }).sort({ timestamp: -1 });

    res.json({
      message: "Game logs retrieved successfully",
      data: logs,
    });
  } catch (error) {
    console.error("[getGameLogs] Error:", error);
    next(error);
  }
};
