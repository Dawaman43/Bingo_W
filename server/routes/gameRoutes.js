import express from "express";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  getJackpot,
  getPairedCashier,
  updateJackpot,
  setJackpotAmount,
  addJackpotContribution,
  toggleJackpot,
  awardJackpot,
  getJackpotHistory,
} from "../controllers/jackpotController.js";
import { getCashierReport } from "../controllers/reportController.js";
import {
  configureFutureWinners,
  createSequentialGames,
  getAllCards,
  getAllGames,
  getNextPendingGame,
  moderatorConfigureNextGameNumber,
} from "../controllers/adminController.js";
import {
  createGame,
  getGameById,
  getGames,
  resetGameCounter,
  selectWinner,
  startGame,
  updateGame,
} from "../controllers/gameController.js";
import {
  callNumber,
  checkBingo,
  finishGame,
  pauseGame,
  updateGameStatus,
} from "../controllers/bingoController.js";
import FutureWinner from "../models/FutureWinner.js";
import mongoose from "mongoose";

const router = express.Router();

// ----------------- Game Routes -----------------
router.get("/paired-cashier", verifyToken, getPairedCashier);

// Specific jackpot routes
router.get("/jackpot", verifyToken, getJackpot);
router.post("/jackpot/set", verifyToken, validate, setJackpotAmount);
router.post("/jackpot/contribute", verifyToken, addJackpotContribution);
router.patch("/jackpot/toggle", verifyToken, validate, toggleJackpot);
router.post("/jackpot/award", verifyToken, validate, awardJackpot);
router.get("/jackpot/history", verifyToken, getJackpotHistory);
router.patch("/jackpot", verifyToken, updateJackpot);

// Other static routes
router.get("/report", verifyToken, getCashierReport);
router.get("/cards", verifyToken, getAllCards);
router.get("/", verifyToken, getAllGames);
router.get("/next-pending", verifyToken, getNextPendingGame);
router.post("/reset-game-counter", verifyToken, resetGameCounter);
router.post("/sequential", verifyToken, validate, createSequentialGames);

// Moderator routes
router.post("/select-winner", verifyToken, validate, selectWinner);
router.post(
  "/configure-next",
  verifyToken,
  validate,
  moderatorConfigureNextGameNumber
);
router.post(
  "/configure-future-winners",
  verifyToken,
  validate,
  configureFutureWinners
);

// Create a new game
router.post("/", verifyToken, validate, (req, res, next) => {
  console.log("Hit /api/games POST route with payload:", req.body);
  createGame(req, res, next);
});
router.put("/:gameId/status", verifyToken, validate, updateGameStatus);

// Specific game ID routes
router.get("/:id", verifyToken, (req, res, next) => {
  console.log("Hit /api/games/:id route with id:", req.params.id);
  getGames(req, res, next);
});
router.get("/games/:id", verifyToken, validate, getGameById);
router.post("/:gameId/call-number", verifyToken, validate, callNumber);

router.post("/:id/check-bingo", verifyToken, validate, checkBingo);
router.post("/:id/select-winner", verifyToken, validate, selectWinner);
router.post("/:id/finish", verifyToken, validate, finishGame);
router.post("/:id/start", verifyToken, startGame);
router.post("/:id/pause", verifyToken, pauseGame);
router.patch("/:id", verifyToken, validate, updateGame);

