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
  resetGameCounter,
} from "../controllers/gameController.js";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

// ----------------- Game Routes -----------------

// Static routes (specific paths) should be first
router.get("/cards", verifyToken, getAllCards);
router.get("/jackpot", verifyToken, getJackpot);
router.get("/", verifyToken, getAllGames);
router.post("/reset-game-counter", verifyToken, resetGameCounter);

// Create a new game
router.post("/", verifyToken, validate, (req, res, next) => {
  console.log("Hit /api/games POST route with payload:", req.body);
  createGame(req, res, next);
});

// Dynamic routes (with :id) must come after static routes
router.get("/:id", verifyToken, (req, res, next) => {
  console.log("Hit /api/games/:id route with id:", req.params.id);
  getGame(req, res, next);
});
router.post("/:id/call-number", verifyToken, validate, callNumber);
router.post("/:id/check-bingo", verifyToken, validate, checkBingo);
router.post("/:id/select-winner", verifyToken, validate, selectWinner);
router.post("/:id/finish", verifyToken, validate, finishGame);
router.post("/:id/start", verifyToken, startGame);
router.patch("/:id", verifyToken, updateGame);

export default router;
