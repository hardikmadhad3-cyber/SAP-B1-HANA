const express = require("express");
const router  = express.Router();
const {
  createBP, getBP, updateBP, searchBP,
  lookupBPGroups, lookupPaymentTerms, lookupSalesPersons, lookupPriceLists, lookupCurrencies, lookupCountries,
  lookupCompanyTypes,
  lookupCreditCards, createCreditCard, lookupBanks, lookupHouseBankAccounts,
  lookupWithholdingTaxCodes,
  lookupNumberingSeries, getNextNumber,
} = require("../controllers/businessPartnerController");

// Lookups (before /:cardCode)
router.get("/lookup/groups",        lookupBPGroups);
router.get("/lookup/payment-terms", lookupPaymentTerms);
router.get("/lookup/sales-persons", lookupSalesPersons);
router.get("/lookup/price-lists",   lookupPriceLists);
router.get("/lookup/currencies",    lookupCurrencies);
router.get("/lookup/countries",     lookupCountries);
router.get("/lookup/company-types", lookupCompanyTypes);
router.get("/lookup/credit-cards",  lookupCreditCards);
router.post("/lookup/credit-cards", createCreditCard);
router.get("/lookup/banks",         lookupBanks);
router.get("/lookup/house-bank-accounts", lookupHouseBankAccounts);
router.get("/lookup/withholding-tax-codes", lookupWithholdingTaxCodes);
router.get("/lookup/series",        lookupNumberingSeries);
router.get("/lookup/series/:series/next", getNextNumber);

// Search
router.get("/search", searchBP);

// CRUD
router.post("/create",       createBP);
router.get("/:cardCode",     getBP);
router.patch("/:cardCode",   updateBP);

module.exports = router;
