const db = require('./dbService');

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDate = (value) => {
  if (!value) return new Date().toISOString().split('T')[0];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).split('T')[0] : date.toISOString().split('T')[0];
};

const queryRows = async (sql, params = {}) => {
  const result = await db.query(sql, params);
  return result.recordset || [];
};

const safeRows = async (sql, params = {}) => {
  try {
    return await queryRows(sql, params);
  } catch (error) {
    console.error('[JournalEntry] SQL fallback:', error.message);
    return [];
  }
};

const getTableShape = async () => {
  const rows = await safeRows(`
    SELECT
      OBJECT_ID('OJDT', 'U') AS HeaderObjectId,
      OBJECT_ID('JDT1', 'U') AS LineObjectId,
      COL_LENGTH('OJDT', 'Origin') AS HeaderOriginColumn,
      COL_LENGTH('OJDT', 'OriginNo') AS HeaderOriginNoColumn,
      COL_LENGTH('OJDT', 'CreatedAt') AS HeaderCreatedAtColumn,
      COL_LENGTH('JDT1', 'LineId') AS LineIdentityColumn,
      COL_LENGTH('JDT1', 'AccountName') AS LineAccountNameColumn
  `);
  return rows[0] || {};
};

const ensureJournalTables = async () => {
  await db.query(`
    IF OBJECT_ID('OJDT', 'U') IS NULL
    BEGIN
      CREATE TABLE OJDT(
        TransId INT IDENTITY PRIMARY KEY,
        Number INT,
        Series NVARCHAR(20),
        RefDate DATE,
        DueDate DATE,
        TaxDate DATE,
        Memo NVARCHAR(254),
        Origin NVARCHAR(50),
        OriginNo INT,
        CreatedAt DATETIME DEFAULT GETDATE()
      )
    END

    IF OBJECT_ID('JDT1', 'U') IS NULL
    BEGIN
      CREATE TABLE JDT1(
        LineId INT IDENTITY PRIMARY KEY,
        TransId INT,
        Account NVARCHAR(30),
        AccountName NVARCHAR(200),
        Debit DECIMAL(19,6),
        Credit DECIMAL(19,6),
        Project NVARCHAR(50),
        ProfitCenter NVARCHAR(50),
        Location NVARCHAR(50),
        Remarks NVARCHAR(250)
      )
    END
  `);

  return getTableShape();
};

const canPersistToShadowJournal = (shape) => (
  shape?.HeaderOriginColumn != null &&
  shape?.HeaderOriginNoColumn != null &&
  shape?.HeaderCreatedAtColumn != null &&
  shape?.LineIdentityColumn != null &&
  shape?.LineAccountNameColumn != null
);

const columnExpr = (shape, key, tableAlias, column, fallback = "''") => (
  shape?.[key] != null ? `${tableAlias}.${column}` : fallback
);

const coalesceExpr = (parts, fallback = "''") => {
  const expressions = parts.filter(Boolean);
  if (!expressions.length) return fallback;
  if (expressions.length === 1) return expressions[0];
  return `COALESCE(${expressions.join(', ')})`;
};

const getPostedJournalShape = async () => {
  const rows = await safeRows(`
    SELECT
      COL_LENGTH('OJDT', 'Series') AS HeaderSeriesColumn,
      COL_LENGTH('OJDT', 'Number') AS HeaderNumberColumn,
      COL_LENGTH('OJDT', 'RefDate') AS HeaderRefDateColumn,
      COL_LENGTH('OJDT', 'DueDate') AS HeaderDueDateColumn,
      COL_LENGTH('OJDT', 'TaxDate') AS HeaderTaxDateColumn,
      COL_LENGTH('OJDT', 'Memo') AS HeaderMemoColumn,
      COL_LENGTH('OJDT', 'Ref1') AS HeaderRef1Column,
      COL_LENGTH('OJDT', 'Ref2') AS HeaderRef2Column,
      COL_LENGTH('OJDT', 'Ref3') AS HeaderRef3Column,
      COL_LENGTH('JDT1', 'Line_ID') AS LineIdColumn,
      COL_LENGTH('JDT1', 'Account') AS LineAccountColumn,
      COL_LENGTH('JDT1', 'ShortName') AS LineShortNameColumn,
      COL_LENGTH('JDT1', 'Debit') AS LineDebitColumn,
      COL_LENGTH('JDT1', 'Credit') AS LineCreditColumn,
      COL_LENGTH('JDT1', 'TaxCode') AS LineTaxCodeColumn,
      COL_LENGTH('JDT1', 'LineMemo') AS LineMemoColumn,
      COL_LENGTH('JDT1', 'Project') AS LineProjectColumn,
      COL_LENGTH('JDT1', 'LocCode') AS LineLocCodeColumn,
      COL_LENGTH('JDT1', 'Location') AS LineLocationColumn,
      COL_LENGTH('JDT1', 'ProfitCode') AS LineProfitCodeColumn,
      COL_LENGTH('JDT1', 'OcrCode') AS LineOcrCodeColumn,
      OBJECT_ID('OLCT', 'U') AS LocationMasterObjectId,
      COL_LENGTH('OLCT', 'Code') AS LocationMasterCodeColumn,
      COL_LENGTH('OLCT', 'Location') AS LocationMasterNameColumn
  `);
  return rows[0] || {};
};

