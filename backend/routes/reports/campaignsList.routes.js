const express = require("express");
const controller = require("../../controllers/reports/campaignsList.controller");

const router = express.Router();

router.get("/campaigns-list/lookups", controller.getLookups);
router.post("/campaigns-list", controller.postCampaignsListReport);

module.exports = router;
