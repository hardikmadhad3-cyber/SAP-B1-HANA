const express = require("express");
const controller = require("../../controllers/reports/itemListReport.controller");

const router = express.Router();

router.post("/item-list", controller.postItemListReport);

module.exports = router;
