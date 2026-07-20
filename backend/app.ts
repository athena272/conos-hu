import express, { type Express } from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import medicationRoutes from "./routes/medicationRoutes";
import retiraMedicationRoutes from "./routes/retiraMedicationRoutes";
import pacienteRoutes from "./routes/pacienteRoutes";
import eventoRoutes from "./routes/eventoRoutes";

const app: Express = express();

// CORS: em produção use ALLOWED_ORIGINS (ex: URL do frontend na Vercel).
// Ex: ALLOWED_ORIGINS=https://seu-app.vercel.app,https://outro-dominio.com
// Se não definido, permite todas as origens (desenvolvimento local).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : null;

app.use(
  cors(
    allowedOrigins
      ? {
          origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            return cb(null, false);
          },
          credentials: true,
        }
      : {}
  )
);
app.use(express.json());

// Rotas
app.use("/", authRoutes);
app.use("/medications", medicationRoutes);
app.use("/retira", retiraMedicationRoutes);
app.use("/pacientes", pacienteRoutes);
app.use("/eventos", eventoRoutes);

export default app;
