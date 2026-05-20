const db = require('./dbService');

const DOCUMENT_CONFIG = {
  invoices: {
    headerTable: 'OINV',
    lineTable: 'INV1',
    reportLabel: 'A/R Invoice',
    rowLabel: 'A/R Invoice',
    documentPrefix: 'IN',
  },
  orders: {
    headerTable: 'ORDR',
    lineTable: 'RDR1',
    reportLabel: 'Sales Order',
    rowLabel: 'Sales Order',
    documentPrefix: 'SO',
  },
  deliveryNotes: {
    headerTable: 'ODLN',
    lineTable: 'DLN1',
    reportLabel: 'Delivery',
    rowLabel: 'Delivery',
    documentPrefix: 'DN',
  },
};

const DATE_FIELD_MAP = {
  postingDate: 'doc.DocDate',
  dueDate: 'doc.DocDueDate',
  documentDate: 'doc.TaxDate',
};

const PERIOD_LABEL_MAP = {
  annual: 'Annual',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const QUARTER_ROMAN_MAP = ['I', 'II', 'III', 'IV'];

const normalizeDateInput = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const buildDateFilters = (dateRanges = {}, whereClauses = [], params = {}) => {
  Object.entries(DATE_FIELD_MAP).forEach(([key, fieldName]) => {
    const range = dateRanges?.[key];
    if (!range?.enabled) return;

    const fromDate = normalizeDateInput(range.from);
    const toDate = normalizeDateInput(range.to);

    if (fromDate) {
      const paramName = `${key}From`;
      whereClauses.push(`${fieldName} >= @${paramName}`);
      params[paramName] = fromDate;
    }

    if (toDate) {
      const paramName = `${key}To`;
      whereClauses.push(`${fieldName} <= @${paramName}`);
      params[paramName] = toDate;
    }
  });
};

const buildPropertyFilter = (propertyFilter = {}, whereClauses = [], alias = 'bp') => {
  const selectedNumbers = Array.isArray(propertyFilter?.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64)
    : [];

  if (propertyFilter?.ignoreProperties || !selectedNumbers.length) {
    return;
  }

  const selectedSet = new Set(selectedNumbers);
  const selectedClauses = selectedNumbers.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`);
  const linkOperator = propertyFilter?.linkMode === 'or' ? ' OR ' : ' AND ';

  whereClauses.push(`(${selectedClauses.join(linkOperator)})`);

  if (propertyFilter?.exactlyMatch) {
    const unselectedClauses = [];
    for (let index = 1; index <= 64; index += 1) {
      if (!selectedSet.has(index)) {
        unselectedClauses.push(`ISNULL(${alias}.QryGroup${index}, 'N') <> 'Y'`);
      }
    }

    if (unselectedClauses.length) {
      whereClauses.push(`(${unselectedClauses.join(' AND ')})`);
    }
  }
};

const getItemSalesAnalysisReport = async (criteria = {}, options = {}) => {
  const documentType = Object.prototype.hasOwnProperty.call(DOCUMENT_CONFIG, criteria?.documentType)
    ? criteria.documentType
    : 'invoices';
  const config = DOCUMENT_CONFIG[documentType];
  const itemSelection = criteria?.itemSelection || {};
  const whereClauses = [];
  const params = {};

  const codeFrom = String(itemSelection.codeFrom || '').trim();
  const codeTo = String(itemSelection.codeTo || '').trim();
  const groupFilter = String(itemSelection.group || '').trim();

  if (codeFrom) {
    whereClauses.push('line.ItemCode >= @itemCodeFrom');
    params.itemCodeFrom = codeFrom;
  }

  if (codeTo) {
    whereClauses.push('line.ItemCode <= @itemCodeTo');
    params.itemCodeTo = codeTo;
  }

  if (groupFilter && groupFilter !== '*' && groupFilter.toLowerCase() !== 'all') {
    if (/^\d+$/.test(groupFilter)) {
      whereClauses.push('ISNULL(itm.ItmsGrpCod, 0) = @itemGroupCode');
      params.itemGroupCode = Number(groupFilter);
    } else {
      whereClauses.push('grp.ItmsGrpNam = @itemGroupName');
      params.itemGroupName = groupFilter;
    }
  }

  buildDateFilters(criteria?.dateRanges || {}, whereClauses, params);
  buildPropertyFilter(itemSelection.propertyFilter, whereClauses, 'itm');

  const itemWhereSql = whereClauses.length ? whereClauses.join('\n        AND ') : '1 = 1';

  const baseDocsSql = documentType === 'invoices'
    ? `
        SELECT
          line.ItemCode,
          MAX(itm.ItemName) AS ItemName,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.Quantity, 0))
              ELSE 0
            END
            AS DECIMAL(19, 6)
          ) AS Quantity,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS SalesAmount
        FROM OINV doc
        INNER JOIN INV1 line
          ON line.DocEntry = doc.DocEntry
        INNER JOIN OITM itm
          ON itm.ItemCode = line.ItemCode
        LEFT JOIN OITB grp
          ON grp.ItmsGrpCod = itm.ItmsGrpCod
        WHERE ${itemWhereSql}
        GROUP BY
          line.ItemCode,
          doc.CANCELED

        UNION ALL

        SELECT
          line.ItemCode,
          MAX(itm.ItemName) AS ItemName,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN -SUM(ISNULL(line.Quantity, 0))
              ELSE 0
            END
            AS DECIMAL(19, 6)
          ) AS Quantity,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN -SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS SalesAmount
        FROM ORIN doc
        INNER JOIN RIN1 line
          ON line.DocEntry = doc.DocEntry
        INNER JOIN OITM itm
          ON itm.ItemCode = line.ItemCode
        LEFT JOIN OITB grp
          ON grp.ItmsGrpCod = itm.ItmsGrpCod
        WHERE ${itemWhereSql}
        GROUP BY
          line.ItemCode,
          doc.CANCELED
      `
    : `
        SELECT
          line.ItemCode,
          MAX(itm.ItemName) AS ItemName,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.Quantity, 0))
              ELSE 0
            END
            AS DECIMAL(19, 6)
          ) AS Quantity,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS SalesAmount
        FROM ${config.headerTable} doc
        INNER JOIN ${config.lineTable} line
          ON line.DocEntry = doc.DocEntry
        INNER JOIN OITM itm
          ON itm.ItemCode = line.ItemCode
        LEFT JOIN OITB grp
          ON grp.ItmsGrpCod = itm.ItmsGrpCod
        WHERE ${itemWhereSql}
        GROUP BY
          line.ItemCode,
          doc.CANCELED
      `;

  const result = await db.query(
    `
      WITH BaseDocs AS (
        ${baseDocsSql}
      )
      SELECT
        base.ItemCode,
        MAX(base.ItemName) AS ItemName,
        CAST(SUM(base.Quantity) AS DECIMAL(19, 6)) AS Quantity,
        CAST(SUM(base.SalesAmount) AS DECIMAL(19, 2)) AS SalesAmount
      FROM BaseDocs base
      GROUP BY
        base.ItemCode
      HAVING
        ABS(SUM(base.Quantity)) >= 0.0005
        OR ABS(SUM(base.SalesAmount)) >= 0.005
      ORDER BY
        base.ItemCode
    `,
    params,
    options,
  );

  const rows = (result.recordset || []).map((row, index) => ({
    rowNumber: index + 1,
    itemCode: String(row.ItemCode || '').trim(),
    itemName: String(row.ItemName || '').trim(),
    quantity: Number(row.Quantity || 0),
    salesAmount: Number(row.SalesAmount || 0),
  }));

  const totals = rows.reduce(
    (summary, row) => ({
      itemCount: summary.itemCount + 1,
      quantity: summary.quantity + row.quantity,
      salesAmount: summary.salesAmount + row.salesAmount,
    }),
    {
      itemCount: 0,
      quantity: 0,
      salesAmount: 0,
    },
  );

  return {
    reportKind: 'itemSummary',
    reportTitle: `Sales Analysis by Items (${PERIOD_LABEL_MAP[criteria?.periodType] || 'Annual'})`,
    reportSubtitle: 'Double-click on row number for a detailed display of all sales',
    currencyCode: criteria?.displayInSystemCurrency ? await loadSystemCurrencyCode(options) : '',
    rows,
    totals,
    appliedFilters: {
      documentType,
      periodType: criteria?.periodType || 'annual',
      displayMode: criteria?.displayMode || 'individual',
      itemTotals: criteria?.itemTotals || 'none',
      displayInSystemCurrency: Boolean(criteria?.displayInSystemCurrency),
    },
  };
};

const loadSystemCurrencyCode = async (options = {}) => {
  try {
    const result = await db.query(
      `
        SELECT TOP 1
          MainCurncy AS CurrencyCode
        FROM OADM
      `,
      {},
      options,
    );

    return String(result.recordset?.[0]?.CurrencyCode || '').trim();
  } catch (_error) {
    return '';
  }
};

const getAgreementDisplayValue = (agreementNo) => (
  Number(agreementNo || 0) > 0 ? String(Number(agreementNo)) : 'No Agreement'
);

const getPeriodBucketMeta = (postingDate, periodType) => {
  const date = new Date(postingDate);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const monthIndex = date.getMonth();

  if (periodType === 'monthly') {
    const monthNumber = String(monthIndex + 1).padStart(2, '0');
    const monthLabel = date.toLocaleString('en-US', { month: 'long' });

    return {
      key: `${year}-${monthNumber}`,
      label: `${monthLabel} (${year})`,
      sortValue: `${year}-${monthNumber}`,
    };
  }

  const quarterIndex = Math.floor(monthIndex / 3);
  return {
    key: `${year}-Q${quarterIndex + 1}`,
    label: `${QUARTER_ROMAN_MAP[quarterIndex]} (${year})`,
    sortValue: `${year}-Q${quarterIndex + 1}`,
  };
};

const getCustomerSalesAnalysisReport = async (criteria = {}, options = {}) => {
  const documentType = Object.prototype.hasOwnProperty.call(DOCUMENT_CONFIG, criteria?.documentType)
    ? criteria.documentType
    : 'invoices';
  const config = DOCUMENT_CONFIG[documentType];
  const displayMode = criteria?.displayMode === 'group' ? 'group' : 'individual';
  const customerTotals = criteria?.customerTotals === 'blanketAgreement'
    ? 'blanketAgreement'
    : 'customer';
  const includeAgreementGrouping = customerTotals === 'blanketAgreement';

  const whereClauses = [
    "bp.CardType = 'C'",
  ];

  const params = {};
  const customerSelection = criteria?.customerSelection || {};
  const codeFrom = String(customerSelection.codeFrom || '').trim();
  const codeTo = String(customerSelection.codeTo || '').trim();
  const groupFilter = String(customerSelection.group || '').trim();

  if (codeFrom) {
    whereClauses.push('doc.CardCode >= @codeFrom');
    params.codeFrom = codeFrom;
  }

  if (codeTo) {
    whereClauses.push('doc.CardCode <= @codeTo');
    params.codeTo = codeTo;
  }

  if (groupFilter && groupFilter.toLowerCase() !== 'all') {
    if (/^\d+$/.test(groupFilter)) {
      whereClauses.push('ISNULL(bp.GroupCode, 0) = @groupCode');
      params.groupCode = Number(groupFilter);
    } else {
      whereClauses.push('grp.GroupName = @groupName');
      params.groupName = groupFilter;
    }
  }

  buildDateFilters(criteria?.dateRanges || {}, whereClauses, params);
  buildPropertyFilter(customerSelection.propertyFilter, whereClauses);

  const customerWhereSql = whereClauses.join('\n          AND ');
  const agreementSql = includeAgreementGrouping
    ? "ISNULL(NULLIF(line.AgrNo, 0), ISNULL(doc.AgrNo, 0))"
    : '0';
  const baseExtraSelectSql = `
          CAST(ISNULL(bp.GroupCode, 0) AS INT) AS GroupCode,
          ISNULL(NULLIF(grp.GroupName, ''), 'Ungrouped') AS GroupName,
          CAST(${agreementSql} AS INT) AS AgreementNo,
  `;
  const baseExtraGroupSql = `
          ISNULL(bp.GroupCode, 0),
          ISNULL(NULLIF(grp.GroupName, ''), 'Ungrouped')${includeAgreementGrouping ? `,
          ${agreementSql}` : ''},
  `;
  const baseDocsSql = documentType === 'invoices'
    ? `
        SELECT
          doc.DocEntry,
          doc.DocDate AS PostingDate,
          doc.CardCode,
          doc.CardName,
