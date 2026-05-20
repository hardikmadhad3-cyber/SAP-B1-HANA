const masterDataDbService = require('./masterDataDbService');

const LOOKUP_SOURCES = {
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
