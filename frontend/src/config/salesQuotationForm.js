const FORM_SETTINGS_STORAGE_KEY = 'sapb1.salesQuotation.formSettings.v1';

const HEADER_UDF_DEFINITIONS = [
  { key: 'U_SCharge', label: 'SaudaCharge', type: 'text', defaultValue: '' },
  { key: 'U_TRNS', label: 'Transporter', type: 'text', defaultValue: '' },
  { key: 'U_LRNO', label: 'LR No', type: 'text', defaultValue: '' },
  { key: 'U_LRDT', label: 'LR Date', type: 'date', defaultValue: '' },
  { key: 'U_DSTN', label: 'Destination', type: 'text', defaultValue: '' },
  { key: 'U_DSTNADD', label: 'Destination Address', type: 'text', defaultValue: '' },
  { key: 'U_FDSTN', label: 'Final Destination', type: 'text', defaultValue: '' },
  { key: 'U_VEHNO', label: 'Vehicle No', type: 'text', defaultValue: '' },
  { key: 'U_DOCTHR', label: 'Dispatch Through', type: 'text', defaultValue: '' },
  { key: 'U_UOM', label: 'UOM', type: 'text', defaultValue: '' },
  { key: 'U_Price', label: 'Price', type: 'text', defaultValue: '' },
  { key: 'U_SAmount', label: 'Sauda Amount', type: 'text', defaultValue: '' },
  { key: 'U_B_FromDate', label: 'B_FromDate', type: 'date', defaultValue: '' },
  { key: 'U_B_ToDate', label: 'B_ToDate', type: 'date', defaultValue: '' },
  { key: 'U_Seller_Code', label: 'Seller Code', type: 'text', defaultValue: '' },
  { key: 'U_Seller_Name', label: 'Seller Name', type: 'text', defaultValue: '' },
  { key: 'U_Seller_AddressId', label: 'Seller Address Id (Ship From)', type: 'text', defaultValue: '' },
  { key: 'U_Seller_Address', label: 'Seller Address', type: 'textarea', defaultValue: '' },
  { key: 'U_Old_Soda_Nodh_No', label: 'Old Soda Nodh No.', type: 'text', defaultValue: '' },
  { key: 'U_Old_Soda_Nodh_Date', label: 'Old Soda Nodh Date', type: 'date', defaultValue: '' },
  {
    key: 'U_Canceled',
    label: 'Canceled IRN',
    type: 'select',
    required: true,
    defaultValue: 'N',
    options: [
      { value: '', label: '' },
      { value: 'Y', label: 'Yes' },
      { value: 'N', label: 'No' },
    ],
  },
  { key: 'U_TrfId', label: 'Transporter ID', type: 'text', defaultValue: '' },
  { key: 'U_TrfName', label: 'Transporter Name', type: 'text', defaultValue: '' },
  { key: 'U_TrfVehi', label: 'Vehicle No', type: 'text', defaultValue: '' },
  { key: 'U_TrfDist', label: 'Distance', type: 'text', defaultValue: '' },
  {
    key: 'U_TrfMode',
    label: 'Transporter Mode',
    type: 'select',
    required: true,
    defaultValue: '1',
    options: [
      { value: '', label: '' },
      { value: '1', label: 'Road' },
      { value: '2', label: 'Rail' },
      { value: '3', label: 'Air' },
      { value: '4', label: 'Ship' },
    ],
  },
  {
    key: 'U_TrfVType',
    label: 'Transporter Vehicle Type',
    type: 'select',
    required: true,
    defaultValue: 'R',
    options: [
      { value: '', label: '' },
      { value: 'R', label: 'Regular' },
      { value: 'O', label: 'ODC' },
    ],
  },
  { key: 'U_AckNo', label: 'Acknowledgement No', type: 'text', defaultValue: '' },
  { key: 'U_AckDt', label: 'Acknowledgement Dt', type: 'text', defaultValue: '' },
  { key: 'U_CanDt', label: 'Cancel Dt', type: 'text', defaultValue: '' },
  { key: 'U_QrCode', label: 'Signed QRCode', type: 'textarea', defaultValue: '' },
  { key: 'U_SigInv', label: 'Signed Invoice', type: 'textarea', defaultValue: '' },
  { key: 'U_EwbDt', label: 'E-Way Date.', type: 'text', defaultValue: '' },
  { key: 'U_EwbVliDt', label: 'E-Way ValidTill Date.', type: 'text', defaultValue: '' },
  {
    key: 'U_EWayBCan',
    label: 'Canceled EWayBill',
    type: 'select',
    required: true,
    defaultValue: 'No',
    options: [
      { value: '', label: '' },
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ],
  },
  { key: 'U_TrfCode', label: 'Transporter Code', type: 'text', defaultValue: '' },
  {
    key: 'U_MultiVeh',
    label: 'Multiple Vehicle',
    type: 'select',
    required: true,
    defaultValue: 'No',
    options: [
      { value: '', label: '' },
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ],
  },
  {
    key: 'U_MultiVehPosted',
    label: 'Posted Multiple Vehicle',
    type: 'select',
    required: true,
    defaultValue: 'No',
    options: [
      { value: '', label: '' },
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ],
  },
  {
    key: 'U_SubSuply',
    label: 'Sub Supply Type',
    type: 'select',
    required: true,
    defaultValue: '1',
    options: [
      { value: '', label: '' },
      { value: '1', label: 'Supply' },
      { value: '2', label: 'Import' },
      { value: '3', label: 'Export' },
      { value: '4', label: 'Job Work' },
      { value: '5', label: 'For Own Use' },
      { value: '6', label: 'Job Work Returns' },
      { value: '7', label: 'Sales Return' },
      { value: '8', label: 'Others' },
      { value: '9', label: 'SKD/CKD/Lots' },
      { value: '10', label: 'Line Sales' },
      { value: '11', label: 'Recipient Not Known' },
      { value: '12', label: 'Exhibition Or Fairs' },
    ],
  },
  {
    key: 'U_DocType',
    label: 'Document Type',
    type: 'select',
    required: true,
    defaultValue: 'INV',
    options: [
      { value: '', label: '' },
      { value: 'INV', label: 'Tax Invoice' },
      { value: 'BIL', label: 'Bill Of Supply' },
      { value: 'BOE', label: 'Bill Of Entry' },
      { value: 'CHL', label: 'Delivery Challan' },
      { value: 'OTH', label: 'Others' },
    ],
  },
  {
    key: 'U_TraType',
    label: 'Transaction Type',
    type: 'select',
    required: true,
    defaultValue: '1',
    options: [
      { value: '', label: '' },
      { value: '1', label: 'Regular' },
      { value: '2', label: 'Bill To-Ship To' },
      { value: '3', label: 'Bill From-Ship From' },
      { value: '4', label: 'Combination Of 2 and 3' },
    ],
  },
  { key: 'U_DelRemarks', label: 'Del Remarks', type: 'textarea', defaultValue: '' },
];

