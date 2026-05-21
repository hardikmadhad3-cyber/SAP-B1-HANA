const db = require('./dbService');
const arInvoiceDb = require('./arInvoiceDbService');
const masterDataDbService = require('./masterDataDbService');
const hsnCodeDbService = require('./hsnCodeDbService');
const { getHeaderUdfValues, getLineUdfValues, getMarketingDocumentUdfs } = require('./udfMetadataService');

const safe = async (promise) => {
  try {
    const result = await promise;
    return result.recordset || [];
  } catch (error) {
    console.error('[Service AR Invoice DB] Query error:', error.message);
    return [];
  }
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).split('T')[0] : date.toISOString().split('T')[0];
};

const mapLookupRows = (rows = []) => {
  const seen = new Set();
  const options = [];

  rows.forEach((row) => {
    const rawValue = row?.Value ?? row?.FldValue ?? '';
    const rawDescription = row?.Description ?? row?.Descr ?? '';
    const description = String(rawDescription || '').trim();
    const value = String(rawValue || description || '').trim();

    if (!value) return;

    const normalized = value.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);

    options.push({
      value,
      description,
      label: description && description !== value ? `${value} - ${description}` : value,
    });
  });

  return options;
};

const getServiceLineLookupValues = ({ aliases = [], labels = [] }) => {
  const normalizedAliases = aliases
    .flatMap((alias) => {
      const cleanAlias = String(alias || '').trim().replace(/^U_/i, '');
      return cleanAlias ? [cleanAlias, `U_${cleanAlias}`] : [];
    })
    .filter(Boolean);
  const normalizedLabels = labels.map((label) => String(label || '').trim()).filter(Boolean);
  const clauses = [];
  const params = { tableId: 'INV1' };

  normalizedAliases.forEach((alias, index) => {
    const paramName = `alias${index}`;
    params[paramName] = alias;
    clauses.push(`T0.AliasID = @${paramName}`, `CONCAT('U_', T0.AliasID) = @${paramName}`);
  });

  normalizedLabels.forEach((label, index) => {
    const paramName = `label${index}`;
    params[paramName] = label;
    clauses.push(`T0.Descr = @${paramName}`);
  });

  if (!clauses.length) return Promise.resolve([]);

  return safe(db.query(`
    SELECT
      LTRIM(RTRIM(ISNULL(T1.FldValue, ''))) AS Value,
      LTRIM(RTRIM(ISNULL(T1.Descr, ''))) AS Description,
      T1.IndexID
    FROM CUFD T0
    INNER JOIN UFD1 T1
      ON T0.TableID = T1.TableID
     AND T0.FieldID = T1.FieldID
    WHERE T0.TableID = @tableId
      AND (${clauses.join(' OR ')})
    ORDER BY T1.IndexID, T1.FldValue
  `, params)).then(mapLookupRows);
};

const SERVICE_LINE_LOOKUPS = {
  buyerQuality: { aliases: ['BuyerQuality', 'Buyer_Quality'], labels: ['Buyer - Quality', 'Buyer Quality'] },
  sellerQuality: { aliases: ['SellerQuality', 'Seller_Quality'], labels: ['Seller - Quality', 'Seller Quality'] },
  buyerPrice: { aliases: ['BuyerPrice', 'Buyer_Price'], labels: ['Buyer - Price', 'Buyer Price'] },
  sellerPrice: { aliases: ['SellerPrice', 'Seller_Price'], labels: ['Seller - Price', 'Seller Price'] },
};

const lookupServiceItems = async () => {
  const rowsWithWTax = await safe(db.query(`
    SELECT
      ItemCode,
      ItemName,
      OnHand,
      WTLiable
    FROM OITM
    WHERE SellItem = 'Y'
      AND validFor <> 'N'
    ORDER BY ItemCode
  `));

  const rows = rowsWithWTax.length ? rowsWithWTax : await safe(db.query(`
    SELECT
      ItemCode,
      ItemName,
      OnHand,
      NULL AS WTLiable
    FROM OITM
    WHERE SellItem = 'Y'
      AND validFor <> 'N'
    ORDER BY ItemCode
  `));

  return rows.map((row) => ({
    ItemCode: row.ItemCode || '',
    ItemName: row.ItemName || '',
    InStock: row.OnHand ?? 0,
    WTaxLiable: String(row.WTLiable || '').toUpperCase() === 'N' ? 'No' : 'Yes',
  }));
};

