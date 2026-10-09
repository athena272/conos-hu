import express, { type IRouter } from "express";
import { registerUser, loginUser, identifyOperator } from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/identify", requireAuth, identifyOperator);

export default router;