const getPostedJournal = async ({
  transId,
  origin = 'Service A/R Invoice',
  originNo = null,
  reference2 = '',
}) => {
  const id = toNumber(transId);
  if (!id) return null;

  const shape = await getPostedJournalShape();
  if (shape.HeaderNumberColumn == null || shape.LineAccountColumn == null) return null;

  const headerRows = await safeRows(`
    SELECT TOP 1
      T0.TransId,
      ${columnExpr(shape, 'HeaderSeriesColumn', 'T0', 'Series', 'NULL')} AS Series,
      NNM.SeriesName,
      ${columnExpr(shape, 'HeaderNumberColumn', 'T0', 'Number', 'NULL')} AS Number,
      ${columnExpr(shape, 'HeaderRefDateColumn', 'T0', 'RefDate', 'NULL')} AS RefDate,
      ${columnExpr(shape, 'HeaderDueDateColumn', 'T0', 'DueDate', 'NULL')} AS DueDate,
      ${columnExpr(shape, 'HeaderTaxDateColumn', 'T0', 'TaxDate', 'NULL')} AS TaxDate,
      ${columnExpr(shape, 'HeaderMemoColumn', 'T0', 'Memo', "''")} AS Memo,
      ${columnExpr(shape, 'HeaderRef1Column', 'T0', 'Ref1', "''")} AS Ref1,
      ${columnExpr(shape, 'HeaderRef2Column', 'T0', 'Ref2', "''")} AS Ref2,
      ${columnExpr(shape, 'HeaderRef3Column', 'T0', 'Ref3', "''")} AS Ref3
    FROM OJDT T0
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '30' AND NNM.Series = ${columnExpr(shape, 'HeaderSeriesColumn', 'T0', 'Series', 'NULL')}
    WHERE T0.TransId = @transId
  `, { transId: id });

  const header = headerRows[0];
  if (!header) return null;

  const accountExpr = shape.LineShortNameColumn != null
    ? 'COALESCE(NULLIF(T1.ShortName, \'\'), T1.Account)'
    : 'T1.Account';
  const profitCenterExpr = coalesceExpr([
    shape.LineProfitCodeColumn != null ? 'NULLIF(CAST(T1.ProfitCode AS NVARCHAR(50)), \'\')' : null,
    shape.LineOcrCodeColumn != null ? 'NULLIF(CAST(T1.OcrCode AS NVARCHAR(50)), \'\')' : null,
  ]);
  const canJoinLocationMaster = (
    (shape.LineLocCodeColumn != null || shape.LineLocationColumn != null) &&
    shape.LocationMasterObjectId != null &&
    shape.LocationMasterCodeColumn != null &&
    shape.LocationMasterNameColumn != null
  );
  const locationMasterKey = shape.LineLocCodeColumn != null
    ? 'T1.LocCode'
    : "CASE WHEN ISNUMERIC(CAST(T1.Location AS NVARCHAR(50))) = 1 THEN CAST(T1.Location AS INT) ELSE NULL END";
  const locationExpr = coalesceExpr([
    canJoinLocationMaster ? 'NULLIF(CAST(LOC.Location AS NVARCHAR(50)), \'\')' : null,
    shape.LineLocationColumn != null ? 'NULLIF(CAST(T1.Location AS NVARCHAR(50)), \'\')' : null,
    shape.LineLocCodeColumn != null ? 'CAST(T1.LocCode AS NVARCHAR(50))' : null,
  ]);
  const locationJoin = canJoinLocationMaster
    ? `LEFT JOIN OLCT LOC ON LOC.Code = ${locationMasterKey}`
    : '';

  const lineRows = await safeRows(`
    SELECT
      ${columnExpr(shape, 'LineIdColumn', 'T1', 'Line_ID', '0')} AS LineId,
      ${accountExpr} AS DisplayAccount,
      T1.Account AS ControlAccount,
      COALESCE(NULLIF(BP.CardName, ''), NULLIF(ACT.AcctName, ''), ${accountExpr}) AS DisplayName,
      ${columnExpr(shape, 'LineDebitColumn', 'T1', 'Debit', '0')} AS Debit,
      ${columnExpr(shape, 'LineCreditColumn', 'T1', 'Credit', '0')} AS Credit,
      ${columnExpr(shape, 'LineTaxCodeColumn', 'T1', 'TaxCode', "''")} AS TaxCode,
      ${columnExpr(shape, 'LineMemoColumn', 'T1', 'LineMemo', "''")} AS Remarks,
      ${columnExpr(shape, 'LineProjectColumn', 'T1', 'Project', "''")} AS Project,
      ${locationExpr} AS Location,
      ${profitCenterExpr} AS ProfitCenter,
      BP.CardCode AS BusinessPartnerCode
    FROM JDT1 T1
    LEFT JOIN OCRD BP ON BP.CardCode = ${accountExpr}
    LEFT JOIN OACT ACT ON ACT.AcctCode = ${accountExpr}
    ${locationJoin}
    WHERE T1.TransId = @transId
    ORDER BY ${columnExpr(shape, 'LineIdColumn', 'T1', 'Line_ID', '0')}
  `, { transId: id });

  if (!lineRows.length) return null;

  const journal = {
    series: header.SeriesName || header.Series || '',
    number: header.Number || '',
    postingDate: formatDate(header.RefDate),
    dueDate: formatDate(header.DueDate || header.RefDate),
    documentDate: formatDate(header.TaxDate || header.RefDate),
    origin,
    originNo,
    transNo: header.TransId,
    remarks: header.Memo || '',
    reference1: header.Ref1 || '',
    reference2: header.Ref2 || reference2 || '',
    reference3: header.Ref3 || '',
    project: '',
    location: '',
    posted: true,
    lines: lineRows.map((line, index) => ({
      lineId: index + 1,
      account: line.DisplayAccount || '',
      controlAccount: line.BusinessPartnerCode ? line.ControlAccount || '' : '',
      name: line.DisplayName || '',
      debit: round2(line.Debit),
      credit: round2(line.Credit),
      taxCode: line.TaxCode || '',
      remarks: line.Remarks || '',
      project: line.Project || '',
      profitCenter: line.ProfitCenter || '',
      location: line.Location || '',
      goldenArrowTarget: line.BusinessPartnerCode ? 'businessPartner' : 'account',
    })),
  };

  journal.totalDebit = round2(journal.lines.reduce((sum, line) => sum + line.debit, 0));
  journal.totalCredit = round2(journal.lines.reduce((sum, line) => sum + line.credit, 0));
  journal.difference = round2(journal.totalDebit - journal.totalCredit);
  journal.isBalanced = Math.abs(journal.difference) < 0.005;
  return journal;
};

