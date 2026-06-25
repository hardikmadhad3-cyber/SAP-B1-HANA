import { BASE_MATRIX_COLUMNS } from '../../config/salesOrderForm';

export const SALES_ORDER_LAYOUT_DOCUMENT_TYPE = 'SALES_ORDER';
export const SALES_QUOTATION_LAYOUT_DOCUMENT_TYPE = 'SALES_QUOTATION';
export const DELIVERY_LAYOUT_DOCUMENT_TYPE = 'DELIVERY';
export const AR_INVOICE_LAYOUT_DOCUMENT_TYPE = 'AR_INVOICE';
export const AR_CREDIT_MEMO_LAYOUT_DOCUMENT_TYPE = 'AR_CREDIT_MEMO';
export const SALES_ORDER_LINE_NUMBER_KEY = '__lineNumber';

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const normalizeUdfKey = (value) => {
  let normalized = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '');
  if (!normalized) return '';
  if (!normalized.startsWith('U_')) {
    normalized = `U_${normalized.replace(/^_+/, '')}`;
  }
  return normalized;
};

const mapLayoutDataTypeToInputType = (dataType = '') => {
  const normalized = String(dataType || '').trim().toLowerCase();
  if (['number', 'numeric', 'decimal', 'float', 'int', 'integer'].includes(normalized)) return 'number';
  if (['date', 'datetime'].includes(normalized)) return 'date';
  if (['textarea', 'memo'].includes(normalized)) return 'textarea';
  if (['checkbox', 'boolean', 'bit'].includes(normalized)) return 'checkbox';
  return 'text';
};

