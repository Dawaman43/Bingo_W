// The split game controller with callNumber, checkBingo, etc. - UPDATED
import mongoose from "mongoose";
import {
  checkCardBingo,
  getMarkedGrid,
  getNumbersForPattern,
  getCashierIdFromUser,
  logJackpotUpdate,
  shuffle, // Add if not already
  computeForcedSequence, // Add import
} from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Result from "../models/Result.js";
import Jackpot from "../models/Jackpot.js";
import GameLog from "../models/GameLog.js";

// Call number - UPDATED

// Check bingo - UPDATED

// ... (finishGame, pauseGame remain unchanged)
