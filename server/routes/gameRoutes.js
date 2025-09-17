import express from "express";
import {
  createGame,
  getGame,
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
  getReportData,
  selectJackpotWinner,
  addJackpotCandidate,
  explodeJackpot,
  getJackpotCandidates,
  updateJackpot, // Added import for new function
} from "../controllers/gameController.js";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

// ----------------- Game Routes -----------------

// Specific jackpot routes first to avoid conflicting with /:id
router.get("/jackpot", verifyToken, getJackpot);
router.patch("/jackpot", verifyToken, updateJackpot); // Added route for updating jackpot (amount or enabled)
router.post("/jackpot/candidates", verifyToken, validate, addJackpotCandidate);
router.post("/jackpot/explode", verifyToken, validate, explodeJackpot);
router.get("/jackpot/candidates", verifyToken, getJackpotCandidates);

// Other static routes
router.get("/report", verifyToken, getReportData);
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

// Specific game ID routes (after specific static routes like /jackpot)
router.get("/:id", verifyToken, (req, res, next) => {
  console.log("Hit /api/games/:id route with id:", req.params.id);
  getGame(req, res, next);
});
router.post("/:id/call-number", verifyToken, validate, callNumber);
router.post("/:id/check-bingo", verifyToken, validate, checkBingo);
router.post("/:id/select-winner", verifyToken, validate, selectWinner);
router.post("/:id/finish", verifyToken, validate, finishGame);
router.post("/:id/start", verifyToken, startGame);
router.post("/:id/pause", verifyToken, pauseGame);
router.post("/:id/select-jackpot-winner", verifyToken, selectJackpotWinner);
router.patch("/:id", verifyToken, validate, updateGame);

export default router;
