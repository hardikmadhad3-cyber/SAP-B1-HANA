const express = require("express");
const controller = require("../../controllers/reports/productionOpenItems.controller");

const router = express.Router();

router.post("/production/open-items-list", controller.postProductionOpenItemsReport);

module.exports = router;
