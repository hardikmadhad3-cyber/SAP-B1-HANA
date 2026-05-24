import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TaxCodeLookup from '../../components/TaxCodeLookup';
import CopyFromModal from '../../components/document/CopyFromModal';
import FormSettingsPanel from '../../components/purchase-order/FormSettingsPanel';
import HeaderUdfSidebar from '../../components/purchase-order/HeaderUdfSidebar';
import PrintLayoutToolbar from '../../components/print-layout/PrintLayoutToolbar';
import LineValueLookupModal from '../../components/sales-document/LineValueLookupModal';
import { copyToDocument } from '../../services/documentCopyService';
import { useSapWindowTaskbarActions } from '../../components/SapWindowTaskbarContext';
import { useCompanyScopedFormSettings } from '../../utils/formSettingsStorage';
import { BASE_TYPE, normaliseDocumentHeader, unwrapCopyFromDocument } from '../../api/copyFromApi';
import BusinessPartnerModal from '../sales-order/components/BusinessPartnerModal';
import StateSelectionModal from '../sales-order/components/StateSelectionModal';
import LogisticsTab from '../APInvoice/components/LogisticsTab';
import AccountingTab from '../APInvoice/components/AccountingTab';
import TaxTab from '../APInvoice/components/TaxTab';
import ElectronicDocumentsTab from '../APInvoice/components/ElectronicDocumentsTab';
import AttachmentsTab from '../APInvoice/components/AttachmentsTab';
import AddressModal from '../APInvoice/components/AddressModal';
import TaxInfoModal from '../APInvoice/components/TaxInfoModal';
import {
  fetchOpenServiceGRPOForAPInvoice,
  fetchOpenServicePurchaseOrdersForAPInvoice,
  fetchOpenServicePurchaseQuotationsForAPInvoice,
  fetchServiceAPInvoiceByDocEntry,
  fetchServiceAPInvoiceNextNumber,
  fetchServiceAPInvoiceReferenceData,
  fetchServiceAPInvoiceSeries,
  fetchServiceAPInvoiceVendorDetails,
  fetchServiceGRPOForAPInvoiceCopy,
  fetchServicePurchaseOrderForAPInvoiceCopy,
  fetchServicePurchaseQuotationForAPInvoiceCopy,
  submitServiceAPInvoice,
  updateServiceAPInvoice,
} from '../../api/serviceApInvoiceApi';
import {
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
} from '../../config/serviceApInvoiceForm';
import '../ar-invoice/styles/arInvoice.css';
import './serviceApInvoice.css';

const today = () => new Date().toISOString().split('T')[0];

const INIT_HEADER = {
  vendor: '',
  name: '',
  contactPerson: '',
  salesContractNo: '',
  currency: 'INR',
  transactionType: 'GST Tax Invoice',
  placeOfSupply: '',
  indicator: '',
  series: '',
  nextNumber: '',
  docNo: '',
  status: 'Open',
  postingDate: today(),
  deliveryDate: '',
  documentDate: today(),
  bFromDate: '',
  bToDate: '',
  branch: '',
  paymentTerms: '',
  salesEmployee: '',
  purchaser: '',
  owner: '',
  remarks: '',
  discount: '',
  totalDownPayment: '',
  freight: '',
  rounding: false,
  appliedAmount: '',
  shipToCode: '',
  shipToAddress: '',
  billToCode: '',
  billToAddress: '',
  shippingType: '',
  confirmed: false,
  useBillToForTax: false,
  journalRemark: '',
  paymentMethod: '',
  otherInstruction: '',
  itemServiceType: 'Service',
  summaryType: 'No Summary',
};

const TAB_NAMES = ['Contents', 'Logistics', 'Accounting', 'Tax', 'Electronic Documents', 'Attachments'];
const DEFAULT_TRANSACTION_TYPES = [
  { value: 'GST Tax Invoice', label: 'GST Tax Invoice' },
  { value: 'Bill of Supply', label: 'Bill of Supply' },
];

const INIT_ATTACH = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1,
  targetPath: '',
  fileName: '',
  attachmentDate: '',
  freeText: '',
  copyToTargetDocument: '',
  documentType: '',
  atchDocDate: '',
  alert: '',
}));

const EMPTY_REF_DATA = {
  vendors: [],
  contacts: [],
  states: [],
  series: [],
  branches: [],
  payment_terms: [],
  sales_employees: [],
  tax_codes: [],
  gl_accounts: [],
  distribution_rules: [],
  shipping_types: [],
  pay_to_addresses: [],
  ship_to_addresses: [],
  bill_to_addresses: [],
  sac_codes: [],
  locations: [],
  items: [],
  business_partners: [],
  transaction_types: [],
  quality_options: { buyer: [], seller: [] },
  price_options: { buyer: [], seller: [] },
  udf_metadata: { header: [], rows: [] },
};

const toArray = (value, fallbackKeys = []) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  for (const key of fallbackKeys) {
    if (Array.isArray(value[key])) return value[key];
  }

  if (Array.isArray(value.value)) return value.value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.rows)) return value.rows;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.documents)) return value.documents;

  return [];
};

const normalizeReferenceData = (data = {}, seriesData = null) => {
  const ref = data && typeof data === 'object' ? data : {};
  const seriesSource = seriesData !== null && seriesData !== undefined ? seriesData : ref.series;

  return {
    ...EMPTY_REF_DATA,
    ...ref,
    vendors: toArray(ref.vendors, ['vendors', 'business_partners']),
    contacts: toArray(ref.contacts, ['contacts']),
    states: toArray(ref.states, ['states']),
    series: toArray(seriesSource, ['series']),
    branches: toArray(ref.branches, ['branches']),
    payment_terms: toArray(ref.payment_terms, ['payment_terms']),
    sales_employees: toArray(ref.sales_employees, ['sales_employees']),
    tax_codes: toArray(ref.tax_codes, ['tax_codes']),
    gl_accounts: toArray(ref.gl_accounts, ['gl_accounts']),
    distribution_rules: toArray(ref.distribution_rules, ['distribution_rules']),
    shipping_types: toArray(ref.shipping_types, ['shipping_types']),
    pay_to_addresses: toArray(ref.pay_to_addresses, ['pay_to_addresses']),
    ship_to_addresses: toArray(ref.ship_to_addresses, ['ship_to_addresses']),
    bill_to_addresses: toArray(ref.bill_to_addresses, ['bill_to_addresses']),
    sac_codes: toArray(ref.sac_codes, ['sac_codes']),
    locations: toArray(ref.locations, ['locations']),
    items: toArray(ref.items, ['items']),
    business_partners: toArray(ref.business_partners, ['business_partners']),
    transaction_types: toArray(ref.transaction_types || ref.transactionTypes, ['transaction_types', 'transactionTypes', 'validValues', 'ValidValues']),
    quality_options: {
      buyer: toArray(ref.quality_options?.buyer, ['buyer']),
      seller: toArray(ref.quality_options?.seller, ['seller']),
    },
    price_options: {
      buyer: toArray(ref.price_options?.buyer, ['buyer']),
      seller: toArray(ref.price_options?.seller, ['seller']),
    },
    udf_metadata: {
      header: toArray(ref.udf_metadata?.header, ['header']),
      rows: toArray(ref.udf_metadata?.rows, ['rows']),
    },
  };
};

const createLine = (rowUdfDefinitions = ROW_UDF_DEFINITIONS) => ({
  sac: '',
  description: '',
  glAccount: '',
  distRule: '',
  glAccountName: '',
  taxCode: '',
  wtaxLiable: 'Yes',
  totalLC: '',
  taxAmountLC: '',
  loc: '',
  locCode: '',
  saudaNodeRef: '',
  apInvDocKey: '',
  apInvDocNum: '',
  apInvLineNum: '',
  rg23DNo: '',
  specialRebate: '',
  commision: '',
  brokPerQty: '',
  sItem: '',
  unitPrice: '',
  sQty: '',
  sellerBrokerage: '',
  buyerBrokerage: '',
  buyerDelivery: '',
  sellerDelivery: '',
  buyerQuality: '',
  sellerQuality: '',
  buyerPrice: '',
  sellerPrice: '',
  buyerSpecialInstruction: '',
  sellerSpecialInstruction: '',
  sellerBrokerageAmtPer: '',
  sellerBrokeragePercentage: '',
  buyerBillDiscount: '',
  sellerBillDiscount: '',
  stcode: '',
  buyerTermsOfPayment: '',
  sellerTermsOfPayment: '',
  freightPurchase: '',
  freightSales: '',
  freightProvider: '',
  freightProviderName: '',
  documentCreated: '',
  brokerageNumber: '',
  baseEntry: null,
  baseType: null,
  baseLine: null,
  udf: createUdfState(rowUdfDefinitions),
});

