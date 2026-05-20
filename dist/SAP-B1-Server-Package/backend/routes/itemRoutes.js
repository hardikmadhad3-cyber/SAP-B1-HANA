const express  = require("express");
const multer   = require("multer");
const router   = express.Router();
const upload   = multer({ dest: "uploads/tmp/" });

const {
  createItem, getItem, updateItem, searchItems, getRecentItemCodes,
  generateItemCode, checkItemCodeExists,
  getItemPrices, getItemStock,
  lookupItemGroups, createItemGroup,
  lookupManufacturers, createManufacturer,
  lookupHSNCodes,
  lookupPriceLists, lookupVendors, lookupWarehouses, lookupGLAccounts,
  lookupUoMGroups, lookupItemProperties, lookupItemCodePrefixes,
  getAttachments, uploadAttachment, deleteAttachment, serveAttachment,
} = require("../controllers/itemController");

// ── Lookup (must come before /:itemCode) ──────────────────────────────────────
router.get("/lookup/item-groups",       lookupItemGroups);
router.post("/lookup/item-groups",      createItemGroup);
router.get("/lookup/manufacturers",     lookupManufacturers);
router.post("/lookup/manufacturers",    createManufacturer);
router.get("/lookup/hsn-codes",         lookupHSNCodes);
router.get("/lookup/price-lists",       lookupPriceLists);
router.get("/lookup/vendors",           lookupVendors);
router.get("/lookup/warehouses",        lookupWarehouses);
router.get("/lookup/gl-accounts",       lookupGLAccounts);
router.get("/lookup/uom-groups",        lookupUoMGroups);
router.get("/lookup/item-properties",   lookupItemProperties);
router.get("/lookup/item-code-prefixes", lookupItemCodePrefixes);

// ── Utilities ─────────────────────────────────────────────────────────────────
router.get("/generate-code",            generateItemCode);
router.get("/check-exists/:itemCode",   checkItemCodeExists);
router.get("/recent-codes",             getRecentItemCodes);

// ── Search ────────────────────────────────────────────────────────────────────
router.get("/search", searchItems);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post("/create",       createItem);
router.get("/:itemCode",     getItem);
router.patch("/:itemCode",   updateItem);

// ── Per-item sub-resources ────────────────────────────────────────────────────
router.get("/:itemCode/prices",  getItemPrices);
router.get("/:itemCode/stock",   getItemStock);

router.get("/:itemCode/attachments",                    getAttachments);
router.post("/:itemCode/attachments", upload.single("file"), uploadAttachment);
router.delete("/:itemCode/attachments/:attachmentId",   deleteAttachment);
router.get("/:itemCode/attachments/:attachmentId",      serveAttachment);

module.exports = router;
