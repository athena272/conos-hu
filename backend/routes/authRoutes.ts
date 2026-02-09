import express, { type IRouter } from "express";
import { registerUser, loginUser } from "../controllers/authController";

const router: IRouter = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
