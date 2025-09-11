import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number },
  cardId: {
    type: Number,
    required: function () {
      return this._id.startsWith("futureWinning_");
    },
  },
});

export default mongoose.model("Counter", counterSchema);