const getReferenceData = async () => {
  const [
    base,
    accounts,
    distributionRules,
    withholdingTaxCodes,
    sacCodes,
    locations,
    businessPartners,
    serviceItems,
    buyerQualityOptions,
    sellerQualityOptions,
    buyerPriceOptions,
    sellerPriceOptions,
  ] = await Promise.all([
    arInvoiceDb.getReferenceData(),
    masterDataDbService.searchAccounts('', '', 5000, 0),
    masterDataDbService.lookupDistributionRules(),
    masterDataDbService.lookupWithholdingTaxCodes('', 200),
    hsnCodeDbService.getSACCodes('', 5000, 0),
    masterDataDbService.lookupWarehouseLocations(),
    masterDataDbService.searchBP('', '', 5000, 0),
    lookupServiceItems(),
    getServiceLineLookupValues(SERVICE_LINE_LOOKUPS.buyerQuality),
    getServiceLineLookupValues(SERVICE_LINE_LOOKUPS.sellerQuality),
    getServiceLineLookupValues(SERVICE_LINE_LOOKUPS.buyerPrice),
    getServiceLineLookupValues(SERVICE_LINE_LOOKUPS.sellerPrice),
  ]);

  return {
    ...base,
    items: serviceItems,
    locations,
    business_partners: businessPartners,
    gl_accounts: accounts
      .filter((account) => account.ActiveAccount !== 'tNO' && account.IsTitleAccount !== 'tYES')
      .map((account) => ({
        code: account.Code,
        name: account.Name,
        accountType: account.AccountType,
        balance: account.Balance ?? 0,
        inactive: account.ActiveAccount === 'tNO' ? 'Yes' : 'No',
      })),
    distribution_rules: distributionRules,
    withholding_tax_codes: withholdingTaxCodes,
    sac_codes: sacCodes.map((sac) => ({
      code: sac.code || '',
      serviceCode: sac.code || '',
      serviceName: sac.serviceName || sac.description || sac.name || '',
      description: sac.serviceName || sac.description || sac.name || '',
      heading: sac.heading || '',
      subHeading: sac.subHeading || '',
    })),
    quality_options: {
      buyer: buyerQualityOptions.length ? buyerQualityOptions : (base.quality_options?.buyer || []),
      seller: sellerQualityOptions.length ? sellerQualityOptions : (base.quality_options?.seller || []),
    },
    price_options: {
      buyer: buyerPriceOptions.length ? buyerPriceOptions : (base.price_options?.buyer || []),
      seller: sellerPriceOptions.length ? sellerPriceOptions : (base.price_options?.seller || []),
    },
  };
};

const getServiceARInvoiceList = async ({
  query = '',
  docNum = '',
  customerCode = '',
  customerName = '',
  status = '',
  postingDateFrom = '',
  postingDateTo = '',
  page = 1,
  pageSize = 25,
} = {}) => {
  const limit = Math.max(1, Math.min(toInt(pageSize, 25), 100));
  const currentPage = Math.max(1, toInt(page, 1));
  const offset = (currentPage - 1) * limit;
  const filters = [];
  const params = {
    query: String(query || '').trim(),
    like: `%${String(query || '').trim()}%`,
    docNum: String(docNum || '').trim(),
    customerCode: String(customerCode || '').trim(),
    customerName: String(customerName || '').trim(),
    customerNameLike: `%${String(customerName || '').trim()}%`,
    status: String(status || '').trim(),
    postingDateFrom: String(postingDateFrom || '').trim(),
    postingDateTo: String(postingDateTo || '').trim(),
    offset,
    limit,
  };

  filters.push("T0.DocType = 'S'");
  filters.push("ISNULL(T0.CANCELED, 'N') <> 'Y'");
  if (params.query) {
    filters.push(`(
      CAST(T0.DocNum AS nvarchar(50)) LIKE @like
      OR T0.CardCode LIKE @like
      OR T0.CardName LIKE @like
      OR ISNULL(T0.Comments, '') LIKE @like
    )`);
  }
  if (params.docNum) filters.push('CAST(T0.DocNum AS nvarchar(50)) LIKE @docNum');
  if (params.customerCode) filters.push('T0.CardCode LIKE @customerCode');
  if (params.customerName) filters.push('T0.CardName LIKE @customerNameLike');
  if (params.status === 'Open') filters.push("T0.DocStatus = 'O'");
  if (params.status === 'Closed') filters.push("T0.DocStatus = 'C'");
  if (params.postingDateFrom) filters.push('CAST(T0.DocDate AS date) >= CAST(@postingDateFrom AS date)');
  if (params.postingDateTo) filters.push('CAST(T0.DocDate AS date) <= CAST(@postingDateTo AS date)');

  const where = filters.length ? `WHERE ${filters.join('\n AND ')}` : '';
  const countRows = await safe(db.query(`
    SELECT COUNT(1) AS TotalCount
    FROM OINV T0
    ${where}
  `, params));

  const rows = await safe(db.query(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      T0.CardCode,
      T0.CardName,
      T0.DocDate,
      T0.DocDueDate,
      T0.DocTotal,
      CASE T0.DocStatus WHEN 'O' THEN 'Open' WHEN 'C' THEN 'Closed' ELSE T0.DocStatus END AS Status,
      COUNT(T1.LineNum) AS LineCount
    FROM OINV T0
    LEFT JOIN INV1 T1 ON T1.DocEntry = T0.DocEntry
    ${where}
    GROUP BY T0.DocEntry, T0.DocNum, T0.CardCode, T0.CardName, T0.DocDate, T0.DocDueDate, T0.DocTotal, T0.DocStatus
    ORDER BY T0.DocDate DESC, T0.DocNum DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, params));

  const totalCount = Number(countRows[0]?.TotalCount || 0);
  return {
    service_ar_invoices: rows.map((row) => ({
      doc_entry: row.DocEntry,
      doc_num: row.DocNum,
      customer_code: row.CardCode || '',
      customer_name: row.CardName || '',
      posting_date: formatDate(row.DocDate),
      delivery_date: formatDate(row.DocDueDate),
      status: row.Status || '',
      line_count: row.LineCount || 0,
      total_amount: row.DocTotal || 0,
    })),
    pagination: {
      page: currentPage,
      pageSize: limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    },
  };
};

