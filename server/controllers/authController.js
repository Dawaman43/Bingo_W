import User from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.js";

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

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const existingUser = await User.findOne({ email }).select("+password");

    if (!existingUser) {
      return res
        .status(404)
        .json({ message: "Can't find user with the provided email" });
    }

    if (!existingUser.password) {
      return res
        .status(500)
        .json({ message: "Password not set for this user" });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: existingUser._id,
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      managedCashier: existingUser.managedCashier, // Add this
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

    console.log("[login] Generated token payload:", payload); // Debug log

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      user: {
        id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        managedCashier: existingUser.managedCashier, // Add this
      },
      token,
    });
  } catch (error) {
    console.error("[login] Error:", error);
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.clearCookie("token");
    return res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    console.error("Error logging in user:", error);
    next(error);
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP with 5 min expiry
    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;
    await user.save();

    // ✅ Correct usage
    await sendEmail(email, otp);

    res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("❌ Error in forgotPassword:", err);
    res.status(500).json({ error: err.message });
  }
};


export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    if (user.otpExpiry < Date.now())
      return res.status(400).json({ message: "OTP expired" });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Clear OTP
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
