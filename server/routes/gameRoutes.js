import express from "express";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  getJackpot,
  getPairedCashier,
  updateJackpot,
  setJackpotAmount, // Moderator sets jackpot amount
  addJackpotContribution, // Add game contribution to jackpot
  toggleJackpot, // Enable/disable jackpot
  awardJackpot, // Award jackpot during game or manually
  getJackpotHistory, // Get jackpot history
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

const router = express.Router();

// ----------------- Game Routes -----------------
router.get("/paired-cashier", verifyToken, getPairedCashier);

// Specific jackpot routes
router.get("/jackpot", verifyToken, getJackpot);
router.post("/jackpot/set", verifyToken, validate, setJackpotAmount); // Moderator manually set jackpot amount
router.post("/jackpot/contribute", verifyToken, addJackpotContribution); // Add game contribution (internal)
router.patch("/jackpot/toggle", verifyToken, validate, toggleJackpot); // Toggle jackpot enabled/disabled
router.post("/jackpot/award", verifyToken, validate, awardJackpot); // Award jackpot (game or manual)
router.get("/jackpot/history", verifyToken, getJackpotHistory); // Get jackpot history
router.patch("/jackpot", verifyToken, updateJackpot); // Legacy update route

// Other static routes
router.get("/report", verifyToken, getCashierReport); // Updated to use getCashierReport
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
// Add this route after the existing game routes
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

export default router;
