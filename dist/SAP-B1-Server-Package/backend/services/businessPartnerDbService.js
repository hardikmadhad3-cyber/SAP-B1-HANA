const db = require('../db/odbc');

const getBusinessPartnerGroups = async (query = '', options = {}) => {
  const trimmed = String(query || '').trim();
  const result = await db.query(
    `
      SELECT TOP 200
        GroupCode,
        GroupName
      FROM OCRG
      WHERE GroupType = 'C'
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

module.exports = {
  getBusinessPartnerGroups,
};
