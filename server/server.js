import express from "express";
import "dotenv/config";
import connectDB from "./configs/db.js";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";

// Initialize express
const app = express();

// Connect to database
await connectDB();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173", // Frontend origin
    credentials: true, // Allow credentials
  })
);

app.use(express.json());

// Test route

app.get("/", (req, res) => res.send("Server is running"));

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/game", gameRoutes);
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