const SAP_FIELD_TO_INTERNAL_KEY = {
  LINENUM: SALES_ORDER_LINE_NUMBER_KEY,
  ITEMCODE: 'itemNo',
  DSCRIPTION: 'itemDescription',
  QUANTITY: 'quantity',
  REQQTY: 'requiredQty',
  REQDATE: 'requiredDate',
  SHIPDATE: 'quotedDate',
  UOMNAME: 'uomName',
  UNITMSR: 'uomName',
  UOMCODE: 'uomCode',
  HSN: 'hsnCode',
  HSNCODE: 'hsnCode',
  HSNENTRY: 'hsnCode',
  PRICE: 'unitPrice',
  PRICEBEFDI: 'unitPrice',
  UNITPRICE: 'unitPrice',
  U_PRICE: 'price',
  U_TAXCODE: 'taxCodeRepeat',
  U_UNITPRICE: 'unitPriceUdf',
  U_UNIT_PRICE: 'unitPriceUdf',
  RATE: 'forRate',
  FORRATE: 'forRate',
  FORPRICE: 'forRate',
  FOR_PRICE: 'forRate',
  VATGROUP: 'taxCode',
  TAXCODE: 'taxCode',
  WTLIABLE: 'wTaxLiable',
  TAXONLY: 'taxLiable',
  LINETOTAL: 'totalLC',
  GTOTAL: 'totalLC',
  TOTAL: 'totalLC',
  PACKQTY: 'noOfPackages',
  NUMOFPACKS: 'noOfPackages',
  VATSUM: 'taxAmount',
  TAXAMOUNT: 'taxAmount',
  TAXAMOUNTLC: 'taxAmount',
  'TAXAMOUNT(LC)': 'taxAmount',
  'TAX AMOUNT(LC)': 'taxAmount',
  'TAX AMOUNT LC': 'taxAmount',
  TAXAMOUNT_LC: 'taxAmount',
  TAXAMOUNTLC_: 'taxAmount',
  TAXAMOUNT_LC_: 'taxAmount',
  TAXAMOUNTLC__:'taxAmount',
  BINALLOC: 'binLocationAllocation',
  BINALLOCATION: 'binLocationAllocation',
  BINLOCATIONALLOCATION: 'binLocationAllocation',
  COMMPERCENT: 'commPercent',
  COMMPRCNT: 'commPercent',
  COMMISSIONPERCENT: 'commPercent',
  ASSESSABLEVALUE: 'assessableValue',
  ASSESSABLEVALUEINR: 'assessableValue',
  PRICEAFTERDISCOUNT: 'priceAfterDiscount',
  ITEMCOST: 'itemCost',
  ACCTCODE: 'glAccount',
  DISCPRCNT: 'stdDiscount',
  DELIVRDQTY: 'deliveredQty',
  WHSCODE: 'whse',
  OCRCODE: 'distRule',
  COGSOCRCOD: 'cogsDistRule',
  WEIGHT1: 'weight',
  WEIGHT: 'weight',
  OPENQTY: 'openQty',
  COUNTRYORG: 'countryOfOrigin',
  FREETXT: 'freeText',
  SACCODE: 'sacCode',
  SACENTRY: 'sacCode',
  WITHOUTQTYPOSTING: 'withoutQtyPosting',
  WITHOUTINVENTORYMOVEMENT: 'withoutQtyPosting',
  ENSETCOST: 'enableSettingCost',
  RETCOST: 'returnCost',
  AGRNO: 'blanketAgreementNo',
  AGRLINENUM: 'blanketAgreementNo',
  INVQTY: 'qtyInventoryUom',
  NUMPERMSR: 'changeQtyInvUomIndependently',
  UOMENTRY: 'uomGroup',
  LOCCODE: 'loc',
  BPLID: 'branch',
  U_SPLRBT: 'specialRebate',
  U_COMPRC: 'commission',
  U_S_BROKPERQTY: 'sellerBrokeragePerQty',
  U_BROK_SELLER: 'sellerBrokerage',
  U_BROK_BUYER: 'buyerBrokerage',
  U_BUYER_DELIVERY: 'buyerDelivery',
  U_SELLER_DELIVERY: 'sellerDelivery',
  U_BUYER_PAYMENT_TERMS: 'buyerPaymentTerms',
  U_SELLER_PAYMENT_TERM: 'sellerPaymentTerms',
  U_SELLER_PAYMENT_TERMS: 'sellerPaymentTerms',
  U_BUYER_QUALITY: 'buyerQuality',
  U_SELLER_QUALITY: 'sellerQuality',
  U_BUYER_PRICE: 'buyerPrice',
  U_SELLER_PRICE: 'sellerPrice',
  U_BUYER_SPINS: 'buyerSpecialInstruction',
  U_SELLER_SPINS: 'sellerSpecialInstruction',
  U_SEL_BROK_AP: 'sellerBrokerageAmtPer',
  U_SELLER_BROK_PER: 'sellerBrokeragePercent',
  U_BUYER_BILL_DISC: 'buyerBillDiscount',
  U_SELLER_BILL_DISC: 'sellerBillDiscount',
  U_SELLTCODE: 'stcode',
  U_STCODE: 'stcode',
  U_S_ITEM: 'sellerItem',
  U_SITEM: 'sellerItem',
  U_S_QTY: 'sellerQty',
  U_FREIGHT_PUR: 'freightPurchase',
  U_FREIGHT_SALES: 'freightSales',
  U_FR_TRANS: 'freightProvider',
  U_FR_TRANS_NAME: 'freightProviderName',
  U_BDNUM: 'brokerageNumber',
  U_DOCKEY: 'documentCreated',
  U_PACKINGTYPE: 'U_PackingType',
  U_PACKING_TYPE: 'U_PackingType',
  U_GROSSWT: 'U_GrossWt',
  U_GROSS_WT: 'U_GrossWt',
  U_TOTALPACKAGE: 'U_TotalPackage',
  U_TOTAL_PACKAGE: 'U_TotalPackage',
  U_CONTAINERTYPE: 'U_ContainerType',
  U_CONTAINER_TYPE: 'U_ContainerType',
  U_FORRATE: 'U_ForRate',
  U_FOR_RATE: 'U_ForRate',
  U_FOR_RATE_: 'U_ForRate',
  U_FORPRICE: 'U_ForRate',
  U_FOR_PRICE: 'U_ForRate',
  U_FIXBROKBUYER: 'U_Fix_Brock_B',
  U_FIX_BROK_BUYER: 'U_Fix_Brock_B',
  U_FIXBROCKSELLER: 'U_Fix_Brock_S',
  U_FIXBROKSELLER: 'U_Fix_Brock_S',
  U_FIX_BROCK_SELLER: 'U_Fix_Brock_S',
  U_FIX_BROK_SELLER: 'U_Fix_Brock_S',
  U_COSTSHEET: 'U_Cost_Sheet',
  U_COST_SHEET: 'U_Cost_Sheet',
};

