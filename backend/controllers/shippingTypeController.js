const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

const createShippingType = async (req, res) => {
  const data = req.body;
  if (!data.Name) return res.status(400).json({ message: "Name is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/ShippingTypes", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg =
      err.response?.data?.error?.message?.value ||
      err.response?.data?.error?.message ||
      err.message;
    console.error("[SAP createShippingType error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getShippingType = async (req, res) => {
  try {
    const row = await masterDataDbService.getShippingType(req.params.code);
    if (!row) return res.status(404).json({ message: "Shipping Type not found." });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateShippingType = async (req, res) => {
  const { code } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/ShippingTypes(${encodeURIComponent(code)})`,
      data: req.body,
    });
    const row = await masterDataDbService.getShippingType(code);
    res.json(row || { Code: code });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updateShippingType error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const deleteShippingType = async (req, res) => {
  try {
    await sapService.request({
      method: "DELETE",
      url: `/ShippingTypes(${encodeURIComponent(req.params.code)})`,
    });
    res.json({ success: true });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchShippingTypes = async (req, res) => {
  try {
    const { query = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchShippingTypes(query, top, skip);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createShippingType,
  getShippingType,
  updateShippingType,
  deleteShippingType,
  searchShippingTypes,
};