const CONTENT_COLUMNS = [
  { key: 'description', label: 'Description', width: 220 },
  { key: 'glAccount', label: 'G/L Account', width: 140, lookup: 'account' },
  { key: 'distRule', label: 'Distr. Rule', width: 120, lookup: 'distRule' },
  { key: 'glAccountName', label: 'G/L Account Name', width: 210, readOnly: true },
  { key: 'taxCode', label: 'Tax Code', width: 150, lookup: 'tax' },
  { key: 'wtaxLiable', label: 'WTax Liable', width: 95, lookup: 'yesNo' },
  { key: 'totalLC', label: 'Total (LC)', width: 115, numeric: true },
  { key: 'taxAmountLC', label: 'Tax Amount (LC)', width: 125, readOnly: true, visible: false },
  { key: 'sac', label: 'SAC', width: 105, lookup: 'sac' },
  { key: 'loc', label: 'Loc.', width: 100, lookup: 'location' },
  { key: 'saudaNodeRef', label: 'Sauda Node Ref', width: 135 },
  { key: 'apInvDocKey', label: 'AP Inv DocKey', width: 130 },
  { key: 'apInvDocNum', label: 'AP Inv DocNum', width: 135 },
  { key: 'apInvLineNum', label: 'AP Inv LineNum', width: 135 },
  { key: 'rg23DNo', label: 'RG23DNo', width: 115 },
  { key: 'specialRebate', label: 'Special Rebate', width: 135, numeric: true },
  { key: 'commision', label: 'Commision', width: 115, numeric: true },
  { key: 'brokPerQty', label: 'BrokPerQty', width: 105, numeric: true },
  { key: 'sItem', label: 'S_Item', width: 110, lookup: 'item' },
  { key: 'unitPrice', label: 'Unit Price', width: 110, numeric: true },
  { key: 'sQty', label: 'S_Qty', width: 90, numeric: true },
  { key: 'sellerBrokerage', label: 'Seller Brokerage', width: 145 },
  { key: 'buyerBrokerage', label: 'Buyer Brokerage', width: 140 },
  { key: 'buyerDelivery', label: 'Buyer - Delivery', width: 140 },
  { key: 'sellerDelivery', label: 'Seller - Delivery', width: 145 },
  { key: 'buyerQuality', label: 'Buyer - Quality', width: 135 },
  { key: 'sellerQuality', label: 'Seller - Quality', width: 140 },
  { key: 'buyerPrice', label: 'Buyer - Price', width: 125 },
  { key: 'sellerPrice', label: 'Seller - Price', width: 130 },
  { key: 'buyerSpecialInstruction', label: 'Buyer - Special Instruction', width: 210 },
  { key: 'sellerSpecialInstruction', label: 'Seller - Special Instruction', width: 215 },
  { key: 'sellerBrokerageAmtPer', label: 'Seller Brokerage(Amt./Per)', width: 205 },
  { key: 'sellerBrokeragePercentage', label: 'Seller Brokerage in Percentage', width: 230, numeric: true },
  { key: 'buyerBillDiscount', label: 'Buyer Bill Discount', width: 165, numeric: true },
  { key: 'sellerBillDiscount', label: 'Seller Bill Discount', width: 170, numeric: true },
  { key: 'stcode', label: 'STCODE', width: 115 },
  { key: 'buyerTermsOfPayment', label: 'Buyer - Terms of payment', width: 205 },
  { key: 'sellerTermsOfPayment', label: 'Seller - Terms of Payment', width: 210 },
  { key: 'freightPurchase', label: 'Freight Purchase', width: 150, numeric: true },
  { key: 'freightSales', label: 'Freight Sales', width: 130, numeric: true },
  { key: 'freightProvider', label: 'Freight Provider', width: 150 },
  { key: 'freightProviderName', label: 'Freight Provider Name', width: 190 },
  { key: 'documentCreated', label: 'Document Created', width: 150, type: 'date' },
  { key: 'brokerageNumber', label: 'Brokerage Number', width: 155 },
];

const normalizeFieldName = (value) =>
  String(value || '')
    .replace(/^U_/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();

const FIXED_SERVICE_MATRIX_FIELD_NAMES = new Set([
  'saudanoderef',
  'apinvdockey',
  'apinvdocentry',
  'apinvdocnum',
  'apinvlinenum',
  'rg23dno',
  'specialrebate',
  'commision',
  'commission',
  'brokperqty',
  'unitprice',
  'sellerbrokerage',
  'buyerbrokerage',
  'buyerdelivery',
  'sellerdelivery',
  'buyertermsofpayment',
  'sellertermsofpayment',
  'buyerquality',
  'sellerquality',
  'buyerprice',
  'sellerprice',
  'buyerspecialinstruction',
  'sellerspecialinstruction',
  'sellerbrokerageamtper',
  'sellerbrokerageinpercentage',
  'buyerbilldiscount',
  'sellerbilldiscount',
  'stcode',
  'sitem',
  'sqty',
  'freightpurchase',
  'freightsales',
  'freightprovider',
  'freightprovidername',
  'documentcreated',
  'brokeragenumber',
]);

const fieldNameMatches = (field = {}, names = new Set()) =>
  names.has(normalizeFieldName(field.key)) ||
  names.has(normalizeFieldName(field.label)) ||
  names.has(normalizeFieldName(field.aliasId));

const isFixedServiceMatrixField = (field = {}) =>
  fieldNameMatches(field, FIXED_SERVICE_MATRIX_FIELD_NAMES);

const applyServiceRowUdfDefaults = (definitions = []) =>
  definitions.map((field) => ({ ...field, visible: false }));

const TRANSACTION_TYPE_FIELD_NAMES = new Set([
  'transactiontype',
  'transtype',
  'documenttype',
  'doctype',
]);

const getOptionValue = (option) => String(
  typeof option === 'string'
    ? option
    : option?.value ?? option?.Value ?? option?.Code ?? option?.code ?? option?.Name ?? option?.name ?? option?.label ?? option?.Description ?? ''
);

const getOptionLabel = (option) => String(
  typeof option === 'string'
    ? option
    : option?.label ?? option?.Label ?? option?.Description ?? option?.description ?? option?.Name ?? option?.name ?? option?.Value ?? option?.value ?? option?.Code ?? option?.code ?? ''
);

const normalizeSelectOptions = (options = []) => {
  const seen = new Set();
  return toArray(options, ['options', 'validValues', 'ValidValues', 'values']).reduce((acc, option) => {
    const value = getOptionValue(option).trim();
    if (!value || seen.has(value)) return acc;
    seen.add(value);
    acc.push({ value, label: getOptionLabel(option).trim() || value });
    return acc;
  }, []);
};

const LINE_LOOKUP_FIELDS = new Set([
  'sellerBrokerage',
  'buyerBrokerage',
  'buyerTermsOfPayment',
  'sellerTermsOfPayment',
  'buyerQuality',
  'sellerQuality',
  'buyerPrice',
  'sellerPrice',
  'freightProvider',
]);

const parseNum = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
};

const fmtAddr = (address) => {
  if (!address) return '';
  return [
    [address.Street, address.StreetNo],
    [address.Block, address.Building, address.Address2, address.Address3],
    [address.City, address.County, address.State, address.ZipCode],
    [address.Country],
  ]
    .map((parts) => parts.filter(Boolean).join(', '))
    .filter(Boolean)
    .join('\n');
};

const mapAddressToModalForm = (address, existing = {}) => ({
  shipToCode: existing.shipToCode || '',
  shipToAddress: existing.shipToAddress || '',
  billToCode: existing.billToCode || '',
  billToAddress: existing.billToAddress || '',
  streetPoBox: address?.Street || '',
  streetNo: address?.StreetNo || '',
  buildingFloorRoom: address?.Building || '',
  block: address?.Block || '',
  city: address?.City || '',
  zipCode: address?.ZipCode || '',
  county: address?.County || '',
  state: address?.State || '',
  countryRegion: address?.Country || '',
  addressName2: address?.Address2 || '',
  addressName3: address?.Address3 || '',
  gln: address?.GLN || '',
  gstin: address?.GSTIN || '',
});

const getTaxRate = (taxCodes, code) => {
  const tax = taxCodes.find((item) => String(item.Code || '') === String(code || ''));
  return parseNum(tax?.Rate);
};

