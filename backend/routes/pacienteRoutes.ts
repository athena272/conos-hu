import express, { type IRouter } from "express";
import * as pacienteController from "../controllers/pacienteController";
import { requireAuth, requirePacienteWrite } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.get("/impacto-estoque", requireAuth, pacienteController.getImpactoEstoque);
router.get(
  "/resumo-por-medicamento",
  requireAuth,
  pacienteController.getResumoPorMedicamento
);
router.get("/", requireAuth, pacienteController.listPacientes);
router.get("/:id/retornos", requireAuth, pacienteController.getRetornos);
router.post("/:id/retornos", requireAuth, requirePacienteWrite, pacienteController.addRetorno);
router.get("/:id", requireAuth, pacienteController.getPacienteById);
router.post("/", requireAuth, requirePacienteWrite, pacienteController.createPaciente);
router.put("/:id", requireAuth, requirePacienteWrite, pacienteController.updatePaciente);
router.delete("/:id", requireAuth, requirePacienteWrite, pacienteController.deletePaciente);

export default router;
