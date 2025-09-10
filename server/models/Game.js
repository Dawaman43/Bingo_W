import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true, unique: true },
  betAmount: { type: Number, required: true },
  houseFeePercentage: { type: Number, required: true },
  selectedCards: [
    {
      id: { type: Number, required: true },
      numbers: [[{ type: mongoose.Schema.Types.Mixed }]], // Nested array
    },
  ],
  pattern: { type: String, required: true },
  prizePool: { type: Number, required: true },
  potentialJackpot: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "active", "completed"],
    default: "pending",
  },
  calledNumbers: [{ type: Number }],
  calledNumbersLog: [
    {
      number: { type: Number, required: true },
      calledAt: { type: Date, default: Date.now },
    },
  ],
  moderatorWinnerCardId: { type: Number, default: null },
  jackpotEnabled: { type: Boolean, default: true },
  winner: {
    cardId: { type: Number },
    prize: { type: Number },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Game", gameSchema);
