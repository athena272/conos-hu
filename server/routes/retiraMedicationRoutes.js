const express = require("express");
const retiraMedicationController = require("../controllers/retiraMedicationController");

const router = express.Router();

router.post("/", retiraMedicationController.retiraMedication);

module.exports = router;