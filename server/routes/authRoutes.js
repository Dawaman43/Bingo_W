import express from "express";
import { adminRegister, login, logout } from "../controllers/authController.js";
import { isAdmin, verifyToken } from "../middlewares/auth.js";

const route = express.Router();

route.post("/login", login);

//user must be logged in to logout
route.post("/logout", verifyToken, logout);

//admin register
route.post("/admin-register", verifyToken, isAdmin, adminRegister);

export default route;
