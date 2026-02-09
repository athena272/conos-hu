import express, { type IRouter } from "express";
import { retiraMedication } from "../controllers/retiraMedicationController";

const router: IRouter = express.Router();

router.post("/", retiraMedication);

export default router;
