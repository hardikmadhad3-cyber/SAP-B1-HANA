const escapeLike = (value) => String(value || '').replace(/[%_[\]]/g, (match) => `[${match}]`);

const normalizeTopLimit = (value) => {
  if (value == null || value === '') return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.floor(parsed);
};

const normalizeDocumentStatusCode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'o' || normalized === 'open') return 'O';
  if (normalized === 'c' || normalized === 'close' || normalized === 'closed') return 'C';
  return '';
};

const buildMarketingDocumentListFilterQuery = ({
  query = '',
  openOnly = false,
  docNum = '',
  partnerCode = '',
  partnerName = '',
  sellerCode = '',
  sellerName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
} = {}, options = {}) => {
  const tableAlias = String(options.tableAlias || 'T0').trim();
  const docNumExpression = String(options.docNumExpression || `CAST(${tableAlias}.DocNum AS NVARCHAR(50))`).trim();
  const partnerCodeField = String(options.partnerCodeField || `${tableAlias}.CardCode`).trim();
  const partnerNameField = String(options.partnerNameField || `${tableAlias}.CardName`).trim();
  const sellerCodeField = String(options.sellerCodeField || `${tableAlias}.U_Seller_Code`).trim();
  const sellerNameField = String(options.sellerNameField || `${tableAlias}.U_Seller_Name`).trim();
  const includeSellerFields = options.includeSellerFields === true;
  const additionalQueryClauses = Array.isArray(options.additionalQueryClauses)
    ? options.additionalQueryClauses.filter(Boolean)
    : [];
  const postingDateField = String(options.postingDateField || `${tableAlias}.DocDate`).trim();
  const statusField = String(options.statusField || `${tableAlias}.DocStatus`).trim();
  const canceledField = String(options.canceledField || `${tableAlias}.CANCELED`).trim();

  const normalizedQuery = String(query || '').trim();
  const normalizedDocNum = String(docNum || '').trim();
  const normalizedPartnerCode = String(partnerCode || '').trim();
  const normalizedPartnerName = String(partnerName || '').trim();
  const normalizedSellerCode = String(sellerCode || '').trim();
  const normalizedSellerName = String(sellerName || '').trim();
  const normalizedDateFrom = String(postingDateFrom || '').trim();
  const normalizedDateTo = String(postingDateTo || '').trim();
  const normalizedStatus = normalizeDocumentStatusCode(status);
  const openOnlyFilter = openOnly === true;

  const whereClauses = [`${canceledField} <> 'Y'`];
  const params = {};

  if (normalizedStatus) {
    whereClauses.push(`${statusField} = @status`);
    params.status = normalizedStatus;
  } else if (openOnlyFilter) {
    whereClauses.push(`${statusField} = 'O'`);
  }

  if (normalizedQuery) {
    whereClauses.push(`(
      ${docNumExpression} LIKE @query
      OR ${partnerCodeField} LIKE @query
      OR ${partnerNameField} LIKE @query
      ${includeSellerFields ? `OR ${sellerCodeField} LIKE @query
      OR ${sellerNameField} LIKE @query` : ''}
      ${additionalQueryClauses.length ? `OR ${additionalQueryClauses.join('\n      OR ')}` : ''}
    )`);
    params.query = `%${escapeLike(normalizedQuery)}%`;
  }

  if (normalizedDocNum) {
    whereClauses.push(`${docNumExpression} = @docNum`);
    params.docNum = normalizedDocNum;
  }

  if (normalizedPartnerCode) {
    whereClauses.push(`${partnerCodeField} LIKE @partnerCode`);
    params.partnerCode = `%${escapeLike(normalizedPartnerCode)}%`;
  }

  if (normalizedPartnerName) {
    whereClauses.push(`${partnerNameField} LIKE @partnerName`);
    params.partnerName = `%${escapeLike(normalizedPartnerName)}%`;
  }

  if (includeSellerFields && normalizedSellerCode) {
    whereClauses.push(`${sellerCodeField} LIKE @sellerCode`);
    params.sellerCode = `%${escapeLike(normalizedSellerCode)}%`;
  }

  if (includeSellerFields && normalizedSellerName) {
    whereClauses.push(`${sellerNameField} LIKE @sellerName`);
    params.sellerName = `%${escapeLike(normalizedSellerName)}%`;
  }

  if (normalizedDateFrom) {
    whereClauses.push(`CAST(${postingDateField} AS date) >= CAST(@postingDateFrom AS date)`);
    params.postingDateFrom = normalizedDateFrom;
  }

  if (normalizedDateTo) {
    whereClauses.push(`CAST(${postingDateField} AS date) <= CAST(@postingDateTo AS date)`);
    params.postingDateTo = normalizedDateTo;
  }

  return { whereClauses, params };
};

module.exports = {
  escapeLike,
  normalizeTopLimit,
  buildMarketingDocumentListFilterQuery,
};
