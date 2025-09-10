// server/models/JackpotLog.js
import mongoose from "mongoose";

const jackpotLogSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", default: null },
  timestamp: { type: Date, default: Date.now },
});

const JackpotLog = mongoose.model("JackpotLog", jackpotLogSchema);

export default JackpotLog;
