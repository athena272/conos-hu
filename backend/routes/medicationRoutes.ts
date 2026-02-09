import express, { type IRouter } from "express";
import * as medicationController from "../controllers/medicationController";

const router: IRouter = express.Router();

router.post("/", medicationController.registerMedication);
router.get("/", medicationController.getMedications);
router.get("/by-name-concentration", medicationController.getLotsByNameConcentration);
router.post("/add-quantity", medicationController.addQuantity);
router.get("/:id", medicationController.getMedicationById);
router.put("/:id", medicationController.updateMedication);
router.post("/search", medicationController.searchMedication);

export default router;
