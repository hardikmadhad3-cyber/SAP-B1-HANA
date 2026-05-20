const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

const createAccount = async (req, res) => {
  const data = req.body;
  if (!data.Code) return res.status(400).json({ message: "Code is required." });
  if (!data.Name) return res.status(400).json({ message: "Name is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/ChartOfAccounts", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg =
      err.response?.data?.error?.message?.value ||
      err.response?.data?.error?.message ||
      err.message;
    console.error("[SAP createAccount error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getAccount = async (req, res) => {
  try {
    const row = await masterDataDbService.getAccount(req.params.code);
    if (!row) return res.status(404).json({ message: "Account not found." });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAccount = async (req, res) => {
  const { code } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/ChartOfAccounts('${encodeURIComponent(code)}')`,
      data: req.body,
    });
    const row = await masterDataDbService.getAccount(code);
    res.json(row || { Code: code });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updateAccount error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchAccounts = async (req, res) => {
  try {
    const { query = "", accountType = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchAccounts(query, accountType, top, skip);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupParentAccounts = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupParentAccounts(req.query.query || "");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupCurrencies = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupCurrencies(req.query.query || "");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupTaxCodes = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupTaxCodes(req.query.query || "");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createAccount,
  getAccount,
  updateAccount,
  searchAccounts,
  lookupParentAccounts,
  lookupCurrencies,
  lookupTaxCodes,
};
