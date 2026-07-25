const express = require("express");
const router  = express.Router();
const {
  createBranch, getBranch, updateBranch, searchBranches,
  lookupWarehouses,
} = require("../controllers/branchController");

// Lookups (must come before /:bplid)
router.get("/lookup/warehouses", lookupWarehouses);

// Search
router.get("/search", searchBranches);

// CRUD
router.post("/create",   createBranch);
router.get("/:bplid",    getBranch);
router.patch("/:bplid",  updateBranch);

module.exports = router;
