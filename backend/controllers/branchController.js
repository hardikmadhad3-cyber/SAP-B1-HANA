const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

// ── CRUD ──────────────────────────────────────────────────────────────────────

const createBranch = async (req, res) => {
  const data = req.body;
  if (!data.BPLName) return res.status(400).json({ message: "BPLName is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/BusinessPlaces", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value
      || err.response?.data?.error?.message
      || err.message;
    console.error("[SAP createBranch error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getBranch = async (req, res) => {
  try {
    const branch = await masterDataDbService.getBranch(req.params.bplid);
    if (!branch) return res.status(404).json({ message: "Branch not found." });
    res.json(branch);
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const updateBranch = async (req, res) => {
  const { bplid } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/BusinessPlaces(${encodeURIComponent(bplid)})`,
      data: req.body,
    });
    const row = await masterDataDbService.getBranch(bplid);
    res.json(row || { BPLID: Number(bplid) });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updateBranch error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchBranches = async (req, res) => {
  try {
    const { query = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchBranches(query, top, skip);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Lookups ───────────────────────────────────────────────────────────────────

const lookupWarehouses = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupBranchWarehouses(req.query.query || "", req.query.branchId || "");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createBranch, getBranch, updateBranch, searchBranches,
  lookupWarehouses,
};
