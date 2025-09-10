import mongoose from "mongoose";

const cardSchema = new mongoose.Schema({
  card_number: { type: Number, required: true, unique: true },
  numbers: [[{ type: mongoose.Schema.Types.Mixed }]], // Allows numbers or "FREE"
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Card", cardSchema);