const mapUdfToAliases = (udf = {}) => ({
  saudaNodeRef: udf.U_SaudaNodeRef || udf.U_SaudaNodhRef || '',
  brokPerQty: udf.U_BrokPerQty || '',
  sItem: udf.U_S_Item || udf.U_SItem || '',
  sQty: udf.U_S_Qty || udf.U_SQty || '',
  sellerBrokerage: udf.U_SellerBrokerage || '',
  buyerBrokerage: udf.U_BuyerBrokerage || '',
  buyerDelivery: udf.U_BuyerDelivery || '',
  sellerDelivery: udf.U_SellerDelivery || '',
  buyerQuality: udf.U_BuyerQuality || '',
  sellerQuality: udf.U_SellerQuality || '',
  buyerPrice: udf.U_BuyerPrice || '',
  sellerPrice: udf.U_SellerPrice || '',
  buyerSpecialInstruction: udf.U_BuyerSpecialInstruction || udf.U_BuyerSplInst || '',
  sellerSpecialInstruction: udf.U_SellerSpecialInstruction || udf.U_SellerSplInst || '',
  sellerBrokerageAmtPer: udf.U_SellerBrokerageAmtPer || udf.U_SellBrkAmtPer || '',
  sellerBrokeragePercentage: udf.U_SellerBrokeragePercentage || udf.U_SellerBrkPct || '',
  buyerBillDiscount: udf.U_BuyerBillDiscount || '',
  sellerBillDiscount: udf.U_SellerBillDiscount || '',
  stcode: udf.U_STCODE || '',
  buyerTermsOfPayment: udf.U_BuyerTermsOfPayment || udf.U_BuyerPayTerms || '',
  sellerTermsOfPayment: udf.U_SellerTermsOfPayment || udf.U_SellerPayTerms || '',
  freightPurchase: udf.U_FreightPurchase || '',
  freightSales: udf.U_FreightSales || '',
  freightProvider: udf.U_FreightProvider || '',
  freightProviderName: udf.U_FreightProviderName || '',
  documentCreated: formatDate(udf.U_DocumentCreated || ''),
  brokerageNumber: udf.U_BrokerageNumber || udf.U_BrokerageNo || '',
});

