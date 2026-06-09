import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import './styles/arInvoice.css';
import { useLocation, useNavigate } from 'react-router-dom';
import FormSettingsPanel from '../../components/purchase-order/FormSettingsPanel';
import HeaderUdfSidebar from '../../components/purchase-order/HeaderUdfSidebar';
import LineValueLookupModal from '../../components/sales-document/LineValueLookupModal';
import ContentsTab from './components/ContentsTab';
import LogisticsTab from './components/LogisticsTab';
import AccountingTab from './components/AccountingTab';
import TaxTab from './components/TaxTab';
import ElectronicDocumentsTab from './components/ElectronicDocumentsTab';
import AttachmentsTab from './components/AttachmentsTab';
import AddressModal from './components/AddressModal';
import TaxInfoModal from './components/TaxInfoModal';
import BusinessPartnerModal from '../sales-order/components/BusinessPartnerModal';
import StateSelectionModal from '../sales-order/components/StateSelectionModal';
import HSNCodeModal from './components/HSNCodeModal';
import ItemSelectionModal from './components/ItemSelectionModal';
import WithholdingTaxTableModal from '../APInvoice/components/WithholdingTaxTableModal';
import FreightChargesModal from '../../components/freight/FreightChargesModal';
import DocumentCurrencySelect from '../../components/document/DocumentCurrencySelect';
import PrintLayoutToolbar from '../../components/print-layout/PrintLayoutToolbar';
import SalesEmployeeSetupModal from '../../components/sales-employee/SalesEmployeeSetupModal';
import { summarizeFreightRows } from '../../components/freight/freightUtils';
import CopyFromModal from './components/CopyFromModal';
import { useSapWindowTaskbarActions } from '../../components/SapWindowTaskbarContext';
import { copyToDocument } from '../../services/documentCopyService';
import { duplicateDocumentInPlace, refreshDuplicateSeries } from '../../utils/documentDuplicate';
import { determineTaxCode, recalculateAllTaxCodes, getGSTTypeLabel } from '../../utils/taxEngine';
import { filterWarehousesByBranch } from '../../utils/warehouseBranch';
import { hydrateDocumentLineFromItem, mergeItemMaster } from '../../utils/documentItemHydration';
import { FALLBACK_UOM, FALLBACK_WAREHOUSES } from '../../utils/fallbackReferenceData';
import { getDefaultSeriesForCurrentYear } from '../../utils/seriesDefaults';
import { useCompanyScopedFormSettings } from '../../utils/formSettingsStorage';
import { buildVisibleEnteredRowUdfPayload } from '../../utils/rowUdfPayload';
import { getStateCodeValue, getStateDisplayName } from '../../utils/stateDisplay';
import { findTaxCode, getTaxComponentCodes } from '../../utils/taxCodeComponents';
import { consumeCopyToState, replaceRouteStatePreservingWindow } from '../../utils/copyToState';
import useValidationHighlights from '../../utils/useValidationHighlights';
import useSalesEmployeeSetup from '../../hooks/useSalesEmployeeSetup';
import {
  fetchARInvoiceReferenceData,
  fetchARInvoiceCustomerDetails,
  fetchARInvoiceByDocEntry,
  submitARInvoice,
  updateARInvoice,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchFreightCharges,
  fetchItemsForModal,
  fetchOpenSalesQuotationsForARInvoice,
  fetchSalesQuotationForARInvoiceCopy,
  fetchOpenSalesOrdersForARInvoice,
  fetchSalesOrderForARInvoiceCopy,
  fetchOpenDeliveriesForARInvoice,
  fetchDeliveryForARInvoiceCopy,
  fetchOpenBlanketAgreementsForARInvoice,
  fetchBlanketAgreementForARInvoiceCopy,
} from '../../api/arInvoiceApi';
import { fetchHSNCodeFromItem } from '../../api/hsnCodeApi';
import { AR_INVOICE_COMPANY_ID } from '../../config/appConfig';
import { arInvoiceCopyFromApi, normaliseDocumentHeader, normaliseDocumentLine, unwrapCopyFromDocument, BASE_TYPE } from '../../api/copyFromApi';
import {
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
} from '../../config/arInvoiceForm';

// ─── helpers ─────────────────────────────────────────────────────────────────
const getErrMsg = (e, fb) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (d?.error?.message) return d.error.message;
  if (d?.message) return d.message;
  return e?.message || fb;
};
const today = () => new Date().toISOString().split('T')[0];
const parseNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const roundTo = (v, d) => { const f = 10 ** Math.max(d, 0); return Math.round((v + Number.EPSILON) * f) / f; };
const fmtDec = (v, d) => { if (v === '' || v == null) return ''; const n = Number(v); return Number.isNaN(n) ? '' : n.toFixed(Math.max(d, 0)); };
const sanitize = (v, d) => {
  const c = String(v ?? '').replace(/[^\d.-]/g, '').replace(/(?!^)-/g, '').replace(/^(-?)\./, '$10.').replace(/(\..*)\./g, '$1');
  if (!c) return '';
  if (!c.includes('.')) return c;
  const [w, f] = c.split('.');
  return `${w}.${(f || '').slice(0, Math.max(d, 0))}`;
};
const fmtAddr = (a) => {
  if (!a) return '';
  return [[a.Street, a.StreetNo], [a.Block, a.Building, a.Address2, a.Address3],
  [a.City, a.County, a.State, a.ZipCode], [a.Country]]
    .map(p => p.filter(Boolean).join(', ')).filter(Boolean).join('\n');
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
const normalizeAddressText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const normalizeBaseLine = (line, fallbackIndex) =>
  line.baseLine ?? line.BaseLine ?? line.lineNum ?? line.LineNum ?? fallbackIndex;
const normalizeWarehouse = (line = {}, header = {}) =>
  line.whse || line.WarehouseCode || line.WhsCode || line.warehouse || header.warehouse || header.WarehouseCode || '';
const hasUdfValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const isCheckedValue = (value) =>
  ['Y', 'YES', 'TRUE', '1', 'TYES', true].includes(
    typeof value === 'string' ? value.trim().toUpperCase() : value
  );
const isYesValue = (value) => ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase());
const normalizeFieldIdentity = (value) =>
  String(value || '')
    .replace(/^U_/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
const fieldNameMatches = (field = {}, names = new Set()) =>
  names.has(normalizeFieldIdentity(field.key)) ||
  names.has(normalizeFieldIdentity(field.label)) ||
  names.has(normalizeFieldIdentity(field.aliasId)) ||
  names.has(normalizeFieldIdentity(field.sapField));
const getTransactionTypeFromUdfs = (definitions = [], values = {}) => {
  const field = definitions.find((definition) => fieldNameMatches(definition, TRANSACTION_TYPE_FIELD_NAMES));
  return field ? String(values?.[field.key] || '').trim() : '';
};
const mergeUdfValues = (...sources) =>
  sources.reduce((acc, source) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (hasUdfValue(value) || acc[key] === undefined) {
        acc[key] = value ?? '';
      }
    });
    return acc;
  }, {});

// ─── static fallbacks ────────────────────────────────────────────────────────
const FALLBACK_PAYMENT_TERMS = [
  { value: '0', label: 'Immediate' },
  { value: '1', label: 'Net 30' },
  { value: '2', label: 'Net 60' },
  { value: '3', label: 'Net 90' },
];
const FALLBACK_SHIPPING = [
  { value: '1', label: 'Air' },
  { value: '2', label: 'Sea' },
  { value: '3', label: 'Road' },
  { value: '4', label: 'Courier' },
];
// ─── constants ────────────────────────────────────────────────────────────────
const DEC = { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 };
const TAB_NAMES = ['Contents', 'Logistics', 'Accounting', 'Tax', 'Electronic Documents', 'Attachments'];
const DEFAULT_WAREHOUSE_CODE = '';
const TRANSACTION_TYPE_FIELD_NAMES = new Set(['transactiontype', 'transtype', 'documenttype', 'doctype']);
const DEFAULT_TRANSACTION_TYPES = [
  { value: 'GST Tax Invoice', label: 'GST Tax Invoice' },
  { value: 'Bill of Supply', label: 'Bill of Supply' },
  { value: 'GST Debit Memo', label: 'GST Debit Memo' },
];
const DOCUMENT_TYPE_CODE_BY_TRANSACTION_TYPE = {
  gsttaxinvoice: 'INV',
  taxinvoice: 'INV',
  billofsupply: 'BIL',
  gstdebitmemo: 'DBN',
  debitmemo: 'DBN',
};
const getDocumentTypeCodeForTransaction = (value) =>
  DOCUMENT_TYPE_CODE_BY_TRANSACTION_TYPE[normalizeFieldIdentity(value)] || value;

const createLine = (rowUdfDefinitions = ROW_UDF_DEFINITIONS) => ({
  itemNo: '', itemDescription: '', hsnCode: '', quantity: '', unitPrice: '',
  openQty: '', uomCode: '', stdDiscount: '', taxCode: '', total: '', whse: DEFAULT_WAREHOUSE_CODE,
  loc: '', branch: '', wTaxLiable: 'N', glAccount: '', distRule: '', taxLiable: 'Y',
  weight: '', taxAmount: '', uomName: '', cogsDistRule: '', countryOfOrigin: '',
  qtyInventoryUom: '', inventoryUOM: '', changeQtyInvUomIndependently: 'N',
  uomGroup: '', blanketAgreementNo: '', saudaNodeRef: '', apInvDocKey: '',
  apInvDocNum: '', apInvLineNum: '', assessableValue: '', bedRate: '',
  bedAmount: '', rg23dNo: '', specialRebate: '', commission: '',
  sellerBrokeragePerQty: '', sellerItem: '', sellerUnitPrice: '', sellerQty: '',
  sellerBrokerage: '', buyerBrokerage: '', buyerDelivery: '', sellerDelivery: '',
  buyerQuality: '', sellerQuality: '', buyerPrice: '', sellerPrice: '',
  buyerSpecialInstruction: '', sellerSpecialInstruction: '',
  sellerBrokerageAmtPer: '', sellerBrokeragePercent: '',
  buyerBillDiscount: '', sellerBillDiscount: '', sacCode: '', stcode: '',
  buyerPaymentTerms: '', sellerPaymentTerms: '', freightPurchase: '',
  freightSales: '', freightProvider: '', freightProviderName: '',
  documentCreated: '', brokerageNumber: '',
  udf: createUdfState(rowUdfDefinitions),
});

const INIT_HEADER = {
  vendor: '', name: '', contactPerson: '', salesContractNo: '', branch: '', warehouse: DEFAULT_WAREHOUSE_CODE,
  docNo: '', status: 'Open', series: '', nextNumber: '',
  postingDate: today(), deliveryDate: '', documentDate: today(), contractDate: '',
  branchRegNo: '', shipTo: '', shipToCode: '', payTo: '', payToCode: '',
  transactionType: '', indicator: '',
  shippingType: '', confirmed: false, journalRemark: '', paymentTerms: '',
  paymentMethod: '', otherInstruction: '', discount: '', freight: '', tax: '',
  totalPaymentDue: '', rounding: false, owner: '', purchaser: '', salesEmployee: '',
  placeOfSupply: '', currency: 'INR', useBillToForTax: false,
  billToAddress: '', billToCode: '', shipToAddress: '',
  ownerCode: '', language: '', trackingNo: '', stampNo: '', pickPackRemarks: '',
  bpChannelName: '', bpChannelContact: '',
};

const INIT_ATTACH = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, targetPath: '', fileName: '', attachmentDate: '',
  freeText: '', copyToTargetDocument: '', documentType: '', atchDocDate: '', alert: '',
}));

