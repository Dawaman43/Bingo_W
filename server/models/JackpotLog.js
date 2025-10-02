// server/models/JackpotLog.js
import mongoose from "mongoose";

const jackpotLogSchema = new mongoose.Schema({
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
    default: null,
  },
  isAward: {
    type: Boolean,
    default: false,
  },
  winnerCardId: {
    type: String,
    default: null,
  },
  message: {
    type: String,
    default: null,
  },
  triggeredByCashier: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient history queries (sorted by timestamp per cashier)
jackpotLogSchema.index({ cashierId: 1, timestamp: -1 });

const JackpotLog = mongoose.model("JackpotLog", jackpotLogSchema);

export default JackpotLog;
