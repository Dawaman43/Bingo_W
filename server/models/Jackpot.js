import mongoose from "mongoose";

const jackpotSchema = new mongoose.Schema({
  amount: { type: Number, default: 100 },
  seed: { type: Number, default: 100 },
  lastUpdated: { type: Date, default: Date.now },
});

export default mongoose.model("Jackpot", jackpotSchema);
