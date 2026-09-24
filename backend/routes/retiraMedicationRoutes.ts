import express, { type IRouter } from "express";
import { retiraMedication } from "../controllers/retiraMedicationController";
import { requireAuth, requireMedicationWithdraw } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.post("/", requireAuth, requireMedicationWithdraw, retiraMedication);

export default router;
