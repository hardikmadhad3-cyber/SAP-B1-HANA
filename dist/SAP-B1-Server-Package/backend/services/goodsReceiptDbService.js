const db = require('../db/odbc');

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (error) {
    console.error('[GoodsReceiptDB] Query failed:', error.message);
    return [];
  }
};

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

const getWarehouses = async () =>
  safe(
    db.query(`
      SELECT
        WhsCode,
        WhsName,
        BPLId AS BranchId
      FROM OWHS
      WHERE ISNULL(Inactive, 'N') <> 'Y'
      ORDER BY WhsCode
    `)
  ).then((rows) =>
    rows.map((row) => ({
      whsCode: row.WhsCode,
      whsName: row.WhsName,
      branchId: row.BranchId != null ? String(row.BranchId) : '',
    }))
  );

const getSeries = async () =>
  safe(
    db.query(`
      SELECT
        T0.Series,
        T0.SeriesName,
        T0.Indicator,
        T0.NextNumber
      FROM NNM1 T0
      WHERE T0.ObjectCode = '59'
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

const getPurchaseOrders = async () =>
  safe(
    db.query(`
      SELECT TOP 100
        T0.DocEntry,
        T0.DocNum,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.DocTotal,
        T0.BPLId AS BranchId,
        T0.Ref2
      FROM OPOR T0
      WHERE T0.DocStatus = 'O'
      ORDER BY T0.DocEntry DESC
    `)
  ).then((rows) =>
    rows.map((row) => ({
      docEntry: row.DocEntry,
      docNum: row.DocNum,
      cardCode: row.CardCode,
      cardName: row.CardName,
      docDate: row.DocDate,
      docTotal: Number(row.DocTotal || 0),
      branchId: row.BranchId != null ? String(row.BranchId) : '',
      ref2: row.Ref2 || '',
      sourceType: 'purchase-order',
      sourceLabel: 'Purchase Order',
    }))
  );

const getPurchaseInvoices = async () =>
  safe(
    db.query(`
      SELECT TOP 100
        T0.DocEntry,
        T0.DocNum,
        T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.DocTotal,
        T0.BPLId AS BranchId,
        T0.Ref2
      FROM OPCH T0
      WHERE T0.DocStatus = 'O'
      ORDER BY T0.DocEntry DESC
    `)
  ).then((rows) =>
    rows.map((row) => ({
      docEntry: row.DocEntry,
      docNum: row.DocNum,
      cardCode: row.CardCode,
      cardName: row.CardName,
      docDate: row.DocDate,
      docTotal: Number(row.DocTotal || 0),
      branchId: row.BranchId != null ? String(row.BranchId) : '',
      ref2: row.Ref2 || '',
      sourceType: 'purchase-invoice',
      sourceLabel: 'Purchase Invoice',
    }))
  );

const getGoodsIssues = async () =>
  safe(
    db.query(`
      SELECT TOP 100
        T0.DocEntry,
        T0.DocNum,
        T0.DocDate,
        T0.DocTotal,
        T0.Comments
      FROM OIGE T0
      ORDER BY T0.DocEntry DESC
    `)
  ).then((rows) =>
    rows.map((row) => ({
      docEntry: row.DocEntry,
      docNum: row.DocNum,
      docDate: row.DocDate,
      docTotal: Number(row.DocTotal || 0),
      details: row.Comments || '',
      sourceType: 'goods-issue',
      sourceLabel: 'Goods Issue',
    }))
  );

const getDocumentDetails = async ({
  headerTable,
  lineTable,
  baseType,
  docEntry,
  useOpenQty,
}) => {
  const headerRows = await safe(
    db.query(
      `
        SELECT TOP 1
          T0.DocEntry,
          T0.DocNum,
          T0.CardCode,
        T0.CardName,
        T0.DocDate,
        T0.TaxDate,
        T0.Ref2,
        T0.BPLId AS BranchId,
        T0.Comments,
        T0.JrnlMemo
      FROM ${headerTable} T0
        WHERE T0.DocEntry = @docEntry
      `,
      { docEntry }
    )
  );

  if (!headerRows.length) {
    throw new Error(`Source document ${docEntry} not found.`);
  }

  const quantityExpression = useOpenQty
    ? 'CAST(ISNULL(T0.OpenQty, T0.Quantity) AS DECIMAL(19, 6))'
    : 'CAST(T0.Quantity AS DECIMAL(19, 6))';

  const statusPredicate = useOpenQty
    ? "AND T0.LineStatus = 'O' AND ISNULL(T0.OpenQty, 0) > 0"
    : '';

  const lineRows = await safe(
    db.query(
      `
        SELECT
          T0.LineNum,
          T0.ItemCode,
          T0.Dscription AS ItemDescription,
          ${quantityExpression} AS QuantityToCopy,
          CAST(ISNULL(T0.Price, 0) AS DECIMAL(19, 6)) AS UnitPrice,
          CAST(ISNULL(T0.LineTotal, 0) AS DECIMAL(19, 6)) AS LineTotal,
          T0.WhsCode AS WarehouseCode,
          T0.unitMsr AS UoMCode,
          T0.OcrCode AS DistributionRule,
          T0.LocCode AS LocationCode
        FROM ${lineTable} T0
        WHERE T0.DocEntry = @docEntry
          ${statusPredicate}
        ORDER BY T0.LineNum
      `,
      { docEntry }
    )
  );

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

  const batchRows = await safe(
    db.query(
      `
        SELECT
          BaseLineNum,
          BatchNum,
          Quantity
        FROM IBT1
        WHERE BaseEntry = @docEntry
          AND BaseType = 59
        ORDER BY BaseLineNum, BatchNum
      `,
      { docEntry }
    )
  );

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
    header: {
      number: header.DocNum != null ? String(header.DocNum) : 'Auto',
      postingDate: header.DocDate ? header.DocDate.toISOString().split('T')[0] : '',
      documentDate: header.TaxDate ? header.TaxDate.toISOString().split('T')[0] : '',
      ref2: header.Ref2 || '',
      priceList: '',
      branch: header.BranchId != null ? String(header.BranchId) : '',
      journalRemark: header.JrnlMemo || 'Goods Receipt',
      remarks: header.Comments || '',
      cardCode: header.CardCode || '',
      cardName: header.CardName || '',
      referencedDocument: {
        sourceType: baseType === 22 ? 'purchase-order' : 'purchase-invoice',
        sourceLabel: baseType === 22 ? 'Purchase Order' : 'Purchase Invoice',
        docEntry: header.DocEntry,
        docNum: header.DocNum,
      },
    },
    lines: lineRows.map((row) => {
      const itemInfo = itemMap[row.ItemCode] || {};
      return {
        itemCode: row.ItemCode || '',
        itemDescription: row.ItemDescription || '',
        quantity: Number(row.QuantityToCopy || 0),
        unitPrice: Number(row.UnitPrice || 0),
        total: Number(row.LineTotal || 0),
        warehouse: row.WarehouseCode || '',
        accountCode: itemInfo.accountCode || '',
        itemCost: itemInfo.itemCost || 0,
        uomCode: row.UoMCode || '',
        uomName: itemInfo.uomName || '',
        distributionRule: row.DistributionRule || '',
        location: row.LocationCode != null ? String(row.LocationCode) : '',
        branch: header.BranchId != null ? String(header.BranchId) : '',
        baseEntry: header.DocEntry,
        baseLine: row.LineNum,
        baseType,
        lockedByCopy: true,
      };
    }),
  };
};

const getPurchaseOrderForCopy = async (docEntry) =>
  getDocumentDetails({
    headerTable: 'OPOR',
    lineTable: 'POR1',
    baseType: 22,
    docEntry,
    useOpenQty: true,
  });

const getPurchaseInvoiceForCopy = async (docEntry) =>
  getDocumentDetails({
    headerTable: 'OPCH',
    lineTable: 'PCH1',
    baseType: 18,
    docEntry,
    useOpenQty: false,
  });

const getGoodsIssueForCopy = async (docEntry) => {
  const headerRows = await safe(
    db.query(
      `
        SELECT TOP 1
          T0.DocEntry,
          T0.DocNum,
          T0.DocDate,
          T0.TaxDate,
          T0.Comments,
          T0.JrnlMemo,
          T0.BPLId AS BranchId
        FROM OIGE T0
        WHERE T0.DocEntry = @docEntry
      `,
      { docEntry }
    )
  );

  if (!headerRows.length) {
    throw new Error(`Goods Issue ${docEntry} not found.`);
  }

  const lineRows = await safe(
    db.query(
      `
        SELECT
          T0.LineNum,
          T0.ItemCode,
          T0.Dscription AS ItemDescription,
          CAST(ISNULL(T0.Quantity, 0) AS DECIMAL(19, 6)) AS QuantityToCopy,
          CAST(ISNULL(T0.Price, 0) AS DECIMAL(19, 6)) AS UnitPrice,
          CAST(ISNULL(T0.LineTotal, 0) AS DECIMAL(19, 6)) AS LineTotal,
          T0.WhsCode AS WarehouseCode,
          T0.unitMsr AS UoMCode,
          T0.OcrCode AS DistributionRule,
          T0.LocCode AS LocationCode
        FROM IGE1 T0
        WHERE T0.DocEntry = @docEntry
        ORDER BY T0.LineNum
      `,
      { docEntry }
    )
  );

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
            CAST(ISNULL(T0.AvgPrice, 0) AS DECIMAL(19, 6)) AS ItemCost
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
      };
      return acc;
    }, {});
  }

  const header = headerRows[0];

  return {
    header: {
      number: header.DocNum != null ? String(header.DocNum) : 'Auto',
      postingDate: header.DocDate ? header.DocDate.toISOString().split('T')[0] : '',
      documentDate: header.TaxDate ? header.TaxDate.toISOString().split('T')[0] : '',
      ref2: '',
      priceList: '',
      branch: header.BranchId != null ? String(header.BranchId) : '',
      journalRemark: header.JrnlMemo || 'Goods Receipt',
      remarks: header.Comments || '',
      referencedDocument: {
        sourceType: 'goods-issue',
        sourceLabel: 'Goods Issue',
        docEntry: header.DocEntry,
        docNum: header.DocNum,
      },
    },
    lines: lineRows.map((row) => {
      const itemInfo = itemMap[row.ItemCode] || {};
      return {
        itemCode: row.ItemCode || '',
        itemDescription: row.ItemDescription || '',
        quantity: Number(row.QuantityToCopy || 0),
        unitPrice: Number(row.UnitPrice || 0),
        total: Number(row.LineTotal || 0),
        warehouse: row.WarehouseCode || '',
        accountCode: itemInfo.accountCode || '',
        itemCost: itemInfo.itemCost || 0,
        uomCode: row.UoMCode || '',
        uomName: itemInfo.uomName || '',
        distributionRule: row.DistributionRule || '',
        location: row.LocationCode != null ? String(row.LocationCode) : '',
        branch: header.BranchId != null ? String(header.BranchId) : '',
        baseEntry: null,
        baseLine: null,
        baseType: null,
        lockedByCopy: false,
      };
    }),
  };
};

const getGoodsReceiptList = async () =>
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
      FROM OIGN T0
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
      documentStatus: row.DocumentStatus || 'Open',
      remarks: row.Comments || '',
      journalRemark: row.JrnlMemo || '',
    }))
  );

const getGoodsReceipt = async (docEntry) => {
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
        FROM OIGN T0
        WHERE T0.DocEntry = @docEntry
      `,
      { docEntry }
    )
  );

  if (!headerRows.length) {
    throw new Error(`Goods Receipt ${docEntry} not found.`);
  }

  const lineRows = await safe(
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
          T0.unitMsr AS UoMCode,
          T0.OcrCode AS DistributionRule,
          T0.LocCode AS LocationCode,
          T0.BaseEntry,
          T0.BaseType,
          T0.BaseLine
        FROM IGN1 T0
        WHERE T0.DocEntry = @docEntry
        ORDER BY T0.LineNum
      `,
      { docEntry }
    )
  );

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
            CAST(ISNULL(T0.AvgPrice, 0) AS DECIMAL(19, 6)) AS ItemCost
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
      };
      return acc;
    }, {});
  }

  const header = headerRows[0];
  const firstBaseLine = lineRows.find((row) => row.BaseEntry != null && row.BaseType != null);
  const referencedDocument =
    firstBaseLine &&
    (firstBaseLine.BaseType === 60 ||
      firstBaseLine.BaseType === 202 ||
      firstBaseLine.BaseType === 67)
      ? {
          sourceType:
            firstBaseLine.BaseType === 60
              ? 'goods-issue'
              : firstBaseLine.BaseType === 202
                ? 'receipt-from-production'
                : 'inventory-transfer',
          sourceLabel:
            firstBaseLine.BaseType === 60
              ? 'Goods Issue'
              : firstBaseLine.BaseType === 202
                ? 'Receipt from Production'
                : 'Inventory Transfer',
          docEntry: firstBaseLine.BaseEntry,
          docNum: firstBaseLine.BaseEntry,
        }
      : null;

  return {
    docEntry: header.DocEntry,
    docNum: header.DocNum,
    header: {
      number: header.DocNum != null ? String(header.DocNum) : 'Auto',
      series: header.Series != null ? String(header.Series) : '',
      postingDate: header.DocDate ? header.DocDate.toISOString().split('T')[0] : '',
      documentDate: header.TaxDate ? header.TaxDate.toISOString().split('T')[0] : '',
      ref2: header.Ref2 || '',
      priceList: '',
      branch: header.BranchId != null ? String(header.BranchId) : '',
      remarks: header.Comments || '',
      journalRemark: header.JrnlMemo || 'Goods Receipt',
      referencedDocument,
      status: header.DocumentStatus || 'Open',
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
        accountCode: itemInfo.accountCode || '',
        itemCost: itemInfo.itemCost != null ? String(itemInfo.itemCost) : '',
        uomCode: row.UoMCode || '',
        uomName: itemInfo.uomName || '',
        distributionRule: row.DistributionRule || '',
        location: row.LocationCode != null ? String(row.LocationCode) : '',
        branch: header.BranchId != null ? String(header.BranchId) : '',
        batchManaged: !!itemInfo.batchManaged,
        serialManaged: !!itemInfo.serialManaged,
        batches: batchesByLine[row.LineNum] || [],
        inventoryUOM: itemInfo.uomName || row.UoMCode || '',
        uomFactor: 1,
        baseEntry: row.BaseEntry ?? null,
        baseLine: row.BaseLine ?? null,
        baseType: row.BaseType ?? null,
        lockedByCopy: row.BaseEntry != null,
      };
    }),
  };
};

module.exports = {
  getItems,
  getBatchesByItem,
  getWarehouses,
  getSeries,
  getPriceLists,
  getBranches,
  getPurchaseOrders,
  getPurchaseInvoices,
  getGoodsIssues,
  getPurchaseOrderForCopy,
  getPurchaseInvoiceForCopy,
  getGoodsIssueForCopy,
  getGoodsReceiptList,
  getGoodsReceipt,
};
