import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g., "gameNumber_<cashierId>", "cardId_<cashierId>"
  cashierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  seq: { type: Number, default: 0 }, // generic counter
  cardId: {
    type: Number,
    required: function () {
      return this._id.startsWith("cardId_");
    },
  },
  jackpotEnabled: { type: Boolean, default: true }, // optional flag
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // for future flexibility
});

// Ensure uniqueness per cashier and counter type
counterSchema.index({ _id: 1, cashierId: 1 }, { unique: true });

export default mongoose.model("Counter", counterSchema);
