import express from "express";
import { adminRegister, login } from "../controllers/authController.js";

const route = express.Router();

route.post("/admin-register", adminRegister);
route.post("/login", login);

export default route;
