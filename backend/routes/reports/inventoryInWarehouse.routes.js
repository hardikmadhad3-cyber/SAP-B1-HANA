const express = require("express");
const controller = require("../../controllers/reports/inventoryInWarehouse.controller");

const router = express.Router();

router.get("/inventory-in-warehouse/lookups", controller.getLookups);
router.post("/inventory-in-warehouse", controller.postReport);

module.exports = router;
