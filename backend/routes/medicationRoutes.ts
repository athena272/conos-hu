import express, { type IRouter } from "express";
import * as medicationController from "../controllers/medicationController";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.post("/", requireAuth, requireAdmin, medicationController.registerMedication);
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
router.post("/add-quantity", requireAuth, requireAdmin, medicationController.addQuantity);
router.post("/search", requireAuth, medicationController.searchMedication);
router.post("/resolve-scan", requireAuth, requireAdmin, medicationController.resolveScan);
router.get("/:id", requireAuth, medicationController.getMedicationById);
router.put("/:id", requireAuth, requireAdmin, medicationController.updateMedication);
router.delete("/:id", requireAuth, requireAdmin, medicationController.deleteMedication);

export default router;
