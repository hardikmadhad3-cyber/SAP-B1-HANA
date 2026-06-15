const express = require("express");
const controller = require("../../controllers/reports/inventoryAudit.controller");

const router = express.Router();

router.get("/inventory-audit/lookups", controller.getLookups);
router.post("/inventory-audit", controller.postReport);

module.exports = router;
