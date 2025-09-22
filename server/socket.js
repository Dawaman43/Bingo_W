import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "https://bingowebclient.vercel.app", // Adjust to your frontend URL
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[socket] Client connected: ${socket.id}`);

    socket.on("joinCashierRoom", (cashierId) => {
      socket.join(cashierId);
      console.log(
        `[socket] Client ${socket.id} joined cashier room: ${cashierId}`
      );
    });

    socket.on("disconnect", () => {
      console.log(`[socket] Client disconnected: ${socket.id}`);
    });
  });
};

export const emitJackpotAwarded = (cashierId, data) => {
  if (io) {
    console.log(
      `[socket] Emitting jackpotAwarded to cashier room ${cashierId}:`,
      data
    );
    io.to(cashierId).emit("jackpotAwarded", data);
  }
};
