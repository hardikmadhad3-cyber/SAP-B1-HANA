const express = require("express");
const router  = express.Router();
const {
  createPaymentTerms, getPaymentTerms, updatePaymentTerms, searchPaymentTerms,
  lookupCashDiscounts, lookupPaymentMethods,
} = require("../controllers/paymentTermsController");

// Lookups (must come before /:groupNumber)
router.get("/lookup/cash-discounts",  lookupCashDiscounts);
router.get("/lookup/payment-methods", lookupPaymentMethods);

// Search
router.get("/search", searchPaymentTerms);

// CRUD
router.post("/create",          createPaymentTerms);
router.get("/:groupNumber",     getPaymentTerms);
router.patch("/:groupNumber",   updatePaymentTerms);

module.exports = router;