// Future winners routes
router.post("/future-winners", verifyToken, async (req, res, next) => {
  try {
    const { cashierId } = req.body;
    console.log(
      "[getFutureWinners] Received POST request with cashierId:",
      cashierId
    );

    if (!cashierId) {
      console.error("[getFutureWinners] Missing cashierId");
      return res.status(400).json({ message: "cashierId is required" });
    }

    if (!mongoose.isValidObjectId(cashierId)) {
      console.error("[getFutureWinners] Invalid cashierId format:", cashierId);
      return res.status(400).json({ message: "Invalid cashierId format" });
    }

    if (
      req.user.role !== "moderator" ||
      req.user.managedCashier.toString() !== cashierId
    ) {
      console.error("[getFutureWinners] Unauthorized cashierId:", cashierId);
      return res
        .status(403)
        .json({
          message: "Unauthorized: Cashier not managed by this moderator",
        });
    }

    const futureWinners = await FutureWinner.find({ cashierId, used: false })
      .select("_id gameNumber cardId pattern jackpotEnabled")
      .sort({ gameNumber: 1 });

    console.log("[getFutureWinners] Retrieved future winners:", futureWinners);

    res.status(200).json({
      message: "Future winners retrieved successfully",
      winners: futureWinners,
    });
  } catch (error) {
    console.error("[getFutureWinners] Error:", {
      message: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

router.delete(
  "/future-winners/:futureWinnerId",
  verifyToken,
  async (req, res, next) => {
    try {
      const { futureWinnerId } = req.params;
      console.log(
        "[deleteFutureWinner] Received DELETE request for futureWinnerId:",
        futureWinnerId
      );

      if (!mongoose.isValidObjectId(futureWinnerId)) {
        console.error(
          "[deleteFutureWinner] Invalid futureWinnerId format:",
          futureWinnerId
        );
        return res
          .status(400)
          .json({ message: "Invalid futureWinnerId format" });
      }

      const futureWinner = await FutureWinner.findById(futureWinnerId);
      if (!futureWinner) {
        console.error(
          "[deleteFutureWinner] Future winner not found:",
          futureWinnerId
        );
        return res.status(404).json({ message: "Future winner not found" });
      }

      if (
        req.user.role !== "moderator" ||
        req.user.managedCashier.toString() !== futureWinner.cashierId.toString()
      ) {
        console.error(
          "[deleteFutureWinner] Unauthorized for cashierId:",
          futureWinner.cashierId
        );
        return res
          .status(403)
          .json({
            message: "Unauthorized: Cashier not managed by this moderator",
          });
      }

      await FutureWinner.findByIdAndDelete(futureWinnerId);
      console.log(
        "[deleteFutureWinner] Deleted future winner:",
        futureWinnerId
      );

      res.status(200).json({
        message: "Future winner deleted successfully",
      });
    } catch (error) {
      console.error("[deleteFutureWinner] Error:", {
        message: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

router.put(
  "/future-winners/:futureWinnerId",
  verifyToken,
  async (req, res, next) => {
    try {
      const { futureWinnerId } = req.params;
      const { gameNumber, cardId, jackpotEnabled, pattern = "all" } = req.body;
      console.log(
        "[reconfigureFutureWinner] Received PUT request for futureWinnerId:",
        futureWinnerId,
        "Payload:",
        req.body
      );

      if (!mongoose.isValidObjectId(futureWinnerId)) {
        console.error(
          "[reconfigureFutureWinner] Invalid futureWinnerId format:",
          futureWinnerId
        );
        return res
          .status(400)
          .json({ message: "Invalid futureWinnerId format" });
      }

      const futureWinner = await FutureWinner.findById(futureWinnerId);
      if (!futureWinner) {
        console.error(
          "[reconfigureFutureWinner] Future winner not found:",
          futureWinnerId
        );
        return res.status(404).json({ message: "Future winner not found" });
      }

      if (
        req.user.role !== "moderator" ||
        req.user.managedCashier.toString() !== futureWinner.cashierId.toString()
      ) {
        console.error(
          "[reconfigureFutureWinner] Unauthorized for cashierId:",
          futureWinner.cashierId
        );
        return res
          .status(403)
          .json({
            message: "Unauthorized: Cashier not managed by this moderator",
          });
      }

      if (!Number.isInteger(gameNumber) || gameNumber < 1) {
        throw new Error(`Invalid game number: ${gameNumber}`);
      }
      if (!Number.isInteger(cardId) || cardId < 1) {
        throw new Error(`Invalid card ID: ${cardId}`);
      }

      const card = await Card.findOne({ card_number: cardId });
      if (!card) {
        throw new Error(`Card not found for ID: ${cardId}`);
      }
      console.log("[reconfigureFutureWinner] Fetched card:", {
        cardId,
        numbers: card.numbers,
      });

      let chosenPattern = pattern;
      if (pattern === "all") {
        const easyPatterns = [
          "horizontal_line",
          "vertical_line",
          "main_diagonal",
          "other_diagonal",
          "four_corners_center",
        ];
        chosenPattern =
          easyPatterns[Math.floor(Math.random() * easyPatterns.length)];
        console.log(
          `[reconfigureFutureWinner] 🎯 "all" → converted to: ${chosenPattern}`
        );
      }

      const { selectedNumbers, selectedIndices } = getNumbersForPattern(
        card.numbers,
        chosenPattern,
        [],
        true
      );

      console.log(
        `[reconfigureFutureWinner] ✅ Numbers for pattern "${chosenPattern}": [${selectedNumbers.join(
          ", "
        )}]`
      );

      if (!selectedNumbers || selectedNumbers.length === 0) {
        throw new Error(`No numbers returned for pattern "${chosenPattern}"`);
      }

      const forcedCallSequence = generateQuickWinSequence(
        selectedNumbers.map(Number),
        selectedNumbers.length,
        10,
        14
      );

      console.log(
        `[reconfigureFutureWinner] 🚀 Generated forcedCallSequence (${forcedCallSequence.length} calls):`,
        forcedCallSequence
      );

      const updatedWinner = await FutureWinner.findByIdAndUpdate(
        futureWinnerId,
        {
          gameNumber,
          cardId,
          moderatorId: req.user.id,
          cashierId: futureWinner.cashierId,
          fullCardNumbers: card.numbers.map((row) =>
            row.map((v) => (v === "FREE" ? null : v))
          ),
          playableNumbers: selectedNumbers,
          forcedCallSequence,
          pattern: chosenPattern,
          jackpotEnabled,
          selectedWinnerRowIndices: selectedIndices,
          used: false,
        },
        { new: true }
      );

      console.log(
        "[reconfigureFutureWinner] Updated future winner:",
        updatedWinner
      );

      res.status(200).json({
        message: "Future winner reconfigured successfully",
        winner: updatedWinner,
      });
    } catch (error) {
      console.error("[reconfigureFutureWinner] Error:", {
        message: error.message,
        stack: error.stack,
      });
      next(error);
    }
  }
);

export default router;
