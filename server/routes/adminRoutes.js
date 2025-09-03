import express from "express";
import { addUser } from "../controllers/adminController.js";
import { isAdmin } from "../middlewares/auth.js";
const route = express.Router();

route.post("/add-user", isAdmin, addUser);

export default route;
