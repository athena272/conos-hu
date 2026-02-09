import express, { type IRouter } from "express";
import * as medicationController from "../controllers/medicationController";

const router: IRouter = express.Router();

router.post("/", medicationController.registerMedication);
router.get("/", medicationController.getMedications);
router.post("/search", medicationController.searchMedication);

export default router;
