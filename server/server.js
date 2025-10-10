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
import os from "os";
import { exec } from "child_process";

// Initialize express
const app = express();

// Connect to database
await connectDB();

// Middleware
app.use(
  cors({
    origin: "https://jokerbingo1.vercel.app", // Frontend origin
    credentials: true, // Allow credentials
  })
);

app.use(express.json());
// Disk usage
const getDiskUsage = () =>
  new Promise((resolve, reject) => {
    exec("df -h /", (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });

// CPU usage
const getCpuUsage = () => {
  const cpus = os.cpus();
  return cpus.map((cpu, index) => {
    const times = cpu.times;
    const total = Object.values(times).reduce((a, b) => a + b, 0);
    const usage = ((total - times.idle) / total) * 100;
    return `CPU ${index}: ${usage.toFixed(2)}% used`;
  });
};

// Memory usage
const getMemoryUsage = () => {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    usedMB: (used / 1024 / 1024).toFixed(2),
    totalMB: (total / 1024 / 1024).toFixed(2),
  };
};

// Bandwidth usage
const getBandwidthUsage = () =>
  new Promise((resolve, reject) => {
    exec("cat /proc/net/dev", (err, stdout) => {
      if (err) return reject(err);
      const lines = stdout.split("\n").slice(2);
      const usage = lines
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const iface = parts[0].replace(":", "");
          const rxMB = (parseInt(parts[1], 10) / 1024 / 1024).toFixed(2);
          const txMB = (parseInt(parts[9], 10) / 1024 / 1024).toFixed(2);
          return { interface: iface, receivedMB: rxMB, sentMB: txMB };
        })
        .filter((i) => i.interface);
      resolve(usage);
    });
  });

// Test route
app.get("/", (req, res) => res.send("Server is running"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/sounds", soundRoutes);
app.get("/resources", async (req, res) => {
  try {
    const disk = await getDiskUsage();
    const cpu = getCpuUsage();
    const memory = getMemoryUsage();
    const bandwidth = await getBandwidthUsage();

    res.json({
      diskUsage: disk,
      cpuUsage: cpu,
      memoryUsage: memory,
      bandwidthUsage: bandwidth,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to get resources", details: err.message });
  }
});

// Create HTTP server and initialize Socket.io
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io with the HTTP server
initSocket(server);

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
