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
} from "../controllers/gameController.js";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

// ----------------- Game Routes -----------------
router.get("/cards", verifyToken, getAllCards);
router.get("/jackpot", verifyToken, getJackpot);
router.get("/", verifyToken, getAllGames);
router.get("/:id", verifyToken, getGame);

router.post("/", verifyToken, validate, createGame);
router.post("/:id/call-number", verifyToken, validate, callNumber);
router.post("/:id/check-bingo", verifyToken, validate, checkBingo);
router.post("/:id/select-winner", verifyToken, validate, selectWinner);
router.post("/:id/finish", verifyToken, validate, finishGame);

router.patch("/:id", verifyToken, updateGame);

export default router;
