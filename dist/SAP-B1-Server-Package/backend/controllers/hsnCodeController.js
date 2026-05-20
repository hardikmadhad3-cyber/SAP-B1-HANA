const hsnCodeDb = require("../services/hsnCodeDbService");

/**
 * Get all HSN Codes from SAP B1 OCHP table via ODBC
 * GET /api/hsn-codes
 */
const getHSNCodes = async (req, res) => {
  try {
    const { query = "", top = 100, skip = 0 } = req.query;
    
    // Use ODBC/Direct SQL for GET operations
    const hsnCodes = await hsnCodeDb.getHSNCodes(
      query,
      parseInt(top) || 100,
      parseInt(skip) || 0
    );
    
    res.json(hsnCodes);
  } catch (err) {
    const msg = err.message || "Failed to fetch HSN codes";
    console.error("[HSN Code Controller] getHSNCodes error:", msg, err);
    res.status(500).json({ 
      message: msg,
      detail: { error: { message: msg } }
    });
  }
};

/**
 * Get single HSN Code by ChapterID via ODBC
 * GET /api/hsn-codes/:code
 */
const getHSNCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    // Use ODBC/Direct SQL for GET operations
    const hsnCode = await hsnCodeDb.getHSNCode(code);
    
    if (!hsnCode) {
      return res.status(404).json({ message: "HSN Code not found" });
    }
    
    res.json(hsnCode);
  } catch (err) {
    const msg = err.message || "Failed to fetch HSN code";
    console.error("[HSN Code Controller] getHSNCode error:", msg, err);
    res.status(500).json({ message: msg });
  }
};

/**
 * Get HSN Code from Item Master via ODBC
 * GET /api/hsn-codes/item/:itemCode
 */
const getHSNCodeFromItem = async (req, res) => {
  try {
    const { itemCode } = req.params;
    
    // Use ODBC/Direct SQL to get HSN from item
    const hsnData = await hsnCodeDb.getHSNCodeFromItem(itemCode);
    
    res.json(hsnData);
  } catch (err) {
    const msg = err.message || "Failed to fetch HSN code from item";
    console.error("[HSN Code Controller] getHSNCodeFromItem error:", msg, err);
    res.status(500).json({ message: msg });
  }
};

module.exports = {
  getHSNCodes,
  getHSNCode,
  getHSNCodeFromItem,
};
