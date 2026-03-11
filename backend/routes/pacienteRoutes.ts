import express, { type IRouter } from "express";
import * as pacienteController from "../controllers/pacienteController";

const router: IRouter = express.Router();

router.get("/impacto-estoque", pacienteController.getImpactoEstoque);
router.get("/resumo-por-medicamento", pacienteController.getResumoPorMedicamento);
router.get("/", pacienteController.listPacientes);
router.get("/:id/retornos", pacienteController.getRetornos);
router.post("/:id/retornos", pacienteController.addRetorno);
router.get("/:id", pacienteController.getPacienteById);
router.post("/", pacienteController.createPaciente);
router.put("/:id", pacienteController.updatePaciente);
router.delete("/:id", pacienteController.deletePaciente);

export default router;
