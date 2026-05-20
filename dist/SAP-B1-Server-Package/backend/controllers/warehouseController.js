const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

const createWarehouse = async (req, res) => {
  const data = req.body;
  if (!data.WarehouseCode) return res.status(400).json({ message: "WarehouseCode is required." });
  if (!data.WarehouseName) return res.status(400).json({ message: "WarehouseName is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/Warehouses", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg =
      err.response?.data?.error?.message?.value ||
      err.response?.data?.error?.message ||
      err.message;
    console.error("[SAP createWarehouse error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getWarehouse = async (req, res) => {
  try {
    const row = await masterDataDbService.getWarehouse(req.params.whCode);
    if (!row) return res.status(404).json({ message: "Warehouse not found." });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateWarehouse = async (req, res) => {
  const { whCode } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/Warehouses('${encodeURIComponent(whCode)}')`,
      data: req.body,
    });
    const row = await masterDataDbService.getWarehouse(whCode);
    res.json(row || { WarehouseCode: whCode });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updateWarehouse error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchWarehouses = async (req, res) => {
  try {
    const { query = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchWarehouses(query, top, skip);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupCountries = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupCountries(req.query.query || "");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupStates = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupStates(req.query.country || "");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupLocations = async (_req, res) => {
  try {
    const rows = await masterDataDbService.lookupWarehouseLocations();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupBusinessPlaces = async (_req, res) => {
  try {
    const rows = await masterDataDbService.lookupBusinessPlaces();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupGLAccounts = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupGLAccounts(req.query.query || "", 50);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createWarehouse,
  getWarehouse,
  updateWarehouse,
  searchWarehouses,
  lookupCountries,
  lookupStates,
  lookupLocations,
  lookupBusinessPlaces,
  lookupGLAccounts,
};
