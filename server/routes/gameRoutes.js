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
} from "../controllers/gameController.js";
import { verifyToken } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";

const router = express.Router();

router.get("/cards", verifyToken, getAllCards);
router.get("/", verifyToken, getAllGames);
router.get("/:id", verifyToken, getGame);
router.post("/", verifyToken, validate, createGame);
router.post("/:id/call-number", verifyToken, validate, callNumber);
router.post("/check-bingo", verifyToken, validate, checkBingo);
router.post("/:id/select-winner", verifyToken, validate, selectWinner);
router.post("/:id/finish", verifyToken, validate, finishGame);

export default router;
