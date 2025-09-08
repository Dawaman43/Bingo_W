import express from "express";
import { adminRegister, forgotPassword, login, logout, resetPassword } from "../controllers/authController.js";
import { isAdmin, verifyToken } from "../middlewares/auth.js";

const route = express.Router();

route.post("/forgot-password", forgotPassword);
route.post("/reset-password", resetPassword);

route.post("/login", login);

//user must be logged in to logout
route.post("/logout", verifyToken, logout);

//admin register
route.post("/admin-register", adminRegister);

export default route;
