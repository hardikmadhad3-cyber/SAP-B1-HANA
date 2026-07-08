const db = require('./dbService');

const text = (value) => String(value || '').trim();
const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const tableColumnsCache = new Map();
const tableExistsCache = new Map();

const queryRows = async (sql, params = {}, options = {}) => {
  const result = await db.query(sql, params, options);
  return result.recordset || result || [];
};

const normalizeDateInput = (value) => {
  const raw = text(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return '';

  const [, dayText, monthText, yearText] = match;
  const year = yearText.length === 2 ? `20${yearText}` : yearText;
  return `${year.padStart(4, '0')}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
};

const cacheKey = (name, options = {}) => `${text(options.databaseName)}:${text(name).toUpperCase()}`;

const tableExists = async (tableName, options = {}) => {
  const table = text(tableName).toUpperCase();
  const key = cacheKey(table, options);
  if (tableExistsCache.has(key)) return tableExistsCache.get(key);

  const rows = await queryRows(
    `
      SELECT TOP 1 TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: table },
    options,
  );
  const exists = rows.length > 0;
  tableExistsCache.set(key, exists);
  return exists;
};

const getColumns = async (tableName, options = {}) => {
  const table = text(tableName).toUpperCase();
  const key = cacheKey(table, options);
  if (tableColumnsCache.has(key)) return tableColumnsCache.get(key);

  const rows = await queryRows(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: table },
    options,
  );
  const columns = new Set(rows.map((row) => text(row.COLUMN_NAME).toUpperCase()));
  tableColumnsCache.set(key, columns);
  return columns;
};

const firstColumn = async (tableName, candidates, options = {}) => {
  const columns = await getColumns(tableName, options);
  return candidates.find((column) => columns.has(text(column).toUpperCase())) || '';
};

const quoted = (columnName) => `[${text(columnName).replace(/]/g, ']]')}]`;
const columnExpr = (alias, columnName) => `${alias}.${quoted(columnName)}`;
const selectText = (alias, columnName, outputName) =>
  columnName ? `ISNULL(CONVERT(NVARCHAR(255), ${columnExpr(alias, columnName)}), '') AS ${outputName}` : `'' AS ${outputName}`;
const selectNumber = (alias, columnName, outputName) =>
  columnName ? `CAST(ISNULL(${columnExpr(alias, columnName)}, 0) AS DECIMAL(19, 2)) AS ${outputName}` : `CAST(0 AS DECIMAL(19, 2)) AS ${outputName}`;

const addTextFilter = (clauses, params, expression, paramName, value) => {
  const normalized = text(value);
  if (!expression || !normalized || normalized === '*' || normalized.toLowerCase() === 'all') return;
  clauses.push(`${expression} = @${paramName}`);
  params[paramName] = normalized;
};

const addNumberRangeFilter = (clauses, params, expression, range = {}, prefix) => {
  if (!expression || !range?.enabled) return;
  const from = numberOrNull(range.from);
  const to = numberOrNull(range.to);
  if (from !== null) {
    clauses.push(`${expression} >= @${prefix}From`);
    params[`${prefix}From`] = from;
  }
  if (to !== null) {
    clauses.push(`${expression} <= @${prefix}To`);
    params[`${prefix}To`] = to;
  }
};

const buildSimpleLookup = async ({ tableName, codeCandidates, nameCandidates, where = '', options = {} }) => {
  if (!(await tableExists(tableName, options))) return [];
  const codeColumn = await firstColumn(tableName, codeCandidates, options);
  const nameColumn = await firstColumn(tableName, nameCandidates, options);
  if (!codeColumn && !nameColumn) return [];

  const codeExpression = codeColumn ? `CONVERT(NVARCHAR(100), ${quoted(codeColumn)})` : `CONVERT(NVARCHAR(100), ${quoted(nameColumn)})`;
  const nameExpression = nameColumn ? `CONVERT(NVARCHAR(255), ${quoted(nameColumn)})` : codeExpression;

  return queryRows(
    `
      SELECT DISTINCT
        ${codeExpression} AS value,
        ${nameExpression} AS label,
        ${codeExpression} AS code,
        ${nameExpression} AS name
      FROM ${quoted(tableName)}
      ${where}
      ORDER BY label
    `,
    {},
    options,
  );
};

const buildDistinctOpportunityLookup = async (columnName, options = {}) => {
  if (!columnName || !(await tableExists('OOPR', options))) return [];
  return queryRows(
    `
      SELECT DISTINCT
        CONVERT(NVARCHAR(100), ${quoted(columnName)}) AS value,
        CONVERT(NVARCHAR(255), ${quoted(columnName)}) AS label,
        CONVERT(NVARCHAR(100), ${quoted(columnName)}) AS code,
        CONVERT(NVARCHAR(255), ${quoted(columnName)}) AS name
      FROM OOPR
      WHERE ${quoted(columnName)} IS NOT NULL
        AND CONVERT(NVARCHAR(255), ${quoted(columnName)}) <> ''
      ORDER BY label
    `,
    {},
    options,
  );
};

const buildDistinctTableLookup = async (tableName, columnName, options = {}) => {
  if (!columnName || !(await tableExists(tableName, options))) return [];
  return queryRows(
    `
      SELECT DISTINCT
        CONVERT(NVARCHAR(100), ${quoted(columnName)}) AS value,
        CONVERT(NVARCHAR(255), ${quoted(columnName)}) AS label,
        CONVERT(NVARCHAR(100), ${quoted(columnName)}) AS code,
        CONVERT(NVARCHAR(255), ${quoted(columnName)}) AS name
      FROM ${quoted(tableName)}
      WHERE ${quoted(columnName)} IS NOT NULL
        AND CONVERT(NVARCHAR(255), ${quoted(columnName)}) <> ''
      ORDER BY label
    `,
    {},
    options,
  );
};

const normalizeInterestLevelRows = (rows = []) => {
  const labels = new Map([
    ['1', 'High'],
    ['2', 'Low'],
    ['3', 'Med'],
  ]);

  const normalized = rows.map((row) => {
    const value = text(row.value ?? row.code ?? row.label ?? row.name);
    const label = labels.get(value) || text(row.label ?? row.name) || value;
    return {
      ...row,
      value,
      code: value,
      label,
      name: label,
    };
  });

  return normalized.length
    ? normalized
    : [
        { value: '1', code: '1', label: 'High', name: 'High' },
        { value: '2', code: '2', label: 'Low', name: 'Low' },
        { value: '3', code: '3', label: 'Med', name: 'Med' },
      ];
};

const normalizeOpportunityStatusRows = (rows = []) => {
  const labels = new Map([
    ['O', 'Open'],
    ['W', 'Won'],
    ['L', 'Lost'],
  ]);

  const normalized = rows.map((row) => {
    const value = text(row.value ?? row.code ?? row.label ?? row.name).toUpperCase();
    const label = labels.get(value) || text(row.label ?? row.name) || value;
    return {
      ...row,
      value,
      code: value,
      label,
      name: label,
    };
  });

  return normalized.length
    ? normalized
    : [
        { value: 'O', code: 'O', label: 'Open', name: 'Open' },
        { value: 'W', code: 'W', label: 'Won', name: 'Won' },
        { value: 'L', code: 'L', label: 'Lost', name: 'Lost' },
      ];
};

const getBpChannelCodeLookups = async (options = {}) => {
  const channelColumn = await firstColumn('OCRD', ['Channel', 'ChanCode'], options);
  if (!channelColumn || !(await tableExists('OCRD', options))) return [];

  return queryRows(
    `
      SELECT DISTINCT
        CONVERT(NVARCHAR(100), bp.${quoted(channelColumn)}) AS value,
        ISNULL(channelBp.CardName, CONVERT(NVARCHAR(255), bp.${quoted(channelColumn)})) AS label,
        CONVERT(NVARCHAR(100), bp.${quoted(channelColumn)}) AS code,
        ISNULL(channelBp.CardName, CONVERT(NVARCHAR(255), bp.${quoted(channelColumn)})) AS name
      FROM OCRD bp
      LEFT JOIN OCRD channelBp
        ON channelBp.CardCode = CONVERT(NVARCHAR(100), bp.${quoted(channelColumn)})
      WHERE bp.${quoted(channelColumn)} IS NOT NULL
        AND CONVERT(NVARCHAR(255), bp.${quoted(channelColumn)}) <> ''
      ORDER BY label
    `,
    {},
    options,
  );
};

const getOpportunityMetadata = async (options = {}) => {
  const hasOOPR = await tableExists('OOPR', options);
  if (!hasOOPR) {
    return { hasOOPR: false };
  }

  const hasOPR1 = await tableExists('OPR1', options);
  const hasOOST = await tableExists('OOST', options);
  const hasOOSR = await tableExists('OOSR', options);
  const hasOSLP = await tableExists('OSLP', options);
  const hasOCRD = await tableExists('OCRD', options);
  const hasOCRG = await tableExists('OCRG', options);

  return {
    hasOOPR,
    hasOPR1,
    hasOOST,
    hasOOSR,
    hasOSLP,
    hasOCRD,
    hasOCRG,
    oppId: await firstColumn('OOPR', ['OpprId', 'OpprID', 'OpportunityID'], options),
    oppName: await firstColumn('OOPR', ['OpprName', 'Name'], options),
    cardCode: await firstColumn('OOPR', ['CardCode'], options),
    slpCode: await firstColumn('OOPR', ['SlpCode', 'MaxSalesEmp', 'SalesPrson'], options),
    lastSlpCode: await firstColumn('OOPR', ['LastSlp', 'FollowUp', 'LastSlpCode', 'LastSalesEmp', 'SlpCode'], options),
    territory: await firstColumn('OOPR', ['Territory', 'TerritryID', 'TerritoryID'], options),
    industry: await firstColumn('OOPR', ['Industry', 'IndustryC', 'Industries'], options),
    interestLevel: await firstColumn('OOPR', ['IntrLevel', 'IntrstLvl', 'Interest', 'IntRate'], options),
    source: await firstColumn('OOPR', ['Source', 'SrcCode', 'SourceID'], options),
    project: await firstColumn('OOPR', ['PrjCode', 'Project', 'ProjectCode'], options),
    channel: await firstColumn('OCRD', ['Channel', 'ChanCode'], options),
    status: await firstColumn('OOPR', ['Status'], options),
    openDate: await firstColumn('OOPR', ['OpenDate', 'CreateDate'], options),
    closingDate: await firstColumn('OOPR', ['PredDate', 'CloseDate', 'ClsngDate'], options),
    wonClosingDate: await firstColumn('OOPR', ['CloseDate', 'ClsngDate', 'PredDate'], options),
    amount: await firstColumn('OOPR', ['MaxSumLoc', 'CurValue', 'MaxAmnt', 'PotentialAmount', 'MaxSum'], options),
    amountSys: await firstColumn('OOPR', ['MaxSumSys', 'MaxAmntSys', 'PotentialAmountSys'], options),
    realAmount: await firstColumn('OOPR', ['RealSumLoc', 'RealAmount', 'ActualAmount'], options),
    realAmountSys: await firstColumn('OOPR', ['RealSumSys', 'RealAmountSys', 'ActualAmountSys'], options),
    weighted: await firstColumn('OOPR', ['WtSumLoc', 'WeightedAmount', 'WtSum', 'MaxSumSys'], options),
    percent: await firstColumn('OOPR', ['CloPrcnt', 'ClsngPrcnt', 'ClosePrcnt', 'ClosingPercent', 'IntRate'], options),
    stage: await firstColumn('OOPR', ['ClsngStage', 'StepLast', 'Stage', 'StageKey'], options),
    opr1OppId: hasOPR1 ? await firstColumn('OPR1', ['OpprId', 'OpprID'], options) : '',
    opr1Line: hasOPR1 ? await firstColumn('OPR1', ['Line', 'LineNum', 'Step_Id'], options) : '',
    opr1Stage: hasOPR1 ? await firstColumn('OPR1', ['StageKey', 'Step_Id', 'Stage'], options) : '',
    opr1SalesEmp: hasOPR1 ? await firstColumn('OPR1', ['SalesPrson', 'SlpCode'], options) : '',
    oostCode: hasOOST ? await firstColumn('OOST', ['Num', 'StageKey', 'StepId', 'StageID'], options) : '',
    oostName: hasOOST ? await firstColumn('OOST', ['Name', 'StageName', 'Descript'], options) : '',
    oostPercent: hasOOST ? await firstColumn('OOST', ['CloPrcnt', 'ClsngPrcnt', 'ClosePrcnt', 'PrcntRate', 'Percent'], options) : '',
    oosrCode: hasOOSR ? await firstColumn('OOSR', ['Num', 'SourceID', 'Code'], options) : '',
    oosrName: hasOOSR ? await firstColumn('OOSR', ['Descript', 'Name', 'SourceName'], options) : '',
  };
};

const addDynamicInFilter = (clauses, params, expression, values = [], prefix, parseValue = (value) => value) => {
  const normalizedValues = [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => text(value))
      .filter(Boolean),
  )];

  if (!expression || !normalizedValues.length) return;

  const parameterNames = [];
  normalizedValues.forEach((value, index) => {
    const parameterName = `${prefix}${index}`;
    parameterNames.push(`@${parameterName}`);
    params[parameterName] = parseValue(value);
  });

  clauses.push(`${expression} IN (${parameterNames.join(', ')})`);
};

