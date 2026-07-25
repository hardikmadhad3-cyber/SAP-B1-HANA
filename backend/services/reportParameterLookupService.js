const masterDataDbService = require('./masterDataDbService');
const itemDbService = require('./itemDbService');

const LOOKUP_SOURCES = {
  OITM: {
    columns: [
      { key: 'ItemCode', label: 'Item Code' },
      { key: 'ItemName', label: 'Item Name' },
    ],
    fetch: async (query) => {
      const rows = await itemDbService.searchItems(query, 200, 0);
      return rows.map((row) => ({
        ItemCode: row.ItemCode || '',
        ItemName: row.ItemName || '',
        InStock: row.InStock ?? '',
        WTaxLiable: row.WTaxLiable ?? '',
      }));
    },
  },
  OCRD_CUSTOMERS: {
    columns: [
      { key: 'CardCode', label: 'Customer Code' },
      { key: 'CardName', label: 'Customer Name' },
    ],
    fetch: async (query) => {
      const rows = await masterDataDbService.searchBP(query, 'cCustomer', 200, 0);
      return rows.map((row) => ({
        CardCode: row.CardCode || '',
        CardName: row.CardName || '',
      }));
    },
  },
  OCRD_SUPPLIERS: {
    columns: [
      { key: 'CardCode', label: 'Vendor Code' },
      { key: 'CardName', label: 'Vendor Name' },
    ],
    fetch: async (query) => {
      const rows = await masterDataDbService.searchBP(query, 'cSupplier', 200, 0);
      return rows.map((row) => ({
        CardCode: row.CardCode || '',
        CardName: row.CardName || '',
      }));
    },
  },
  OCRD: {
    columns: [
      { key: 'CardCode', label: 'BP Code' },
      { key: 'CardName', label: 'BP Name' },
      { key: 'Country', label: 'Country' },
      { key: 'CardTypeLabel', label: 'BP Type' },
      { key: 'Balance', label: 'Account Balance' },
      { key: 'Active', label: 'Active' },
      { key: 'VendorTypeId', label: 'Vendor Type ID' },
      { key: 'VendorOccupation', label: 'Vendor Occupation' },
    ],
    fetch: async (query) => {
      const rows = await masterDataDbService.searchBP(query, '', 200, 0);
      return rows.map((row) => ({
        CardCode: row.CardCode || '',
        CardName: row.CardName || '',
        Country: row.Country || '',
        CardTypeLabel: row.CardType === 'cSupplier'
          ? 'Vendor'
          : row.CardType === 'cCustomer'
            ? 'Customer'
            : row.CardType === 'cLead'
              ? 'Lead'
              : row.CardType || '',
        Balance: Number(row.Balance || 0).toFixed(2),
        Active: row.Active || '',
        VendorTypeId: row.VendorTypeId || '',
        VendorOccupation: row.VendorOccupation || '',
      }));
    },
  },
  OACT: {
    columns: [
      { key: 'AcctCode', label: 'Acct Code' },
      { key: 'AcctName', label: 'Acct Name' },
    ],
    fetch: async (query) => {
      const rows = await masterDataDbService.lookupGLAccounts(query, 200);
      return rows.map((row) => ({
        AcctCode: row.code || '',
        AcctName: row.name || '',
      }));
    },
  },
};

const createLookupError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const searchLookupOptions = async ({ table, query = '' } = {}) => {
  const normalizedTable = String(table || '').trim().toUpperCase();
  const source = LOOKUP_SOURCES[normalizedTable];

  if (!source) {
    throw createLookupError(`Unsupported report lookup source: ${normalizedTable || 'unknown'}`, 400);
  }

  return {
    table: normalizedTable,
    columns: source.columns,
    items: await source.fetch(String(query || '').trim()),
  };
};

module.exports = {
  searchLookupOptions,
};
