const express = require("express");
const controller = require("../../controllers/reports/vendorLiabilitiesAging.controller");

const router = express.Router();

router.get("/vendor-liabilities-aging/lookups", controller.getLookups);
router.post("/vendor-liabilities-aging", controller.postReport);

module.exports = router;
