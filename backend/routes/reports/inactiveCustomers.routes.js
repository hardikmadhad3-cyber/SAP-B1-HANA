const express = require("express");
const controller = require("../../controllers/reports/inactiveCustomers.controller");

const router = express.Router();

router.get("/inactive-customers/lookups", controller.getLookups);
router.post("/inactive-customers", controller.postReport);

module.exports = router;
