import mongoose from "mongoose";

const resultSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  winnerCardId: { type: Number },
  prize: { type: Number },
  completedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Result", resultSchema);
