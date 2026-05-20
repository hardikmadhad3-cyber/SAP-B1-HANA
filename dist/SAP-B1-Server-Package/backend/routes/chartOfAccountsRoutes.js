const express = require("express");
const router  = express.Router();
const {
  createAccount, getAccount, updateAccount, searchAccounts,
  lookupParentAccounts, lookupCurrencies, lookupTaxCodes,
} = require("../controllers/chartOfAccountsController");

// Lookups (must come before /:code)
router.get("/lookup/parent-accounts", lookupParentAccounts);
router.get("/lookup/currencies",      lookupCurrencies);
router.get("/lookup/tax-codes",       lookupTaxCodes);

// Search
router.get("/search", searchAccounts);

// CRUD
router.post("/create",  createAccount);
router.get("/:code",    getAccount);
router.patch("/:code",  updateAccount);

module.exports = router;
