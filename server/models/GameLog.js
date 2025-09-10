import mongoose from "mongoose";

const gameLogSchema = new mongoose.Schema(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    action: { type: String, required: true }, // e.g., "finishGame"
    status: { type: String }, // e.g., "success", "failed"
    details: { type: Object }, // Store additional info like winnerCardId, error message
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("GameLog", gameLogSchema);