const LABEL_TO_INTERNAL_KEY = {
  '#': SALES_ORDER_LINE_NUMBER_KEY,
  ITEMNO: 'itemNo',
  ITEMDESCRIPTION: 'itemDescription',
  QUANTITY: 'quantity',
  UOMNAME: 'uomName',
  UOMCODE: 'uomCode',
  HSN: 'hsnCode',
  UNITPRICE: 'unitPrice',
  FORPRICE: 'forRate',
  TAXCODE: 'taxCode',
  TOTAL: 'totalLC',
  GROSSWT: 'U_GrossWt',
  PACKINGTYPE: 'U_PackingType',
  PACKING: 'U_PackingType',
  TOTALPACKAGE: 'U_TotalPackage',
  TOTALPACKAGES: 'U_TotalPackage',
  DISCOUNT: 'stdDiscount',
  DISC: 'stdDiscount',
  PRICE: 'price',
  PRICEAFTERDISCOUNT: 'priceAfterDiscount',
  ITEMCOST: 'itemCost',
  QTY: 'quantity',
  REQUIREDQTY: 'requiredQty',
  REQUIREDDATE: 'requiredDate',
  QUOTEDDATE: 'quotedDate',
  DELIVEREDQTY: 'deliveredQty',
  QTYTOSHIP: 'deliveredQty',
  ORDEREDQTY: 'openQty',
  WHSE: 'whse',
  DISTRRULE: 'distRule',
  DISTRIBUTIONRULE: 'distRule',
  GLACCOUNT: 'glAccount',
  WTAXLIABLE: 'wTaxLiable',
  TAXLIABLE: 'taxLiable',
  BINLOCATIONALLOCATION: 'binLocationAllocation',
  WEIGHT: 'weight',
  NOOFPACKAGES: 'noOfPackages',
  BLANKETAGREEMENTNO: 'blanketAgreementNo',
  WITHOUTQTYPOSTING: 'withoutQtyPosting',
  WITHOUTINVENTORYMOVEMENT: 'withoutQtyPosting',
  ENABLESETTINGCOST: 'enableSettingCost',
  RETURNCOSTLC: 'returnCost',
  QTYINVENTORYUOM: 'qtyInventoryUom',
  CHANGEQTYINVUOMINDEPENDENTLY: 'changeQtyInvUomIndependently',
  UOMGROUP: 'uomGroup',
  COGSDISTRULE: 'cogsDistRule',
  COUNTRYREGIONOFORIGIN: 'countryOfOrigin',
  ASSESSABLEVALUE: 'assessableValue',
  ASSESSABLEVALUEINR: 'assessableValue',
  LOC: 'loc',
  COSTSHEET: 'U_Cost_Sheet',
  CONTAINERTYPE: 'U_ContainerType',
  COMMPERCENT: 'commPercent',
  COMM: 'commPercent',
  FORRATE: 'U_ForRate',
  SELLERBROKERAGE: 'sellerBrokerage',
  BUYERBROKERAGE: 'buyerBrokerage',
  BUYERDELIVERY: 'buyerDelivery',
  SELLERDELIVERY: 'sellerDelivery',
  BUYERTERMSOFPAYMENT: 'buyerPaymentTerms',
  SELLERTERMSOFPAYMENT: 'sellerPaymentTerms',
  BUYERQUALITY: 'buyerQuality',
  SELLERQUALITY: 'sellerQuality',
  BUYERPRICE: 'buyerPrice',
  SELLERPRICE: 'sellerPrice',
  SITEM: 'sellerItem',
  SQTY: 'sellerQty',
  BROKPERQTY: 'sellerBrokeragePerQty',
  BUYERSPECIALINSTRUCTION: 'buyerSpecialInstruction',
  SELLERSPECIALINSTRUCTION: 'sellerSpecialInstruction',
  SELLERBROKERAGEAMTPER: 'sellerBrokerageAmtPer',
  SELLERBROKERAGEINPERCENTAGE: 'sellerBrokeragePercent',
  STCODE: 'stcode',
  FIXBROKBUYER: 'U_Fix_Brock_B',
  FIXBROCKSELLER: 'U_Fix_Brock_S',
  FIXBROKSELLER: 'U_Fix_Brock_S',
};

