const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const medicationRoutes = require("./routes/medicationRoutes");
const retiraMedicationRoutes = require("./routes/retiraMedicationRoutes");

const app = express();

// Middlewares - SIMPLIFICAR para teste
app.use(cors()); // Permite todas as origens
app.use(express.json());

// Rotas
app.use("/", authRoutes);
app.use("/medications", medicationRoutes);
app.use("/retira", retiraMedicationRoutes);

module.exports = app;