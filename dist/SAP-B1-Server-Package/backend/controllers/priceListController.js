const sapService = require("../services/sapService");
const masterDataDbService = require("../services/masterDataDbService");

const createPriceList = async (req, res) => {
  const data = req.body;
  if (!data.PriceListName) return res.status(400).json({ message: "PriceListName is required." });
  try {
    const result = await sapService.request({ method: "POST", url: "/PriceLists", data });
    res.status(201).json(result.data);
  } catch (err) {
    const msg =
      err.response?.data?.error?.message?.value ||
      err.response?.data?.error?.message ||
      err.message;
    console.error("[SAP createPriceList error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const getPriceList = async (req, res) => {
  try {
    const row = await masterDataDbService.getPriceList(req.params.priceListNo);
    if (!row) return res.status(404).json({ message: "Price List not found." });
    res.json(row);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updatePriceList = async (req, res) => {
  const { priceListNo } = req.params;
  try {
    await sapService.request({
      method: "PATCH",
      url: `/PriceLists(${encodeURIComponent(priceListNo)})`,
      data: req.body,
    });
    const row = await masterDataDbService.getPriceList(priceListNo);
    res.json(row || { PriceListNo: Number(priceListNo) });
  } catch (err) {
    const msg = err.response?.data?.error?.message?.value || err.message;
    console.error("[SAP updatePriceList error]", msg, JSON.stringify(err.response?.data));
    res.status(err.response?.status || 500).json({ message: msg });
  }
};

const searchPriceLists = async (req, res) => {
  try {
    const { query = "", top = 50, skip = 0 } = req.query;
    const rows = await masterDataDbService.searchPriceLists(query, top, skip);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const lookupPriceLists = async (req, res) => {
  try {
    const rows = await masterDataDbService.lookupPriceLists(req.query.query || "");
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

module.exports = {
  createPriceList,
  getPriceList,
  updatePriceList,
  searchPriceLists,
  lookupPriceLists,
  lookupCurrencies,
};
