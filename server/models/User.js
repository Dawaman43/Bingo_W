import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, unique: true, sparse: true }, // Added for phone-based lookup
    role: {
      type: String,
      enum: ["admin", "cashier", "moderator"],
      default: "cashier",
    },
    otp: String,
    otpExpiry: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