// Map common label variants for Tax Amount to internal `taxAmount` key
LABEL_TO_INTERNAL_KEY.TAXAMOUNT = 'taxAmount';
LABEL_TO_INTERNAL_KEY.TAXAMOUNTLC = 'taxAmount';
LABEL_TO_INTERNAL_KEY.TAXAMOUNT_LC = 'taxAmount';
LABEL_TO_INTERNAL_KEY['TAXAMOUNT(LC)'] = 'taxAmount';
LABEL_TO_INTERNAL_KEY['TAX AMOUNT(LC)'] = 'taxAmount';
LABEL_TO_INTERNAL_KEY['TAX AMOUNT LC'] = 'taxAmount';

// Ensure 'TAX CODE' label variants map exactly to `taxCode`
LABEL_TO_INTERNAL_KEY.TAXCODE = 'taxCode';
LABEL_TO_INTERNAL_KEY['TAX CODE'] = 'taxCode';

const STANDARD_RENDERER_KEYS = new Set([
  SALES_ORDER_LINE_NUMBER_KEY,
  'itemNo',
  'itemDescription',
  'quantity',
  'requiredQty',
  'requiredDate',
  'quotedDate',
  'uomName',
  'uomCode',
  'hsnCode',
  'unitPrice',
  'unitPriceUdf',
  'forRate',
  'taxCode',
  'taxCodeRepeat',
  'wTaxLiable',
  'taxLiable',
  'totalLC',
  'price',
  'commPercent',
  'assessableValue',
  'priceAfterDiscount',
  'itemCost',
  'binLocationAllocation',
  'noOfPackages',
  'taxAmount',
  'glAccount',
  'stdDiscount',
  'deliveredQty',
  'whse',
  'distRule',
  'cogsDistRule',
  'weight',
  'openQty',
  'countryOfOrigin',
  'freeText',
  'sacCode',
  'enableSettingCost',
  'withoutQtyPosting',
  'returnCost',
  'blanketAgreementNo',
  'qtyInventoryUom',
  'changeQtyInvUomIndependently',
  'uomGroup',
  'loc',
  'branch',
  'specialRebate',
  'commission',
  'sellerBrokeragePerQty',
  'sellerItem',
  'sellerQty',
  'sellerBrokerage',
  'buyerBrokerage',
  'buyerDelivery',
  'sellerDelivery',
  'buyerPaymentTerms',
  'sellerPaymentTerms',
  'buyerQuality',
  'sellerQuality',
  'buyerPrice',
  'sellerPrice',
  'buyerSpecialInstruction',
  'sellerSpecialInstruction',
  'sellerBrokerageAmtPer',
  'sellerBrokeragePercent',
  'stcode',
  'U_Cost_Sheet',
  'U_PackingType',
  'U_ContainerType',
  'U_GrossWt',
  'U_TotalPackage',
  'U_Fix_Brock_B',
  'U_Fix_Brock_S',
]);

const STANDARD_FIELD_OVERRIDES = {
  itemNo: { type: 'text', minWidth: 150 },
  itemDescription: { type: 'text', minWidth: 220 },
  quantity: { type: 'number', minWidth: 100, numeric: true },
  requiredQty: { type: 'number', minWidth: 110, numeric: true },
  uomName: { type: 'text', minWidth: 120, readOnly: true },
  uomCode: { type: 'text', minWidth: 105 },
  hsnCode: { type: 'text', minWidth: 105 },
  sacCode: { type: 'text', minWidth: 105 },
  unitPrice: { type: 'number', minWidth: 110, numeric: true },
  unitPriceUdf: { type: 'number', minWidth: 110, numeric: true },
  forRate: { type: 'number', minWidth: 110, numeric: true },
  taxCode: { type: 'text', minWidth: 115 },
  taxCodeRepeat: { type: 'text', minWidth: 110, readOnly: true },
  totalLC: { type: 'number', minWidth: 115, readOnly: true, numeric: true },
  price: { type: 'number', minWidth: 95, readOnly: true, numeric: true },
  priceAfterDiscount: { type: 'number', minWidth: 130, readOnly: true, numeric: true },
  itemCost: { type: 'number', minWidth: 110, readOnly: true, numeric: true },
  binLocationAllocation: { type: 'text', minWidth: 160, readOnly: true },
  stdDiscount: { type: 'number', minWidth: 95, numeric: true },
  deliveredQty: { type: 'number', minWidth: 120, numeric: true },
  whse: { type: 'text', minWidth: 120 },
  distRule: { type: 'text', minWidth: 115 },
  cogsDistRule: { type: 'text', minWidth: 130 },
  openQty: { type: 'number', minWidth: 110, numeric: true },
  blanketAgreementNo: { type: 'text', minWidth: 150 },
  withoutQtyPosting: { type: 'yesNo', minWidth: 145 },
  enableSettingCost: { type: 'checkbox', minWidth: 140 },
  returnCost: { type: 'number', minWidth: 125, numeric: true },
  commPercent: { type: 'number', minWidth: 95, numeric: true },
  assessableValue: { type: 'number', minWidth: 150, numeric: true },
  U_GrossWt: { type: 'number', minWidth: 110, numeric: true },
  U_TotalPackage: { type: 'number', minWidth: 130, numeric: true },
  U_Fix_Brock_B: { type: 'number', minWidth: 135, numeric: true },
  U_Fix_Brock_S: { type: 'number', minWidth: 140, numeric: true },
  documentCreated: { type: 'date', minWidth: 140, readOnly: true },
};

