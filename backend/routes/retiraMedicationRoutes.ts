import express, { type IRouter } from "express";
import { retiraMedication } from "../controllers/retiraMedicationController";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.post("/", requireAuth, requireAdmin, retiraMedication);

export default router;
