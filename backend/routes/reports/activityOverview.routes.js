const express = require("express");
const controller = require("../../controllers/reports/activityOverview.controller");

const router = express.Router();

router.get("/activity-overview/lookups", controller.getLookups);
router.get("/activity-overview/users", controller.lookupUsers);
router.get("/activity-overview/employees", controller.lookupEmployees);
router.get("/activity-overview/recipient-lists", controller.lookupRecipientLists);
router.get("/activity-overview/user-defined-fields", controller.lookupUserDefinedFields);
router.get("/activity-overview/activity/:activityNo", controller.getActivity);
router.post("/activity-overview", controller.postActivityOverview);

module.exports = router;
