const express = require("express");
const router  = express.Router();
const {
  createTaxCode, getTaxCode, updateTaxCode, searchTaxCodes,
  lookupGLAccounts,
} = require("../controllers/taxCodeController");

// Lookups (must come before /:code)
router.get("/lookup/gl-accounts", lookupGLAccounts);

// Search
router.get("/search", searchTaxCodes);

// CRUD
router.post("/create",  createTaxCode);
router.get("/:code",    getTaxCode);
router.patch("/:code",  updateTaxCode);

module.exports = router;
