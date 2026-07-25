const express = require("express");
const router  = express.Router();
const {
  createWarehouse, getWarehouse, updateWarehouse, searchWarehouses,
  lookupCountries, lookupStates, lookupLocations, lookupBusinessPlaces, lookupGLAccounts,
} = require("../controllers/warehouseController");

// Lookups (must come before /:whCode)
router.get("/lookup/countries",   lookupCountries);
router.get("/lookup/states",      lookupStates);
router.get("/lookup/locations",   lookupLocations);
router.get("/lookup/business-places", lookupBusinessPlaces);
router.get("/lookup/gl-accounts", lookupGLAccounts);

// Search
router.get("/search", searchWarehouses);

// CRUD
router.post("/create",    createWarehouse);
router.get("/:whCode",    getWarehouse);
router.patch("/:whCode",  updateWarehouse);

module.exports = router;