// ─── Main Component ───────────────────────────────────────────────────────────
function ARInvoicePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { removeTask, upsertTask } = useSapWindowTaskbarActions();
  const handledCopyFromRef = useRef('');
  const requestedEditDocEntry = location.state?.arInvoiceDocEntry;

  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [header, setHeader] = useState(INIT_HEADER);
  const [headerUdfDefinitions, setHeaderUdfDefinitions] = useState(HEADER_UDF_DEFINITIONS);
  const [rowUdfDefinitions, setRowUdfDefinitions] = useState(ROW_UDF_DEFINITIONS);
  const [matrixColumnDefinitions, setMatrixColumnDefinitions] = useState([]);
  const [lines, setLines] = useState([createLine(ROW_UDF_DEFINITIONS)]);
  const [attachments] = useState(INIT_ATTACH);
  const [activeTab, setActiveTab] = useState('Contents');
  const [headerUdfs, setHeaderUdfs] = useState(() => normalizeUdfState(HEADER_UDF_DEFINITIONS));
  const [formSettings, setFormSettings, formSettingsStorageKey] = useCompanyScopedFormSettings(
    FORM_SETTINGS_STORAGE_KEY,
    readSavedFormSettings,
    [headerUdfDefinitions, rowUdfDefinitions, matrixColumnDefinitions],
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [refData, setRefData] = useState({
    company: '', vendors: [], contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [], items: [],
    warehouses: [], warehouse_addresses: [], company_address: {}, tax_codes: [],
    withholding_tax_codes: [],
    default_branch: '', default_warehouse: '',
    gl_accounts: [], distribution_rules: [], payment_terms: [], shipping_types: [], branches: [], uom_groups: [],
    decimal_settings: DEC, warnings: [], series: [], states: [], transaction_types: [],
    matrix_columns: [],
    line_field_metadata: { matrix_columns: [], sap_form: {} },
  });
  const [pageState, setPageState] = useState({ loading: false, vendorLoading: false, posting: false, error: '', success: '', seriesLoading: false });
  const [valErrors, setValErrors] = useState({ header: {}, lines: {}, form: '' });
  useValidationHighlights(valErrors);
  const [snapshotPending, setSnapshotPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [addressModal, setAddressModal] = useState(null);
  const [taxInfoModal, setTaxInfoModal] = useState(false);
  const [bpModal, setBpModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [hsnModal, setHsnModal] = useState({ open: false, lineIndex: -1 });
  const [itemModal, setItemModal] = useState({ open: false, lineIndex: -1, items: [], loading: false });
  const [lineLookupModal, setLineLookupModal] = useState({
    open: false,
    lineIndex: -1,
    field: '',
    udfKey: '',
    title: '',
    options: [],
    searchPlaceholder: 'Search values',
    emptyMessage: 'No values found',
    columns: null,
  });
  const [freightModal, setFreightModal] = useState({ open: false, freightCharges: [], loading: false });
  const [withholdingTax, setWithholdingTax] = useState({
    open: false,
    customerSubject: false,
    defaultCode: '',
    allowedCodes: [],
    rows: [],
  });
  const [copyFromModal, setCopyFromModal] = useState(false);
  const [copyFromDocType, setCopyFromDocType] = useState('salesOrder');
  const [addressForm, setAddressForm] = useState({
    shipToCode: '', shipToAddress: '', billToCode: '', billToAddress: '',
    streetPoBox: '', streetNo: '', buildingFloorRoom: '', block: '', city: '', zipCode: '', county: '',
    state: '', countryRegion: '', addressName2: '', addressName3: '', gln: '', gstin: ''
  });
  const [taxInfoForm, setTaxInfoForm] = useState({
    panNo: '', panCircleNo: '', panWardNo: '', panAssessingOfficer: '', deducteeRefNo: '',
    lstVatNo: '', cstNo: '', tanNo: '', serviceTaxNo: '', companyType: '', natureOfBusiness: '',
    assesseeType: '', tinNo: '', itrFiling: '', gstType: '', gstin: ''
  });

  useEffect(() => {
    if (!refData.states?.length || !header.placeOfSupply) return;
    const normalizedPlaceOfSupply = getStateCodeValue(header.placeOfSupply, refData.states);
    if (normalizedPlaceOfSupply && normalizedPlaceOfSupply !== header.placeOfSupply) {
      setHeader(prev => (
        prev.placeOfSupply === header.placeOfSupply
          ? { ...prev, placeOfSupply: normalizedPlaceOfSupply }
          : prev
      ));
    }
  }, [header.placeOfSupply, refData.states]);

  // Close Copy From dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.del-dropdown')) {
        document.querySelectorAll('.del-dropdown').forEach(d => d.classList.remove('active'));
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // decimal config
  const dec = { ...DEC, ...(refData.decimal_settings || {}) };
  const numDec = {
    quantity: Number(dec.QtyDec), unitPrice: Number(dec.PriceDec),
    stdDiscount: Number(dec.PercentDec), total: Number(dec.SumDec),
    discount: Number(dec.PercentDec), freight: Number(dec.SumDec),
    tax: Number(dec.SumDec), totalPaymentDue: Number(dec.SumDec),
  };
  const {
    effectiveSalesEmployees,
    salesEmployeeSetup,
    openSalesEmployeeSetup,
    closeSalesEmployeeSetup,
    updateSalesEmployeeSetupRow,
    saveSalesEmployeeSetup,
    resolveSalesEmployeeByName,
  } = useSalesEmployeeSetup({
    employees: refData.sales_employees || [],
    onEmployeesChange: (sales_employees) => setRefData((prev) => ({ ...prev, sales_employees })),
    onError: (message) => setPageState((prev) => ({ ...prev, error: message || '' })),
    onSuccess: (message) => setPageState((prev) => ({ ...prev, error: '', success: message || '' })),
    discountDecimals: numDec.discount,
    getErrMsg,
  });
  const isDocumentEditable = !currentDocEntry || String(header.status || '').toLowerCase() === 'open';
  const hasBuyerCode = Boolean(String(header.vendor || '').trim());
  const hasUnsavedChanges = Boolean(currentDocEntry && isDirty);
  const updateActionLabel = hasUnsavedChanges ? 'Update' : 'OK';
  const resolvePreferredSeries = (seriesList, postingDateValue, selectedSeries = '') => {
    if (!Array.isArray(seriesList) || !seriesList.length) return null;

    const normalizedSeries = String(selectedSeries || '').trim();
    const matchedSeries = normalizedSeries
      ? seriesList.find((series) => String(series.Series) === normalizedSeries)
      : null;

    if (matchedSeries) return matchedSeries;

    const normalizedTransactionType = normalizeFieldIdentity(header.transactionType);
    if (normalizedTransactionType) {
      const transactionTokens = normalizedTransactionType.includes('gsttaxinvoice')
        ? ['gsttaxinvoice', 'gst', 'taxinvoice', 'retail', 'ret']
        : normalizedTransactionType.includes('billofsupply')
          ? ['billofsupply', 'bos', 'supply']
          : normalizedTransactionType.includes('debit')
            ? ['debitmemo', 'debit', 'dbn']
            : [normalizedTransactionType];

      const scoredSeries = seriesList
        .map((series, index) => {
          const identity = normalizeFieldIdentity(`${series.SeriesName || ''} ${series.Indicator || ''}`);
          const score = transactionTokens.reduce((total, token) => (
            total + (identity.includes(token) ? token.length : 0)
          ), 0);
          const genericFyOnly = /^[0-9\s/-]+$/.test(String(series.SeriesName || '').trim());
          return { series, index, score: score - (genericFyOnly ? 1 : 0) };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index);

      if (scoredSeries[0]?.series) return scoredSeries[0].series;
    }

    const seriesDate = postingDateValue ? new Date(`${postingDateValue}T00:00:00`) : new Date();
    return getDefaultSeriesForCurrentYear(seriesList, seriesDate) || seriesList[0];
  };
  const primaryActionLabel = pageState.posting
    ? 'Saving…'
    : currentDocEntry
      ? updateActionLabel
      : 'Add';
  const secondaryActionLabel = pageState.posting
    ? 'Saving…'
    : currentDocEntry
      ? updateActionLabel
      : 'Add & New';

  useEffect(() => {
    if (!snapshotPending || !currentDocEntry || pageState.loading || pageState.vendorLoading) return;
    setSnapshotPending(false);
  }, [snapshotPending, currentDocEntry, pageState.loading, pageState.vendorLoading, header, lines, headerUdfs]);

  const markDirty = useCallback((event) => {
    if (event?.target?.closest?.('[data-document-dirty-ignore="true"]')) return;
    if (currentDocEntry) setIsDirty(true);
  }, [currentDocEntry]);

  // Continue in next part...

  // ── load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const refDataRes = await fetchARInvoiceReferenceData(AR_INVOICE_COMPANY_ID);
        
        if (!ignore) {
          const vendorRows = refDataRes.data.vendors || refDataRes.data.customers || [];
          const nextHeaderUdfs = refDataRes.data.udf_metadata?.header || [];
          const nextRowUdfs = refDataRes.data.udf_metadata?.rows || [];
          const nextMatrixColumns = refDataRes.data.line_field_metadata?.matrix_columns?.length
            ? refDataRes.data.line_field_metadata.matrix_columns
            : (refDataRes.data.matrix_columns || []);
          const hasSapMatrixPreferences =
            Number(refDataRes.data.line_field_metadata?.sap_form?.preferenceRows || 0) > 0;
          const liveDefaultBranch = String(refDataRes.data.default_branch || '').trim();
          const liveDefaultWarehouse = String(refDataRes.data.default_warehouse || '').trim();
          const nextDefaults = readSavedFormSettings(nextHeaderUdfs, nextRowUdfs, nextMatrixColumns, formSettingsStorageKey);
          setHeaderUdfDefinitions(nextHeaderUdfs);
          setRowUdfDefinitions(nextRowUdfs);
          setMatrixColumnDefinitions(nextMatrixColumns);
          setHeaderUdfs((prev) => normalizeUdfState(nextHeaderUdfs, prev));
          setLines((prev) => prev.map((line) => ({
            ...line,
            udf: normalizeUdfState(nextRowUdfs, line.udf || {}),
          })));
          setFormSettings((prev) => ({
            ...nextDefaults,
            ...prev,
            headerUdfs: {
              ...nextDefaults.headerUdfs,
              ...(prev.headerUdfs || {}),
            },
            rowUdfs: nextRowUdfs.reduce((settings, field) => ({
              ...settings,
              [field.key]: hasSapMatrixPreferences && field.sapColumnId
                ? nextDefaults.rowUdfs[field.key]
                : {
                    ...(nextDefaults.rowUdfs[field.key] || {}),
                    ...((prev.rowUdfs || {})[field.key] || {}),
                  },
            }), nextDefaults.rowUdfs),
            matrixColumns: hasSapMatrixPreferences
              ? nextDefaults.matrixColumns
              : {
                  ...nextDefaults.matrixColumns,
                  ...(prev.matrixColumns || {}),
                },
          }));
          setRefData(prev => ({
            ...prev,
            company: refDataRes.data.company || '',
            vendors: vendorRows,
            contacts: refDataRes.data.contacts || [],
            pay_to_addresses: refDataRes.data.pay_to_addresses || [],
            items: refDataRes.data.items || [],
            warehouses: refDataRes.data.warehouses || [],
            warehouse_addresses: refDataRes.data.warehouse_addresses || [],
            company_address: refDataRes.data.company_address || {},
            tax_codes: refDataRes.data.tax_codes || [],
            withholding_tax_codes: refDataRes.data.withholding_tax_codes || [],
            gl_accounts: refDataRes.data.gl_accounts || [],
            distribution_rules: refDataRes.data.distribution_rules || [],
            payment_terms: refDataRes.data.payment_terms || [],
            shipping_types: refDataRes.data.shipping_types || [],
            transaction_types: refDataRes.data.transaction_types || [],
            sales_employees: refDataRes.data.sales_employees || [],
            branches: refDataRes.data.branches || [],
            states: refDataRes.data.states || [],
            uom_groups: refDataRes.data.uom_groups || [],
            decimal_settings: { ...DEC, ...(refDataRes.data.decimal_settings || {}) },
            matrix_columns: nextMatrixColumns,
            line_field_metadata: refDataRes.data.line_field_metadata || { matrix_columns: nextMatrixColumns, sap_form: {} },
            udf_metadata: refDataRes.data.udf_metadata || { header: [], rows: [] },
            warnings: refDataRes.data.warnings || [],
            series: Array.isArray(prev.series) ? prev.series : [],
            default_branch: liveDefaultBranch,
            default_warehouse: liveDefaultWarehouse,
          }));
          if (!currentDocEntry && !requestedEditDocEntry && (liveDefaultBranch || liveDefaultWarehouse)) {
            setHeader(prev => ({
              ...prev,
              branch: prev.branch || liveDefaultBranch,
              warehouse: prev.warehouse || liveDefaultWarehouse,
            }));
            setLines(prev => prev.map((line) => ({
              ...line,
              branch: line.branch || liveDefaultBranch,
              loc: line.loc || liveDefaultBranch,
              whse: line.whse || liveDefaultWarehouse,
            })));
          }
        }
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load reference data.') }));
      } finally {
        if (!ignore) setPageState(p => ({ ...p, loading: false }));
      }
    };
    load();
    return () => { ignore = true; };
  }, [formSettingsStorageKey]);

  // ── load existing order ───────────────────────────────────────────────────
  useEffect(() => {
    if (currentDocEntry || requestedEditDocEntry) return;

    const seriesDate = String(header.postingDate || '').trim();
    if (!seriesDate) {
      setRefData(prev => ({ ...prev, series: [] }));
      setHeader(prev => ({ ...prev, series: '', nextNumber: '' }));
      return;
    }

    let ignore = false;

    const loadSeriesForPostingDate = async () => {
      try {
        const seriesResponse = await fetchDocumentSeries(seriesDate, header.transactionType, header.branch);
        const availableSeries = seriesResponse.data?.series || [];

        if (ignore || requestedEditDocEntry) return;

        setRefData(prev => ({ ...prev, series: availableSeries }));

        if (!availableSeries.length) {
          setHeader(prev => ({ ...prev, series: '', nextNumber: '' }));
          return;
        }

        const currentSeries = String(header.series || '');
        const defaultSeries = resolvePreferredSeries(availableSeries, seriesDate, currentSeries);

        if (!defaultSeries?.Series) return;

        if (String(defaultSeries.Series) !== currentSeries || !String(header.nextNumber || '').trim()) {
          handleSeriesChange(defaultSeries.Series);
        }
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load document series.') }));
      }
    };

    loadSeriesForPostingDate();
    return () => { ignore = true; };
  }, [currentDocEntry, requestedEditDocEntry, header.postingDate, header.transactionType, header.branch]);

  useEffect(() => {
    const docEntry = requestedEditDocEntry;
    if (!docEntry) return;
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const r = await fetchARInvoiceByDocEntry(docEntry);
        const so = r.data.ar_invoice;
        let editSeries = [];
        try {
          const seriesDate = so?.header?.postingDate || so?.header?.documentDate || '';
          const seriesResponse = await fetchDocumentSeries(seriesDate, so?.header?.transactionType || '', so?.header?.branch || '');
          editSeries = seriesResponse.data?.series || [];
        } catch (_seriesError) {
          editSeries = [];
        }
        if (ignore || !so) return;
        setCurrentDocEntry(so.doc_entry || Number(docEntry));
        const savedSeriesValue = String(so.header?.series || '');
        const savedSeriesOption = savedSeriesValue
          ? {
              Series: savedSeriesValue,
              SeriesName: so.header?.seriesName || savedSeriesValue,
              Indicator: so.header?.seriesIndicator || '',
            }
          : null;
        const mergedEditSeries = savedSeriesOption
          ? [
              savedSeriesOption,
              ...editSeries.filter((series) => String(series.Series) !== savedSeriesValue),
            ]
          : editSeries;
        if (mergedEditSeries.length) {
          setRefData(prev => ({
            ...prev,
            series: mergedEditSeries,
          }));
        }
        setHeader(prev => ({
          ...prev,
          ...INIT_HEADER,
          ...(so.header || {}),
          vendor: so.header?.customerCode || so.header?.customer || '',
          contactPerson: so.header?.contactPerson || '',
          name: so.header?.customerName || so.header?.name || '',
          paymentTerms: so.header?.paymentTermsCode || so.header?.paymentTerms || '',
          transactionType: so.header?.transactionType || getTransactionTypeFromUdfs(headerUdfDefinitions, so.header_udfs || '') || '',
          indicator: so.header?.indicator || so.header?.seriesIndicator || '',
          placeOfSupply: so.header?.placeOfSupply || '',
          branch: so.header?.branch || '',
          docNo: so.header?.docNo || so.header?.docNum || '',
          series: so.header?.series || '',
          nextNumber: so.header?.docNo || so.header?.docNum || '',
        }));
        
        setLines(
          Array.isArray(so.lines) && so.lines.length
            ? so.lines.map(l => ({ ...createLine(rowUdfDefinitions), ...l, udf: normalizeUdfState(rowUdfDefinitions, l.udf || {}) }))
            : [createLine(rowUdfDefinitions)]
        );
        setHeaderUdfs(normalizeUdfState(headerUdfDefinitions, so.header_udfs || {}));
        setSnapshotPending(true);
        setIsDirty(false);
        if (so.header?.customerCode || so.header?.customer) {
          loadVendorDetails(so.header?.customerCode || so.header?.customer);
        }
        setPageState(p => ({ ...p, success: so.doc_num ? `AR Invoice ${so.doc_num} loaded.` : 'AR Invoice loaded.' }));
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load AR Invoice.') }));
      } finally {
        if (!ignore) {
          setPageState(p => ({ ...p, loading: false }));
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };
    load();
    return () => { ignore = true; };
  }, [location.pathname, requestedEditDocEntry, navigate]);

  useEffect(() => {
    if (!currentDocEntry) {
      setFreightModal(prev => (
        prev.freightCharges.length || prev.loading
          ? { ...prev, freightCharges: [], loading: false }
          : prev
      ));
      return;
    }

    let ignore = false;
    const loadSavedFreightCharges = async () => {
      try {
        const response = await fetchFreightCharges(currentDocEntry);
        const savedFreightCharges = response.data.freightCharges || [];
        const savedFreightTotal = savedFreightCharges.reduce((sum, charge) => (
          sum + parseNum(charge.netAmount ?? charge.LineTotal ?? charge.NetAmount ?? charge.DefaultAmount)
        ), 0);
        if (!ignore) {
          setFreightModal(prev => ({
            ...prev,
            freightCharges: savedFreightCharges,
            loading: false,
          }));
          setHeader(prev => ({ ...prev, freight: fmtDec(savedFreightTotal, numDec.freight) }));
        }
      } catch (_error) {
        if (!ignore) {
          setFreightModal(prev => ({ ...prev, freightCharges: [], loading: false }));
        }
      }
    };

    loadSavedFreightCharges();
    return () => { ignore = true; };
  }, [currentDocEntry]);

  // ── Copy To: populate form from Sales Order / Delivery ────────────────────
  useEffect(() => {
    const routedCopyFrom = location.state?.copyFrom;
    const persistedCopyState = routedCopyFrom ? null : consumeCopyToState(location.pathname, ['/ar-invoice']);
    const copyFrom = routedCopyFrom || persistedCopyState?.copyFrom;
    if (!copyFrom) return;

    const copyFromKey = JSON.stringify({
      path: location.pathname,
      type: copyFrom.type,
      docEntry: copyFrom.docEntry,
      lineCount: Array.isArray(copyFrom.lines) ? copyFrom.lines.length : 0,
    });

    if (handledCopyFromRef.current === copyFromKey) {
      return;
    }

    handledCopyFromRef.current = copyFromKey;

    const { header: srcHeader = {}, lines: srcLines = [], baseDocument } = copyFrom;
    const normalizedHeader = normaliseDocumentHeader(srcHeader || {});
    const firstSourceLine = Array.isArray(srcLines) && srcLines.length ? srcLines[0] : {};
    const copiedWarehouse = normalizeWarehouse(firstSourceLine, srcHeader) || '';
    const copiedBranch = srcHeader.branch || srcHeader.BPL_IDAssignedToInvoice || srcHeader.BPLId || firstSourceLine.branch || '';
    const copiedBaseType = baseDocument?.baseType || BASE_TYPE[copyFrom.type] || firstSourceLine.baseType || 15;
    const copiedBaseEntry = baseDocument?.baseEntry || copyFrom.docEntry;

    setHeader(prev => ({
      ...prev,
      vendor:           srcHeader.vendor        || srcHeader.CardCode  || '',
      name:             srcHeader.name          || srcHeader.CardName  || '',
      contactPerson:    srcHeader.contactPerson || srcHeader.CntctCode || '',
      salesContractNo:  normalizedHeader.salesContractNo || normalizedHeader.customerRefNo || srcHeader.salesContractNo || srcHeader.customerRefNo || srcHeader.CustomerRefNo || srcHeader.NumAtCard || '',
      branch:           copiedBranch,
      warehouse:        copiedWarehouse,
      paymentTerms:     srcHeader.paymentTerms  || srcHeader.GroupNum  || '',
      placeOfSupply:    srcHeader.placeOfSupply || '',
      otherInstruction: srcHeader.otherInstruction || srcHeader.Comments || '',
    }));
    const copiedHeaderUdfs = mergeUdfValues(copyFrom.headerUdfs, copyFrom.header_udfs, srcHeader.header_udfs, srcHeader.headerUdfs);
    setHeaderUdfs({
      ...copiedHeaderUdfs,
      ...normalizeUdfState(headerUdfDefinitions, copiedHeaderUdfs),
    });

    if (Array.isArray(srcLines) && srcLines.length > 0) {
      setLines(srcLines.map((l, idx) => {
        const normalizedLine = normaliseDocumentLine(l, idx, copiedBaseEntry, copiedBaseType, copiedBranch);
        const copiedLineUdfs = mergeUdfValues(l.line_udfs, l.lineUdfs, l.udf, normalizedLine.udf);
        return {
          ...createLine(rowUdfDefinitions),
          ...normalizedLine,
          whse: normalizeWarehouse(normalizedLine, srcHeader) || normalizeWarehouse(l, srcHeader) || copiedWarehouse || '',
          baseEntry: l.baseEntry ?? l.BaseEntry ?? copiedBaseEntry,
          baseType: l.baseType ?? l.BaseType ?? copiedBaseType,
          baseLine: normalizeBaseLine(l, idx),
          branch: normalizedLine.branch || l.branch || copiedBranch,
          udf: {
            ...copiedLineUdfs,
            ...normalizeUdfState(rowUdfDefinitions, copiedLineUdfs),
          },
        };
      }));
    }

    const cardCode = srcHeader.vendor || srcHeader.CardCode;
    if (cardCode) loadVendorDetails(cardCode);

    const sourceLabel = copyFrom.sourceLabel || copyFrom.type || 'source document';
    setPageState(p => ({ ...p, success: `Copied from ${sourceLabel}. Please review and save.` }));
    replaceRouteStatePreservingWindow(navigate, location.pathname, location.state || persistedCopyState);
  }, [location.pathname, location.state?.copyFrom, navigate, headerUdfDefinitions, rowUdfDefinitions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── derived / computed ────────────────────────────────────────────────────
  const belongsToCurrentVendor = (row) => {
    const rowCardCode = String(row?.CardCode || '').trim();
    return !rowCardCode || rowCardCode === String(header.vendor || '').trim();
  };
  const vendorContacts = refData.contacts.filter(belongsToCurrentVendor);
  const contactOptions = header.contactPerson && !vendorContacts.some(c => String(c.CntctCode || '') === String(header.contactPerson || ''))
    ? [{ CardCode: header.vendor, CntctCode: header.contactPerson, Name: header.contactPerson }, ...vendorContacts]
    : vendorContacts;
  const vendorPayToAddresses = refData.pay_to_addresses.filter(belongsToCurrentVendor);
  const vendorShipToAddresses = refData.ship_to_addresses.filter(belongsToCurrentVendor);
  const vendorBillToAddresses = refData.bill_to_addresses.filter(belongsToCurrentVendor);
  const vendorEffectiveShipToAddresses = vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses;
  const vendorEffectiveBillToAddresses = vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses;
  const selectedBranch = refData.branches.find(b => String(b.BPLId || '') === String(header.branch || ''));
  const firstLineWhse = String(lines[0]?.whse || '').trim();
  const selectedWhseAddr = refData.warehouse_addresses.find(w => String(w.WhsCode || '') === firstLineWhse);
  const defaultShipTo = fmtAddr(refData.company_address);
  const uomGroupMap = (refData.uom_groups || []).reduce((acc, g) => { acc[g.AbsEntry] = g.uomCodes || []; return acc; }, {});

  const effectiveTaxCodes = refData.tax_codes || [];
  const effectiveWarehouses = refData.warehouses.length ? refData.warehouses : FALLBACK_WAREHOUSES;
  const branchFilteredWarehouses = filterWarehousesByBranch(effectiveWarehouses, header.branch);
  const freightTotals = summarizeFreightRows(freightModal.freightCharges, effectiveTaxCodes);
  const effectiveWhseAddrs = refData.warehouse_addresses.length ? refData.warehouse_addresses : FALLBACK_WAREHOUSES;
  const payTermOpts = refData.payment_terms.length
    ? refData.payment_terms.map(t => ({ value: String(t.GroupNum), label: t.PymntGroup }))
    : FALLBACK_PAYMENT_TERMS;
  const shipTypeOpts = refData.shipping_types.length
    ? refData.shipping_types.map(s => ({ value: String(s.TrnspCode), label: s.TrnspName }))
    : FALLBACK_SHIPPING;
  const transactionTypeOptions = useMemo(() => {
    return DEFAULT_TRANSACTION_TYPES;
  }, []);
  useEffect(() => {
    if (currentDocEntry || requestedEditDocEntry || header.transactionType || !transactionTypeOptions.length) return;
    const firstOption = transactionTypeOptions[0];
    setHeader((prev) => ({
      ...prev,
      transactionType: firstOption.value,
      indicator: firstOption.indicator || prev.indicator,
    }));
  }, [currentDocEntry, requestedEditDocEntry, header.transactionType, transactionTypeOptions]);
  const resolveARInvoiceAddress = useCallback((code, addresses = [], fallbackText = '') => {
    const normalizedCode = String(code || '').trim();
    if (normalizedCode) {
      const exactMatch = addresses.find((address) => String(address?.Address || '').trim() === normalizedCode);
      if (exactMatch) return exactMatch;
    }

    const normalizedFallbackText = normalizeAddressText(fallbackText);
    if (normalizedFallbackText) {
      return addresses.find((address) => normalizeAddressText(fmtAddr(address)) === normalizedFallbackText) || null;
    }

    return null;
  }, []);

  const getUomOptions = useCallback((line) => {
    const item = refData.items.find(i => String(i.ItemCode || '') === String(line.itemNo || ''));
    if (item) {
      const codes = uomGroupMap[item.UoMGroupEntry];
      if (codes && codes.length) return codes;
      const fb = String(item.SalesUnit || item.InventoryUOM || '').trim();
      if (fb) return [fb];
    }
    return FALLBACK_UOM;
  }, [refData.items, uomGroupMap]);

  const getUomGroupName = useCallback((item = {}) => {
    if (!item?.UoMGroupEntry && item?.UoMGroupEntry !== 0) return '';
    const group = (refData.uom_groups || []).find(g => String(g.AbsEntry) === String(item.UoMGroupEntry));
    return group?.Name || String(item.UoMGroupEntry || '');
  }, [refData.uom_groups]);

  const lineItemOptions = lines.reduce((acc, line, i) => {
    const code = String(line.itemNo || '').trim();
    const exists = refData.items.some(it => String(it.ItemCode || '') === code);
    acc[i] = code && !exists ? [{ ItemCode: code, ItemName: line.itemDescription || code }, ...refData.items] : refData.items;
    return acc;
  }, {});

  const accountLookupOptions = useMemo(() => (refData.gl_accounts || []).map((account) => ({
    value: account.code || '',
    description: account.name || '',
    label: account.name ? `${account.code} - ${account.name}` : account.code,
    accountNumber: account.code || '',
    accountName: account.name || '',
    accountBalance: Number(account.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    inactive: account.inactive || 'No',
  })).filter((option) => option.value), [refData.gl_accounts]);

  const distributionRuleLookupOptions = useMemo(() => (refData.distribution_rules || []).map((rule) => {
    const value = rule.FactorCode || rule.OcrCode || rule.code || '';
    const description = rule.FactorDescription || rule.OcrName || rule.name || '';
    return {
      value,
      description,
      label: description ? `${value} - ${description}` : value,
      factorCode: value,
      factorDescription: description,
    };
  }).filter((option) => option.value), [refData.distribution_rules]);

  const itemLookupOptions = useMemo(() => (refData.items || []).map((item) => ({
    value: item.ItemCode || '',
    description: item.ItemName || '',
    label: item.ItemName ? `${item.ItemCode} - ${item.ItemName}` : item.ItemCode,
    itemCode: item.ItemCode || '',
    itemName: item.ItemName || '',
    salesUnit: item.SalesUnit || item.InventoryUOM || '',
  })).filter((option) => option.value), [refData.items]);

  const rowUdfByAlias = useMemo(() => new Map((rowUdfDefinitions || []).map((field) => [
    normalizeFieldIdentity(field.aliasId || field.key || field.label),
    field,
  ])), [rowUdfDefinitions]);

  const itemNameRowUdfKey = useMemo(() => {
    const candidates = ['itemname', 'itemdescription', 'sitemname', 'selleritemname'];
    return candidates.map((candidate) => rowUdfByAlias.get(candidate)?.key).find(Boolean) || '';
  }, [rowUdfByAlias]);

  const fmtTaxLabel = (t) => {
    const code = String(t?.Code || '').trim();
    const name = String(t?.Name || '').trim();
    const up = `${code} ${name}`.toUpperCase();
    let type = '';
    if (up.includes('IGST')) type = 'IGST';
    else if (up.includes('CGST') && up.includes('SGST')) type = 'CGST+SGST';
    else if (up.includes('CGST')) type = 'CGST';
    else if (up.includes('SGST')) type = 'SGST';
    else if (up.includes('GST')) type = 'GST';
    const rate = t?.Rate != null ? `${Number(t.Rate)}%` : '';
    if (type && rate) return `${code} - ${type} ${rate}`;
    if (type) return `${code} - ${type}`;
    return name ? `${code} - ${name}` : code;
  };

  const getBranchName = (branchId) => {
    if (!branchId) return '';
    const branch = refData.branches.find(b => String(b.BPLId) === String(branchId));
    return branch ? branch.BPLName : branchId;
  };

  // ── calculations ──────────────────────────────────────────────────────────
  const calcLineTotalFromFields = (line) => {
    const qty = parseNum(line.quantity), price = parseNum(line.unitPrice), disc = parseNum(line.stdDiscount);
    return roundTo(qty * price * (1 - disc / 100), numDec.total);
  };
  const calcLineTotal = (line) => {
    const enteredTotal = String(line.total ?? '').trim();
    return enteredTotal ? roundTo(parseNum(enteredTotal), numDec.total) : calcLineTotalFromFields(line);
  };
  const calcUnitPriceFromTotal = (line) => {
    const qty = parseNum(line.quantity);
    const total = parseNum(line.total);
    const discountFactor = 1 - parseNum(line.stdDiscount) / 100;
    if (qty <= 0 || total <= 0 || discountFactor <= 0) return '';
    return fmtDec(total / qty / discountFactor, numDec.unitPrice);
  };

  const calcTotals = () => {
    const taxRateMap = new Map(effectiveTaxCodes.map(t => [String(t.Code || ''), parseNum(t.Rate)]));
    const subtotal = lines.reduce((s, l) => s + calcLineTotal(l), 0);
    const discPct = parseNum(header.discount);
    const discAmt = roundTo(subtotal * discPct / 100, numDec.total);
    const discSub = Math.max(0, subtotal - discAmt);
    const freight = roundTo(parseNum(header.freight), numDec.total);
    const freightTaxAmt = roundTo(parseNum(freightTotals.totalTax), numDec.tax);
    let taxAmt = 0;
    const taxMap = new Map();
    if (subtotal > 0) {
      lines.forEach(l => {
        const net = calcLineTotal(l);
        if (net <= 0 || !l.taxCode) return;
        const rate = taxRateMap.get(String(l.taxCode || '')) || 0;
        const base = discSub * (net / subtotal);
        const lineTax = roundTo(base * rate / 100, numDec.tax);
        taxAmt += lineTax;
        const ex = taxMap.get(l.taxCode) || { taxCode: l.taxCode, taxRate: rate, taxableAmount: 0, taxAmount: 0 };
        ex.taxableAmount = roundTo(ex.taxableAmount + base, numDec.total);
        ex.taxAmount = roundTo(ex.taxAmount + lineTax, numDec.tax);
        taxMap.set(l.taxCode, ex);
      });
    }
    taxAmt = roundTo(taxAmt, numDec.tax);
    if (taxAmt === 0) { const lt = roundTo(parseNum(header.tax), numDec.tax); if (lt > 0) taxAmt = lt; }
    taxAmt = roundTo(taxAmt + freightTaxAmt, numDec.tax);
    return { subtotal, discAmt, discSub, freight, freightTaxAmt, taxAmt, total: roundTo(discSub + freight + taxAmt, numDec.totalPaymentDue), taxBreakdown: Array.from(taxMap.values()) };
  };

  const totals = calcTotals();
  const hasWTaxLiableLines = lines.some((line) => isYesValue(line.wTaxLiable || line.wtaxLiable));
  const wtaxBaseAmount = totals.total;
  const recalcWithholdingRows = useCallback((rows = withholdingTax.rows, baseAmount = wtaxBaseAmount) => (
    (rows || []).map((row) => {
      const rate = parseNum(row.rate);
      return {
        ...row,
        baseAmount: roundTo(baseAmount, numDec.total),
        taxableAmount: roundTo(baseAmount, numDec.total),
        wtaxAmount: roundTo(baseAmount * rate / 100, numDec.tax),
        category: row.category || 'Invoice',
        baseType: row.baseType || 'Net',
        criteria: row.criteria || 'Cash',
        tdsType: row.tdsType || 'eTDS',
      };
    })
  ), [numDec.tax, numDec.total, withholdingTax.rows, wtaxBaseAmount]);
  const createDefaultWithholdingRows = useCallback((baseAmount = wtaxBaseAmount) => {
    const allowedCodes = withholdingTax.allowedCodes || [];
    const defaultCode = withholdingTax.defaultCode || allowedCodes[0]?.code || '';
    const codeRow = allowedCodes.find((row) => String(row.code || '') === String(defaultCode || '')) || allowedCodes[0];
    if (!codeRow) return [];

    const rate = parseNum(codeRow.rate);
    return [{
      code: codeRow.code || '',
      name: codeRow.name || '',
      rate,
      baseAmount: roundTo(baseAmount, numDec.total),
      taxableAmount: roundTo(baseAmount, numDec.total),
      wtaxAmount: roundTo(baseAmount * rate / 100, numDec.tax),
      category: codeRow.taxCategory || 'Invoice',
      baseType: 'Net',
      criteria: 'Cash',
      tdsType: 'eTDS',
      tdsAccount: '',
      surchargeAccount: '',
      cessAccount: '',
      hscAccount: '',
      igstAccount: '',
      cgstAccount: '',
      sgstAccount: '',
      utgstAccount: '',
    }];
  }, [numDec.tax, numDec.total, withholdingTax.allowedCodes, withholdingTax.defaultCode, wtaxBaseAmount]);
  const wtaxRowsForTotals = hasWTaxLiableLines
    ? recalcWithholdingRows(withholdingTax.rows.length ? withholdingTax.rows : createDefaultWithholdingRows())
    : [];
  const withholdingModalRows = withholdingTax.open
    ? recalcWithholdingRows(withholdingTax.rows.length ? withholdingTax.rows : createDefaultWithholdingRows())
    : wtaxRowsForTotals;
  const wtaxAmount = roundTo(wtaxRowsForTotals.reduce((sum, row) => sum + parseNum(row.wtaxAmount), 0), numDec.tax);
  const totalPaymentDueAfterWTax = roundTo(totals.total - wtaxAmount, numDec.totalPaymentDue);

  // Continue in next part...

  // ── address sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    setHeader(prev => {
      if (prev.shipToCode) return prev;
      const next = selectedWhseAddr ? fmtAddr(selectedWhseAddr) : defaultShipTo;
      if (!next || prev.shipTo === next) return prev;
      return { ...prev, shipToCode: selectedWhseAddr ? selectedWhseAddr.WhsCode : 'COMPANY', shipTo: next };
    });
  }, [selectedWhseAddr, defaultShipTo]);

  useEffect(() => {
    if (!header.vendor) return;
    setHeader(prev => {
      const existing = vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === String(prev.payToCode || prev.billToCode || ''));
      if (existing) return prev;
      const def = vendorEffectiveBillToAddresses[0];
      if (!def) return prev;
      const fmt = fmtAddr(def);
      if (prev.payToCode === def.Address && prev.payTo === fmt) return prev;
      return {
        ...prev,
        payToCode: def.Address || '',
        payTo: fmt,
        billToCode: prev.billToCode || def.Address || '',
        billToAddress: prev.billToAddress || fmt,
      };
    });
  }, [header.vendor, vendorEffectiveBillToAddresses]);

  // ── vendor details ────────────────────────────────────────────────────────
  const loadVendorDetails = async (code) => {
    if (!code) {
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
      setWithholdingTax({ open: false, customerSubject: false, defaultCode: '', allowedCodes: [], rows: [] });
      setHeader(prev => ({ 
        ...prev, 
        placeOfSupply: '',
        shipToCode: '',
        shipToAddress: '',
        billToCode: '',
        billToAddress: ''
      }));
      return;
    }

    setPageState(p => ({ ...p, vendorLoading: true }));

    try {
      const r = await fetchARInvoiceCustomerDetails(code);
      const contacts = r.data.contacts || [];
      const payToAddresses = r.data.pay_to_addresses || [];
      const shipToAddresses = r.data.ship_to_addresses || [];
      const customerWithholdingTax = r.data.withholding_tax || {};
      
      setRefData(p => ({
        ...p,
        contacts: contacts,
        pay_to_addresses: payToAddresses,
        ship_to_addresses: shipToAddresses,
        bill_to_addresses: payToAddresses
      }));
      setWithholdingTax({
        open: false,
        customerSubject: Boolean(customerWithholdingTax.subject),
        defaultCode: customerWithholdingTax.defaultCode || '',
        allowedCodes: customerWithholdingTax.allowedCodes || [],
        rows: [],
      });

      if (contacts.length > 0) {
        setHeader(prev => ({
          ...prev,
          contactPerson: prev.contactPerson || String(contacts[0].CntctCode || '')
        }));
      }

      const defaultShipTo = shipToAddresses[0] || payToAddresses[0] || null;
      const defaultBillTo = payToAddresses[0] || shipToAddresses[0] || null;
      if (defaultShipTo || defaultBillTo) {
        const formattedShipTo = defaultShipTo ? fmtAddr(defaultShipTo) : '';
        const formattedBillTo = defaultBillTo ? fmtAddr(defaultBillTo) : formattedShipTo;
        setHeader(prev => ({
          ...prev,
          placeOfSupply: prev.placeOfSupply || defaultShipTo?.State || defaultBillTo?.State || '',
          shipToCode: prev.shipToCode || defaultShipTo?.Address || '',
          shipToAddress: prev.shipToAddress || prev.shipTo || formattedShipTo,
          shipTo: prev.shipTo || prev.shipToAddress || formattedShipTo,
          billToCode: prev.billToCode || prev.payToCode || defaultBillTo?.Address || '',
          billToAddress: prev.billToAddress || prev.payTo || formattedBillTo,
          payToCode: prev.payToCode || prev.billToCode || defaultBillTo?.Address || '',
          payTo: prev.payTo || prev.billToAddress || formattedBillTo
        }));
      }

      // Auto-populate addresses from customer's default address
      if (false && payToAddresses.length > 0) {
        const defaultAddress = payToAddresses[0];
        const formattedAddress = fmtAddr(defaultAddress);
        
        console.log('🌍 Auto-setting addresses from customer:', {
          state: defaultAddress.State,
          addressCode: defaultAddress.Address,
          formattedAddress
        });
        
        setHeader(prev => ({
          ...prev,
          placeOfSupply: defaultAddress.State || prev.placeOfSupply,
          // Set Ship To
          shipToCode: defaultAddress.Address || '',
          shipToAddress: formattedAddress,
          // Set Bill To (same as Ship To by default)
          billToCode: defaultAddress.Address || '',
          billToAddress: formattedAddress
        }));
      }

    } catch (err) {
      console.error('Error loading customer details:', err);
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
      setWithholdingTax({ open: false, customerSubject: false, defaultCode: '', allowedCodes: [], rows: [] });
    } finally {
      setPageState(p => ({ ...p, vendorLoading: false }));
    }
  };

  const syncVendor = (code, hdr) => {
    const m = refData.vendors.find(v => String(v.CardCode || '') === String(code || ''));
    if (!m) return { nextHeader: hdr };
    return {
      nextHeader: { ...hdr, name: m.CardName || hdr.name, paymentTerms: m.PayTermsGrpCode != null ? String(m.PayTermsGrpCode) : hdr.paymentTerms, contactPerson: '' },
    };
  };

  // ── handlers ──────────────────────────────────────────────────────────────
  const openLineLookup = (field, lineIndex, udfField = null) => {
    if (!isDocumentEditable) return;
    const isAccount = field === 'glAccount';
    const isSellerItem = field === 'sItem';
    setLineLookupModal({
      open: true,
      lineIndex,
      field,
      udfKey: udfField?.key || '',
      title: isAccount ? 'List of G/L Accounts' : isSellerItem ? 'List of Items' : 'List of Distribution Rules',
      options: isAccount ? accountLookupOptions : isSellerItem ? itemLookupOptions : distributionRuleLookupOptions,
      searchPlaceholder: isAccount ? 'Search G/L accounts' : isSellerItem ? 'Search items' : 'Search distribution rules',
      emptyMessage: isAccount ? 'No G/L accounts found' : isSellerItem ? 'No items found' : 'No distribution rules found',
      columns: isAccount
        ? [
            { key: 'accountNumber', label: 'Account Number', width: 150, primary: true },
            { key: 'accountName', label: 'Account Name' },
            { key: 'accountBalance', label: 'Account Balance', width: 130, align: 'right' },
            { key: 'inactive', label: 'Inactive', width: 90 },
          ]
        : isSellerItem
          ? [
              { key: 'itemCode', label: 'Item No.', width: 150, primary: true },
              { key: 'itemName', label: 'Item Description' },
              { key: 'salesUnit', label: 'UoM', width: 100 },
            ]
        : [
            { key: 'factorCode', label: 'Distr. Rule', width: 140, primary: true },
            { key: 'factorDescription', label: 'Description' },
          ],
    });
  };

  const closeLineLookup = () => {
    setLineLookupModal((prev) => ({ ...prev, open: false, lineIndex: -1, field: '', udfKey: '' }));
  };

  const handleLineLookupSelect = (option) => {
    if (lineLookupModal.lineIndex < 0 || !lineLookupModal.field) return;
    const selectedValue = option?.value || '';
    setLines((prev) => prev.map((line, index) => {
      if (index !== lineLookupModal.lineIndex) return line;
      if (lineLookupModal.udfKey) {
        const nextUdf = {
          ...(line.udf || {}),
          [lineLookupModal.udfKey]: selectedValue,
        };
        if (lineLookupModal.field === 'sItem' && itemNameRowUdfKey) {
          nextUdf[itemNameRowUdfKey] = option?.itemName || option?.description || '';
        }
        return {
          ...line,
          sellerItem: lineLookupModal.field === 'sItem' ? selectedValue : line.sellerItem,
          udf: nextUdf,
        };
      }

      const next = { ...line, [lineLookupModal.field]: selectedValue };
      if (lineLookupModal.field === 'distRule' && (!line.cogsDistRule || line.cogsDistRule === line.distRule)) {
        next.cogsDistRule = selectedValue;
      }
      return next;
    }));
    markDirty();
    closeLineLookup();
  };

  const handleHeaderChange = (e) => {
    if (!isDocumentEditable) return;
    const { name, value, type, checked } = e.target;
    setValErrors(p => ({ ...p, header: { ...p.header, [name]: '' }, form: '' }));
    setPageState(p => ({ ...p, error: '', success: '' }));
    
    if (name === 'series') {
      handleSeriesChange(value);
      return;
    }

    if (name === 'transactionType') {
      const selectedOption = transactionTypeOptions.find((option) => String(option.value) === String(value));
      setHeader(p => ({
        ...p,
        transactionType: value,
        indicator: selectedOption?.indicator || p.indicator,
        series: '',
        nextNumber: '',
      }));
      return;
    }
    
    if (name === 'shipToCode') {
      handleShipToCodeChange(value);
      return;
    }
    
    if (name === 'billToCode') {
      handleBillToCodeChange(value);
      return;
    }

    if (name === 'branch') {
      const nextWarehouses = filterWarehousesByBranch(effectiveWarehouses, value);
      setHeader(prev => {
        const currentWarehouseAllowed = nextWarehouses.some((warehouse) => (
          String(warehouse.WhsCode || '') === String(prev.warehouse || '')
        ));
        return {
          ...prev,
          branch: value,
          warehouse: currentWarehouseAllowed ? prev.warehouse : (nextWarehouses[0]?.WhsCode || ''),
          series: '',
          nextNumber: '',
        };
      });
      return;
    }
    
    if (name === 'vendor') {
      setHeader(prev => {
        const prep = { ...prev, [name]: value };
        const { nextHeader } = syncVendor(value, prep);
        nextHeader.contactPerson = '';
        return nextHeader;
      });
      loadVendorDetails(value);
      return;
    }
    if (name === 'purchaser') {
      if (value === '__DEFINE_NEW__') {
        openSalesEmployeeSetup();
        return;
      }

      const selectedEmployee = resolveSalesEmployeeByName(value);
      setHeader((prev) => ({
        ...prev,
        purchaser: value,
        salesEmployee: selectedEmployee ? String(selectedEmployee.SlpCode) : '-1',
      }));
      return;
    }
    if (numDec[name] !== undefined && type !== 'checkbox') {
      setHeader(p => ({ ...p, [name]: sanitize(value, numDec[name]) }));
      return;
    }
    setHeader(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };
  
  const handleShipToCodeChange = (addressCode) => {
    if (!addressCode) {
      setHeader(p => ({ ...p, shipToCode: '', shipToAddress: '' }));
      return;
    }
    
    // Find the address from customer addresses
    const addr = vendorEffectiveShipToAddresses.find(a => String(a.Address) === String(addressCode))
      || vendorEffectiveBillToAddresses.find(a => String(a.Address) === String(addressCode));
    if (addr) {
      const formattedAddress = fmtAddr(addr);
      setHeader(p => ({ 
        ...p, 
        shipToCode: addressCode, 
        shipToAddress: formattedAddress,
        placeOfSupply: addr.State || p.placeOfSupply
      }));
    } else {
      setHeader(p => ({ ...p, shipToCode: addressCode }));
    }
  };
  
  const handleBillToCodeChange = (addressCode) => {
    if (!addressCode) {
      setHeader(p => ({ ...p, billToCode: '', billToAddress: '' }));
      return;
    }
    
    // Find the address from customer addresses
    const addr = vendorEffectiveBillToAddresses.find(a => String(a.Address) === String(addressCode))
      || vendorEffectiveShipToAddresses.find(a => String(a.Address) === String(addressCode));
    if (addr) {
      const formattedAddress = fmtAddr(addr);
      setHeader(p => ({ 
        ...p, 
        billToCode: addressCode, 
        billToAddress: formattedAddress
      }));
    } else {
      setHeader(p => ({ ...p, billToCode: addressCode }));
    }
  };
  
  const handleSeriesChange = async (seriesValue) => {
    if (!seriesValue) return;
    
    setPageState(p => ({ ...p, seriesLoading: true }));
    setHeader(p => ({ ...p, series: seriesValue, nextNumber: '...' }));
    
    try {
      const res = await fetchNextNumber(seriesValue);
      setHeader(p => ({ ...p, nextNumber: String(res.data.nextNumber || '') }));
    } catch (err) {
      setHeader(p => ({ ...p, nextNumber: 'Error' }));
      setPageState(p => ({ ...p, error: 'Failed to get next document number' }));
    } finally {
      setPageState(p => ({ ...p, seriesLoading: false }));
    }
  };

  const handleLineChange = async (i, e) => {
    if (!isDocumentEditable) return;
    const { name, value } = e.target;
    setValErrors(p => ({ ...p, lines: { ...p.lines, [i]: { ...(p.lines[i] || {}), [name]: '' } }, form: '' }));
    setPageState(p => ({ ...p, error: '', success: '' }));
    
    if (name === 'itemNo' && value) {
      // Fetch HSN code from database via API
      try {
        const item = refData.items.find(it => String(it.ItemCode || '') === String(value || ''));
        
        if (item) {
          // Fetch HSN code from OCHP table via JOIN query
          const hsnResponse = await fetchHSNCodeFromItem(value);
          const hsnData = hsnResponse.data;
          
          console.log('🔍 Item Selected - HSN Data:', {
            itemCode: value,
            hsnCode: hsnData.hsnCode,
            hsnDescription: hsnData.hsnDescription,
            hsn_sww: hsnData.hsn_sww,
          });
          
          setLines(prev => prev.map((line, idx) => {
            if (idx !== i) return line;
            const next = { ...line, itemNo: value };
            
            // Step 1: Set Item Details
            next.itemDescription = item.ItemName || next.itemDescription;
            next.uomCode = String(item.SalesUnit || item.InventoryUOM || '').trim();
            next.uomName = next.uomCode || next.uomName || '';
            next.inventoryUOM = String(item.InventoryUOM || '').trim();
            next.qtyInventoryUom = next.qtyInventoryUom || next.quantity || '';
            next.uomGroup = getUomGroupName(item);
            next.countryOfOrigin = item.ItemCountryOrg || item.CountryOrg || next.countryOfOrigin || '';
            next.glAccount = next.glAccount || item.SalesGLAccount || item.IncomeAccount || item.IncomeAcct || item.RevenuesAccount || item.RevenuesAc || '';
            next.distRule = next.distRule || item.DistributionRule || item.OcrCode || '';
            next.cogsDistRule = next.cogsDistRule || item.COGSDistributionRule || item.COGSCostingCode || item.CogsOcrCod || next.distRule || '';
            next.sellerItem = next.sellerItem || value;
            next.stcode = next.stcode || item.TaxCodeAR || item.SalTaxCode || '';
            
            // Step 2: Set HSN Code from API response (OCHP.ChapterID via JOIN)
            next.hsnCode = hsnData.hsnCode || hsnData.hsn_sww || '';
            
            // Step 3: Get Base Tax Code from Item Master
            const baseTaxCode = item.TaxCodeAR || item.SalTaxCode || '';
            
            console.log('🔍 Item Selected:', {
              itemCode: item.ItemCode,
              itemName: item.ItemName,
              hsnCode: next.hsnCode,
              baseTaxCode: baseTaxCode,
              placeOfSupply: header.placeOfSupply,
            });
            
            // Step 4: Determine GST State (Place of Supply)
            const gstState = header.placeOfSupply;
            const companyState = refData.company_address?.State || selectedBranch?.State || '';
            
            // Step 5: Validate States
            if (!gstState || !companyState) {
              console.warn('⚠️ Missing state information for tax determination');
              next.taxCode = '';
              next.total = fmtDec(calcLineTotalFromFields(next), numDec.total);
              return next;
            }
            
            // Step 6: Auto-Determine Tax Code using Tax Engine
            const determinedTaxCode = determineTaxCode(
              item,
              gstState,  // shipToState
              gstState,  // billToState (using same as shipTo)
              false,     // useBillToForTax
              companyState,
              effectiveTaxCodes
            );
            
            if (determinedTaxCode) {
              next.taxCode = determinedTaxCode;
              console.log(`✅ Auto-assigned tax code: ${determinedTaxCode} (${getGSTTypeLabel(companyState, gstState)})`);
            } else {
              console.warn('⚠️ Could not determine tax code automatically');
              next.taxCode = '';
            }
            
            next.total = fmtDec(calcLineTotalFromFields(next), numDec.total);
            return next;
          }));
        }
      } catch (error) {
        console.error('❌ Error fetching HSN code:', error);
        // Fallback to basic item selection without HSN
        setLines(prev => prev.map((line, idx) => {
          if (idx !== i) return line;
          const next = { ...line, itemNo: value };
          const item = refData.items.find(it => String(it.ItemCode || '') === String(value || ''));
          if (item) {
            next.itemDescription = item.ItemName || next.itemDescription;
            next.uomCode = String(item.SalesUnit || item.InventoryUOM || '').trim();
            next.uomName = next.uomCode || next.uomName || '';
            next.inventoryUOM = String(item.InventoryUOM || '').trim();
            next.qtyInventoryUom = next.qtyInventoryUom || next.quantity || '';
            next.uomGroup = getUomGroupName(item);
            next.countryOfOrigin = item.ItemCountryOrg || item.CountryOrg || next.countryOfOrigin || '';
            next.glAccount = next.glAccount || item.SalesGLAccount || item.IncomeAccount || item.IncomeAcct || item.RevenuesAccount || item.RevenuesAc || '';
            next.distRule = next.distRule || item.DistributionRule || item.OcrCode || '';
            next.cogsDistRule = next.cogsDistRule || item.COGSDistributionRule || item.COGSCostingCode || item.CogsOcrCod || next.distRule || '';
            next.sellerItem = next.sellerItem || value;
            next.stcode = next.stcode || item.TaxCodeAR || item.SalTaxCode || '';
            next.hsnCode = item.SWW || item.HSNCode || item.U_HSNCode || next.hsnCode || '';
          }
          next.total = fmtDec(calcLineTotalFromFields(next), numDec.total);
          return next;
        }));
      }
      return;
    }
    
    setLines(prev => prev.map((line, idx) => {
      if (idx !== i) return line;
      const next = { ...line, [name]: numDec[name] !== undefined ? sanitize(value, numDec[name]) : value };
      if (name === 'uomCode') {
        next.uomName = value;
      }
      if (name === 'distRule' && (!line.cogsDistRule || line.cogsDistRule === line.distRule)) {
        next.cogsDistRule = value;
      }
      if (name === 'quantity' && !isCheckedValue(next.changeQtyInvUomIndependently)) {
        next.qtyInventoryUom = next.quantity;
      }
      if (name === 'total') {
        next.total = sanitize(value, numDec.total);
        const unitPrice = calcUnitPriceFromTotal(next);
        if (unitPrice) next.unitPrice = unitPrice;
      } else if (['quantity', 'unitPrice', 'stdDiscount'].includes(name)) {
        next.total = fmtDec(calcLineTotalFromFields(next), numDec.total);
      }
      return next;
    }));

    if ((name === 'wTaxLiable' || name === 'wtaxLiable') && isYesValue(value) && withholdingTax.customerSubject) {
      setWithholdingTax((prev) => ({
        ...prev,
        open: true,
        rows: prev.rows.length ? recalcWithholdingRows(prev.rows) : createDefaultWithholdingRows(),
      }));
    }
  };

  const handleNumBlur = (field, target = 'line', i = null) => {
    if (!isDocumentEditable) return;
    const d = numDec[field];
    if (d === undefined) return;
    if (target === 'header') { setHeader(p => ({ ...p, [field]: fmtDec(p[field], d) })); return; }
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: fmtDec(l[field], d) } : l));
  };

  // ── Freight Selection Modal handlers ──────────────────────────────────────
  const openWithholdingTaxTable = useCallback(() => {
    if (!isDocumentEditable) return;
    if (!header.vendor) {
      setPageState((prev) => ({ ...prev, error: 'Select a customer before opening withholding tax table.', success: '' }));
      return;
    }

    if (!withholdingTax.customerSubject) {
      setPageState((prev) => ({ ...prev, error: 'Selected customer does not have withholding tax setup.', success: '' }));
      return;
    }

    setPageState((prev) => ({ ...prev, error: '', success: '' }));
    setWithholdingTax((prev) => ({
      ...prev,
      open: true,
      rows: prev.rows.length ? recalcWithholdingRows(prev.rows) : createDefaultWithholdingRows(),
    }));
  }, [createDefaultWithholdingRows, header.vendor, isDocumentEditable, recalcWithholdingRows, withholdingTax.customerSubject]);

  const handleDocumentContextMenu = (event) => {
    event.preventDefault();
    openWithholdingTaxTable();
  };

  const openFreightModal = async () => {
    if (!isDocumentEditable) return;
    console.log('🚚 Opening freight modal, docEntry:', currentDocEntry);
    if (freightModal.freightCharges.length > 0) {
      setFreightModal(prev => ({ ...prev, open: true, loading: false }));
      return;
    }
    setFreightModal(prev => ({ ...prev, open: true, loading: true }));
    
    try {
      console.log('📡 Fetching freight charges from API...');
      const response = await fetchFreightCharges(currentDocEntry);
      console.log('✅ Freight charges received:', response.data);
      console.log('📊 Freight charges count:', response.data.freightCharges?.length || 0);
      
      setFreightModal({
        open: true,
        freightCharges: response.data.freightCharges || [],
        loading: false
      });
    } catch (error) {
      console.error('❌ Failed to load freight charges:', error);
      console.error('Error details:', error.response?.data || error.message);
      setFreightModal({
        open: true,
        freightCharges: [],
        loading: false
      });
    }
  };

  const closeFreightModal = () => {
    setFreightModal(prev => ({ ...prev, open: false, loading: false }));
  };

  const handleFreightApply = (summary) => {
    if (!isDocumentEditable) return;
    console.log('🚚 Applied freight charges:', summary);
    setFreightModal(prev => ({
      ...prev,
      open: false,
      loading: false,
      freightCharges: summary.rows || [],
    }));
    setHeader(prev => ({
      ...prev,
      freight: fmtDec(summary.totalNet || 0, numDec.freight),
    }));
  };

  const addLine = () => {
    if (!isDocumentEditable) return;
    // Validate the last line before adding a new one
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastIndex = lines.length - 1;
      const errors = {};
      
      // Check if last line has an item
      if (!String(lastLine.itemNo || '').trim()) {
        errors.itemNo = 'Item is required before adding a new line';
      }
      
      // Check if last line has HSN Code
      if (!String(lastLine.hsnCode || '').trim()) {
        errors.hsnCode = 'HSN Code is required before adding a new line';
      }
      
      // Check if last line has quantity
      if (!lastLine.quantity || Number(lastLine.quantity) <= 0) {
        errors.quantity = 'Quantity is required before adding a new line';
      }
      
      // SAP B1 allows either Unit Price or Total (LC) to drive the line amount.
      if (
        (!lastLine.unitPrice || Number(lastLine.unitPrice) <= 0) &&
        (!lastLine.total || Number(lastLine.total) <= 0)
      ) {
        errors.total = 'Total (LC) or Unit Price is required before adding a new line';
      }
      
      // Check if last line has Tax Code
      if (!String(lastLine.taxCode || '').trim()) {
        errors.taxCode = 'Tax Code is required before adding a new line';
      }
      
      // Check if last line has Warehouse
      if (!String(lastLine.whse || '').trim()) {
        errors.whse = 'Warehouse is required before adding a new line';
      }
      
      // If there are errors, show them and don't add new line
      if (Object.keys(errors).length > 0) {
        setValErrors(p => ({
          ...p,
          lines: { ...p.lines, [lastIndex]: errors },
          form: 'Please complete the current line before adding a new one.'
        }));
        setPageState(p => ({ 
          ...p, 
          error: 'Please complete the current line before adding a new one.' 
        }));
        return;
      }
    }
    
    // Clear errors and add new line with current header values
    setValErrors(p => ({ ...p, form: '' }));
    setPageState(p => ({ ...p, error: '' }));
    markDirty();
    setLines(p => [...p, { 
      ...createLine(rowUdfDefinitions), 
      branch: header.branch || '', 
      loc: header.branch || '',
      whse: header.warehouse || ''
    }]);
  };

  const removeLine = (i) => {
    if (!isDocumentEditable) return;
    markDirty();
    setValErrors(p => { const nl = { ...p.lines }; delete nl[i]; return { ...p, lines: nl, form: '' }; });
    setLines(p => p.filter((_, idx) => idx !== i));
  };

  const handleHeaderUdfChange = (k, v) => {
    if (!isDocumentEditable) return;
    markDirty();
    setHeaderUdfs(p => ({ ...p, [k]: v }));
  };
  const handleRowUdfChange = (i, k, v) => {
    if (!isDocumentEditable) return;
    markDirty();
    const field = rowUdfDefinitions.find((definition) => definition.key === k);
    const isSellerItem = normalizeFieldIdentity(field?.aliasId || field?.key || field?.label) === 'sitem';
    const matchedItem = isSellerItem
      ? refData.items.find((item) => String(item.ItemCode || '') === String(v || ''))
      : null;

    setLines(p => p.map((l, idx) => {
      if (idx !== i) return l;
      const nextUdf = { ...(l.udf || {}), [k]: v };
      if (isSellerItem && itemNameRowUdfKey) {
        nextUdf[itemNameRowUdfKey] = matchedItem?.ItemName || '';
      }
      return {
        ...l,
        sellerItem: isSellerItem ? v : l.sellerItem,
        udf: nextUdf,
      };
    }));
  };
  const updateFormSetting = (g, k, prop, val) => setFormSettings(p => ({
    ...p,
    [g]: {
      ...(p[g] || {}),
      [k]: { ...((p[g] || {})[k] || {}), [prop]: val },
    },
  }));
  const toggleHeaderUdfs = () => {
    setFormSettingsOpen(false);
    setSidebarOpen(p => !p);
  };
  const toggleFormSettings = () => {
    setSidebarOpen(false);
    setFormSettingsOpen(p => !p);
  };

  // ── Address Modal handlers ────────────────────────────────────────────────
  const openAddressModal = (type) => {
    if (!isDocumentEditable) return;
    const shipAddress = resolveARInvoiceAddress(
      header.shipToCode,
      vendorEffectiveShipToAddresses,
      header.shipToAddress || header.shipTo,
    );
    const billAddress = resolveARInvoiceAddress(
      header.billToCode || header.payToCode,
      vendorEffectiveBillToAddresses,
      header.billToAddress || header.payTo,
    );
    const activeAddress = type === 'billTo' ? billAddress : shipAddress;

    setAddressForm(
      mapAddressToModalForm(activeAddress, {
        shipToCode: header.shipToCode || shipAddress?.Address || '',
        shipToAddress: header.shipToAddress || header.shipTo || (shipAddress ? fmtAddr(shipAddress) : ''),
        billToCode: header.billToCode || header.payToCode || billAddress?.Address || '',
        billToAddress: header.billToAddress || header.payTo || (billAddress ? fmtAddr(billAddress) : ''),
      }),
    );
    setAddressModal({ type });
  };

  const closeAddressModal = () => {
    setAddressModal(null);
  };

  const saveAddressModal = () => {
    if (!isDocumentEditable) return;
    const formatted = [
      [addressForm.streetPoBox, addressForm.streetNo].filter(Boolean).join(', '),
      addressForm.buildingFloorRoom,
      [addressForm.block, addressForm.city].filter(Boolean).join(', '),
      [addressForm.county, addressForm.state, addressForm.zipCode].filter(Boolean).join(', '),
      addressForm.countryRegion,
      addressForm.addressName2,
      addressForm.addressName3,
    ].filter(Boolean).join('\n');

    if (addressModal.type === 'shipTo') {
      setHeader(p => ({
        ...p,
        shipToCode: addressForm.shipToCode || p.shipToCode,
        shipToAddress: formatted || addressForm.shipToAddress,
        shipTo: formatted || addressForm.shipToAddress,
        billToCode: addressForm.billToCode || p.billToCode,
        payToCode: addressForm.billToCode || p.payToCode,
        billToAddress: addressForm.billToAddress || p.billToAddress,
        payTo: addressForm.billToAddress || p.payTo,
        placeOfSupply: addressForm.state || p.placeOfSupply,
      }));
    } else {
      setHeader(p => ({
        ...p,
        shipToCode: addressForm.shipToCode || p.shipToCode,
        shipToAddress: addressForm.shipToAddress || p.shipToAddress,
        shipTo: addressForm.shipToAddress || p.shipTo,
        billToCode: addressForm.billToCode || p.billToCode,
        payToCode: addressForm.billToCode || p.payToCode,
        billToAddress: formatted || addressForm.billToAddress,
        payTo: formatted || addressForm.billToAddress,
        placeOfSupply: header.useBillToForTax ? addressForm.state || p.placeOfSupply : p.placeOfSupply,
      }));
    }
    closeAddressModal();
  };

  const handleAddressFormChange = (e) => {
    const { name, value } = e.target;
    setAddressForm(p => ({ ...p, [name]: value }));
  };

  // ── Tax Info Modal handlers ───────────────────────────────────────────────
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

  // ── BP Modal handlers ─────────────────────────────────────────────────────
  const openBpModal = () => {
    if (!isDocumentEditable) return;
    setBpModal(true);
  };

  const closeBpModal = () => {
    setBpModal(false);
  };

  // ── State Modal handlers ──────────────────────────────────────────────────
  const openStateModal = () => {
    if (!isDocumentEditable) return;
    setStateModal(true);
  };

  const closeStateModal = () => {
    setStateModal(false);
  };

  const handleStateSelect = (state) => {
    if (!isDocumentEditable) return;
    setHeader(p => ({ ...p, placeOfSupply: getStateCodeValue(state, refData.states) }));
  };

  // ── BP Modal handlers ─────────────────────────────────────────────────────
  const handleBpSelect = (bp) => {
    if (!isDocumentEditable) return;
    const code = bp.CardCode;
    setHeader(prev => {
      const prep = { ...prev, vendor: code };
      const { nextHeader } = syncVendor(code, prep);
      nextHeader.contactPerson = '';
      // Reset address fields when vendor changes
      nextHeader.billToCode = '';
      nextHeader.billToAddress = '';
      nextHeader.shipToCode = '';
      nextHeader.shipToAddress = '';
      nextHeader.placeOfSupply = '';
      return nextHeader;
    });
    loadVendorDetails(code);
  };

  const handleTaxInfoFormChange = (e) => {
    const { name, value } = e.target;
    setTaxInfoForm(p => ({ ...p, [name]: value }));
  };

  // ── Browse Attachment handler ─────────────────────────────────────────────
  const handleBrowseAttachment = () => {
    if (!isDocumentEditable) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      alert(`Selected ${files.length} file(s). Upload functionality to be implemented.`);
    };
    input.click();
  };

  // ── HSN Modal handlers ────────────────────────────────────────────────────
  const openHSNModal = (lineIndex) => {
    if (!isDocumentEditable) return;
    setHsnModal({ open: true, lineIndex });
  };

  const closeHSNModal = () => {
    setHsnModal({ open: false, lineIndex: -1 });
  };

  const handleHSNSelect = (hsn) => {
    if (!isDocumentEditable) return;
    if (hsnModal.lineIndex >= 0) {
      setLines(prev => prev.map((line, idx) => 
        idx === hsnModal.lineIndex 
          ? { ...line, hsnCode: hsn.code || '' }
          : line
      ));
    }
    closeHSNModal();
  };

  // ── Item Selection Modal handlers ─────────────────────────────────────────
  const openItemModal = async (lineIndex) => {
    if (!isDocumentEditable) return;
    console.log('🔍 Opening item modal for line:', lineIndex);
    setItemModal({ open: true, lineIndex, items: [], loading: true });
    
    try {
      const response = await fetchItemsForModal();
      console.log('📊 Items count:', response.data.items?.length || 0);
      
      setItemModal(prev => ({
        ...prev,
        items: response.data.items || [],
        loading: false,
      }));
    } catch (error) {
      console.error('❌ Failed to load items:', error);
      console.error('Error details:', error.response?.data || error.message);
      setItemModal(prev => ({
        ...prev,
        items: [],
        loading: false,
      }));
    }
  };

  const closeItemModal = () => {
    setItemModal({ open: false, lineIndex: -1, items: [], loading: false });
  };

  const handleItemSelect = async (item) => {
    if (!isDocumentEditable) return;
    if (itemModal.lineIndex < 0) return;
    
    const lineIndex = itemModal.lineIndex;
    const mergedItem = mergeItemMaster(item, refData.items);
    
    try {
      const hsnRes = await fetchHSNCodeFromItem(mergedItem.ItemCode);
      const hsnData = hsnRes.data;
      
      setLines(prev => prev.map((line, idx) => {
        if (idx === lineIndex) {
          const updatedLine = hydrateDocumentLineFromItem(line, mergedItem, {
            side: 'sales',
            hsnCode: hsnData.hsnCode || hsnData.hsn_sww || '',
            fallbackWarehouse: header.warehouse,
            calcLineTotal,
            formatTotal: (value) => fmtDec(value, numDec.total),
          });
          updatedLine.uomName = updatedLine.uomName || updatedLine.uomCode || '';
          updatedLine.inventoryUOM = mergedItem.InventoryUOM || updatedLine.inventoryUOM || '';
          updatedLine.qtyInventoryUom = updatedLine.qtyInventoryUom || updatedLine.quantity || '';
          updatedLine.uomGroup = getUomGroupName(mergedItem);
          updatedLine.sellerItem = updatedLine.sellerItem || mergedItem.ItemCode || '';
          updatedLine.stcode = updatedLine.stcode || mergedItem.TaxCodeAR || mergedItem.SalTaxCode || '';
          
          // Auto-populate tax code based on HSN
          if (updatedLine.hsnCode) {
            const taxCode = determineTaxCode(updatedLine.hsnCode, refData.tax_codes || []);
            if (taxCode) {
              updatedLine.taxCode = taxCode;
            }
          }
          
          return updatedLine;
        }
        return line;
      }));
      
      closeItemModal();
    } catch (error) {
      console.error('Error selecting item:', error);
      setLines(prev => prev.map((line, idx) => {
        if (idx === lineIndex) {
          const updatedLine = hydrateDocumentLineFromItem(line, mergedItem, {
            side: 'sales',
            fallbackWarehouse: header.warehouse,
            calcLineTotal,
            formatTotal: (value) => fmtDec(value, numDec.total),
          });
          updatedLine.uomName = updatedLine.uomName || updatedLine.uomCode || '';
          updatedLine.inventoryUOM = mergedItem.InventoryUOM || updatedLine.inventoryUOM || '';
          updatedLine.qtyInventoryUom = updatedLine.qtyInventoryUom || updatedLine.quantity || '';
          updatedLine.uomGroup = getUomGroupName(mergedItem);
          updatedLine.sellerItem = updatedLine.sellerItem || mergedItem.ItemCode || '';
          updatedLine.stcode = updatedLine.stcode || mergedItem.TaxCodeAR || mergedItem.SalTaxCode || '';
          return updatedLine;
        }
        return line;
      }));
      closeItemModal();
    }
  };

  // ── Sync warehouse and branch from header to lines ────────────────────────
  // Sync branch to all lines when header branch changes
  useEffect(() => {
    if (header.branch) {
      console.log('🔄 Syncing branch to all lines:', header.branch);
      setLines(prev => {
        const updated = prev.map(l => ({ 
          ...l, 
          branch: String(header.branch), 
          loc: String(header.branch)
        }));
        console.log('✅ Lines updated with branch:', updated.map(l => ({ branch: l.branch, loc: l.loc })));
        return updated;
      });
    }
  }, [header.branch]);

  useEffect(() => {
    if (!header.branch || !refData.warehouses.length) return;

    const allowedWarehouseCodes = new Set(
      branchFilteredWarehouses.map(w => String(w.WhsCode || ''))
    );

    setHeader(prev => (
      prev.warehouse && !allowedWarehouseCodes.has(String(prev.warehouse))
        ? { ...prev, warehouse: '' }
        : prev
    ));

    setLines(prev => prev.map(line => (
      line.whse && !allowedWarehouseCodes.has(String(line.whse))
        ? { ...line, whse: '' }
        : line
    )));
  }, [branchFilteredWarehouses, header.branch, refData.warehouses.length]);

  // Sync warehouse to all lines when header warehouse changes
  useEffect(() => {
    if (header.warehouse) {
      setLines(prev => prev.map(l => ({ ...l, whse: header.warehouse })));
    }
  }, [header.warehouse]);

  // ── Recalculate Tax Codes on State/Address Changes ────────────────────────
  useEffect(() => {
    if (!header.vendor || !header.placeOfSupply) return;

    const companyState = refData.company_address?.State || selectedBranch?.State || '';
    
    if (!companyState) {
      console.warn('⚠️ Company state not available for tax recalculation');
      return;
    }

    console.log('🔄 Recalculating Tax Codes for All Lines:', {
      placeOfSupply: header.placeOfSupply,
      companyState,
      gstType: getGSTTypeLabel(companyState, header.placeOfSupply),
    });

    // Recalculate tax codes for all lines with items using functional update
    setLines(prevLines => {
      return recalculateAllTaxCodes(
        prevLines,
        refData.items,
        header.placeOfSupply,  // shipToState
        header.placeOfSupply,  // billToState
        false,                 // useBillToForTax
        companyState,
        effectiveTaxCodes
      );
    });
  }, [header.placeOfSupply, header.vendor, refData.company_address, selectedBranch, refData.items, effectiveTaxCodes]);

  // Continue in next part...

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    console.log('🔍 Starting validation...');
    const isUpdate = !!currentDocEntry;
    const e = { header: {}, lines: {}, form: '' };
    
    try {
      if (!isUpdate) {
        console.log('🔍 Validating vendor:', header.vendor);
        const vc = String(header.vendor || '').trim();
        if (!vc) { 
          console.log('❌ Vendor validation failed');
          e.header.vendor = 'Select a customer.'; 
          e.form = 'Please correct the highlighted fields.'; 
          return e; 
        }
        
        console.log('🔍 Validating placeOfSupply:', header.placeOfSupply);
        if (!String(header.placeOfSupply || '').trim()) { 
          console.log('❌ Place of supply validation failed');
          e.header.placeOfSupply = 'Place of supply is required.'; 
          e.form = 'Please correct the highlighted fields.'; 
          return e; 
        }
      }
      
      console.log('🔍 Validating postingDate:', header.postingDate);
      if (!String(header.postingDate || '').trim()) { 
        console.log('❌ Posting date validation failed');
        e.header.postingDate = 'Posting date is required.'; 
        e.form = 'Please correct the highlighted fields.'; 
        return e; 
      }
      
      console.log('🔍 Validating documentDate:', header.documentDate);
      if (!String(header.documentDate || '').trim()) { 
        console.log('❌ Document date validation failed');
        e.header.documentDate = 'Document date is required.'; 
        e.form = 'Please correct the highlighted fields.'; 
        return e; 
      }

      console.log('🔍 Filtering lines with items...');
      const pop = lines.filter(l => String(l.itemNo || '').trim());
      console.log(`🔍 Found ${pop.length} lines with items out of ${lines.length} total lines`);
      
      if (!pop.length) { 
        console.log('❌ No item lines found');
        e.form = 'Add at least one item line.'; 
        return e; 
      }
      
      console.log('🔍 Validating individual lines...');
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        console.log(`🔍 Checking line ${i}:`, { 
          itemNo: l.itemNo, 
          quantity: l.quantity, 
          hsnCode: l.hsnCode,
          unitPrice: l.unitPrice,
          uomCode: l.uomCode,
          whse: l.whse,
          taxCode: l.taxCode
        });
        
        if (!String(l.itemNo || '').trim()) {
          console.log(`⏭️ Skipping empty line ${i}`);
          continue;
        }

        if (!l.itemNo) {
          console.log(`❌ Line ${i}: Item is required`);
          e.lines[i] = { ...(e.lines[i] || {}), itemNo: 'Item is required' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }

        if (!l.quantity || Number(l.quantity) <= 0) {
          console.log(`❌ Line ${i}: Quantity validation failed`);
          e.lines[i] = { ...(e.lines[i] || {}), quantity: 'Quantity must be > 0' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }

        if (!l.hsnCode && !isUpdate) {
          console.log(`❌ Line ${i}: HSN Code is required`);
          e.lines[i] = { ...(e.lines[i] || {}), hsnCode: 'HSN Code is required' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }

        if (
          (!l.unitPrice || Number(l.unitPrice) <= 0) &&
          (!l.total || Number(l.total) <= 0) &&
          !isUpdate
        ) {
          console.log(`❌ Line ${i}: Unit Price/Total validation failed`);
          e.lines[i] = { ...(e.lines[i] || {}), total: 'Total (LC) or Unit Price must be > 0' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }

        if (!l.uomCode && !isUpdate) {
          console.log(`❌ Line ${i}: UoM is required`);
          e.lines[i] = { ...(e.lines[i] || {}), uomCode: 'UoM is required' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }

        if (!l.whse && !isUpdate) {
          console.log(`❌ Line ${i}: Warehouse is required`);
          e.lines[i] = { ...(e.lines[i] || {}), whse: 'Warehouse is required' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }
        
        console.log(`🔍 Line ${i}: Validating tax code:`, l.taxCode);
        const hasTaxCode = String(l.taxCode || '').trim();
        const taxCodeExists = !hasTaxCode || effectiveTaxCodes.some(t => String(t.Code) === String(l.taxCode));
        if (!taxCodeExists) {
          console.log(`❌ Line ${i}: Tax code '${l.taxCode}' is not valid`);
          e.lines[i] = { ...(e.lines[i] || {}), taxCode: `Tax code '${l.taxCode}' is not valid in SAP B1` };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }
      }
      
      // Validate GST tax code combinations after checking all lines
      console.log('🔍 Validating GST tax code combinations...');
      const taxCodesUsed = new Set(pop.map(l => l.taxCode).filter(Boolean));
      console.log('🔍 Tax codes used:', Array.from(taxCodesUsed));
      
      const sgstCodes = getTaxComponentCodes(taxCodesUsed, effectiveTaxCodes, 'SGST');
      const cgstCodes = getTaxComponentCodes(taxCodesUsed, effectiveTaxCodes, 'CGST');

      console.log('🔍 SGST codes:', sgstCodes);
      console.log('🔍 CGST codes:', cgstCodes);

      if (sgstCodes.length > 0 && cgstCodes.length === 0) {
        console.log('❌ SGST requires CGST');
        e.form = 'SGST requires CGST to be applied as well';
        return e;
      }
      if (cgstCodes.length > 0 && sgstCodes.length === 0) {
        console.log('❌ CGST requires SGST');
        e.form = 'CGST requires SGST to be applied as well';
        return e;
      }
      if (sgstCodes.length > 0 && cgstCodes.length > 0) {
        console.log('🔍 Validating SGST and CGST rates match...');
        const sgstRates = sgstCodes.map(code => {
          const tax = findTaxCode(effectiveTaxCodes, code);
          return tax ? parseNum(tax.Rate) : 0;
        });
        const cgstRates = cgstCodes.map(code => {
          const tax = findTaxCode(effectiveTaxCodes, code);
          return tax ? parseNum(tax.Rate) : 0;
        });
        console.log('🔍 SGST rates:', sgstRates);
        console.log('🔍 CGST rates:', cgstRates);
        
        if (sgstRates[0] !== cgstRates[0]) {
          console.log('❌ SGST and CGST rates do not match');
          e.form = 'SGST and CGST rates must be equal';
          return e;
        }
      }

      // Prevent save if total is 0
      console.log('🔍 Calculating totals...');
      const currentTotals = calcTotals();
      console.log('🔍 Total:', currentTotals.total);
      
      if (currentTotals.total <= 0) {
        console.log('❌ Total is 0 or negative');
        e.form = 'Total amount must be greater than 0. Please add items with valid prices.';
        return e;
      }

      if (hasWTaxLiableLines) {
        if (!withholdingTax.customerSubject) {
          e.form = 'Selected customer does not have withholding tax setup.';
          return e;
        }

        if (!wtaxRowsForTotals.some((row) => String(row.code || '').trim())) {
          e.form = 'Select withholding tax code in the withholding tax table.';
          return e;
        }
      }

      console.log('✅ Validation passed!');
      return e;
      
    } catch (error) {
      console.error('❌ Validation error:', error);
      console.error('Error stack:', error.stack);
      e.form = `Validation error: ${error.message}`;
      return e;
    }
  };

  // ── Copy From Modal Handlers ───────────────────────────────────────────────
  const openCopyFromModal = (docType) => {
    if (!isDocumentEditable || currentDocEntry) return;
    console.log('🟢 Copy From Clicked');

    // ✅ ONLY BUYER VALIDATION
    if (!header.vendor) {
      setValErrors({
        header: { vendor: 'Select Customer first' },
        lines: {},
        form: ''
      });
      return;
    }

    // ✅ CLEAR ALL ERRORS
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, error: '', success: '' }));

    setCopyFromDocType(docType);
    setCopyFromModal(true);
  };

  // ── Copy From handler ─────────────────────────────────────────────────────
  const handleCopyFrom = (data, sourceType) => {
    const copySource = unwrapCopyFromDocument(data);
    const baseType = BASE_TYPE[sourceType] || 17;
    const normHeader = normaliseDocumentHeader(copySource.header);

    setHeader(prev => ({ ...prev, ...normHeader }));
    const copiedHeaderUdfs = mergeUdfValues(copySource.header_udfs, copySource.headerUdfs, copySource.header?.header_udfs, copySource.header?.headerUdfs);
    setHeaderUdfs({
      ...copiedHeaderUdfs,
      ...normalizeUdfState(headerUdfDefinitions, copiedHeaderUdfs),
    });

    const rawLines = copySource.lines;
    const newLines = rawLines.map((line, idx) => {
      const normalizedLine = normaliseDocumentLine(line, idx, copySource.docEntry, baseType, normHeader.branch);
      const copiedLineUdfs = mergeUdfValues(line.line_udfs, line.lineUdfs, line.udf, normalizedLine.udf);
      return {
        ...createLine(rowUdfDefinitions),
        ...normalizedLine,
        udf: {
          ...copiedLineUdfs,
          ...normalizeUdfState(rowUdfDefinitions, copiedLineUdfs),
        },
      };
    });
    setLines(newLines.length > 0 ? newLines : [createLine(rowUdfDefinitions)]);

    const cardCode = normHeader.vendor;
    if (cardCode && cardCode !== header.vendor) loadVendorDetails(cardCode);

    const labels = { salesQuotation: 'Sales Quotation', salesOrder: 'Sales Order', delivery: 'Delivery', blanket: 'Blanket Agreement' };
    setPageState(p => ({ ...p, success: `Copied from ${labels[sourceType] || sourceType}` }));
  };

  // ── Copy From fetch handlers ───────────────────────────────────────────────
  const fetchCopyFromDocuments = async (docType) => {
    try {
      const bpCode = String(header.vendor || '').trim();
      if (!bpCode) return [];

      // Sales Quotations: use dedicated API
      if (docType === 'salesQuotation') {
        const res = await fetchOpenSalesQuotationsForARInvoice(bpCode);
        return res?.data?.quotations || res?.data?.documents || [];
      }
      // Sales Orders: filter by current customer for relevance
      if (docType === 'salesOrder') {
        const res = await fetchOpenSalesOrdersForARInvoice(bpCode);
        return res?.data?.orders || res?.data?.documents || [];
      }
      // Deliveries: filter by current customer for relevance
      if (docType === 'delivery') {
        const res = await fetchOpenDeliveriesForARInvoice(bpCode);
        return res?.data?.deliveries || res?.data?.documents || [];
      }
      // Blanket Agreements: use dedicated API
      if (docType === 'blanket') {
        const res = await fetchOpenBlanketAgreementsForARInvoice();
        return res?.data?.agreements || [];
      }
      return await arInvoiceCopyFromApi.fetchOpenDocuments(docType, bpCode);
    } catch (err) {
      console.error('Error fetching documents:', err);
      throw err;
    }
  };

  const fetchCopyFromDocumentDetails = async (docType, docEntry) => {
    try {
      if (docType === 'salesQuotation') {
        const res = await fetchSalesQuotationForARInvoiceCopy(docEntry);
        return res.data;
      }
      if (docType === 'salesOrder') {
        const res = await fetchSalesOrderForARInvoiceCopy(docEntry);
        return res.data;
      }
      if (docType === 'delivery') {
        const res = await fetchDeliveryForARInvoiceCopy(docEntry);
        return res.data;
      }
      if (docType === 'blanket') {
        const res = await fetchBlanketAgreementForARInvoiceCopy(docEntry);
        return res.data;
      }
      return await arInvoiceCopyFromApi.fetchDocumentForCopy(docType, docEntry);
    } catch (err) {
      console.error('Error fetching document details:', err);
      throw err;
    }
  };

  // ── Copy To handler ───────────────────────────────────────────────────────
  const handleCopyTo = async (targetType = 'ar-credit-memo') => {
    await copyToDocument({
      sourceDocType: 'arInvoice',
      targetType,
      sourceDocEntry: currentDocEntry,
      sourceDocNo: header.docNo,
      sourcePath: location.pathname,
      sourceSnapshot: {
        header,
        lines: lines.map((line) => ({ ...line, stdDiscount: line.stdDiscount ?? line.discount ?? '' })),
        headerUdfs,
      },
      restoreState: { arInvoiceDocEntry: currentDocEntry },
      navigate,
      upsertTask,
      removeTask,
      setError: (message) => setPageState(p => ({ ...p, success: '', error: message })),
      errorMessage: 'Please save the AR invoice first before copying to another document',
    });
  };

  const handleDuplicate = () => {
    const duplicated = duplicateDocumentInPlace({
      currentDocEntry,
      header,
      initialHeader: INIT_HEADER,
      lines,
      createLine,
      rowUdfDefinitions,
      setCurrentDocEntry,
      setHeader,
      setLines,
      setActiveTab,
      setValErrors,
      setPageState,
      setSnapshotPending,
      setIsDirty,
      setFreightModal,
      navigate,
      location,
      successMessage: 'A/R invoice duplicated. Review and add it as a new entry.',
    });

    if (duplicated) {
      refreshDuplicateSeries(refData.series, header.series, handleSeriesChange);
    }
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!isDocumentEditable) {
      setPageState(p => ({ ...p, error: 'Closed A/R Invoices cannot be edited.', success: '' }));
      return;
    }
    if (currentDocEntry && !hasUnsavedChanges) return;
    const e = validate();
    if (e.form || Object.values(e.header).some(Boolean) || Object.values(e.lines).some(le => Object.values(le || {}).some(Boolean))) {
      setValErrors(e);
      setPageState(p => ({ ...p, error: e.form || 'Please correct the highlighted fields.', success: '' }));
      if (hasWTaxLiableLines && withholdingTax.customerSubject) {
        setWithholdingTax((prev) => ({
          ...prev,
          open: true,
          rows: prev.rows.length ? recalcWithholdingRows(prev.rows) : createDefaultWithholdingRows(),
        }));
      }
      return;
    }
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, posting: true, error: '', success: '' }));
    try {
      const prep = { 
        ...header, 
        transactionType: getDocumentTypeCodeForTransaction(header.transactionType),
        deliveryDate: header.deliveryDate || header.postingDate || header.documentDate,
        placeOfSupply: header.placeOfSupply,
        branch: header.branch,
        contactPerson: header.contactPerson,
      };
      
      // Only include series if it's explicitly set and valid
      if (header.series && String(header.series).trim() && Number(header.series) > 0) {
        prep.series = Number(header.series);
      }
      
      console.log('🔍 [Frontend] Submitting AR Invoice with header:', prep);
      console.log('🔍 [Frontend] Lines:', lines);
      
      const payload = {
        company_id: AR_INVOICE_COMPANY_ID,
        header: prep,
        lines: lines.map((line) => ({
          ...line,
          udf: buildVisibleEnteredRowUdfPayload(rowUdfDefinitions, line.udf || {}, formSettings),
        })),
        freightCharges: freightModal.freightCharges,
        withholdingTaxRows: wtaxRowsForTotals,
        header_udfs: normalizeUdfState(headerUdfDefinitions, headerUdfs),
      };
      const r = currentDocEntry ? await updateARInvoice(currentDocEntry, payload) : await submitARInvoice(payload);
      const dn = r.data.doc_num ? ` Doc No: ${r.data.doc_num}.` : '';
      setSnapshotPending(false);
      setIsDirty(false);
      setCurrentDocEntry(null); setHeader(INIT_HEADER); setLines([createLine(rowUdfDefinitions)]);
      setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
      setWithholdingTax({ open: false, customerSubject: false, defaultCode: '', allowedCodes: [], rows: [] });
      setValErrors({ header: {}, lines: {}, form: '' });
      
      if (Array.isArray(refData.series) && refData.series.length > 0) {
        handleSeriesChange(refData.series[0].Series);
      }
      
      setPageState(p => ({ ...p, success: `${r.data.message || 'AR Invoice saved.'}${dn}` }));
    } catch (e) {
      console.error('❌ [Frontend] AR Invoice submission failed:', e);
      setPageState(p => ({ ...p, error: getErrMsg(e, 'AR Invoice submission failed.') }));
    } finally {
      setPageState(p => ({ ...p, posting: false }));
    }
  };

  const resetForm = () => {
    setSnapshotPending(false);
    setIsDirty(false);
    setCurrentDocEntry(null); setHeader(INIT_HEADER); setLines([createLine(rowUdfDefinitions)]);
    setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, error: '', success: '' }));
    setWithholdingTax({ open: false, customerSubject: false, defaultCode: '', allowedCodes: [], rows: [] });
  };

  const visHdrUdfs = headerUdfDefinitions.filter(f => formSettings.headerUdfs?.[f.key]?.visible !== false);
  const visibleRowUdfs = rowUdfDefinitions.filter(f => formSettings.rowUdfs?.[f.key]?.visible !== false);
  const isRightSidebarOpen = sidebarOpen || formSettingsOpen;

  // Continue in next part with render...

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form
      className={`del-page sap-document-page${isRightSidebarOpen ? ' del-page--sidebar-open' : ''}`}
      onSubmit={handleSubmit}
      onChangeCapture={markDirty}
      onContextMenu={handleDocumentContextMenu}
    >

      {/* toolbar */}
      <div className="del-toolbar sap-document-toolbar">
        <span className="del-toolbar__title">A/R Invoice{currentDocEntry ? ` — #${header.docNo || currentDocEntry}` : ''}</span>
        <button type="submit" className="del-btn del-btn--primary sap-document-toolbar__primary" disabled={pageState.posting || !isDocumentEditable}>
          {primaryActionLabel}
        </button>
        <button type="button" className="del-btn sap-document-toolbar__cancel" onClick={resetForm}>
          Cancel
        </button>
      
        <button
          type="button"
          className="del-btn sap-document-toolbar__udf"
          onClick={toggleHeaderUdfs}
        >
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button type="button" className="del-btn sap-document-toolbar__settings" onClick={toggleFormSettings}>
          Form Settings
        </button>
        <PrintLayoutToolbar
          documentType="arInvoice"
          documentLabel="A/R Invoice"
          docEntry={currentDocEntry}
          docNumber={header.docNo}
          disabled={pageState.posting}
          classPrefix="del"
          onSuccess={(message) => setPageState(p => ({ ...p, error: '', success: message }))}
          onError={(message) => setPageState(p => ({ ...p, success: '', error: message }))}
        />
        <div className="del-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
          <button
            type="button"
            className="del-btn"
            disabled={!isDocumentEditable || !!currentDocEntry}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setValErrors({ header: {}, lines: {}, form: '' });
              setPageState(p => ({ ...p, error: '', success: '' }));
              const dropdown = e.currentTarget.parentElement;
              const isActive = dropdown.classList.contains('active');
              document.querySelectorAll('.del-dropdown').forEach(d => d.classList.remove('active'));
              if (!isActive) dropdown.classList.add('active');
            }}
          >
            Copy From ▼
          </button>
          <div className="del-dropdown-menu">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openCopyFromModal();
                document.querySelectorAll('.del-dropdown').forEach(d => d.classList.remove('active'));
              }}
            >
              Sales Orders / Deliveries
            </button>
          </div>
        </div>
        <button 
          type="button" 
          className="del-btn sap-document-toolbar__copy"
          onClick={() => handleCopyTo('arCreditMemo')}
          disabled={!currentDocEntry}
          title={!currentDocEntry ? 'Save the AR invoice first' : 'Copy this invoice to A/R Credit Memo'}
        >
          Copy To
        </button>
        {currentDocEntry && (
          <button type="button" className="del-btn sap-document-toolbar__duplicate" onClick={handleDuplicate}>
            Duplicate
          </button>
        )}
        <button type="button" className="del-btn sap-document-toolbar__find" onClick={() => navigate('/ar-invoice/find')}>Find</button>
        <button type="button" className="del-btn sap-document-toolbar__new" onClick={resetForm}>New</button>
      </div>

      {/* alerts */}
      {pageState.loading && <div className="del-alert del-alert--success" style={{ marginTop: 0 }}>Loading…</div>}
      {pageState.error && <div className="del-alert del-alert--error">{pageState.error}</div>}
      {pageState.success && <div className="del-alert del-alert--success">{pageState.success}</div>}
      {refData.warnings?.length > 0 && (
        <div className="alert alert-warning py-2" style={{ fontSize: 11 }}>
          <strong>SAP warnings:</strong>
          {refData.warnings.map((w, i) => <div key={i}>{w}</div>)}
          <div style={{ marginTop: 4, color: '#555' }}>Dropdowns are showing fallback values. Connect to SAP to load live data.</div>
          <div style={{ marginTop: 4, color: '#d00', fontWeight: 600 }}>⚠️ Tax codes shown are examples only. Use actual SAP tax codes to avoid submission errors.</div>
        </div>
      )}

      <fieldset className="del-fieldset" disabled={!isDocumentEditable} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className={`so-layout${isRightSidebarOpen ? ' is-sidebar-open' : ''}`}>
        <div className="so-layout__main">

            {/* ══ HEADER CARD ══════════════════════════════════════════════ */}
            <div className="del-header-card">
              <div className="row g-2">
                {/* LEFT COLUMN */}
                <div className="col-md-6">
                  <div className="del-field-grid" style={{ gridTemplateColumns: '1fr' }}>
                    
                    {/* Buyer's Code */}
                    <div className="del-field">
                      <label className="del-field__label">Buyer's Code *</label>
                      <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                        <input
                          name="vendor"
                          className={`so-field__input${valErrors.header.vendor ? ' so-field__input--error' : ''}`}
                          value={header.vendor}
                          onChange={handleHeaderChange}
                          disabled={!!currentDocEntry}
                          placeholder="Customer code"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={openBpModal}
                          disabled={!!currentDocEntry}
                          style={{
                            padding: '0 8px',
                            fontSize: 11,
                            border: '1px solid #a0aab4',
                            background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
                            minWidth: '28px'
                          }}
                          title="Select Business Partner"
                        >
                          ...
                        </button>
                      </div>
                    </div>

                    {/* Buyer's Name */}
                    <div className="del-field">
                      <label className="del-field__label">Buyer's Name</label>
                      <input name="name" className="del-field__input" value={header.name} readOnly />
                    </div>

                    {/* Contact Person */}
                    <div className="del-field">
                      <label className="del-field__label">Contact Person</label>
                      <select
                        name="contactPerson"
                        className="del-field__select"
                        value={header.contactPerson || ''}
                        onChange={handleHeaderChange}
                        disabled={pageState.vendorLoading || !header.vendor || !!currentDocEntry}
                      >
                        <option value="">Select</option>
                        {contactOptions.map(c => (
                          <option key={c.CntctCode} value={c.CntctCode}>
                            {c.Name || `${c.FirstName || ''} ${c.LastName || ''}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Buyer PO No */}
                    <div className="del-field">
                      <label className="del-field__label">Buyer PO No</label>
                      <input
                        name="salesContractNo"
                        className="del-field__input"
                        value={header.salesContractNo}
                        onChange={handleHeaderChange}
                        disabled={!isDocumentEditable}
                      />
                    </div>

                    <DocumentCurrencySelect
                      classPrefix="del"
                      header={header}
                      onHeaderChange={handleHeaderChange}
                      businessPartners={refData.vendors || []}
                      disabled={!isDocumentEditable || pageState.vendorLoading || !header.vendor || !!currentDocEntry}
                    />

                    {/* Transaction Type */}
                    <div className="del-field">
                      <label className="del-field__label">Transaction Type</label>
                      <select
                        name="transactionType"
                        className="del-field__select"
                        value={header.transactionType || ''}
                        onChange={handleHeaderChange}
                        disabled={!isDocumentEditable || !transactionTypeOptions.length}
                      >
                        {transactionTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Place of Supply */}
                    <div className="del-field">
                      <label className="del-field__label">Place of Supply *</label>
                      <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                        <input
                          name="placeOfSupply"
                          className={`so-field__input${valErrors.header.placeOfSupply ? ' so-field__input--error' : ''}`}
                          value={getStateDisplayName(header.placeOfSupply, refData.states)}
                          onChange={handleHeaderChange}
                          placeholder="State code"
                          style={{ flex: 1 }}
                          disabled={!isDocumentEditable}
                        />
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={openStateModal}
                          style={{
                            padding: '0 8px',
                            fontSize: 11,
                            border: '1px solid #a0aab4',
                            background: 'linear-gradient(180deg, #fff 0%, #e8ecf0 100%)',
                            minWidth: '28px'
                          }}
                          title="Select State"
                          disabled={!isDocumentEditable}
                        >
                          ...
                        </button>
                      </div>
                    </div>

                    {/* Warehouse */}
                    <div className="del-field">
                      <label className="del-field__label">Warehouse *</label>
                      <select 
                        name="warehouse" 
                        className="del-field__select" 
                        value={header.warehouse || ''} 
                        onChange={handleHeaderChange}
                        disabled={!isDocumentEditable}
                      >
                        <option value="">Select Warehouse</option>
                        {branchFilteredWarehouses.map(w => (
                          <option key={w.WhsCode} value={w.WhsCode}>
                            {w.WhsCode} - {w.WhsName}
                          </option>
                        ))}
                        {header.warehouse && !branchFilteredWarehouses.some(w => String(w.WhsCode) === String(header.warehouse)) && (
                          <option value={header.warehouse}>{header.warehouse}</option>
                        )}
                      </select>
                    </div>

                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="col-md-6">
                  <div className="del-field-grid" style={{ gridTemplateColumns: '1fr' }}>

                    {/* Series */}
                    <div className="del-field">
                      <label className="del-field__label">Series</label>
                      <select 
                        name="series"
                        className="del-field__select" 
                        value={header.series}
                        onChange={handleHeaderChange}
                        disabled={!!currentDocEntry || pageState.seriesLoading}
                      >
                        <option value="">Select Series</option>
                        {Array.isArray(refData.series) && refData.series.map(s => (
                          <option key={s.Series} value={s.Series}>
                            {s.SeriesName} ({s.Indicator})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auto Number */}
                    <div className="del-field">
                      <label className="del-field__label">Number</label>
                      <input 
                        name="nextNumber" 
                        className="del-field__input" 
                        value={currentDocEntry ? (header.docNo || header.nextNumber || '') : (pageState.seriesLoading ? '...' : header.nextNumber)}
                        readOnly 
                        style={{ background: '#f0f2f5' }}
                        title="Number will be assigned after saving"
                      />
                    </div>

                    {/* Status */}
                    <div className="del-field">
                      <label className="del-field__label">Status</label>
                      <input name="status" className="del-field__input" value={header.status} readOnly style={{ background: '#f0f2f5', color: header.status === 'Open' ? '#1a7a30' : '#c00', fontWeight: 600 }} />
                    </div>

                    {/* Posting Date */}
                    <div className="del-field">
                      <label className="del-field__label">Posting Date *</label>
                      <input type="date" name="postingDate" className={`del-field__input${valErrors.header.postingDate ? ' del-field__input--error' : ''}`} value={header.postingDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                    </div>

                    {/* Delivery Date */}
                    <div className="del-field">
                      <label className="del-field__label">Delivery Date</label>
                      <input type="date" name="deliveryDate" className="del-field__input" value={header.deliveryDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                    </div>

                    {/* Document Date */}
                    <div className="del-field">
                      <label className="del-field__label">Document Date *</label>
                      <input type="date" name="documentDate" className={`del-field__input${valErrors.header.documentDate ? ' del-field__input--error' : ''}`} value={header.documentDate} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                    </div>

                    {/* Payment Terms */}
                    <div className="del-field">
                      <label className="del-field__label">Payment Terms</label>
                      <select name="paymentTerms" className="del-field__select" value={header.paymentTerms} onChange={handleHeaderChange} disabled={!isDocumentEditable}>
                        <option value="">Select</option>
                        {payTermOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    {/* Branch */}
                    <div className="del-field">
                      <label className="del-field__label">Branch</label>
                      <select name="branch" className="del-field__select" value={header.branch} onChange={handleHeaderChange} disabled={!!currentDocEntry}>
                        <option value="">Select Branch</option>
                        {refData.branches.map(b => (
                          <option key={b.BPLId} value={b.BPLId}>
                            {b.BPLName}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* ══ TABS ══════════════════════════════════════════════════════ */}
            <div className="del-tabs">
              {TAB_NAMES.map(t => (
                <button 
                  key={t}
                  type="button" 
                  className={`del-tab${activeTab === t ? ' del-tab--active' : ''}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* ══ TAB CONTENT ═══════════════════════════════════════════════ */}
            {activeTab === 'Contents' && (
              <ContentsTab
                lines={lines}
                onLineChange={handleLineChange}
                onNumBlur={handleNumBlur}
                onAddLine={addLine}
                onRemoveLine={removeLine}
                onOpenHSNModal={openHSNModal}
                onOpenItemModal={openItemModal}
                onOpenLineLookup={openLineLookup}
                lineItemOptions={lineItemOptions}
                getUomOptions={getUomOptions}
                effectiveTaxCodes={effectiveTaxCodes}
                effectiveWarehouses={branchFilteredWarehouses}
                fmtTaxLabel={fmtTaxLabel}
                getBranchName={getBranchName}
                valErrors={valErrors}
                isEditable={isDocumentEditable}
                formSettings={formSettings}
                matrixFields={matrixColumnDefinitions}
                rowUdfFields={visibleRowUdfs}
                onRowUdfChange={handleRowUdfChange}
              />
            )}

            {activeTab === 'Logistics' && (
              <LogisticsTab
                header={header}
                onHeaderChange={handleHeaderChange}
                effectiveWhseAddrs={effectiveWhseAddrs}
                vendorPayToAddresses={vendorPayToAddresses}
                vendorShipToAddresses={vendorEffectiveShipToAddresses}
                vendorBillToAddresses={vendorEffectiveBillToAddresses}
                shipTypeOpts={shipTypeOpts}
                onOpenAddressModal={openAddressModal}
                isEditable={isDocumentEditable}
              />
            )}

            {activeTab === 'Accounting' && (
              <AccountingTab
                header={header}
                onHeaderChange={handleHeaderChange}
                payTermOpts={payTermOpts}
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

            {/* Continue in next part... */}

            {/* ══ TOTALS FOOTER ═════════════════════════════════════════════ */}
            <div className="del-header-card">
              <div className="del-field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div className="del-field">
                    <label className="del-field__label">Sales Employee</label>
                    <select name="purchaser" className="del-field__select" value={header.purchaser || ''} onChange={handleHeaderChange} disabled={!isDocumentEditable}>
                      <option value="">No Sales Employee / Buyer</option>
                      {effectiveSalesEmployees.map((employee) => (
                        <option key={employee.SlpCode ?? employee.SlpName} value={employee.SlpName || ''}>
                          {employee.SlpName || ''}
                        </option>
                      ))}
                      <option value="__DEFINE_NEW__">Define New</option>
                    </select>
                  </div>
                  <div className="del-field">
                    <label className="del-field__label">Owner</label>
                    <input name="owner" className="del-field__input" value={header.owner || ''} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                  </div>
                  <div className="del-field">
                    <label className="del-field__label">Remarks</label>
                    <textarea className="del-textarea" rows={3} name="otherInstruction" value={header.otherInstruction} onChange={handleHeaderChange} disabled={!isDocumentEditable} />
                  </div>
                </div>
                <div>
                  <div className="del-section-title">Tax Summary</div>
                  {totals.taxBreakdown.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      {totals.taxBreakdown.map(t => (
                        <div key={t.taxCode} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span>{t.taxCode} ({t.taxRate}%)</span>
                          <span>{fmtDec(t.taxAmount, numDec.tax)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="del-grid-wrap">
                    <table className="del-grid" style={{ marginTop: '8px' }}>
                      <tbody>
                        <tr>
                          <td>Total Before Discount</td>
                          <td className="del-grid__cell--num"><input className="del-grid__input" value={fmtDec(totals.subtotal, numDec.total)} readOnly /></td>
                        </tr>
                        <tr>
                          <td>Discount %</td>
                          <td className="del-grid__cell--num"><input className="del-grid__input" name="discount" value={header.discount} onChange={handleHeaderChange} onBlur={() => handleNumBlur('discount', 'header')} disabled={!isDocumentEditable} /></td>
                        </tr>
                        <tr>
                          <td>Freight</td>
                          <td className="del-grid__cell--num" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                              className="del-grid__input" 
                              name="freight" 
                              value={header.freight} 
                              onChange={handleHeaderChange} 
                              onBlur={() => handleNumBlur('freight', 'header')} 
                              style={{ flex: 1 }}
                              disabled={!isDocumentEditable}
                            />
                            <button
                              type="button"
                              onClick={openFreightModal}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                border: '1px solid #d0d7de',
                                borderRadius: '3px',
                                background: 'linear-gradient(180deg, #f6f8fa 0%, #e9ecef 100%)',
                                cursor: 'pointer',
                                minWidth: '24px'
                              }}
                              title="Select Freight Charge"
                              disabled={!isDocumentEditable}
                            >
                              🚚
                            </button>
                          </td>
                        </tr>
                        <tr>
                          <td><input type="checkbox" className="" name="rounding" checked={header.rounding} onChange={handleHeaderChange} style={{ marginRight: 6 }} disabled={!isDocumentEditable} /><span>Rounding</span></td>
                          <td></td>
                        </tr>
                        <tr>
                          <td>Tax</td>
                          <td className="del-grid__cell--num"><input className="del-grid__input" value={fmtDec(totals.taxAmt, numDec.tax)} readOnly /></td>
                        </tr>
                        {hasWTaxLiableLines && (
                          <tr>
                            <td>WTax Amount</td>
                            <td className="del-grid__cell--num" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input className="del-grid__input" value={fmtDec(wtaxAmount, numDec.tax)} readOnly style={{ flex: 1 }} />
                              <button
                                type="button"
                                onClick={openWithholdingTaxTable}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  border: '1px solid #d0d7de',
                                  borderRadius: '3px',
                                  background: 'linear-gradient(180deg, #f6f8fa 0%, #e9ecef 100%)',
                                  cursor: 'pointer',
                                  minWidth: '24px'
                                }}
                                title="Open Withholding Tax Table"
                                disabled={!isDocumentEditable}
                              >
                                ...
                              </button>
                            </td>
                          </tr>
                        )}
                        <tr style={{ borderTop: '2px solid #a0aab4' }}>
                          <td style={{ fontWeight: 700, color: '#003366' }}>Total Payment Due</td>
                          <td className="del-grid__cell--num" style={{ fontWeight: 700, color: '#003366' }}><input className="del-grid__input" style={{ fontWeight: 700, color: '#003366' }} value={fmtDec(totalPaymentDueAfterWTax, numDec.totalPaymentDue)} readOnly /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ ACTION BUTTONS ════════════════════════════════════════════ */}
            {false && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', marginBottom: '12px', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="del-btn del-btn--primary" disabled={pageState.posting || !isDocumentEditable}>
                  {secondaryActionLabel}
                </button>
                <button type="button" className="del-btn" onClick={resetForm}>
                  Cancel
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {/* Copy From Dropdown - SAP B1 style */}
                <div className="del-dropdown" style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    className="del-btn"
                    disabled={!isDocumentEditable || !!currentDocEntry}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setValErrors({ header: {}, lines: {}, form: '' });
                      setPageState(p => ({ ...p, error: '', success: '' }));
                      const dropdown = e.currentTarget.parentElement;
                      const isActive = dropdown.classList.contains('active');
                      document.querySelectorAll('.del-dropdown').forEach(d => d.classList.remove('active'));
                      if (!isActive) dropdown.classList.add('active');
                    }}
                  >
                    Copy From ▼
                  </button>
                  <div className="del-dropdown-menu">
                    {[
                      { key: 'salesQuotation', label: 'Sales Quotations' },
                      { key: 'salesOrder',     label: 'Sales Orders' },
                      { key: 'delivery',       label: 'Deliveries' },
                      { key: 'blanket',        label: 'Blanket Agreement' },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openCopyFromModal(opt.key);
                          document.querySelectorAll('.del-dropdown').forEach(d => d.classList.remove('active'));
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  type="button" 
                  className="del-btn"
                  onClick={() => handleCopyTo('arCreditMemo')}
                  disabled={!currentDocEntry}
                  title={!currentDocEntry ? 'Save the AR invoice first' : 'Copy this invoice to A/R Credit Memo'}
                >
                  Copy To
                </button>
              </div>
            </div>
            )}

          </div>{/* end main col */}

          <HeaderUdfSidebar
            className="so-layout__sidebar"
            isOpen={sidebarOpen}
            fields={visHdrUdfs}
            formSettings={formSettings}
            values={headerUdfs}
            disabled={!hasBuyerCode}
            onFieldChange={handleHeaderUdfChange}
            onClose={() => setSidebarOpen(false)}
          />
          <FormSettingsPanel
            variant="sidebar"
            className="so-layout__sidebar"
            isOpen={formSettingsOpen}
            onClose={() => setFormSettingsOpen(false)}
            matrixFields={matrixColumnDefinitions}
            headerUdfFields={headerUdfDefinitions}
            rowUdfFields={rowUdfDefinitions}
            formSettings={formSettings}
            onSettingChange={updateFormSetting}
          />
        </div>

      </fieldset>

      {/* Address Component Modal */}
      <AddressModal
        isOpen={!!addressModal}
        onClose={closeAddressModal}
        onSave={saveAddressModal}
        addressForm={addressForm}
        onFormChange={handleAddressFormChange}
        states={refData.states}
      />

      {/* Tax Information Modal */}
      <TaxInfoModal
        isOpen={taxInfoModal}
        onClose={closeTaxInfoModal}
        onSave={saveTaxInfoModal}
        taxInfoForm={taxInfoForm}
        onFormChange={handleTaxInfoFormChange}
      />

      {/* State Selection Modal */}
      <StateSelectionModal
        isOpen={stateModal}
        onClose={closeStateModal}
        onSelect={handleStateSelect}
        states={refData.states || []}
      />

      {/* Business Partner Selection Modal */}
      <BusinessPartnerModal
        isOpen={bpModal}
        onClose={closeBpModal}
        onSelect={handleBpSelect}
        businessPartners={refData.vendors || []}
      />

      {/* HSN Code Selection Modal */}
      <HSNCodeModal
        isOpen={hsnModal.open}
        onClose={closeHSNModal}
        onSelect={handleHSNSelect}
      />

      {/* Item Selection Modal */}
      <ItemSelectionModal
        isOpen={itemModal.open}
        onClose={closeItemModal}
        onSelect={handleItemSelect}
        items={itemModal.items}
        loading={itemModal.loading}
      />

      {/* Copy From Modal */}
      <CopyFromModal
        isOpen={copyFromModal}
        onClose={() => setCopyFromModal(false)}
        onCopy={handleCopyFrom}
        documentType={copyFromDocType}
        onFetchDocuments={fetchCopyFromDocuments}
        onFetchDocumentDetails={fetchCopyFromDocumentDetails}
      />

      <SalesEmployeeSetupModal
        isOpen={salesEmployeeSetup.open}
        rows={salesEmployeeSetup.rows}
        saving={salesEmployeeSetup.saving}
        onClose={closeSalesEmployeeSetup}
        onSave={saveSalesEmployeeSetup}
        onUpdateRow={updateSalesEmployeeSetupRow}
      />

      <WithholdingTaxTableModal
        isOpen={withholdingTax.open}
        onClose={() => setWithholdingTax((prev) => ({ ...prev, open: false }))}
        rows={withholdingModalRows}
        allowedCodes={withholdingTax.allowedCodes.length ? withholdingTax.allowedCodes : refData.withholding_tax_codes}
        baseAmount={wtaxBaseAmount}
        onRowsChange={(rows) => setWithholdingTax((prev) => ({
          ...prev,
          rows: recalcWithholdingRows(rows),
        }))}
      />

      {/* Freight Selection Modal */}
      <FreightChargesModal
        isOpen={freightModal.open}
        onClose={closeFreightModal}
        onApply={handleFreightApply}
        freightCharges={freightModal.freightCharges}
        taxCodes={effectiveTaxCodes}
        loading={freightModal.loading}
      />
      <LineValueLookupModal
        isOpen={lineLookupModal.open}
        onClose={closeLineLookup}
        onSelect={handleLineLookupSelect}
        options={lineLookupModal.options}
        title={lineLookupModal.title}
        searchPlaceholder={lineLookupModal.searchPlaceholder}
        emptyMessage={lineLookupModal.emptyMessage}
        allowCreate={false}
        columns={lineLookupModal.columns}
      />
    </form>
  );
}

export default ARInvoicePage;