const addBpPropertyFilter = (clauses, propertyFilter = {}, alias = 'bp') => {
  const selectedNumbers = Array.isArray(propertyFilter?.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64)
    : [];

  if (propertyFilter?.ignoreProperties !== false || !selectedNumbers.length) return;

  const selectedSet = new Set(selectedNumbers);
  const selectedClauses = selectedNumbers.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`);
  const linkOperator = propertyFilter?.linkMode === 'or' ? ' OR ' : ' AND ';
  clauses.push(`(${selectedClauses.join(linkOperator)})`);

  if (propertyFilter?.exactlyMatch) {
    const unselectedClauses = [];
    for (let index = 1; index <= 64; index += 1) {
      if (!selectedSet.has(index)) {
        unselectedClauses.push(`ISNULL(${alias}.QryGroup${index}, 'N') <> 'Y'`);
      }
    }
    if (unselectedClauses.length) clauses.push(`(${unselectedClauses.join(' AND ')})`);
  }
};

const getOpportunitiesStageAnalysisReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    const canUseStageLine = Boolean(meta.hasOPR1 && meta.oppId && meta.opr1OppId);
    if (canUseStageLine) {
      joins.push(`INNER JOIN OPR1 stageLine ON stageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}`);
    }

    const stageCodeExpression = canUseStageLine && meta.opr1Stage
      ? `stageLine.${quoted(meta.opr1Stage)}`
      : stageSourceExpression;
    const salesEmployeeExpression = canUseStageLine && meta.opr1SalesEmp
      ? `ISNULL(stageLine.${quoted(meta.opr1SalesEmp)}, ${meta.slpCode ? columnExpr('opp', meta.slpCode) : '-1'})`
      : (meta.slpCode ? columnExpr('opp', meta.slpCode) : '-1');

    if (meta.hasOOST && meta.oostCode && stageCodeExpression) {
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${stageCodeExpression}`);
    }
    if (meta.hasOSLP) {
      joins.push(`LEFT JOIN OSLP salesEmp ON salesEmp.SlpCode = ${salesEmployeeExpression}`);
    }

    const startDate = criteria?.startDate || {};
    const closingDate = criteria?.closingDate || {};
    const fromStartDate = normalizeDateInput(startDate.from);
    const toStartDate = normalizeDateInput(startDate.to);
    const fromClosingDate = normalizeDateInput(closingDate.from);
    const toClosingDate = normalizeDateInput(closingDate.to);

    if (meta.openDate && fromStartDate) {
      whereClauses.push(`${columnExpr('opp', meta.openDate)} >= @startDateFrom`);
      params.startDateFrom = fromStartDate;
    }
    if (meta.openDate && toStartDate) {
      whereClauses.push(`${columnExpr('opp', meta.openDate)} <= @startDateTo`);
      params.startDateTo = toStartDate;
    }
    if (meta.closingDate && fromClosingDate) {
      whereClauses.push(`${columnExpr('opp', meta.closingDate)} >= @closingDateFrom`);
      params.closingDateFrom = fromClosingDate;
    }
    if (meta.closingDate && toClosingDate) {
      whereClauses.push(`${columnExpr('opp', meta.closingDate)} <= @closingDateTo`);
      params.closingDateTo = toClosingDate;
    }
    const stageSelection = criteria?.stageSelection || {};
    if (stageSelection.enabled) {
      addDynamicInFilter(
        whereClauses,
        params,
        stageCodeExpression,
        stageSelection.selectedCodes,
        'stageCode',
        (value) => (/^-?\d+$/.test(value) ? Number(value) : value),
      );
    }

    const salesEmployeeSelection = criteria?.salesEmployeeSelection || {};
    if (salesEmployeeSelection.enabled) {
      addDynamicInFilter(
        whereClauses,
        params,
        salesEmployeeExpression,
        salesEmployeeSelection.selectedCodes,
        'salesEmployeeCode',
        (value) => (/^-?\d+$/.test(value) ? Number(value) : value),
      );
    }

    const bpSelection = criteria?.bpSelection || {};
    if (bpSelection.enabled && meta.cardCode) {
      const bpCodeFrom = text(bpSelection.codeFrom);
      const bpCodeTo = text(bpSelection.codeTo);
      if (bpCodeFrom) {
        whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
        params.bpCodeFrom = bpCodeFrom;
      }
      if (bpCodeTo) {
        whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
        params.bpCodeTo = bpCodeTo;
      }
    }
    if (bpSelection.enabled && meta.hasOCRD) {
      const bpType = text(bpSelection.bpType).toUpperCase();
      const bpTypeMap = { CUSTOMER: 'C', SUPPLIER: 'S', VENDOR: 'S', LEAD: 'L' };
      if (bpType === 'CUSTOMERANDLEAD' || bpType === 'CUSTOMER AND LEAD') {
        whereClauses.push("bp.CardType IN ('C', 'L')");
      } else if (bpType && bpType !== 'ALL' && bpTypeMap[bpType]) {
        whereClauses.push('bp.CardType = @bpType');
        params.bpType = bpTypeMap[bpType];
      }
    }
    if (bpSelection.enabled && meta.hasOCRG) {
      const groupValue = text(bpSelection.customerGroup) || text(bpSelection.vendorGroup);
      if (groupValue === '__NONE__') {
        whereClauses.push('(bp.GroupCode IS NULL OR ISNULL(bp.GroupCode, 0) = 0)');
      } else if (groupValue && groupValue.toLowerCase() !== 'all') {
        if (/^-?\d+$/.test(groupValue)) {
          whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
          params.bpGroupCode = Number(groupValue);
        } else {
          whereClauses.push('grp.GroupName = @bpGroupName');
          params.bpGroupName = groupValue;
        }
      }
    }
    if (bpSelection.enabled && meta.hasOCRD) {
      addBpPropertyFilter(whereClauses, bpSelection.propertyFilter, 'bp');
    }

    const stageType = text(stageSelection.stageType).toLowerCase();
    if (meta.status) {
      const statusMap = { open: 'O', won: 'W', lost: 'L' };
      const statusValue = statusMap[stageType] || 'W';
      whereClauses.push(`${columnExpr('opp', meta.status)} = @stageStatus`);
      params.stageStatus = statusValue;
    }

    const stageNameExpression = meta.oostName && stageCodeExpression
      ? `ISNULL(stg.${quoted(meta.oostName)}, CONVERT(NVARCHAR(255), ${stageCodeExpression}))`
      : (stageCodeExpression ? `CONVERT(NVARCHAR(255), ${stageCodeExpression})` : `''`);
    const stageOrderTextExpression = stageCodeExpression
      ? `LTRIM(RTRIM(CONVERT(NVARCHAR(50), ${stageCodeExpression})))`
      : "''";
    const stageOrderExpression = stageCodeExpression
      ? `CASE WHEN ${stageOrderTextExpression} <> '' AND ${stageOrderTextExpression} NOT LIKE '%[^0-9]%' THEN CAST(${stageOrderTextExpression} AS INT) ELSE 999999 END`
      : '0';
    const definedPercentExpression = meta.oostPercent
      ? `ISNULL(stg.${quoted(meta.oostPercent)}, ${meta.percent ? `ISNULL(${columnExpr('opp', meta.percent)}, 0)` : '0'})`
      : (meta.percent ? `ISNULL(${columnExpr('opp', meta.percent)}, 0)` : '0');
    const actualPercentExpression = meta.percent ? `ISNULL(${columnExpr('opp', meta.percent)}, 0)` : '0';
    const salesEmployeeNameExpression = meta.hasOSLP
      ? "CASE WHEN ISNULL(salesEmp.SlpCode, -1) < 0 THEN '-No Sales Employee / Buyer-' ELSE ISNULL(NULLIF(salesEmp.SlpName, ''), '-No Sales Employee / Buyer-') END"
      : `CONVERT(NVARCHAR(255), ISNULL(${salesEmployeeExpression}, -1))`;

    const baseSql = `
      FROM OOPR opp
      ${joins.join('\n      ')}
      ${whereClauses.length ? `WHERE ${whereClauses.join('\n        AND ')}` : ''}
    `;

    const generalRows = await queryRows(
      `
        SELECT
          ${stageCodeExpression ? `CONVERT(NVARCHAR(100), ${stageCodeExpression})` : "''"} AS StageCode,
          ${stageNameExpression} AS StageName,
          CAST(MAX(${definedPercentExpression}) AS DECIMAL(9, 2)) AS DefinedPercent,
          CAST(AVG(CAST(${actualPercentExpression} AS DECIMAL(19, 4))) AS DECIMAL(9, 2)) AS ActualPercent,
          ${meta.oppId ? `COUNT(DISTINCT ${columnExpr('opp', meta.oppId)})` : 'COUNT(1)'} AS LeadsInStage
        ${baseSql}
        GROUP BY ${stageCodeExpression ? `CONVERT(NVARCHAR(100), ${stageCodeExpression}),` : ''} ${stageNameExpression}
        ORDER BY MIN(${stageOrderExpression}), StageName
      `,
      params,
      options,
    );

    const employeeRows = await queryRows(
      `
        SELECT
          ${stageCodeExpression ? `CONVERT(NVARCHAR(100), ${stageCodeExpression})` : "''"} AS StageCode,
          ${stageNameExpression} AS StageName,
          CAST(${salesEmployeeExpression} AS INT) AS SalesEmployeeCode,
          ${salesEmployeeNameExpression} AS SalesEmployeeName,
          CAST(AVG(CAST(${actualPercentExpression} AS DECIMAL(19, 4))) AS DECIMAL(9, 2)) AS ActualPercent,
          ${meta.oppId ? `COUNT(DISTINCT ${columnExpr('opp', meta.oppId)})` : 'COUNT(1)'} AS LeadsInStage
        ${baseSql}
        GROUP BY
          ${stageCodeExpression ? `CONVERT(NVARCHAR(100), ${stageCodeExpression}),` : ''}
          ${stageNameExpression},
          CAST(${salesEmployeeExpression} AS INT),
          ${salesEmployeeNameExpression}
        ORDER BY StageName, SalesEmployeeName
      `,
      params,
      options,
    );

    const selectedEmployeeCodeSet = new Set(
      salesEmployeeSelection.enabled
        ? (salesEmployeeSelection.selectedCodes || []).map((value) => text(value)).filter(Boolean)
        : [],
    );
    const employeeColumns = [];
    const employeeColumnKeys = new Set();
    employeeRows.forEach((row) => {
      const code = text(row.SalesEmployeeCode);
      if (selectedEmployeeCodeSet.size && !selectedEmployeeCodeSet.has(code)) return;
      if (employeeColumnKeys.has(code)) return;
      employeeColumnKeys.add(code);
      employeeColumns.push({
        code,
        name: text(row.SalesEmployeeName) || '-No Sales Employee / Buyer-',
      });
    });

    const rows = generalRows.map((row, index) => {
      const stageCode = text(row.StageCode);
      const employeeBreakdown = {};
      employeeRows
        .filter((employeeRow) => text(employeeRow.StageCode) === stageCode)
        .forEach((employeeRow) => {
          employeeBreakdown[text(employeeRow.SalesEmployeeCode)] = {
            actualPercent: Number(employeeRow.ActualPercent || 0),
            leadsInStage: Number(employeeRow.LeadsInStage || 0),
          };
        });

      return {
        rowNo: index + 1,
        stageCode,
        stageName: text(row.StageName) || stageCode || 'Undefined',
        definedPercent: Number(row.DefinedPercent || 0),
        generalActualPercent: Number(row.ActualPercent || 0),
        generalLeadsInStage: Number(row.LeadsInStage || 0),
        employeeBreakdown,
      };
    });

    return {
      success: true,
      data: rows,
      employeeColumns,
      chart: rows.map((row) => ({
        stageCode: row.stageCode,
        stageName: row.stageName,
        value: row.generalActualPercent,
        leadsInStage: row.generalLeadsInStage,
      })),
      meta: {
        criteria,
        totalRecords: rows.reduce((sum, row) => sum + row.generalLeadsInStage, 0),
      },
      reportTitle: 'Stage Analysis',
    };
  } catch (error) {
    console.error('Error in getOpportunitiesStageAnalysisReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getWonOpportunitiesReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
    }

    if (meta.status) {
      whereClauses.push(`${columnExpr('opp', meta.status)} = @wonStatus`);
      params.wonStatus = 'W';
    }

    const startDate = criteria?.startDate || {};
    const closingDate = criteria?.closingDate || {};
    const fromStartDate = normalizeDateInput(startDate.from);
    const toStartDate = normalizeDateInput(startDate.to);
    const closingDateColumn = meta.wonClosingDate || meta.closingDate;
    const fromClosingDate = normalizeDateInput(closingDate.from);
    const toClosingDate = normalizeDateInput(closingDate.to);

    if (meta.openDate && fromStartDate) {
      whereClauses.push(`${columnExpr('opp', meta.openDate)} >= @startDateFrom`);
      params.startDateFrom = fromStartDate;
    }
    if (meta.openDate && toStartDate) {
      whereClauses.push(`${columnExpr('opp', meta.openDate)} <= @startDateTo`);
      params.startDateTo = toStartDate;
    }
    if (closingDateColumn && fromClosingDate) {
      whereClauses.push(`${columnExpr('opp', closingDateColumn)} >= @closingDateFrom`);
      params.closingDateFrom = fromClosingDate;
    }
    if (closingDateColumn && toClosingDate) {
      whereClauses.push(`${columnExpr('opp', closingDateColumn)} <= @closingDateTo`);
      params.closingDateTo = toClosingDate;
    }

    const salesEmployeeSelection = criteria?.salesEmployeeSelection || {};
    const salesEmployeeExpression = meta.slpCode ? columnExpr('opp', meta.slpCode) : '';
    if (salesEmployeeSelection.enabled && salesEmployeeExpression) {
      addDynamicInFilter(
        whereClauses,
        params,
        salesEmployeeExpression,
        salesEmployeeSelection.selectedCodes,
        'salesEmployeeCode',
        (value) => (/^-?\d+$/.test(value) ? Number(value) : value),
      );
    }

    const bpSelection = criteria?.bpSelection || {};
    if (bpSelection.enabled && meta.cardCode) {
      const selectedCodes = Array.isArray(bpSelection.selectedCodes)
        ? bpSelection.selectedCodes.map((value) => text(value)).filter(Boolean)
        : [];
      if (selectedCodes.length) {
        addDynamicInFilter(whereClauses, params, columnExpr('opp', meta.cardCode), selectedCodes, 'bpCode');
      } else {
        const bpCodeFrom = text(bpSelection.codeFrom);
        const bpCodeTo = text(bpSelection.codeTo);
        if (bpCodeFrom) {
          whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
          params.bpCodeFrom = bpCodeFrom;
        }
        if (bpCodeTo) {
          whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
          params.bpCodeTo = bpCodeTo;
        }
      }
    }

    const parsedRangeDays = Number(criteria?.rangeDays);
    const rangeDays = Number.isFinite(parsedRangeDays) && parsedRangeDays > 0
      ? Math.floor(parsedRangeDays)
      : 10;
    params.rangeDays = rangeDays;

    const openDateExpression = meta.openDate ? columnExpr('opp', meta.openDate) : 'NULL';
    const closeDateExpression = closingDateColumn ? columnExpr('opp', closingDateColumn) : 'NULL';
    const rawDaysExpression = meta.openDate && closingDateColumn
      ? `DATEDIFF(DAY, ${openDateExpression}, ${closeDateExpression})`
      : '0';
    const daysExpression = `CASE WHEN ${rawDaysExpression} < 0 THEN 0 ELSE ISNULL(${rawDaysExpression}, 0) END`;
    const bucketExpression = `
      CASE
        WHEN ${daysExpression} <= @rangeDays THEN 0
        ELSE CEILING(CAST(${daysExpression} - @rangeDays AS FLOAT) / @rangeDays)
      END
    `;

    const amountCandidates = [meta.amount, meta.realAmount, meta.amountSys, meta.realAmountSys]
      .filter(Boolean)
      .map((columnName) => columnExpr('opp', columnName));
    const amountExpression = amountCandidates.length
      ? `COALESCE(${amountCandidates.join(', ')}, 0)`
      : '0';

    const rows = await queryRows(
      `
        SELECT
          CAST(${bucketExpression} AS INT) AS BucketIndex,
          COUNT(${meta.oppId ? `DISTINCT ${columnExpr('opp', meta.oppId)}` : '1'}) AS OpportunityCount,
          CAST(SUM(CAST(${amountExpression} AS DECIMAL(19, 2))) AS DECIMAL(19, 2)) AS TotalAmount
        FROM OOPR opp
        ${joins.join('\n        ')}
        ${whereClauses.length ? `WHERE ${whereClauses.join('\n          AND ')}` : ''}
        GROUP BY CAST(${bucketExpression} AS INT)
        ORDER BY BucketIndex
      `,
      params,
      options,
    );

    const byBucket = new Map(rows.map((row) => [Number(row.BucketIndex || 0), row]));
    const maxBucket = rows.length ? Math.max(...rows.map((row) => Number(row.BucketIndex || 0))) : -1;
    const data = Array.from({ length: maxBucket + 1 }, (_, bucketIndex) => {
      const row = byBucket.get(bucketIndex) || {};
      const fromDay = bucketIndex === 0 ? 0 : (bucketIndex * rangeDays) + 1;
      const toDay = bucketIndex === 0 ? rangeDays : (bucketIndex + 1) * rangeDays;
      return {
        bucketIndex,
        daysUntilClosing: `${fromDay} - ${toDay}`,
        opportunityCount: Number(row.OpportunityCount || 0),
        totalAmount: Number(row.TotalAmount || 0),
      };
    });

    return {
      success: true,
      data,
      chart: {
        income: data.map((row) => ({ label: row.daysUntilClosing, value: row.totalAmount })),
        opportunities: data.map((row) => ({ label: row.daysUntilClosing, value: row.opportunityCount })),
      },
      meta: {
        criteria,
        rangeDays,
        totalRecords: data.reduce((sum, row) => sum + row.opportunityCount, 0),
        totalAmount: data.reduce((sum, row) => sum + row.totalAmount, 0),
      },
      reportTitle: 'Won Opportunities Report',
    };
  } catch (error) {
    console.error('Error in getWonOpportunitiesReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getOpportunitiesForecastReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const bpSelection = criteria?.businessPartner || {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }
    if (meta.hasOSLP && meta.slpCode) joins.push(`LEFT JOIN OSLP mainSe ON mainSe.SlpCode = ${columnExpr('opp', meta.slpCode)}`);
    if (meta.hasOSLP && meta.lastSlpCode) joins.push(`LEFT JOIN OSLP lastSe ON lastSe.SlpCode = ${columnExpr('opp', meta.lastSlpCode)}`);

    if (meta.status) {
      whereClauses.push(`${columnExpr('opp', meta.status)} = @openStatus`);
      params.openStatus = 'O';
    }

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    const canUseStageLine = Boolean(meta.hasOPR1 && meta.oppId && meta.opr1OppId);
    if (canUseStageLine) {
      const orderColumn = meta.opr1Line || meta.opr1Stage || meta.opr1OppId;
      joins.push(`
        OUTER APPLY (
          SELECT TOP 1 *
          FROM OPR1 stageLine
          WHERE stageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          ORDER BY stageLine.${quoted(orderColumn)} DESC
        ) lastStageLine
      `);
    }
    if (meta.hasOOST && meta.oostCode && (meta.opr1Stage || meta.stage)) {
      const joinStageExpression = meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression;
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${joinStageExpression}`);
    }

    const bpCodeFrom = text(bpSelection.codeFrom);
    const bpCodeTo = text(bpSelection.codeTo);
    if (meta.cardCode && bpCodeFrom) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
      params.bpCodeFrom = bpCodeFrom;
    }
    if (meta.cardCode && bpCodeTo) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
      params.bpCodeTo = bpCodeTo;
    }

    const bpGroupFilter = text(bpSelection.group);
    if (bpGroupFilter && bpGroupFilter !== '*' && bpGroupFilter.toLowerCase() !== 'all' && meta.hasOCRG) {
      if (/^\d+$/.test(bpGroupFilter)) {
        whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
        params.bpGroupCode = Number(bpGroupFilter);
      } else {
        whereClauses.push('grp.GroupName = @bpGroupName');
        params.bpGroupName = bpGroupFilter;
      }
    }

    addTextFilter(whereClauses, params, meta.territory ? columnExpr('opp', meta.territory) : '', 'territory', criteria.territory);
    addTextFilter(whereClauses, params, meta.industry ? columnExpr('opp', meta.industry) : '', 'industry', criteria.industry);
    addTextFilter(whereClauses, params, meta.interestLevel ? columnExpr('opp', meta.interestLevel) : '', 'interestLevel', criteria.interestLevel);
    addTextFilter(whereClauses, params, meta.source ? columnExpr('opp', meta.source) : '', 'source', criteria.source);
    addTextFilter(whereClauses, params, meta.project ? columnExpr('opp', meta.project) : '', 'project', criteria.project);
    addTextFilter(whereClauses, params, meta.channel ? `bp.${quoted(meta.channel)}` : '', 'channelCode', criteria.channelCode);

    const mainSalesEmp = text(criteria.mainSalesEmp);
    if (meta.slpCode && mainSalesEmp) {
      if (/^-?\d+$/.test(mainSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.slpCode)} = @mainSalesEmp`);
        params.mainSalesEmp = Number(mainSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('mainSe.SlpName = @mainSalesEmpName');
        params.mainSalesEmpName = text(criteria.mainSalesEmpName) || mainSalesEmp;
      }
    }

    const lastSalesEmp = text(criteria.lastSalesEmp);
    if (meta.lastSlpCode && lastSalesEmp) {
      if (/^-?\d+$/.test(lastSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.lastSlpCode)} = @lastSalesEmp`);
        params.lastSalesEmp = Number(lastSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('lastSe.SlpName = @lastSalesEmpName');
        params.lastSalesEmpName = text(criteria.lastSalesEmpName) || lastSalesEmp;
      }
    }

    const stageValue = text(criteria.stage);
    if (stageValue) {
      if (/^-?\d+$/.test(stageValue) && (meta.opr1Stage || meta.stage)) {
        whereClauses.push(`${meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression} = @stageValue`);
        params.stageValue = Number(stageValue);
      } else if (meta.hasOOST && meta.oostName) {
        whereClauses.push(`stg.${quoted(meta.oostName)} = @stageName`);
        params.stageName = stageValue;
      }
    }

    if (criteria?.closingDate?.enabled && meta.closingDate) {
      const fromDate = normalizeDateInput(criteria.closingDate.from);
      const toDate = normalizeDateInput(criteria.closingDate.to);
      if (fromDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} >= @closingDateFrom`);
        params.closingDateFrom = fromDate;
      }
      if (toDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} <= @closingDateTo`);
        params.closingDateTo = toDate;
      }
    } else if (meta.closingDate) {
      whereClauses.push(`CAST(${columnExpr('opp', meta.closingDate)} AS DATE) >= CAST(GETDATE() AS DATE)`);
    }

    addNumberRangeFilter(whereClauses, params, meta.amount ? columnExpr('opp', meta.amount) : '', criteria.amount, 'amount');
    addNumberRangeFilter(whereClauses, params, meta.percent ? columnExpr('opp', meta.percent) : '', criteria.percentageRate, 'percent');

    const partnerFilter = text(criteria.partner);
    if (partnerFilter && meta.oppId && (await tableExists('OPR2', options))) {
      const opr2OppId = await firstColumn('OPR2', ['OpprId', 'OpprID'], options);
      const opr2Code = await firstColumn('OPR2', ['CardCode', 'PartnerCode', 'PrtCode'], options);
      const opr2Name = await firstColumn('OPR2', ['CardName', 'PartnerName', 'Name'], options);
      const comparisons = [opr2Code, opr2Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), partner.${quoted(column)}) = @partnerFilter`);
      if (opr2OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR2 partner
            WHERE partner.${quoted(opr2OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.partnerFilter = partnerFilter;
      }
    }

    const competitorFilter = text(criteria.competitor);
    if (competitorFilter && meta.oppId && (await tableExists('OPR3', options))) {
      const opr3OppId = await firstColumn('OPR3', ['OpprId', 'OpprID'], options);
      const opr3Code = await firstColumn('OPR3', ['CompetId', 'CompCode', 'CardCode'], options);
      const opr3Name = await firstColumn('OPR3', ['Name', 'CompName', 'CompetName'], options);
      const comparisons = [opr3Code, opr3Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), competitor.${quoted(column)}) = @competitorFilter`);
      if (opr3OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR3 competitor
            WHERE competitor.${quoted(opr3OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.competitorFilter = competitorFilter;
      }
    }

    const documentFilter = text(criteria.document);
    if (documentFilter && meta.oppId && meta.hasOPR1 && meta.opr1OppId) {
      const objTypeColumn = await firstColumn('OPR1', ['ObjType', 'ObjectType', 'DocType'], options);
      const docTypeMap = {
        quotation: 23,
        order: 17,
        delivery: 15,
        invoice: 13,
      };
      if (objTypeColumn && docTypeMap[documentFilter]) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
              AND docLine.${quoted(objTypeColumn)} = @documentObjType
          )
        `);
        params.documentObjType = docTypeMap[documentFilter];
      } else {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          )
        `);
      }
    }

    const stageNameExpression = meta.oostName ? `ISNULL(stg.${quoted(meta.oostName)}, '')` : (meta.stage ? `CONVERT(NVARCHAR(255), ${stageSourceExpression})` : `''`);
    const amountExpression = meta.amount ? `ISNULL(${columnExpr('opp', meta.amount)}, 0)` : '0';
    const percentExpression = meta.percent ? `ISNULL(${columnExpr('opp', meta.percent)}, 0)` : '0';
    const weightedExpression = meta.weighted ? `ISNULL(${columnExpr('opp', meta.weighted)}, 0)` : `(${amountExpression} * ${percentExpression} / 100.0)`;

    const sql = `
      SELECT
        ${selectText('opp', meta.oppId, 'OpprID')},
        ${selectText('opp', meta.oppName, 'OpprName')},
        ${selectText('opp', meta.cardCode, 'CardCode')},
        ${meta.hasOCRD ? "ISNULL(bp.CardName, '') AS CardName" : "'' AS CardName"},
        ${selectText('opp', meta.territory, 'Territory')},
        ${selectText('opp', meta.industry, 'Industry')},
        ${selectText('opp', meta.source, 'SourceName')},
        ${selectText('opp', meta.interestLevel, 'InterestLevel')},
        ${meta.channel ? `ISNULL(CONVERT(NVARCHAR(100), bp.${quoted(meta.channel)}), '') AS ChannelCode` : "'' AS ChannelCode"},
        ${selectText('opp', meta.project, 'ProjectCode')},
        ${stageNameExpression} AS LastStage,
        CAST(${percentExpression} AS DECIMAL(9, 2)) AS ClosingPercent,
        ${selectNumber('opp', meta.amount, 'PotentialAmount')},
        CAST(${weightedExpression} AS DECIMAL(19, 2)) AS WeightedAmount,
        ${meta.closingDate ? `CAST(${columnExpr('opp', meta.closingDate)} AS DATE) AS ClosingDate` : 'CAST(NULL AS DATE) AS ClosingDate'},
        ${meta.hasOSLP ? "ISNULL(mainSe.SlpName, '') AS MainSalesEmp" : "'' AS MainSalesEmp"},
        ${meta.hasOSLP ? "ISNULL(lastSe.SlpName, '') AS LastSalesEmp" : "'' AS LastSalesEmp"},
        '' AS PartnerName,
        '' AS CompetitorName,
        CAST(${amountExpression} * ${percentExpression} / 100.0 AS DECIMAL(19, 2)) AS PredictedAmount
      FROM OOPR opp
      ${joins.join('\n      ')}
      ${whereClauses.length ? `WHERE ${whereClauses.join('\n        AND ')}` : ''}
      ORDER BY ${meta.closingDate ? columnExpr('opp', meta.closingDate) : meta.oppId ? columnExpr('opp', meta.oppId) : '1'}
    `;

    const rows = await queryRows(sql, params, options);
    return {
      success: true,
      data: rows,
      meta: {
        totalRecords: rows.length,
        criteria,
      },
    };
  } catch (error) {
    console.error('Error in getOpportunitiesForecastReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getOpportunitiesForecastOverTimeReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const bpSelection = criteria?.businessPartner || {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }
    if (meta.hasOSLP && meta.slpCode) joins.push(`LEFT JOIN OSLP mainSe ON mainSe.SlpCode = ${columnExpr('opp', meta.slpCode)}`);
    if (meta.hasOSLP && meta.lastSlpCode) joins.push(`LEFT JOIN OSLP lastSe ON lastSe.SlpCode = ${columnExpr('opp', meta.lastSlpCode)}`);

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    if (meta.hasOPR1 && meta.oppId && meta.opr1OppId) {
      const orderColumn = meta.opr1Line || meta.opr1Stage || meta.opr1OppId;
      joins.push(`
        OUTER APPLY (
          SELECT TOP 1 *
          FROM OPR1 stageLine
          WHERE stageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          ORDER BY stageLine.${quoted(orderColumn)} DESC
        ) lastStageLine
      `);
    }
    if (meta.hasOOST && meta.oostCode && (meta.opr1Stage || meta.stage)) {
      const joinStageExpression = meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression;
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${joinStageExpression}`);
    }

    const bpCodeFrom = text(bpSelection.codeFrom);
    const bpCodeTo = text(bpSelection.codeTo);
    if (meta.cardCode && bpCodeFrom) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
      params.bpCodeFrom = bpCodeFrom;
    }
    if (meta.cardCode && bpCodeTo) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
      params.bpCodeTo = bpCodeTo;
    }

    const bpGroupFilter = text(bpSelection.group);
    if (bpGroupFilter && bpGroupFilter !== '*' && bpGroupFilter.toLowerCase() !== 'all' && meta.hasOCRG) {
      if (/^\d+$/.test(bpGroupFilter)) {
        whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
        params.bpGroupCode = Number(bpGroupFilter);
      } else {
        whereClauses.push('grp.GroupName = @bpGroupName');
        params.bpGroupName = bpGroupFilter;
      }
    }

    addTextFilter(whereClauses, params, meta.territory ? columnExpr('opp', meta.territory) : '', 'territory', criteria.territory);
    addTextFilter(whereClauses, params, meta.industry ? columnExpr('opp', meta.industry) : '', 'industry', criteria.industry);
    addTextFilter(whereClauses, params, meta.interestLevel ? columnExpr('opp', meta.interestLevel) : '', 'interestLevel', criteria.interestLevel);
    addTextFilter(whereClauses, params, meta.source ? columnExpr('opp', meta.source) : '', 'source', criteria.source);
    addTextFilter(whereClauses, params, meta.project ? columnExpr('opp', meta.project) : '', 'project', criteria.project);
    addTextFilter(whereClauses, params, meta.channel ? `bp.${quoted(meta.channel)}` : '', 'channelCode', criteria.channelCode);
    addTextFilter(whereClauses, params, meta.status ? columnExpr('opp', meta.status) : '', 'status', criteria.status);

    const mainSalesEmp = text(criteria.mainSalesEmp);
    if (meta.slpCode && mainSalesEmp) {
      if (/^-?\d+$/.test(mainSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.slpCode)} = @mainSalesEmp`);
        params.mainSalesEmp = Number(mainSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('mainSe.SlpName = @mainSalesEmpName');
        params.mainSalesEmpName = text(criteria.mainSalesEmpName) || mainSalesEmp;
      }
    }

    const lastSalesEmp = text(criteria.lastSalesEmp);
    if (meta.lastSlpCode && lastSalesEmp) {
      if (/^-?\d+$/.test(lastSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.lastSlpCode)} = @lastSalesEmp`);
        params.lastSalesEmp = Number(lastSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('lastSe.SlpName = @lastSalesEmpName');
        params.lastSalesEmpName = text(criteria.lastSalesEmpName) || lastSalesEmp;
      }
    }

    const stageValue = text(criteria.stage);
    if (stageValue) {
      if (/^-?\d+$/.test(stageValue) && (meta.opr1Stage || meta.stage)) {
        whereClauses.push(`${meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression} = @stageValue`);
        params.stageValue = Number(stageValue);
      } else if (meta.hasOOST && meta.oostName) {
        whereClauses.push(`stg.${quoted(meta.oostName)} = @stageName`);
        params.stageName = stageValue;
      }
    }

    if (criteria?.closingDate?.enabled && meta.closingDate) {
      const fromDate = normalizeDateInput(criteria.closingDate.from);
      const toDate = normalizeDateInput(criteria.closingDate.to);
      if (fromDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} >= @closingDateFrom`);
        params.closingDateFrom = fromDate;
      }
      if (toDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} <= @closingDateTo`);
        params.closingDateTo = toDate;
      }
    }

    const useSystemCurrency = Boolean(criteria.displayInSystemCurrency);
    const amountColumn = useSystemCurrency && meta.amountSys ? meta.amountSys : meta.amount;
    addNumberRangeFilter(whereClauses, params, amountColumn ? columnExpr('opp', amountColumn) : '', criteria.amount, 'amount');
    addNumberRangeFilter(whereClauses, params, meta.percent ? columnExpr('opp', meta.percent) : '', criteria.percentageRate, 'percent');

    const partnerFilter = text(criteria.partner);
    if (partnerFilter && meta.oppId && (await tableExists('OPR2', options))) {
      const opr2OppId = await firstColumn('OPR2', ['OpprId', 'OpprID'], options);
      const opr2Code = await firstColumn('OPR2', ['CardCode', 'PartnerCode', 'PrtCode'], options);
      const opr2Name = await firstColumn('OPR2', ['CardName', 'PartnerName', 'Name'], options);
      const comparisons = [opr2Code, opr2Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), partner.${quoted(column)}) = @partnerFilter`);
      if (opr2OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR2 partner
            WHERE partner.${quoted(opr2OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.partnerFilter = partnerFilter;
      }
    }

    const competitorFilter = text(criteria.competitor);
    if (competitorFilter && meta.oppId && (await tableExists('OPR3', options))) {
      const opr3OppId = await firstColumn('OPR3', ['OpprId', 'OpprID'], options);
      const opr3Code = await firstColumn('OPR3', ['CompetId', 'CompCode', 'CardCode'], options);
      const opr3Name = await firstColumn('OPR3', ['Name', 'CompName', 'CompetName'], options);
      const comparisons = [opr3Code, opr3Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), competitor.${quoted(column)}) = @competitorFilter`);
      if (opr3OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR3 competitor
            WHERE competitor.${quoted(opr3OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.competitorFilter = competitorFilter;
      }
    }

    const documentFilter = text(criteria.document);
    if (documentFilter && meta.oppId && meta.hasOPR1 && meta.opr1OppId) {
      const objTypeColumn = await firstColumn('OPR1', ['ObjType', 'ObjectType', 'DocType'], options);
      const docTypeMap = {
        quotation: 23,
        order: 17,
        delivery: 15,
        invoice: 13,
      };
      if (objTypeColumn && docTypeMap[documentFilter]) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
              AND docLine.${quoted(objTypeColumn)} = @documentObjType
          )
        `);
        params.documentObjType = docTypeMap[documentFilter];
      } else {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          )
        `);
      }
    }

    if (!meta.closingDate && !meta.openDate) {
      return { success: false, error: 'No opportunity forecast date column was found in OOPR.', data: [] };
    }

    const dateExpression = meta.closingDate ? columnExpr('opp', meta.closingDate) : columnExpr('opp', meta.openDate);
    const amountExpression = amountColumn ? `ISNULL(${columnExpr('opp', amountColumn)}, 0)` : '0';
    const statusExpression = meta.status ? columnExpr('opp', meta.status) : "''";
    const groupBy = text(criteria.groupBy || 'month').toLowerCase();
    const periodLabelExpression = groupBy === 'year'
      ? `CONVERT(NVARCHAR(4), YEAR(${dateExpression}))`
      : groupBy === 'quarter'
        ? `CONCAT('Q', DATEPART(QUARTER, ${dateExpression}), ' - ', YEAR(${dateExpression}))`
        : `CONCAT(MONTH(${dateExpression}), ' - ', YEAR(${dateExpression}))`;
    const periodSortExpression = groupBy === 'year'
      ? `YEAR(${dateExpression})`
      : groupBy === 'quarter'
        ? `(YEAR(${dateExpression}) * 10) + DATEPART(QUARTER, ${dateExpression})`
        : `(YEAR(${dateExpression}) * 100) + MONTH(${dateExpression})`;

    if (dateExpression) {
      whereClauses.push(`${dateExpression} IS NOT NULL`);
    }

    const sql = `
      SELECT
        ${periodLabelExpression} AS PeriodLabel,
        MIN(CAST(${dateExpression} AS DATE)) AS PeriodDate,
        ${periodSortExpression} AS PeriodSort,
        CAST(SUM(CASE WHEN ${statusExpression} = 'O' THEN ${amountExpression} ELSE 0 END) AS DECIMAL(19, 2)) AS OpenAmount,
        SUM(CASE WHEN ${statusExpression} = 'O' THEN 1 ELSE 0 END) AS TotalOpen,
        SUM(CASE WHEN ${statusExpression} = 'W' THEN 1 ELSE 0 END) AS TotalWon,
        SUM(CASE WHEN ${statusExpression} = 'L' THEN 1 ELSE 0 END) AS TotalLost,
        SUM(CASE WHEN ${statusExpression} IN ('W', 'L') THEN 1 ELSE 0 END) AS TotalClosed
      FROM OOPR opp
      ${joins.join('\n      ')}
      ${whereClauses.length ? `WHERE ${whereClauses.join('\n        AND ')}` : ''}
      GROUP BY ${periodLabelExpression}, ${periodSortExpression}
      ORDER BY ${periodSortExpression}
    `;

    const rows = await queryRows(sql, params, options);
    return {
      success: true,
      data: rows,
      meta: {
        totalRecords: rows.length,
        criteria,
      },
    };
  } catch (error) {
    console.error('Error in getOpportunitiesForecastOverTimeReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const buildOpportunitySourceLookup = async (meta, options = {}) => {
  if (meta.hasOOSR && meta.oosrCode && meta.oosrName) {
    return buildSimpleLookup({
      tableName: 'OOSR',
      codeCandidates: ['Num', 'SourceID', 'Code'],
      nameCandidates: ['Descript', 'Name', 'SourceName'],
      options,
    });
  }
  return buildDistinctOpportunityLookup(meta.source, options);
};

const getInformationSourceDistributionOverTimeReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }
    if (!meta.openDate) {
      return { success: false, error: 'No opportunity open date column was found in OOPR.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const bpSelection = criteria?.businessPartner || {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }
    if (meta.hasOSLP && meta.slpCode) joins.push(`LEFT JOIN OSLP mainSe ON mainSe.SlpCode = ${columnExpr('opp', meta.slpCode)}`);
    if (meta.hasOSLP && meta.lastSlpCode) joins.push(`LEFT JOIN OSLP lastSe ON lastSe.SlpCode = ${columnExpr('opp', meta.lastSlpCode)}`);
    if (meta.hasOOSR && meta.oosrCode && meta.oosrName && meta.source) {
      joins.push(`LEFT JOIN OOSR src ON src.${quoted(meta.oosrCode)} = ${columnExpr('opp', meta.source)}`);
    }

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    if (meta.hasOPR1 && meta.oppId && meta.opr1OppId) {
      const orderColumn = meta.opr1Line || meta.opr1Stage || meta.opr1OppId;
      joins.push(`
        OUTER APPLY (
          SELECT TOP 1 *
          FROM OPR1 stageLine
          WHERE stageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          ORDER BY stageLine.${quoted(orderColumn)} DESC
        ) lastStageLine
      `);
    }
    if (meta.hasOOST && meta.oostCode && (meta.opr1Stage || meta.stage)) {
      const joinStageExpression = meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression;
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${joinStageExpression}`);
    }

    const bpCodeFrom = text(bpSelection.codeFrom);
    const bpCodeTo = text(bpSelection.codeTo);
    if (meta.cardCode && bpCodeFrom) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
      params.bpCodeFrom = bpCodeFrom;
    }
    if (meta.cardCode && bpCodeTo) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
      params.bpCodeTo = bpCodeTo;
    }

    const bpGroupFilter = text(bpSelection.group);
    if (bpGroupFilter && bpGroupFilter !== '*' && bpGroupFilter.toLowerCase() !== 'all' && meta.hasOCRG) {
      if (/^\d+$/.test(bpGroupFilter)) {
        whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
        params.bpGroupCode = Number(bpGroupFilter);
      } else {
        whereClauses.push('grp.GroupName = @bpGroupName');
        params.bpGroupName = bpGroupFilter;
      }
    }

    addTextFilter(whereClauses, params, meta.territory ? columnExpr('opp', meta.territory) : '', 'territory', criteria.territory);
    addTextFilter(whereClauses, params, meta.industry ? columnExpr('opp', meta.industry) : '', 'industry', criteria.industry);
    addTextFilter(whereClauses, params, meta.interestLevel ? columnExpr('opp', meta.interestLevel) : '', 'interestLevel', criteria.interestLevel);
    addTextFilter(whereClauses, params, meta.project ? columnExpr('opp', meta.project) : '', 'project', criteria.project);
    addTextFilter(whereClauses, params, meta.channel ? `bp.${quoted(meta.channel)}` : '', 'channelCode', criteria.channelCode);
    addTextFilter(whereClauses, params, meta.status ? columnExpr('opp', meta.status) : '', 'status', criteria.status);

    const sourceFilter = text(criteria.source);
    if (sourceFilter && sourceFilter.toLowerCase() !== 'all' && meta.source) {
      if (/^-?\d+$/.test(sourceFilter)) {
        whereClauses.push(`${columnExpr('opp', meta.source)} = @sourceCode`);
        params.sourceCode = Number(sourceFilter);
      } else if (meta.hasOOSR && meta.oosrName) {
        whereClauses.push(`src.${quoted(meta.oosrName)} = @sourceName`);
        params.sourceName = sourceFilter;
      } else {
        whereClauses.push(`CONVERT(NVARCHAR(255), ${columnExpr('opp', meta.source)}) = @sourceName`);
        params.sourceName = sourceFilter;
      }
    }

    const mainSalesEmp = text(criteria.mainSalesEmp);
    if (meta.slpCode && mainSalesEmp) {
      if (/^-?\d+$/.test(mainSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.slpCode)} = @mainSalesEmp`);
        params.mainSalesEmp = Number(mainSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('mainSe.SlpName = @mainSalesEmpName');
        params.mainSalesEmpName = text(criteria.mainSalesEmpName) || mainSalesEmp;
      }
    }

    const lastSalesEmp = text(criteria.lastSalesEmp);
    if (meta.lastSlpCode && lastSalesEmp) {
      if (/^-?\d+$/.test(lastSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.lastSlpCode)} = @lastSalesEmp`);
        params.lastSalesEmp = Number(lastSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('lastSe.SlpName = @lastSalesEmpName');
        params.lastSalesEmpName = text(criteria.lastSalesEmpName) || lastSalesEmp;
      }
    }

    const stageValue = text(criteria.stage);
    if (stageValue) {
      if (/^-?\d+$/.test(stageValue) && (meta.opr1Stage || meta.stage)) {
        whereClauses.push(`${meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression} = @stageValue`);
        params.stageValue = Number(stageValue);
      } else if (meta.hasOOST && meta.oostName) {
        whereClauses.push(`stg.${quoted(meta.oostName)} = @stageName`);
        params.stageName = stageValue;
      }
    }

    if (criteria?.closingDate?.enabled) {
      const fromDate = normalizeDateInput(criteria.closingDate.from);
      const toDate = normalizeDateInput(criteria.closingDate.to);
      if (fromDate) {
        whereClauses.push(`${columnExpr('opp', meta.openDate)} >= @dateFrom`);
        params.dateFrom = fromDate;
      }
      if (toDate) {
        whereClauses.push(`${columnExpr('opp', meta.openDate)} <= @dateTo`);
        params.dateTo = toDate;
      }
    }

    addNumberRangeFilter(whereClauses, params, meta.amount ? columnExpr('opp', meta.amount) : '', criteria.amount, 'amount');
    addNumberRangeFilter(whereClauses, params, meta.percent ? columnExpr('opp', meta.percent) : '', criteria.percentageRate, 'percent');

    const partnerFilter = text(criteria.partner);
    if (partnerFilter && meta.oppId && (await tableExists('OPR2', options))) {
      const opr2OppId = await firstColumn('OPR2', ['OpprId', 'OpprID'], options);
      const opr2Code = await firstColumn('OPR2', ['CardCode', 'PartnerCode', 'PrtCode'], options);
      const opr2Name = await firstColumn('OPR2', ['CardName', 'PartnerName', 'Name'], options);
      const comparisons = [opr2Code, opr2Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), partner.${quoted(column)}) = @partnerFilter`);
      if (opr2OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR2 partner
            WHERE partner.${quoted(opr2OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.partnerFilter = partnerFilter;
      }
    }

    const competitorFilter = text(criteria.competitor);
    if (competitorFilter && meta.oppId && (await tableExists('OPR3', options))) {
      const opr3OppId = await firstColumn('OPR3', ['OpprId', 'OpprID'], options);
      const opr3Code = await firstColumn('OPR3', ['CompetId', 'CompCode', 'CardCode'], options);
      const opr3Name = await firstColumn('OPR3', ['Name', 'CompName', 'CompetName'], options);
      const comparisons = [opr3Code, opr3Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), competitor.${quoted(column)}) = @competitorFilter`);
      if (opr3OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR3 competitor
            WHERE competitor.${quoted(opr3OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.competitorFilter = competitorFilter;
      }
    }

    const documentFilter = text(criteria.document);
    if (documentFilter && meta.oppId && meta.hasOPR1 && meta.opr1OppId) {
      const objTypeColumn = await firstColumn('OPR1', ['ObjType', 'ObjectType', 'DocType'], options);
      const docTypeMap = {
        quotation: 23,
        order: 17,
        delivery: 15,
        invoice: 13,
      };
      if (objTypeColumn && docTypeMap[documentFilter]) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
              AND docLine.${quoted(objTypeColumn)} = @documentObjType
          )
        `);
        params.documentObjType = docTypeMap[documentFilter];
      }
    }

    const dateExpression = columnExpr('opp', meta.openDate);
    whereClauses.push(`${dateExpression} IS NOT NULL`);

    const groupBy = text(criteria.groupBy || 'week').toLowerCase();
    const periodLabelExpression = groupBy === 'day' || groupBy === 'days'
      ? `CONVERT(NVARCHAR(10), CAST(${dateExpression} AS DATE), 103)`
      : groupBy === 'month' || groupBy === 'months'
        ? `CONCAT(MONTH(${dateExpression}), ' - ', YEAR(${dateExpression}))`
        : `CONCAT(DATEPART(WEEK, ${dateExpression}), ' - ', YEAR(${dateExpression}))`;
    const periodSortExpression = groupBy === 'day' || groupBy === 'days'
      ? `DATEDIFF(DAY, '19000101', CAST(${dateExpression} AS DATE))`
      : groupBy === 'month' || groupBy === 'months'
        ? `(YEAR(${dateExpression}) * 100) + MONTH(${dateExpression})`
        : `(YEAR(${dateExpression}) * 100) + DATEPART(WEEK, ${dateExpression})`;
    const sourceCodeExpression = meta.source ? `CONVERT(NVARCHAR(100), ${columnExpr('opp', meta.source)})` : "''";
    const sourceNameExpression = meta.hasOOSR && meta.oosrName
      ? `ISNULL(src.${quoted(meta.oosrName)}, ${sourceCodeExpression})`
      : sourceCodeExpression;

    const rows = await queryRows(
      `
        SELECT
          ${periodLabelExpression} AS PeriodLabel,
          ${periodSortExpression} AS PeriodSort,
          ${sourceCodeExpression} AS SourceCode,
          ${sourceNameExpression} AS SourceName,
          COUNT(1) AS CountValue
        FROM OOPR opp
        ${joins.join('\n        ')}
        ${whereClauses.length ? `WHERE ${whereClauses.join('\n          AND ')}` : ''}
        GROUP BY ${periodLabelExpression}, ${periodSortExpression}, ${sourceCodeExpression}, ${sourceNameExpression}
        ORDER BY ${periodSortExpression}, ${sourceNameExpression}
      `,
      params,
      options,
    );

    const periodMap = new Map();
    const sourceMap = new Map();
    rows.forEach((row) => {
      const periodLabel = text(row.PeriodLabel);
      const periodSort = Number(row.PeriodSort || 0);
      const sourceCode = text(row.SourceCode);
      const sourceName = text(row.SourceName);
      const countValue = Number(row.CountValue || 0);
      const periodKey = `${periodSort}:${periodLabel}`;

      if (!periodMap.has(periodKey)) {
        periodMap.set(periodKey, {
          periodLabel,
          periodSort,
          total: 0,
          sources: {},
        });
      }

      const period = periodMap.get(periodKey);
      period.total += countValue;
      if (sourceCode || sourceName) {
        const sourceKey = sourceCode || sourceName;
        if (!sourceMap.has(sourceKey)) {
          sourceMap.set(sourceKey, {
            code: sourceKey,
            name: sourceName || sourceKey,
          });
        }
        period.sources[sourceKey] = (period.sources[sourceKey] || 0) + countValue;
      }
    });

    const sources = [...sourceMap.values()].sort((left, right) => {
      const leftNumber = Number(left.code);
      const rightNumber = Number(right.code);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
      return left.name.localeCompare(right.name);
    });
    const data = [...periodMap.values()]
      .sort((left, right) => left.periodSort - right.periodSort)
      .map((period, index) => ({
        rowNo: index + 1,
        periodLabel: period.periodLabel,
        periodSort: period.periodSort,
        values: period.sources,
        total: period.total,
      }));

    return {
      success: true,
      data,
      sources,
      chart: {
        groupBy,
        periods: data.map((row) => row.periodLabel),
        sources: sources.map((source) => ({
          ...source,
          values: data.map((row) => Number(row.values[source.code] || 0)),
        })),
      },
      meta: {
        totalRecords: data.reduce((sum, row) => sum + row.total, 0),
        criteria,
      },
      reportTitle: 'Information Source Distribution Over Time Report',
    };
  } catch (error) {
    console.error('Error in getInformationSourceDistributionOverTimeReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getStatisticsGroupConfig = (meta, groupBy = 'bpCode') => {
  const key = text(groupBy) || 'bpCode';
  const asText = (expression) => `ISNULL(CONVERT(NVARCHAR(255), ${expression}), '')`;

  const configs = {
    bpCode: {
      label: 'BP Code',
      nameLabel: 'BP Name',
      codeExpression: meta.cardCode ? asText(columnExpr('opp', meta.cardCode)) : "''",
      nameExpression: meta.hasOCRD ? "ISNULL(bp.CardName, '')" : (meta.cardCode ? asText(columnExpr('opp', meta.cardCode)) : "''"),
    },
    mainSalesEmp: {
      label: 'Main Sales Emp.',
      nameLabel: 'Main Sales Emp.',
      codeExpression: meta.slpCode ? asText(columnExpr('opp', meta.slpCode)) : "''",
      nameExpression: meta.hasOSLP ? "ISNULL(mainSe.SlpName, '')" : (meta.slpCode ? asText(columnExpr('opp', meta.slpCode)) : "''"),
    },
    lastSalesEmp: {
      label: 'Last Sales Emp.',
      nameLabel: 'Last Sales Emp.',
      codeExpression: meta.lastSlpCode ? asText(columnExpr('opp', meta.lastSlpCode)) : "''",
      nameExpression: meta.hasOSLP ? "ISNULL(lastSe.SlpName, '')" : (meta.lastSlpCode ? asText(columnExpr('opp', meta.lastSlpCode)) : "''"),
    },
    bpGroup: {
      label: 'BP Group',
      nameLabel: 'BP Group',
      codeExpression: meta.hasOCRD ? asText('bp.GroupCode') : "''",
      nameExpression: meta.hasOCRG ? "ISNULL(grp.GroupName, '')" : (meta.hasOCRD ? asText('bp.GroupCode') : "''"),
    },
    territory: {
      label: 'Territory',
      nameLabel: 'Territory',
      codeExpression: meta.territory ? asText(columnExpr('opp', meta.territory)) : "''",
      nameExpression: meta.territory ? asText(columnExpr('opp', meta.territory)) : "''",
    },
    itemNo: {
      label: 'Item No.',
      nameLabel: 'Item No.',
      codeExpression: "''",
      nameExpression: "''",
    },
    itemGroup: {
      label: 'Item Group',
      nameLabel: 'Item Group',
      codeExpression: "''",
      nameExpression: "''",
    },
  };

  return configs[key] || configs.bpCode;
};

const getOpportunitiesStatisticsReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const bpSelection = criteria?.businessPartner || {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }
    if (meta.hasOSLP && meta.slpCode) joins.push(`LEFT JOIN OSLP mainSe ON mainSe.SlpCode = ${columnExpr('opp', meta.slpCode)}`);
    if (meta.hasOSLP && meta.lastSlpCode) joins.push(`LEFT JOIN OSLP lastSe ON lastSe.SlpCode = ${columnExpr('opp', meta.lastSlpCode)}`);

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    if (meta.hasOPR1 && meta.oppId && meta.opr1OppId) {
      const orderColumn = meta.opr1Line || meta.opr1Stage || meta.opr1OppId;
      joins.push(`
        OUTER APPLY (
          SELECT TOP 1 *
          FROM OPR1 stageLine
          WHERE stageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          ORDER BY stageLine.${quoted(orderColumn)} DESC
        ) lastStageLine
      `);
    }
    if (meta.hasOOST && meta.oostCode && (meta.opr1Stage || meta.stage)) {
      const joinStageExpression = meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression;
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${joinStageExpression}`);
    }

    const bpCodeFrom = text(bpSelection.codeFrom);
    const bpCodeTo = text(bpSelection.codeTo);
    if (meta.cardCode && bpCodeFrom) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
      params.bpCodeFrom = bpCodeFrom;
    }
    if (meta.cardCode && bpCodeTo) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
      params.bpCodeTo = bpCodeTo;
    }

    const bpGroupFilter = text(bpSelection.group);
    if (bpGroupFilter && bpGroupFilter !== '*' && bpGroupFilter.toLowerCase() !== 'all' && meta.hasOCRG) {
      if (/^\d+$/.test(bpGroupFilter)) {
        whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
        params.bpGroupCode = Number(bpGroupFilter);
      } else {
        whereClauses.push('grp.GroupName = @bpGroupName');
        params.bpGroupName = bpGroupFilter;
      }
    }

    addTextFilter(whereClauses, params, meta.territory ? columnExpr('opp', meta.territory) : '', 'territory', criteria.territory);
    addTextFilter(whereClauses, params, meta.industry ? columnExpr('opp', meta.industry) : '', 'industry', criteria.industry);
    addTextFilter(whereClauses, params, meta.interestLevel ? columnExpr('opp', meta.interestLevel) : '', 'interestLevel', criteria.interestLevel);
    addTextFilter(whereClauses, params, meta.source ? columnExpr('opp', meta.source) : '', 'source', criteria.source);
    addTextFilter(whereClauses, params, meta.project ? columnExpr('opp', meta.project) : '', 'project', criteria.project);
    addTextFilter(whereClauses, params, meta.channel ? `bp.${quoted(meta.channel)}` : '', 'channelCode', criteria.channelCode);
    addTextFilter(whereClauses, params, meta.status ? columnExpr('opp', meta.status) : '', 'status', criteria.status);

    const mainSalesEmp = text(criteria.mainSalesEmp);
    if (meta.slpCode && mainSalesEmp) {
      if (/^-?\d+$/.test(mainSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.slpCode)} = @mainSalesEmp`);
        params.mainSalesEmp = Number(mainSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('mainSe.SlpName = @mainSalesEmpName');
        params.mainSalesEmpName = text(criteria.mainSalesEmpName) || mainSalesEmp;
      }
    }

    const lastSalesEmp = text(criteria.lastSalesEmp);
    if (meta.lastSlpCode && lastSalesEmp) {
      if (/^-?\d+$/.test(lastSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.lastSlpCode)} = @lastSalesEmp`);
        params.lastSalesEmp = Number(lastSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('lastSe.SlpName = @lastSalesEmpName');
        params.lastSalesEmpName = text(criteria.lastSalesEmpName) || lastSalesEmp;
      }
    }

    const stageValue = text(criteria.stage);
    if (stageValue) {
      if (/^-?\d+$/.test(stageValue) && (meta.opr1Stage || meta.stage)) {
        whereClauses.push(`${meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression} = @stageValue`);
        params.stageValue = Number(stageValue);
      } else if (meta.hasOOST && meta.oostName) {
        whereClauses.push(`stg.${quoted(meta.oostName)} = @stageName`);
        params.stageName = stageValue;
      }
    }

    if (criteria?.closingDate?.enabled && meta.closingDate) {
      const fromDate = normalizeDateInput(criteria.closingDate.from);
      const toDate = normalizeDateInput(criteria.closingDate.to);
      if (fromDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} >= @closingDateFrom`);
        params.closingDateFrom = fromDate;
      }
      if (toDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} <= @closingDateTo`);
        params.closingDateTo = toDate;
      }
    }

    const useSystemCurrency = Boolean(criteria.displayInSystemCurrency);
    const amountColumn = useSystemCurrency && meta.amountSys ? meta.amountSys : meta.amount;
    const realAmountColumn = useSystemCurrency && meta.realAmountSys ? meta.realAmountSys : meta.realAmount;
    addNumberRangeFilter(whereClauses, params, amountColumn ? columnExpr('opp', amountColumn) : '', criteria.amount, 'amount');
    addNumberRangeFilter(whereClauses, params, meta.percent ? columnExpr('opp', meta.percent) : '', criteria.percentageRate, 'percent');

    const partnerFilter = text(criteria.partner);
    if (partnerFilter && meta.oppId && (await tableExists('OPR2', options))) {
      const opr2OppId = await firstColumn('OPR2', ['OpprId', 'OpprID'], options);
      const opr2Code = await firstColumn('OPR2', ['CardCode', 'PartnerCode', 'PrtCode'], options);
      const opr2Name = await firstColumn('OPR2', ['CardName', 'PartnerName', 'Name'], options);
      const comparisons = [opr2Code, opr2Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), partner.${quoted(column)}) = @partnerFilter`);
      if (opr2OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR2 partner
            WHERE partner.${quoted(opr2OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.partnerFilter = partnerFilter;
      }
    }

    const competitorFilter = text(criteria.competitor);
    if (competitorFilter && meta.oppId && (await tableExists('OPR3', options))) {
      const opr3OppId = await firstColumn('OPR3', ['OpprId', 'OpprID'], options);
      const opr3Code = await firstColumn('OPR3', ['CompetId', 'CompCode', 'CardCode'], options);
      const opr3Name = await firstColumn('OPR3', ['Name', 'CompName', 'CompetName'], options);
      const comparisons = [opr3Code, opr3Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), competitor.${quoted(column)}) = @competitorFilter`);
      if (opr3OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR3 competitor
            WHERE competitor.${quoted(opr3OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.competitorFilter = competitorFilter;
      }
    }

    const documentFilter = text(criteria.document);
    if (documentFilter && meta.oppId && meta.hasOPR1 && meta.opr1OppId) {
      const objTypeColumn = await firstColumn('OPR1', ['ObjType', 'ObjectType', 'DocType'], options);
      const docTypeMap = {
        quotation: 23,
        order: 17,
        delivery: 15,
        invoice: 13,
      };
      if (objTypeColumn && docTypeMap[documentFilter]) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
              AND docLine.${quoted(objTypeColumn)} = @documentObjType
          )
        `);
        params.documentObjType = docTypeMap[documentFilter];
      } else {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          )
        `);
      }
    }

    const group1 = getStatisticsGroupConfig(meta, criteria.groupBy || 'bpCode');
    const group2Key = text(criteria.groupBy2);
    const group2 = group2Key ? getStatisticsGroupConfig(meta, group2Key) : null;
    const statusExpression = meta.status ? columnExpr('opp', meta.status) : "''";
    const amountExpression = amountColumn ? `ISNULL(${columnExpr('opp', amountColumn)}, 0)` : '0';
    const weightedExpression = meta.weighted ? `ISNULL(${columnExpr('opp', meta.weighted)}, 0)` : '0';
    const realAmountExpression = realAmountColumn
      ? `ISNULL(${columnExpr('opp', realAmountColumn)}, ${amountExpression})`
      : amountExpression;
    const groupExpressions = [
      group1.codeExpression,
      group1.nameExpression,
      ...(group2 ? [group2.codeExpression, group2.nameExpression] : []),
    ];

    const sql = `
      SELECT
        ${group1.codeExpression} AS Group1Code,
        ${group1.nameExpression} AS Group1Name,
        ${group2 ? group2.codeExpression : "''"} AS Group2Code,
        ${group2 ? group2.nameExpression : "''"} AS Group2Name,
        COUNT(1) AS Total,
        SUM(CASE WHEN ${statusExpression} = 'O' THEN 1 ELSE 0 END) AS TotalOpen,
        SUM(CASE WHEN ${statusExpression} = 'W' THEN 1 ELSE 0 END) AS TotalWon,
        SUM(CASE WHEN ${statusExpression} = 'L' THEN 1 ELSE 0 END) AS TotalLost,
        SUM(CASE WHEN ${statusExpression} IN ('W', 'L') THEN 1 ELSE 0 END) AS TotalClosed,
        CAST(
          CASE
            WHEN SUM(CASE WHEN ${statusExpression} IN ('W', 'L') THEN 1 ELSE 0 END) = 0 THEN 0
            ELSE SUM(CASE WHEN ${statusExpression} = 'W' THEN 1 ELSE 0 END) * 100.0
              / SUM(CASE WHEN ${statusExpression} IN ('W', 'L') THEN 1 ELSE 0 END)
          END AS DECIMAL(9, 2)
        ) AS SuccessPercent,
        CAST(SUM(CASE WHEN ${statusExpression} = 'O' THEN ${amountExpression} ELSE 0 END) AS DECIMAL(19, 2)) AS PotentialOpenAmount,
        CAST(SUM(CASE WHEN ${statusExpression} = 'O' THEN ${weightedExpression} ELSE 0 END) AS DECIMAL(19, 2)) AS WeightedOpenAmount,
        CAST(SUM(CASE WHEN ${statusExpression} = 'W' THEN ${realAmountExpression} ELSE 0 END) AS DECIMAL(19, 2)) AS WonAmount,
        CAST(SUM(CASE WHEN ${statusExpression} = 'L' THEN ${realAmountExpression} ELSE 0 END) AS DECIMAL(19, 2)) AS LostAmount
      FROM OOPR opp
      ${joins.join('\n      ')}
      ${whereClauses.length ? `WHERE ${whereClauses.join('\n        AND ')}` : ''}
      GROUP BY ${groupExpressions.join(', ')}
      ORDER BY ${group1.codeExpression}, ${group1.nameExpression}${group2 ? `, ${group2.codeExpression}, ${group2.nameExpression}` : ''}
    `;

    const rows = await queryRows(sql, params, options);
    return {
      success: true,
      data: rows,
      meta: {
        totalRecords: rows.length,
        criteria,
        groupBy: {
          group1Label: group1.label,
          group1NameLabel: group1.nameLabel,
          group2Label: group2?.label || '',
          group2NameLabel: group2?.nameLabel || '',
        },
      },
    };
  } catch (error) {
    console.error('Error in getOpportunitiesStatisticsReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getLostOpportunitiesReport = async (criteria = {}, options = {}) => {
  const result = await getOpportunitiesStatisticsReport(
    {
      ...criteria,
      status: 'L',
    },
    options,
  );

  return {
    ...result,
    reportTitle: 'Lost Opportunities Report',
  };
};

const getOpportunitiesReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const bpSelection = criteria?.businessPartner || {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }
    if (meta.hasOSLP && meta.slpCode) joins.push(`LEFT JOIN OSLP mainSe ON mainSe.SlpCode = ${columnExpr('opp', meta.slpCode)}`);
    if (meta.hasOSLP && meta.lastSlpCode) joins.push(`LEFT JOIN OSLP lastSe ON lastSe.SlpCode = ${columnExpr('opp', meta.lastSlpCode)}`);

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    if (meta.hasOPR1 && meta.oppId && meta.opr1OppId) {
      const orderColumn = meta.opr1Line || meta.opr1Stage || meta.opr1OppId;
      joins.push(`
        OUTER APPLY (
          SELECT TOP 1 *
          FROM OPR1 stageLine
          WHERE stageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          ORDER BY stageLine.${quoted(orderColumn)} DESC
        ) lastStageLine
      `);
    }
    if (meta.hasOOST && meta.oostCode && (meta.opr1Stage || meta.stage)) {
      const joinStageExpression = meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression;
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${joinStageExpression}`);
    }

    const bpCodeFrom = text(bpSelection.codeFrom);
    const bpCodeTo = text(bpSelection.codeTo);
    if (meta.cardCode && bpCodeFrom) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
      params.bpCodeFrom = bpCodeFrom;
    }
    if (meta.cardCode && bpCodeTo) {
      whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
      params.bpCodeTo = bpCodeTo;
    }

    const bpGroupFilter = text(bpSelection.group);
    if (bpGroupFilter && bpGroupFilter !== '*' && bpGroupFilter.toLowerCase() !== 'all' && meta.hasOCRG) {
      if (/^\d+$/.test(bpGroupFilter)) {
        whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
        params.bpGroupCode = Number(bpGroupFilter);
      } else {
        whereClauses.push('grp.GroupName = @bpGroupName');
        params.bpGroupName = bpGroupFilter;
      }
    }

    addTextFilter(whereClauses, params, meta.territory ? columnExpr('opp', meta.territory) : '', 'territory', criteria.territory);
    addTextFilter(whereClauses, params, meta.industry ? columnExpr('opp', meta.industry) : '', 'industry', criteria.industry);
    addTextFilter(whereClauses, params, meta.interestLevel ? columnExpr('opp', meta.interestLevel) : '', 'interestLevel', criteria.interestLevel);
    addTextFilter(whereClauses, params, meta.source ? columnExpr('opp', meta.source) : '', 'source', criteria.source);
    addTextFilter(whereClauses, params, meta.project ? columnExpr('opp', meta.project) : '', 'project', criteria.project);
    addTextFilter(whereClauses, params, meta.channel ? `bp.${quoted(meta.channel)}` : '', 'channelCode', criteria.channelCode);
    addTextFilter(whereClauses, params, meta.status ? columnExpr('opp', meta.status) : '', 'status', criteria.status);

    const mainSalesEmp = text(criteria.mainSalesEmp);
    if (meta.slpCode && mainSalesEmp) {
      if (/^-?\d+$/.test(mainSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.slpCode)} = @mainSalesEmp`);
        params.mainSalesEmp = Number(mainSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('mainSe.SlpName = @mainSalesEmpName');
        params.mainSalesEmpName = text(criteria.mainSalesEmpName) || mainSalesEmp;
      }
    }

    const lastSalesEmp = text(criteria.lastSalesEmp);
    if (meta.lastSlpCode && lastSalesEmp) {
      if (/^-?\d+$/.test(lastSalesEmp)) {
        whereClauses.push(`${columnExpr('opp', meta.lastSlpCode)} = @lastSalesEmp`);
        params.lastSalesEmp = Number(lastSalesEmp);
      } else if (meta.hasOSLP) {
        whereClauses.push('lastSe.SlpName = @lastSalesEmpName');
        params.lastSalesEmpName = text(criteria.lastSalesEmpName) || lastSalesEmp;
      }
    }

    const stageValue = text(criteria.stage);
    if (stageValue) {
      if (/^-?\d+$/.test(stageValue) && (meta.opr1Stage || meta.stage)) {
        whereClauses.push(`${meta.opr1Stage ? `lastStageLine.${quoted(meta.opr1Stage)}` : stageSourceExpression} = @stageValue`);
        params.stageValue = Number(stageValue);
      } else if (meta.hasOOST && meta.oostName) {
        whereClauses.push(`stg.${quoted(meta.oostName)} = @stageName`);
        params.stageName = stageValue;
      }
    }

    if (criteria?.closingDate?.enabled && meta.closingDate) {
      const fromDate = normalizeDateInput(criteria.closingDate.from);
      const toDate = normalizeDateInput(criteria.closingDate.to);
      if (fromDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} >= @closingDateFrom`);
        params.closingDateFrom = fromDate;
      }
      if (toDate) {
        whereClauses.push(`${columnExpr('opp', meta.closingDate)} <= @closingDateTo`);
        params.closingDateTo = toDate;
      }
    }

    addNumberRangeFilter(whereClauses, params, meta.amount ? columnExpr('opp', meta.amount) : '', criteria.amount, 'amount');
    addNumberRangeFilter(whereClauses, params, meta.percent ? columnExpr('opp', meta.percent) : '', criteria.percentageRate, 'percent');

    const partnerFilter = text(criteria.partner);
    if (partnerFilter && meta.oppId && (await tableExists('OPR2', options))) {
      const opr2OppId = await firstColumn('OPR2', ['OpprId', 'OpprID'], options);
      const opr2Code = await firstColumn('OPR2', ['CardCode', 'PartnerCode', 'PrtCode'], options);
      const opr2Name = await firstColumn('OPR2', ['CardName', 'PartnerName', 'Name'], options);
      const comparisons = [opr2Code, opr2Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), partner.${quoted(column)}) = @partnerFilter`);
      if (opr2OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR2 partner
            WHERE partner.${quoted(opr2OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.partnerFilter = partnerFilter;
      }
    }

    const competitorFilter = text(criteria.competitor);
    if (competitorFilter && meta.oppId && (await tableExists('OPR3', options))) {
      const opr3OppId = await firstColumn('OPR3', ['OpprId', 'OpprID'], options);
      const opr3Code = await firstColumn('OPR3', ['CompetId', 'CompCode', 'CardCode'], options);
      const opr3Name = await firstColumn('OPR3', ['Name', 'CompName', 'CompetName'], options);
      const comparisons = [opr3Code, opr3Name]
        .filter(Boolean)
        .map((column) => `CONVERT(NVARCHAR(255), competitor.${quoted(column)}) = @competitorFilter`);
      if (opr3OppId && comparisons.length) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR3 competitor
            WHERE competitor.${quoted(opr3OppId)} = ${columnExpr('opp', meta.oppId)}
              AND (${comparisons.join(' OR ')})
          )
        `);
        params.competitorFilter = competitorFilter;
      }
    }

    const documentFilter = text(criteria.document);
    if (documentFilter && meta.oppId && meta.hasOPR1 && meta.opr1OppId) {
      const objTypeColumn = await firstColumn('OPR1', ['ObjType', 'ObjectType', 'DocType'], options);
      const docTypeMap = {
        quotation: 23,
        order: 17,
        delivery: 15,
        invoice: 13,
      };
      if (objTypeColumn && docTypeMap[documentFilter]) {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
              AND docLine.${quoted(objTypeColumn)} = @documentObjType
          )
        `);
        params.documentObjType = docTypeMap[documentFilter];
      } else {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          )
        `);
      }
    }

    const statusExpression = meta.status ? columnExpr('opp', meta.status) : "''";
    const percentExpression = meta.percent ? `ISNULL(${columnExpr('opp', meta.percent)}, 0)` : '0';
    const lastSalesEmpExpression = meta.hasOSLP
      ? "ISNULL(NULLIF(lastSe.SlpName, ''), '-No Sales Employee / Buyer-')"
      : "'-No Sales Employee / Buyer-'";
    const stageNameExpression = meta.oostName
      ? `ISNULL(stg.${quoted(meta.oostName)}, '')`
      : (meta.stage ? `CONVERT(NVARCHAR(255), ${stageSourceExpression})` : `''`);

    const sql = `
      SELECT
        ${selectText('opp', meta.oppId, 'OpprID')},
        ${selectText('opp', meta.oppName, 'OpprName')},
        ${selectText('opp', meta.cardCode, 'CardCode')},
        ${meta.hasOCRD ? "ISNULL(bp.CardName, '')" : "''"} AS CardName,
        ${lastSalesEmpExpression} AS LastSalesEmp,
        ${stageNameExpression} AS LastStage,
        CASE ${statusExpression}
          WHEN 'O' THEN 'Open'
          WHEN 'W' THEN 'Won'
          WHEN 'L' THEN 'Lost'
          ELSE ISNULL(CONVERT(NVARCHAR(50), ${statusExpression}), '')
        END AS StatusName,
        CAST(${percentExpression} AS DECIMAL(9, 2)) AS ClosingPercent,
        ${selectNumber('opp', meta.amount, 'PotentialAmount')}
      FROM OOPR opp
      ${joins.join('\n      ')}
      ${whereClauses.length ? `WHERE ${whereClauses.join('\n        AND ')}` : ''}
      ORDER BY ${meta.oppId ? columnExpr('opp', meta.oppId) : '1'}
    `;

    const rows = await queryRows(sql, params, options);
    return {
      success: true,
      data: rows,
      meta: {
        totalRecords: rows.length,
        criteria,
      },
    };
  } catch (error) {
    console.error('Error in getOpportunitiesReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getOpportunitiesPipelineReport = async (criteria = {}, options = {}) => {
  try {
    const meta = await getOpportunityMetadata(options);
    if (!meta.hasOOPR) {
      return { success: false, error: 'SAP B1 table OOPR was not found in the selected company database.', data: [] };
    }

    const whereClauses = [];
    const params = {};
    const joins = [];

    if (meta.hasOCRD && meta.cardCode) {
      joins.push(`LEFT JOIN OCRD bp ON bp.CardCode = ${columnExpr('opp', meta.cardCode)}`);
      if (meta.hasOCRG) joins.push('LEFT JOIN OCRG grp ON grp.GroupCode = bp.GroupCode');
    }
    if (meta.hasOSLP && meta.slpCode) joins.push(`LEFT JOIN OSLP salesEmp ON salesEmp.SlpCode = ${columnExpr('opp', meta.slpCode)}`);

    const stageSourceExpression = meta.stage ? columnExpr('opp', meta.stage) : '';
    if (meta.hasOPR1 && meta.oppId && meta.opr1OppId) {
      const orderColumn = meta.opr1Line || meta.opr1Stage || meta.opr1OppId;
      joins.push(`
        OUTER APPLY (
          SELECT TOP 1 *
          FROM OPR1 lastStageLine
          WHERE lastStageLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          ORDER BY lastStageLine.${quoted(orderColumn)} DESC
        ) lastStageLine
      `);
    }

    const stageCodeExpression = canUseStageLine && meta.opr1Stage
      ? `lastStageLine.${quoted(meta.opr1Stage)}`
      : stageSourceExpression;
    if (meta.hasOOST && meta.oostCode && stageCodeExpression) {
      joins.push(`LEFT JOIN OOST stg ON stg.${quoted(meta.oostCode)} = ${stageCodeExpression}`);
    }

    const applyDateRange = (range = {}, expression, prefix) => {
      if (!range?.enabled || !expression) return;
      const fromDate = normalizeDateInput(range.from);
      const toDate = normalizeDateInput(range.to);
      if (fromDate) {
        whereClauses.push(`${expression} >= @${prefix}From`);
        params[`${prefix}From`] = fromDate;
      }
      if (toDate) {
        whereClauses.push(`${expression} <= @${prefix}To`);
        params[`${prefix}To`] = toDate;
      }
    };

    const bpSelection = criteria?.bpSelection || {};
    if (bpSelection.enabled && meta.cardCode) {
      const bpCodeFrom = text(bpSelection.codeFrom);
      const bpCodeTo = text(bpSelection.codeTo);
      if (bpCodeFrom) {
        whereClauses.push(`${columnExpr('opp', meta.cardCode)} >= @bpCodeFrom`);
        params.bpCodeFrom = bpCodeFrom;
      }
      if (bpCodeTo) {
        whereClauses.push(`${columnExpr('opp', meta.cardCode)} <= @bpCodeTo`);
        params.bpCodeTo = bpCodeTo;
      }
    }
    if (bpSelection.enabled && meta.hasOCRD) {
      const bpType = text(bpSelection.bpType).toUpperCase();
      const bpTypeMap = { CUSTOMER: 'C', SUPPLIER: 'S', VENDOR: 'S', LEAD: 'L' };
      if (bpType === 'CUSTOMERANDLEAD' || bpType === 'CUSTOMER AND LEAD') {
        whereClauses.push("bp.CardType IN ('C', 'L')");
      } else if (bpType && bpType !== 'ALL' && bpTypeMap[bpType]) {
        whereClauses.push('bp.CardType = @bpType');
        params.bpType = bpTypeMap[bpType];
      }
    }
    if (bpSelection.enabled && meta.hasOCRG) {
      const groupValue = text(bpSelection.customerGroup) || text(bpSelection.vendorGroup);
      if (groupValue === '__NONE__') {
        whereClauses.push('(bp.GroupCode IS NULL OR ISNULL(bp.GroupCode, 0) = 0)');
      } else if (groupValue && groupValue.toLowerCase() !== 'all') {
        if (/^-?\d+$/.test(groupValue)) {
          whereClauses.push('ISNULL(bp.GroupCode, 0) = @bpGroupCode');
          params.bpGroupCode = Number(groupValue);
        } else {
          whereClauses.push('grp.GroupName = @bpGroupName');
          params.bpGroupName = groupValue;
        }
      }
    }
    if (bpSelection.enabled && meta.hasOCRD) {
      addBpPropertyFilter(whereClauses, bpSelection.propertyFilter, 'bp');
    }

    const salesEmployeeSelection = criteria?.salesEmployeeSelection || {};
    if (salesEmployeeSelection.enabled && meta.slpCode) {
      addDynamicInFilter(
        whereClauses,
        params,
        columnExpr('opp', meta.slpCode),
        salesEmployeeSelection.selectedCodes,
        'salesEmployeeCode',
        (value) => (/^-?\d+$/.test(value) ? Number(value) : value),
      );
    }

    const stageSelection = criteria?.stageSelection || {};
    if (stageSelection.enabled && stageCodeExpression) {
      addDynamicInFilter(
        whereClauses,
        params,
        stageCodeExpression,
        stageSelection.selectedCodes,
        'pipelineStage',
        (value) => (/^-?\d+$/.test(value) ? Number(value) : value),
      );
    }
    const stageType = text(stageSelection.stageType).toLowerCase();
    if (meta.status && stageType && stageType !== 'all') {
      const statusMap = { open: 'O', won: 'W', lost: 'L' };
      if (statusMap[stageType]) {
        whereClauses.push(`${columnExpr('opp', meta.status)} = @pipelineStageStatus`);
        params.pipelineStageStatus = statusMap[stageType];
      }
    }

    const dateSelection = criteria?.dateSelection || {};
    if (dateSelection.enabled) {
      applyDateRange(dateSelection.startDate, meta.openDate ? columnExpr('opp', meta.openDate) : '', 'pipelineStartDate');
      applyDateRange(dateSelection.closingDate, meta.wonClosingDate ? columnExpr('opp', meta.wonClosingDate) : '', 'pipelineClosingDate');
      applyDateRange(dateSelection.predictedClosingDate, meta.closingDate ? columnExpr('opp', meta.closingDate) : '', 'pipelinePredictedClosingDate');
    }

    const amountsSelection = criteria?.amountsSelection || {};
    if (amountsSelection.enabled) {
      addNumberRangeFilter(whereClauses, params, meta.amount ? columnExpr('opp', meta.amount) : '', amountsSelection.potentialAmount, 'pipelinePotentialAmount');
      addNumberRangeFilter(whereClauses, params, meta.weighted ? columnExpr('opp', meta.weighted) : '', amountsSelection.weightedAmount, 'pipelineWeightedAmount');
      const grossProfitColumn = await firstColumn('OOPR', ['GrossProfit', 'GrssProfit', 'GrossProf', 'GPAmount', 'GrossProfitTotal'], options);
      addNumberRangeFilter(whereClauses, params, grossProfitColumn ? columnExpr('opp', grossProfitColumn) : '', amountsSelection.grossProfitTotal, 'pipelineGrossProfit');
    }

    const percentageSelection = criteria?.percentageSelection || {};
    if (percentageSelection.enabled) {
      addNumberRangeFilter(whereClauses, params, meta.percent ? columnExpr('opp', meta.percent) : '', percentageSelection.closingPercentage, 'pipelineClosingPercent');
    }

    const documentsSelection = criteria?.documentsSelection || {};
    if (documentsSelection.enabled && meta.oppId && meta.hasOPR1 && meta.opr1OppId) {
      const objTypeColumn = await firstColumn('OPR1', ['ObjType', 'ObjectType', 'DocType'], options);
      const docTypeMap = {
        salesQuotation: 23,
        salesOrder: 17,
        delivery: 15,
        arInvoice: 13,
        purchaseQuotation: 540000006,
        purchaseOrder: 22,
        goodsReceiptPo: 20,
        apInvoice: 18,
        quotation: 23,
        order: 17,
        invoice: 13,
      };
      const selectedObjTypes = (documentsSelection.selectedCodes || [])
        .map((code) => docTypeMap[text(code)])
        .filter((value) => value !== undefined);
      if (objTypeColumn && selectedObjTypes.length) {
        addDynamicInFilter(
          whereClauses,
          params,
          `docLine.${quoted(objTypeColumn)}`,
          selectedObjTypes.map(String),
          'pipelineDocType',
          Number,
        );
        const docTypeFilter = whereClauses.pop();
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
              AND ${docTypeFilter}
          )
        `);
      } else {
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR1 docLine
            WHERE docLine.${quoted(meta.opr1OppId)} = ${columnExpr('opp', meta.oppId)}
          )
        `);
      }
    }

    const expandedSelection = criteria?.expandedSelection || {};
    const addExpandedCodes = (key, expression, prefix, parser = (value) => value) => {
      const bucket = expandedSelection?.[key] || {};
      if (!bucket.enabled) return;
      addDynamicInFilter(whereClauses, params, expression, bucket.selectedCodes, prefix, parser);
    };
    addExpandedCodes('territories', meta.territory ? columnExpr('opp', meta.territory) : '', 'pipelineTerritory');
    addExpandedCodes('sources', meta.source ? columnExpr('opp', meta.source) : '', 'pipelineSource');
    addExpandedCodes('industry', meta.industry ? columnExpr('opp', meta.industry) : '', 'pipelineIndustry');
    addExpandedCodes('levelOfInterest', meta.interestLevel ? columnExpr('opp', meta.interestLevel) : '', 'pipelineInterest');
    addExpandedCodes('project', meta.project ? columnExpr('opp', meta.project) : '', 'pipelineProject');
    addExpandedCodes('bpChannelCode', meta.channel ? `bp.${quoted(meta.channel)}` : '', 'pipelineChannel');

    const partnerSelection = expandedSelection?.partners || {};
    if (partnerSelection.enabled && meta.oppId && (await tableExists('OPR2', options))) {
      const opr2OppId = await firstColumn('OPR2', ['OpprId', 'OpprID'], options);
      const opr2Code = await firstColumn('OPR2', ['CardCode', 'PartnerCode', 'PrtCode'], options);
      if (opr2OppId && opr2Code && partnerSelection.selectedCodes?.length) {
        addDynamicInFilter(whereClauses, params, `partner.${quoted(opr2Code)}`, partnerSelection.selectedCodes, 'pipelinePartner');
        const filter = whereClauses.pop();
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR2 partner
            WHERE partner.${quoted(opr2OppId)} = ${columnExpr('opp', meta.oppId)}
              AND ${filter}
          )
        `);
      }
    }

    const competitorSelection = expandedSelection?.competitors || {};
    if (competitorSelection.enabled && meta.oppId && (await tableExists('OPR3', options))) {
      const opr3OppId = await firstColumn('OPR3', ['OpprId', 'OpprID'], options);
      const opr3Code = await firstColumn('OPR3', ['CompetId', 'CompCode', 'CardCode'], options);
      if (opr3OppId && opr3Code && competitorSelection.selectedCodes?.length) {
        addDynamicInFilter(whereClauses, params, `competitor.${quoted(opr3Code)}`, competitorSelection.selectedCodes, 'pipelineCompetitor');
        const filter = whereClauses.pop();
        whereClauses.push(`
          EXISTS (
            SELECT 1
            FROM OPR3 competitor
            WHERE competitor.${quoted(opr3OppId)} = ${columnExpr('opp', meta.oppId)}
              AND ${filter}
          )
        `);
      }
    }

    const amountExpression = meta.amount ? `ISNULL(${columnExpr('opp', meta.amount)}, 0)` : '0';
    const percentExpression = meta.percent ? `ISNULL(${columnExpr('opp', meta.percent)}, 0)` : '0';
    const weightedExpression = meta.weighted
      ? `ISNULL(${columnExpr('opp', meta.weighted)}, 0)`
      : `(${amountExpression} * ${percentExpression} / 100.0)`;
    const stageNameExpression = meta.oostName && stageCodeExpression
      ? `ISNULL(stg.${quoted(meta.oostName)}, CONVERT(NVARCHAR(255), ${stageCodeExpression}))`
      : (stageCodeExpression ? `CONVERT(NVARCHAR(255), ${stageCodeExpression})` : `''`);
    const stageOrderTextExpression = stageCodeExpression
      ? `LTRIM(RTRIM(CONVERT(NVARCHAR(50), ${stageCodeExpression})))`
      : "''";
    const stageOrderExpression = stageCodeExpression
      ? `CASE WHEN ${stageOrderTextExpression} <> '' AND ${stageOrderTextExpression} NOT LIKE '%[^0-9]%' THEN CAST(${stageOrderTextExpression} AS INT) ELSE 999999 END`
      : '0';

    const rows = await queryRows(
      `
        SELECT
          ${stageCodeExpression ? `CONVERT(NVARCHAR(100), ${stageCodeExpression})` : "''"} AS StageCode,
          ${stageNameExpression} AS StageName,
          ${meta.oppId ? `COUNT(DISTINCT ${columnExpr('opp', meta.oppId)})` : 'COUNT(1)'} AS OpportunityCount,
          CAST(SUM(CAST(${amountExpression} AS DECIMAL(19, 4))) AS DECIMAL(19, 2)) AS ExpectedTotal,
          CAST(SUM(CAST(${weightedExpression} AS DECIMAL(19, 4))) AS DECIMAL(19, 2)) AS WeightedAmount,
          CAST(AVG(CAST(${percentExpression} AS DECIMAL(19, 4))) AS DECIMAL(9, 2)) AS ClosingPercent
        FROM OOPR opp
        ${joins.join('\n        ')}
        ${whereClauses.length ? `WHERE ${whereClauses.join('\n          AND ')}` : ''}
        GROUP BY ${stageCodeExpression ? `CONVERT(NVARCHAR(100), ${stageCodeExpression}),` : ''} ${stageNameExpression}
        ORDER BY MIN(${stageOrderExpression}), StageName
      `,
      params,
      options,
    );

    const data = rows.map((row, index) => ({
      id: text(row.StageCode) || String(index + 1),
      description: text(row.StageName) || text(row.StageCode) || 'Undefined',
      no: Number(row.OpportunityCount || 0),
      expectedTotal: Number(row.ExpectedTotal || 0),
      weightedAmount: Number(row.WeightedAmount || 0),
      closingPercentage: Number(row.ClosingPercent || 0),
    }));
    const totals = data.reduce((acc, row) => ({
      no: acc.no + row.no,
      expectedTotal: acc.expectedTotal + row.expectedTotal,
      weightedAmount: acc.weightedAmount + row.weightedAmount,
    }), { no: 0, expectedTotal: 0, weightedAmount: 0 });

    return {
      success: true,
      data,
      totals,
      chart: data.map((row) => ({
        label: row.description,
        expectedTotal: row.expectedTotal,
        weightedAmount: row.weightedAmount,
        closingPercentage: row.closingPercentage,
      })),
      meta: {
        criteria,
        totalRecords: totals.no,
      },
    };
  } catch (error) {
    console.error('Error in getOpportunitiesPipelineReport:', error);
    return { success: false, error: error.message, data: [] };
  }
};

const getCrmStages = async (options = {}) => {
  const tableName = (await tableExists('OOST', options)) ? 'OOST' : 'OCSN';
  return buildSimpleLookup({
    tableName,
    codeCandidates: ['Num', 'StageKey', 'StageID'],
    nameCandidates: ['Name', 'StageName', 'Descript'],
    options,
  });
};

const getTerritories = async (options = {}) => {
  const fromMaster = await buildSimpleLookup({
    tableName: 'OTER',
    codeCandidates: ['territryID', 'TerritryID', 'TerritoryID'],
    nameCandidates: ['descript', 'Descr', 'Name'],
    options,
  });
  if (fromMaster.length) return fromMaster;
  const territoryColumn = await firstColumn('OOPR', ['Territory', 'TerritryID', 'TerritoryID'], options);
  return buildDistinctOpportunityLookup(territoryColumn, options);
};

const getIndustries = async (options = {}) => {
  const industryColumn = await firstColumn('OOPR', ['Industry', 'IndustryC', 'Industries'], options);
  return buildDistinctOpportunityLookup(industryColumn, options);
};

const getInterestLevels = async (options = {}) => {
  const interestColumn = await firstColumn('OOPR', ['IntrLevel', 'IntrstLvl', 'Interest', 'IntRate'], options);
  const rows = await buildDistinctOpportunityLookup(interestColumn, options);
  return normalizeInterestLevelRows(rows);
};

const getOpportunityStatuses = async (options = {}) => {
  const statusColumn = await firstColumn('OOPR', ['Status'], options);
  const rows = await buildDistinctOpportunityLookup(statusColumn, options);
  return normalizeOpportunityStatusRows(rows);
};

const getOpportunityForecastLookups = async (options = {}) => {
  const meta = await getOpportunityMetadata(options);
  if (!meta.hasOOPR) {
    return {
      stages: [],
      territories: [],
      industries: [],
      interestLevels: normalizeInterestLevelRows([]),
      statuses: normalizeOpportunityStatusRows([]),
      channelCodes: [],
      sources: [],
      partners: [],
      competitors: [],
      documents: [
        { value: 'quotation', label: 'Sales Quotation', code: 'quotation', name: 'Sales Quotation' },
        { value: 'order', label: 'Sales Order', code: 'order', name: 'Sales Order' },
      ],
      projects: [],
    };
  }

  const [stages, territories, industries, interestLevels, statuses, sources, projects] = await Promise.all([
    getCrmStages(options),
    getTerritories(options),
    getIndustries(options),
    getInterestLevels(options),
    getOpportunityStatuses(options),
    buildOpportunitySourceLookup(meta, options),
    meta.project
      ? buildSimpleLookup({
          tableName: 'OPRJ',
          codeCandidates: ['PrjCode', 'Project'],
          nameCandidates: ['PrjName', 'ProjectName', 'Name'],
          options,
        }).then((rows) => (rows.length ? rows : buildDistinctOpportunityLookup(meta.project, options)))
      : [],
  ]);

  return {
    stages,
    territories,
    industries,
    interestLevels: normalizeInterestLevelRows(interestLevels),
    statuses: normalizeOpportunityStatusRows(statuses),
    sources,
    projects,
    channelCodes: await getBpChannelCodeLookups(options),
    partners: await buildSimpleLookup({
      tableName: 'OPR2',
      codeCandidates: ['CardCode', 'PartnerCode', 'PrtCode'],
      nameCandidates: ['CardName', 'PartnerName', 'Name'],
      options,
    }),
    competitors: await buildSimpleLookup({
      tableName: 'OPR3',
      codeCandidates: ['CompetId', 'CompCode', 'CardCode'],
      nameCandidates: ['Name', 'CompName', 'CompetName'],
      options,
    }),
    documents: [
      { value: 'quotation', label: 'Sales Quotation', code: 'quotation', name: 'Sales Quotation' },
      { value: 'order', label: 'Sales Order', code: 'order', name: 'Sales Order' },
      { value: 'delivery', label: 'Delivery', code: 'delivery', name: 'Delivery' },
      { value: 'invoice', label: 'A/R Invoice', code: 'invoice', name: 'A/R Invoice' },
    ],
  };
};

module.exports = {
  getOpportunitiesForecastReport,
  getOpportunitiesForecastOverTimeReport,
  getInformationSourceDistributionOverTimeReport,
  getOpportunitiesStatisticsReport,
  getOpportunitiesReport,
  getOpportunitiesPipelineReport,
  getOpportunitiesStageAnalysisReport,
  getWonOpportunitiesReport,
  getLostOpportunitiesReport,
  getCrmStages,
  getTerritories,
  getIndustries,
  getInterestLevels,
  getOpportunityStatuses,
  getOpportunityForecastLookups,
};
