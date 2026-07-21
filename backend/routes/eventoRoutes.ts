import express, { type IRouter } from "express";
import * as eventoController from "../controllers/eventoController";
import { requireAuth, requireElevated } from "../middleware/authMiddleware";

const router: IRouter = express.Router();

router.get("/", requireAuth, requireElevated, eventoController.listEventos);

export default router;
