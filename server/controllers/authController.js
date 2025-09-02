import User from "../models/User.js";
import bcrypt from "bcrypt";

export const adminRegister = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists in the database",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    const { password: _, ...userWithoutPassword } = newUser.toObject();

    return res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Error registering admin:", error);
    next(error);
  }
};
