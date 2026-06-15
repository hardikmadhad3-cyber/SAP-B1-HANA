const express = require("express");
const controller = require("../../controllers/reports/inventoryPostingList.controller");

const router = express.Router();

router.get("/inventory-posting-list/lookups", controller.getInventoryPostingListLookups);
router.post("/inventory-posting-list", controller.postInventoryPostingList);

module.exports = router;
