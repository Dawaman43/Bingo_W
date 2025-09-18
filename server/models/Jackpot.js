import mongoose from "mongoose";

const jackpotSchema = new mongoose.Schema({
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: { type: Number, default: 0 },
  seed: { type: Number, default: 0 },
  enabled: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
});

// ensure 1 jackpot per cashier
jackpotSchema.index({ cashierId: 1 }, { unique: true });

export default mongoose.model("Jackpot", jackpotSchema);
