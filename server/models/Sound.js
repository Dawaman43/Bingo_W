import mongoose from "mongoose";

const soundSchema = new mongoose.Schema({
  filename: { type: String, required: true, unique: true },
  path: { type: String, required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Sound", soundSchema);
