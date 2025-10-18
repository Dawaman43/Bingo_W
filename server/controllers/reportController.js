import mongoose from "mongoose";
import { validationResult } from "express-validator";
import { getCashierIdFromUser } from "../utils/gameUtils.js";
import Game from "../models/Game.js";
import Counter from "../models/Counter.js";
import Result from "../models/Result.js";
import User from "../models/User.js";
import GameLog from "../models/GameLog.js";

// Get report data
export const getReportData = async (req, res, next) => {
  try {
    const { status, pattern, startDate, endDate } = req.query;

    const filter = { status: { $ne: null } };

    if (status && status !== "") {
      filter.status = status === "finished" ? "completed" : status;
    }

    if (pattern && pattern !== "") {
      filter.pattern = pattern;
    }

    if (startDate) {
      filter.createdAt = { ...filter.createdAt, $gte: new Date(startDate) };
    }
    if (endDate) {
      if (!filter.createdAt) filter.createdAt = {};
      filter.createdAt.$lte = new Date(endDate);
    }

    const games = await Game.find(filter)
      .select(
        "gameNumber betAmount houseFeePercentage houseFee prizePool status pattern createdAt startedAt winner"
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!games || games.length === 0) {
      return res.json({
        message: "Report data retrieved",
        data: {
          totalGames: 0,
          activeGames: 0,
          totalHouseFee: 0,
          games: [],
        },
      });
    }

    const totalGames = games.length;
    const activeGames = games.filter(
      (g) => g.status === "active" || g.status === "pending"
    ).length;
    const totalHouseFee = games.reduce(
      (sum, game) => sum + (game.houseFee || 0),
      0
    );

    const mappedGames = games.map((game) => ({
      id: game._id,
      gameNumber: game.gameNumber,
      status: game.status === "completed" ? "finished" : game.status,
      started_at: game.startedAt || game.createdAt,
      bet_amount: game.betAmount,
      house_percentage: game.houseFeePercentage,
      winning_pattern: game.pattern,
      house_fee: game.houseFee,
      prize_pool: game.prizePool,
    }));

    res.json({
      message: "Report data retrieved successfully",
      data: {
        totalGames,
        activeGames,
        totalHouseFee: totalHouseFee.toFixed(2),
        games: mappedGames,
      },
    });
  } catch (error) {
    console.error("[getReportData] Error fetching report data:", error);
    next(error);
  }
};

// Get cashier report
// Get cashier report with filters
export const getCashierReport = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "Unauthorized: No authenticated user",
        errorCode: "UNAUTHENTICATED",
      });
    }

    const role = req.user.role || "cashier";
    let cashierId;

    if (role === "moderator") {
      cashierId = req.user.managedCashier;
      if (!cashierId) {
        return res.status(403).json({
          message: "No managed cashier assigned to this moderator",
          errorCode: "NO_MANAGED_CASHIER",
        });
      }
    } else if (role === "cashier") {
      cashierId = req.user.id;
    } else if (role === "admin") {
      cashierId = req.query.cashierId;
    } else {
      return res.status(403).json({
        message: "Unauthorized role",
        errorCode: "UNAUTHORIZED",
      });
    }

    if (cashierId && !mongoose.isValidObjectId(cashierId)) {
      return res.status(400).json({
        message: "Invalid cashier ID format",
        errorCode: "INVALID_CASHIER_ID",
      });
    }

    // Extract filters from query params
    const { status, pattern, startDate, endDate } = req.query;

    let gamesQuery = { cashierId };
    if (role === "admin" && !req.query.cashierId) {
      delete gamesQuery.cashierId; // Admin sees all
    }

    // Apply filters
    if (status && status !== "") {
      gamesQuery.status = status === "finished" ? "completed" : status;
    }
    if (pattern && pattern !== "") {
      gamesQuery.pattern = pattern;
    }
    if (startDate || endDate) {
      gamesQuery.createdAt = {};
      if (startDate) {
        gamesQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        gamesQuery.createdAt.$lte = new Date(endDate);
      }
    }

    let games, counters, results;

    games = await Game.find(gamesQuery).sort({ gameNumber: 1 });
    counters = await Counter.find({ cashierId });
    results = await Result.find({
      gameId: { $in: games.map((g) => g._id) },
    });

    const totalGames = games.length;
    const totalPrizePool = games.reduce(
      (sum, g) => sum + (g.prizePool || 0),
      0
    );
    const totalPrizesAwarded = results.reduce(
      (sum, r) => sum + (r.prize || 0),
      0
    );
    const totalHouseFee = games.reduce(
      (sum, g) => sum + (parseFloat(g.houseFee) || 0),
      0
    );

    res.json({
      message: "Cashier report generated successfully",
      cashierId: role === "admin" && !req.query.cashierId ? null : cashierId,
      totalGames,
      totalPrizePool,
      totalPrizesAwarded,
      totalHouseFee,
      games,
      counters,
      results,
    });
  } catch (error) {
    console.error("[getCashierReport] Error:", error);
    await GameLog.create({
      gameId: null,
      action: "getCashierReport",
      status: "failed",
      details: { error: error.message || "Internal server error" },
    });
    res
      .status(500)
      .json({ message: "Internal server error", errorCode: "SERVER_ERROR" });
  }
};
