import mongoose from "mongoose";

// models/FutureWinner.js
const futureWinnerSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true },
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  cardId: { type: Number, required: true },
  fullCardNumbers: { type: [[Number]], required: true },
  playableNumbers: { type: [Number], required: true },
  forcedCallSequence: { type: [Number], required: true },
  jackpotEnabled: { type: Boolean, default: false }, // ✅ NEW: For jackpot config
  jackpotDrawAmount: {
    type: Number,
    default: 0,
    min: 0,
  }, // ✅ NEW: Stored draw amount
  jackpotMessage: { type: String, default: null }, // ✅ NEW: Stored message
  pattern: { type: String, required: true },
  selectedWinnerRowIndices: { type: [Number], required: true },
  configuredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }, // ✅ Made required for upsert
  configuredAt: { type: Date, default: Date.now },
  used: { type: Boolean, default: false }, // Track if used
  usedAt: { type: Date }, // When it was used
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game" }, // Reference to the game it was used in
});

// Unique index
futureWinnerSchema.index({ gameNumber: 1, cashierId: 1 }, { unique: true });

export default mongoose.model("FutureWinner", futureWinnerSchema);
