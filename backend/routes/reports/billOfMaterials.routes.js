const express = require("express");
const controller = require("../../controllers/reports/billOfMaterials.controller");

const router = express.Router();

router.post("/production/bill-of-materials", controller.postBillOfMaterialsReport);

module.exports = router;