${baseExtraSelectSql}
          CASE
            WHEN doc.CANCELED IN ('N', 'Y', 'C') THEN 1
            ELSE 0
          END AS DocumentCount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS DocumentTotal,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' AND doc.DocStatus = 'O'
                THEN SUM(ISNULL(line.OpenSum, 0)) + MAX(ISNULL(doc.RoundDif, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS OpenAmount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.GrssProfit, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS GrossProfit
        FROM OINV doc
        INNER JOIN INV1 line
          ON line.DocEntry = doc.DocEntry
        INNER JOIN OCRD bp
          ON bp.CardCode = doc.CardCode
        LEFT JOIN OCRG grp
          ON grp.GroupCode = bp.GroupCode
        WHERE ${customerWhereSql}
        GROUP BY
          doc.DocEntry,
          doc.DocDate,
          doc.CardCode,
          doc.CardName,
${baseExtraGroupSql}
          doc.CANCELED,
          doc.DocStatus

        UNION ALL

        SELECT
          doc.DocEntry,
          doc.DocDate AS PostingDate,
          doc.CardCode,
          doc.CardName,
${baseExtraSelectSql}
          CASE
            WHEN doc.CANCELED IN ('N', 'Y', 'C') THEN 1
            ELSE 0
          END AS DocumentCount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN -SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS DocumentTotal,
          CAST(0 AS DECIMAL(19, 2)) AS OpenAmount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN -SUM(ISNULL(line.GrssProfit, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS GrossProfit
        FROM ORIN doc
        INNER JOIN RIN1 line
          ON line.DocEntry = doc.DocEntry
        INNER JOIN OCRD bp
          ON bp.CardCode = doc.CardCode
        LEFT JOIN OCRG grp
          ON grp.GroupCode = bp.GroupCode
        WHERE ${customerWhereSql}
        GROUP BY
          doc.DocEntry,
          doc.DocDate,
          doc.CardCode,
          doc.CardName,
${baseExtraGroupSql}
          doc.CANCELED,
          doc.DocStatus
      `
    : `
        SELECT
          doc.DocEntry,
          doc.DocDate AS PostingDate,
          doc.CardCode,
          doc.CardName,
${baseExtraSelectSql}
          CASE
            WHEN doc.CANCELED IN ('N', 'Y', 'C') THEN 1
            ELSE 0
          END AS DocumentCount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS DocumentTotal,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' AND doc.DocStatus = 'O'
                THEN SUM(ISNULL(line.OpenSum, 0)) + MAX(ISNULL(doc.RoundDif, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS OpenAmount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.GrssProfit, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS GrossProfit
        FROM ${config.headerTable} doc
        INNER JOIN ${config.lineTable} line
          ON line.DocEntry = doc.DocEntry
        INNER JOIN OCRD bp
          ON bp.CardCode = doc.CardCode
        LEFT JOIN OCRG grp
          ON grp.GroupCode = bp.GroupCode
        WHERE ${customerWhereSql}
        GROUP BY
          doc.DocEntry,
          doc.DocDate,
          doc.CardCode,
          doc.CardName,
${baseExtraGroupSql}
          doc.CANCELED,
          doc.DocStatus
      `;

  const reportMode = `${displayMode}:${customerTotals}`;
  const reportModeConfigMap = {
    'individual:customer': {
      dimensionCodeLabel: 'Customer Code',
      dimensionNameLabel: 'Customer Name',
      dimensionCodeSql: 'base.CardCode',
      dimensionNameSql: 'MAX(base.CardName)',
      groupBySql: 'base.CardCode',
      orderBySql: 'MAX(base.CardName), base.CardCode',
      allowDetailDrilldown: true,
      allowBusinessPartnerLink: true,
    },
    'group:customer': {
      dimensionCodeLabel: 'Group Code',
      dimensionNameLabel: 'Group Name',
      dimensionCodeSql: "CAST(base.GroupCode AS VARCHAR(50))",
      dimensionNameSql: 'base.GroupName',
      groupBySql: 'base.GroupCode, base.GroupName',
      orderBySql: 'base.GroupName, base.GroupCode',
      allowDetailDrilldown: false,
      allowBusinessPartnerLink: false,
    },
    'individual:blanketAgreement': {
      dimensionCodeLabel: 'Agreement No.',
      dimensionNameLabel: 'Customer Name',
      dimensionCodeSql: "CASE WHEN ISNULL(base.AgreementNo, 0) = 0 THEN 'No Agreement' ELSE CAST(base.AgreementNo AS VARCHAR(50)) END",
      dimensionNameSql: "CASE WHEN COUNT(DISTINCT base.CardCode) = 1 THEN MAX(base.CardName) ELSE 'Multiple Customers' END",
      groupBySql: 'base.AgreementNo',
      orderBySql: 'base.AgreementNo, MAX(base.CardName)',
      allowDetailDrilldown: false,
      allowBusinessPartnerLink: true,
    },
    'group:blanketAgreement': {
      dimensionCodeLabel: 'Agreement No.',
      dimensionNameLabel: 'Group Name',
      dimensionCodeSql: "CASE WHEN ISNULL(base.AgreementNo, 0) = 0 THEN 'No Agreement' ELSE CAST(base.AgreementNo AS VARCHAR(50)) END",
      dimensionNameSql: 'base.GroupName',
      groupBySql: 'base.AgreementNo, base.GroupCode, base.GroupName',
      orderBySql: 'base.GroupName, base.AgreementNo',
      allowDetailDrilldown: false,
      allowBusinessPartnerLink: false,
    },
  };
  const reportModeConfig = reportModeConfigMap[reportMode] || reportModeConfigMap['individual:customer'];

  if ((criteria?.periodType || 'annual') !== 'annual') {
    const periodRowsResult = await db.query(
      `
        WITH BaseDocs AS (
          ${baseDocsSql}
        )
        SELECT
          base.PostingDate,
          base.CardCode,
          base.CardName,
          base.GroupCode,
          base.GroupName,
          base.AgreementNo,
          CAST(SUM(base.DocumentTotal) AS DECIMAL(19, 2)) AS totalAmount
        FROM BaseDocs base
        GROUP BY
          base.PostingDate,
          base.CardCode,
          base.CardName,
          base.GroupCode,
          base.GroupName,
          base.AgreementNo
        ORDER BY
          base.PostingDate,
          base.CardName,
          base.CardCode
      `,
      params,
      options,
    );

    const periodColumnsMap = new Map();
    const groupedRowsMap = new Map();
    const annualTotalsByPeriod = {};
    let annualGrandTotal = 0;

    (periodRowsResult.recordset || []).forEach((row) => {
      const periodMeta = getPeriodBucketMeta(row.PostingDate, criteria?.periodType || 'monthly');
      if (!periodMeta) {
        return;
      }

      if (!periodColumnsMap.has(periodMeta.key)) {
        periodColumnsMap.set(periodMeta.key, periodMeta);
      }

      const customerCode = String(row.CardCode || '').trim();
      const customerName = String(row.CardName || '').trim();
      const groupCode = Number(row.GroupCode || 0);
      const groupName = String(row.GroupName || '').trim() || 'Ungrouped';
      const agreementNo = Number(row.AgreementNo || 0);
      const amount = Number(row.totalAmount || 0);

      let rowKey = '';
      let code = '';
      let name = '';
      let canOpenDetail = false;
      let canOpenBusinessPartner = false;
      let singleCustomerCode = '';
      let singleCustomerName = '';

      if (reportMode === 'individual:customer') {
        rowKey = `customer:${customerCode}`;
        code = customerCode;
        name = customerName;
        canOpenDetail = true;
        canOpenBusinessPartner = true;
        singleCustomerCode = customerCode;
        singleCustomerName = customerName;
      } else if (reportMode === 'group:customer') {
        rowKey = `group:${groupCode}`;
        code = String(groupCode);
        name = groupName;
      } else if (reportMode === 'individual:blanketAgreement') {
        rowKey = `agreement:${agreementNo}`;
        code = getAgreementDisplayValue(agreementNo);
        name = customerName;
        canOpenBusinessPartner = true;
        singleCustomerCode = customerCode;
        singleCustomerName = customerName;
      } else {
        rowKey = `group-agreement:${groupCode}:${agreementNo}`;
        code = getAgreementDisplayValue(agreementNo);
        name = groupName;
      }

      const existingRow = groupedRowsMap.get(rowKey) || {
        rowKey,
        code,
        name,
        customerCode: singleCustomerCode,
        customerName: singleCustomerName,
        groupCode,
        groupName,
        agreementNo,
        annualTotal: 0,
        periodValues: {},
        canOpenDetail,
        canOpenBusinessPartner,
        _customerCodes: new Set(singleCustomerCode ? [singleCustomerCode] : []),
        _customerNames: new Set(singleCustomerName ? [singleCustomerName] : []),
      };

      existingRow.annualTotal += amount;
      existingRow.periodValues[periodMeta.key] = (existingRow.periodValues[periodMeta.key] || 0) + amount;

      if (customerCode) {
        existingRow._customerCodes.add(customerCode);
      }
      if (customerName) {
        existingRow._customerNames.add(customerName);
      }

      if (reportMode === 'individual:blanketAgreement') {
        if (existingRow._customerCodes.size > 1) {
          existingRow.customerCode = '';
          existingRow.customerName = '';
          existingRow.name = 'Multiple Customers';
          existingRow.canOpenBusinessPartner = false;
        } else {
          existingRow.customerCode = customerCode;
          existingRow.customerName = customerName;
          existingRow.name = customerName;
          existingRow.canOpenBusinessPartner = true;
        }
      }

      groupedRowsMap.set(rowKey, existingRow);
      annualGrandTotal += amount;
      annualTotalsByPeriod[periodMeta.key] = (annualTotalsByPeriod[periodMeta.key] || 0) + amount;
    });

    const periodColumns = [...periodColumnsMap.values()]
      .sort((left, right) => left.sortValue.localeCompare(right.sortValue))
      .map(({ key, label }) => ({ key, label }));

    const rows = [...groupedRowsMap.values()]
      .filter((row) => {
        const annualTotal = Number(row.annualTotal || 0);
        const hasNonZeroAnnualTotal = Math.abs(annualTotal) >= 0.005;

        if (hasNonZeroAnnualTotal) {
          return true;
        }

        return Object.values(row.periodValues || {}).some(
          (value) => Math.abs(Number(value || 0)) >= 0.005,
        );
      })
      .sort((left, right) => {
        const nameCompare = String(left.name || '').localeCompare(String(right.name || ''));
        if (nameCompare !== 0) return nameCompare;
        return String(left.code || '').localeCompare(String(right.code || ''), undefined, { numeric: true });
      })
      .map((row, index) => ({
        rowNumber: index + 1,
        code: row.code,
        name: row.name,
        customerCode: row.customerCode,
        customerName: row.customerName,
        groupCode: row.groupCode,
        groupName: row.groupName,
        agreementNo: row.agreementNo,
        annualTotal: row.annualTotal,
        periodValues: row.periodValues,
        canOpenDetail: row.canOpenDetail,
        canOpenBusinessPartner: row.canOpenBusinessPartner,
      }));

    return {
      reportLayout: 'period',
      reportTitle: `Sales Analysis by Customer (${PERIOD_LABEL_MAP[criteria?.periodType] || 'Monthly'})`,
      reportSubtitle: reportModeConfig.allowDetailDrilldown
        ? 'Double-click on row number for a detailed display of all sales'
        : 'The current grouping is based on the selected radio button criteria.',
      rowLabel: config.rowLabel,
      dimensionCodeLabel: reportModeConfig.dimensionCodeLabel,
      dimensionNameLabel: reportModeConfig.dimensionNameLabel,
      annualTotalLabel: 'Annual Total',
      periodColumns,
      allowDetailDrilldown: reportModeConfig.allowDetailDrilldown,
      allowBusinessPartnerLink: reportModeConfig.allowBusinessPartnerLink,
      currencyCode: criteria?.displayInSystemCurrency ? await loadSystemCurrencyCode(options) : '',
      rows,
      totals: {
        rowCount: rows.length,
        annualTotal: annualGrandTotal,
        periodTotals: annualTotalsByPeriod,
      },
      appliedFilters: {
        documentType,
        periodType: criteria?.periodType || 'monthly',
        displayMode,
        customerTotals,
        displayInSystemCurrency: Boolean(criteria?.displayInSystemCurrency),
      },
    };
  }

  const result = await db.query(
    `
      WITH BaseDocs AS (
        ${baseDocsSql}
      )
      SELECT
        ${reportModeConfig.dimensionCodeSql} AS dimensionCode,
        ${reportModeConfig.dimensionNameSql} AS dimensionName,
        CASE
          WHEN COUNT(DISTINCT base.CardCode) = 1 THEN MAX(base.CardCode)
          ELSE ''
        END AS customerCode,
        CASE
          WHEN COUNT(DISTINCT base.CardCode) = 1 THEN MAX(base.CardName)
          ELSE ''
        END AS customerName,
        MAX(base.GroupName) AS groupName,
        MAX(base.GroupCode) AS groupCode,
        MAX(base.AgreementNo) AS agreementNo,
        SUM(base.DocumentCount) AS documentCount,
        CAST(SUM(base.DocumentTotal) AS DECIMAL(19, 2)) AS totalAmount,
        CAST(SUM(base.GrossProfit) AS DECIMAL(19, 2)) AS grossProfit,
        CAST(
          CASE
            WHEN SUM(base.DocumentTotal) = 0 THEN 0
            ELSE (SUM(base.GrossProfit) * 100.0) / SUM(base.DocumentTotal)
          END
          AS DECIMAL(19, 3)
        ) AS grossProfitPercent,
        CAST(SUM(base.OpenAmount) AS DECIMAL(19, 2)) AS openAmount
      FROM BaseDocs base
      GROUP BY ${reportModeConfig.groupBySql}
      ORDER BY ${reportModeConfig.orderBySql}
    `,
    params,
    options,
  );

  const rows = (result.recordset || []).map((row, index) => ({
    rowNumber: index + 1,
    code: String(row.dimensionCode || '').trim(),
    name: String(row.dimensionName || '').trim(),
    customerCode: String(row.customerCode || '').trim(),
    customerName: String(row.customerName || '').trim(),
    groupCode: Number(row.groupCode || 0),
    groupName: String(row.groupName || '').trim(),
    agreementNo: Number(row.agreementNo || 0),
    documentCount: Number(row.documentCount || 0),
    totalAmount: Number(row.totalAmount || 0),
    grossProfit: Number(row.grossProfit || 0),
    grossProfitPercent: Number(row.grossProfitPercent || 0),
    openAmount: Number(row.openAmount || 0),
    canOpenDetail: reportModeConfig.allowDetailDrilldown,
    canOpenBusinessPartner: reportModeConfig.allowBusinessPartnerLink && Boolean(String(row.customerCode || '').trim()),
  }));

  const totals = rows.reduce(
    (summary, row) => ({
      customerCount: summary.customerCount + 1,
      documentCount: summary.documentCount + row.documentCount,
      totalAmount: summary.totalAmount + row.totalAmount,
      grossProfit: summary.grossProfit + row.grossProfit,
      openAmount: summary.openAmount + row.openAmount,
    }),
    {
      customerCount: 0,
      documentCount: 0,
      totalAmount: 0,
      grossProfit: 0,
      openAmount: 0,
    },
  );

  totals.grossProfitPercent = totals.totalAmount
    ? (totals.grossProfit * 100) / totals.totalAmount
    : 0;

  return {
    reportTitle: `Sales Analysis by Customer (${PERIOD_LABEL_MAP[criteria?.periodType] || 'Annual'})`,
    reportSubtitle: reportModeConfig.allowDetailDrilldown
      ? 'Double-click on row number for a detailed report'
      : 'The current grouping is based on the selected radio button criteria.',
    rowLabel: config.rowLabel,
    dimensionCodeLabel: reportModeConfig.dimensionCodeLabel,
    dimensionNameLabel: reportModeConfig.dimensionNameLabel,
    allowDetailDrilldown: reportModeConfig.allowDetailDrilldown,
    allowBusinessPartnerLink: reportModeConfig.allowBusinessPartnerLink,
    currencyCode: criteria?.displayInSystemCurrency ? await loadSystemCurrencyCode(options) : '',
    rows,
    totals,
    appliedFilters: {
      documentType,
      periodType: criteria?.periodType || 'annual',
      displayMode,
      customerTotals,
      displayInSystemCurrency: Boolean(criteria?.displayInSystemCurrency),
    },
  };
};

const getCustomerSalesAnalysisDetailReport = async (criteria = {}, customerCode = '', options = {}) => {
  const documentType = Object.prototype.hasOwnProperty.call(DOCUMENT_CONFIG, criteria?.documentType)
    ? criteria.documentType
    : 'invoices';
  const config = DOCUMENT_CONFIG[documentType];
  const normalizedCustomerCode = String(customerCode || '').trim();

  if (!normalizedCustomerCode) {
    throw new Error('Customer code is required to load the detailed sales analysis report.');
  }

  const whereClauses = [
    "bp.CardType = 'C'",
    'doc.CardCode = @customerCode',
  ];

  const params = {
    customerCode: normalizedCustomerCode,
  };

  const customerSelection = {
    ...(criteria?.customerSelection || {}),
    codeFrom: normalizedCustomerCode,
  };

  buildDateFilters(criteria?.dateRanges || {}, whereClauses, params);
  buildPropertyFilter(customerSelection.propertyFilter, whereClauses);

  const result = await db.query(
    `
      SELECT
        doc.DocEntry,
        doc.DocNum,
        doc.DocDate AS PostingDate,
        doc.DocDueDate AS DueDate,
        doc.CardCode,
        doc.CardName,
        doc.CANCELED,
        doc.DocStatus,
        1 AS InstallmentNo,
        1 AS InstallmentCount,
        CAST(
          CASE
            WHEN doc.CANCELED = 'C' THEN -SUM(ISNULL(line.LineTotal, 0))
            ELSE SUM(ISNULL(line.LineTotal, 0))
          END
          AS DECIMAL(19, 2)
        ) AS SalesAmount,
        CAST(
          CASE
            WHEN doc.CANCELED = 'C' THEN -(SUM(ISNULL(line.LineTotal, 0)) + MAX(ISNULL(doc.RoundDif, 0)))
            ELSE SUM(ISNULL(line.LineTotal, 0)) + MAX(ISNULL(doc.RoundDif, 0))
          END
          AS DECIMAL(19, 2)
        ) AS AppliedAmount,
        CAST(
          CASE
            WHEN doc.CANCELED = 'C' THEN -SUM(ISNULL(line.GrssProfit, 0))
            ELSE SUM(ISNULL(line.GrssProfit, 0))
          END
          AS DECIMAL(19, 2)
        ) AS GrossProfit
      FROM ${config.headerTable} doc
      INNER JOIN ${config.lineTable} line
        ON line.DocEntry = doc.DocEntry
      INNER JOIN OCRD bp
        ON bp.CardCode = doc.CardCode
      LEFT JOIN OCRG grp
        ON grp.GroupCode = bp.GroupCode
      WHERE ${whereClauses.join('\n        AND ')}
      GROUP BY
        doc.DocEntry,
        doc.DocNum,
        doc.DocDate,
        doc.DocDueDate,
        doc.CardCode,
        doc.CardName,
        doc.CANCELED,
        doc.DocStatus
      ORDER BY
        CASE WHEN doc.CANCELED = 'C' THEN 1 ELSE 0 END,
        doc.DocDate,
        doc.DocNum
    `,
    params,
    options,
  );

  const rows = (result.recordset || []).map((row, index) => {
    const salesAmount = Number(row.SalesAmount || 0);
    const appliedAmount = Number(row.AppliedAmount || 0);
    const grossProfit = Number(row.GrossProfit || 0);
    const grossProfitPercent = salesAmount
      ? (grossProfit * 100) / Math.abs(salesAmount)
      : 0;

    return {
      rowNumber: index + 1,
      docEntry: Number(row.DocEntry || 0) || null,
      docNum: Number(row.DocNum || 0) || null,
      document: `${config.documentPrefix} ${String(row.DocNum || '').trim()}`,
      installment: `${Number(row.InstallmentNo || 1)} of ${Number(row.InstallmentCount || 1)}`,
      postingDate: row.PostingDate || null,
      dueDate: row.DueDate || null,
      customerCode: String(row.CardCode || '').trim(),
      customerName: String(row.CardName || '').trim(),
      salesAmount,
      appliedAmount,
      grossProfit,
      grossProfitPercent,
      agreementNumber: '',
    };
  });

  const totals = rows.reduce(
    (summary, row) => ({
      salesAmount: summary.salesAmount + row.salesAmount,
      appliedAmount: summary.appliedAmount + row.appliedAmount,
      grossProfit: summary.grossProfit + row.grossProfit,
    }),
    {
      salesAmount: 0,
      appliedAmount: 0,
      grossProfit: 0,
    },
  );

  totals.grossProfitPercent = totals.salesAmount
    ? (totals.grossProfit * 100) / Math.abs(totals.salesAmount)
    : 0;

  return {
    reportTitle: 'Sales Analysis Report by Customer (Detailed)',
    reportSubtitle: 'Double-click on row number for a detailed report',
    currencyCode: criteria?.displayInSystemCurrency ? await loadSystemCurrencyCode(options) : '',
    rows,
    totals,
    customerCode: normalizedCustomerCode,
    customerName: rows[0]?.customerName || '',
    documentType,
    periodType: criteria?.periodType || 'annual',
  };
};

const getSalesEmployeeSalesAnalysisReport = async (criteria = {}, options = {}) => {
  const documentType = Object.prototype.hasOwnProperty.call(DOCUMENT_CONFIG, criteria?.documentType)
    ? criteria.documentType
    : 'invoices';
  const config = DOCUMENT_CONFIG[documentType];
  const selection = criteria?.salesEmployeeSelection || {};
  const whereClauses = [];
  const params = {};
  const codeFrom = String(selection.codeFrom || '').trim();
  const codeTo = String(selection.codeTo || '').trim();
  const includeInactive = Boolean(selection.includeInactive);

  if (codeFrom && /^-?\d+$/.test(codeFrom)) {
    whereClauses.push('ISNULL(doc.SlpCode, -1) >= @slpCodeFrom');
    params.slpCodeFrom = Number(codeFrom);
  }

  if (codeTo && /^-?\d+$/.test(codeTo)) {
    whereClauses.push('ISNULL(doc.SlpCode, -1) <= @slpCodeTo');
    params.slpCodeTo = Number(codeTo);
  }

  if (!includeInactive) {
    whereClauses.push("(ISNULL(slp.Active, 'Y') = 'Y' OR ISNULL(doc.SlpCode, -1) < 0)");
  }

  buildDateFilters(criteria?.dateRanges || {}, whereClauses, params);

  const salesEmployeeWhereSql = whereClauses.length ? whereClauses.join('\n        AND ') : '1 = 1';
  const salesEmployeeSelectSql = `
          CAST(ISNULL(doc.SlpCode, -1) AS INT) AS SalesEmployeeCode,
          CASE
            WHEN ISNULL(doc.SlpCode, -1) < 0 THEN '-No Sales Employee -'
            ELSE ISNULL(NULLIF(slp.SlpName, ''), '-No Sales Employee -')
          END AS SalesEmployeeName,
  `;
  const salesEmployeeGroupSql = `
          ISNULL(doc.SlpCode, -1),
          CASE
            WHEN ISNULL(doc.SlpCode, -1) < 0 THEN '-No Sales Employee -'
            ELSE ISNULL(NULLIF(slp.SlpName, ''), '-No Sales Employee -')
          END,
  `;

  const baseDocsSql = documentType === 'invoices'
    ? `
        SELECT
          doc.DocEntry,
${salesEmployeeSelectSql}
          CASE
            WHEN doc.CANCELED IN ('N', 'Y', 'C') THEN 1
            ELSE 0
          END AS DocumentCount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS DocumentTotal,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' AND doc.DocStatus = 'O'
                THEN SUM(ISNULL(line.OpenSum, 0)) + MAX(ISNULL(doc.RoundDif, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS OpenAmount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.GrssProfit, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS GrossProfit
        FROM OINV doc
        INNER JOIN INV1 line
          ON line.DocEntry = doc.DocEntry
        LEFT JOIN OSLP slp
          ON slp.SlpCode = doc.SlpCode
        WHERE ${salesEmployeeWhereSql}
        GROUP BY
          doc.DocEntry,
${salesEmployeeGroupSql}
          doc.CANCELED,
          doc.DocStatus

        UNION ALL

        SELECT
          doc.DocEntry,
${salesEmployeeSelectSql}
          CASE
            WHEN doc.CANCELED IN ('N', 'Y', 'C') THEN 1
            ELSE 0
          END AS DocumentCount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN -SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS DocumentTotal,
          CAST(0 AS DECIMAL(19, 2)) AS OpenAmount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN -SUM(ISNULL(line.GrssProfit, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS GrossProfit
        FROM ORIN doc
        INNER JOIN RIN1 line
          ON line.DocEntry = doc.DocEntry
        LEFT JOIN OSLP slp
          ON slp.SlpCode = doc.SlpCode
        WHERE ${salesEmployeeWhereSql}
        GROUP BY
          doc.DocEntry,
${salesEmployeeGroupSql}
          doc.CANCELED,
          doc.DocStatus
      `
    : `
        SELECT
          doc.DocEntry,
${salesEmployeeSelectSql}
          CASE
            WHEN doc.CANCELED IN ('N', 'Y', 'C') THEN 1
            ELSE 0
          END AS DocumentCount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.LineTotal, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS DocumentTotal,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' AND doc.DocStatus = 'O'
                THEN SUM(ISNULL(line.OpenSum, 0)) + MAX(ISNULL(doc.RoundDif, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS OpenAmount,
          CAST(
            CASE
              WHEN doc.CANCELED = 'N' THEN SUM(ISNULL(line.GrssProfit, 0))
              ELSE 0
            END
            AS DECIMAL(19, 2)
          ) AS GrossProfit
        FROM ${config.headerTable} doc
        INNER JOIN ${config.lineTable} line
          ON line.DocEntry = doc.DocEntry
        LEFT JOIN OSLP slp
          ON slp.SlpCode = doc.SlpCode
        WHERE ${salesEmployeeWhereSql}
        GROUP BY
          doc.DocEntry,
${salesEmployeeGroupSql}
          doc.CANCELED,
          doc.DocStatus
      `;

  const result = await db.query(
    `
      WITH BaseDocs AS (
        ${baseDocsSql}
      )
      SELECT
        base.SalesEmployeeCode,
        base.SalesEmployeeName,
        SUM(base.DocumentCount) AS DocumentCount,
        CAST(SUM(base.DocumentTotal) AS DECIMAL(19, 2)) AS TotalAmount,
        CAST(SUM(base.GrossProfit) AS DECIMAL(19, 2)) AS GrossProfit,
        CAST(
          CASE
            WHEN SUM(base.DocumentTotal) = 0 THEN 0
            ELSE (SUM(base.GrossProfit) * 100.0) / SUM(base.DocumentTotal)
          END
          AS DECIMAL(19, 3)
        ) AS GrossProfitPercent,
        CAST(SUM(base.OpenAmount) AS DECIMAL(19, 2)) AS OpenAmount
      FROM BaseDocs base
      GROUP BY
        base.SalesEmployeeCode,
        base.SalesEmployeeName
      ORDER BY
        CASE WHEN base.SalesEmployeeCode < 0 THEN 0 ELSE 1 END,
        base.SalesEmployeeName,
        base.SalesEmployeeCode
    `,
    params,
    options,
  );

  const rows = (result.recordset || []).map((row, index) => ({
    rowNumber: index + 1,
    salesEmployeeCode: Number(row.SalesEmployeeCode ?? -1),
    salesEmployeeName: String(row.SalesEmployeeName || '').trim(),
    documentCount: Number(row.DocumentCount || 0),
    totalAmount: Number(row.TotalAmount || 0),
    grossProfit: Number(row.GrossProfit || 0),
    grossProfitPercent: Number(row.GrossProfitPercent || 0),
    openAmount: Number(row.OpenAmount || 0),
  }));

  const totals = rows.reduce(
    (summary, row) => ({
      salesEmployeeCount: summary.salesEmployeeCount + 1,
      documentCount: summary.documentCount + row.documentCount,
      totalAmount: summary.totalAmount + row.totalAmount,
      grossProfit: summary.grossProfit + row.grossProfit,
      openAmount: summary.openAmount + row.openAmount,
    }),
    {
      salesEmployeeCount: 0,
      documentCount: 0,
      totalAmount: 0,
      grossProfit: 0,
      openAmount: 0,
    },
  );

  totals.grossProfitPercent = totals.totalAmount
    ? (totals.grossProfit * 100) / totals.totalAmount
    : 0;

  return {
    reportKind: 'salesEmployeeSummary',
    reportTitle: `Sales Analysis by Sales Employee (${PERIOD_LABEL_MAP[criteria?.periodType] || 'Annual'})`,
    reportSubtitle: 'The report is based on the selected Sales Employee range and date filters.',
    rowLabel: config.rowLabel,
    allowDetailDrilldown: false,
    currencyCode: criteria?.displayInSystemCurrency ? await loadSystemCurrencyCode(options) : '',
    rows,
    totals,
    appliedFilters: {
      documentType,
      periodType: criteria?.periodType || 'annual',
      includeInactive,
      displayInSystemCurrency: Boolean(criteria?.displayInSystemCurrency),
    },
  };
};

module.exports = {
  getCustomerSalesAnalysisReport,
  getCustomerSalesAnalysisDetailReport,
  getItemSalesAnalysisReport,
  getSalesEmployeeSalesAnalysisReport,
};
