import express from "express";
import { adminRegister, login, logout } from "../controllers/authController.js";
import { verifyToken } from "../middlewares/auth.js";

const route = express.Router();

route.post("/admin-register", adminRegister);
route.post("/login", login);

//user must be logged in to logout
route.post("/logout", verifyToken, logout);

export default route;