const buildLiveFieldMap = (fields = []) => {
  const map = new Map();

  (fields || []).forEach((field) => {
    if (!field?.key) return;
    [
      field.key,
      field.sapField,
      field.fieldName,
      field.label,
    ]
      .map(normalizeToken)
      .filter(Boolean)
      .forEach((token) => {
        if (!map.has(token)) {
          map.set(token, field);
        }
      });
  });

  return map;
};

const buildRowUdfMap = (fields = []) => {
  const map = new Map();

  (fields || []).forEach((field) => {
    if (!field?.key) return;
    [
      field.key,
      field.sapField,
      field.aliasId,
      field.label,
    ]
      .map((value) => (String(value || '').startsWith('U_') ? normalizeUdfKey(value) : normalizeToken(value)))
      .filter(Boolean)
      .forEach((token) => {
        if (!map.has(token)) {
          map.set(token, field);
        }
      });
  });

  return map;
};

const findInternalKey = (layoutColumn, liveFieldMap) => {
  const fieldToken = normalizeToken(layoutColumn.fieldName || layoutColumn.columnUid);
  const labelToken = normalizeToken(layoutColumn.columnTitle);
  const rawTitle = String(layoutColumn.columnTitle || '').trim();
  const rawFieldName = String(layoutColumn.fieldName || layoutColumn.columnUid || '').trim();
  const rawFieldNameUpper = rawFieldName.toUpperCase();

  if (labelToken === 'TAXCODE' && rawTitle && !/\s/.test(rawTitle)) {
    return 'taxCodeRepeat';
  }

  if (labelToken === 'PRICE' && rawTitle.toUpperCase() === 'PRICE' && rawFieldNameUpper.startsWith('U_')) {
    return 'price';
  }

  if (rawFieldNameUpper.startsWith('U_') && normalizeUdfKey(rawFieldName) === 'U_TAXCODE') {
    return 'taxCodeRepeat';
  }

  if (rawFieldNameUpper.startsWith('U_') && normalizeUdfKey(rawFieldName) === 'U_PRICE') {
    return 'price';
  }

  if (['U_FORRATE', 'U_FOR_RATE', 'U_FORPRICE', 'U_FOR_PRICE'].includes(normalizeUdfKey(rawFieldName))) {
    return 'forRate';
  }

  const labelMappedKey = LABEL_TO_INTERNAL_KEY[labelToken];
  if (labelMappedKey && [
    'DISTRRULE',
    'DISTRIBUTIONRULE',
    'PACKINGTYPE',
    'PACKING',
    'TAXCODE',
  ].includes(labelToken)) {
    return labelMappedKey;
  }

  return (
    SAP_FIELD_TO_INTERNAL_KEY[fieldToken]
    || labelMappedKey
    || liveFieldMap.get(fieldToken)?.key
    || liveFieldMap.get(labelToken)?.key
    || ''
  );
};

