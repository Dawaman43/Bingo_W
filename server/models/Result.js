import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
    required: false,
  },
  winnerCardId: { type: Number, required: false },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  }, // optional now
  identifier: { type: String, required: true }, // store free-form name/ID/phone
  prize: { type: Number, required: true },
  isJackpot: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("Result", resultSchema);
