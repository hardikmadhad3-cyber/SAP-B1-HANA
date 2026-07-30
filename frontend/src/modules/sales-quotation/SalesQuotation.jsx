import React, { useEffect, useState, useCallback, useRef } from 'react';
import '../../modules/item-master/styles/itemMaster.css';
import './styles/SalesQuotation.css';
import { useLocation, useNavigate } from 'react-router-dom';
import FormSettingsPanel from '../../components/purchase-order/FormSettingsPanel';
import HeaderUdfSidebar from '../../components/purchase-order/HeaderUdfSidebar';
import ContentsTab from './components/ContentsTab';
import LogisticsTab from './components/LogisticsTab';
import AccountingTab from './components/AccountingTab';
import TaxTab from './components/TaxTab';
import ElectronicDocumentsTab from './components/ElectronicDocumentsTab';
import TransportTab from './components/TransportTab';
import AttachmentsTab from './components/AttachmentsTab';
import AddressModal from '../../components/document/AddressComponentModal';
import { formatAddressComponent, mapAddressFields, pickAddressComponentFields } from '../../utils/documentAddress';
import EWayBillModal from './components/EWayBillModal';
import TaxInfoModal from './components/TaxInfoModal';
import StateSelectionModal from '../../components/common/StateSelectionModal';
import BusinessPartnerModal from './components/BusinessPartnerModal';
import CopyFromModal from '../../components/document/CopyFromModal';
import CopyToDropdown from '../../components/document/CopyToDropdown';
import HSNCodeModal from '../../components/common/HSNCodeModal';
import ItemSelectionModal from '../../components/common/ItemSelectionModal';
import LineValueLookupModal from '../../components/sales-document/LineValueLookupModal';
import DocumentCurrencySelect from '../../components/document/DocumentCurrencySelect';
import PrintLayoutToolbar from '../../components/print-layout/PrintLayoutToolbar';
import FreightChargesModal from '../../components/freight/FreightChargesModal';
import { summarizeFreightRows } from '../../components/freight/freightUtils';
import { useSapWindowTaskbarActions } from '../../components/SapWindowTaskbarContext';
import useStandardDocumentDraftTask from '../../hooks/useStandardDocumentDraftTask';
import { determineTaxCode, recalculateAllTaxCodes, getGSTTypeLabel } from '../../utils/taxEngine';
import { filterWarehousesByBranch } from '../../utils/warehouseBranch';
import { hydrateDocumentLineFromItem, mergeItemMaster } from '../../utils/documentItemHydration';
import { FALLBACK_UOM, FALLBACK_WAREHOUSES } from '../../utils/fallbackReferenceData';
import { getDefaultSeriesForCurrentYear } from '../../utils/seriesDefaults';
import {
  SAP_MANUAL_SERIES_VALUE,
  isManualDocumentSeries,
  isValidManualDocumentNumber,
} from '../../utils/documentSeries';
import { useCompanyScopedFormSettings } from '../../utils/formSettingsStorage';
import { buildVisibleEnteredRowUdfPayload } from '../../utils/rowUdfPayload';
import { getStateCodeValue, getStateDisplayName } from '../../utils/stateDisplay';
import { findTaxCode, getTaxComponentCodes, taxCodeHasComponent } from '../../utils/taxCodeComponents';
import { copyToDocument } from '../../services/documentCopyService';
import { replaceRouteStatePreservingWindow } from '../../utils/copyToState';
import { duplicateDocumentInPlace } from '../../utils/documentDuplicate';
import useValidationHighlights from '../../utils/useValidationHighlights';
import useSalesEmployeeSetup from '../../hooks/useSalesEmployeeSetup';
import useSalesDocumentLineLookups from '../../hooks/useSalesDocumentLineLookups';
import SalesEmployeeSetupModal from '../../components/sales-employee/SalesEmployeeSetupModal';
import { useRelationshipMapRegistration } from '../../components/relationship-map/RelationshipMapHost';
import { useAuth } from '../../auth/AuthContext';
import { getDocumentLayout } from '../../api/sapLayoutApi';
import {
  SALES_QUOTATION_LAYOUT_DOCUMENT_TYPE,
  buildSalesOrderMatrixColumnsFromLayout,
} from '../sales-order/documentLayout';
import { hydrateWorkbookDocumentLine } from '../../utils/workbookLineHydration';
import {
  fetchSalesQuotationByDocEntry,
  fetchSalesQuotationCustomerDetails,
  fetchSalesQuotationReferenceData,
  submitSalesQuotation,
  updateSalesQuotation,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchItemsForModal,
  fetchFreightCharges,
  createSalesQuotationLookupValue,
  fetchOpenSalesQuotations,
  fetchSalesQuotationForCopy,
} from '../../api/salesQuotationApi';
import { normaliseDocumentHeader, normaliseDocumentLine, unwrapCopyFromDocument, BASE_TYPE } from '../../api/copyFromApi';
import { fetchHSNCodes, fetchHSNCodeFromItem } from '../../api/hsnCodeApi';
import {
  BASE_MATRIX_COLUMNS,
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  normalizeUdfState,
  readSavedFormSettings,
} from '../../config/salesQuotationForm';

// ─── helpers ─────────────────────────────────────────────────────────────────
const getErrMsg = (e, fb) => {
  const body = e?.response?.data || {};
  const d = body.detail || body.details;
  if (typeof d === 'string' && d.trim()) return d;
  if (d?.error?.message) return d.error.message;
  if (d?.message) return d.message;
  if (body.message) return d?.hint ? `${body.message} ${d.hint}` : body.message;
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
  buildingFloorRoom: address?.BuildingFloorRoom || address?.Building || '',
  block: address?.Block || '',
  city: address?.City || '',
  zipCode: address?.ZipCode || '',
  county: address?.County || '',
  state: address?.State || '',
  countryRegion: address?.Country || '',
  addressName2: address?.AddressName2 || address?.Address2 || '',
  addressName3: address?.AddressName3 || address?.Address3 || '',
  gln: address?.GlobalLocationNumber || address?.GlblLocNum || address?.GLN || '',
  erpAddress: address?.U_ERPAddress || address?.U_ERP_Address || address?.ERPAddress || '',
  contactPerson: address?.U_ContactPerson || address?.U_CONTACT_PERSON || address?.ContactPerson || '',
  mobile: address?.U_Mobile || address?.U_MOBILE || address?.Mobile || address?.MobilePhone || '',
  dateOfRegistration: address?.U_DateOfRegistration || address?.U_Date_Of_Registration || address?.DateOfRegistration || '',
  dateDetailsOfRegistration: address?.U_DateDetlOfReg || address?.U_Date_Detl_Of_Reg || address?.DateDetlOfReg || '',
  addressStatus: address?.U_Status || address?.AddressStatus || address?.Status || '',
  gstin: address?.GSTRegnNo || address?.GSTIN || address?.U_GSTIN_No || address?.U_GSTINNo || '',
  ...mapAddressFields(address),
});
const normalizeAddressText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
const TAB_NAMES = ['Contents', 'Logistics', 'Accounting', 'Tax', 'Transport', 'Electronic Documents', 'Attachments'];
const HEADER_VALIDATION_TABS = {
  shipToCode: 'Logistics',
  billToCode: 'Logistics',
};

const getValidationTab = (errors) => {
  if (Object.values(errors.lines || {}).some(lineErrors => Object.values(lineErrors || {}).some(Boolean))) {
    return 'Contents';
  }

  const headerField = Object.entries(errors.header || {}).find(([, message]) => Boolean(message))?.[0];
  return HEADER_VALIDATION_TABS[headerField] || 'Contents';
};

const createLine = (rowUdfDefinitions = ROW_UDF_DEFINITIONS) => ({
  itemNo: '', itemDescription: '', hsnCode: '', quantity: '', unitPrice: '',
  requiredDate: '', quotedDate: '', requiredQty: '',
  sacCode: '', uomCode: '', stdDiscount: '', taxCode: '', total: '', totalLC: '', whse: '',
  taxCodeManuallyOverridden: false,
  distRule: '', cogsDistRule: '', countryOfOrigin: '', loc: '', branch: '',
  blanketAgreementNo: '', allowProcurementDoc: false,
  saudaNodeRef: '', apInvDocKey: '', apInvDocNum: '', apInvLineNum: '',
  assessableValue: '', bedRate: '', bedAmount: '', rg23dNo: '',
  specialRebate: '', commission: '', sellerItem: '', sellerQty: '',
  sellerBrokeragePerQty: '',
  unitPriceUdf: '',
  sellerBrokerage: '', buyerBrokerage: '',
  buyerDelivery: '', sellerDelivery: '',
  buyerPaymentTerms: '', sellerPaymentTerms: '',
  buyerQuality: '', sellerQuality: '',
  buyerPrice: '', sellerPrice: '',
  buyerSpecialInstruction: '', sellerSpecialInstruction: '',
  sellerBrokerageAmtPer: '', sellerBrokeragePercent: '',
  buyerBillDiscount: '', sellerBillDiscount: '', stcode: '',
  freightPurchase: '', freightSales: '', freightProvider: '', freightProviderName: '',
  documentCreated: today(), brokerageNumber: '',
  udf: createUdfState(rowUdfDefinitions),
});

const INIT_HEADER = {
  vendor: '', name: '', contactPerson: '', salesContractNo: '', branch: '', warehouse: '',
  docNo: '', status: 'Open', series: '', nextNumber: '',
  postingDate: today(), deliveryDate: '', documentDate: today(), contractDate: '',
  branchRegNo: '', shipTo: '', shipToCode: '', payTo: '', payToCode: '',
  shippingType: '', confirmed: false, journalRemark: '', paymentTerms: '',
  paymentMethod: '', otherInstruction: '', discount: '', freight: '', tax: '',
  totalPaymentDue: '', rounding: false, owner: '', purchaser: '',
  placeOfSupply: '', currency: 'INR', useBillToForTax: false,
  billToAddress: '', billToCode: '', shipToAddress: '',
  shipToAddressComponents: null, billToAddressComponents: null,
};

const createInitialHeader = () => ({
  ...INIT_HEADER,
  postingDate: today(),
  documentDate: today(),
  deliveryDate: '',
  docNo: '',
  nextNumber: '',
  series: '',
  status: 'Open',
});

const resolveCurrencyCode = (currency, fallback = 'INR') => {
  const normalized = String(currency || '').trim();
  return normalized && normalized !== '##' ? normalized : fallback;
};

const isUomNameColumn = (column = {}) => {
  const tokens = [
    column.key,
    column.valueKey,
    column.rendererKey,
    column.sapField,
    column.fieldName,
    column.layoutFieldName,
    column.label,
  ].map((value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''));

  return tokens.some((token) => ['UOMNAME', 'UNITMSR'].includes(token));
};

const ensureSalesQuotationMatrixColumns = (columns = []) => {
  const safeColumns = Array.isArray(columns) ? columns.filter(Boolean) : [];
  const nextColumns = safeColumns.map((column) => ({
    ...column,
    sapControlled: true,
  }));

  if (nextColumns.some(isUomNameColumn)) return nextColumns;

  const quantityIndex = nextColumns.findIndex((column) => (
    String(column.key || column.valueKey || column.rendererKey || '').trim() === 'quantity'
  ));
  const orderBase = quantityIndex >= 0
    ? Number(nextColumns[quantityIndex].order || nextColumns[quantityIndex].columnOrder || quantityIndex + 1)
    : 4;
  const uomNameColumn = {
    key: 'uomName',
    valueKey: 'uomName',
    rendererKey: 'uomName',
    sapField: 'unitMsr',
    fieldName: 'unitMsr',
    layoutFieldName: 'unitMsr',
    label: 'UoM Name',
    visible: true,
    active: false,
    readOnly: true,
    minWidth: 120,
    width: 120,
    order: orderBase + 0.1,
    columnOrder: orderBase + 0.1,
    sapControlled: true,
    importedLayout: true,
    source: 'sales-quotation-required-column',
    type: 'text',
  };

  return [
    ...nextColumns.slice(0, quantityIndex >= 0 ? quantityIndex + 1 : nextColumns.length),
    uomNameColumn,
    ...nextColumns.slice(quantityIndex >= 0 ? quantityIndex + 1 : nextColumns.length),
  ];
};

