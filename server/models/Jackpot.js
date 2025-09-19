import mongoose from "mongoose";

const jackpotSchema = new mongoose.Schema({
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    default: 0,
    min: 0,
  },
  baseAmount: {
    type: Number,
    default: 0,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Moderator-controlled draw settings
  drawAmount: {
    type: Number,
    default: 0,
  },
  drawCardId: {
    type: Number,
    default: null,
  },
  drawMessage: {
    type: String,
    default: "",
  },
  drawTimestamp: {
    type: Date,
    default: null,
  },
});

// Ensure 1 jackpot per cashier
jackpotSchema.index({ cashierId: 1 }, { unique: true });

export default mongoose.model("Jackpot", jackpotSchema);
