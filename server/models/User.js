import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    phone: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["admin", "cashier", "moderator"],
      default: "cashier",
    },

    // For moderators → which cashier they manage
    managedCashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // For cashiers → which moderator manages them
    moderatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    otp: String,
    otpExpiry: Date,
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
