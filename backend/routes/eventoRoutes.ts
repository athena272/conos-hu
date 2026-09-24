import express, { type IRouter } from "express";
import * as eventoController from "../controllers/eventoController";
import { requireAuth } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

/** Histórico de ações: qualquer usuário autenticado (todos os papéis). */
router.get("/", requireAuth, eventoController.listEventos);

export default router;
