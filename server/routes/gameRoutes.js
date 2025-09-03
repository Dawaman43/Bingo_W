import express from "express";
import {
  createGame,
  getAllGames,
  getGameById,
} from "../controllers/gameController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = express.Router();

router.post("/", verifyToken, createGame);

router.get("/", verifyToken, getAllGames);

router.get("/:id", verifyToken, getGameById);

export default router;
