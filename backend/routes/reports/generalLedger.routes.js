const express = require("express");
const controller = require("../../controllers/reports/generalLedger.controller");

const router = express.Router();

router.get("/general-ledger/lookups", controller.getLookups);
router.post("/general-ledger", controller.postReport);

module.exports = router;
