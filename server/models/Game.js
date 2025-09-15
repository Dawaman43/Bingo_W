import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true, unique: true },
  betAmount: { type: Number, required: true },
  houseFeePercentage: { type: Number, required: true },
  houseFee: { type: Number, default: 0 },
  selectedCards: [
    {
      id: { type: Number, required: true },
      numbers: [[{ type: mongoose.Schema.Types.Mixed }]],
    },
  ],
  pattern: {
    type: String,
    required: true,
    enum: ["line", "diagonal", "x_pattern"],
  }, // Updated enum
  prizePool: { type: Number, required: true, default: 0 },
  potentialJackpot: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "active", "paused", "completed"],
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
  selectedWinnerRowIndices: { type: [Number], default: [] }, // Array for multiple lines (e.g., x_pattern)
  jackpotEnabled: { type: Boolean, default: true },
  winner: {
    cardId: { type: Number },
    prize: { type: Number },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Game", gameSchema);