const buildSyntheticColumn = (layoutColumn, key, extras = {}) => ({
  key,
  valueKey: extras.valueKey || key,
  rendererKey: extras.rendererKey || key,
  fieldName: layoutColumn.fieldName || layoutColumn.columnUid || key,
  layoutFieldName: layoutColumn.fieldName || layoutColumn.columnUid || key,
  label: layoutColumn.columnTitle || extras.label || key,
  visible: layoutColumn.visible !== false,
  active: layoutColumn.editable !== false,
  readOnly: extras.readOnly ?? (layoutColumn.editable === false),
  minWidth: Number(layoutColumn.width) || extras.minWidth || 125,
  width: Number(layoutColumn.width) || extras.minWidth || 125,
  order: Number(layoutColumn.columnOrder) || extras.order || 0,
  columnOrder: Number(layoutColumn.columnOrder) || extras.order || 0,
  sapControlled: layoutColumn.source !== 'fallback',
  importedLayout: true,
  source: layoutColumn.source || 'imported-layout',
  type: extras.type || mapLayoutDataTypeToInputType(layoutColumn.dataType),
  numeric: extras.numeric || false,
  isUdf: extras.isUdf || false,
  lookupSource: extras.lookupSource,
  lookupTable: extras.lookupTable,
  options: extras.options,
  field: extras.field,
});

const buildGenericUdfField = (layoutColumn, fieldName) => ({
  key: fieldName,
  sapField: fieldName,
  label: layoutColumn.columnTitle || fieldName,
  type: mapLayoutDataTypeToInputType(layoutColumn.dataType),
  options: [],
  readOnly: layoutColumn.editable === false,
  active: layoutColumn.editable !== false,
});

const withUniqueLayoutKeys = (columns = []) => {
  const counts = new Map();

  return (columns || []).map((column, index) => {
    const baseKey = column.key || column.valueKey || column.fieldName || `layout_${index + 1}`;
    const count = counts.get(baseKey) || 0;
    counts.set(baseKey, count + 1);

    const valueKey = column.valueKey || baseKey;
    const rendererKey = column.rendererKey || valueKey;
    if (count === 0) {
      return {
        ...column,
        key: baseKey,
        valueKey,
        rendererKey,
      };
    }

    return {
      ...column,
      key: `${baseKey}__layout_${index + 1}`,
      valueKey,
      rendererKey,
    };
  });
};

