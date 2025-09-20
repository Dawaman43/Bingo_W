import mongoose from "mongoose";
import Game from "./models/Game.js";
import Card from "./models/Card.js";
import "dotenv/config";

const { MONGODB_URI } = process.env;

async function connectDB() {
  await mongoose.connect(MONGODB_URI, { dbName: "bingo-web" });
  console.log("✅ Connected to bingo-web database");
}

async function showFutureWinners() {
  try {
    console.log("🔍 Searching for properly configured winner games...");

    // ✅ Query for properly configured winners
    const gamesWithWinners = await Game.find({
      moderatorWinnerCardId: {
        $exists: true,
        $ne: null,
        $ne: 0,
        $ne: "",
      },
      $or: [
        { winnerCardNumbers: { $exists: true, $ne: null } },
        { selectedWinnerNumbers: { $exists: true, $ne: [] } },
        { forcedCallSequence: { $exists: true, $ne: [] } },
      ],
    })
      .sort({ gameNumber: 1, createdAt: -1 })
      .lean();

    console.log(
      `✅ Found ${gamesWithWinners.length} properly configured winner games:`
    );

    if (gamesWithWinners.length === 0) {
      console.log("\n❌ No properly configured winners found.");
      return;
    }

    console.log("\n📋 Properly Configured Winners:");
    gamesWithWinners.forEach((game, index) => {
      console.log("\n--------------------------------------------------");
      console.log(`Game ${index + 1}:`);
      console.log(`  Game Number: ${game.gameNumber}`);
      console.log(`  Game ID: ${game._id}`);
      console.log(`  Cashier ID: ${game.cashierId}`);
      console.log(`  Status: ${game.status}`);
      console.log(`  Winner Card ID: ${game.moderatorWinnerCardId}`);
      console.log(`  Jackpot Enabled: ${game.jackpotEnabled}`);
      console.log(
        `  Configured At: ${
          game.configuredAt
            ? new Date(game.configuredAt).toLocaleString()
            : "N/A"
        }`
      );

      // ✅ FIXED: Show ALL 5 ROWS of the winner card
      if (game.winnerCardNumbers && Array.isArray(game.winnerCardNumbers)) {
        console.log(
          `  Winner Card #${game.moderatorWinnerCardId} - Full 5x5 Grid:`
        );

        // Display each row with proper formatting
        game.winnerCardNumbers.forEach((row, rowIndex) => {
          if (Array.isArray(row)) {
            // Format each number: strings as-is, numbers padded to 2 digits
            const formattedRow = row
              .map(
                (num) =>
                  typeof num === "string"
                    ? num.padEnd(4) // FREE spaces
                    : num.toString().padStart(2, "0").padEnd(4) // Numbers padded
              )
              .join(" | ");

            console.log(`    Row ${rowIndex + 1}: ${formattedRow}`);
          } else {
            console.log(`    Row ${rowIndex + 1}: [Invalid row format]`);
          }
        });

        console.log(`    ${"─".repeat(40)}`); // Separator line
      } else {
        console.log(`  Winner Card Numbers: Missing or invalid structure`);
      }

      // Show ALL selected winner numbers (playable numbers only)
      if (game.selectedWinnerNumbers && game.selectedWinnerNumbers.length > 0) {
        console.log(
          `  Selected Winner Numbers (${game.selectedWinnerNumbers.length} total):`
        );

        // Display in columns for readability
        const numbers = game.selectedWinnerNumbers;
        const columns = 6; // Show 6 numbers per line
        for (let i = 0; i < numbers.length; i += columns) {
          const chunk = numbers.slice(i, i + columns);
          console.log(
            `    ${chunk.map((n) => n.toString().padStart(2, "0")).join("  ")}`
          );
        }
      }

      // Show ALL forced call sequence
      if (game.forcedCallSequence && game.forcedCallSequence.length > 0) {
        console.log(
          `  Forced Call Sequence (${game.forcedCallSequence.length} total):`
        );

        // Display in columns
        const callSequence = game.forcedCallSequence;
        const columns = 8; // Show 8 numbers per line
        for (let i = 0; i < callSequence.length; i += columns) {
          const chunk = callSequence.slice(i, i + columns);
          console.log(
            `    ${chunk.map((n) => n.toString().padStart(2, "0")).join("  ")}`
          );
        }
      }

      console.log(
        `  Total playable numbers: ${game.selectedWinnerNumbers?.length || 0}`
      );
    });

    // Summary
    const totalGames = await Game.countDocuments();
    const totalWithWinnerCard = await Game.countDocuments({
      moderatorWinnerCardId: { $exists: true, $ne: null, $ne: 0 },
    });

    console.log("\n📊 Summary:");
    console.log(`  Total games in collection: ${totalGames}`);
    console.log(`  Games with valid winnerCardId: ${totalWithWinnerCard}`);
    console.log(`  Properly configured winners: ${gamesWithWinners.length}`);

    if (gamesWithWinners.length > 0) {
      console.log(
        `  Winner card IDs: ${gamesWithWinners
          .map((g) => g.moderatorWinnerCardId)
          .join(", ")}`
      );
    }
  } catch (error) {
    console.error("❌ Error querying games:", error);
  }
}

async function run() {
  await connectDB();
  await showFutureWinners();
  await mongoose.connection.close();
}

run().catch(console.error);
