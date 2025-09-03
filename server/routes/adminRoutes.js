import express from "express";
import { addUser } from "../controllers/adminController.js";
import { isAdmin, verifyToken } from "../middlewares/auth.js";
const route = express.Router();

route.post("/add-user", verifyToken, isAdmin, addUser);

export default route;