export const buildSalesOrderMatrixColumnsFromLayout = ({
  layoutColumns = [],
  liveMatrixColumns = [],
  rowUdfFields = [],
  includeLineNumber = true,
} = {}) => {
  if (!Array.isArray(layoutColumns) || !layoutColumns.length) {
    return Array.isArray(liveMatrixColumns) && liveMatrixColumns.length
      ? liveMatrixColumns
      : BASE_MATRIX_COLUMNS;
  }

  const liveFieldMap = buildLiveFieldMap(liveMatrixColumns);
  const rowUdfMap = buildRowUdfMap(rowUdfFields);

  const mappedColumns = layoutColumns.map((layoutColumn, index) => {
    const internalKey = findInternalKey(layoutColumn, liveFieldMap);
    const fieldName = String(layoutColumn.fieldName || layoutColumn.columnUid || '').trim();
    const udfField = rowUdfMap.get(normalizeUdfKey(fieldName)) || rowUdfMap.get(normalizeToken(layoutColumn.columnTitle));
    const liveField = internalKey ? liveFieldMap.get(normalizeToken(internalKey)) || liveMatrixColumns.find((field) => field.key === internalKey) : null;
    const layoutIsUdf = Boolean(layoutColumn.isUdf) || fieldName.toUpperCase().startsWith('U_');

    if (internalKey === SALES_ORDER_LINE_NUMBER_KEY) {
      if (!includeLineNumber) return null;
      return buildSyntheticColumn(layoutColumn, SALES_ORDER_LINE_NUMBER_KEY, {
        label: '#',
        readOnly: true,
        minWidth: 42,
        order: index + 1,
        type: 'number',
      });
    }

    if (udfField && layoutIsUdf) {
      return buildSyntheticColumn(layoutColumn, udfField.key, {
        label: layoutColumn.columnTitle || udfField.label,
        readOnly: Boolean(udfField.readOnly) || layoutColumn.editable === false,
        minWidth: Number(layoutColumn.width) || (udfField.type === 'textarea' ? 180 : 125),
        order: Number(layoutColumn.columnOrder) || index + 1,
        type: udfField.type,
        isUdf: true,
        lookupSource: udfField.lookupSource,
        lookupTable: udfField.lookupTable,
        options: udfField.options,
        field: udfField,
      });
    }

    if (liveField && STANDARD_RENDERER_KEYS.has(internalKey)) {
      const standardOverride = STANDARD_FIELD_OVERRIDES[internalKey] || {};
      return {
        ...liveField,
        ...standardOverride,
        key: liveField.key,
        valueKey: liveField.key,
        rendererKey: liveField.key,
        fieldName,
        layoutFieldName: fieldName,
        label: layoutColumn.columnTitle || liveField.label || liveField.key,
        visible: layoutColumn.visible !== false,
        active: layoutColumn.editable !== false,
        minWidth: Number(layoutColumn.width) || standardOverride.minWidth || liveField.minWidth || 125,
        width: Number(layoutColumn.width) || standardOverride.minWidth || liveField.minWidth || 125,
        order: Number(layoutColumn.columnOrder) || index + 1,
        columnOrder: Number(layoutColumn.columnOrder) || index + 1,
        sapControlled: layoutColumn.source !== 'fallback' && liveField.sapControlled !== false,
        importedLayout: true,
        source: layoutColumn.source || 'imported-layout',
        isUdf: false,
      };
    }

    if (!liveField && internalKey && STANDARD_RENDERER_KEYS.has(internalKey)) {
      return buildSyntheticColumn(layoutColumn, internalKey, {
        ...(STANDARD_FIELD_OVERRIDES[internalKey] || {}),
        label: layoutColumn.columnTitle || internalKey,
        order: Number(layoutColumn.columnOrder) || index + 1,
      });
    }

    if (liveField) {
      return {
        ...liveField,
        key: liveField.key,
        valueKey: liveField.key,
        rendererKey: liveField.key,
        fieldName,
        layoutFieldName: fieldName,
        label: layoutColumn.columnTitle || liveField.label || liveField.key,
        visible: layoutColumn.visible !== false,
        active: layoutColumn.editable !== false,
        minWidth: Number(layoutColumn.width) || liveField.minWidth || 125,
        width: Number(layoutColumn.width) || liveField.minWidth || 125,
        order: Number(layoutColumn.columnOrder) || index + 1,
        columnOrder: Number(layoutColumn.columnOrder) || index + 1,
        sapControlled: layoutColumn.source !== 'fallback' && liveField.sapControlled !== false,
        importedLayout: true,
        source: layoutColumn.source || 'imported-layout',
      };
    }

    if (udfField) {
      return buildSyntheticColumn(layoutColumn, udfField.key, {
        label: udfField.label || layoutColumn.columnTitle,
        readOnly: Boolean(udfField.readOnly) || layoutColumn.editable === false,
        minWidth: udfField.type === 'textarea' ? 180 : 125,
        order: index + 1,
        type: udfField.type,
        isUdf: true,
        lookupSource: udfField.lookupSource,
        lookupTable: udfField.lookupTable,
        options: udfField.options,
      });
    }

    if (fieldName.toUpperCase().startsWith('U_')) {
      const genericField = buildGenericUdfField(layoutColumn, fieldName);
      return buildSyntheticColumn(layoutColumn, fieldName, {
        order: index + 1,
        isUdf: true,
        field: genericField,
        type: genericField.type,
      });
    }

    // Skip unknown layout fields that cannot be rendered by the UI.
    return null;
  });

  // Ensure Tax Code appears before Tax Amount to match SAP B1 default ordering
  const filtered = mappedColumns.filter(Boolean);
  try {
    const taxCodeIdx = filtered.findIndex((c) => (c.key || '').toString().toLowerCase() === 'taxcode' || (c.fieldName || '').toString().toLowerCase().includes('taxcode'));
    const taxAmountIdx = filtered.findIndex((c) => (c.key || '').toString().toLowerCase() === 'taxamount' || (c.fieldName || '').toString().toLowerCase().includes('taxamount') || (c.label || '').toString().toLowerCase().includes('tax amount'));
    if (taxCodeIdx >= 0 && taxAmountIdx >= 0 && taxAmountIdx < taxCodeIdx) {
      // swap their order values so taxCode renders earlier
      const tmpOrder = Number(filtered[taxCodeIdx].order || filtered[taxCodeIdx].columnOrder || taxCodeIdx + 1);
      filtered[taxCodeIdx].order = Number(filtered[taxAmountIdx].order || filtered[taxAmountIdx].columnOrder || taxAmountIdx + 1);
      filtered[taxAmountIdx].order = tmpOrder;
    }
  } catch (e) {
    // swallow any errors — ordering is best-effort
    // console.debug('layout ordering adjust failed', e);
  }

  return withUniqueLayoutKeys(filtered);
};
