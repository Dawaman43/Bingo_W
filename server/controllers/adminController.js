import User from "../models/User.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

export const addUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cashier, moderator } = req.body;

    // Validate input for both cashier and moderator
    if (
      !cashier ||
      !cashier.name ||
      !cashier.email ||
      !cashier.password ||
      !moderator ||
      !moderator.name ||
      !moderator.email ||
      !moderator.password
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message:
          "Name, email, and password are required for both cashier and moderator",
      });
    }

    // Validate roles
    if (cashier.role !== "cashier" || moderator.role !== "moderator") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid roles specified" });
    }

    // Check for existing emails
    const existingCashier = await User.findOne({
      email: cashier.email,
    }).session(session);
    const existingModerator = await User.findOne({
      email: moderator.email,
    }).session(session);
    if (existingCashier || existingModerator) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "Email already exists in the database" });
    }

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const hashedCashierPassword = await bcrypt.hash(cashier.password, salt);
    const hashedModeratorPassword = await bcrypt.hash(moderator.password, salt);

    // Create users
    const newCashier = await User.create(
      [
        {
          name: cashier.name,
          email: cashier.email,
          password: hashedCashierPassword,
          role: "cashier",
        },
      ],
      { session }
    );

    const newModerator = await User.create(
      [
        {
          name: moderator.name,
          email: moderator.email,
          password: hashedModeratorPassword,
          role: "moderator",
        },
      ],
      { session }
    );

    // Exclude passwords from response
    const { password: cashierPassword, ...cashierWithoutPassword } =
      newCashier[0].toObject();
    const { password: moderatorPassword, ...moderatorWithoutPassword } =
      newModerator[0].toObject();

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "Cashier and Moderator registered successfully",
      users: [cashierWithoutPassword, moderatorWithoutPassword],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding users:", error);
    next(error);
  }
};

// Get all users (only cashier and moderator)
export const getUsers = async (req, res, next) => {
  try {
    const requestingUser = req.user; // Assuming req.user is the logged-in user
    let users;

    if (requestingUser.role === "moderator") {
      // Find the paired cashier (assuming created at the same time)
      const pairedCashier = await User.findOne({
        role: "cashier",
        createdAt: {
          $gte: requestingUser.createdAt,
          $lte: requestingUser.createdAt,
        },
      });

      if (!pairedCashier) {
        return res.status(404).json({ message: "No paired cashier found" });
      }

      users = [pairedCashier, requestingUser];
    } else {
      users = await User.find(
        { role: { $in: ["cashier", "moderator"] } },
        "-password"
      ).sort({ createdAt: -1 });
    }

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const user = await User.findById(id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Cannot delete an admin" });
    }

    // Find the paired user
    const pairedRole = user.role === "cashier" ? "moderator" : "cashier";
    const pairedUser = await User.findOne({
      role: pairedRole,
      createdAt: { $gte: user.createdAt, $lte: user.createdAt },
    }).session(session);

    // Delete associated games if user is cashier
    if (user.role === "cashier") {
      await Game.deleteMany({ cashierId: user._id }).session(session);
      await GameLog.deleteMany({
        gameId: {
          $in: await Game.find({ cashierId: user._id }).distinct("_id"),
        },
      }).session(session);
      await JackpotCandidate.deleteMany({
        gameId: {
          $in: await Game.find({ cashierId: user._id }).distinct("_id"),
        },
      }).session(session);
    }

    if (pairedUser) {
      await User.findByIdAndDelete(pairedUser._id).session(session);
    }

    await User.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "User and paired user deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting user:", error);
    next(error);
  }
};
