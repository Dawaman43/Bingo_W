const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema(
  {
    betAmount: { type: Number, required: true },
    selectedCards: { type: Number, required: true },
    houseFeePercentage: { type: Number, required: true },
    totalPot: { type: Number },
    houseFee: { type: Number },
    prizePool: { type: Number },
    jackpot: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", gameSchema);
