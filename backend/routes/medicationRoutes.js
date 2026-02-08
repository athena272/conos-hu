const express = require("express");
const medicationController = require("../controllers/medicationController");

const router = express.Router();

router.post("/", medicationController.registerMedication);
router.get("/", medicationController.getMedications);
router.get("/", medicationController.getValidade);
router.get("/", medicationController.getQuantity);
router.post("/search", medicationController.searchMedication);

module.exports = router;
