import express, { type IRouter } from "express";
import * as medicationController from "../controllers/medicationController";
import {
  requireAuth,
  requireMedicationWrite,
} from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.post("/", requireAuth, requireMedicationWrite, medicationController.registerMedication);
router.get("/", requireAuth, medicationController.getMedications);
router.get(
  "/distinct-nome-concentration",
  requireAuth,
  medicationController.getDistinctNomeConcentration
);
router.get(
  "/by-name-concentration",
  requireAuth,
  medicationController.getLotsByNameConcentration
);
router.post("/add-quantity", requireAuth, requireMedicationWrite, medicationController.addQuantity);
router.post("/search", requireAuth, medicationController.searchMedication);
router.post("/resolve-scan", requireAuth, requireMedicationWrite, medicationController.resolveScan);
router.get("/:id", requireAuth, medicationController.getMedicationById);
router.put("/:id", requireAuth, requireMedicationWrite, medicationController.updateMedication);
router.delete("/:id", requireAuth, requireMedicationWrite, medicationController.deleteMedication);

export default router;
