const express = require("express");
const router = express.Router();
const {
  getHSNCodes,
  getHSNCode,
  getHSNCodeFromItem,
} = require("../controllers/hsnCodeController");

// Get all HSN codes (with optional search)
router.get("/", getHSNCodes);

// Get HSN code from item master
router.get("/item/:itemCode", getHSNCodeFromItem);

// Get single HSN code by ChapterID
router.get("/:code", getHSNCode);

module.exports = router;