const INIT_ATTACH = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, targetPath: '', fileName: '', attachmentDate: '',
  freeText: '', copyToTargetDocument: '', documentType: '', atchDocDate: '', alert: '',
}));

const closeDocumentDropdowns = () => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
};

// ─── Main Component ───────────────────────────────────────────────────────────
function SalesQuotation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { company } = useAuth();
  const activeCompanyId = company?.companyId || '';
  const activeCompanyDb = company?.dbName || '';
  const { removeTask, upsertTask } = useSapWindowTaskbarActions();
  const requestedEditDocEntry = location.state?.salesQuotationDocEntry || location.state?.salesOrderDocEntry;
  const formRef = useRef(null);

  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [header, setHeader] = useState(INIT_HEADER);
  const [headerUdfDefinitions, setHeaderUdfDefinitions] = useState(HEADER_UDF_DEFINITIONS);
  const [rowUdfDefinitions, setRowUdfDefinitions] = useState(ROW_UDF_DEFINITIONS);
  const [matrixColumnDefinitions, setMatrixColumnDefinitions] = useState(BASE_MATRIX_COLUMNS);
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
    warehouses: [], warehouse_addresses: [], company_address: {}, tax_codes: [], hsn_codes: [],
    payment_terms: [], shipping_types: [], branches: [], uom_groups: [], sales_employees: [], owners: [],
    countries: [], distribution_rules: [], distribution_dimensions: [], quality_options: { buyer: [], seller: [] }, price_options: { buyer: [], seller: [] },
    company_currencies: { localCurrency: 'INR', systemCurrency: 'INR' },
    decimal_settings: DEC, warnings: [], series: [], states: [], udf_metadata: { header: [], rows: [] },
    line_field_metadata: { matrix_columns: BASE_MATRIX_COLUMNS, sap_form: {} },
    lookup_sources: {},
  });
  const [pageState, setPageState] = useState({ loading: false, vendorLoading: false, posting: false, error: '', success: '', seriesLoading: false });
  const [valErrors, setValErrors] = useState({ header: {}, lines: {}, form: '' });
  useValidationHighlights(valErrors, { rootRef: formRef });
  const [snapshotPending, setSnapshotPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [addressModal, setAddressModal] = useState(null);
  const [eWayBillModal, setEWayBillModal] = useState(false);
  const [eWayBillData, setEWayBillData] = useState({});
  const [taxInfoModal, setTaxInfoModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [bpModal, setBpModal] = useState(false);
  const [hsnModal, setHsnModal] = useState({ open: false, lineIndex: -1 });
  const [itemModal, setItemModal] = useState({ open: false, lineIndex: -1, items: [], loading: false });
  const [freightModal, setFreightModal] = useState({ open: false, freightCharges: [], loading: false });

  useStandardDocumentDraftTask({
    draftKey: 'salesQuotationDraft',
    title: 'Sales Quotation',
    draftValues: {
      currentDocEntry,
      header,
      lines,
      headerUdfs,
      activeTab,
      isDirty,
      freightCharges: freightModal.freightCharges,
    },
    restoreDraft: (draft) => {
      setCurrentDocEntry(draft.currentDocEntry || null);
      setHeader(draft.header || INIT_HEADER);
      setLines(Array.isArray(draft.lines) && draft.lines.length
        ? draft.lines
        : [createLine(ROW_UDF_DEFINITIONS)]);
      setHeaderUdfs(draft.headerUdfs || normalizeUdfState(HEADER_UDF_DEFINITIONS));
      setActiveTab(draft.activeTab || 'Contents');
      setIsDirty(Boolean(draft.isDirty));
      setFreightModal((prev) => ({
        ...prev,
        freightCharges: Array.isArray(draft.freightCharges) ? draft.freightCharges : [],
        loading: false,
      }));
    },
  });
  const [copyFromModal, setCopyFromModal] = useState(false);
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
  const {
    lineLookupModal,
    openQualityModal,
    openPaymentTermsModal,
    closeLineLookupModal,
    handleLineLookupSelect,
    handleLineLookupCreate,
  } = useSalesDocumentLineLookups({
    refData,
    setRefData,
    setLines,
    createLookupValue: createSalesQuotationLookupValue,
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.so-dropdown')) {
        closeDocumentDropdowns();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // decimal config
  const dec = { ...DEC, ...(refData.decimal_settings || {}) };
  const numDec = {
    quantity: Number(dec.QtyDec), unitPrice: Number(dec.PriceDec),
    requiredQty: Number(dec.QtyDec),
    unitPriceUdf: Number(dec.PriceDec),
    sellerQty: Number(dec.QtyDec),
    sellerBrokeragePerQty: Number(dec.PriceDec),
    assessableValue: Number(dec.SumDec),
    bedRate: Number(dec.PercentDec),
    bedAmount: Number(dec.SumDec),
    specialRebate: Number(dec.PercentDec),
    commission: Number(dec.PercentDec),
    sellerBrokerage: Number(dec.SumDec),
    buyerBrokerage: Number(dec.SumDec),
    sellerBrokeragePercent: Number(dec.PercentDec),
    buyerBillDiscount: Number(dec.PercentDec),
    sellerBillDiscount: Number(dec.PercentDec),
    freightPurchase: Number(dec.SumDec),
    freightSales: Number(dec.SumDec),
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
  const isUpdateMode = Boolean(currentDocEntry);
  const hasUnsavedChanges = Boolean(currentDocEntry && isDirty);
  const updateActionLabel = hasUnsavedChanges ? 'Update' : 'OK';
  const resolvePreferredSeries = (seriesList, postingDateValue, selectedSeries = '') => {
    if (!Array.isArray(seriesList) || !seriesList.length) return null;

    const normalizedSeries = String(selectedSeries || '').trim();
    const matchedSeries = normalizedSeries
      ? seriesList.find((series) => String(series.Series) === normalizedSeries)
      : null;

    if (matchedSeries) return matchedSeries;

    const seriesDate = postingDateValue ? new Date(`${postingDateValue}T00:00:00`) : new Date();
    return getDefaultSeriesForCurrentYear(seriesList, seriesDate) || seriesList[0];
  };
  const resolveSalesQuotationAddress = useCallback((code, addresses = [], fallbackText = '') => {
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
  const primaryActionLabel = pageState.posting
    ? 'Saving...'
    : isUpdateMode
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
        if (!activeCompanyId) {
          setHeaderUdfDefinitions([]);
          setRowUdfDefinitions([]);
          setMatrixColumnDefinitions(BASE_MATRIX_COLUMNS);
          setHeaderUdfs({});
          setLines([createLine([])]);
          setRefData(prev => ({
            ...prev,
            company: '',
            vendors: [], contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [],
            items: [], warehouses: [], warehouse_addresses: [], company_address: {}, tax_codes: [], hsn_codes: [],
            payment_terms: [], shipping_types: [], branches: [], states: [], uom_groups: [], sales_employees: [], owners: [],
            countries: [], distribution_rules: [], distribution_dimensions: [], quality_options: { buyer: [], seller: [] }, price_options: { buyer: [], seller: [] },
            company_currencies: { localCurrency: 'INR', systemCurrency: 'INR' },
            udf_metadata: { header: [], rows: [] },
            line_field_metadata: { matrix_columns: BASE_MATRIX_COLUMNS, sap_form: {} },
            lookup_sources: {},
          }));
          return;
        }

        setMatrixColumnDefinitions([]);

        const [refDataRes, hsnRes, layoutRes] = await Promise.all([
          fetchSalesQuotationReferenceData(activeCompanyId),
          fetchHSNCodes(),
          getDocumentLayout({
            companyDb: activeCompanyDb || undefined,
            documentType: SALES_QUOTATION_LAYOUT_DOCUMENT_TYPE,
            objectType: '23',
          }).catch((error) => ({
            data: {
              success: false,
              columns: [],
              warning: getErrMsg(error, 'Failed to load SAP layout.'),
            },
          })),
        ]);
        
        // ═══ LOGGING: Reference Data ═══
        console.log('═══════════════════════════════════════════════════');
        console.log('📚 Reference Data Loaded:');
        console.log('  - Vendors/Customers:', refDataRes.data.vendors?.length || 0);
        console.log('  - Items:', refDataRes.data.items?.length || 0);
        console.log('  - Tax Codes:', refDataRes.data.tax_codes?.length || 0);
        console.log('  - Warehouses:', refDataRes.data.warehouses?.length || 0);
        console.log('  - Payment Terms:', refDataRes.data.payment_terms?.length || 0);
        console.log('  - Shipping Types:', refDataRes.data.shipping_types?.length || 0);
        console.log('  - Branches:', refDataRes.data.branches?.length || 0);
        console.log('  - States:', refDataRes.data.states?.length || 0);
        console.log('  - Series:', refData.series?.length || 0);
        console.log('  - HSN Codes:', hsnRes.data?.length || 0);
        console.log('  - Sales Employees:', refDataRes.data.sales_employees?.length || 0);
        console.log('  - Owners:', refDataRes.data.owners?.length || 0);
        console.log('───────────────────────────────────────────────────');
        console.log('🏢 Company Address:', refDataRes.data.company_address);
        console.log('⚙️  Decimal Settings:', refDataRes.data.decimal_settings);
        console.log('⚠️  Warnings:', refDataRes.data.warnings);
        console.log('───────────────────────────────────────────────────');
        console.log('💰 TAX CODES LOADED:');
        (refDataRes.data.tax_codes || []).forEach(tc => {
          console.log(`  ${tc.Code} - ${tc.Name} (Rate: ${tc.Rate}%, Type: ${tc.GSTType || 'N/A'})`);
        });
        if (refDataRes.data.sales_employees && refDataRes.data.sales_employees.length > 0) {
          console.log('👥 SALES EMPLOYEES LOADED:');
          refDataRes.data.sales_employees.forEach(emp => {
            console.log(`  ${emp.SlpName} (Code: ${emp.SlpCode})`);
          });
        }
        if (refDataRes.data.owners && refDataRes.data.owners.length > 0) {
          console.log('👤 OWNERS LOADED:');
          refDataRes.data.owners.forEach(owner => {
            console.log(`  ${owner.FullName} (empID: ${owner.empID})`);
          });
        }
        console.log('═══════════════════════════════════════════════════');
        
        if (!ignore) {
          const nextHeaderUdfs = refDataRes.data.udf_metadata?.header || [];
          const nextRowUdfs = refDataRes.data.udf_metadata?.rows || [];
          const liveMatrixColumns = refDataRes.data.line_field_metadata?.matrix_columns?.length
            ? refDataRes.data.line_field_metadata.matrix_columns
            : BASE_MATRIX_COLUMNS;
          const nextMatrixColumns = ensureSalesQuotationMatrixColumns(buildSalesOrderMatrixColumnsFromLayout({
            layoutColumns: layoutRes?.data?.columns || [],
            liveMatrixColumns,
            rowUdfFields: nextRowUdfs,
            includeLineNumber: false,
          }));
          setHeaderUdfDefinitions(nextHeaderUdfs);
          setRowUdfDefinitions(nextRowUdfs);
          setMatrixColumnDefinitions(nextMatrixColumns);
          setHeaderUdfs((prev) => normalizeUdfState(nextHeaderUdfs, prev));
          setLines((prev) => prev.map((line) => ({
            ...line,
            udf: normalizeUdfState(nextRowUdfs, line.udf || {}),
          })));
          setFormSettings(readSavedFormSettings(nextHeaderUdfs, nextRowUdfs, nextMatrixColumns, formSettingsStorageKey));
          setRefData(prev => ({
            ...prev,
            company: refDataRes.data.company || '',
            vendors: refDataRes.data.vendors || [],
            contacts: refDataRes.data.contacts || [],
            pay_to_addresses: refDataRes.data.pay_to_addresses || [],
            ship_to_addresses: refDataRes.data.ship_to_addresses || [],
            bill_to_addresses: refDataRes.data.bill_to_addresses || [],
            items: refDataRes.data.items || [],
            warehouses: refDataRes.data.warehouses || [],
            warehouse_addresses: refDataRes.data.warehouse_addresses || [],
            company_address: refDataRes.data.company_address || {},
            tax_codes: refDataRes.data.tax_codes || [],
            hsn_codes: hsnRes.data || [],
            payment_terms: refDataRes.data.payment_terms || [],
            shipping_types: refDataRes.data.shipping_types || [],
            branches: refDataRes.data.branches || [],
            states: refDataRes.data.states || [],
            uom_groups: refDataRes.data.uom_groups || [],
            sales_employees: refDataRes.data.sales_employees || [],
            owners: refDataRes.data.owners || [],
            countries: refDataRes.data.countries || [],
            distribution_rules: refDataRes.data.distribution_rules || [],
            quality_options: refDataRes.data.quality_options || { buyer: [], seller: [] },
            price_options: refDataRes.data.price_options || { buyer: [], seller: [] },
            company_currencies: refDataRes.data.company_currencies || { localCurrency: 'INR', systemCurrency: 'INR' },
            decimal_settings: { ...DEC, ...(refDataRes.data.decimal_settings || {}) },
            warnings: [
              ...(refDataRes.data.warnings || []),
              ...(layoutRes?.data?.warning ? [layoutRes.data.warning] : []),
            ],
            udf_metadata: refDataRes.data.udf_metadata || { header: [], rows: [] },
            line_field_metadata: {
              ...(refDataRes.data.line_field_metadata || { sap_form: {} }),
              matrix_columns: nextMatrixColumns,
              imported_layout: layoutRes?.data || null,
            },
            lookup_sources: refDataRes.data.lookup_sources || {},
            series: Array.isArray(prev.series) ? prev.series : [],
          }));
        }
      } catch (e) {
        console.error('❌ Error loading reference data:', e);
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load reference data.') }));
      } finally {
        if (!ignore) setPageState(p => ({ ...p, loading: false }));
      }
    };
    load();
    return () => { ignore = true; };
  }, [activeCompanyDb, activeCompanyId, formSettingsStorageKey]);

  // ── load existing order ───────────────────────────────────────────────────
  useEffect(() => {
    if (currentDocEntry) return;

    const seriesDate = String(header.postingDate || '').trim();
    if (!seriesDate) {
      setRefData(prev => ({ ...prev, series: [] }));
      setHeader(prev => ({ ...prev, series: '', nextNumber: '' }));
      return;
    }

    let ignore = false;

    const loadSeriesForPostingDate = async () => {
      try {
        const seriesResponse = await fetchDocumentSeries(seriesDate);
        const availableSeries = seriesResponse.data?.series || [];

        if (ignore) return;

        setRefData(prev => ({ ...prev, series: availableSeries }));

        if (isManualDocumentSeries(header.series)) return;

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
  }, [currentDocEntry, header.postingDate]);

  useEffect(() => {
    const docEntry = requestedEditDocEntry;
    if (!docEntry) return;
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const r = await fetchSalesQuotationByDocEntry(docEntry);
        const so = r.data.sales_quotation;
        let editSeries = [];
        try {
          const seriesDate = so?.header?.postingDate || so?.header?.documentDate || '';
          const seriesResponse = await fetchDocumentSeries(seriesDate);
          editSeries = seriesResponse.data?.series || [];
        } catch (_seriesError) {
          editSeries = [];
        }
        
        
        if (ignore || !so) return;
        setCurrentDocEntry(so.doc_entry || Number(docEntry));
        
        // Get warehouse from first line if available
        const firstLineWarehouse = so.lines && so.lines.length > 0 ? so.lines[0].whse : '';
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

        const newHeader = {
          ...INIT_HEADER,
          vendor: so.header?.customerCode || '',
          contactPerson: so.header?.contactPerson || '',
          name: so.header?.customerName || '',
          paymentTerms: so.header?.paymentTermsCode || so.header?.paymentTerms || '',
          placeOfSupply: so.header?.placeOfSupply || '',
          branch: so.header?.branch || '',
          series: so.header?.series || '',
          warehouse: firstLineWarehouse || so.header?.warehouse || '',
          discount: so.header?.discount || '',
          freight: so.header?.freight || '',
          tax: so.header?.tax || '',
          // Sales Employee - use CODE not name
          salesEmployee: so.header?.salesEmployee || '',
          purchaser: so.header?.purchaser || '',  // This is the NAME for display
          // Owner - use name (frontend uses name in dropdown)
          owner: so.header?.owner || '',
          // Remarks - map to otherInstruction
          remarks: so.header?.remarks || '',
          otherInstruction: so.header?.otherInstruction || so.header?.remarks || '',
          // Map backend address field names to frontend field names
          shipToCode: so.header?.shipToCode || '',
          shipToAddress: so.header?.shipTo || '',
          shipToAddressComponents: so.header?.shipToAddressComponents || null,
          billToCode: so.header?.payToCode || '',
          billToAddress: so.header?.payTo || '',
          billToAddressComponents: so.header?.billToAddressComponents || null,
          // Copy all other fields from backend
          postingDate: so.header?.postingDate || '',
          deliveryDate: so.header?.deliveryDate || '',
          documentDate: so.header?.documentDate || '',
          customerRefNo: so.header?.customerRefNo || '',
          docNo: String(so.header?.docNum || so.header?.docNo || ''),
          nextNumber: String(so.header?.docNum || so.header?.docNo || ''),
          status: so.header?.status || '',
          shippingType: so.header?.shippingType || '',
          confirmed: so.header?.confirmed || false,
          journalRemark: so.header?.journalRemark || '',
          currency: so.header?.currency || 'INR',
        };
        
        console.log('📥 Final header state:', newHeader);
        setHeader(newHeader);
        setLines(
          Array.isArray(so.lines) && so.lines.length
            ? so.lines.map((line) => {
                const hydratedLine = hydrateWorkbookDocumentLine({
                  line,
                  createLine,
                  rowUdfDefinitions,
                  normalizeUdfState,
                  items: refData.items,
                });
                const savedTaxCode = String(
                  hydratedLine.taxCode ||
                  hydratedLine.taxCodeRepeat ||
                  line.taxCode ||
                  line.taxCodeRepeat ||
                  line.TaxCode ||
                  line.VatGroup ||
                  ''
                ).trim();
                return {
                  ...hydratedLine,
                  taxCode: savedTaxCode,
                  taxCodeRepeat: savedTaxCode,
                  taxCodeManuallyOverridden: Boolean(savedTaxCode),
                };
              })
            : [createLine(rowUdfDefinitions)]
        );
        setHeaderUdfs(normalizeUdfState(headerUdfDefinitions, so.header_udfs || {}));
        setSnapshotPending(true);
        setIsDirty(false);
        
        if (so.header?.customerCode) {
          loadVendorDetails(so.header.customerCode);
        }
        setPageState(p => ({ ...p, success: so.doc_num ? `Sales Quotation ${so.doc_num} loaded.` : 'Sales Quotation loaded.' }));
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load Sales Quotation.') }));
      } finally {
        if (!ignore) {
          setPageState(p => ({ ...p, loading: false }));
          replaceRouteStatePreservingWindow(navigate, location.pathname, location.state);
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

  // ── derived / computed ────────────────────────────────────────────────────
  const vendorContacts = refData.contacts.filter(c => String(c.CardCode || '') === String(header.vendor || ''));
  const contactOptions = header.contactPerson && !vendorContacts.some(c => String(c.CntctCode || '') === String(header.contactPerson || ''))
    ? [{ CardCode: header.vendor, CntctCode: header.contactPerson, Name: header.contactPerson }, ...vendorContacts]
    : vendorContacts;
  const vendorPayToAddresses = refData.pay_to_addresses.filter(a => String(a.CardCode || '') === String(header.vendor || ''));
  const vendorShipToAddresses = refData.ship_to_addresses.filter(a => String(a.CardCode || '') === String(header.vendor || ''));
  const vendorBillToAddresses = refData.bill_to_addresses.filter(a => String(a.CardCode || '') === String(header.vendor || ''));
  const vendorEffectiveShipToAddresses = vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses;
  const vendorEffectiveBillToAddresses = vendorBillToAddresses.length ? vendorBillToAddresses : vendorPayToAddresses;
  const selectedBranch = refData.branches.find(b => String(b.BPLId || '') === String(header.branch || ''));
  const uomGroupMap = (refData.uom_groups || []).reduce((acc, g) => { acc[g.AbsEntry] = g.uomCodes || []; return acc; }, {});

  const effectiveTaxCodes = refData.tax_codes || [];
  const effectiveWarehouses = refData.warehouses.length ? refData.warehouses : FALLBACK_WAREHOUSES;
  const freightTotals = summarizeFreightRows(freightModal.freightCharges, effectiveTaxCodes);
  
  // Filter warehouses by selected branch
  const branchFilteredWarehouses = filterWarehousesByBranch(effectiveWarehouses, header.branch);
  
  const payTermOpts = refData.payment_terms.length
    ? refData.payment_terms.map(t => ({ value: String(t.GroupNum), label: t.PymntGroup }))
    : FALLBACK_PAYMENT_TERMS;
  const shipTypeOpts = refData.shipping_types.length
    ? refData.shipping_types.map(s => ({ value: String(s.TrnspCode), label: s.TrnspName }))
    : FALLBACK_SHIPPING;

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

  const lineItemOptions = lines.reduce((acc, line, i) => {
    const code = String(line.itemNo || '').trim();
    const exists = refData.items.some(it => String(it.ItemCode || '') === code);
    acc[i] = code && !exists ? [{ ItemCode: code, ItemName: line.itemDescription || code }, ...refData.items] : refData.items;
    return acc;
  }, {});

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
  const calcLineTotal = (line) => {
    const qty = parseNum(line.quantity), price = parseNum(line.unitPrice), disc = parseNum(line.stdDiscount);
    return roundTo(qty * price * (1 - disc / 100), numDec.total);
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
  useRelationshipMapRegistration({
    enabled: Boolean(currentDocEntry),
    objectType: 23,
    docEntry: currentDocEntry,
    header,
    total: totals.total,
  });

  // ── GST determination logic ───────────────────────────────────────────────
  const determineGSTType = (gstState) => {
    if (!gstState) return 'IGST';

    // Get company state (assuming it's stored in refData.company or we need to get it)
    const companyState = refData.company_address?.State || '';

    if (gstState === companyState) {
      return 'CGST_SGST'; // CGST + SGST
    } else {
      return 'IGST';
    }
  };

  const getApplicableTaxCode = (gstType, itemTaxRate = 18) => {
    // Find tax codes based on GST type
    const taxCodes = effectiveTaxCodes.filter(code => {
      const rate = Number(code.Rate || 0);
      const gstTypeValue = String(code.GSTType || '').trim().toUpperCase();
      
      if (gstType === 'CGST_SGST') {
        if (gstTypeValue === 'INTRASTATE' && Math.abs(rate - itemTaxRate) < 0.01) {
          return true;
        }
        // For CGST+SGST, we need CGST or SGST with half the rate
        const halfRate = itemTaxRate / 2;
        return (
          taxCodeHasComponent(effectiveTaxCodes, code.Code, 'CGST')
          || taxCodeHasComponent(effectiveTaxCodes, code.Code, 'SGST')
        ) && Math.abs(rate - halfRate) < 0.01;
      } else if (gstType === 'IGST') {
        if (gstTypeValue === 'INTERSTATE' && Math.abs(rate - itemTaxRate) < 0.01) {
          return true;
        }
        // For IGST, we need IGST with full rate
        return taxCodeHasComponent(effectiveTaxCodes, code.Code, 'IGST') && Math.abs(rate - itemTaxRate) < 0.01;
      }
      return false;
    });

    // Return the first matching tax code
    return taxCodes.length > 0 ? taxCodes[0].Code : '';
  };

  // ── address sync ──────────────────────────────────────────────────────────
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
      
      // Validate warehouse-branch assignment
      if (header.branch) {
        const selectedWarehouse = refData.warehouses.find(w => w.WhsCode === header.warehouse);
        if (selectedWarehouse && selectedWarehouse.BranchID && 
            String(selectedWarehouse.BranchID) !== String(header.branch)) {
          console.warn(`⚠️ Warehouse "${header.warehouse}" is assigned to Branch ${selectedWarehouse.BranchID}, but document is for Branch ${header.branch}`);
          setPageState(p => ({ 
            ...p, 
            error: `Warning: Warehouse "${header.warehouse}" is assigned to a different branch. This may cause submission errors.` 
          }));
        }
      }
    }
  }, [header.warehouse, header.branch, refData.warehouses]);

  // ── Recalculate Tax Codes on State/Address Changes ────────────────────────
  useEffect(() => {
    if (currentDocEntry) return;
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
      lineCount: lines.filter(l => l.itemNo).length
    });

    // Recalculate tax codes for all lines with items
    const recalculatedLines = recalculateAllTaxCodes(
      lines,
      refData.items,
      header.placeOfSupply,  // shipToState
      header.placeOfSupply,  // billToState
      false,                 // useBillToForTax
      companyState,
      effectiveTaxCodes
    );
    const updatedLines = recalculatedLines.map((line, index) => (
      lines[index]?.taxCodeManuallyOverridden ? lines[index] : line
    ));

    setLines(updatedLines);
  }, [currentDocEntry, header.placeOfSupply, header.vendor, refData.company_address, selectedBranch]);

  useEffect(() => {
    if (!header.vendor) return;
    
    // Only run once when vendor changes or addresses are loaded
    if (header.billToCode || header.shipToCode) return; // Already set

    setHeader(prev => {
      let updates = {};

      const billToList = vendorEffectiveBillToAddresses;
      const shipToList = vendorEffectiveShipToAddresses;
      
      // Skip if no addresses available yet
      if (billToList.length === 0 && shipToList.length === 0) return prev;

      // Set default Bill-To address
      const defaultBillTo = billToList.find(a => String((a.AddressType || a.AdresType || '').toUpperCase()).includes('B')) || billToList[0];
      if (defaultBillTo && !prev.billToCode) {
        updates.billToCode = defaultBillTo.Address || '';
        updates.billToAddress = fmtAddr(defaultBillTo);
      }

      // Set default Ship-To address
      const defaultShipTo = shipToList.find(a => String((a.AddressType || a.AdresType || '').toUpperCase()).includes('S')) || shipToList[0];
      if (defaultShipTo && !prev.shipToCode) {
        updates.shipToCode = defaultShipTo.Address || '';
        updates.shipToAddress = fmtAddr(defaultShipTo);
      } else if (defaultBillTo && !prev.shipToCode) {
        // If no dedicated ship-to present, use bill-to as ship-to fallback
        updates.shipToCode = defaultBillTo.Address || '';
        updates.shipToAddress = fmtAddr(defaultBillTo);
      }

      // Update Place of Supply from Ship-To (or Bill-To fallback)
      const posAddress = defaultShipTo || defaultBillTo;
      if (posAddress && !prev.placeOfSupply) {
        updates.placeOfSupply = posAddress.State || '';
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        return { ...prev, ...updates };
      }
      return prev;
    });
  }, [header.vendor, refData.pay_to_addresses, refData.ship_to_addresses, refData.bill_to_addresses]);

  // Update GST when addresses or place of supply changes
  useEffect(() => {
    if (currentDocEntry) return;
    if (!header.vendor || !header.placeOfSupply) return;

    const gstType = determineGSTType();
    console.log('Auto-updating tax codes based on GST type:', gstType);

    // Update tax codes for all lines that have items
    setLines(prevLines =>
      prevLines.map(line => {
        if (!line.itemNo || line.taxCodeManuallyOverridden) return line; // Skip empty or preserved lines
        
        // Get item's default tax rate (assume 18% if not specified)
        const item = refData.items.find(it => String(it.ItemCode || '') === String(line.itemNo || ''));
        const itemTaxRate = item?.TaxRate || 18;
        
        const applicableTaxCode = getApplicableTaxCode(gstType, itemTaxRate);
        
        return {
          ...line,
          taxCode: applicableTaxCode || line.taxCode
        };
      })
    );
  }, [currentDocEntry, header.placeOfSupply, header.vendor]);

  // ── vendor details ────────────────────────────────────────────────────────
  const loadVendorDetails = async (code) => {
    if (!code) {
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
      return;
    }

    setPageState(p => ({ ...p, vendorLoading: true }));

    try {
      const r = await fetchSalesQuotationCustomerDetails(code);
    
      const contacts = r.data.contacts || [];
      setRefData(p => ({
        ...p,
        contacts: contacts,
        pay_to_addresses: r.data.pay_to_addresses || [],
        ship_to_addresses: r.data.ship_to_addresses || [],
        bill_to_addresses: r.data.bill_to_addresses || []
      }));

      if (contacts.length > 0) {
        setHeader(prev => ({
          ...prev,
          contactPerson: contacts[0].CntctCode
        }));
      }

    } catch (err) {
      console.error('❌ Error loading vendor details:', err);
      console.error('Error response:', err.response?.data);
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
    } finally {
      setPageState(p => ({ ...p, vendorLoading: false }));
    }
  };

  const syncVendor = (code, hdr) => {
    const m = refData.vendors.find(v => String(v.CardCode || '') === String(code || ''));
    if (!m) return { nextHeader: hdr };
    const localCurrency = refData.company_currencies?.localCurrency || hdr.currency || 'INR';
    return {
      nextHeader: {
        ...hdr,
        name: m.CardName || hdr.name,
        paymentTerms: m.PayTermsGrpCode != null ? String(m.PayTermsGrpCode) : hdr.paymentTerms,
        contactPerson: '',
        currency: resolveCurrencyCode(m.Currency, localCurrency),
      },
    };
  };

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleHeaderChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValErrors(p => ({ ...p, header: { ...p.header, [name]: '' }, form: '' }));
    setPageState(p => ({ ...p, error: '', success: '' }));
    
    if (name === 'series') {
      handleSeriesChange(value);
      return;
    }
    
    if (name === 'shipToCode') {
      handleShipToChange(value);
      return;
    }
    
    if (name === 'vendor') {
      setHeader(prev => {
        const prep = { ...prev, [name]: value };
        const { nextHeader } = syncVendor(value, prep);
        nextHeader.contactPerson = '';
        // Reset address fields when vendor changes
        nextHeader.billToCode = '';
        nextHeader.billToAddress = '';
        nextHeader.shipToCode = '';
        nextHeader.shipToAddress = '';
        nextHeader.placeOfSupply = '';
        return nextHeader;
      });
      loadVendorDetails(value);
      return;
    }

    if (name === 'billToCode') {
      handleBillToChange(value);
      return;
    }

    if (name === 'shipToCode') {
      handleShipToChange(value);
      return;
    }
    
    // ✅ FIX: When purchaser (Sales Employee name) changes, update salesEmployee (code) too
    if (name === 'purchaser') {
      if (value === '__DEFINE_NEW__') {
        openSalesEmployeeSetup();
        return;
      }
      // Find the SlpCode for the selected name
      const selectedEmployee = resolveSalesEmployeeByName(value);
      
      setHeader(p => ({
        ...p,
        purchaser: value,
        salesEmployee: selectedEmployee ? String(selectedEmployee.SlpCode) : '-1'
      }));
      
      console.log('🔄 Sales Employee changed:', {
        name: value,
        code: selectedEmployee ? selectedEmployee.SlpCode : '-1'
      });
      
      return;
    }
    
    if (numDec[name] !== undefined && type !== 'checkbox') {
      setHeader(p => ({ ...p, [name]: sanitize(value, numDec[name]) }));
      return;
    }
    setHeader(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };
  
  const handleShipToChange = (addressCode) => {
    if (!addressCode || !header.vendor) {
      setHeader(p => ({ ...p, shipToCode: addressCode, shipToAddress: '', placeOfSupply: '' }));
      return;
    }

    const addr = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === addressCode)
      || vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === addressCode);
    if (addr) {
      setHeader(p => ({
        ...p,
        shipToCode: addressCode,
        shipToAddress: fmtAddr(addr),
        placeOfSupply: addr.State || p.placeOfSupply || ''
      }));
    }
  };

  const handleBillToChange = (addressCode) => {
    if (!addressCode || !header.vendor) {
      setHeader(p => ({ ...p, billToCode: addressCode, billToAddress: '' }));
      return;
    }

    const addr = vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === addressCode)
      || vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === addressCode);
    if (addr) {
      setHeader(p => ({
        ...p,
        billToCode: addressCode,
        billToAddress: fmtAddr(addr),
        placeOfSupply: header.useBillToForTax ? addr.State || header.placeOfSupply : header.placeOfSupply
      }));
    }
  };
  
  const handleSeriesChange = async (seriesValue) => {
    if (!seriesValue) return;

    if (isManualDocumentSeries(seriesValue)) {
      setHeader(p => ({ ...p, series: SAP_MANUAL_SERIES_VALUE, nextNumber: '' }));
      setPageState(p => ({ ...p, seriesLoading: false, error: '', success: '' }));
      return;
    }
    
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

  const refreshAddModeSeries = async (postingDateValue = today(), selectedSeries = '') => {
    const seriesDate = String(postingDateValue || today()).trim();
    if (!seriesDate) {
      setRefData(prev => ({ ...prev, series: [] }));
      setHeader(prev => ({ ...prev, series: '', nextNumber: '' }));
      return;
    }

    try {
      const seriesResponse = await fetchDocumentSeries(seriesDate);
      const availableSeries = seriesResponse.data?.series || [];
      setRefData(prev => ({ ...prev, series: availableSeries }));

      const defaultSeries = resolvePreferredSeries(availableSeries, seriesDate, selectedSeries);
      if (defaultSeries?.Series != null) {
        await handleSeriesChange(defaultSeries.Series);
      } else {
        setHeader(prev => ({ ...prev, series: '', nextNumber: '' }));
      }
    } catch (e) {
      setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load document series.') }));
    }
  };

  const handleLineChange = async (i, e) => {
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
            if (next.taxCodeManuallyOverridden) {
              // Keep the tax code loaded from find mode or explicitly chosen by the user.
            } else if (!gstState || !companyState) {
              console.warn('⚠️ Missing state information for tax determination');
              next.taxCode = '';
            } else {
              // Step 6: Determine Tax Code using Tax Engine
              const determinedTaxCode = determineTaxCode(
                { ...item, TaxCodeAR: baseTaxCode },
                gstState,        // shipToState (using Place of Supply)
                gstState,        // billToState (same as POS for now)
                false,           // useBillToForTax (not used in current flow)
                companyState,
                effectiveTaxCodes
              );
              
              if (determinedTaxCode) {
                next.taxCode = determinedTaxCode;
                console.log('✅ Tax Code Auto-Selected:', {
                  gstType: getGSTTypeLabel(companyState, gstState),
                  taxCode: determinedTaxCode
                });
              } else {
                console.warn('⚠️ Could not determine tax code');
                next.taxCode = '';
              }
            }
            
            next.total = fmtDec(calcLineTotal(next), numDec.total);
            return next;
          }));
        }
      } catch (error) {
        console.error('❌ Error fetching HSN code:', error);
        // Fallback to reference data if API fails
        setLines(prev => prev.map((line, idx) => {
          if (idx !== i) return line;
          const next = { ...line, itemNo: value };
          const item = refData.items.find(it => String(it.ItemCode || '') === String(value || ''));
          if (item) {
            next.itemDescription = item.ItemName || next.itemDescription;
            next.uomCode = String(item.SalesUnit || item.InventoryUOM || '').trim();
            next.uomName = next.uomCode || next.uomName || '';
            next.hsnCode = item.SWW || item.HSNCode || item.U_HSNCode || next.hsnCode || '';
          }
          next.total = fmtDec(calcLineTotal(next), numDec.total);
          return next;
        }));
      }
    } else {
      // For non-itemNo changes, update synchronously
      setLines(prev => prev.map((line, idx) => {
        if (idx !== i) return line;
        const next = { ...line, [name]: numDec[name] !== undefined ? sanitize(value, numDec[name]) : value };
        if (name === 'taxCode') next.taxCodeManuallyOverridden = true;
        if (name === 'uomCode') next.uomName = value;
        next.total = fmtDec(calcLineTotal(next), numDec.total);
        return next;
      }));
    }
  };

  const handleNumBlur = (field, target = 'line', i = null) => {
    const d = numDec[field];
    if (d === undefined) return;
    if (target === 'header') { setHeader(p => ({ ...p, [field]: fmtDec(p[field], d) })); return; }
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: fmtDec(l[field], d) } : l));
  };

  const addLine = () => {
    // Validate the last line before adding a new one
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const lastIndex = lines.length - 1;
      const errors = {};
      
      // Check if last line has an item
      if (!String(lastLine.itemNo || '').trim()) {
        errors.itemNo = 'Item is required before adding a new line';
      }
      
      // Check if last line has quantity
      if (!lastLine.quantity || Number(lastLine.quantity) <= 0) {
        errors.quantity = 'Quantity is required before adding a new line';
      }
      
      // Check if last line has unit price
      if (!lastLine.unitPrice || Number(lastLine.unitPrice) <= 0) {
        errors.unitPrice = 'Unit Price is required before adding a new line';
      }
      
      // Check if last line has UoM
      if (!String(lastLine.uomCode || '').trim()) {
        errors.uomCode = 'UoM is required before adding a new line';
      }
      
      // Check if last line has HSN Code
      if (!String(lastLine.hsnCode || '').trim()) {
        errors.hsnCode = 'HSN Code is required before adding a new line';
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
    markDirty();
    setValErrors(p => { const nl = { ...p.lines }; delete nl[i]; return { ...p, lines: nl, form: '' }; });
    setLines(p => p.filter((_, idx) => idx !== i));
  };

  const handleHeaderUdfChange = (e, val) => {
    markDirty();
    // Support both direct key-value pairs (from Sidebar) and standard React events (from native inputs)
    if (typeof e === 'string') {
      setHeaderUdfs(p => ({ ...p, [e]: val }));
    } else if (e && e.target) {
      const { name, value, type, checked } = e.target;
      setHeaderUdfs(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    }
  };
  const handleRowUdfChange = (i, k, v) => {
    markDirty();
    setLines(p => p.map((l, idx) => idx === i ? { ...l, udf: { ...(l.udf || {}), [k]: v } } : l));
  };
  const updateFormSetting = (g, k, prop, val) => setFormSettings(p => ({ ...p, [g]: { ...(p[g] || {}), [k]: { ...((p[g] || {})[k] || {}), [prop]: val } } }));
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
    const shipAddress = resolveSalesQuotationAddress(
      header.shipToCode,
      vendorEffectiveShipToAddresses,
      header.shipToAddress || header.shipTo,
    );
    const billAddress = resolveSalesQuotationAddress(
      header.billToCode || header.payToCode,
      vendorEffectiveBillToAddresses,
      header.billToAddress || header.payTo,
    );
    const activeAddress = type === 'billTo' ? billAddress : shipAddress;
    const activeComponents = type === 'billTo'
      ? header.billToAddressComponents
      : header.shipToAddressComponents;

    setAddressForm(
      {
        ...mapAddressToModalForm(activeAddress, {
          shipToCode: header.shipToCode || shipAddress?.Address || '',
          shipToAddress: header.shipToAddress || header.shipTo || (shipAddress ? fmtAddr(shipAddress) : ''),
          billToCode: header.billToCode || header.payToCode || billAddress?.Address || '',
          billToAddress: header.billToAddress || header.payTo || (billAddress ? fmtAddr(billAddress) : ''),
        }),
        ...(activeComponents || {}),
      },
    );
    setAddressModal({ type });
  };

  const closeAddressModal = () => {
    setAddressModal(null);
  };

  const saveAddressModal = () => {
    const formatted = formatAddressComponent(addressForm);
    const components = pickAddressComponentFields(addressForm);
    markDirty();

    if (addressModal.type === 'shipTo') {
      setHeader(p => ({
        ...p,
        shipToCode: addressForm.shipToCode || p.shipToCode,
        shipToAddress: formatted,
        shipTo: formatted,
        shipToAddressComponents: components,
        billToCode: addressForm.billToCode || p.billToCode,
        payToCode: addressForm.billToCode || p.payToCode,
        billToAddress: addressForm.billToAddress || p.billToAddress,
        payTo: addressForm.billToAddress || p.payTo,
        placeOfSupply: addressForm.state || '',
      }));
    } else {
      setHeader(p => ({
        ...p,
        shipToCode: addressForm.shipToCode || p.shipToCode,
        shipToAddress: addressForm.shipToAddress || p.shipToAddress,
        shipTo: addressForm.shipToAddress || p.shipTo,
        billToCode: addressForm.billToCode || p.billToCode,
        payToCode: addressForm.billToCode || p.payToCode,
        billToAddress: formatted,
        payTo: formatted,
        billToAddressComponents: components,
        placeOfSupply: header.useBillToForTax ? addressForm.state || '' : p.placeOfSupply,
      }));
    }
    closeAddressModal();
  };

  const handleAddressFormChange = (e) => {
    const { name, value } = e.target;

    if (name === 'shipToCode') {
      const selectedAddress = resolveSalesQuotationAddress(value, vendorEffectiveShipToAddresses);
      setAddressForm(prev => {
        const nextState = {
          ...prev,
          shipToCode: value,
          shipToAddress: selectedAddress ? fmtAddr(selectedAddress) : prev.shipToAddress,
        };
        return addressModal?.type === 'shipTo'
          ? mapAddressToModalForm(selectedAddress, nextState)
          : nextState;
      });
      return;
    }

    if (name === 'billToCode') {
      const selectedAddress = resolveSalesQuotationAddress(value, vendorEffectiveBillToAddresses);
      setAddressForm(prev => {
        const nextState = {
          ...prev,
          billToCode: value,
          billToAddress: selectedAddress ? fmtAddr(selectedAddress) : prev.billToAddress,
        };
        return addressModal?.type === 'billTo'
          ? mapAddressToModalForm(selectedAddress, nextState)
          : nextState;
      });
      return;
    }

    setAddressForm(p => ({ ...p, [name]: value }));
  };

  // ── E-Way Bill Modal handlers ──────────────────────────────────────────────
  const openEWayBillModal = () => {
    setEWayBillModal(true);
  };

  const closeEWayBillModal = () => {
    setEWayBillModal(false);
  };

  const saveEWayBillModal = (data) => {
    setEWayBillData(data);
    console.log('E-Way Bill Data saved:', data);
  };

  // ── Tax Info Modal handlers ───────────────────────────────────────────────
  const openTaxInfoModal = () => {
    setTaxInfoModal(true);
  };

  const closeTaxInfoModal = () => {
    setTaxInfoModal(false);
  };

  const saveTaxInfoModal = () => {
    closeTaxInfoModal();
  };

  const handleTaxInfoFormChange = (e) => {
    const { name, value } = e.target;
    setTaxInfoForm(p => ({ ...p, [name]: value }));
  };

  // ── State Selection Modal handlers ────────────────────────────────────────
  const openStateModal = () => {
    setStateModal(true);
  };

  const closeStateModal = () => {
    setStateModal(false);
  };

  const handleStateSelect = (state) => {
    setHeader(p => ({ ...p, placeOfSupply: getStateCodeValue(state, refData.states) }));
  };

  // ── Business Partner Modal handlers ───────────────────────────────────────
  const openBpModal = () => {
    setBpModal(true);
  };

  const closeBpModal = () => {
    setBpModal(false);
  };

  const handleBpSelect = (bp) => {
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

  // ── HSN Code Modal handlers ───────────────────────────────────────────────
  const openHSNModal = (lineIndex) => {
    setHsnModal({ open: true, lineIndex });
  };

  const closeHSNModal = () => {
    setHsnModal({ open: false, lineIndex: -1 });
  };

  const handleHSNSelect = (hsn) => {
    if (hsnModal.lineIndex >= 0) {
      setLines(prev => prev.map((line, idx) => {
        if (idx === hsnModal.lineIndex) {
          return { ...line, hsnCode: hsn.code || '' };
        }
        return line;
      }));
    }
  };

  // ── Item Selection Modal handlers ─────────────────────────────────────────
  const openItemModal = async (lineIndex) => {
    console.log('🔍 Opening item modal for line:', lineIndex);
    const fallbackItems = Array.isArray(refData.items) ? refData.items : [];
    setItemModal({
      open: true,
      lineIndex,
      items: fallbackItems,
      loading: fallbackItems.length === 0,
    });
    
    try {
      console.log('📡 Fetching items from API...');
      const response = await fetchItemsForModal();
      const payload = response?.data;
      const normalizedItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      console.log('✅ Items received:', payload);
      console.log('📊 Items count:', normalizedItems.length);
      
      setItemModal((prev) => ({
        ...prev,
        items: normalizedItems.length > 0 ? normalizedItems : fallbackItems,
        loading: false,
      }));
    } catch (error) {
      console.error('❌ Failed to load items:', error);
      console.error('Error details:', error.response?.data || error.message);
      setItemModal((prev) => ({
        ...prev,
        items: prev.items.length > 0 ? prev.items : fallbackItems,
        loading: false,
      }));
    }
  };

  const closeItemModal = () => {
    setItemModal({ open: false, lineIndex: -1, items: [], loading: false });
  };

  const handleItemSelect = async (item) => {
    if (itemModal.lineIndex < 0) return;
    
    const lineIndex = itemModal.lineIndex;
    const mergedItem = mergeItemMaster(item, refData.items);
    
    try {
      // Fetch HSN code from database
      const hsnResponse = await fetchHSNCodeFromItem(mergedItem.ItemCode);
      const hsnData = hsnResponse.data;
      
      setLines(prev => prev.map((line, idx) => {
        if (idx !== lineIndex) return line;
        
        const next = hydrateDocumentLineFromItem(line, mergedItem, {
          side: 'sales',
          hsnCode: hsnData.hsnCode || hsnData.hsn_sww || '',
          fallbackWarehouse: header.warehouse,
          syncUnitPriceUdf: false,
          calcLineTotal,
          formatTotal: (value) => fmtDec(value, numDec.total),
        });
        next.uomName = next.uomCode || mergedItem.SalesUnit || mergedItem.InventoryUOM || next.uomName || '';
        
        // Auto-determine tax code
        const gstState = header.placeOfSupply;
        const companyState = refData.company_address?.State || selectedBranch?.State || '';
        
        if (!next.taxCodeManuallyOverridden && gstState && companyState) {
          const determinedTaxCode = determineTaxCode(
            mergedItem,
            gstState,
            gstState,
            false,
            companyState,
            effectiveTaxCodes
          );
          
          if (determinedTaxCode) {
            next.taxCode = determinedTaxCode;
          }
        }
        
        next.total = fmtDec(calcLineTotal(next), numDec.total);
        return next;
      }));
      
      closeItemModal();
    } catch (error) {
      console.error('Error selecting item:', error);
      // Still set basic item info even if HSN fetch fails
      setLines(prev => prev.map((line, idx) => {
        if (idx !== lineIndex) return line;
        const next = hydrateDocumentLineFromItem(line, mergedItem, {
          side: 'sales',
          hsnCode: mergedItem.HSNCode || '',
          fallbackWarehouse: header.warehouse,
          syncUnitPriceUdf: false,
          calcLineTotal,
          formatTotal: (value) => fmtDec(value, numDec.total),
        });
        next.uomName = next.uomCode || mergedItem.SalesUnit || mergedItem.InventoryUOM || next.uomName || '';
        return next;
      }));
      closeItemModal();
    }
  };

  // ── Freight Selection Modal handlers ──────────────────────────────────────
  const openFreightModal = async () => {
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

  // ── Copy From Handler ──────────────────────────────────────────────────────
  const openCopyFromModal = () => {
    if (currentDocEntry) return;

    const bpCode = String(header.vendor || '').trim();
    if (!bpCode) {
      setValErrors({ header: { vendor: 'Select Customer first' }, lines: {}, form: '' });
      setPageState(prev => ({ ...prev, error: '', success: '' }));
      return;
    }

    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(prev => ({ ...prev, error: '', success: '' }));
    setCopyFromModal(true);
  };

  const fetchCopyFromDocuments = async () => {
    const bpCode = String(header.vendor || '').trim();
    if (!bpCode) return [];
    const response = await fetchOpenSalesQuotations(bpCode);
    return response.data?.documents || [];
  };

  const fetchCopyFromDocumentDetails = async (_docType, docEntry) => {
    const response = await fetchSalesQuotationForCopy(docEntry);
    return response.data;
  };

  const handleCopyFrom = (documentData, docType = 'salesQuotation') => {
    console.log('Copying from:', docType, documentData);

    const copySource = unwrapCopyFromDocument(documentData);
    const normalizedHeader = normaliseDocumentHeader(copySource.header);
    const sourceHeaderUdfs = copySource.document?.header_udfs || copySource.source?.header_udfs || documentData?.header_udfs || {};
    const sourceFreightCharges = copySource.document?.freightCharges || copySource.source?.freightCharges || documentData?.freightCharges || [];
    const rawLines = copySource.lines;
    const baseEntry = copySource.docEntry || documentData?.baseDocument?.baseEntry || null;
    const baseType = BASE_TYPE[docType] || BASE_TYPE.salesQuotation;
    const firstLine = rawLines[0] || {};
    const firstLineWarehouse = firstLine.WarehouseCode || firstLine.WhsCode || firstLine.whse || '';

    setCurrentDocEntry(null);
    setHeader(prev => ({
      ...prev,
      vendor: normalizedHeader.vendor,
      name: normalizedHeader.name,
      contactPerson: normalizedHeader.contactPerson,
      placeOfSupply: normalizedHeader.placeOfSupply,
      paymentTerms: normalizedHeader.paymentTerms,
      branch: normalizedHeader.branch,
      warehouse: firstLineWarehouse || prev.warehouse,
      otherInstruction: normalizedHeader.otherInstruction || prev.otherInstruction,
      docNo: '',
      nextNumber: prev.nextNumber,
      status: 'Open',
    }));

    const copiedLines = rawLines.map((line, idx) => {
      const normalizedLine = normaliseDocumentLine(
        line,
        idx,
        baseEntry,
        baseType,
        normalizedHeader.branch
      );

      const nextLine = {
        ...createLine(rowUdfDefinitions),
        ...normalizedLine,
        baseType,
        baseEntry,
        baseLine: line.LineNum ?? line.lineNum ?? normalizedLine.baseLine ?? idx,
        udf: normalizeUdfState(rowUdfDefinitions, line.udf || {}),
      };

      return {
        ...nextLine,
        total: fmtDec(calcLineTotal(nextLine), numDec.total),
      };
    });

    setLines(copiedLines.length ? copiedLines : [createLine(rowUdfDefinitions)]);
    setHeaderUdfs(normalizeUdfState(headerUdfDefinitions, sourceHeaderUdfs));
    setFreightModal({ open: false, freightCharges: Array.isArray(sourceFreightCharges) ? sourceFreightCharges : [], loading: false });

    if (normalizedHeader.vendor) {
      loadVendorDetails(normalizedHeader.vendor);
    }

    setCopyFromModal(false);
    setPageState(p => ({ ...p, error: '', success: 'Copied from Sales Quotation. Please review and save.' }));
  };

  const handleCopyTo = async (targetType) => {
    await copyToDocument({
      sourceDocType: 'salesQuotation',
      targetType,
      sourceDocEntry: currentDocEntry,
      sourceDocNo: header.docNo,
      sourcePath: location.pathname,
      sourceSnapshot: { header, lines, headerUdfs },
      restoreState: { salesQuotationDocEntry: currentDocEntry },
      navigate,
      upsertTask,
      removeTask,
      beforeNavigate: closeDocumentDropdowns,
      setError: (message) => setPageState(p => ({ ...p, success: '', error: message })),
      errorMessage: pageState.loading
        ? 'Please wait until the sales quotation has finished loading before using Copy To.'
        : 'Open a saved sales quotation before using Copy To.',
    });
  };

  const handleDuplicate = async () => {
    const resetHeader = createInitialHeader();
    const duplicated = duplicateDocumentInPlace({
      currentDocEntry,
      header,
      initialHeader: resetHeader,
      lines: lines.map((line) => ({
        ...line,
        taxCodeManuallyOverridden: Boolean(String(line.taxCode || '').trim()),
      })),
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
      successMessage: 'Sales quotation duplicated. Review and add it as a new entry.',
    });

    if (duplicated) {
      setHeader(prev => ({
        ...prev,
        postingDate: resetHeader.postingDate,
        documentDate: resetHeader.documentDate,
        deliveryDate: resetHeader.deliveryDate,
        docNo: '',
        nextNumber: '',
        series: '',
        status: 'Open',
      }));
      await refreshAddModeSeries(resetHeader.postingDate);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleCopyFromLegacy = (documentData, docType) => {
    console.log('📋 Copying from:', docType, documentData);
    
    // Copy header
    setHeader(prev => ({
      ...prev,
      vendor: documentData.header.vendor,
      name: documentData.header.name,
      contactPerson: documentData.header.contactPerson,
      placeOfSupply: documentData.header.placeOfSupply,
      paymentTerms: documentData.header.paymentTerms,
      branch: documentData.header.branch,
    }));

    // Copy lines WITHOUT tax codes (will be recalculated)
    const copiedLines = documentData.lines.map(line => ({
      ...createLine(rowUdfDefinitions),
      ...line,
      taxCode: '', // DO NOT copy tax code - will be auto-determined
      baseType: documentData.baseDocument.baseType,
      baseEntry: documentData.baseDocument.baseEntry,
      baseLine: line.lineNum,
    }));

    setLines(copiedLines);
    
    // Load vendor details to trigger address and tax recalculation
    if (documentData.header.vendor) {
      loadVendorDetails(documentData.header.vendor);
    }
    
    setCopyFromModal(false);
  };

  // ── Browse Attachment handler ─────────────────────────────────────────────
  const handleBrowseAttachment = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      alert(`Selected ${files.length} file(s). Upload functionality to be implemented.`);
    };
    input.click();
  };

  // Continue in next part...

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const isUpdate = !!currentDocEntry;
    const e = { header: {}, lines: {}, form: '' };

    if (!isUpdate && isManualDocumentSeries(header.series) && !isValidManualDocumentNumber(header.nextNumber)) {
      e.header.nextNumber = 'Enter a positive document number for Manual series.';
      e.form = 'Please correct the highlighted fields.';
      return e;
    }
    
    if (!isUpdate) {
      const vc = String(header.vendor || '').trim();
      if (!vc) { e.header.vendor = 'Select a customer.'; e.form = 'Please correct the highlighted fields.'; return e; }
      
      // Validate Ship-To address (required for GST determination)
      if (!String(header.shipToCode || '').trim()) { 
        e.header.shipToCode = 'Ship-To address is required.'; 
        e.form = 'Please correct the highlighted fields.'; 
        return e; 
      }
      
      // Validate Bill-To address if GST override is enabled
      if (header.useBillToForTax && !String(header.billToCode || '').trim()) { 
        e.header.billToCode = 'Bill-To address is required when using Bill-To for tax.'; 
        e.form = 'Please correct the highlighted fields.'; 
        return e; 
      }
      
      // Validate Place of Supply (derived from addresses but required)
      if (!String(header.placeOfSupply || '').trim()) { 
        e.header.placeOfSupply = 'Place of supply is required.'; 
        e.form = 'Please correct the highlighted fields.'; 
        return e; 
      }
    }
    
    // Validate Warehouse (always required)
    if (!String(header.warehouse || '').trim()) { 
      e.header.warehouse = 'Warehouse is required.'; 
      e.form = 'Please correct the highlighted fields.'; 
      return e; 
    }
    

    
    if (!String(header.postingDate || '').trim()) { e.header.postingDate = 'Posting date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }
    if (!String(header.documentDate || '').trim()) { e.header.documentDate = 'Document date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }

    const pop = lines.filter(l => String(l.itemNo || '').trim());
    if (!pop.length) { e.form = 'Add at least one item line.'; return e; }
    
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!String(l.itemNo || '').trim()) continue;

      if (!l.itemNo) {
        e.lines[i] = { ...(e.lines[i] || {}), itemNo: 'Item is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.quantity || Number(l.quantity) <= 0) {
        e.lines[i] = { ...(e.lines[i] || {}), quantity: 'Quantity must be > 0' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.hsnCode && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), hsnCode: 'HSN Code is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if ((!l.unitPrice || Number(l.unitPrice) <= 0) && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), unitPrice: 'Unit Price must be > 0' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.uomCode && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), uomCode: 'UoM is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.whse && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), whse: 'Warehouse is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.taxCode || !String(l.taxCode).trim()) {
        e.lines[i] = { ...(e.lines[i] || {}), taxCode: 'Tax Code is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }
      
      const taxCodeExists = effectiveTaxCodes.some(t => String(t.Code) === String(l.taxCode));
      if (!taxCodeExists) {
        e.lines[i] = { ...(e.lines[i] || {}), taxCode: `Tax code '${l.taxCode}' is not valid in SAP B1` };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }
      
      const taxCodesUsed = new Set(pop.map(l => l.taxCode).filter(Boolean));
      const sgstCodes = getTaxComponentCodes(taxCodesUsed, effectiveTaxCodes, 'SGST');
      const cgstCodes = getTaxComponentCodes(taxCodesUsed, effectiveTaxCodes, 'CGST');

      if (sgstCodes.length > 0 && cgstCodes.length === 0) {
        e.form = 'SGST requires CGST to be applied as well';
        return e;
      }
      if (cgstCodes.length > 0 && sgstCodes.length === 0) {
        e.form = 'CGST requires SGST to be applied as well';
        return e;
      }
      if (sgstCodes.length > 0 && cgstCodes.length > 0) {
        const sgstRates = sgstCodes.map(code => {
          const tax = findTaxCode(effectiveTaxCodes, code);
          return tax ? parseNum(tax.Rate) : 0;
        });
        const cgstRates = cgstCodes.map(code => {
          const tax = findTaxCode(effectiveTaxCodes, code);
          return tax ? parseNum(tax.Rate) : 0;
        });
        if (sgstRates[0] !== cgstRates[0]) {
          e.form = 'SGST and CGST rates must be equal';
          return e;
        }
      }
    }

    return e;
  };

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!isDocumentEditable) {
      setPageState(p => ({ ...p, error: 'This document is closed and cannot be edited.', success: '' }));
      return;
    }
    if (currentDocEntry && !hasUnsavedChanges) return;
    const e = validate();
    if (e.form || Object.values(e.header).some(Boolean) || Object.values(e.lines).some(le => Object.values(le || {}).some(Boolean))) {
      setActiveTab(getValidationTab(e));
      setValErrors(e);
      setPageState(p => ({ ...p, error: e.form || 'Please correct the highlighted fields.', success: '' }));
      return;
    }
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, posting: true, error: '', success: '' }));
    try {
      const prep = { 
        ...header, 
        deliveryDate: header.deliveryDate || header.postingDate || header.documentDate,
        placeOfSupply: header.placeOfSupply,
        branch: header.branch,
        contactPerson: header.contactPerson,
        series: header.series ? Number(header.series) : undefined,
      };
      
      // Clean lines - remove any readonly/computed fields
      const cleanedLines = lines.map(line => ({
        lineNum: line.lineNum,
        itemNo: line.itemNo,
        itemDescription: line.itemDescription,
        hsnCode: line.hsnCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        uomCode: line.uomCode,
        stdDiscount: line.stdDiscount,
        taxCode: line.taxCode,
        total: line.total,
        whse: line.whse,
        loc: line.loc,
        branch: line.branch,
        baseEntry: line.baseEntry,
        baseType: line.baseType,
        baseLine: line.baseLine,
        udf: buildVisibleEnteredRowUdfPayload(rowUdfDefinitions, line.udf || {}, formSettings),
      }));
      
      const payload = {
        company_id: activeCompanyId,
        header: prep,
        lines: cleanedLines,
        freightCharges: freightModal.freightCharges,
        header_udfs: normalizeUdfState(headerUdfDefinitions, headerUdfs),
      };
      
      const r = currentDocEntry ? await updateSalesQuotation(currentDocEntry, payload) : await submitSalesQuotation(payload);
      const dn = r.data.doc_num ? ` Doc No: ${r.data.doc_num}.` : '';
      const resetHeader = createInitialHeader();
      setSnapshotPending(false);
      setIsDirty(false);
      setCurrentDocEntry(null); setHeader(resetHeader); setLines([createLine(rowUdfDefinitions)]);
      setFreightModal({ open: false, freightCharges: [], loading: false });
      setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [] }));
      setValErrors({ header: {}, lines: {}, form: '' });
      await refreshAddModeSeries(resetHeader.postingDate);
      
      setPageState(p => ({ ...p, success: `${r.data.message || 'Sales Quotation saved.'}${dn}` }));
    } catch (e) {
      console.error('❌ Sales Quotation Submission Error:', e);
      console.error('Error Response:', e.response?.data);
      setPageState(p => ({ ...p, error: getErrMsg(e, 'Sales Quotation submission failed.') }));
    } finally {
      setPageState(p => ({ ...p, posting: false }));
    }
  };

  const resetForm = async () => {
    const resetHeader = createInitialHeader();
    setSnapshotPending(false);
    setIsDirty(false);
    setCurrentDocEntry(null); setHeader(resetHeader); setLines([createLine(rowUdfDefinitions)]);
    setFreightModal({ open: false, freightCharges: [], loading: false });
    setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, error: '', success: '' }));
    await refreshAddModeSeries(resetHeader.postingDate);
  };

  const visHdrUdfs = headerUdfDefinitions.filter(f => formSettings.headerUdfs?.[f.key]?.visible !== false);
  const visibleRowUdfs = rowUdfDefinitions.filter(f => formSettings.rowUdfs?.[f.key]?.visible !== false);
  const isRightSidebarOpen = sidebarOpen || formSettingsOpen;

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
      if (pageState.posting || !isDocumentEditable) return;

      const key = String(event.key || '').toLowerCase();
      const shouldSubmit = (!isUpdateMode && key === 'a') || (isUpdateMode && key === 'u');
      if (!shouldSubmit) return;

      event.preventDefault();
      formRef.current?.requestSubmit();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isDocumentEditable, isUpdateMode, pageState.posting]);

  // Continue in next part with render...

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form ref={formRef} className={`so-page sap-document-page${isRightSidebarOpen ? ' so-page--sidebar-open' : ''}`} onSubmit={handleSubmit} onChangeCapture={markDirty}>

      {/* toolbar */}
      <div className="so-toolbar sap-document-toolbar">
        <span className="so-toolbar__title">Sales Quotation{currentDocEntry ? ` — #${header.docNo || currentDocEntry}` : ''}</span>
        <button type="submit" className="so-btn so-btn--primary sap-document-toolbar__primary" disabled={pageState.posting || !isDocumentEditable} title={primaryActionLabel}>
          {primaryActionLabel}
        </button>
        <button type="button" className="so-btn sap-document-toolbar__cancel" onClick={resetForm}>
          Cancel
        </button>
        <button type="button" className="so-btn sap-document-toolbar__udf" onClick={toggleHeaderUdfs}>
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button type="button" className="so-btn sap-document-toolbar__settings" onClick={toggleFormSettings}>
          Form Settings
        </button>
        <PrintLayoutToolbar
          documentType="salesQuotation"
          documentLabel="Sales Quotation"
          docEntry={currentDocEntry}
          docNumber={header.docNo}
          disabled={pageState.posting}
          classPrefix="so"
          onSuccess={(message) => setPageState(p => ({ ...p, error: '', success: message }))}
          onError={(message) => setPageState(p => ({ ...p, success: '', error: message }))}
        />
        <button type="button" className="so-btn sap-document-toolbar__copy" onClick={() => openCopyFromModal()} disabled={!isDocumentEditable || !!currentDocEntry}>
          Copy From
        </button>
        <CopyToDropdown
          sourceDocType="salesQuotation"
          disabled={!currentDocEntry}
          onCopyTo={handleCopyTo}
        />
        {currentDocEntry && (
          <button type="button" className="so-btn sap-document-toolbar__duplicate" onClick={handleDuplicate}>
            Duplicate
          </button>
        )}
        <button type="button" className="so-btn sap-document-toolbar__find" onClick={() => navigate('/sales-quotation/find')}>Find</button>
        <button type="button" className="so-btn sap-document-toolbar__new" onClick={resetForm}>New</button>
      </div>

      {/* alerts */}
      {pageState.loading && <div className="so-alert so-alert--success" style={{ marginTop: 0 }}>Loading…</div>}
      {pageState.error && <div className="so-alert so-alert--error">{pageState.error}</div>}
      {pageState.success && <div className="so-alert so-alert--success">{pageState.success}</div>}
      {refData.warnings?.length > 0 && (
        <div className="so-alert so-alert--warning">
          <strong>SAP warnings:</strong>
          {refData.warnings.map((w, i) => <div key={i}>{w}</div>)}
          <div style={{ marginTop: 4, color: '#555' }}>Dropdowns are showing fallback values. Connect to SAP to load live data.</div>
          <div style={{ marginTop: 4, color: '#d00', fontWeight: 600 }}>⚠️ Tax codes shown are examples only. Use actual SAP tax codes to avoid submission errors.</div>
        </div>
      )}

      <fieldset className="so-fieldset" disabled={!isDocumentEditable} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className={`so-layout${isRightSidebarOpen ? ' is-sidebar-open' : ''}`}>
        <div className="so-layout__main">

            {/* ══ HEADER CARD ══════════════════════════════════════════════ */}
            <div className="so-header-card">
              <div className="row g-2">
                {/* LEFT COLUMN */}
                <div className="col-md-6">
                  <div className="so-field-grid" style={{ gridTemplateColumns: '1fr' }}>
                    
                    {/* Buyer's Code */}
                    <div className="so-field">
                      <label className="so-field__label">Buyer's Code *</label>
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
                    <div className="so-field">
                      <label className="so-field__label">Buyer's Name</label>
                      <input name="name" className="so-field__input" value={header.name} readOnly />
                    </div>

                    {/* Contact Person */}
                    <div className="so-field">
                      <label className="so-field__label">Contact Person</label>
                      <select
                        name="contactPerson"
                        className="so-field__select"
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

                    <DocumentCurrencySelect
                      classPrefix="so"
                      header={header}
                      onHeaderChange={handleHeaderChange}
                      businessPartners={refData.vendors || []}
                      localCurrency={refData.company_currencies?.localCurrency || 'INR'}
                      systemCurrency={refData.company_currencies?.systemCurrency || refData.company_currencies?.localCurrency || 'INR'}
                      disabled={pageState.vendorLoading || !header.vendor || !!currentDocEntry}
                    />

                    {/* Place of Supply */}
                    <div className="so-field">
                      <label className="so-field__label">Place of Supply *</label>
                      <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                        <input
                          name="placeOfSupply"
                          className={`so-field__input${valErrors.header.placeOfSupply ? ' so-field__input--error' : ''}`}
                          value={getStateDisplayName(header.placeOfSupply, refData.states)}
                          onChange={handleHeaderChange}
                          placeholder="State code"
                          style={{ flex: 1 }}
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
                        >
                          ...
                        </button>
                      </div>
                    </div>

                    {/* Payment Terms */}
                    <div className="so-field">
                      <label className="so-field__label">Payment Terms</label>
                      <select name="paymentTerms" className="so-field__select" value={header.paymentTerms} onChange={handleHeaderChange}>
                        <option value="">Select</option>
                        {payTermOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>

                    {/* Branch */}
                    <div className="so-field">
                      <label className="so-field__label">Branch</label>
                      <select 
                        name="branch" 
                        className="so-field__select" 
                        value={header.branch || ''} 
                        onChange={handleHeaderChange}
                        style={{ border: valErrors.header.branch ? '1px solid #c00' : undefined }}
                      >
                        <option value="">Select Branch</option>
                        {refData.branches.map(b => (
                          <option key={b.BPLId} value={b.BPLId}>
                            {b.BPLName}
                          </option>
                        ))}
                      </select>
                      {valErrors.header.branch && (
                        <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.header.branch}</div>
                      )}
                    </div>

                    {/* Warehouse */}
                    <div className="so-field">
                      <label className="so-field__label">Warehouse *</label>
                      <select 
                        name="warehouse" 
                        className="so-field__select" 
                        value={header.warehouse || ''} 
                        onChange={handleHeaderChange}
                        style={{ border: valErrors.header.warehouse ? '1px solid #c00' : undefined }}
                        title={header.branch ? `Showing warehouses for selected branch` : 'Select a branch first to filter warehouses'}
                      >
                        <option value="">Select Warehouse</option>
                        {branchFilteredWarehouses.map(w => (
                          <option key={w.WhsCode} value={w.WhsCode}>
                            {w.WhsCode} - {w.WhsName}
                          </option>
                        ))}
                      </select>
                      {valErrors.header.warehouse && (
                        <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.header.warehouse}</div>
                      )}
                    </div>

                  </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="col-md-6">
                  <div className="so-field-grid" style={{ gridTemplateColumns: '1fr' }}>

                    {/* Series */}
                    <div className="so-field">
                      <label className="so-field__label">Series</label>
                      <select 
                        name="series" 
                        className="so-field__select" 
                        value={header.series || ''} 
                        onChange={handleHeaderChange}
                        disabled={!!currentDocEntry || pageState.seriesLoading}
                      >
                        <option value="">Select Series</option>
                        <option value={SAP_MANUAL_SERIES_VALUE}>Manual</option>
                        {refData.series.map(s => (
                          <option key={s.Series} value={s.Series}>
                            {s.SeriesName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auto Number */}
                    <div className="so-field">
                      <label className="so-field__label">Number</label>
                      <input 
                        name="nextNumber" 
                        className={`so-field__input${valErrors.header.nextNumber ? ' so-field__input--error' : ''}`}
                        value={currentDocEntry ? (header.docNo || header.nextNumber || '') : (header.nextNumber || '')}
                        onChange={handleHeaderChange}
                        readOnly={!!currentDocEntry || !isManualDocumentSeries(header.series)}
                        inputMode="numeric"
                        style={{ background: !currentDocEntry && isManualDocumentSeries(header.series) ? '#fff' : '#f0f2f5' }}
                        title={isManualDocumentSeries(header.series) ? 'Enter the manual document number' : 'Number will be assigned from the selected series'}
                      />
                    </div>

                    {/* Customer Ref. No. */}
                    <div className="so-field">
                      <label className="so-field__label">Customer Ref. No.</label>
                      <input name="salesContractNo" className="so-field__input" value={header.salesContractNo} onChange={handleHeaderChange} />
                    </div>

                    {/* Status */}
                    <div className="so-field">
                      <label className="so-field__label">Status</label>
                      <input name="status" className="so-field__input" value={header.status} readOnly style={{ background: '#f0f2f5', color: header.status === 'Open' ? '#1a7a30' : '#c00', fontWeight: 600 }} />
                    </div>

                    {/* Posting Date */}
                    <div className="so-field">
                      <label className="so-field__label">Posting Date *</label>
                      <input type="date" name="postingDate" className="so-field__input" value={header.postingDate} onChange={handleHeaderChange} />
                    </div>

                    {/* Delivery Date */}
                    <div className="so-field">
                      <label className="so-field__label">Delivery Date</label>
                      <input type="date" name="deliveryDate" className="so-field__input" value={header.deliveryDate} onChange={handleHeaderChange} />
                    </div>

                    {/* Document Date */}
                    <div className="so-field">
                      <label className="so-field__label">Document Date *</label>
                      <input 
                        type="date" 
                        name="documentDate" 
                        className="so-field__input" 
                        value={header.documentDate} 
                        onChange={handleHeaderChange}
                        style={{ border: valErrors.header.documentDate ? '1px solid #c00' : undefined }}
                      />
                      {valErrors.header.documentDate && (
                        <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.header.documentDate}</div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </div>

            {/* ══ TABS ══════════════════════════════════════════════════════ */}
            <div className="so-tabs">
              {TAB_NAMES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`so-tab${activeTab === t ? ' so-tab--active' : ''}`}
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
                lineItemOptions={lineItemOptions}
                getUomOptions={getUomOptions}
                effectiveTaxCodes={effectiveTaxCodes}
                effectiveWarehouses={branchFilteredWarehouses}
                fmtTaxLabel={fmtTaxLabel}
                valErrors={valErrors}
                branches={refData.branches}
                distributionRules={refData.distribution_rules || []}
                distributionDimensions={refData.distribution_dimensions || []}
                countries={refData.countries || []}
                onOpenHSNModal={openHSNModal}
                onOpenItemModal={openItemModal}
                onOpenQualityModal={openQualityModal}
                onOpenPaymentTermsModal={openPaymentTermsModal}
                getBranchName={getBranchName}
                formSettings={formSettings}
                matrixFields={matrixColumnDefinitions}
                useSapMatrixOrder={Boolean(refData.line_field_metadata?.sap_form?.preferenceRows)}
                rowUdfFields={visibleRowUdfs}
                onRowUdfChange={handleRowUdfChange}
              />
            )}

            {activeTab === 'Logistics' && (
              <LogisticsTab
                header={header}
                onHeaderChange={handleHeaderChange}
                vendorPayToAddresses={vendorPayToAddresses}
                vendorShipToAddresses={vendorShipToAddresses}
                vendorBillToAddresses={vendorBillToAddresses}
                shipTypeOpts={shipTypeOpts}
                onOpenAddressModal={openAddressModal}
                onOpenEWayBillModal={openEWayBillModal}
              />
            )}

            {activeTab === 'Accounting' && (
              <AccountingTab
                header={header}
                onHeaderChange={handleHeaderChange}
                payTermOpts={payTermOpts}
              />
            )}

            {activeTab === 'Tax' && (
              <TaxTab onOpenTaxInfoModal={openTaxInfoModal} />
            )}

          {activeTab === 'Transport' && (
            <TransportTab
              headerUdfs={headerUdfs}
              onHeaderUdfChange={handleHeaderUdfChange}
            />
          )}

            {activeTab === 'Electronic Documents' && (
              <ElectronicDocumentsTab />
            )}

            {activeTab === 'Attachments' && (
              <AttachmentsTab
                attachments={attachments}
                onBrowseAttachment={handleBrowseAttachment}
              />
            )}

            {/* ══ TOTALS FOOTER ═════════════════════════════════════════════ */}
            <div className="so-header-card">
              <div className="so-field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div className="so-field">
                    <label className="so-field__label">Sales Employee</label>
                    <select 
                      name="purchaser" 
                      className="so-field__select" 
                      value={header.purchaser || ''} 
                      onChange={handleHeaderChange}
                      disabled={!refData.sales_employees || refData.sales_employees.length === 0}
                    >
                      <option value="">No Sales Employee / Buyer</option>
                      {effectiveSalesEmployees.map(emp => (
                        <option key={emp.SlpCode} value={emp.SlpName}>
                          {emp.SlpName}
                        </option>
                      ))}
                      <option value="__DEFINE_NEW__">Define New</option>
                    </select>
                    {/* Debug info */}
                    <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                      {header.purchaser ? (
                        <span>Selected: {header.purchaser} | Available: {effectiveSalesEmployees.length} employees</span>
                      ) : (
                        <span>No selection | Available: {effectiveSalesEmployees.length} employees</span>
                      )}
                    </div>
                  </div>
                  <div className="so-field">
                    <label className="so-field__label">Owner</label>
                    <select 
                      name="owner" 
                      className="so-field__select" 
                      value={header.owner || ''} 
                      onChange={handleHeaderChange}
                      disabled={!refData.owners || refData.owners.length === 0}
                    >
                      <option value="">No Owner</option>
                      {(refData.owners || []).map(owner => (
                        <option key={owner.empID} value={owner.FullName}>
                          {owner.FullName}
                        </option>
                      ))}
                    </select>
                    {/* Debug info */}
                    <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                      {header.owner ? (
                        <span>Selected: {header.owner} | Available: {(refData.owners || []).length} owners</span>
                      ) : (
                        <span>No selection | Available: {(refData.owners || []).length} owners</span>
                      )}
                    </div>
                  </div>
                  <div className="so-field">
                    <label className="so-field__label">Remarks</label>
                    <textarea className="so-textarea" rows={3} name="otherInstruction" value={header.otherInstruction || ''} onChange={handleHeaderChange} />
                  </div>
                </div>
                <div>
                  <div className="so-section-title">Tax Summary</div>
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
                  <div className="so-grid-wrap">
                    <table className="so-grid" style={{ marginTop: '8px' }}>
                      <tbody>
                        <tr>
                          <td>Total Before Discount</td>
                          <td className="so-grid__cell--num"><input className="so-grid__input" value={fmtDec(totals.subtotal, numDec.total)} readOnly /></td>
                        </tr>
                        <tr>
                          <td>Discount %</td>
                          <td className="so-grid__cell--num"><input className="so-grid__input" name="discount" value={header.discount} onChange={handleHeaderChange} onBlur={() => handleNumBlur('discount', 'header')} /></td>
                        </tr>
                        <tr>
                          <td>Freight</td>
                          <td className="so-grid__cell--num" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                              className="so-grid__input" 
                              name="freight" 
                              value={header.freight} 
                              onChange={handleHeaderChange} 
                              onBlur={() => handleNumBlur('freight', 'header')} 
                              style={{ flex: 1 }}
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
                            >
                              ...
                            </button>
                          </td>
                        </tr>
                        <tr>
                          <td>Tax</td>
                          <td className="so-grid__cell--num"><input className="so-grid__input" value={fmtDec(totals.taxAmt, numDec.tax)} readOnly /></td>
                        </tr>
                        <tr style={{ borderTop: '2px solid #a0aab4' }}>
                          <td style={{ fontWeight: 700, color: '#003366' }}>Total</td>
                          <td className="so-grid__cell--num" style={{ fontWeight: 700, color: '#003366' }}><input className="so-grid__input" style={{ fontWeight: 700, color: '#003366' }} value={fmtDec(totals.total, numDec.totalPaymentDue)} readOnly /></td>
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
                <button type="submit" className="so-btn so-btn--primary" disabled={pageState.posting}>
                  {secondaryActionLabel}
                </button>
                <button type="button" className="so-btn" onClick={resetForm}>
                  Cancel
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="so-btn" onClick={() => openCopyFromModal()}>
                  Copy From
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
            editableSapControlledGroups={['matrixColumns']}
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

      {/* E-Way Bill Modal */}
      <EWayBillModal
        isOpen={eWayBillModal}
        onClose={closeEWayBillModal}
        onSave={saveEWayBillModal}
        eWayBillData={eWayBillData}
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

      {/* Copy From Modal */}
      <CopyFromModal
        isOpen={copyFromModal}
        onClose={() => setCopyFromModal(false)}
        onCopy={handleCopyFrom}
        documentType="salesQuotation"
        onFetchDocuments={fetchCopyFromDocuments}
        onFetchDocumentDetails={fetchCopyFromDocumentDetails}
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

      <LineValueLookupModal
        isOpen={lineLookupModal.open}
        onClose={closeLineLookupModal}
        onSelect={handleLineLookupSelect}
        onCreate={handleLineLookupCreate}
        options={lineLookupModal.options}
        title={lineLookupModal.title}
        searchPlaceholder={lineLookupModal.searchPlaceholder}
        emptyMessage={lineLookupModal.emptyMessage}
        allowCreate={lineLookupModal.allowCreate}
      />

      <SalesEmployeeSetupModal
        isOpen={salesEmployeeSetup.open}
        rows={salesEmployeeSetup.rows}
        saving={salesEmployeeSetup.saving}
        onClose={closeSalesEmployeeSetup}
        onSave={saveSalesEmployeeSetup}
        onUpdateRow={updateSalesEmployeeSetupRow}
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
    </form>
  );
}

export default SalesQuotation;
