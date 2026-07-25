const express = require("express");
const router  = express.Router();
const {
  createShippingType, getShippingType, updateShippingType, deleteShippingType, searchShippingTypes,
} = require("../controllers/shippingTypeController");

router.get("/search",   searchShippingTypes);
router.post("/create",  createShippingType);
router.get("/:code",    getShippingType);
router.patch("/:code",  updateShippingType);
router.delete("/:code", deleteShippingType);

module.exports = router;
