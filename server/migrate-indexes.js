// migrate-indexes.js (Robust: Per-index try-catch for conflicts)
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load .env
dotenv.config();

// Import your models
import Game from "./models/Game.js";
import Counter from "./models/Counter.js";
import FutureWinner from "./models/FutureWinner.js";
import GameLog from "./models/GameLog.js";
import Jackpot from "./models/Jackpot.js";
import JackpotLog from "./models/JackpotLog.js";
import Result from "./models/Result.js";
import User from "./models/User.js";

let MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/bingo_db";

// Fix for Atlas: Append DB name if missing
if (MONGODB_URI.includes("mongodb.net") && !MONGODB_URI.includes("/")) {
  MONGODB_URI += "/bingo_db"; // Change 'bingo_db' to your actual DB name if different
}

// Better masking for logs
const logUri = MONGODB_URI.replace(/^(mongodb[^:]+:\/\/)([^@]+@)/, "$1***@");
console.log(`🔍 Using MongoDB URI: ${logUri}`);

async function createIndexes() {
  let retries = 0;
  const maxRetries = 1;
  while (retries <= maxRetries) {
    try {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 20000,
      });
      console.log("✅ Connected to MongoDB");
      break;
    } catch (connError) {
      retries++;
      console.error(
        `❌ Connection attempt ${retries}/${maxRetries + 1} failed:`,
        connError.message
      );
      if (retries > maxRetries) throw connError;
      console.log("⏳ Retrying in 3s...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  try {
    // Helper to create index safely
    const safeCreateIndex = async (model, indexSpec, options = {}, label) => {
      try {
        const result = await model.collection.createIndex(indexSpec, options);
        console.log(`  ✅ ${label}: Created`);
        return result;
      } catch (err) {
        if (
          err.codeName === "IndexKeySpecsConflict" ||
          err.message.includes("already exists")
        ) {
          console.log(`  ⚠️  ${label}: Skipped (already exists)`);
        } else {
          console.error(`  ❌ ${label}: Failed -`, err.message);
          throw err; // Re-throw non-conflict errors
        }
      }
    };

    // Game indexes
    console.log("Creating Game indexes...");
    await safeCreateIndex(
      Game,
      { cashierId: 1, status: 1 },
      {},
      "Game: cashierId+status"
    );
    await safeCreateIndex(
      Game,
      { cashierId: 1, createdAt: -1 },
      {},
      "Game: cashierId+createdAt"
    );
    await safeCreateIndex(
      Game,
      { cashierId: 1, gameNumber: 1 },
      { unique: true },
      "Game: cashierId+gameNumber (unique)"
    );

    // Counter
    console.log("Creating Counter indexes...");
    await safeCreateIndex(
      Counter,
      { cashierId: 1, _id: 1 },
      {},
      "Counter: cashierId+_id"
    );

    // FutureWinner
    console.log("Creating FutureWinner indexes...");
    await safeCreateIndex(
      FutureWinner,
      { cashierId: 1, used: 1 },
      {},
      "FutureWinner: cashierId+used"
    );

    // GameLog
    console.log("Creating GameLog indexes...");
    await safeCreateIndex(
      GameLog,
      { gameId: 1, timestamp: -1 },
      {},
      "GameLog: gameId+timestamp"
    );
    await safeCreateIndex(
      GameLog,
      { timestamp: 1 },
      { expireAfterSeconds: 7776000 },
      "GameLog: TTL (90 days)"
    );

    // Jackpot
    console.log("Creating Jackpot indexes...");
    await safeCreateIndex(
      Jackpot,
      { cashierId: 1 },
      { unique: true },
      "Jackpot: cashierId (unique)"
    );

    // JackpotLog
    console.log("Creating JackpotLog indexes...");
    await safeCreateIndex(
      JackpotLog,
      { cashierId: 1, timestamp: -1 },
      {},
      "JackpotLog: cashierId+timestamp"
    );
    await safeCreateIndex(
      JackpotLog,
      { timestamp: 1 },
      { expireAfterSeconds: 7776000 },
      "JackpotLog: TTL (90 days)"
    );

    // Result
    console.log("Creating Result indexes...");
    await safeCreateIndex(
      Result,
      { gameId: 1, timestamp: -1 },
      {},
      "Result: gameId+timestamp"
    );

    // User (handle unique conflicts gracefully)
    console.log("Creating User indexes...");
    await safeCreateIndex(User, { email: 1 }, {}, "User: email");
    await safeCreateIndex(User, { role: 1 }, {}, "User: role");

    console.log(
      "✅ All indexes processed successfully! (Some may have been skipped if existing)"
    );
  } catch (error) {
    console.error("❌ Unexpected error during indexing:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

createIndexes();
