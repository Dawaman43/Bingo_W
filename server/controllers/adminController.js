import User from "../models/User.js";
import bcrypt from "bcrypt";

export const addUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password, and role are required" });
    }

    if (!["cashier", "moderator"].includes(role)) {
      return res.status(400).json({ message: "Please choose a valid role" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email already exists in the database" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    const { password: _, ...userWithoutPassword } = newUser.toObject();

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Error adding user:", error);
    next(error);
  }
};

//  Get all users (only cashier and moderator)
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find(
      { role: { $in: ["cashier", "moderator"] } }, // filter only cashier & moderator
      "-password" // exclude password field
    ).sort({ createdAt: -1 }); // newest first

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

// Delete user by ID
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // prevent deleting admin
    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot delete an admin" });
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    next(error);
  }
};
