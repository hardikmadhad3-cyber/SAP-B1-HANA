import { BASE_MATRIX_COLUMNS } from '../../config/salesOrderForm';

export const SALES_ORDER_LAYOUT_DOCUMENT_TYPE = 'SALES_ORDER';
export const SALES_ORDER_LINE_NUMBER_KEY = '__lineNumber';

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

const normalizeUdfKey = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  return normalized.startsWith('U_') ? normalized : `U_${normalized}`;
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
  UOMNAME: 'uomName',
  UNITMSR: 'uomName',
  UOMCODE: 'uomCode',
  HSN: 'hsnCode',
  HSNCODE: 'hsnCode',
  HSNENTRY: 'hsnCode',
  PRICE: 'unitPrice',
  PRICEBEFDI: 'unitPrice',
  UNITPRICE: 'unitPrice',
  VATGROUP: 'taxCode',
  TAXCODE: 'taxCode',
  LINETOTAL: 'totalLC',
  TOTAL: 'totalLC',
  VATSUM: 'taxAmount',
  DISCPRCNT: 'stdDiscount',
  DELIVRDQTY: 'deliveredQty',
  WHSCODE: 'whse',
  OCRCODE: 'distRule',
  OPENQTY: 'openQty',
  COUNTRYORG: 'countryOfOrigin',
  FREETXT: 'freeText',
  SACCODE: 'sacCode',
  SACENTRY: 'sacCode',
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
  U_S_ITEM: 'sellerItem',
  U_S_QTY: 'sellerQty',
  U_FREIGHT_PUR: 'freightPurchase',
  U_FREIGHT_SALES: 'freightSales',
  U_FR_TRANS: 'freightProvider',
  U_FR_TRANS_NAME: 'freightProviderName',
  U_BDNUM: 'brokerageNumber',
  U_DOCKEY: 'documentCreated',
  U_PACKINGTYPE: 'U_PackingType',
  U_GROSSWT: 'U_GrossWt',
  U_TOTALPACKAGE: 'U_TotalPackage',
  U_FORRATE: 'U_ForRate',
  U_FIXBROKBUYER: 'U_FIX_BROK_BUYER',
  U_FIXBROCKSELLER: 'U_Fix_Brock_Seller',
  U_FIXBROKSELLER: 'U_Fix_Brock_Seller',
  U_COSTSHEET: 'U_Cost_Sheet',
};

const LABEL_TO_INTERNAL_KEY = {
  '#': SALES_ORDER_LINE_NUMBER_KEY,
  ITEMNO: 'itemNo',
  ITEMDESCRIPTION: 'itemDescription',
  QUANTITY: 'quantity',
  UOMNAME: 'uomName',
  HSN: 'hsnCode',
  UNITPRICE: 'unitPrice',
  TAXCODE: 'taxCode',
  TOTAL: 'totalLC',
  GROSSWT: 'U_GrossWt',
  PACKINGTYPE: 'U_PackingType',
  TOTALPACKAGE: 'U_TotalPackage',
  DISCOUNT: 'stdDiscount',
  DELIVEREDQTY: 'deliveredQty',
  WHSE: 'whse',
  FORRATE: 'U_ForRate',
  SITEM: 'sellerItem',
  SQTY: 'sellerQty',
  BROKPERQTY: 'sellerBrokeragePerQty',
  BUYERSPECIALINSTRUCTION: 'buyerSpecialInstruction',
  SELLERSPECIALINSTRUCTION: 'sellerSpecialInstruction',
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

  return (
    SAP_FIELD_TO_INTERNAL_KEY[fieldToken]
    || LABEL_TO_INTERNAL_KEY[labelToken]
    || liveFieldMap.get(fieldToken)?.key
    || liveFieldMap.get(labelToken)?.key
    || ''
  );
};

const buildSyntheticColumn = (layoutColumn, key, extras = {}) => ({
  key,
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
  sapControlled: true,
  importedLayout: true,
  source: layoutColumn.source || 'imported-layout',
  type: extras.type || mapLayoutDataTypeToInputType(layoutColumn.dataType),
  numeric: extras.numeric || false,
  isUdf: extras.isUdf || false,
  lookupSource: extras.lookupSource,
  lookupTable: extras.lookupTable,
  options: extras.options,
});

export const buildSalesOrderMatrixColumnsFromLayout = ({
  layoutColumns = [],
  liveMatrixColumns = [],
  rowUdfFields = [],
} = {}) => {
  if (!Array.isArray(layoutColumns) || !layoutColumns.length) {
    return Array.isArray(liveMatrixColumns) && liveMatrixColumns.length
      ? liveMatrixColumns
      : BASE_MATRIX_COLUMNS;
  }

  const liveFieldMap = buildLiveFieldMap(liveMatrixColumns);
  const rowUdfMap = buildRowUdfMap(rowUdfFields);

  return layoutColumns.map((layoutColumn, index) => {
    const internalKey = findInternalKey(layoutColumn, liveFieldMap);
    const fieldName = String(layoutColumn.fieldName || layoutColumn.columnUid || '').trim();
    const udfField = rowUdfMap.get(normalizeUdfKey(fieldName)) || rowUdfMap.get(normalizeToken(layoutColumn.columnTitle));
    const liveField = internalKey ? liveFieldMap.get(normalizeToken(internalKey)) || liveMatrixColumns.find((field) => field.key === internalKey) : null;

    if (internalKey === SALES_ORDER_LINE_NUMBER_KEY) {
      return buildSyntheticColumn(layoutColumn, SALES_ORDER_LINE_NUMBER_KEY, {
        label: '#',
        readOnly: true,
        minWidth: 42,
        order: index + 1,
        type: 'number',
      });
    }

    if (liveField) {
      return {
        ...liveField,
        key: liveField.key,
        fieldName,
        layoutFieldName: fieldName,
        label: layoutColumn.columnTitle || liveField.label || liveField.key,
        visible: layoutColumn.visible !== false,
        active: layoutColumn.editable !== false,
        minWidth: Number(layoutColumn.width) || liveField.minWidth || 125,
        width: Number(layoutColumn.width) || liveField.minWidth || 125,
        order: Number(layoutColumn.columnOrder) || index + 1,
        columnOrder: Number(layoutColumn.columnOrder) || index + 1,
        sapControlled: true,
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
      return buildSyntheticColumn(layoutColumn, fieldName, {
        order: index + 1,
        isUdf: true,
      });
    }

    return buildSyntheticColumn(layoutColumn, fieldName || `layout_${index + 1}`, {
      order: index + 1,
    });
  });
};
