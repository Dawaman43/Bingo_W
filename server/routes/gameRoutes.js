import express from "express";
import {
  createGame,
  getGames,
  getAllGames,
  getAllCards,
  callNumber,
  checkBingo,
  selectWinner,
  finishGame,
  updateGame,
  getJackpot,
  startGame,
  pauseGame,
  resetGameCounter,
  moderatorConfigureNextGameNumber,
  configureFutureWinners,
  createSequentialGames,
  getNextPendingGame,
  getCashierReport, // Replaced getReportData with getCashierReport
  selectJackpotWinner,
  addJackpotCandidate,
  explodeJackpot,
  getJackpotCandidates,
  updateJackpot,
  getGameById,
} from "../controllers/gameController.js";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

// ----------------- Game Routes -----------------

// Specific jackpot routes
router.get("/jackpot", verifyToken, getJackpot);
router.patch("/jackpot", verifyToken, updateJackpot);
router.post("/jackpot/candidates", verifyToken, validate, addJackpotCandidate);
router.post("/jackpot/explode", verifyToken, validate, explodeJackpot);
router.get("/jackpot/candidates", verifyToken, getJackpotCandidates);

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

// Specific game ID routes
router.get("/:id", verifyToken, (req, res, next) => {
  console.log("Hit /api/games/:id route with id:", req.params.id);
  getGames(req, res, next);
});
router.get("/games/:id", verifyToken, validate, getGameById);
router.post("/:id/call-number", verifyToken, validate, callNumber);

router.post("/:id/check-bingo", verifyToken, validate, checkBingo);
router.post("/:id/select-winner", verifyToken, validate, selectWinner);
router.post("/:id/finish", verifyToken, validate, finishGame);
router.post("/:id/start", verifyToken, startGame);
router.post("/:id/pause", verifyToken, pauseGame);
router.post("/:id/select-jackpot-winner", verifyToken, selectJackpotWinner);
router.patch("/:id", verifyToken, validate, updateGame);

export default router;
