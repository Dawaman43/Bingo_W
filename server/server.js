import express from "express";
import "dotenv/config";
import http from "http";
import connectDB from "./configs/db.js";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import soundRoutes from "./routes/soundRoutes.js";
import { initSocket } from "./socket.js";

// Initialize express
const app = express();

// Connect to database
await connectDB();

// Middleware
app.use(
  cors({
    origin: "https://jokerbingo.xyz", // Frontend origin
    credentials: true, // Allow credentials
  })
);

app.use(express.json());

// Test route
app.get("/", (req, res) => res.send("Server is running"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/sounds", soundRoutes);

// Create HTTP server and initialize Socket.io
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server
initSocket(server);

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