const readLineAliasValue = (line = {}, aliases = []) => {
  const aliasSet = new Set(aliases.map(normalizeFieldName));
  const sources = [line, line.udf || {}];
  for (const source of sources) {
    for (const [key, value] of Object.entries(source || {})) {
      if (!aliasSet.has(normalizeFieldName(key))) continue;
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
  }
  return '';
};

const normalizeCopyLine = (line, idx, docEntry, baseType, accounts) => {
  const glAccount = String(line.AccountCode || line.AcctCode || line.glAccount || '').trim();
  const account = accounts.find((item) => String(item.code) === glAccount);
  const quantity = line.Quantity != null ? String(line.Quantity) : String(line.sQty || '');
  const unitPrice = line.UnitPrice != null ? String(line.UnitPrice) : String(line.unitPrice || '');
  const lineTotal = line.LineTotal != null
    ? String(line.LineTotal)
    : (parseNum(quantity) > 0 && parseNum(unitPrice) > 0 ? fmt(parseNum(quantity) * parseNum(unitPrice)) : String(line.totalLC || ''));
  return {
    ...createLine(),
    baseEntry: docEntry || line.BaseEntry || null,
    baseType: baseType || line.BaseType || null,
    baseLine: line.LineNum ?? line.BaseLine ?? idx,
    sac: String(line.SAC || line.SACEntry || line.sac || ''),
    description: String(line.ItemDescription || line.Dscription || line.description || ''),
    glAccount,
    glAccountName: line.AccountName || line.AcctName || account?.name || '',
    distRule: String(line.DistributionRule || line.OcrCode || line.distRule || ''),
    taxCode: String(line.TaxCode || line.taxCode || ''),
    totalLC: lineTotal,
    taxAmountLC: line.TaxAmount != null ? String(line.TaxAmount) : String(line.taxAmountLC || ''),
    loc: String(line.Location || line.LocationCode || line.loc || ''),
    locCode: String(line.LocationCode || line.locCode || ''),
    apInvDocKey: String(readLineAliasValue(line, ['APInvDocKey', 'APInvDocEntry', 'apInvDocKey'])),
    apInvDocNum: String(readLineAliasValue(line, ['APInvDocNum', 'apInvDocNum'])),
    apInvLineNum: String(readLineAliasValue(line, ['APInvLineNum', 'apInvLineNum'])),
    rg23DNo: String(readLineAliasValue(line, ['RG23DNo', 'RG23DNO', 'rg23DNo'])),
    specialRebate: String(readLineAliasValue(line, ['SpecialRebate', 'specialRebate'])),
    commision: String(readLineAliasValue(line, ['Commision', 'Commission', 'commision'])),
    unitPrice,
    sQty: quantity,
    saudaNodeRef: String(readLineAliasValue(line, ['SaudaNodeRef', 'SaudaNodhRef', 'SaudaNode', 'saudaNodeRef'])),
    brokPerQty: String(readLineAliasValue(line, ['BrokPerQty', 'brokPerQty'])),
    sItem: String(readLineAliasValue(line, ['S_Item', 'SItem', 'sItem'])),
    sellerBrokerage: String(readLineAliasValue(line, ['SellerBrokerage', 'sellerBrokerage'])),
    buyerBrokerage: String(readLineAliasValue(line, ['BuyerBrokerage', 'buyerBrokerage'])),
    buyerDelivery: String(readLineAliasValue(line, ['BuyerDelivery', 'buyerDelivery'])),
    sellerDelivery: String(readLineAliasValue(line, ['SellerDelivery', 'sellerDelivery'])),
    buyerQuality: String(readLineAliasValue(line, ['BuyerQuality', 'buyerQuality'])),
    sellerQuality: String(readLineAliasValue(line, ['SellerQuality', 'sellerQuality'])),
    buyerPrice: String(readLineAliasValue(line, ['BuyerPrice', 'buyerPrice'])),
    sellerPrice: String(readLineAliasValue(line, ['SellerPrice', 'sellerPrice'])),
    buyerSpecialInstruction: String(readLineAliasValue(line, ['BuyerSpecialInstruction', 'BuyerSplInst', 'buyerSpecialInstruction'])),
    sellerSpecialInstruction: String(readLineAliasValue(line, ['SellerSpecialInstruction', 'SellerSplInst', 'sellerSpecialInstruction'])),
    sellerBrokerageAmtPer: String(readLineAliasValue(line, ['SellerBrokerageAmtPer', 'SellBrkAmtPer', 'sellerBrokerageAmtPer'])),
    sellerBrokeragePercentage: String(readLineAliasValue(line, ['SellerBrokeragePercentage', 'SellerBrkPct', 'sellerBrokeragePercentage'])),
    buyerBillDiscount: String(readLineAliasValue(line, ['BuyerBillDiscount', 'buyerBillDiscount'])),
    sellerBillDiscount: String(readLineAliasValue(line, ['SellerBillDiscount', 'sellerBillDiscount'])),
    stcode: String(readLineAliasValue(line, ['STCODE', 'STCode', 'stcode'])),
    buyerTermsOfPayment: String(readLineAliasValue(line, ['BuyerTermsOfPayment', 'BuyerPayTerms', 'buyerTermsOfPayment'])),
    sellerTermsOfPayment: String(readLineAliasValue(line, ['SellerTermsOfPayment', 'SellerPayTerms', 'sellerTermsOfPayment'])),
    freightPurchase: String(readLineAliasValue(line, ['FreightPurchase', 'freightPurchase'])),
    freightSales: String(readLineAliasValue(line, ['FreightSales', 'freightSales'])),
    freightProvider: String(readLineAliasValue(line, ['FreightProvider', 'freightProvider'])),
    freightProviderName: String(readLineAliasValue(line, ['FreightProviderName', 'freightProviderName'])),
    documentCreated: String(readLineAliasValue(line, ['DocumentCreated', 'documentCreated'])),
    brokerageNumber: String(readLineAliasValue(line, ['BrokerageNumber', 'BrokerageNo', 'brokerageNumber'])),
  };
};

function ServiceAPInvoicePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { removeTask, upsertTask } = useSapWindowTaskbarActions();
  const requestedDocEntry = location.state?.serviceApInvoiceDocEntry;
  const handledCopyFromRef = useRef('');

  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [header, setHeader] = useState(INIT_HEADER);
  const [headerUdfDefinitions, setHeaderUdfDefinitions] = useState(HEADER_UDF_DEFINITIONS);
  const [rowUdfDefinitions, setRowUdfDefinitions] = useState(ROW_UDF_DEFINITIONS);
  const [lines, setLines] = useState([createLine(ROW_UDF_DEFINITIONS)]);
  const [headerUdfs, setHeaderUdfs] = useState(() => normalizeUdfState(HEADER_UDF_DEFINITIONS));
  const [formSettings, setFormSettings, formSettingsStorageKey] = useCompanyScopedFormSettings(
    FORM_SETTINGS_STORAGE_KEY,
    readSavedFormSettings,
    [headerUdfDefinitions, rowUdfDefinitions, CONTENT_COLUMNS],
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [refData, setRefData] = useState(EMPTY_REF_DATA);
  const [attachments] = useState(INIT_ATTACH);
  const [activeTab, setActiveTab] = useState('Contents');
  const [pageState, setPageState] = useState({ loading: true, posting: false, error: '', success: '', seriesLoading: false });
  const [valErrors, setValErrors] = useState({ header: {}, lines: {}, form: '' });
  const [copyFromModal, setCopyFromModal] = useState(false);
  const [copyFromDocType, setCopyFromDocType] = useState('purchaseOrder');
  const [bpModalOpen, setBpModalOpen] = useState(false);
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [addressModal, setAddressModal] = useState(null);
  const [taxInfoModal, setTaxInfoModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    shipToCode: '',
    shipToAddress: '',
    billToCode: '',
    billToAddress: '',
    streetPoBox: '',
    streetNo: '',
    buildingFloorRoom: '',
    block: '',
    city: '',
    zipCode: '',
    county: '',
    state: '',
    countryRegion: '',
    addressName2: '',
    addressName3: '',
    gln: '',
    gstin: '',
  });
  const [taxInfoForm, setTaxInfoForm] = useState({
    panNo: '',
    panCircleNo: '',
    panWardNo: '',
    panAssessingOfficer: '',
    deducteeRefNo: '',
    lstVatNo: '',
    cstNo: '',
    tanNo: '',
    serviceTaxNo: '',
    companyType: '',
    natureOfBusiness: '',
    assesseeType: '',
    tinNo: '',
    itrFiling: '',
    gstType: '',
    gstin: '',
  });
  const [lineLookupModal, setLineLookupModal] = useState({
    open: false,
    lineIndex: -1,
    field: '',
    title: '',
    options: [],
    searchPlaceholder: 'Search values',
    emptyMessage: 'No values found',
    allowCreate: false,
    columns: null,
  });

  const isDocumentEditable = !currentDocEntry || String(header.status || '').toLowerCase() === 'open';
  const hasVendorCode = Boolean(String(header.vendor || '').trim());
  const isRightSidebarOpen = sidebarOpen || formSettingsOpen;
  const taxCodes = toArray(refData.tax_codes, ['tax_codes']);
  const accounts = toArray(refData.gl_accounts, ['gl_accounts']);
  const distributionRules = toArray(refData.distribution_rules, ['distribution_rules']);
  const paymentTerms = toArray(refData.payment_terms, ['payment_terms']);
  const shippingTypes = toArray(refData.shipping_types, ['shipping_types']);
  const seriesOptions = toArray(refData.series, ['series']);
  const salesEmployeeOptions = toArray(refData.sales_employees, ['sales_employees']);
  const stateOptions = toArray(refData.states, ['states']);
  const vendorPayToAddresses = toArray(refData.pay_to_addresses, ['pay_to_addresses']).filter((address) => String(address.CardCode || '') === String(header.vendor || ''));
  const vendorShipToAddresses = toArray(refData.ship_to_addresses, ['ship_to_addresses']).filter((address) => String(address.CardCode || '') === String(header.vendor || ''));
  const vendorBillToAddresses = toArray(refData.bill_to_addresses, ['bill_to_addresses']).filter((address) => String(address.CardCode || '') === String(header.vendor || ''));
  const vendorEffectiveShipToAddresses = vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses;
  const vendorEffectiveBillToAddresses = vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses;
  const payTermOpts = paymentTerms.map((term) => ({ value: String(term.GroupNum ?? term.code ?? ''), label: term.PymntGroup || term.name || String(term.GroupNum ?? '') }));
  const shipTypeOpts = shippingTypes.map((type) => ({ value: String(type.TrnspCode ?? type.code ?? ''), label: type.TrnspName || type.name || String(type.TrnspCode ?? '') }));
  const transactionTypeOptions = useMemo(() => {
    const transactionTypeUdf = headerUdfDefinitions.find((field) => fieldNameMatches(field, TRANSACTION_TYPE_FIELD_NAMES));
    const udfOptions = normalizeSelectOptions(
      transactionTypeUdf?.options || transactionTypeUdf?.validValues || transactionTypeUdf?.ValidValues || []
    );
    const refOptions = normalizeSelectOptions(refData.transaction_types);
    return udfOptions.length ? udfOptions : (refOptions.length ? refOptions : DEFAULT_TRANSACTION_TYPES);
  }, [headerUdfDefinitions, refData.transaction_types]);

  const accountLookupOptions = useMemo(() => accounts.map((account) => ({
    value: account.code || '',
    description: account.name || '',
    label: account.name ? `${account.code} - ${account.name}` : account.code,
    accountNumber: account.code || '',
    accountName: account.name || '',
    accountBalance: Number(account.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    inactive: account.inactive || 'No',
  })).filter((option) => option.value), [accounts]);

  const distributionRuleLookupOptions = useMemo(() => distributionRules.map((rule) => {
    const value = rule.FactorCode || rule.OcrCode || rule.code || '';
    const description = rule.FactorDescription || rule.OcrName || rule.name || '';
    return {
      value,
      description,
      label: description ? `${value} - ${description}` : value,
    };
  }).filter((option) => option.value), [distributionRules]);

  const paymentTermLookupOptions = useMemo(() => paymentTerms.map((term) => {
    const value = term.PymntGroup || term.name || String(term.GroupNum ?? '');
    const code = String(term.GroupNum ?? term.code ?? '');
    return {
      value,
      description: code ? `Code: ${code}` : '',
      label: code ? `${value} (${code})` : value,
    };
  }).filter((option) => option.value), [paymentTerms]);

  const locationLookupOptions = useMemo(() => toArray(refData.locations, ['locations']).map((locationItem) => {
    const code = String(locationItem.code ?? locationItem.Code ?? '');
    const name = locationItem.name || locationItem.Location || locationItem.Name || code;
    return {
      value: name,
      description: code ? `Code: ${code}` : '',
      label: code ? `${name} (${code})` : name,
      code,
      locationName: name,
    };
  }).filter((option) => option.value), [refData.locations]);

  const itemLookupOptions = useMemo(() => toArray(refData.items, ['items']).map((item) => ({
    value: item.ItemCode || item.code || '',
    description: item.ItemName || item.name || '',
    label: item.ItemName ? `${item.ItemCode} - ${item.ItemName}` : item.ItemCode,
    itemNo: item.ItemCode || item.code || '',
    itemDescription: item.ItemName || item.name || '',
    inStock: Number(item.InStock ?? item.OnHand ?? 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    wtaxLiable: item.WTaxLiable || item.WTLiable || '',
  })).filter((option) => option.value), [refData.items]);

  const freightProviderLookupOptions = useMemo(() => {
    const partners = toArray(refData.business_partners, ['business_partners']);
    const fallbackVendors = toArray(refData.vendors, ['vendors']);
    return (partners.length ? partners : fallbackVendors).map((bp) => {
    const code = bp.CardCode || bp.code || '';
    const name = bp.CardName || bp.name || '';
    return {
      value: code,
      description: name,
      label: name ? `${name} (${code})` : code,
      bpName: name,
      bpCode: code,
      bpBalance: Number(bp.Balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      bpType: String(bp.CardType || '').replace(/^c/, '') || '',
      active: bp.Active || 'Yes',
      inactive: bp.Inactive || 'No',
      billToBlock: bp.BillToBlock || '',
      billToBuildingFloorRoom: bp.BillToBuildingFloorRoom || '',
      gtsRegistrationNumber: bp.GTSRegistrationNumber || '',
    };
  }).filter((option) => option.value);
  }, [refData.business_partners, refData.vendors]);

  const serviceSacLookupOptions = useMemo(() => toArray(refData.sac_codes, ['sac_codes']).map((sac) => {
    const code = sac.serviceCode || sac.code || sac.ChapterID || '';
    const serviceName = sac.serviceName || sac.description || sac.name || sac.Dscription || '';
    return {
      value: code,
      description: serviceName || `Service Code: ${code}`,
      label: serviceName ? `${serviceName} (${code})` : code,
      serviceName,
      serviceCode: code,
    };
  }).filter((option) => option.value), [refData.sac_codes]);

  const genericLineLookupOptions = useMemo(() => ({
    sac: {
      title: 'List of India SAC Code',
      options: serviceSacLookupOptions,
      searchPlaceholder: 'Search service name or service code',
      emptyMessage: 'No service SAC codes found',
      columns: [
        { key: 'serviceName', label: 'Service Name', primary: true },
        { key: 'serviceCode', label: 'Service Code', width: 140 },
      ],
    },
    buyerTermsOfPayment: {
      title: 'List of Buyer Terms of Payment',
      options: paymentTermLookupOptions,
      searchPlaceholder: 'Search payment terms',
      emptyMessage: 'No payment terms found',
    },
    sellerTermsOfPayment: {
      title: 'List of Seller Terms of Payment',
      options: paymentTermLookupOptions,
      searchPlaceholder: 'Search payment terms',
      emptyMessage: 'No payment terms found',
    },
    sellerBrokerage: {
      title: 'List of Seller Brokerage Business Partners',
      options: freightProviderLookupOptions,
      searchPlaceholder: 'Search business partners',
      emptyMessage: 'No business partners found',
      columns: [
        { key: 'bpName', label: 'BP Name', primary: true },
        { key: 'bpCode', label: 'BP Code', width: 110 },
        { key: 'bpBalance', label: 'BP Balance', width: 120, align: 'right' },
        { key: 'bpType', label: 'BP Type', width: 90 },
      ],
    },
    buyerBrokerage: {
      title: 'List of Buyer Brokerage Business Partners',
      options: freightProviderLookupOptions,
      searchPlaceholder: 'Search business partners',
      emptyMessage: 'No business partners found',
      columns: [
        { key: 'bpName', label: 'BP Name', primary: true },
        { key: 'bpCode', label: 'BP Code', width: 110 },
        { key: 'bpBalance', label: 'BP Balance', width: 120, align: 'right' },
        { key: 'bpType', label: 'BP Type', width: 90 },
      ],
    },
    buyerQuality: {
      title: 'List of Buyer Quality Values',
      options: toArray(refData.quality_options?.buyer, ['buyer']),
      searchPlaceholder: 'Search buyer quality',
      emptyMessage: 'No buyer quality values found',
    },
    sellerQuality: {
      title: 'List of Seller Quality Values',
      options: toArray(refData.quality_options?.seller, ['seller']),
      searchPlaceholder: 'Search seller quality',
      emptyMessage: 'No seller quality values found',
    },
    buyerPrice: {
      title: 'List of Buyer Price Values',
      options: toArray(refData.price_options?.buyer, ['buyer']),
      searchPlaceholder: 'Search buyer price',
      emptyMessage: 'No buyer price values found',
    },
    sellerPrice: {
      title: 'List of Seller Price Values',
      options: toArray(refData.price_options?.seller, ['seller']),
      searchPlaceholder: 'Search seller price',
      emptyMessage: 'No seller price values found',
    },
    freightProvider: {
      title: 'List of Business Partners',
      options: freightProviderLookupOptions,
      searchPlaceholder: 'Search business partners',
      emptyMessage: 'No business partners found',
      columns: [
        { key: 'bpName', label: 'BP Name', primary: true },
        { key: 'bpCode', label: 'BP Code', width: 110 },
        { key: 'bpBalance', label: 'BP Balance', width: 120, align: 'right' },
        { key: 'bpType', label: 'BP Type', width: 90 },
        { key: 'active', label: 'Active', width: 70 },
        { key: 'inactive', label: 'Inactive', width: 80 },
        { key: 'billToBlock', label: 'Bill-to Block', width: 150 },
        { key: 'billToBuildingFloorRoom', label: 'Bill-to Building/Floor/Room', width: 220 },
        { key: 'gtsRegistrationNumber', label: 'GTS Registration Number', width: 180 },
      ],
    },
    loc: {
      title: 'List of Locations',
      options: locationLookupOptions,
      searchPlaceholder: 'Search locations',
      emptyMessage: 'No locations found',
      columns: [
        { key: 'locationName', label: 'Location', primary: true },
        { key: 'code', label: 'Code', width: 90 },
      ],
    },
    sItem: {
      title: 'List of Items',
      options: itemLookupOptions,
      searchPlaceholder: 'Search items',
      emptyMessage: 'No items found',
      columns: [
        { key: 'itemNo', label: 'Item No.', width: 150, primary: true },
        { key: 'itemDescription', label: 'Item Description' },
        { key: 'inStock', label: 'In Stock', width: 120, align: 'right' },
        { key: 'wtaxLiable', label: 'WTax Liable', width: 100 },
      ],
    },
  }), [freightProviderLookupOptions, itemLookupOptions, locationLookupOptions, paymentTermLookupOptions, refData.price_options, refData.quality_options, serviceSacLookupOptions]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, line) => sum + parseNum(line.totalLC), 0);
    const tax = lines.reduce((sum, line) => sum + parseNum(line.taxAmountLC), 0);
    const discountAmount = subtotal * parseNum(header.discount) / 100;
    const freight = parseNum(header.freight);
    const downPayment = parseNum(header.totalDownPayment);
    const total = Math.max(0, subtotal - discountAmount - downPayment) + freight + tax;
    const appliedAmount = parseNum(header.appliedAmount);
    const balanceDue = Math.max(0, total - appliedAmount);
    return { subtotal, tax, discountAmount, freight, downPayment, total, appliedAmount, balanceDue, wtaxAmount: 0 };
  }, [header.appliedAmount, header.discount, header.freight, header.totalDownPayment, lines]);

  useEffect(() => {
    const handler = (event) => {
      if (!event.target.closest('.del-dropdown')) {
        document.querySelectorAll('.del-dropdown').forEach((dropdown) => dropdown.classList.remove('active'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setPageState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const [refRes, seriesRes] = await Promise.all([
          fetchServiceAPInvoiceReferenceData(),
          fetchServiceAPInvoiceSeries(header.postingDate),
        ]);
        if (ignore) return;

        const nextRefData = normalizeReferenceData(refRes.data, seriesRes.data?.series || seriesRes.data);
        const nextHeaderUdfs = nextRefData.udf_metadata.header;
        const nextRowUdfs = applyServiceRowUdfDefaults(nextRefData.udf_metadata?.rows || []);
        const nextDefaults = readSavedFormSettings(nextHeaderUdfs, nextRowUdfs, CONTENT_COLUMNS, formSettingsStorageKey);
        setHeaderUdfDefinitions(nextHeaderUdfs);
        setRowUdfDefinitions(nextRowUdfs);
        setHeaderUdfs((prev) => normalizeUdfState(nextHeaderUdfs, prev));
        setLines((prev) => prev.map((line) => ({
          ...line,
          udf: normalizeUdfState(nextRowUdfs, line.udf || {}),
        })));
        setFormSettings((prev) => ({
          ...nextDefaults,
          ...prev,
          matrixColumns: {
            ...nextDefaults.matrixColumns,
            ...(prev.matrixColumns || {}),
          },
          headerUdfs: {
            ...nextDefaults.headerUdfs,
            ...(prev.headerUdfs || {}),
          },
          rowUdfs: {
            ...nextDefaults.rowUdfs,
            ...(prev.rowUdfs || {}),
          },
        }));
        setRefData(nextRefData);
        const firstSeries = nextRefData.series[0];
        if (firstSeries && !requestedDocEntry) {
          setHeader((prev) => ({
            ...prev,
            series: String(firstSeries.Series || ''),
            nextNumber: String(firstSeries.NextNumber || ''),
          }));
        }
        setPageState((prev) => ({ ...prev, loading: false }));
      } catch (error) {
        if (!ignore) {
          setPageState((prev) => ({ ...prev, loading: false, error: error.response?.data?.message || error.message || 'Failed to load Service A/P Invoice.' }));
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!requestedDocEntry) return;
    let ignore = false;

    const loadDocument = async () => {
      setPageState((prev) => ({ ...prev, loading: true, error: '', success: '' }));
      try {
        const res = await fetchServiceAPInvoiceByDocEntry(requestedDocEntry);
        if (ignore) return;
        const doc = res.data?.service_ap_invoice;
        if (!doc) throw new Error('Service A/P Invoice was not returned.');
        setCurrentDocEntry(doc.doc_entry);
        setHeader((prev) => ({ ...prev, ...doc.header }));
        setHeaderUdfs(
          headerUdfDefinitions.length
            ? normalizeUdfState(headerUdfDefinitions, doc.header_udfs || {})
            : (doc.header_udfs || {})
        );
        const loadedLines = toArray(doc.lines, ['lines', 'DocumentLines']);
        setLines(loadedLines.length
          ? loadedLines.map((line) => ({
            ...createLine(rowUdfDefinitions),
            ...line,
            udf: rowUdfDefinitions.length ? normalizeUdfState(rowUdfDefinitions, line.udf || {}) : (line.udf || {}),
          }))
          : [createLine(rowUdfDefinitions)]);
        setPageState((prev) => ({ ...prev, loading: false, success: `Service A/P Invoice ${doc.doc_num || requestedDocEntry} loaded.` }));
      } catch (error) {
        if (!ignore) setPageState((prev) => ({ ...prev, loading: false, error: error.response?.data?.message || error.message || 'Failed to load Service A/P Invoice.' }));
      }
    };

    loadDocument();
    return () => {
      ignore = true;
    };
  }, [requestedDocEntry, headerUdfDefinitions, rowUdfDefinitions]);

  const updateLineCalculatedValues = (line) => {
    const next = { ...line };
    const qty = parseNum(next.sQty);
    const price = parseNum(next.unitPrice);
    if (qty > 0 && price > 0) {
      next.totalLC = fmt(qty * price);
    }
    const taxRate = getTaxRate(taxCodes, next.taxCode);
    next.taxAmountLC = next.totalLC ? fmt(parseNum(next.totalLC) * taxRate / 100) : '';
    return next;
  };

  const loadVendorDetails = async (vendorCode) => {
    if (!vendorCode) return;
    try {
      const res = await fetchServiceAPInvoiceVendorDetails(vendorCode);
      setRefData((prev) => ({
        ...prev,
        contacts: toArray(res.data?.contacts, ['contacts']),
        pay_to_addresses: toArray(res.data?.pay_to_addresses, ['pay_to_addresses']),
        ship_to_addresses: toArray(res.data?.ship_to_addresses, ['ship_to_addresses']),
        bill_to_addresses: toArray(res.data?.bill_to_addresses, ['bill_to_addresses']),
      }));
      const vendor = res.data?.vendor;
      if (vendor) {
        const shipToAddresses = toArray(res.data?.ship_to_addresses, ['ship_to_addresses']);
        const payToAddresses = toArray(res.data?.pay_to_addresses, ['pay_to_addresses']);
        const billToAddresses = toArray(res.data?.bill_to_addresses, ['bill_to_addresses']);
        const shipTo = (shipToAddresses.length ? shipToAddresses : payToAddresses)[0];
        const billTo = (billToAddresses.length ? billToAddresses : payToAddresses)[0];
        setHeader((prev) => ({
          ...prev,
          vendor: vendor.CardCode || prev.vendor,
          name: vendor.CardName || prev.name,
          paymentTerms: vendor.GroupNum != null ? String(vendor.GroupNum) : prev.paymentTerms,
          currency: vendor.Currency || prev.currency,
          shipToCode: prev.shipToCode || shipTo?.Address || '',
          shipToAddress: prev.shipToAddress || fmtAddr(shipTo),
          billToCode: prev.billToCode || billTo?.Address || '',
          billToAddress: prev.billToAddress || fmtAddr(billTo),
        }));
      }
    } catch (_error) {
      setRefData((prev) => ({ ...prev, contacts: [] }));
    }
  };

  const selectVendor = async (vendor) => {
    const cardCode = vendor?.CardCode || vendor?.code || '';
    setHeader((prev) => ({
      ...prev,
      vendor: cardCode,
      name: vendor?.CardName || vendor?.name || prev.name,
      currency: vendor?.Currency || prev.currency,
      paymentTerms: vendor?.GroupNum != null ? String(vendor.GroupNum) : prev.paymentTerms,
      shipToCode: '',
      shipToAddress: '',
      billToCode: '',
      billToAddress: '',
    }));
    if (cardCode) await loadVendorDetails(cardCode);
  };

  const openLineLookup = (field, lineIndex, override = {}) => {
    if (!isDocumentEditable) return;
    const config = genericLineLookupOptions[field] || {};
    setLineLookupModal({
      open: true,
      lineIndex,
      field,
      title: override.title || config.title || 'List of Values',
      options: override.options || config.options || [],
      searchPlaceholder: override.searchPlaceholder || config.searchPlaceholder || 'Search values',
      emptyMessage: override.emptyMessage || config.emptyMessage || 'No values found',
      allowCreate: Boolean(override.allowCreate ?? config.allowCreate ?? false),
      columns: override.columns || config.columns || null,
    });
  };

  const closeLineLookup = () => {
    setLineLookupModal((prev) => ({ ...prev, open: false, lineIndex: -1, field: '' }));
  };

  const handleLineLookupSelect = (option) => {
    if (lineLookupModal.lineIndex < 0 || !lineLookupModal.field) return;
    const selectedValue = option?.value || '';
    setLines((prev) => prev.map((line, lineIndex) => {
      if (lineIndex !== lineLookupModal.lineIndex) return line;
      const next = { ...line, [lineLookupModal.field]: selectedValue };
      if (lineLookupModal.field === 'glAccount') {
        next.glAccountName = option?.description || '';
      }
      if (lineLookupModal.field === 'loc') {
        next.locCode = option?.code || '';
        next.loc = option?.locationName || selectedValue;
      }
      if (lineLookupModal.field === 'sItem' && !String(next.description || '').trim()) {
        next.description = option?.description || next.description;
      }
      if (lineLookupModal.field === 'sItem' && option?.wtaxLiable) {
        next.wtaxLiable = option.wtaxLiable;
      }
      if (lineLookupModal.field === 'sac' && !String(next.description || '').trim()) {
        next.description = option?.description || next.description;
      }
      if (lineLookupModal.field === 'freightProvider') {
        next.freightProviderName = option?.description || option?.bpName || '';
      }
      return updateLineCalculatedValues(next);
    }));
  };

  const handleHeaderChange = async (event) => {
    if (!isDocumentEditable) return;
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;

    if (name === 'vendor') {
      const vendor = toArray(refData.vendors, ['vendors']).find((item) => String(item.CardCode || item.code || '') === String(value));
      setHeader((prev) => ({
        ...prev,
        vendor: value,
        name: vendor?.CardName || vendor?.name || prev.name,
        shipToCode: '',
        shipToAddress: '',
        billToCode: '',
        billToAddress: '',
      }));
      if (vendor) await loadVendorDetails(value);
      return;
    }

    if (name === 'postingDate') {
      setHeader((prev) => ({ ...prev, postingDate: value }));
      setPageState((prev) => ({ ...prev, seriesLoading: true }));
      try {
        const res = await fetchServiceAPInvoiceSeries(value);
        const nextSeries = toArray(res.data?.series || res.data, ['series']);
        setRefData((prev) => ({ ...prev, series: nextSeries }));
        setHeader((prev) => {
          if (prev.series === 'manual') {
            return { ...prev, postingDate: value };
          }

          const selectedSeries =
            nextSeries.find((series) => String(series.Series || '') === String(prev.series || '')) ||
            nextSeries[0];

          return {
            ...prev,
            postingDate: value,
            series: selectedSeries ? String(selectedSeries.Series || '') : '',
            nextNumber: selectedSeries ? String(selectedSeries.NextNumber || '') : '',
          };
        });
      } catch (_error) {
        setHeader((prev) => ({ ...prev, postingDate: value }));
      } finally {
        setPageState((prev) => ({ ...prev, seriesLoading: false }));
      }
      return;
    }

    if (name === 'series') {
      if (value === 'manual') {
        setHeader((prev) => ({ ...prev, series: value, nextNumber: '', docNo: '' }));
        return;
      }

      const selectedSeries = seriesOptions.find((series) => String(series.Series || '') === String(value || ''));
      setHeader((prev) => ({
        ...prev,
        series: value,
        nextNumber: selectedSeries ? String(selectedSeries.NextNumber || '') : '...',
      }));
      setPageState((prev) => ({ ...prev, seriesLoading: true }));
      try {
        const res = await fetchServiceAPInvoiceNextNumber(value);
        setHeader((prev) => ({ ...prev, nextNumber: String(res.data?.nextNumber || '') }));
      } catch (_error) {
        setHeader((prev) => ({ ...prev, nextNumber: '' }));
      } finally {
        setPageState((prev) => ({ ...prev, seriesLoading: false }));
      }
      return;
    }

    if (name === 'shipToCode') {
      const selected = vendorEffectiveShipToAddresses.find((address) => String(address.Address || '') === String(value));
      setHeader((prev) => ({
        ...prev,
        shipToCode: value,
        shipToAddress: selected ? fmtAddr(selected) : prev.shipToAddress,
        placeOfSupply: selected?.State || prev.placeOfSupply,
      }));
      return;
    }

    if (name === 'billToCode' || name === 'payToCode') {
      const selected = vendorEffectiveBillToAddresses.find((address) => String(address.Address || '') === String(value));
      setHeader((prev) => ({
        ...prev,
        billToCode: value,
        payToCode: value,
        billToAddress: selected ? fmtAddr(selected) : prev.billToAddress,
        placeOfSupply: (prev.useBillToForTax || prev.usePayToForTax) && selected?.State ? selected.State : prev.placeOfSupply,
      }));
      return;
    }

    setHeader((prev) => ({
      ...prev,
      [name]: nextValue,
      ...(name === 'remarks' ? { otherInstruction: nextValue } : {}),
      ...(name === 'otherInstruction' ? { remarks: nextValue } : {}),
    }));
  };

  const handleLineChange = (index, event) => {
    if (!isDocumentEditable) return;
    const { name, value } = event.target;
    setValErrors((prev) => ({ ...prev, lines: { ...prev.lines, [index]: { ...(prev.lines[index] || {}), [name]: '' } }, form: '' }));
    setLines((prev) => prev.map((line, lineIndex) => {
      if (lineIndex !== index) return line;
      const next = { ...line, [name]: value };
      if (name === 'glAccount') {
        const account = accounts.find((item) => String(item.code) === String(value));
        next.glAccountName = account?.name || '';
      }
      if (name === 'loc') {
        next.locCode = '';
      }
      return ['taxCode', 'totalLC', 'unitPrice', 'sQty'].includes(name)
        ? updateLineCalculatedValues(next)
        : next;
    }));
  };

  const addLine = () => {
    if (!isDocumentEditable) return;
    setLines((prev) => [...prev, createLine(rowUdfDefinitions)]);
  };

  const removeLine = (index) => {
    if (!isDocumentEditable) return;
    setLines((prev) => (prev.length <= 1 ? [createLine(rowUdfDefinitions)] : prev.filter((_line, lineIndex) => lineIndex !== index)));
  };

  const handleHeaderUdfChange = (key, value) => {
    if (!isDocumentEditable) return;
    setHeaderUdfs((prev) => ({ ...prev, [key]: value }));
  };

  const handleRowUdfChange = (lineIndex, key, value) => {
    if (!isDocumentEditable) return;
    setLines((prev) => prev.map((line, index) => (
      index === lineIndex ? { ...line, udf: { ...(line.udf || {}), [key]: value } } : line
    )));
  };

  const updateFormSetting = (groupKey, fieldKey, prop, value) => setFormSettings((prev) => ({
    ...prev,
    [groupKey]: {
      ...(prev[groupKey] || {}),
      [fieldKey]: { ...((prev[groupKey] || {})[fieldKey] || {}), [prop]: value },
    },
  }));

  const toggleHeaderUdfs = () => {
    setFormSettingsOpen(false);
    setSidebarOpen((prev) => !prev);
  };

  const toggleFormSettings = () => {
    setSidebarOpen(false);
    setFormSettingsOpen((prev) => !prev);
  };

  const openAddressModal = (type) => {
    if (!isDocumentEditable) return;
    const normalizedType = type === 'payTo' ? 'billTo' : type;
    const addressPool = normalizedType === 'billTo' ? vendorEffectiveBillToAddresses : vendorEffectiveShipToAddresses;
    const selectedCode = normalizedType === 'billTo' ? header.billToCode : header.shipToCode;
    const selectedAddress = addressPool.find((address) => String(address.Address || '') === String(selectedCode || ''));

    setAddressForm(mapAddressToModalForm(selectedAddress, {
      shipToCode: header.shipToCode || '',
      shipToAddress: header.shipToAddress || '',
      billToCode: header.billToCode || '',
      billToAddress: header.billToAddress || '',
    }));
    setAddressModal({ type: normalizedType });
  };

  const closeAddressModal = () => {
    setAddressModal(null);
  };

  const handleAddressFormChange = (event) => {
    const { name, value } = event.target;
    setAddressForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveAddressModal = () => {
    if (!isDocumentEditable || !addressModal) return;
    const formatted = [
      [addressForm.streetPoBox, addressForm.streetNo].filter(Boolean).join(', '),
      addressForm.buildingFloorRoom,
      [addressForm.block, addressForm.city].filter(Boolean).join(', '),
      [addressForm.county, addressForm.state, addressForm.zipCode].filter(Boolean).join(', '),
      addressForm.countryRegion,
      addressForm.addressName2,
      addressForm.addressName3,
    ].filter(Boolean).join('\n');

    setHeader((prev) => ({
      ...prev,
      shipToCode: addressForm.shipToCode || prev.shipToCode,
      shipToAddress: addressModal.type === 'shipTo' ? (formatted || addressForm.shipToAddress) : (addressForm.shipToAddress || prev.shipToAddress),
      billToCode: addressForm.billToCode || prev.billToCode,
      billToAddress: addressModal.type === 'billTo' ? (formatted || addressForm.billToAddress) : (addressForm.billToAddress || prev.billToAddress),
      placeOfSupply:
        addressForm.state && (addressModal.type === 'shipTo' || prev.useBillToForTax || prev.usePayToForTax)
          ? addressForm.state
          : prev.placeOfSupply,
    }));
    closeAddressModal();
  };

  const openTaxInfoModal = () => {
    if (!isDocumentEditable) return;
    setTaxInfoModal(true);
  };

  const closeTaxInfoModal = () => {
    setTaxInfoModal(false);
  };

  const saveTaxInfoModal = () => {
    closeTaxInfoModal();
  };

  const handleTaxInfoFormChange = (event) => {
    const { name, value } = event.target;
    setTaxInfoForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBrowseAttachment = () => {
    if (!isDocumentEditable) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length) {
        setPageState((prev) => ({ ...prev, success: `Selected ${files.length} file(s). Upload will be added later.`, error: '' }));
      }
    };
    input.click();
  };

  const validate = () => {
    const errors = { header: {}, lines: {}, form: '' };
    if (!String(header.vendor || '').trim()) errors.header.vendor = 'Vendor is required';
    if (!String(header.postingDate || '').trim()) errors.header.postingDate = 'Posting Date is required';
    if (!String(header.documentDate || '').trim()) errors.header.documentDate = 'Document Date is required';
    if (header.series === 'manual' && parseNum(header.docNo) <= 0) errors.header.docNo = 'Document No. is required for Manual series';

    const populated = lines.filter((line) => String(line.description || line.glAccount || line.totalLC || '').trim());
    if (!populated.length) errors.form = 'At least one service line is required.';
    lines.forEach((line, index) => {
      if (!String(line.description || line.glAccount || line.totalLC || '').trim()) return;
      const lineErrors = {};
      if (!String(line.description || '').trim()) lineErrors.description = 'Description is required';
      if (!String(line.glAccount || '').trim()) lineErrors.glAccount = 'G/L Account is required';
      if (!String(line.taxCode || '').trim()) lineErrors.taxCode = 'Tax Code is required';
      if (parseNum(line.totalLC) <= 0) lineErrors.totalLC = 'Total is required';
      if (Object.keys(lineErrors).length) errors.lines[index] = lineErrors;
    });
    return errors;
  };

  const buildPayload = () => ({
    header,
    lines: lines
      .filter((line) => String(line.description || line.glAccount || line.totalLC || '').trim())
      .map((line) => ({
        ...line,
        udf: normalizeUdfState(rowUdfDefinitions, line.udf || {}),
      })),
    header_udfs: normalizeUdfState(headerUdfDefinitions, headerUdfs),
    totals,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isDocumentEditable) {
      setPageState((prev) => ({ ...prev, success: '', error: 'Closed Service A/P Invoices cannot be edited.' }));
      return;
    }

    const errors = validate();
    if (errors.form || Object.keys(errors.header).length || Object.keys(errors.lines).length) {
      setValErrors(errors);
      setPageState((prev) => ({ ...prev, success: '', error: errors.form || 'Please correct the highlighted fields.' }));
      return;
    }

    setPageState((prev) => ({ ...prev, posting: true, error: '', success: '' }));
    try {
      const res = currentDocEntry
        ? await updateServiceAPInvoice(currentDocEntry, buildPayload())
        : await submitServiceAPInvoice(buildPayload());
      const docEntry = res.data?.doc_entry || res.data?.DocEntry || currentDocEntry;
      const docNum = res.data?.doc_num || res.data?.DocNum || header.docNo;
      setCurrentDocEntry(docEntry);
      setHeader((prev) => ({ ...prev, docNo: docNum ? String(docNum) : prev.docNo, status: 'Open' }));
      setPageState((prev) => ({ ...prev, posting: false, success: `${res.data?.message || 'Service A/P Invoice saved.'}${docNum ? ` Doc No: ${docNum}` : ''}` }));
    } catch (error) {
      const message = error.response?.data?.detail?.error?.message?.value || error.response?.data?.message || error.message || 'Service A/P Invoice submission failed.';
      setPageState((prev) => ({ ...prev, posting: false, error: message }));
    }
  };

  const resetForm = () => {
    const firstSeries = seriesOptions[0];
    setCurrentDocEntry(null);
    setHeader({
      ...INIT_HEADER,
      series: firstSeries ? String(firstSeries.Series || '') : '',
      nextNumber: firstSeries ? String(firstSeries.NextNumber || '') : '',
    });
    setHeaderUdfs(createUdfState(headerUdfDefinitions));
    setLines([createLine(rowUdfDefinitions)]);
    setActiveTab('Contents');
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState((prev) => ({ ...prev, error: '', success: '' }));
  };

  const openCopyFromModal = (docType) => {
    if (!isDocumentEditable) return;
    if (!header.vendor) {
      setValErrors({ header: { vendor: 'Select Vendor first' }, lines: {}, form: '' });
      return;
    }
    setCopyFromDocType(docType);
    setCopyFromModal(true);
  };

  const fetchCopyFromDocuments = async (docType) => {
    const vendorCode = String(header.vendor || '').trim();
    if (docType === 'purchaseQuotation') {
      const res = await fetchOpenServicePurchaseQuotationsForAPInvoice(vendorCode);
      return res.data?.documents || [];
    }
    if (docType === 'purchaseOrder') {
      const res = await fetchOpenServicePurchaseOrdersForAPInvoice(vendorCode);
      return res.data?.documents || [];
    }
    if (docType === 'grpo') {
      const res = await fetchOpenServiceGRPOForAPInvoice(vendorCode);
      return res.data?.documents || [];
    }
    return [];
  };

  const fetchCopyFromDocumentDetails = async (docType, docEntry) => {
    if (docType === 'purchaseQuotation') {
      const res = await fetchServicePurchaseQuotationForAPInvoiceCopy(docEntry);
      return res.data;
    }
    if (docType === 'purchaseOrder') {
      const res = await fetchServicePurchaseOrderForAPInvoiceCopy(docEntry);
      return res.data;
    }
    if (docType === 'grpo') {
      const res = await fetchServiceGRPOForAPInvoiceCopy(docEntry);
      return res.data;
    }
    return null;
  };

  const handleCopyFrom = (data, sourceType) => {
    const copySource = unwrapCopyFromDocument(data);
    const sourceLines = toArray(copySource.lines, ['lines', 'DocumentLines']);
    const copyKey = `${sourceType}-${copySource.docEntry}-${sourceLines.length}`;
    if (handledCopyFromRef.current === copyKey) return;
    handledCopyFromRef.current = copyKey;

    const normalizedHeader = normaliseDocumentHeader(copySource.header);
    setHeader((prev) => ({
      ...prev,
      ...normalizedHeader,
      transactionType: normalizedHeader.transactionType || prev.transactionType || transactionTypeOptions[0]?.value || 'GST Tax Invoice',
    }));
    const baseType = BASE_TYPE[sourceType] || 17;
    const copyLines = sourceLines;
    setLines(copyLines.length
      ? copyLines.map((line, index) => ({
        ...normalizeCopyLine(line, index, copySource.docEntry, baseType, accounts),
        udf: createUdfState(rowUdfDefinitions),
      }))
      : [createLine(rowUdfDefinitions)]);
    setActiveTab('Contents');
    setPageState((prev) => ({ ...prev, success: 'Copied service document lines.', error: '' }));
  };

  const handleCopyTo = async () => {
    await copyToDocument({
      sourceDocType: 'serviceApInvoice',
      targetType: 'apCreditMemo',
      sourceDocEntry: currentDocEntry,
      sourceDocNo: header.docNo,
      sourcePath: location.pathname,
      sourceSnapshot: {
        header,
        lines: lines.map((line) => ({ ...line, udf: normalizeUdfState(rowUdfDefinitions, line.udf || {}) })),
        headerUdfs: normalizeUdfState(headerUdfDefinitions, headerUdfs),
      },
      restoreState: { serviceApInvoiceDocEntry: currentDocEntry },
      navigate,
      upsertTask,
      removeTask,
      setError: (message) => setPageState((prev) => ({ ...prev, success: '', error: message })),
      errorMessage: 'Please save the Service A/P Invoice first before copying.',
    });
  };

  const renderLineCell = (line, index, column) => {
    const error = valErrors.lines[index]?.[column.key];
    if (column.isUdf) {
      const disabled =
        !isDocumentEditable ||
        column.readOnly ||
        formSettings.rowUdfs?.[column.udfKey]?.active === false;
      const value = line.udf?.[column.udfKey] || '';

      if (column.type === 'checkbox') {
        const checked = ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase());
        return (
          <input
            type="checkbox"
            className="form-check-input service-ap-udf-checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => handleRowUdfChange(index, column.udfKey, event.target.checked ? 'Y' : 'N')}
          />
        );
      }

      if (column.type === 'select') {
        return (
          <select
            className="del-grid__input"
            value={value}
            disabled={disabled}
            onChange={(event) => handleRowUdfChange(index, column.udfKey, event.target.value)}
          >
            <option value=""></option>
            {toArray(column.options, ['options']).map((option) => {
              const normalized = typeof option === 'object' ? option : { value: option, label: option };
              return (
                <option key={normalized.value} value={normalized.value}>
                  {normalized.label}
                </option>
              );
            })}
          </select>
        );
      }

      return (
        <input
          className="del-grid__input"
          type={column.type === 'date' ? 'date' : column.type === 'number' ? 'number' : 'text'}
          value={value}
          disabled={disabled}
          onChange={(event) => handleRowUdfChange(index, column.udfKey, event.target.value)}
        />
      );
    }

    const renderLookupInput = ({ value = line[column.key] || '', onOpen, readOnly = false, title = 'Select value' }) => (
      <div className="service-ap-lookup-cell">
        <input
          className={`del-grid__input${error ? ' del-field__input--error' : ''}`}
          name={column.key}
          value={value}
          onChange={(event) => handleLineChange(index, event)}
          readOnly={readOnly}
          disabled={!isDocumentEditable || readOnly}
          title={title}
        />
        <button
          type="button"
          className="del-btn service-ap-lookup-btn"
          onClick={onOpen}
          disabled={!isDocumentEditable}
          title={title}
        >
          ...
        </button>
      </div>
    );

    if (column.lookup === 'tax') {
      return (
        <TaxCodeLookup
          className={`del-grid__input${error ? ' del-field__input--error' : ''}`}
          name={column.key}
          value={line[column.key] || ''}
          onChange={(event) => handleLineChange(index, event)}
          taxCodes={taxCodes}
          disabled={!isDocumentEditable}
        />
      );
    }

    if (column.lookup === 'yesNo') {
      return (
        <select className="del-grid__input" name={column.key} value={line[column.key] || 'Yes'} onChange={(event) => handleLineChange(index, event)} disabled={!isDocumentEditable}>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }

    if (column.lookup === 'distRule') {
      return renderLookupInput({
        title: 'Select Distribution Rule',
        onOpen: () => openLineLookup('distRule', index, {
          title: 'List of Distribution Rules',
          options: distributionRuleLookupOptions,
          searchPlaceholder: 'Search distribution rules',
          emptyMessage: 'No distribution rules found',
          columns: [
            { key: 'value', label: 'Distr. Rule', width: 140, primary: true },
            { key: 'description', label: 'Description' },
          ],
        }),
      });
    }

    if (column.lookup === 'account') {
      return renderLookupInput({
        title: 'Select G/L Account',
        onOpen: () => openLineLookup('glAccount', index, {
          title: 'List of G/L Accounts',
          options: accountLookupOptions,
          searchPlaceholder: 'Search G/L accounts',
          emptyMessage: 'No G/L accounts found',
          columns: [
            { key: 'accountNumber', label: 'Account Number', width: 150, primary: true },
            { key: 'accountName', label: 'Account Name' },
            { key: 'accountBalance', label: 'Account Balance', width: 130, align: 'right' },
            { key: 'inactive', label: 'Inactive', width: 90 },
          ],
        }),
      });
    }

    if (column.lookup === 'sac') {
      return renderLookupInput({
        title: 'Select SAC Code',
        onOpen: () => openLineLookup('sac', index),
      });
    }

    if (column.lookup === 'location') {
      return renderLookupInput({
        title: 'Select Location',
        onOpen: () => openLineLookup('loc', index),
      });
    }

    if (column.lookup === 'item') {
      return renderLookupInput({
        title: 'Select Item',
        onOpen: () => openLineLookup('sItem', index),
      });
    }

    if (LINE_LOOKUP_FIELDS.has(column.key)) {
      return renderLookupInput({
        title: `Select ${column.label}`,
        onOpen: () => openLineLookup(column.key, index),
      });
    }

    return (
      <input
        className={`del-grid__input${error ? ' del-field__input--error' : ''}`}
        type={column.type === 'date' ? 'date' : 'text'}
        name={column.key}
        value={line[column.key] || ''}
        onChange={(event) => handleLineChange(index, event)}
        readOnly={column.readOnly}
        disabled={!isDocumentEditable || column.readOnly}
        style={{ textAlign: column.numeric || column.readOnly ? 'right' : 'left' }}
      />
    );
  };

  const vendorOptions = toArray(refData.vendors, ['vendors']);
  const contactOptions = toArray(refData.contacts, ['contacts']);
  const visibleHeaderUdfs = headerUdfDefinitions.filter((field) => formSettings.headerUdfs?.[field.key]?.visible !== false);
  const configurableRowUdfs = rowUdfDefinitions.filter((field) => !isFixedServiceMatrixField(field));
  const visibleRowUdfs = configurableRowUdfs.filter((field) => formSettings.rowUdfs?.[field.key]?.visible !== false);
  const visibleContentColumns = CONTENT_COLUMNS.filter((column) => formSettings.matrixColumns?.[column.key]?.visible !== false);
  const visibleLineColumns = [
    ...visibleContentColumns,
    ...visibleRowUdfs.map((field) => ({
      key: `udf:${field.key}`,
      udfKey: field.key,
      label: field.label,
      width: Math.max(140, Math.min(Number(field.maxLength || 160), 260)),
      type: field.type,
      readOnly: field.readOnly,
      isUdf: true,
      options: toArray(field.options, ['options']),
    })),
  ];
  const tableMinWidth = 42 + 48 + visibleLineColumns.reduce((sum, column) => sum + column.width, 0);

  return (
    <form className={`ap-invoice-page del-page sap-document-page service-ap-invoice-page${isRightSidebarOpen ? ' del-page--sidebar-open' : ''}`} onSubmit={handleSubmit}>
      <div className="del-toolbar sap-document-toolbar">
        <span className="del-toolbar__title sap-document-toolbar__title">Service A/P Invoice{currentDocEntry ? ` - #${header.docNo || currentDocEntry}` : ''}</span>
        <button type="submit" className="del-btn del-btn--primary sap-document-toolbar__primary" disabled={pageState.posting || !isDocumentEditable}>
          {currentDocEntry ? 'Update' : 'Add'}
        </button>
        <button type="button" className="del-btn sap-document-toolbar__cancel" onClick={resetForm}>Cancel</button>
        <button type="button" className="del-btn sap-document-toolbar__udf" onClick={toggleHeaderUdfs}>
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button type="button" className="del-btn sap-document-toolbar__settings" onClick={toggleFormSettings}>Form Settings</button>
        <PrintLayoutToolbar
          documentType="serviceApInvoice"
          documentLabel="Service A/P Invoice"
          docEntry={currentDocEntry}
          docNumber={header.docNo}
          disabled={pageState.posting}
          classPrefix="del"
          onSuccess={(message) => setPageState((prev) => ({ ...prev, error: '', success: message }))}
          onError={(message) => setPageState((prev) => ({ ...prev, success: '', error: message }))}
        />
        <button type="button" className="del-btn sap-document-toolbar__find" onClick={() => navigate('/services/ap-invoice/find')}>Find</button>
        <button type="button" className="del-btn sap-document-toolbar__new" onClick={resetForm}>New</button>
        <div className="del-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" className="del-btn" disabled={!isDocumentEditable} onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const dropdown = event.currentTarget.parentElement;
            const isActive = dropdown.classList.contains('active');
            document.querySelectorAll('.del-dropdown').forEach((item) => item.classList.remove('active'));
            if (!isActive) dropdown.classList.add('active');
          }}>
            Copy From
          </button>
          <div className="del-dropdown-menu">
            {[
              { key: 'purchaseQuotation', label: 'Purchase Quotations' },
              { key: 'purchaseOrder', label: 'Purchase Orders' },
              { key: 'grpo', label: 'Goods Receipt POs' },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openCopyFromModal(option.key);
                  document.querySelectorAll('.del-dropdown').forEach((item) => item.classList.remove('active'));
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="del-btn sap-document-toolbar__copy" onClick={handleCopyTo} disabled={!currentDocEntry}>Copy To</button>
      </div>

      {pageState.loading && <div className="alert alert-success py-2">Loading...</div>}
      {pageState.error && <div className="alert alert-danger py-2">{pageState.error}</div>}
      {pageState.success && <div className="alert alert-success py-2">{pageState.success}</div>}

      <fieldset disabled={pageState.posting} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className={`so-layout${isRightSidebarOpen ? ' is-sidebar-open' : ''}`}>
          <div className="so-layout__main">
        <div className="del-header-card service-ap-header-card">
          <div className="del-field-grid service-ap-header-grid">
            <div>
              <div className="del-field">
                <label className="del-field__label">Vendor</label>
                <div className="service-ap-header-lookup">
                  <input className={`del-field__input${valErrors.header.vendor ? ' del-field__input--error' : ''}`} name="vendor" value={header.vendor} list="service-ap-invoice-vendors" onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                  <button type="button" className="del-btn service-ap-lookup-btn" onClick={() => setBpModalOpen(true)} disabled={!isDocumentEditable} title="List of Business Partners">...</button>
                </div>
              </div>
              <div className="del-field">
                <label className="del-field__label">Name</label>
                <input className="del-field__input" name="name" value={header.name} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">Contact Person</label>
                <select className="del-field__select" name="contactPerson" value={header.contactPerson} onChange={handleHeaderChange} disabled={!isDocumentEditable}>
                  <option value=""></option>
                  {contactOptions.map((contact) => (
                    <option key={contact.CntctCode || contact.Name} value={contact.CntctCode}>{contact.Name}</option>
                  ))}
                </select>
              </div>
              <div className="del-field">
                <label className="del-field__label">Vendor Ref. No</label>
                <input className="del-field__input" name="salesContractNo" value={header.salesContractNo} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">Local Currency</label>
                <input className="del-field__input" name="currency" value={header.currency} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">Transaction Type</label>
                <select className="del-field__select" name="transactionType" value={header.transactionType} onChange={handleHeaderChange} disabled={!isDocumentEditable}>
                  {transactionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="del-field">
                <label className="del-field__label">Place of Supply</label>
                <div className="service-ap-header-lookup">
                  <input className="del-field__input" name="placeOfSupply" value={header.placeOfSupply} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                  <button type="button" className="del-btn service-ap-lookup-btn" onClick={() => setStateModalOpen(true)} disabled={!isDocumentEditable} title="List of States">...</button>
                </div>
              </div>
              <div className="del-field">
                <label className="del-field__label">Indicator</label>
                <input className="del-field__input" name="indicator" value={header.indicator} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
            </div>

            <div>
              <div className="del-field">
                <label className="del-field__label">No.</label>
                <div className="service-ap-docnum">
                  <select className="del-field__select" name="series" value={header.series} onChange={handleHeaderChange} disabled={!isDocumentEditable || currentDocEntry || pageState.seriesLoading}>
                    <option value="manual">Manual</option>
                    {seriesOptions.map((series) => (
                      <option key={series.Series} value={series.Series}>{series.SeriesName}</option>
                    ))}
                  </select>
                  <input
                    className={`del-field__input${valErrors.header.docNo ? ' del-field__input--error' : ''}`}
                    name="docNo"
                    value={pageState.seriesLoading ? '...' : (header.docNo || header.nextNumber || '')}
                    onChange={handleHeaderChange}
                    readOnly={header.series !== 'manual'}
                    disabled={!isDocumentEditable || currentDocEntry || pageState.seriesLoading}
                  />
                </div>
              </div>
              <div className="del-field">
                <label className="del-field__label">Status</label>
                <input className="del-field__input" value={header.status} readOnly />
              </div>
              <div className="del-field">
                <label className="del-field__label">Posting Date</label>
                <input type="date" className={`del-field__input${valErrors.header.postingDate ? ' del-field__input--error' : ''}`} name="postingDate" value={header.postingDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">Due Date</label>
                <input type="date" className="del-field__input" name="deliveryDate" value={header.deliveryDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">Document Date</label>
                <input type="date" className={`del-field__input${valErrors.header.documentDate ? ' del-field__input--error' : ''}`} name="documentDate" value={header.documentDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">B_FromDate</label>
                <input type="date" className="del-field__input" name="bFromDate" value={header.bFromDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">B_ToDate</label>
                <input type="date" className="del-field__input" name="bToDate" value={header.bToDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
            </div>
          </div>
        </div>

        <div className="del-tabs">
          {TAB_NAMES.map((tabName) => (
            <button
              key={tabName}
              type="button"
              className={`del-tab${activeTab === tabName ? ' del-tab--active' : ''}`}
              onClick={() => setActiveTab(tabName)}
            >
              {tabName}
            </button>
          ))}
        </div>

        {activeTab === 'Contents' && (
          <div className="del-tab-panel" style={{ overflow: 'visible', minWidth: 0 }}>
            <div className="service-ap-content-toolbar">
              <div className="service-ap-content-controls">
                <label className="service-ap-content-control">
                  <span>Item/Service Type</span>
                  <select
                    className="del-field__select"
                    name="itemServiceType"
                    value={header.itemServiceType}
                    onChange={handleHeaderChange}
                    disabled
                  >
                    <option value="Service">Service</option>
                  </select>
                </label>
                <label className="service-ap-content-control">
                  <span>Summary Type</span>
                  <select
                    className="del-field__select"
                    name="summaryType"
                    value={header.summaryType}
                    onChange={handleHeaderChange}
                    disabled={!isDocumentEditable}
                  >
                    <option value="No Summary">No Summary</option>
                    <option value="By Documents">By Documents</option>
                    <option value="By Items">By Items</option>
                  </select>
                </label>
              </div>
              <button type="button" className="del-btn del-btn--primary" onClick={addLine} disabled={!isDocumentEditable}>+ Add Line</button>
            </div>

            <div className="del-grid-wrap del-grid-wrap--contents">
              <div className="del-grid-wrap__scroller del-grid-wrap__scroller--contents">
                <table className="del-grid del-grid--contents" style={{ width: 'max-content', minWidth: tableMinWidth, tableLayout: 'auto' }}>
                  <colgroup>
                    <col style={{ width: 42 }} />
                    {visibleLineColumns.map((column) => <col key={column.key} style={{ width: column.width }} />)}
                    <col style={{ width: 48 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      {visibleLineColumns.map((column) => <th key={column.key}>{column.label}</th>)}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td className="del-grid__cell--muted" style={{ textAlign: 'center' }}>{index + 1}</td>
                        {visibleLineColumns.map((column) => (
                          <td key={column.key}>{renderLineCell(line, index, column)}</td>
                        ))}
                        <td>
                          <button type="button" className="del-btn del-btn--danger" style={{ padding: '2px 6px' }} onClick={() => removeLine(index)} disabled={!isDocumentEditable}>x</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Logistics' && (
          <LogisticsTab
            header={header}
            onHeaderChange={handleHeaderChange}
            effectiveWhseAddrs={[]}
            vendorPayToAddresses={vendorPayToAddresses}
            vendorShipToAddresses={vendorEffectiveShipToAddresses}
            vendorBillToAddresses={vendorEffectiveBillToAddresses}
            shippingTypeOptions={shipTypeOpts}
            onOpenAddressModal={openAddressModal}
            isEditable={isDocumentEditable}
          />
        )}

        {activeTab === 'Accounting' && (
          <AccountingTab
            header={header}
            onHeaderChange={handleHeaderChange}
            paymentTermOptions={payTermOpts}
            isEditable={isDocumentEditable}
          />
        )}

        {activeTab === 'Tax' && (
          <TaxTab onOpenTaxInfoModal={openTaxInfoModal} isEditable={isDocumentEditable} />
        )}

        {activeTab === 'Electronic Documents' && (
          <ElectronicDocumentsTab />
        )}

        {activeTab === 'Attachments' && (
          <AttachmentsTab
            attachments={attachments}
            onBrowseAttachment={handleBrowseAttachment}
            isEditable={isDocumentEditable}
          />
        )}

        <div className="del-header-card service-ap-footer-card">
          <div className="del-field-grid service-ap-footer-grid">
            <div className="service-ap-footer-left">
              <div className="del-field">
                <label className="del-field__label">Buyer</label>
                <select className="del-field__select" name="salesEmployee" value={header.salesEmployee} onChange={handleHeaderChange} disabled={!isDocumentEditable}>
                  <option value="">No Buyer</option>
                  {salesEmployeeOptions.map((employee) => (
                    <option key={employee.SlpCode} value={employee.SlpCode}>{employee.SlpName}</option>
                  ))}
                </select>
              </div>
              <div className="del-field">
                <label className="del-field__label">Owner</label>
                <input className="del-field__input" name="owner" value={header.owner} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
              <div className="del-field">
                <label className="del-field__label">Remarks</label>
                <textarea className="del-textarea" rows={3} name="remarks" value={header.remarks} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
              </div>
            </div>
            <div className="service-ap-summary">
              <table className="del-grid service-ap-summary-table">
                <tbody>
                  <tr><td>Total Before Discount</td><td><input className="del-grid__input" value={fmt(totals.subtotal)} readOnly /></td></tr>
                  <tr><td>Discount %</td><td><input className="del-grid__input" name="discount" value={header.discount} onChange={handleHeaderChange} disabled={!isDocumentEditable} /></td></tr>
                  <tr><td>Total Down Payment</td><td><input className="del-grid__input" name="totalDownPayment" value={header.totalDownPayment} onChange={handleHeaderChange} disabled={!isDocumentEditable} /></td></tr>
                  <tr><td>Freight</td><td><input className="del-grid__input" name="freight" value={header.freight} onChange={handleHeaderChange} disabled={!isDocumentEditable} /></td></tr>
                  <tr><td><label className="service-ap-checkbox"><input type="checkbox" name="rounding" checked={header.rounding} onChange={handleHeaderChange} disabled={!isDocumentEditable} /> Rounding</label></td><td><input className="del-grid__input" value="INR 0.00" readOnly /></td></tr>
                  <tr><td>Tax</td><td><input className="del-grid__input" value={fmt(totals.tax)} readOnly /></td></tr>
                  <tr><td>WTax Amount</td><td><input className="del-grid__input" value={fmt(totals.wtaxAmount)} readOnly /></td></tr>
                  <tr style={{ borderTop: '2px solid #a0aab4' }}><td style={{ fontWeight: 700 }}>Total</td><td><input className="del-grid__input" value={fmt(totals.total)} readOnly style={{ fontWeight: 700 }} /></td></tr>
                  <tr><td>Applied Amount</td><td><input className="del-grid__input" name="appliedAmount" value={header.appliedAmount} onChange={handleHeaderChange} disabled={!isDocumentEditable} /></td></tr>
                  <tr><td>Balance Due</td><td><input className="del-grid__input" value={fmt(totals.balanceDue)} readOnly /></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
          </div>

          <HeaderUdfSidebar
            className="so-layout__sidebar"
            isOpen={sidebarOpen}
            fields={visibleHeaderUdfs}
            formSettings={formSettings}
            values={headerUdfs}
            disabled={!hasVendorCode}
            onFieldChange={handleHeaderUdfChange}
            onClose={() => setSidebarOpen(false)}
          />
          <FormSettingsPanel
            variant="sidebar"
            className="so-layout__sidebar"
            isOpen={formSettingsOpen}
            onClose={() => setFormSettingsOpen(false)}
            matrixFields={CONTENT_COLUMNS}
            headerUdfFields={headerUdfDefinitions}
            rowUdfFields={configurableRowUdfs}
            formSettings={formSettings}
            onSettingChange={updateFormSetting}
          />
        </div>
      </fieldset>

      <datalist id="service-ap-invoice-vendors">
        {vendorOptions.map((vendor) => (
          <option key={vendor.CardCode || vendor.code} value={vendor.CardCode || vendor.code}>
            {vendor.CardName || vendor.name}
          </option>
        ))}
      </datalist>
      <datalist id="service-ap-invoice-accounts">
        {accounts.map((account) => (
          <option key={account.code} value={account.code}>{account.name}</option>
        ))}
      </datalist>

      <CopyFromModal
        isOpen={copyFromModal}
        onClose={() => setCopyFromModal(false)}
        onCopy={handleCopyFrom}
        documentType={copyFromDocType}
        onFetchDocuments={fetchCopyFromDocuments}
        onFetchDocumentDetails={fetchCopyFromDocumentDetails}
      />

      <BusinessPartnerModal
        isOpen={bpModalOpen}
        onClose={() => setBpModalOpen(false)}
        onSelect={selectVendor}
        businessPartners={vendorOptions}
        title="List of Vendors"
      />

      <StateSelectionModal
        isOpen={stateModalOpen}
        onClose={() => setStateModalOpen(false)}
        onSelect={(state) => {
          setHeader((prev) => ({ ...prev, placeOfSupply: state.Code || state.code || '' }));
          setStateModalOpen(false);
        }}
        states={stateOptions}
      />

      <LineValueLookupModal
        isOpen={lineLookupModal.open}
        onClose={closeLineLookup}
        onSelect={handleLineLookupSelect}
        options={lineLookupModal.options}
        title={lineLookupModal.title}
        searchPlaceholder={lineLookupModal.searchPlaceholder}
        emptyMessage={lineLookupModal.emptyMessage}
        allowCreate={lineLookupModal.allowCreate}
        columns={lineLookupModal.columns}
      />

      <AddressModal
        isOpen={!!addressModal}
        onClose={closeAddressModal}
        onSave={saveAddressModal}
        addressForm={addressForm}
        onFormChange={handleAddressFormChange}
        states={stateOptions}
      />

      <TaxInfoModal
        isOpen={taxInfoModal}
        onClose={closeTaxInfoModal}
        onSave={saveTaxInfoModal}
        taxInfoForm={taxInfoForm}
        onFormChange={handleTaxInfoFormChange}
      />

    </form>
  );
}

export default ServiceAPInvoicePage;