const getNextJournalNumber = async () => {
  const rows = await safeRows(`
    SELECT ISNULL(MAX(Number), 0) + 1 AS NextNumber
    FROM OJDT
    WHERE COL_LENGTH('OJDT', 'Origin') IS NOT NULL
  `);
  return Number(rows[0]?.NextNumber || 1);
};

const getJournalSeries = async () => {
  const rows = await safeRows(`
    SELECT TOP 1 SeriesName
    FROM NNM1
    WHERE ObjectCode = '30'
    ORDER BY Series
  `);
  return rows[0]?.SeriesName || `FY${new Date().getFullYear()}`;
};

const getAccountName = async (account) => {
  if (!String(account || '').trim()) return '';
  const rows = await safeRows(`
    SELECT TOP 1 AcctName
    FROM OACT
    WHERE AcctCode = @account
  `, { account });
  return rows[0]?.AcctName || '';
};

const getCustomer = async (customerCode, fallbackName = '') => {
  const code = String(customerCode || '').trim();
  if (!code) return { code: '', name: fallbackName, controlAccount: '' };

  const rows = await safeRows(`
    SELECT TOP 1 CardCode, CardName, DebPayAcct
    FROM OCRD
    WHERE CardCode = @code
  `, { code });
  const row = rows[0] || {};
  return {
    code: row.CardCode || code,
    name: row.CardName || fallbackName || code,
    controlAccount: row.DebPayAcct || '',
  };
};

const getTaxComponents = async (taxCodes) => {
  const codes = [...new Set((taxCodes || []).map((code) => String(code || '').trim()).filter(Boolean))];
  if (!codes.length) return new Map();

  const params = {};
  const placeholders = codes.map((code, index) => {
    const key = `code${index}`;
    params[key] = code;
    return `@${key}`;
  });

  const rows = await safeRows(`
    SELECT
      STCCode,
      STACode,
      ISNULL(EfctivRate, Rate) AS Rate
    FROM STC1
    WHERE STCCode IN (${placeholders.join(', ')})
      AND STAType IN ('-100', '-110', '-120')
    ORDER BY STCCode, Line_ID
  `, params);

  return rows.reduce((map, row) => {
    const key = String(row.STCCode || '').trim();
    if (!key) return map;
    const current = map.get(key) || [];
    current.push({
      code: String(row.STACode || '').trim(),
      rate: toNumber(row.Rate),
    });
    map.set(key, current);
    return map;
  }, new Map());
};

