import express from "express";
import { addUser, deleteUser, getUsers } from "../controllers/adminController.js";
import { isAdmin, verifyToken } from "../middlewares/auth.js";
const route = express.Router();

// Admin-only routes
route.get("/users", verifyToken, isAdmin, getUsers);       // get all users
route.delete("/users/:id", verifyToken, isAdmin, deleteUser); // delete user

route.post("/add-user", verifyToken, isAdmin, addUser);

export default route;
