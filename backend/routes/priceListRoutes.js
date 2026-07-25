const express = require("express");
const router  = express.Router();
const {
  createPriceList, getPriceList, updatePriceList, searchPriceLists,
  lookupPriceLists, lookupCurrencies,
} = require("../controllers/priceListController");

// Lookups (must come before /:priceListNo)
router.get("/lookup/price-lists", lookupPriceLists);
router.get("/lookup/currencies",  lookupCurrencies);

// Search
router.get("/search", searchPriceLists);

// CRUD
router.post("/create",          createPriceList);
router.get("/:priceListNo",     getPriceList);
router.patch("/:priceListNo",   updatePriceList);

module.exports = router;
