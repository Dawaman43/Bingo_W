import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true, unique: true },
  betAmount: { type: Number, required: true },
  houseFeePercentage: { type: Number, required: true },
  houseFee: { type: Number, default: 0 },
  selectedCards: [
    {
      id: { type: Number, required: true },
      numbers: [[{ type: mongoose.Schema.Types.Mixed }]], // 5x5 grid of numbers or "free"
    },
  ],
  pattern: {
    type: String,
    required: true,
    enum: [
      "four_corners_center", // Pattern 1
      "cross", // Pattern 2
      "main_diagonal", // Pattern 3
      "other_diagonal", // Pattern 4
      "horizontal_line", // Pattern 5
      "vertical_line", // Pattern 6
      "all", // Pattern 7
    ],
  },
  prizePool: { type: Number, required: true, default: 0 },
  potentialJackpot: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["pending", "active", "paused", "completed"],
    default: "pending",
  },
  calledNumbers: [{ type: Number }], // List of called bingo numbers
  calledNumbersLog: [
    {
      number: { type: Number, required: true },
      calledAt: { type: Date, default: Date.now },
    },
  ],
  moderatorWinnerCardId: { type: Number, default: null },
  selectedWinnerRowIndices: { type: [Number], default: [] },
  forcedCallSequence: {
    type: [Number],
    default: [],
  },
  winner: {
    cardId: { type: Number },
    prize: { type: Number },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

gameSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Game", gameSchema);
