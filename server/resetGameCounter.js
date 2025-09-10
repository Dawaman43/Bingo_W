import mongoose from "mongoose";
import dotenv from "dotenv";
import Counter from "./models/Counter.js";

dotenv.config();

const resetCounter = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    await Counter.findByIdAndUpdate(
      "gameNumber",
      { seq: 0 },
      { upsert: true, new: true }
    );

    console.log("Counter reset to 0");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting counter:", err);
    process.exit(1);
  }
};

resetCounter();
