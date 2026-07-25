const express = require("express");
const controller = require("../../controllers/reports/purchaseAnalysis.controller");

const router = express.Router();

router.post("/purchase-analysis", controller.postPurchaseAnalysis);

module.exports = router;
