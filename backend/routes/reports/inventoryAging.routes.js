const express = require("express");
const controller = require("../../controllers/reports/inventoryAging.controller");

const router = express.Router();

router.get("/inventory-aging/lookups", controller.getLookups);
router.post("/inventory-aging", controller.postReport);

module.exports = router;
