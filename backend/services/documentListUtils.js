const escapeLike = (value) => String(value || '').replace(/[%_[\]]/g, (match) => `[${match}]`);

const normalizeSearchValue = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase();

const compactSearchValue = (value) => normalizeSearchValue(value).replace(/\s+/g, '');

const getSearchTokens = (value, maxTokens = 8) =>
  normalizeSearchValue(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxTokens);

const buildConcatExpression = (expressions = []) => {
  const parts = expressions.filter(Boolean).map((expression) => `ISNULL(${expression}, '')`);
  if (parts.length === 0) return "''";
  if (parts.length === 1) return parts[0];
  return `CONCAT(${parts.join(", ' ', ")})`;
};

const compactSqlExpression = (expression) => `
  UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    ${expression},
    '"', ''),
    '''', ''),
    '.', ''),
    ',', ''),
    '-', ''),
    ' ', ''))
`;

const appendSapSearchCondition = (whereClauses, params, expressions, rawValue, paramPrefix, additionalClauses = []) => {
  const normalizedValue = String(rawValue || '').trim();
  if (!normalizedValue) return;

  const normalized = normalizeSearchValue(normalizedValue);
  const compact = compactSearchValue(normalizedValue);
  const tokens = getSearchTokens(normalizedValue);
  const searchableSql = buildConcatExpression(expressions);
  const compactSearchableSql = compactSqlExpression(searchableSql);
  const tokenConditions = tokens
    .map((_, index) => `${compactSearchableSql} LIKE @${paramPrefix}Token${index}`)
    .join(' AND ');

  whereClauses.push(`(
    UPPER(${searchableSql}) LIKE @${paramPrefix}Like
    OR ${compactSearchableSql} LIKE @${paramPrefix}CompactLike
    ${tokenConditions ? `OR (${tokenConditions})` : ''}
    ${additionalClauses.length ? `OR ${additionalClauses.join('\n    OR ')}` : ''}
  )`);

  params[`${paramPrefix}Like`] = `%${escapeLike(normalized)}%`;
  params[`${paramPrefix}CompactLike`] = `%${escapeLike(compact)}%`;
  tokens.forEach((token, index) => {
    params[`${paramPrefix}Token${index}`] = `%${escapeLike(token)}%`;
  });
};

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
    appendSapSearchCondition(
      whereClauses,
      params,
      [
        docNumExpression,
        partnerCodeField,
        partnerNameField,
        ...(includeSellerFields ? [sellerCodeField, sellerNameField] : []),
      ],
      normalizedQuery,
      'query',
      additionalQueryClauses,
    );
    params.query = `%${escapeLike(normalizedQuery)}%`;
  }

  if (normalizedDocNum) {
    whereClauses.push(`${docNumExpression} = @docNum`);
    params.docNum = normalizedDocNum;
  }

  if (normalizedPartnerCode) {
    appendSapSearchCondition(whereClauses, params, [partnerCodeField], normalizedPartnerCode, 'partnerCode');
  }

  if (normalizedPartnerName) {
    appendSapSearchCondition(whereClauses, params, [partnerNameField], normalizedPartnerName, 'partnerName');
  }

  if (includeSellerFields && normalizedSellerCode) {
    appendSapSearchCondition(whereClauses, params, [sellerCodeField], normalizedSellerCode, 'sellerCode');
  }

  if (includeSellerFields && normalizedSellerName) {
    appendSapSearchCondition(whereClauses, params, [sellerNameField], normalizedSellerName, 'sellerName');
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
  normalizeSearchValue,
  compactSearchValue,
  getSearchTokens,
  appendSapSearchCondition,
  normalizeTopLimit,
  buildMarketingDocumentListFilterQuery,
};
