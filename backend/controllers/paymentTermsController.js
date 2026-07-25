const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

// ── CRUD ──────────────────────────────────────────────────────────────────────

const createPaymentTerms = async (req, res) => {
  const data = req.body;
  if (!data.PaymentTermsGroupName) return res.status(400).json({ message: "PaymentTermsGroupName is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/PaymentTermsTypes", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value
      || err.response?.data?.error?.message
      || err.message;
    console.error("[SAP createPaymentTerms error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getPaymentTerms = async (req, res) => {
  try {
    const row = await masterDataDbService.getPaymentTerms(req.params.groupNumber);
    if (!row) return res.status(404).json({ message: "Payment Terms not found." });
    res.json(row);
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const updatePaymentTerms = async (req, res) => {
  const { groupNumber } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/PaymentTermsTypes(${encodeURIComponent(groupNumber)})`,
      data: req.body,
    });
    const row = await masterDataDbService.getPaymentTerms(groupNumber);
    res.json(row || { GroupNumber: Number(groupNumber) });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updatePaymentTerms error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchPaymentTerms = async (req, res) => {
  try {
    const { query = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchPaymentTerms(query, top, skip);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Lookups ───────────────────────────────────────────────────────────────────

const lookupCashDiscounts = async (req, res) => {
  await sapService.ensureSession();
  try {
    const resp = await sapService.request({
      method: "GET",
      url: "/CashDiscounts?$select=Code,Name&$top=200",
    });
    res.json((resp.data.value || []).map((c) => ({ code: c.Code, name: c.Name })));
  } catch {
    res.json([]);
  }
};

const lookupPaymentMethods = async (req, res) => {
  await sapService.ensureSession();
  try {
    const resp = await sapService.request({
      method: "GET",
      url: "/PaymentMethods?$select=Code,Description&$top=200",
    });
    res.json((resp.data.value || []).map((m) => ({ code: m.Code, name: m.Description })));
  } catch {
    res.json([]);
  }
};

module.exports = {
  createPaymentTerms, getPaymentTerms, updatePaymentTerms, searchPaymentTerms,
  lookupCashDiscounts, lookupPaymentMethods,
};
