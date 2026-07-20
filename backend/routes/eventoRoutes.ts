import express, { type IRouter } from "express";
import * as eventoController from "../controllers/eventoController";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.get("/", requireAuth, requireAdmin, eventoController.listEventos);

export default router;
