import express, { type IRouter } from "express";
import { retiraMedication } from "../controllers/retiraMedicationController";
import { requireAuth, requireMedicationWrite } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.post("/", requireAuth, requireMedicationWrite, retiraMedication);

export default router;