const getServiceARInvoice = async (docEntry) => {
  const headerRows = await safe(db.query(`
    SELECT
      T0.DocEntry,
      T0.DocNum,
      T0.Series,
      NNM.SeriesName,
      NNM.Indicator AS SeriesIndicator,
      T0.CardCode,
      T0.CardName,
      T0.CntctCode,
      T0.NumAtCard,
      T0.DocDate,
      T0.DocDueDate,
      T0.TaxDate,
      T0.BPLId,
      T0.DocCur,
      T0.GroupNum,
      T0.Comments,
      T0.JrnlMemo,
      T0.DiscPrcnt,
      T0.TotalExpns,
      T0.VatSum,
      T0.DocTotal,
      T0.SlpCode,
      SLP.SlpName,
      CASE T0.DocStatus WHEN 'O' THEN 'Open' WHEN 'C' THEN 'Closed' ELSE T0.DocStatus END AS Status
    FROM OINV T0
    LEFT JOIN OSLP SLP ON SLP.SlpCode = T0.SlpCode
    LEFT JOIN NNM1 NNM ON NNM.ObjectCode = '13' AND NNM.Series = T0.Series
    WHERE T0.DocEntry = @docEntry AND T0.DocType = 'S'
  `, { docEntry }));

  if (!headerRows.length) throw new Error('Service A/R Invoice not found');
  const header = headerRows[0];

  const lineRows = await safe(db.query(`
    SELECT
      T0.LineNum,
      T0.AcctCode,
      ACT.AcctName,
      T0.Dscription,
      T0.OcrCode,
      T0.TaxCode,
      T0.LineTotal,
      T0.VatSum,
      T0.Price,
      T0.Quantity,
      T0.BaseEntry,
      T0.BaseType,
      T0.BaseLine,
      T0.SACEntry,
      CHP.ChapterID AS SAC
    FROM INV1 T0
    LEFT JOIN OACT ACT ON ACT.AcctCode = T0.AcctCode
    LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.SACEntry
    WHERE T0.DocEntry = @docEntry
    ORDER BY T0.LineNum
  `, { docEntry }));

  const [headerUdfs, lineUdfsByLineNum] = await Promise.all([
    getHeaderUdfValues({ tableId: 'OINV', keyValue: docEntry }),
    getLineUdfValues({ tableId: 'INV1', keyValue: docEntry }),
  ]);
  const sacLookup = await hsnCodeDbService.getSACCodes('', 5000, 0);
  const sacByEntry = new Map(sacLookup.map((sac) => [String(sac.absEntry ?? ''), sac.serviceCode || sac.code || '']));

  return {
    service_ar_invoice: {
      doc_entry: header.DocEntry,
      doc_num: header.DocNum,
      header: {
        vendor: header.CardCode || '',
        customerCode: header.CardCode || '',
        name: header.CardName || '',
        contactPerson: header.CntctCode ? String(header.CntctCode) : '',
        salesContractNo: header.NumAtCard || '',
        currency: header.DocCur || 'INR',
        transactionType: 'GST Tax Invoice',
        docNo: header.DocNum ? String(header.DocNum) : '',
        status: header.Status || 'Open',
        series: header.Series ? String(header.Series) : '',
        seriesName: header.SeriesName || '',
        nextNumber: header.DocNum ? String(header.DocNum) : '',
        postingDate: formatDate(header.DocDate),
        deliveryDate: formatDate(header.DocDueDate),
        documentDate: formatDate(header.TaxDate),
        branch: header.BPLId ? String(header.BPLId) : '',
        paymentTerms: header.GroupNum ? String(header.GroupNum) : '',
        remarks: header.Comments || '',
        otherInstruction: header.Comments || '',
        journalRemark: header.JrnlMemo || '',
        discount: header.DiscPrcnt != null ? String(header.DiscPrcnt) : '',
        freight: header.TotalExpns != null ? String(header.TotalExpns) : '',
        tax: header.VatSum != null ? String(header.VatSum) : '',
        totalPaymentDue: header.DocTotal != null ? String(header.DocTotal) : '',
        salesEmployee: header.SlpCode != null ? String(header.SlpCode) : '',
        purchaser: header.SlpName || '',
      },
      lines: lineRows.map((line) => {
        const udf = lineUdfsByLineNum[line.LineNum] || {};
        return {
          baseEntry: line.BaseEntry ?? null,
          baseType: line.BaseType ?? null,
          baseLine: line.BaseLine ?? null,
          sac: line.SAC || sacByEntry.get(String(line.SACEntry ?? '')) || (line.SACEntry != null ? String(line.SACEntry) : ''),
          description: line.Dscription || '',
          glAccount: line.AcctCode || '',
          glAccountName: line.AcctName || '',
          distRule: line.OcrCode || '',
          taxCode: line.TaxCode || '',
          wtaxLiable: '',
          totalLC: line.LineTotal != null ? String(line.LineTotal) : '',
          taxAmountLC: line.VatSum != null ? String(line.VatSum) : '',
          loc: '',
          unitPrice: line.Price != null ? String(line.Price) : '',
          sQty: line.Quantity != null ? String(line.Quantity) : '',
          udf,
          ...mapUdfToAliases(udf),
        };
      }),
      header_udfs: headerUdfs,
    },
  };
};