const addGroupedLine = (groups, keyParts, line) => {
  const key = keyParts.map((part) => String(part ?? '')).join('|');
  const existing = groups.get(key);
  if (existing) {
    existing.debit = round2(existing.debit + line.debit);
    existing.credit = round2(existing.credit + line.credit);
    return;
  }
  groups.set(key, { ...line, debit: round2(line.debit), credit: round2(line.credit) });
};

const normalizeSourceLines = (payloadLines = [], discountPercent = 0) => {
  const discountFactor = Math.max(0, 1 - (toNumber(discountPercent) / 100));
  return payloadLines
    .filter((line) => String(line.description || line.glAccount || line.totalLC || line.unitPrice || '').trim())
    .map((line, index) => {
      const gross = toNumber(line.totalLC) || (toNumber(line.unitPrice) * (toNumber(line.sQty) || 1));
      return {
        index,
        account: String(line.glAccount || '').trim(),
        accountName: String(line.glAccountName || '').trim(),
        amount: round2(gross * discountFactor),
        taxAmount: round2(toNumber(line.taxAmountLC) * discountFactor),
        taxCode: String(line.taxCode || '').trim(),
        remarks: String(line.description || '').trim(),
        project: String(line.project || line.Project || '').trim(),
        profitCenter: String(line.distRule || line.profitCenter || line.ProfitCenter || '').trim(),
        location: String(line.loc || line.location || line.Location || '').trim(),
      };
    })
    .filter((line) => line.account && line.amount > 0);
};

