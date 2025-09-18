import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true }, // Removed unique constraint
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true, // Associate game with cashier
  },
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
    enum: [
      "four_corners_center",
      "cross",
      "main_diagonal",
      "other_diagonal",
      "horizontal_line",
      "vertical_line",
      "all",
    ],
  },
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

// Ensure unique gameNumber per cashier
gameSchema.index({ cashierId: 1, gameNumber: 1 }, { unique: true });

export default mongoose.model("Game", gameSchema);
