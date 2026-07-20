const db = require('./dbService');

const getBusinessPartnerGroups = async (query = '', options = {}) => {
  const trimmed = String(query || '').trim();
  const groupType = String(options.bpType || '').trim() === 'cSupplier' ? 'S' : 'C';
  const result = await db.query(
    `
      SELECT TOP 200
        GroupCode,
        GroupName
      FROM OCRG
      WHERE GroupType = @groupType
        AND (
          @query = ''
          OR CAST(GroupCode AS NVARCHAR(50)) LIKE @like
          OR GroupName LIKE @like
        )
      ORDER BY GroupName, GroupCode
    `,
    {
      query: trimmed,
      like: `%${trimmed}%`,
      groupType,
    },
    options,
  );

  const rows = (result.recordset || []).map((row) => ({
    code: String(row.GroupCode ?? ''),
    name: String(row.GroupName || '').trim(),
  }));

  if (!trimmed) {
    rows.push({
      code: '',
      name: 'All',
    });
  }

  return rows;
};

const getBusinessPartnerProperties = async (options = {}) => {
  const result = await db.query(
    `
      SELECT GroupCode AS number, ISNULL(GroupName, '') AS name
      FROM OCQG
      ORDER BY GroupCode
    `,
    {},
    options,
  );

  return (result.recordset || []).map((row, index) => ({
    number: Number(row.number || index + 1),
    name: String(row.name || `Business Partners Property ${index + 1}`).trim(),
  }));
};

module.exports = {
  getBusinessPartnerGroups,
  getBusinessPartnerProperties,
};
