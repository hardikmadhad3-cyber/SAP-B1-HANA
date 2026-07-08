const express = require("express");
const controller = require("../../controllers/reports/financialStatements.controller");

const router = express.Router();

router.get("/financial-statements/lookups", controller.getLookups);
router.post("/financial-statements/:reportKey", controller.postReport);

module.exports = router;