const ROW_UDF_DEFINITIONS = [
  { key: 'U_Loc', label: 'Loc', type: 'text', defaultValue: '' },
  { key: 'U_Branch', label: 'Branch', type: 'text', defaultValue: '' },
  { key: 'U_QcStatus', label: 'QC Status', type: 'select', defaultValue: 'Pending', options: ['Pending', 'Approved', 'Rejected'] },
];

const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.', visible: true },
  { key: 'requiredDate', label: 'Required Date', visible: true },
  { key: 'quotedDate', label: 'Quoted Date', visible: true },
  { key: 'requiredQty', label: 'Required Qty.', visible: true },
  { key: 'quantity', label: 'Quoted Qty.', visible: true },
  { key: 'unitPrice', label: 'Unit Price', visible: true },
  { key: 'stdDiscount', label: 'Discount %', visible: true },
  { key: 'taxCode', label: 'Tax Code', visible: true },
  { key: 'totalLC', label: 'Total (LC)', visible: true },
  { key: 'distRule', label: 'Distr. Rule', visible: true },
  { key: 'uomCode', label: 'UoM Code', visible: true },
  { key: 'cogsDistRule', label: 'COGS Distr. Rule', visible: true },
  { key: 'countryOfOrigin', label: 'Country/Region of Origin', visible: true },
  { key: 'loc', label: 'Loc.', visible: true },
  { key: 'blanketAgreementNo', label: 'Blanket Agreement No.', visible: true },
  { key: 'allowProcurementDoc', label: 'Allow Procmnt. Doc.', visible: true },
  { key: 'saudaNodeRef', label: 'Sauda Node Ref', visible: true },
  { key: 'apInvDocKey', label: 'AP Inv DocKey', visible: true },
  { key: 'apInvDocNum', label: 'AP Inv DocNum', visible: true },
  { key: 'apInvLineNum', label: 'AP Inv LineNum', visible: true },
  { key: 'assessableValue', label: 'Assessable Value', visible: true },
  { key: 'bedRate', label: 'BED Rate', visible: true },
  { key: 'bedAmount', label: 'BED Amount', visible: true },
  { key: 'rg23dNo', label: 'RG23DNo', visible: true },
  { key: 'specialRebate', label: 'Special Rebate', visible: true },
  { key: 'commission', label: 'Commision', visible: true },
  { key: 'sellerItem', label: 'S_Item', visible: true },
  { key: 'sellerQty', label: 'S_Qty', visible: true },
  { key: 'sellerBrokeragePerQty', label: 'BrokPerQty', visible: true },
  { key: 'hsnCode', label: 'HSN', visible: true },
  { key: 'sacCode', label: 'SAC', visible: true },
  { key: 'unitPriceUdf', label: 'Unit Price', visible: true },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', visible: true },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', visible: true },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', visible: true },
  { key: 'sellerDelivery', label: 'Seller - Delivery', visible: true },
  { key: 'buyerPaymentTerms', label: 'Buyer - Terms of payment', visible: true },
  { key: 'sellerPaymentTerms', label: 'Seller - Terms of Payment', visible: true },
  { key: 'buyerQuality', label: 'Buyer - Quality', visible: true },
  { key: 'sellerQuality', label: 'Seller - Quality', visible: true },
  { key: 'buyerPrice', label: 'Buyer - Price', visible: true },
  { key: 'sellerPrice', label: 'Seller - Price', visible: true },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', visible: true },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', visible: true },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)', visible: true },
  { key: 'sellerBrokeragePercent', label: 'Seller Brokerage in Percentage', visible: true },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', visible: true },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', visible: true },
  { key: 'stcode', label: 'STCODE', visible: true },
  { key: 'freightPurchase', label: 'Freight Purchase', visible: true },
  { key: 'freightSales', label: 'Freight Sales', visible: true },
  { key: 'freightProvider', label: 'Freight Provider', visible: true },
  { key: 'freightProviderName', label: 'Freight Provider Name', visible: true },
  { key: 'documentCreated', label: 'Document Created', visible: true },
  { key: 'brokerageNumber', label: 'Brokerage Number', visible: true },
];

