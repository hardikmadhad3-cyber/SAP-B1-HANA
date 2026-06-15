const express = require("express");
const controller = require("../../controllers/reports/customerReceivablesAging.controller");

const router = express.Router();

router.get("/customer-receivables-aging/lookups", controller.getLookups);
router.post("/customer-receivables-aging", controller.postReport);

module.exports = router;
