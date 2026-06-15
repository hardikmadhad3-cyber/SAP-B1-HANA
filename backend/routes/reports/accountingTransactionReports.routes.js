const express = require("express");
const controller = require("../../controllers/reports/accountingTransactionReports.controller");

const router = express.Router();

router.get("/accounting-transactions/lookups", controller.getLookups);
router.post("/accounting-transactions/:reportKey", controller.postReport);

module.exports = router;
