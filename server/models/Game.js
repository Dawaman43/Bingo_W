import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    gameNumber: { type: Number, required: true, unique: true },
    betAmount: { type: Number, required: true },
    selectedCards: [
      {
        id: { type: Number, required: true },
        numbers: [{ type: String }],
      },
    ],
    houseFeePercentage: { type: Number, required: true },
    totalPot: { type: Number },
    houseFee: { type: Number },
    prizePool: { type: Number },
    jackpotContribution: { type: Number },
    potentialJackpot: { type: Number },
    calledNumbers: [{ type: Number }],
    calledNumbersLog: [
      {
        number: { type: Number },
        cardId: { type: Number },
        calledAt: { type: Date, default: Date.now },
      },
    ],
    pattern: {
      type: String,
      enum: ["single_line", "double_line", "full_house"],
      required: true,
    },
    winner: {
      cardId: { type: Number },
      prize: { type: Number },
    },
    // NEW FIELDS
    moderatorWinnerCardId: { type: Number, default: null }, // moderator chosen card for next game
    jackpotEnabled: { type: Boolean, default: true }, // allow turning jackpot on/off

    status: { type: String, enum: ["active", "completed"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model("Game", gameSchema);