const getOpenServiceDocuments = async ({ table, customerCode = '' }) => {
  const params = {};
  const cardFilter = String(customerCode || '').trim() ? 'AND T0.CardCode = @customerCode' : '';
  if (cardFilter) params.customerCode = String(customerCode).trim();

  return safe(db.query(`
    SELECT TOP 200
      T0.DocEntry, T0.DocNum, T0.CardCode, T0.CardName,
      T0.DocDate, T0.DocDueDate, T0.Comments, T0.DocTotal
    FROM ${table} T0
    WHERE T0.DocStatus = 'O'
      AND ISNULL(T0.CANCELED, 'N') <> 'Y'
      AND T0.DocType = 'S'
      ${cardFilter}
    ORDER BY T0.DocDate DESC, T0.DocNum DESC
  `, params));
};

const getServiceDocumentForCopy = async ({ headerTable, lineTable, docEntry, baseType }) => {
  const headerRows = await safe(db.query(`
    SELECT T0.DocEntry, T0.DocNum, T0.DocDate, T0.DocDueDate, T0.TaxDate,
      T0.CardCode, T0.CardName, T0.CntctCode, T0.NumAtCard, T0.Comments,
      T0.BPLId, T0.BPL_IDAssignedToInvoice, T0.GroupNum, T0.SlpCode,
      T0.DiscPrcnt, T0.TotalExpns AS Freight
    FROM ${headerTable} T0
    WHERE T0.DocEntry = @docEntry AND T0.DocType = 'S'
  `, { docEntry }));

  const lineRows = await safe(db.query(`
    SELECT
      T0.LineNum,
      T0.AcctCode AS AccountCode,
      ACT.AcctName AS AccountName,
      T0.Dscription AS ItemDescription,
      T0.Quantity,
      T0.Price AS UnitPrice,
      T0.TaxCode,
      T0.OcrCode AS DistributionRule,
      T0.LineTotal,
      T0.VatSum AS TaxAmount,
      T0.SACEntry,
      CHP.ChapterID AS SAC,
      T0.DocEntry AS BaseEntry,
      T0.LineNum AS BaseLine,
      @baseType AS BaseType
    FROM ${lineTable} T0
    LEFT JOIN OACT ACT ON ACT.AcctCode = T0.AcctCode
    LEFT JOIN OCHP CHP ON CHP.AbsEntry = T0.SACEntry
    WHERE T0.DocEntry = @docEntry
      AND ISNULL(T0.LineStatus, 'O') = 'O'
    ORDER BY T0.LineNum
  `, { docEntry, baseType }));

  const sacLookup = await hsnCodeDbService.getSACCodes('', 5000, 0);
  const sacByEntry = new Map(sacLookup.map((sac) => [String(sac.absEntry ?? ''), sac.serviceCode || sac.code || '']));

  return {
    ...(headerRows[0] || {}),
    DocumentLines: lineRows.map((line) => ({
      ...line,
      SAC: line.SAC || sacByEntry.get(String(line.SACEntry ?? '')) || line.SAC,
    })),
  };
};

module.exports = {
  getReferenceData,
  getCustomerDetails: arInvoiceDb.getCustomerDetails,
  getCustomerFilterOptions: null,
  getDocumentSeries: arInvoiceDb.getDocumentSeries,
  getNextNumber: arInvoiceDb.getNextNumber,
  getServiceARInvoiceList,
  getServiceARInvoice,
  getMarketingDocumentUdfs,
  getOpenServiceSalesQuotations: (customerCode) => getOpenServiceDocuments({ table: 'OQUT', customerCode }),
  getOpenServiceSalesOrders: (customerCode) => getOpenServiceDocuments({ table: 'ORDR', customerCode }),
  getOpenServiceDeliveries: (customerCode) => getOpenServiceDocuments({ table: 'ODLN', customerCode }),
  getServiceSalesQuotationForCopy: (docEntry) => getServiceDocumentForCopy({ headerTable: 'OQUT', lineTable: 'QUT1', docEntry, baseType: 23 }),
  getServiceSalesOrderForCopy: (docEntry) => getServiceDocumentForCopy({ headerTable: 'ORDR', lineTable: 'RDR1', docEntry, baseType: 17 }),
  getServiceDeliveryForCopy: (docEntry) => getServiceDocumentForCopy({ headerTable: 'ODLN', lineTable: 'DLN1', docEntry, baseType: 15 }),
};
