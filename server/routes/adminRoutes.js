import express from "express";
import { addUser } from "../controllers/adminController";
import { isAdmin } from "../middlewares/auth";
const route = express.Router();

route.post("/add-user", isAdmin, addUser);

export default route;
