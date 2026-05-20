/**
 * HSN Code DB Service - ODBC/Direct SQL for GET operations
 * Reads HSN codes directly from SAP B1 SQL Server database (OCHP table)
 */
const db = require('./dbService');

const safe = async (promise) => {
  try {
    const r = await promise;
    return r.recordset || [];
  } catch (e) {
    console.error('[HSN Code DB Service] Query error:', e);
    return [];
  }
};

/**
 * Get all HSN Codes from OCHP table
 * @param {string} query - Optional search query
 * @param {number} top - Limit results
 * @param {number} skip - Skip results
 * @returns {Promise<Array>} Array of HSN codes
 */
const getHSNCodes = async (query = '', top = 100, skip = 0) => {
  let sql = `
    SELECT 
      AbsEntry,
      ChapterID,
      Heading,
      SubHeading,
      Dscription AS Description
    FROM OCHP
  `;

  const params = {};

  // Add search filter if query provided
  if (query && query.trim()) {
    sql += `
      WHERE ChapterID LIKE @query 
         OR Dscription LIKE @query
         OR Heading LIKE @query
         OR SubHeading LIKE @query
    `;
    params.query = `%${query.trim()}%`;
  }

  sql += `
    ORDER BY ChapterID
    OFFSET @skip ROWS
    FETCH NEXT @top ROWS ONLY
  `;

  params.top = top;
  params.skip = skip;

  const result = await safe(db.query(sql, params));

  return result.map(item => ({
    absEntry: item.AbsEntry || null,
    code: item.ChapterID || '',
    heading: item.Heading || '',
    subHeading: item.SubHeading || '',
    description: item.Description || '',
  }));
};

/**
 * Get single HSN Code by ChapterID
 * @param {string} code - HSN Code (ChapterID)
 * @returns {Promise<Object|null>} HSN code details or null
 */
const getHSNCode = async (code) => {
  const result = await safe(db.query(`
    SELECT 
      ChapterID,
      Dscription AS ChapterName
    FROM OCHP
    WHERE ChapterID = @code
  `, { code }));

  if (result.length === 0) {
    return null;
  }

  return {
    code: result[0].ChapterID || '',
    name: result[0].ChapterName || '',
  };
};

const resolveHSNCodeToAbsEntry = async (value) => {
  if (value == null) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw || raw === '-1') {
    return null;
  }

  let result = await safe(db.query(`
    SELECT TOP 1 AbsEntry
    FROM OCHP
    WHERE ChapterID = @code
  `, { code: raw }));

  if (result.length > 0 && result[0].AbsEntry != null) {
    return Number(result[0].AbsEntry);
  }

  if (/^\d+$/.test(raw)) {
    result = await safe(db.query(`
      SELECT TOP 1 AbsEntry
      FROM OCHP
      WHERE AbsEntry = @absEntry
    `, { absEntry: Number(raw) }));

    if (result.length > 0 && result[0].AbsEntry != null) {
      return Number(result[0].AbsEntry);
    }
  }

  return null;
};

/**
 * Get HSN Code from Item Master (OITM table) with OCHP join
 * Returns ChapterID from OCHP table based on Item's ChapterID reference
 * @param {string} itemCode - Item Code
 * @returns {Promise<Object>} HSN details or empty object
 */
const getHSNCodeFromItem = async (itemCode) => {
  const result = await safe(db.query(`
    SELECT 
      T0.ItemCode,
      T0.ItemName,
      T0.SWW AS HSN_SWW,
      T0.ChapterID AS ItemChapterID,
      T1.ChapterID AS HSNCode,
      T1.Dscription AS HSNDescription
    FROM OITM T0
    LEFT JOIN OCHP T1 ON T0.ChapterID = T1.AbsEntry
    WHERE T0.ItemCode = @itemCode
  `, { itemCode }));

  if (result.length === 0) {
    return {
      itemCode,
      hsnCode: '',
      hsnDescription: '',
      hsn_sww: '',
    };
  }

  const row = result[0];
  return {
    itemCode: row.ItemCode || '',
    hsnCode: row.HSNCode || row.HSN_SWW || '',
    hsnDescription: row.HSNDescription || '',
    hsn_sww: row.HSN_SWW || '',
    itemChapterID: row.ItemChapterID || null,
  };
};

module.exports = {
  getHSNCodes,
  getHSNCode,
  getHSNCodeFromItem,
  resolveHSNCodeToAbsEntry,
};
