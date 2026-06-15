const express = require("express");
const controller = require("../../controllers/reports/glAccountsBusinessPartners.controller");

const router = express.Router();

router.get("/gl-accounts-business-partners/lookups", controller.getLookups);
router.get("/gl-accounts-business-partners/business-partners", controller.lookupBusinessPartners);
router.post("/gl-accounts-business-partners", controller.postReport);

module.exports = router;