const buildJournal = async ({ header = {}, lines = [], origin = 'Service A/R Invoice', originNo = null, transId = null }) => {
  const customerCode = header.vendor || header.customerCode || header.cardCode || '';
  const customer = await getCustomer(customerCode, header.name || header.customerName || '');
  const sourceLines = normalizeSourceLines(lines, header.discount);
  if (!customer.code) throw new Error('Customer is required to preview Journal Entry.');
  if (!sourceLines.length) throw new Error('At least one service line is required to preview Journal Entry.');

  const taxComponentsByCode = await getTaxComponents(sourceLines.map((line) => line.taxCode));
  const revenueGroups = new Map();
  const taxGroups = new Map();

  sourceLines.forEach((line) => {
    addGroupedLine(revenueGroups, [line.account, line.project, line.profitCenter, line.location], {
      account: line.account,
      name: line.accountName || line.account,
      debit: 0,
      credit: line.amount,
      taxCode: line.taxCode,
      remarks: line.remarks,
      project: line.project,
      profitCenter: line.profitCenter,
      location: line.location,
      goldenArrowTarget: 'account',
    });

    if (line.taxAmount <= 0) return;
    const components = taxComponentsByCode.get(line.taxCode) || [];
    const componentRateTotal = components.reduce((sum, component) => sum + Math.abs(component.rate), 0);
    if (components.length && componentRateTotal > 0) {
      components.forEach((component) => {
        const componentAmount = round2(line.taxAmount * Math.abs(component.rate) / componentRateTotal);
        addGroupedLine(taxGroups, [component.code, line.taxCode], {
          account: component.code || line.taxCode,
          name: component.code ? `Output ${component.code}` : `Output GST ${line.taxCode}`,
          debit: 0,
          credit: componentAmount,
          taxCode: line.taxCode,
          remarks: `Output GST - ${line.taxCode}`,
          project: line.project,
          profitCenter: line.profitCenter,
          location: line.location,
          goldenArrowTarget: 'tax',
        });
      });
    } else {
      addGroupedLine(taxGroups, [line.taxCode], {
        account: line.taxCode || 'OUTPUT_GST',
        name: line.taxCode ? `Output GST ${line.taxCode}` : 'Output GST',
        debit: 0,
        credit: line.taxAmount,
        taxCode: line.taxCode,
        remarks: `Output GST - ${line.taxCode}`,
        project: line.project,
        profitCenter: line.profitCenter,
        location: line.location,
        goldenArrowTarget: 'tax',
      });
    }
  });

  const creditLines = [...revenueGroups.values(), ...taxGroups.values()];
  const creditTotal = round2(creditLines.reduce((sum, line) => sum + line.credit, 0));
  const debitAccountName = customer.name || await getAccountName(customer.controlAccount);
  const series = header.journalSeries || await getJournalSeries();
  const number = header.journalNumber || await getNextJournalNumber();

  const journal = {
    series,
    number,
    postingDate: formatDate(header.postingDate || header.DocDate),
    dueDate: formatDate(header.deliveryDate || header.dueDate || header.DocDueDate || header.postingDate),
    documentDate: formatDate(header.documentDate || header.taxDate || header.TaxDate || header.postingDate),
    origin,
    originNo,
    transNo: transId,
    remarks: header.journalRemark || header.remarks || `${origin}${originNo ? ` ${originNo}` : ''}`,
    reference1: header.salesContractNo || '',
    reference2: customer.code,
    reference3: '',
    project: '',
    location: '',
    lines: [
      {
        account: customer.code,
        controlAccount: customer.controlAccount,
        name: debitAccountName,
        debit: creditTotal,
        credit: 0,
        taxCode: '',
        remarks: header.remarks || `${customer.name} receivable`,
        project: '',
        profitCenter: '',
        location: '',
        goldenArrowTarget: 'businessPartner',
      },
      ...creditLines,
    ].map((line, index) => ({ lineId: index + 1, ...line })),
  };

  const totalDebit = round2(journal.lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(journal.lines.reduce((sum, line) => sum + line.credit, 0));
  journal.totalDebit = totalDebit;
  journal.totalCredit = totalCredit;
  journal.difference = round2(totalDebit - totalCredit);
  journal.isBalanced = Math.abs(journal.difference) < 0.005;
  return journal;
};

const buildAPJournal = async ({ header = {}, lines = [], origin = 'Service A/P Invoice', originNo = null, transId = null }) => {
  const vendorCode = header.vendor || header.vendorCode || header.cardCode || '';
  const vendor = await getCustomer(vendorCode, header.name || header.vendorName || '');
  const sourceLines = normalizeSourceLines(lines, header.discount);
  if (!vendor.code) throw new Error('Vendor is required to preview Journal Entry.');
  if (!sourceLines.length) throw new Error('At least one service line is required to preview Journal Entry.');

  const taxComponentsByCode = await getTaxComponents(sourceLines.map((line) => line.taxCode));
  const expenseGroups = new Map();
  const taxGroups = new Map();

  sourceLines.forEach((line) => {
    addGroupedLine(expenseGroups, [line.account, line.project, line.profitCenter, line.location], {
      account: line.account,
      name: line.accountName || line.account,
      debit: line.amount,
      credit: 0,
      taxCode: line.taxCode,
      remarks: line.remarks,
      project: line.project,
      profitCenter: line.profitCenter,
      location: line.location,
      goldenArrowTarget: 'account',
    });

    if (line.taxAmount <= 0) return;
    const components = taxComponentsByCode.get(line.taxCode) || [];
    const componentRateTotal = components.reduce((sum, component) => sum + Math.abs(component.rate), 0);
    if (components.length && componentRateTotal > 0) {
      components.forEach((component) => {
        const componentAmount = round2(line.taxAmount * Math.abs(component.rate) / componentRateTotal);
        addGroupedLine(taxGroups, [component.code, line.taxCode], {
          account: component.code || line.taxCode,
          name: component.code ? `Input ${component.code}` : `Input GST ${line.taxCode}`,
          debit: componentAmount,
          credit: 0,
          taxCode: line.taxCode,
          remarks: `Input GST - ${line.taxCode}`,
          project: line.project,
          profitCenter: line.profitCenter,
          location: line.location,
          goldenArrowTarget: 'tax',
        });
      });
    } else {
      addGroupedLine(taxGroups, [line.taxCode], {
        account: line.taxCode || 'INPUT_GST',
        name: line.taxCode ? `Input GST ${line.taxCode}` : 'Input GST',
        debit: line.taxAmount,
        credit: 0,
        taxCode: line.taxCode,
        remarks: `Input GST - ${line.taxCode}`,
        project: line.project,
        profitCenter: line.profitCenter,
        location: line.location,
        goldenArrowTarget: 'tax',
      });
    }
  });

  const debitLines = [...expenseGroups.values(), ...taxGroups.values()];
  const debitTotal = round2(debitLines.reduce((sum, line) => sum + line.debit, 0));
  const creditAccountName = vendor.name || await getAccountName(vendor.controlAccount);
  const series = header.journalSeries || await getJournalSeries();
  const number = header.journalNumber || await getNextJournalNumber();

  const journal = {
    series,
    number,
    postingDate: formatDate(header.postingDate || header.DocDate),
    dueDate: formatDate(header.deliveryDate || header.dueDate || header.DocDueDate || header.postingDate),
    documentDate: formatDate(header.documentDate || header.taxDate || header.TaxDate || header.postingDate),
    origin,
    originNo,
    transNo: transId,
    remarks: header.journalRemark || header.remarks || `${origin}${originNo ? ` ${originNo}` : ''}`,
    reference1: header.salesContractNo || '',
    reference2: vendor.code,
    reference3: '',
    project: '',
    location: '',
    lines: [
      ...debitLines,
      {
        account: vendor.code,
        controlAccount: vendor.controlAccount,
        name: creditAccountName,
        debit: 0,
        credit: debitTotal,
        taxCode: '',
        remarks: header.remarks || `${vendor.name} payable`,
        project: '',
        profitCenter: '',
        location: '',
        goldenArrowTarget: 'businessPartner',
      },
    ].map((line, index) => ({ lineId: index + 1, ...line })),
  };

  const totalDebit = round2(journal.lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(journal.lines.reduce((sum, line) => sum + line.credit, 0));
  journal.totalDebit = totalDebit;
  journal.totalCredit = totalCredit;
  journal.difference = round2(totalDebit - totalCredit);
  journal.isBalanced = Math.abs(journal.difference) < 0.005;
  return journal;
};

const getSavedInvoicePayload = async (docEntry) => {
  const headerRows = await queryRows(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.DocDate,
      T0.DocDueDate,
      T0.TaxDate,
      T0.Comments,
      T0.JrnlMemo,
      T0.NumAtCard,
      T0.DiscPrcnt,
      T0.TransId
    FROM OINV T0
    WHERE T0.DocEntry = @docEntry
      AND T0.DocType = 'S'
  `, { docEntry });

  if (!headerRows.length) throw new Error('Service A/R Invoice was not found.');

  const lineRows = await queryRows(`
    SELECT
      T1.LineNum,
      T1.AcctCode,
      OACT.AcctName,
      T1.Dscription,
      T1.OcrCode,
      T1.TaxCode,
      T1.LineTotal,
      T1.VatSum
    FROM INV1 T1
    LEFT JOIN OACT ON OACT.AcctCode = T1.AcctCode
    WHERE T1.DocEntry = @docEntry
    ORDER BY T1.LineNum
  `, { docEntry });

  const header = headerRows[0];
  return {
    header: {
      vendor: header.CardCode,
      customerCode: header.CardCode,
      name: header.CardName,
      postingDate: formatDate(header.DocDate),
      deliveryDate: formatDate(header.DocDueDate),
      documentDate: formatDate(header.TaxDate),
      remarks: header.Comments || '',
      journalRemark: header.JrnlMemo || '',
      salesContractNo: header.NumAtCard || '',
      discount: header.DiscPrcnt || 0,
    },
    lines: lineRows.map((line) => ({
      description: line.Dscription || '',
      glAccount: line.AcctCode || '',
      glAccountName: line.AcctName || '',
      distRule: line.OcrCode || '',
      taxCode: line.TaxCode || '',
      totalLC: line.LineTotal || 0,
      taxAmountLC: line.VatSum || 0,
    })),
    originNo: header.DocNum || docEntry,
    transId: header.TransId || null,
  };
};

const getSavedAPInvoicePayload = async (docEntry) => {
  const headerRows = await queryRows(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.DocDate,
      T0.DocDueDate,
      T0.TaxDate,
      T0.Comments,
      T0.JrnlMemo,
      T0.NumAtCard,
      T0.DiscPrcnt,
      T0.TransId
    FROM OPCH T0
    WHERE T0.DocEntry = @docEntry
      AND T0.DocType = 'S'
  `, { docEntry });

  if (!headerRows.length) throw new Error('Service A/P Invoice was not found.');

  const lineRows = await queryRows(`
    SELECT
      T1.LineNum,
      T1.AcctCode,
      OACT.AcctName,
      T1.Dscription,
      T1.OcrCode,
      T1.TaxCode,
      T1.LineTotal,
      T1.VatSum
    FROM PCH1 T1
    LEFT JOIN OACT ON OACT.AcctCode = T1.AcctCode
    WHERE T1.DocEntry = @docEntry
    ORDER BY T1.LineNum
  `, { docEntry });

  const header = headerRows[0];
  return {
    header: {
      vendor: header.CardCode,
      vendorCode: header.CardCode,
      name: header.CardName,
      postingDate: formatDate(header.DocDate),
      deliveryDate: formatDate(header.DocDueDate),
      documentDate: formatDate(header.TaxDate),
      remarks: header.Comments || '',
      journalRemark: header.JrnlMemo || '',
      salesContractNo: header.NumAtCard || '',
      discount: header.DiscPrcnt || 0,
    },
    lines: lineRows.map((line) => ({
      description: line.Dscription || '',
      glAccount: line.AcctCode || '',
      glAccountName: line.AcctName || '',
      distRule: line.OcrCode || '',
      taxCode: line.TaxCode || '',
      totalLC: line.LineTotal || 0,
      taxAmountLC: line.VatSum || 0,
    })),
    originNo: header.DocNum || docEntry,
    transId: header.TransId || null,
  };
};

const getExistingShadowJournal = async (originNo, origin = 'Service A/R Invoice') => {
  const shape = await getTableShape();
  if (!canPersistToShadowJournal(shape)) return null;

  const headerRows = await safeRows(`
    SELECT TOP 1 TransId, Number, Series, RefDate, DueDate, TaxDate, Memo, Origin, OriginNo
    FROM OJDT
    WHERE Origin = @origin
      AND OriginNo = @originNo
    ORDER BY TransId DESC
  `, { origin, originNo });

  const header = headerRows[0];
  if (!header) return null;

  const lines = await safeRows(`
    SELECT Account, AccountName, Debit, Credit, Project, ProfitCenter, Location, Remarks
    FROM JDT1
    WHERE TransId = @transId
    ORDER BY LineId
  `, { transId: header.TransId });

  const journal = {
    series: header.Series || '',
    number: header.Number,
    postingDate: formatDate(header.RefDate),
    dueDate: formatDate(header.DueDate),
    documentDate: formatDate(header.TaxDate),
    origin: header.Origin || origin,
    originNo: header.OriginNo,
    transNo: header.TransId,
    remarks: header.Memo || '',
    reference1: '',
    reference2: '',
    reference3: '',
    project: '',
    location: '',
    persisted: true,
    lines: lines.map((line, index) => ({
      lineId: index + 1,
      account: line.Account || '',
      name: line.AccountName || '',
      debit: toNumber(line.Debit),
      credit: toNumber(line.Credit),
      taxCode: '',
      remarks: line.Remarks || '',
      project: line.Project || '',
      profitCenter: line.ProfitCenter || '',
      location: line.Location || '',
    })),
  };

  journal.totalDebit = round2(journal.lines.reduce((sum, line) => sum + line.debit, 0));
  journal.totalCredit = round2(journal.lines.reduce((sum, line) => sum + line.credit, 0));
  journal.difference = round2(journal.totalDebit - journal.totalCredit);
  journal.isBalanced = Math.abs(journal.difference) < 0.005;
  return journal;
};

const persistShadowJournal = async (journal) => {
  const shape = await ensureJournalTables();
  if (!canPersistToShadowJournal(shape)) {
    return {
      ...journal,
      persisted: false,
      persistenceNote: 'SAP standard OJDT/JDT1 tables were detected; direct SQL journal insertion was skipped.',
    };
  }

  const existing = await getExistingShadowJournal(journal.originNo, journal.origin);
  if (existing) return existing;

  const insertHeader = await queryRows(`
    INSERT INTO OJDT(Number, Series, RefDate, DueDate, TaxDate, Memo, Origin, OriginNo)
    OUTPUT INSERTED.TransId
    VALUES(@number, @series, @refDate, @dueDate, @taxDate, @memo, @origin, @originNo)
  `, {
    number: journal.number,
    series: journal.series,
    refDate: journal.postingDate,
    dueDate: journal.dueDate,
    taxDate: journal.documentDate,
    memo: journal.remarks,
    origin: journal.origin,
    originNo: journal.originNo,
  });

  const transId = insertHeader[0]?.TransId;
  for (const line of journal.lines) {
    await db.query(`
      INSERT INTO JDT1(TransId, Account, AccountName, Debit, Credit, Project, ProfitCenter, Location, Remarks)
      VALUES(@transId, @account, @accountName, @debit, @credit, @project, @profitCenter, @location, @remarks)
    `, {
      transId,
      account: line.account,
      accountName: line.name,
      debit: line.debit,
      credit: line.credit,
      project: line.project || '',
      profitCenter: line.profitCenter || '',
      location: line.location || '',
      remarks: line.remarks || '',
    });
  }

  return {
    ...journal,
    transNo: transId,
    persisted: true,
  };
};

const generateFromServiceARInvoice = async ({ docEntry, payload, persist = false }) => {
  if (docEntry) {
    const saved = await getSavedInvoicePayload(docEntry);
    const posted = await getPostedJournal({
      transId: saved.transId,
      origin: 'Service A/R Invoice',
      originNo: saved.originNo,
      reference2: saved.header.customerCode,
    });
    if (posted) return posted;
    const existing = persist ? await getExistingShadowJournal(saved.originNo, 'Service A/R Invoice') : null;
    if (existing) return existing;
    const journal = await buildJournal({
      ...saved,
      origin: 'Service A/R Invoice',
      originNo: saved.originNo,
      transId: saved.transId,
    });
    return persist ? persistShadowJournal(journal) : journal;
  }

  const source = payload || {};
  const journal = await buildJournal({
    header: source.header || {},
    lines: source.lines || [],
    origin: 'Service A/R Invoice',
    originNo: source.header?.docNo || null,
  });
  return { ...journal, persisted: false };
};

const generateFromServiceAPInvoice = async ({ docEntry, payload, persist = false }) => {
  if (docEntry) {
    const saved = await getSavedAPInvoicePayload(docEntry);
    const posted = await getPostedJournal({
      transId: saved.transId,
      origin: 'Service A/P Invoice',
      originNo: saved.originNo,
      reference2: saved.header.vendorCode,
    });
    if (posted) return posted;
    const existing = persist ? await getExistingShadowJournal(saved.originNo, 'Service A/P Invoice') : null;
    if (existing) return existing;
    const journal = await buildAPJournal({
      ...saved,
      origin: 'Service A/P Invoice',
      originNo: saved.originNo,
      transId: saved.transId,
    });
    return persist ? persistShadowJournal(journal) : journal;
  }

  const source = payload || {};
  const journal = await buildAPJournal({
    header: source.header || {},
    lines: source.lines || [],
    origin: 'Service A/P Invoice',
    originNo: source.header?.docNo || null,
  });
  return { ...journal, persisted: false };
};

const normalizeManualLine = (line = {}) => ({
  accountCode: String(line.accountCode || line.account || line.glAccount || '').trim(),
  accountName: String(line.accountName || line.name || '').trim(),
  debit: round2(toNumber(line.debit)),
  credit: round2(toNumber(line.credit)),
  remarks: String(line.remarks || line.lineMemo || '').trim(),
  taxCode: String(line.taxCode || '').trim(),
  project: String(line.project || '').trim(),
  distRule: String(line.distRule || line.profitCenter || '').trim(),
  location: String(line.location || line.loc || '').trim(),
});

const createManualJournalEntry = async (payload = {}) => {
  const header = payload.header || payload;
  const sourceLines = Array.isArray(payload.lines) ? payload.lines : [];
  const lines = sourceLines
    .map(normalizeManualLine)
    .filter((line) => line.accountCode || line.accountName || line.debit || line.credit || line.remarks);

  if (!lines.length) {
    throw new Error('At least one journal entry row is required.');
  }

  const invalidLine = lines.find((line) => !line.accountCode || (line.debit > 0 && line.credit > 0) || (line.debit <= 0 && line.credit <= 0));
  if (invalidLine) {
    throw new Error('Each journal row must have an account and either debit or credit amount.');
  }

  const totalDebit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(totalDebit - totalCredit) >= 0.005) {
    throw new Error('Journal entry is not balanced.');
  }

  const data = {
    ReferenceDate: formatDate(header.postingDate || header.ReferenceDate),
    DueDate: formatDate(header.dueDate || header.DueDate || header.postingDate),
    TaxDate: formatDate(header.documentDate || header.taxDate || header.TaxDate || header.postingDate),
    Memo: String(header.remarks || header.memo || '').trim(),
    TransactionCode: String(header.transCode || header.transactionCode || '').trim(),
    Reference: String(header.reference1 || header.ref1 || '').trim(),
    Reference2: String(header.reference2 || header.ref2 || '').trim(),
    Reference3: String(header.reference3 || header.ref3 || '').trim(),
    ProjectCode: String(header.project || '').trim(),
    Indicator: String(header.indicator || '').trim(),
    JournalEntryLines: lines.map((line) => {
      const journalLine = {
        AccountCode: line.accountCode,
        Debit: line.debit,
        Credit: line.credit,
        LineMemo: line.remarks,
      };

      if (line.taxCode) journalLine.TaxCode = line.taxCode;
      if (line.project) journalLine.ProjectCode = line.project;
      if (line.distRule) journalLine.CostingCode = line.distRule;
      if (line.location) journalLine.LocationCode = line.location;
      return journalLine;
    }),
  };

  Object.keys(data).forEach((key) => {
    if (data[key] === '') delete data[key];
  });

  const sapService = require('./sapService');
  const response = await sapService.request({
    method: 'POST',
    url: '/JournalEntries',
    data,
  });

  return {
    success: true,
    message: 'Journal Entry added successfully.',
    totalDebit,
    totalCredit,
    data: response.data,
  };
};

module.exports = {
  generateFromServiceARInvoice,
  generateFromServiceAPInvoice,
  createManualJournalEntry,
};
