const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

const createTaxCode = async (req, res) => {
  const data = req.body;
  if (!data.Code) return res.status(400).json({ message: "Code is required." });
  if (!data.Name) return res.status(400).json({ message: "Name is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/VatGroups", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg =
      err.response?.data?.error?.message?.value ||
      err.response?.data?.error?.message ||
      err.message;
    console.error("[SAP createTaxCode error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getTaxCode = async (req, res) => {
  try {
    const row = await masterDataDbService.getTaxCode(req.params.code);
    if (!row) return res.status(404).json({ message: "Tax Code not found." });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateTaxCode = async (req, res) => {
  const { code } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/VatGroups('${encodeURIComponent(code)}')`,
      data: req.body,
    });
    const row = await masterDataDbService.getTaxCode(code);
    res.json(row || { Code: code });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updateTaxCode error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchTaxCodes = async (req, res) => {
  try {
    const { query = "", category = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchTaxCodes(query, category, top, skip);
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
  createTaxCode,
  getTaxCode,
  updateTaxCode,
  searchTaxCodes,
  lookupGLAccounts,
};
