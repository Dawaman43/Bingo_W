import mongoose from "mongoose";

const jackpotCandidateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  }, // <-- optional now
  identifier: { type: String, required: true },
  identifierType: {
    type: String,
    enum: ["id", "name", "phone"],
    required: true,
  },
  expiryDate: { type: Date, required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game" }, // Optional
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("JackpotCandidate", jackpotCandidateSchema);