const getOptionValue = (option) => (typeof option === 'string' ? option : option?.value ?? '');

const getUdfIdentity = (field = {}) =>
  [
    field.key,
    field.sapField,
    field.aliasId,
    field.label,
    field.description,
    field.Descr,
  ].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, '');

const shouldKeepUdfBlankByDefault = (field = {}) => {
  const identity = getUdfIdentity(field);
  return identity.includes('termsofsupply') ||
    identity.includes('supplyterms');
};

const getDefaultUdfValue = (field = {}) => {
  if (shouldKeepUdfBlankByDefault(field)) return '';

  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
    return field.defaultValue;
  }

  if (field.required && field.type === 'select' && Array.isArray(field.options)) {
    return field.options.map(getOptionValue).find((value) => String(value || '').trim() !== '') ?? '';
  }

  return field.defaultValue ?? '';
};

const createUdfState = (definitions) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = getDefaultUdfValue(field);
    return acc;
  }, {});

const normalizeUdfState = (definitions, values = {}) =>
  definitions.reduce((acc, field) => {
    const currentValue = values[field.key];
    const shouldApplyDefault =
      currentValue === undefined ||
      currentValue === null ||
      (field.required && String(currentValue) === '');

    acc[field.key] = shouldApplyDefault ? getDefaultUdfValue(field) : currentValue;
    return acc;
  }, {});

const buildVisibilitySettings = (definitions) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = { visible: field.visible !== undefined ? field.visible : true, active: true };
    return acc;
  }, {});

const createDefaultFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  matrixColumns = BASE_MATRIX_COLUMNS,
) => ({
  headerUdfs: buildVisibilitySettings(headerUdfs),
  matrixColumns: buildVisibilitySettings(matrixColumns),
  rowUdfs: buildVisibilitySettings(rowUdfs),
});

const mergeNestedSettings = (defaults, saved = {}) =>
  Object.keys(defaults).reduce((acc, groupKey) => {
    acc[groupKey] = {
      ...defaults[groupKey],
      ...(saved[groupKey] || {}),
    };
    return acc;
  }, {});

const readSavedFormSettings = (
  headerUdfs = HEADER_UDF_DEFINITIONS,
  rowUdfs = ROW_UDF_DEFINITIONS,
  matrixColumns = BASE_MATRIX_COLUMNS,
  storageKey = FORM_SETTINGS_STORAGE_KEY,
) => {
  if (typeof headerUdfs === 'string') {
    storageKey = headerUdfs;
    headerUdfs = HEADER_UDF_DEFINITIONS;
    rowUdfs = ROW_UDF_DEFINITIONS;
    matrixColumns = BASE_MATRIX_COLUMNS;
  }
  const defaults = createDefaultFormSettings(headerUdfs, rowUdfs, matrixColumns);

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaults;
    return mergeNestedSettings(defaults, JSON.parse(raw));
  } catch (error) {
    return defaults;
  }
};

export {
  BASE_MATRIX_COLUMNS,
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createDefaultFormSettings,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
};
