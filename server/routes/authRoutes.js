import express from "express";
import { adminRegister } from "../controllers/authController.js";

const route = express.Router();

route.post("/admin-register", adminRegister);

export default route;
