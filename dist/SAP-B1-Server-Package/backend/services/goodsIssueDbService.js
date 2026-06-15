const db = require('../db/odbc');
const { getHeaderUdfValues, getLineUdfValues } = require('./udfMetadataService');

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (error) {
    console.error('[GoodsIssueDB] Query failed:', error.message);
    return [];
  }
};

const getTableColumns = async (tableName) => {
  const rows = await safe(
    db.query(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
      `,
      { tableName }
    )
  );

  return new Set(rows.map((row) => row.COLUMN_NAME));
};

const quoteSqlIdentifier = (identifier) => `[${String(identifier || '').replace(/]/g, ']]')}]`;

const getItems = async () => {
  const [itemRows, priceRows] = await Promise.all([
    safe(
      db.query(`
        SELECT
          T0.ItemCode,
          T0.ItemName,
          T0.BuyUnitMsr AS UoMCode,
          T0.InvntryUom AS UoMName,
          T0.DfltWH AS DefaultWarehouse,
          CAST(ISNULL(T0.OnHand, 0) AS DECIMAL(19, 2)) AS InStock,
          CAST(ISNULL(T0.LastPurPrc, 0) AS DECIMAL(19, 6)) AS LastPurchasePrice,
          CAST(ISNULL(T0.AvgPrice, 0) AS DECIMAL(19, 6)) AS ItemCost,
          T0.ExpensAcct AS AccountCode,
          T0.ManBtchNum AS BatchManaged,
          T0.ManSerNum AS SerialManaged,
          T0.PUoMEntry AS UoMGroupEntry,
          CHP.ChapterID AS HSNCode
        FROM OITM T0
        LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.ChapterID
        WHERE T0.InvntItem = 'Y'
          AND ISNULL(T0.validFor, 'Y') <> 'N'
          AND ISNULL(T0.frozenFor, 'N') <> 'Y'
        ORDER BY T0.ItemCode
      `)
    ),
    safe(
      db.query(`
        SELECT
          T0.ItemCode,
          T0.PriceList,
          CAST(ISNULL(T0.Price, 0) AS DECIMAL(19, 6)) AS Price
        FROM ITM1 T0
        INNER JOIN OITM T1 ON T1.ItemCode = T0.ItemCode
        WHERE T1.InvntItem = 'Y'
      `)
    ),
  ]);

  const priceMap = priceRows.reduce((acc, row) => {
    if (!acc[row.ItemCode]) {
      acc[row.ItemCode] = {};
    }
    acc[row.ItemCode][String(row.PriceList)] = Number(row.Price || 0);
    return acc;
  }, {});

  return itemRows.map((row) => ({
    itemCode: row.ItemCode,
    itemName: row.ItemName,
    uomCode: row.UoMCode || '',
    uomName: row.UoMName || '',
    defaultWarehouse: row.DefaultWarehouse || '',
    inStock: Number(row.InStock || 0),
    InStock: Number(row.InStock || 0),
    lastPurchasePrice: Number(row.LastPurchasePrice || 0),
    itemCost: Number(row.ItemCost || 0),
    accountCode: row.AccountCode || '',
    batchManaged: String(row.BatchManaged || '').toUpperCase() === 'Y',
    serialManaged: String(row.SerialManaged || '').toUpperCase() === 'Y',
    uomGroupEntry: row.UoMGroupEntry || null,
    hsnCode: row.HSNCode || '',
    prices: priceMap[row.ItemCode] || {},
  }));
};

const getBatchesByItem = async (itemCode, whsCode) => {
  const result = await safe(
    db.query(
      `
        SELECT
          T0.BatchNum AS BatchNumber,
          T0.Quantity AS AvailableQty,
          T0.ExpDate AS ExpiryDate
        FROM OIBT T0
        WHERE T0.ItemCode = @itemCode
          AND T0.WhsCode = @whsCode
          AND T0.Quantity > 0
        ORDER BY T0.ExpDate
      `,
      { itemCode, whsCode }
    )
  );

  return { batches: result };
};

const getWarehouses = async () => {
  const warehouseColumns = await getTableColumns('OWHS');
  const locationExpression = warehouseColumns.has('Location') ? '[Location]' : 'NULL';

  return safe(
    db.query(`
      SELECT
        WhsCode,
        WhsName,
        BPLId AS BranchId,
        ${locationExpression} AS LocationCode
      FROM OWHS
      WHERE ISNULL(Inactive, 'N') <> 'Y'
      ORDER BY WhsCode
    `)
  ).then((rows) =>
    rows.map((row) => ({
      whsCode: row.WhsCode,
      whsName: row.WhsName,
      branchId: row.BranchId != null ? String(row.BranchId) : '',
      locationCode: row.LocationCode != null ? String(row.LocationCode) : '',
    }))
  );
};

const getDistributionRules = async () => {
  const [ruleColumns, dimensionColumns] = await Promise.all([
    getTableColumns('OOCR'),
    getTableColumns('ODIM'),
  ]);
  const hasDimensionCode = ruleColumns.has('DimCode');
  const dimensionCodeExpression = hasDimensionCode ? 'T0.DimCode' : '1';
  const dimensionNameColumn = ['DimName', 'DimDesc', 'Name'].find((columnName) =>
    dimensionColumns.has(columnName)
  );
  const dimensionJoin = dimensionColumns.has('DimCode')
    ? `LEFT JOIN ODIM T1 ON T1.DimCode = ${dimensionCodeExpression}`
    : '';
  const dimensionNameExpression = dimensionNameColumn
    ? `COALESCE(T1.${quoteSqlIdentifier(dimensionNameColumn)}, 'Dimension ' + CAST(${dimensionCodeExpression} AS NVARCHAR(10)))`
    : `'Dimension ' + CAST(${dimensionCodeExpression} AS NVARCHAR(10))`;

  return safe(
    db.query(`
      SELECT TOP 500
        T0.OcrCode AS FactorCode,
        T0.OcrName AS FactorDescription,
        ${dimensionCodeExpression} AS DimensionCode,
        ${dimensionNameExpression} AS DimensionName
      FROM OOCR T0
      ${dimensionJoin}
      WHERE ISNULL(T0.Active, 'Y') <> 'N'
      ORDER BY ${dimensionCodeExpression}, T0.OcrCode
    `)
  );
};

const getSeries = async () =>
  safe(
    db.query(`
      SELECT
        T0.Series,
        T0.SeriesName,
        T0.Indicator,
        T0.NextNumber
      FROM NNM1 T0
      WHERE T0.ObjectCode = '60'
        AND T0.Locked = 'N'
      ORDER BY T0.SeriesName
    `)
  ).then((rows) =>
    rows.map((row) => ({
      series: String(row.Series),
      seriesName: row.SeriesName,
      indicator: row.Indicator || '',
      nextNumber: row.NextNumber != null ? String(row.NextNumber) : '',
    }))
  );

const getPriceLists = async () =>
  safe(
    db.query(`
      SELECT
        ListNum,
        ListName
      FROM OPLN
      ORDER BY ListNum
    `)
  ).then((rows) =>
    rows.map((row) => ({
      id: String(row.ListNum),
      name: row.ListName,
    }))
  );

const getBranches = async () =>
  safe(
    db.query(`
      SELECT
        BPLId,
        BPLName
      FROM OBPL
      WHERE ISNULL(Disabled, 'N') <> 'Y'
      ORDER BY BPLName
    `)
  ).then((rows) =>
    rows.map((row) => ({
      id: String(row.BPLId),
      name: row.BPLName,
    }))
  );

const getGoodsIssueList = async () =>
  safe(
    db.query(`
      SELECT TOP 100
        T0.DocEntry,
        T0.DocNum,
        T0.DocDate,
        T0.TaxDate,
        T0.DocTotal,
        CASE
          WHEN ISNULL(T0.CANCELED, 'N') = 'Y' THEN 'Cancelled'
          ELSE 'Posted'
        END AS DocumentStatus,
        T0.Comments,
        T0.JrnlMemo
      FROM OIGE T0
      WHERE ISNULL(T0.CANCELED, 'N') <> 'Y'
      ORDER BY T0.DocEntry DESC
    `)
  ).then((rows) =>
    rows.map((row) => ({
      docEntry: row.DocEntry,
      docNum: row.DocNum,
      postingDate: row.DocDate,
      documentDate: row.TaxDate,
      docTotal: Number(row.DocTotal || 0),
      documentStatus: row.DocumentStatus || 'Posted',
      remarks: row.Comments || '',
      journalRemark: row.JrnlMemo || '',
    }))
  );

const getGoodsIssue = async (docEntry) => {
  const headerRows = await safe(
    db.query(
      `
        SELECT TOP 1
          T0.DocEntry,
          T0.DocNum,
          T0.Series,
          T0.DocDate,
          T0.TaxDate,
          T0.Ref2,
          T0.BPLId AS BranchId,
          T0.Comments,
          T0.JrnlMemo,
          CASE
            WHEN ISNULL(T0.CANCELED, 'N') = 'Y' THEN 'Cancelled'
            ELSE 'Posted'
          END AS DocumentStatus
        FROM OIGE T0
        WHERE T0.DocEntry = @docEntry
      `,
      { docEntry }
    )
  );

  if (!headerRows.length) {
    throw new Error(`Goods Issue ${docEntry} not found.`);
  }

  const [lineRows, headerUdfs, lineUdfsByLineNum, batchRows] = await Promise.all([
    safe(
      db.query(
        `
          SELECT
            T0.LineNum,
            T0.ItemCode,
            T0.Dscription AS ItemDescription,
            CAST(ISNULL(T0.Quantity, 0) AS DECIMAL(19, 6)) AS Quantity,
            CAST(ISNULL(T0.Price, 0) AS DECIMAL(19, 6)) AS UnitPrice,
            CAST(ISNULL(T0.LineTotal, 0) AS DECIMAL(19, 6)) AS LineTotal,
            T0.WhsCode AS WarehouseCode,
            T0.AcctCode AS AccountCode,
            CAST(ISNULL(T0.StockPrice, 0) AS DECIMAL(19, 6)) AS ItemCost,
            T0.UomCode AS UoMCode,
            T0.unitMsr AS UoMName,
            T0.OcrCode AS DistributionRule,
            T0.OcrCode2 AS DistributionRule2,
            T0.OcrCode3 AS DistributionRule3,
            T0.OcrCode4 AS DistributionRule4,
            T0.OcrCode5 AS DistributionRule5,
            T0.LocCode AS LocationCode
          FROM IGE1 T0
          WHERE T0.DocEntry = @docEntry
          ORDER BY T0.LineNum
        `,
        { docEntry }
      )
    ),
    getHeaderUdfValues({ tableId: 'OIGE', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'IGE1', keyValue: docEntry }),
    safe(
      db.query(
        `
          SELECT
            BaseLineNum,
            BatchNum,
            Quantity
          FROM IBT1
          WHERE BaseEntry = @docEntry
            AND BaseType = 60
          ORDER BY BaseLineNum, BatchNum
        `,
        { docEntry }
      )
    ),
  ]);

  const itemCodes = [...new Set(lineRows.map((row) => row.ItemCode).filter(Boolean))];
  let itemMap = {};

  if (itemCodes.length) {
    const params = itemCodes.reduce((acc, code, index) => {
      acc[`item${index}`] = code;
      return acc;
    }, {});

    const itemRows = await safe(
      db.query(
        `
          SELECT
            T0.ItemCode,
            T0.InvntryUom AS UoMName,
            T0.ExpensAcct AS AccountCode,
            CAST(ISNULL(T0.AvgPrice, 0) AS DECIMAL(19, 6)) AS ItemCost,
            T0.ManBtchNum AS BatchManaged,
            T0.ManSerNum AS SerialManaged
          FROM OITM T0
          WHERE T0.ItemCode IN (${itemCodes.map((_, index) => `@item${index}`).join(', ')})
        `,
        params
      )
    );

    itemMap = itemRows.reduce((acc, row) => {
      acc[row.ItemCode] = {
        uomName: row.UoMName || '',
        accountCode: row.AccountCode || '',
        itemCost: Number(row.ItemCost || 0),
        batchManaged: String(row.BatchManaged || '').toUpperCase() === 'Y',
        serialManaged: String(row.SerialManaged || '').toUpperCase() === 'Y',
      };
      return acc;
    }, {});
  }

  const batchesByLine = {};
  batchRows.forEach((row) => {
    if (!batchesByLine[row.BaseLineNum]) {
      batchesByLine[row.BaseLineNum] = [];
    }
    batchesByLine[row.BaseLineNum].push({
      batchNumber: row.BatchNum || '',
      quantity: String(row.Quantity || 0),
      expiryDate: '',
    });
  });

  const header = headerRows[0];

  return {
    docEntry: header.DocEntry,
    docNum: header.DocNum,
    headerUdfs: headerUdfs || {},
    header: {
      number: header.DocNum != null ? String(header.DocNum) : 'Auto',
      series: header.Series != null ? String(header.Series) : '',
      postingDate: header.DocDate ? header.DocDate.toISOString().split('T')[0] : '',
      documentDate: header.TaxDate ? header.TaxDate.toISOString().split('T')[0] : '',
      ref2: header.Ref2 || '',
      priceList: '',
      branch: header.BranchId != null ? String(header.BranchId) : '',
      remarks: header.Comments || '',
      journalRemark: header.JrnlMemo || 'Goods Issue',
      referencedDocument: null,
      status: header.DocumentStatus || 'Posted',
    },
    lines: lineRows.map((row) => {
      const itemInfo = itemMap[row.ItemCode] || {};
      return {
        itemCode: row.ItemCode || '',
        itemDescription: row.ItemDescription || '',
        quantity: String(Number(row.Quantity || 0)),
        unitPrice: String(Number(row.UnitPrice || 0)),
        total: Number(row.LineTotal || 0).toFixed(2),
        warehouse: row.WarehouseCode || '',
        accountCode: row.AccountCode || itemInfo.accountCode || '',
        itemCost: row.ItemCost != null ? String(Number(row.ItemCost || 0)) : itemInfo.itemCost != null ? String(itemInfo.itemCost) : '',
        uomCode: row.UoMCode || '',
        uomName: row.UoMName || itemInfo.uomName || '',
        distributionRule: row.DistributionRule || '',
        distributionRule2: row.DistributionRule2 || '',
        distributionRule3: row.DistributionRule3 || '',
        distributionRule4: row.DistributionRule4 || '',
        distributionRule5: row.DistributionRule5 || '',
        location: row.LocationCode != null ? String(row.LocationCode) : '',
        branch: header.BranchId != null ? String(header.BranchId) : '',
        batchManaged: !!itemInfo.batchManaged,
        serialManaged: !!itemInfo.serialManaged,
        batches: batchesByLine[row.LineNum] || [],
        inventoryUOM: itemInfo.uomName || row.UoMCode || '',
        uomFactor: 1,
        baseEntry: null,
        baseLine: null,
        baseType: null,
        lockedByCopy: false,
        udf: lineUdfsByLineNum[row.LineNum] || {},
      };
    }),
  };
};

module.exports = {
  getItems,
  getBatchesByItem,
  getWarehouses,
  getDistributionRules,
  getSeries,
  getPriceLists,
  getBranches,
  getGoodsIssueList,
  getGoodsIssue,
};
