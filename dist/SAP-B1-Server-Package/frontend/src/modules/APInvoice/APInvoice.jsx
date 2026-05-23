import React, { useEffect, useState, useCallback } from 'react';
import './styles/APInvoice.css';
import { useLocation, useNavigate } from 'react-router-dom';
import FormSettingsPanel from '../../components/ap-invoice/FormSettingsPanel';
import HeaderUdfSidebar from '../../components/ap-invoice/HeaderUdfSidebar';
import ContentsTab from './components/ContentsTab';
import LogisticsTab from './components/LogisticsTab';
import AccountingTab from './components/AccountingTab';
import TaxTab from './components/TaxTab';
import ElectronicDocumentsTab from './components/ElectronicDocumentsTab';
import AttachmentsTab from './components/AttachmentsTab';
import AddressModal from './components/AddressModal';
import TaxInfoModal from './components/TaxInfoModal';
import ItemSelectionModal from './components/ItemSelectionModal';
import BusinessPartnerModal from './components/BusinessPartnerModal';
import StateSelectionModal from './components/StateSelectionModal';
import CopyFromModal from '../purchase-order/components/CopyFromModal';
import FreightChargesModal from '../../components/freight/FreightChargesModal';
import PurchasePrintLayoutActions from '../../components/print-layout/PurchasePrintLayoutActions';
import SalesEmployeeSetupModal from '../../components/sales-employee/SalesEmployeeSetupModal';
import { useSapWindowTaskbarActions } from '../../components/SapWindowTaskbarContext';
import { copyToDocument } from '../../services/documentCopyService';
import { summarizeFreightRows } from '../../components/freight/freightUtils';
import { filterWarehousesByBranch } from '../../utils/warehouseBranch';
import { hydrateDocumentLineFromItem, mergeItemMaster } from '../../utils/documentItemHydration';
import { mapAddressToModalForm, resolveAddressForModal } from '../../utils/documentAddress';
import { getDefaultSeriesForCurrentYear } from '../../utils/seriesDefaults';
import { getStateCodeValue, getStateDisplayName } from '../../utils/stateDisplay';
import useSalesEmployeeSetup from '../../hooks/useSalesEmployeeSetup';
import { consumeCopyToState } from '../../utils/copyToState';
import useValidationHighlights from '../../utils/useValidationHighlights';
import {
  fetchAPInvoiceReferenceData,
  fetchAPInvoiceVendorDetails,
  submitAPInvoice,
  updateAPInvoice,
  fetchAPInvoiceByDocEntry,
  fetchAPInvoiceSeries,
  fetchNextNumber,
  fetchOpenGRPO,
  fetchGRPOForCopy,
  fetchItemsForModal,
  fetchFreightCharges,
} from '../../api/apInvoiceApi';
import { PURCHASE_ORDER_COMPANY_ID } from '../../config/appConfig';
import { fetchHSNCodeFromItem } from '../../api/hsnCodeApi';
import { normaliseDocumentHeader, normaliseDocumentLine, unwrapCopyFromDocument } from '../../api/copyFromApi';
import {
  BASE_MATRIX_COLUMNS,
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  readSavedFormSettings,
} from '../../config/APInvoiceForm';

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
const getFirstValidationMessage = (errors) => {
  if (errors.form && errors.form !== 'Please correct the highlighted fields.') return errors.form;
  const headerMessage = Object.values(errors.header || {}).find(Boolean);
  if (headerMessage) return headerMessage;
  for (const lineError of Object.values(errors.lines || {})) {
    const message = Object.values(lineError || {}).find(Boolean);
    if (message) return message;
  }
  return 'Please correct the highlighted fields.';
};

const normalizeState = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const isGstTaxCode = (taxCode) => {
  const value = String(taxCode || '').trim().toUpperCase();
  return Boolean(value) && value.includes('GST') && !value.includes('NON-GST') && !value.includes('NONGST');
};

const getDerivedGstType = (vendorState, placeOfSupply) => {
  if (!vendorState || !placeOfSupply) return '';
  return normalizeState(vendorState) === normalizeState(placeOfSupply) ? 'INTRASTATE' : 'INTERSTATE';
};

const formatDerivedGstType = (gstType) => {
  if (gstType === 'INTRASTATE') return 'CGST + SGST';
  if (gstType === 'INTERSTATE') return 'IGST';
  return '';
};

const findPreferredGstTaxCode = ({ taxCodes = [], gstType = '', currentTaxCode = '' }) => {
  if (!gstType) return null;

  const availableTaxCodes = taxCodes.filter((taxCode) =>
    isGstTaxCode(taxCode.Code) && String(taxCode.GSTType || '').trim().toUpperCase() === gstType
  );
  if (!availableTaxCodes.length) return null;

  const currentTax = taxCodes.find((taxCode) => String(taxCode.Code || '') === String(currentTaxCode || ''));
  const currentRate = currentTax?.Rate != null ? Number(currentTax.Rate) : null;
  if (currentRate != null && Number.isFinite(currentRate)) {
    const sameRateTaxCode = availableTaxCodes.find((taxCode) => Number(taxCode.Rate) === currentRate);
    if (sameRateTaxCode) return sameRateTaxCode;
  }

  return availableTaxCodes.find((taxCode) => Number(taxCode.Rate) === 18) || availableTaxCodes[0];
};

// ─── constants ────────────────────────────────────────────────────────────────
const DEC = { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 };
const TAB_NAMES = ['Contents', 'Logistics', 'Accounting', 'Tax', 'Electronic Documents', 'Attachments'];

const createLine = (rowUdfDefinitions = ROW_UDF_DEFINITIONS) => ({
  itemNo: '',
  itemDescription: '',
  hsnCode: '',
  quantity: '',
  openQty: '',
  uomCode: '',
  unitPrice: '',
  stdDiscount: '',
  taxCode: '',
  total: '',
  whse: '',
  baseEntry: null,
  baseType: null,
  baseLine: null,
  taxCodeManuallyOverridden: false,
  udf: createUdfState(rowUdfDefinitions),
});

const INIT_HEADER = {
  vendor: '',
  name: '',
  contactPerson: '',
  salesContractNo: '',
  branch: '',
  docNo: '',
  status: 'Open',
  series: '',
  nextNumber: '',
  postingDate: today(),
  deliveryDate: '',
  documentDate: today(),
  contractDate: '',
  branchRegNo: '',
  shipTo: '',
  shipToCode: '',
  payTo: '',
  payToCode: '',
  shippingType: '',
  usePayToForTax: false,
  toOrder: '',
  notifyPartyCode: '',
  notifyPartyName: '',
  notifyPartyAddress: '',
  language: '',
  splitAPInvoice: false,
  confirmed: false,
  journalRemark: '',
  paymentTerms: '',
  paymentMethod: '',
  centralBankInd: '',
  dueDateMonths: '0',
  dueDateDays: '0',
  cashDiscountOffset: '',
  paymentTerms2: '',
  advancePaymentPercent: '',
  advanceAmt: '',
  balancePaymentAgainst: '',
  shipmentWithin: '',
  expiryDate: '',
  advanceDate: '',
  withinDays: '',
  daysFrom: '',
  bpProject: '',
  qrCodeFrom: '',
  cancellationDate: '',
  requiredDate: '',
  indicator: '',
  orderNumber: '',
  taxInformation: '',
  transactionCategory: '',
  formNo: '',
  dutyStatus: 'With Payment of Duty',
  importTax: false,
  supplyCovered: false,
  differentialTaxRate: '100',
  edocFormat: '',
  documentStatus: '',
  totalImportedDocument: '',
  dateReceived: '',
  purchaser: '',
  salesEmployee: '',
  owner: '',
  agentCode: '',
  agentName: '',
  otherInstruction: '',
  discount: '',
  freight: '',
  rounding: false,
  tax: '',
  totalPaymentDue: '',
  placeOfSupply: '',
  gstin: '',
  vendorState: '',
  gstType: '',
  allowGstOverride: false,
};

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

const AP_INVOICE_COPY_BASE_TYPE = {
  grpo: 20,
  apInvoice: 20,
};

// ─── Main Component ───────────────────────────────────────────────────────────
const FALLBACK_UOM = ['EA', 'PCS', 'KG', 'LTR', 'MTR', 'BOX', 'SET', 'NOS', 'PKT', 'DZN'];

function APInvoice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { removeTask, upsertTask } = useSapWindowTaskbarActions();

  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [header, setHeader] = useState(INIT_HEADER);
  const [headerUdfDefinitions, setHeaderUdfDefinitions] = useState(HEADER_UDF_DEFINITIONS);
  const [rowUdfDefinitions, setRowUdfDefinitions] = useState(ROW_UDF_DEFINITIONS);
  const [lines, setLines] = useState([createLine(ROW_UDF_DEFINITIONS)]);
  const [attachments] = useState(INIT_ATTACH);
  const [activeTab, setActiveTab] = useState('Contents');
  const [headerUdfs, setHeaderUdfs] = useState(() => createUdfState(HEADER_UDF_DEFINITIONS));
  const [formSettings, setFormSettings] = useState(() => readSavedFormSettings());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [refData, setRefData] = useState({
    company: '',
    company_state: '',
    vendors: [],
    contacts: [],
    pay_to_addresses: [],
    ship_to_addresses: [],
    bill_to_addresses: [],
    items: [],
    warehouses: [],
    warehouse_addresses: [],
    company_address: {},
    tax_codes: [],
    payment_terms: [],
    shipping_types: [],
    branches: [],
    uom_groups: [],
    decimal_settings: DEC,
    udf_metadata: { header: [], rows: [] },
    warnings: [],
    series: [],
    states: [],
  });
  const [pageState, setPageState] = useState({
    loading: false,
    vendorLoading: false,
    posting: false,
    seriesLoading: false,
    error: '',
    success: '',
  });
  const [valErrors, setValErrors] = useState({
    header: {},
    lines: {},
    form: '',
  });
  useValidationHighlights(valErrors);
  const [snapshotPending, setSnapshotPending] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [addressModal, setAddressModal] = useState(null);
  const [taxInfoModal, setTaxInfoModal] = useState(false);
  const [itemModal, setItemModal] = useState({ open: false, lineIndex: -1, items: [], loading: false });
  const [freightModal, setFreightModal] = useState({ open: false, freightCharges: [], loading: false });
  const [bpModal, setBpModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);
  const [copyFromModal, setCopyFromModal] = useState(false);
  const [copyFromDocType, setCopyFromDocType] = useState('grpo');
  const [addressForm, setAddressForm] = useState({
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

  useEffect(() => {
    localStorage.setItem(FORM_SETTINGS_STORAGE_KEY, JSON.stringify(formSettings));
  }, [formSettings]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.po-dropdown')) {
        document.querySelectorAll('.po-dropdown').forEach((dropdown) => dropdown.classList.remove('active'));
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // decimal config
  const dec = { ...DEC, ...(refData.decimal_settings || {}) };
  const numDec = {
    quantity: Number(dec.QtyDec),
    unitPrice: Number(dec.PriceDec),
    stdDiscount: Number(dec.PercentDec),
    total: Number(dec.SumDec),
    discount: Number(dec.PercentDec),
    freight: Number(dec.SumDec),
    tax: Number(dec.SumDec),
    totalPaymentDue: Number(dec.SumDec),
    advancePaymentPercent: Number(dec.PercentDec),
    advanceAmt: Number(dec.SumDec),
    withinDays: 0,
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
  const hasUnsavedChanges = Boolean(currentDocEntry && isDirty);
  const updateActionLabel = hasUnsavedChanges ? 'Update' : 'OK';
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

  // ── load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const [refDataRes, seriesRes] = await Promise.all([
          fetchAPInvoiceReferenceData(PURCHASE_ORDER_COMPANY_ID),
          fetchAPInvoiceSeries(),
        ]);

        if (!ignore) {
          const nextHeaderUdfs = refDataRes.data.udf_metadata?.header || [];
          const nextRowUdfs = refDataRes.data.udf_metadata?.rows || [];
          setHeaderUdfDefinitions(nextHeaderUdfs);
          setRowUdfDefinitions(nextRowUdfs);
          setHeaderUdfs((prev) => createUdfState(nextHeaderUdfs, prev));
          setLines((prev) => prev.map((line) => ({
            ...line,
            udf: createUdfState(nextRowUdfs, line.udf || {}),
          })));
          const nextDefaults = readSavedFormSettings(nextHeaderUdfs, nextRowUdfs);
          setFormSettings((prev) => ({
            ...nextDefaults,
            ...prev,
            headerUdfs: {
              ...nextDefaults.headerUdfs,
              ...(prev.headerUdfs || {}),
            },
            rowUdfs: {
              ...nextDefaults.rowUdfs,
              ...(prev.rowUdfs || {}),
            },
          }));

          setRefData({
            company: refDataRes.data.company || '',
            company_state: refDataRes.data.company_state || '',
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
            payment_terms: refDataRes.data.payment_terms || [],
            shipping_types: refDataRes.data.shipping_types || [],
            sales_employees: refDataRes.data.sales_employees || [],
            branches: refDataRes.data.branches || [],
            states: refDataRes.data.states || [],
            uom_groups: refDataRes.data.uom_groups || [],
            decimal_settings: { ...DEC, ...(refDataRes.data.decimal_settings || {}) },
            udf_metadata: refDataRes.data.udf_metadata || { header: [], rows: [] },
            warnings: refDataRes.data.warnings || [],
            series: seriesRes.data.series || [],
          });

          if (seriesRes.data.series && seriesRes.data.series.length > 0 && !currentDocEntry) {
            const defaultSeries = getDefaultSeriesForCurrentYear(seriesRes.data.series);
            if (defaultSeries?.Series != null) {
              handleSeriesChange(defaultSeries.Series);
            }
          }
        }
        console.log("FULL REF DATA:", refDataRes.data);
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load reference data.') }));
      } finally {
        if (!ignore) setPageState(p => ({ ...p, loading: false }));
      }
    };
    load();
    return () => { ignore = true; };
  }, []);

  // ── load existing order ───────────────────────────────────────────────────
  useEffect(() => {
    const docEntry = location.state?.APInvoiceDocEntry;
    if (!docEntry) return;
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const r = await fetchAPInvoiceByDocEntry(docEntry);
        const po = r.data.apInvoice;
        if (ignore || !po) return;
        setCurrentDocEntry(po.doc_entry || Number(docEntry));
        setHeader(prev => ({
          ...prev,
          ...INIT_HEADER,
          ...(po.header || {}),
        }));

        setLines(
          Array.isArray(po.lines) && po.lines.length
            ? po.lines.map(l => ({
              ...createLine(rowUdfDefinitions),
              ...l,
              taxCodeManuallyOverridden: true,
              udf: { ...createUdfState(rowUdfDefinitions), ...(l.udf || {}) },
            }))
            : [createLine(rowUdfDefinitions)]
        );
        setHeaderUdfs({ ...createUdfState(headerUdfDefinitions), ...(po.header_udfs || {}) });
        setSnapshotPending(true);
        setIsDirty(false);
        if (po.header?.vendor) {
          loadVendorDetails(po.header.vendor);
        }
        setPageState(p => ({ ...p, success: po.doc_num ? `A/P Invoice ${po.doc_num} loaded.` : 'A/P Invoice loaded.' }));
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load A/P Invoice.') }));
      } finally {
        if (!ignore) {
          setPageState(p => ({ ...p, loading: false }));
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };
    load();
    return () => { ignore = true; };
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const routedCopyFrom = location.state?.copyFrom;
    const persistedCopyState = routedCopyFrom ? null : consumeCopyToState(location.pathname, ['/ap-invoice']);
    const copyFrom = routedCopyFrom || persistedCopyState?.copyFrom;
    if (!copyFrom) return;

    const sourceType = copyFrom.type || 'grpo';
    const normalizedHeader = normaliseDocumentHeader(copyFrom.header || {});
    const sourceLines = Array.isArray(copyFrom.lines) ? copyFrom.lines : [];
    const copiedLines = sourceLines.map((line, index) => ({
      ...createLine(rowUdfDefinitions),
      ...normaliseDocumentLine(
        line,
        index,
        line.baseEntry ?? copyFrom.baseDocument?.baseEntry ?? copyFrom.docEntry,
        line.baseType ?? copyFrom.baseDocument?.baseType ?? AP_INVOICE_COPY_BASE_TYPE[sourceType] ?? 20,
        line.branch || normalizedHeader.branch
      ),
      openQty: String(line.openQty ?? line.OpenQty ?? line.quantity ?? line.Quantity ?? ''),
      taxCodeManuallyOverridden: false,
      udf: { ...createUdfState(rowUdfDefinitions), ...(line.udf || {}) },
    }));

    setHeader((prev) => ({ ...prev, ...normalizedHeader }));
    setLines(copiedLines.length ? copiedLines : [createLine(rowUdfDefinitions)]);
    setFreightModal({ open: false, freightCharges: [], loading: false });
    setValErrors({ header: {}, lines: {}, form: '' });

    if (normalizedHeader.vendor) {
      loadVendorDetails(normalizedHeader.vendor);
    }

    const label = sourceType === 'apInvoice' ? 'A/P Invoice' : 'GRPO';
    setPageState((prev) => ({ ...prev, error: '', success: `Copied from ${label}. Please review and save.` }));
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

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

  const payTermOpts = refData.payment_terms.length
    ? refData.payment_terms.map(t => ({ value: String(t.GroupNum), label: t.PymntGroup }))
    : [{ value: 'Net 30', label: 'Net 30' }, { value: 'Net 60', label: 'Net 60' }];

  const shipTypeOpts = refData.shipping_types.length
    ? refData.shipping_types.map(s => ({ value: String(s.TrnspCode), label: s.TrnspName }))
    : [{ value: 'Air', label: 'Air' }, { value: 'Sea', label: 'Sea' }, { value: 'Road', label: 'Road' }];

  const lineItemOptions = lines.reduce((acc, line, i) => {
    const code = String(line.itemNo || '').trim();
    const exists = refData.items.some(it => String(it.ItemCode || '') === code);
    acc[i] = code && !exists ? [{ ItemCode: code, ItemName: line.itemDescription || code }, ...refData.items] : refData.items;
    return acc;
  }, {});

  const uomGroupMap = (refData.uom_groups || []).reduce((acc, g) => { acc[g.AbsEntry] = g.uomCodes || []; return acc; }, {});
  const FALLBACK_WAREHOUSES = [{ WhsCode: 'WH01', WhsName: 'Main Warehouse' }];

  const effectiveTaxCodes = refData.tax_codes || [];
  const effectiveWarehouses = refData.warehouses.length ? refData.warehouses : FALLBACK_WAREHOUSES;
  const branchFilteredWarehouses = filterWarehousesByBranch(effectiveWarehouses, header.branch);
  const freightTotals = summarizeFreightRows(freightModal.freightCharges, effectiveTaxCodes);

  const getBranchName = (branchId) => {
    if (!branchId) return '';
    const branch = refData.branches.find(b => String(b.BPLId) === String(branchId));
    return branch ? branch.BPLName : branchId;
  };

  const getUomOptions = useCallback((line) => {
    const item = refData.items.find(i => String(i.ItemCode || '') === String(line.itemNo || ''));
    if (item) {
      const codes = uomGroupMap[item.UoMGroupEntry];
      if (codes && codes.length) return codes;
      const fb = String(item.PurchaseUnit || item.InventoryUOM || '').trim();
      if (fb) return [fb];
    }
    return FALLBACK_UOM;
  }, [refData.items, uomGroupMap]);

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
  const derivedGstType = getDerivedGstType(header.vendorState, header.placeOfSupply);
  const inferredGstType = formatDerivedGstType(derivedGstType);

  // ── GST Logic ─────────────────────────────────────────────────────────────
  const applyGstLogic = useCallback(async () => {
    if (!derivedGstType) {
      return;
    }

    setLines(prevLines => prevLines.map(line => {
      if (!line.itemNo || line.taxCodeManuallyOverridden) {
        return line;
      }

      const defaultTax = findPreferredGstTaxCode({
        taxCodes: refData.tax_codes,
        gstType: derivedGstType,
        currentTaxCode: line.taxCode,
      });
      if (!defaultTax?.Code || String(line.taxCode || '') === String(defaultTax.Code)) {
        return line;
      }

      return { ...line, taxCode: defaultTax.Code };
    }));
  }, [derivedGstType, refData.tax_codes]);

  useEffect(() => {
    if (header.vendorState || header.placeOfSupply) {
      applyGstLogic();
    }
  }, [header.vendorState, header.placeOfSupply, applyGstLogic]);

  useEffect(() => {
    setHeader(prev => prev.gstType === inferredGstType ? prev : { ...prev, gstType: inferredGstType });
  }, [inferredGstType]);

  // ── address sync ──────────────────────────────────────────────────────────
  // Sync branch to all lines when header branch changes
  useEffect(() => {
    if (header.branch) {
      setLines(prev => prev.map(l => ({ ...l, branch: String(header.branch), loc: String(header.branch) })));
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

  useEffect(() => {
    const shouldAutoPopulateAddresses = true;
    if (!shouldAutoPopulateAddresses) return;
    if (!header.vendor) return;
    setHeader(prev => {
      const existing = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === String(prev.shipToCode || ''));
      if (existing) return prev;
      const def = vendorEffectiveShipToAddresses[0];
      if (!def) return prev;
      const fmt = fmtAddr(def);
      const nextPlaceOfSupply = def.State || prev.placeOfSupply || '';
      if (prev.shipToCode === def.Address && prev.shipTo === fmt && prev.placeOfSupply === nextPlaceOfSupply) return prev;
      return { ...prev, shipToCode: def.Address || '', shipTo: fmt, placeOfSupply: nextPlaceOfSupply };
    });
  }, [header.vendor, vendorEffectiveShipToAddresses]);

  useEffect(() => {
    const shouldAutoPopulateAddresses = true;
    if (!shouldAutoPopulateAddresses) return;
    if (!header.vendor) return;
    setHeader(prev => {
      const existing = vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === String(prev.payToCode || ''));
      if (existing) return prev;
      const def = vendorEffectiveBillToAddresses[0];
      if (!def) return prev;
      const fmt = fmtAddr(def);
      if (prev.payToCode === def.Address && prev.payTo === fmt) return prev;
      return { ...prev, payToCode: def.Address || '', payTo: fmt };
    });
  }, [header.vendor, vendorEffectiveBillToAddresses]);

  // ── vendor details ────────────────────────────────────────────────────────
  const loadVendorDetails = async (code) => {
    if (!code) {
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
      setHeader(prev => ({ ...prev, gstin: '', vendorState: '', gstType: '', allowGstOverride: false }));
      return;
    }

    setPageState(p => ({ ...p, vendorLoading: true }));

    try {
      const r = await fetchAPInvoiceVendorDetails(code);
      const contacts = r.data.contacts || [];
      const payToAddresses = r.data.pay_to_addresses || [];
      const shipToAddresses = r.data.ship_to_addresses || [];
      const billToAddresses = r.data.bill_to_addresses || [];
      const primaryTaxAddress = payToAddresses[0] || billToAddresses[0] || shipToAddresses[0] || contacts[0] || {};
      const gstin = String(r.data.gstin || primaryTaxAddress.GSTIN || primaryTaxAddress.gstin || '').trim();
      const vendorState = String(r.data.vendorState || primaryTaxAddress.State || primaryTaxAddress.state || '').trim();
      setRefData(p => ({
        ...p,
        contacts: contacts,
        pay_to_addresses: payToAddresses,
        ship_to_addresses: shipToAddresses,
        bill_to_addresses: billToAddresses,
      }));

      setHeader(prev => ({
        ...prev,
        gstin,
        vendorState,
        gstType: formatDerivedGstType(getDerivedGstType(vendorState, prev.placeOfSupply)),
        allowGstOverride: false,
        contactPerson: contacts.length > 0 ? contacts[0].CntctCode : '',
      }));
    } catch (err) {
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
      setHeader(prev => ({ ...prev, gstin: '', vendorState: '', gstType: '', allowGstOverride: false, contactPerson: '' }));
    } finally {
      setPageState(p => ({ ...p, vendorLoading: false }));
    }
  };

  const syncVendor = (code, hdr) => {
    const m = refData.vendors.find(v => String(v.CardCode || '') === String(code || ''));
    if (!m) return { nextHeader: hdr };
    return {
      nextHeader: {
        ...hdr,
        name: m.CardName || m.Name || hdr.name,
        paymentTerms: m.GroupNum != null ? String(m.GroupNum) : hdr.paymentTerms,
        contactPerson: '',
        shipTo: '',
        shipToCode: '',
        payTo: '',
        payToCode: '',
        placeOfSupply: '',
        gstin: '',
        vendorState: '',
        gstType: '',
        allowGstOverride: false,
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

  const handleShipToCodeChange = (e) => {
    const selectedCode = e.target.value;
    const selectedAddress = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === selectedCode)
      || vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === selectedCode);

    setHeader(prev => ({
      ...prev,
      shipToCode: selectedCode,
      shipTo: fmtAddr(selectedAddress),
      placeOfSupply: selectedAddress?.State || prev.placeOfSupply || '',
    }));
  };

  const handleLineChange = (i, e) => {
    const { name, value } = e.target;
    setValErrors(p => ({ ...p, lines: { ...p.lines, [i]: { ...(p.lines[i] || {}), [name]: '' } }, form: '' }));
    setPageState(p => ({ ...p, error: '', success: '' }));
    setLines(prev => prev.map((line, idx) => {
      if (idx !== i) return line;
      const next = { ...line, [name]: numDec[name] !== undefined ? sanitize(value, numDec[name]) : value };

      if (name === 'taxCode') {
        next.taxCodeManuallyOverridden = true;
      }

      if (name === 'itemNo') {
        const item = refData.items.find(it => String(it.ItemCode || '') === String(value || ''));
        if (item) {
          next.itemDescription = item.ItemName || next.itemDescription;
          next.hsnCode = item.HSNCode || next.hsnCode || '';
          next.uomCode = String(item.PurchaseUnit || item.InventoryUOM || '').trim();

          // Auto-assign default warehouse
          if (item.DefaultWarehouse) {
            next.whse = item.DefaultWarehouse;
          }
        }
        if (!next.taxCodeManuallyOverridden) {
          const preferredTaxCode = findPreferredGstTaxCode({
            taxCodes: refData.tax_codes,
            gstType: derivedGstType,
            currentTaxCode: next.taxCode,
          });
          if (preferredTaxCode?.Code) {
            next.taxCode = preferredTaxCode.Code;
          }
        }
      }

      next.total = fmtDec(calcLineTotal(next), numDec.total);
      return next;
    }));
  };

  const handleNumBlur = (field, target = 'line', i = null) => {
    const d = numDec[field];
    if (d === undefined) return;
    if (target === 'header') { setHeader(p => ({ ...p, [field]: fmtDec(p[field], d) })); return; }
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: fmtDec(l[field], d) } : l));
  };

  const openFreightModal = async () => {
    if (freightModal.freightCharges.length > 0) {
      setFreightModal(prev => ({ ...prev, open: true, loading: false }));
      return;
    }
    setFreightModal(prev => ({ ...prev, open: true, loading: true }));
    try {
      const response = await fetchFreightCharges(currentDocEntry);
      setFreightModal({
        open: true,
        freightCharges: response.data.freightCharges || [],
        loading: false,
      });
    } catch (_error) {
      setFreightModal({
        open: true,
        freightCharges: [],
        loading: false,
      });
    }
  };

  const closeFreightModal = () => {
    setFreightModal(prev => ({ ...prev, open: false, loading: false }));
  };

  const handleFreightApply = (summary) => {
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
    markDirty();
    setValErrors(p => ({ ...p, form: '' }));
    setLines(p => [...p, { ...createLine(rowUdfDefinitions), whse: header.warehouse || '', branch: header.branch || '', loc: header.branch || '' }]);
  };

  const removeLine = (i) => {
    markDirty();
    setValErrors(p => { const nl = { ...p.lines }; delete nl[i]; return { ...p, lines: nl, form: '' }; });
    setLines(p => p.filter((_, idx) => idx !== i));
  };

  const handleHeaderUdfChange = (k, v) => {
    markDirty();
    setHeaderUdfs(p => ({ ...p, [k]: v }));
  };
  const handleRowUdfChange = (i, k, v) => {
    markDirty();
    setLines(p => p.map((l, idx) => idx === i ? { ...l, udf: { ...(l.udf || {}), [k]: v } } : l));
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

  // ── Series and Auto-Numbering handlers ────────────────────────────────────
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

  const handleShipToChange = (addressCode) => {
    if (!addressCode) {
      setHeader(p => ({ ...p, shipToCode: addressCode, shipTo: '', placeOfSupply: '' }));
      return;
    }

    const addr = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === addressCode)
      || vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === addressCode);
    setHeader(p => ({
      ...p,
      shipToCode: addressCode,
      shipTo: fmtAddr(addr),
      placeOfSupply: addr?.State || p.placeOfSupply || '',
    }));
  };

  // ── Address Modal handlers ────────────────────────────────────────────────
  const openAddressModal = (type) => {
    const shipAddress = resolveAddressForModal(
      header.shipToCode,
      vendorEffectiveShipToAddresses,
      header.shipToAddress || header.shipTo,
      fmtAddr,
    );
    const payAddress = resolveAddressForModal(
      header.payToCode || header.billToCode,
      vendorEffectiveBillToAddresses,
      header.billToAddress || header.billTo || header.payTo,
      fmtAddr,
    );
    const activeAddress = type === 'payTo' || type === 'billTo' ? payAddress : shipAddress;

    setAddressForm(mapAddressToModalForm(activeAddress, {
      shipToCode: header.shipToCode || shipAddress?.Address || '',
      shipToAddress: header.shipToAddress || header.shipTo || (shipAddress ? fmtAddr(shipAddress) : ''),
      billToCode: header.billToCode || header.payToCode || payAddress?.Address || '',
      billToAddress: header.billToAddress || header.billTo || header.payTo || (payAddress ? fmtAddr(payAddress) : ''),
    }));
    setAddressModal({ type });
  };

  const closeAddressModal = () => {
    setAddressModal(null);
  };

  const saveAddressModal = () => {
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
      setHeader(p => ({ ...p, shipTo: formatted, shipToAddress: formatted }));
    } else {
      setHeader(p => ({ ...p, payTo: formatted, billTo: formatted, billToAddress: formatted }));
    }
    closeAddressModal();
  };

  const handleAddressFormChange = (e) => {
    const { name, value } = e.target;
    setAddressForm(p => ({ ...p, [name]: value }));
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

  // ── Item Modal handlers ───────────────────────────────────────────────────
  const openItemModal = async (lineIndex) => {
    setItemModal({ open: true, lineIndex, items: [], loading: true });
    try {
      const response = await fetchItemsForModal();
      setItemModal(prev => ({ ...prev, items: response.data.items || [], loading: false }));
    } catch {
      setItemModal(prev => ({ ...prev, items: [], loading: false }));
    }
  };

  const closeItemModal = () => {
    setItemModal({ open: false, lineIndex: -1, items: [], loading: false });
  };

  const handleItemSelect = async (item) => {
    const lineIndex = itemModal.lineIndex;
    if (lineIndex < 0) return;
    const mergedItem = mergeItemMaster(item, refData.items);
    try {
      const hsnResponse = await fetchHSNCodeFromItem(mergedItem.ItemCode);
      const hsnCode = hsnResponse.data?.hsnCode || mergedItem.HSNCode || '';
      setLines(prev => prev.map((line, idx) => {
        if (idx !== lineIndex) return line;
        return hydrateDocumentLineFromItem(line, mergedItem, {
          side: 'purchase',
          hsnCode,
          fallbackWarehouse: header.warehouse,
          calcLineTotal,
          formatTotal: (value) => fmtDec(value, numDec.total),
        });
      }));
    } catch {
      setLines(prev => prev.map((line, idx) => {
        if (idx !== lineIndex) return line;
        return hydrateDocumentLineFromItem(line, mergedItem, {
          side: 'purchase',
          hsnCode: mergedItem.HSNCode || '',
          fallbackWarehouse: header.warehouse,
          calcLineTotal,
          formatTotal: (value) => fmtDec(value, numDec.total),
        });
      }));
    }
    closeItemModal();
  };

  // ── Business Partner Modal handlers ──────────────────────────────────────
  const openBpModal = () => setBpModal(true);
  const closeBpModal = () => setBpModal(false);

  const handleBpSelect = (bp) => {
    setHeader(prev => {
      const prep = { ...prev, vendor: bp.CardCode };
      const { nextHeader } = syncVendor(bp.CardCode, prep);
      nextHeader.contactPerson = '';
      return nextHeader;
    });
    loadVendorDetails(bp.CardCode);
    closeBpModal();
  };

  // ── State Selection Modal handlers ────────────────────────────────────────
  const openStateModal = () => setStateModal(true);
  const closeStateModal = () => setStateModal(false);

  const handleStateSelect = (state) => {
    setHeader(prev => ({ ...prev, placeOfSupply: getStateCodeValue(state, refData.states) }));
    closeStateModal();
  };

  const handleTaxInfoFormChange = (e) => {
    const { name, value } = e.target;
    setTaxInfoForm(p => ({ ...p, [name]: value }));
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

  // ── validation ────────────────────────────────────────────────────────────
  const handleCopyFrom = (data, docType) => {
    const copySource = unwrapCopyFromDocument(data);
    const normalizedHeader = normaliseDocumentHeader(copySource.header);
    const rawLines = copySource.lines;
    const copiedLines = rawLines.map((line, index) => ({
      ...createLine(rowUdfDefinitions),
      ...normaliseDocumentLine(line, index, copySource.docEntry, AP_INVOICE_COPY_BASE_TYPE[docType] || 20, normalizedHeader.branch),
      openQty: String(line.OpenQty ?? line.openQty ?? line.Quantity ?? line.quantity ?? ''),
      taxCodeManuallyOverridden: false,
      udf: createUdfState(rowUdfDefinitions),
    }));

    setHeader((prev) => ({ ...prev, ...normalizedHeader }));
    setLines(copiedLines.length ? copiedLines : [createLine(rowUdfDefinitions)]);
    setFreightModal({ open: false, freightCharges: [], loading: false });

    if (normalizedHeader.vendor) {
      loadVendorDetails(normalizedHeader.vendor);
    }

    setCopyFromModal(false);
    setPageState((prev) => ({ ...prev, error: '', success: 'GRPO copied successfully.' }));
  };

  const openCopyFromModal = (docType) => {
    if (!String(header.vendor || '').trim()) {
      setValErrors({ header: { vendor: 'Select a vendor first.' }, lines: {}, form: '' });
      setPageState((prev) => ({ ...prev, error: '', success: '' }));
      return;
    }

    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState((prev) => ({ ...prev, error: '', success: '' }));
    setCopyFromDocType(docType);
    setCopyFromModal(true);
  };

  const fetchCopyFromDocuments = async (docType) => {
    if (docType === 'grpo') {
      const response = await fetchOpenGRPO(header.vendor);
      return response.data.orders || response.data.documents || [];
    }

    return [];
  };

  const fetchCopyFromDocumentDetails = async (docType, docEntry) => {
    if (docType === 'grpo') {
      const response = await fetchGRPOForCopy(docEntry);
      return response.data;
    }

    throw new Error(`Unsupported copy from type: ${docType}`);
  };

  const handleCopyTo = async (targetType) => {
    await copyToDocument({
      sourceDocType: 'apInvoice',
      targetType,
      sourceDocEntry: currentDocEntry,
      sourceDocNo: header.docNo,
      sourcePath: location.pathname,
      sourceSnapshot: { header, lines },
      restoreState: { APInvoiceDocEntry: currentDocEntry },
      navigate,
      upsertTask,
      removeTask,
      setError: (message) => setPageState(p => ({ ...p, success: '', error: message })),
      errorMessage: 'Please save the A/P invoice first before copying to another document.',
    });
  };

  const validate = () => {
    const isUpdate = !!currentDocEntry;
    const e = { header: {}, lines: {}, form: '' };

    if (!isUpdate) {
      const vc = String(header.vendor || '').trim();
      if (!vc) { e.header.vendor = 'Select a vendor.'; e.form = 'Please correct the highlighted fields.'; return e; }
      // if (!String(header.placeOfSupply || '').trim()) {
      //   console.warn('Place of Supply missing - GST may be incorrect');
      // }

    }

    if (!String(header.postingDate || '').trim()) { e.header.postingDate = 'Posting date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }
    if (!String(header.documentDate || '').trim()) { e.header.documentDate = 'Document date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }
    if (!String(header.deliveryDate || '').trim()) { e.header.deliveryDate = 'Due date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }
    if (String(header.deliveryDate || '').trim() && String(header.postingDate || '').trim() && header.deliveryDate < header.postingDate) {
      e.header.deliveryDate = 'Due date must be on or after posting date.';
      e.form = 'Please correct the highlighted fields.';
      return e;
    }

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

      if (!l.hsnCode && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), hsnCode: 'HSN Code is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.quantity || Number(l.quantity) <= 0) {
        e.lines[i] = { ...(e.lines[i] || {}), quantity: 'Quantity must be > 0' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.uomCode && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), uomCode: 'UoM is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if ((l.unitPrice === '' || l.unitPrice == null || Number(l.unitPrice) < 0) && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), unitPrice: 'Unit Price must be >= 0' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.whse && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), whse: 'Warehouse is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (l.baseEntry != null && l.baseEntry !== '' && parseNum(l.openQty) > 0 && parseNum(l.quantity) > parseNum(l.openQty)) {
        e.lines[i] = { ...(e.lines[i] || {}), quantity: `Quantity exceeds open GRPO quantity (${l.openQty})` };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }
    }

    if (String(header.totalPaymentDue || '').trim()) {
      const enteredTotal = parseNum(header.totalPaymentDue);
      if (Math.abs(enteredTotal - totals.total) > 0.01) {
        e.form = 'Document total mismatch';
        return e;
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
      setValErrors(e);
      setPageState(p => ({ ...p, error: getFirstValidationMessage(e), success: '' }));
      return;
    }

    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, posting: true, error: '', success: '' }));
    try {
      const prep = {
        ...header,
        deliveryDate: header.deliveryDate || header.postingDate || header.documentDate,
        series: header.series ? Number(header.series) : undefined,
        gstType: inferredGstType,
        allowGstOverride: false,
      };
      const payload = { company_id: PURCHASE_ORDER_COMPANY_ID, header: prep, lines, freightCharges: freightModal.freightCharges, header_udfs: headerUdfs };
      const r = currentDocEntry ? await updateAPInvoice(currentDocEntry, payload) : await submitAPInvoice(payload);
      const dn = r.data.doc_num ? ` Doc No: ${r.data.doc_num}.` : '';
      const warningMsg = r.data.warning?.message ? ` Warning: ${r.data.warning.message}` : '';
      setSnapshotPending(false);
      setIsDirty(false);
      setCurrentDocEntry(null); setHeader(INIT_HEADER); setLines([createLine(rowUdfDefinitions)]);
      setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [] }));
      setValErrors({ header: {}, lines: {}, form: '' });

      if (refData.series.length > 0) {
        handleSeriesChange(refData.series[0].Series);
      }

      setPageState(p => ({ ...p, success: `${r.data.message || 'A/P Invoice saved.'}${dn}${warningMsg}` }));
    } catch (e) {
      setPageState(p => ({ ...p, error: getErrMsg(e, 'A/P Invoice submission failed.') }));
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
    setFreightModal({ open: false, freightCharges: [], loading: false });
  };

  const hasBuyerCode = Boolean(String(header.vendor || '').trim());
  const visHdrUdfs = headerUdfDefinitions.filter(f => formSettings.headerUdfs?.[f.key]?.visible !== false);
  const isRightSidebarOpen = sidebarOpen || formSettingsOpen;
  const visibleRowUdfs = rowUdfDefinitions.filter(f => formSettings.rowUdfs?.[f.key]?.visible !== false);

  // Continue in next message with render...

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form className={`po-page sap-document-page${isRightSidebarOpen ? ' po-page--sidebar-open' : ''}`} onSubmit={handleSubmit} onChangeCapture={markDirty}>

      {/* ── Toolbar ── */}
      <div className="po-toolbar sap-document-toolbar">
        <span className="po-toolbar__title sap-document-toolbar__title">A/P Invoice{currentDocEntry ? ` — #${header.docNo || currentDocEntry}` : ''}</span>
        <button type="submit" className="po-btn po-btn--primary sap-document-toolbar__primary" disabled={pageState.posting}>
          {primaryActionLabel}
        </button>
        <button type="button" className="po-btn po-btn--danger sap-document-toolbar__cancel" onClick={resetForm}>Cancel</button>
        <button type="button" className="po-btn sap-document-toolbar__find" onClick={() => navigate('/ap-invoice/find')}>Find</button>
        <button type="button" className="po-btn sap-document-toolbar__new" onClick={resetForm}>New</button>
        <button type="button" className="po-btn sap-document-toolbar__udf" onClick={toggleHeaderUdfs}>
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button type="button" className="po-btn sap-document-toolbar__settings" onClick={toggleFormSettings}>Form Settings</button>
        <div className="po-dropdown">
          <button
            type="button"
            className="po-btn"
            disabled={!isDocumentEditable}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const dropdown = event.currentTarget.parentElement;
              const isActive = dropdown.classList.contains('active');
              document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
              if (!isActive) dropdown.classList.add('active');
            }}
          >
            Copy From ▼
          </button>
          <div className="po-dropdown-menu">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCopyFromModal('grpo');
                document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
              }}
            >
              GRPO
            </button>
          </div>
        </div>
        <div className="po-dropdown">
          <button
            type="button"
            className="po-btn"
            disabled={!currentDocEntry}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const dropdown = event.currentTarget.parentElement;
              const isActive = dropdown.classList.contains('active');
              document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
              if (!isActive) dropdown.classList.add('active');
            }}
          >
            Copy To ▼
          </button>
          <div className="po-dropdown-menu">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleCopyTo('apCreditMemo');
                document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
              }}
            >
              A/P Credit Memo
            </button>
          </div>
        </div>
        <PurchasePrintLayoutActions
          documentKey="apInvoice"
          docEntry={currentDocEntry}
          docNumber={header.docNo}
          disabled={pageState.posting || pageState.loading}
          onSuccess={(message) => setPageState(p => ({ ...p, error: '', success: message }))}
          onError={(message) => setPageState(p => ({ ...p, error: message, success: '' }))}
        />
        <span className={`po-mode-badge po-mode-badge--${currentDocEntry ? 'update' : 'add'}`}>
          {currentDocEntry ? 'Update' : 'Add'}
        </span>
      </div>

      {/* ── Alerts ── */}
      {pageState.loading && <div className="po-alert po-alert--warning">Loading…</div>}
      {pageState.error   && <div className="po-alert po-alert--error">{pageState.error}</div>}
      {pageState.success && <div className="po-alert po-alert--success">{pageState.success}</div>}
      {refData.warnings?.length > 0 && (
        <div className="po-alert po-alert--warning">
          <strong>SAP warnings:</strong>
          {refData.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      <fieldset disabled={!isDocumentEditable} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div className={`po-layout${isRightSidebarOpen ? ' is-sidebar-open' : ''}`}>
          <div className="po-layout__main">

            {/* ══ HEADER CARD ══════════════════════════════════════════════ */}
            <div className="po-header-card">
              <div className="po-field-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>

                {/* LEFT — Vendor info */}
                <div style={{ borderRight: '2px solid #e0e6ed', paddingRight: 16 }}>
                  <div className="po-field">
                    <label className="po-field__label">Buyer's Code *</label>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <input 
                        name="vendor" 
                        className={`po-field__input${valErrors.header.vendor ? ' po-field__input--error' : ''}`} 
                        value={header.vendor} 
                        onChange={handleHeaderChange} 
                        disabled={!!currentDocEntry} 
                        style={{ flex: 1 }} 
                        placeholder="Select Vendor"
                      />
                      {!currentDocEntry && (
                        <button type="button" onClick={openBpModal} style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }} title="Select Vendor">...</button>
                      )}
                    </div>
                    {valErrors.header.vendor && <span className="po-error-feedback">{valErrors.header.vendor}</span>}
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Buyer's Name</label>
                    <input name="name" className="po-field__input" value={header.name} readOnly />
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Contact Person</label>
                    <select name="contactPerson" className="po-field__select" value={header.contactPerson || ''} onChange={handleHeaderChange} disabled={pageState.vendorLoading || !header.vendor || !!currentDocEntry}>
                      <option value="">Select</option>
                      {contactOptions.map(c => (
                        <option key={c.CntctCode} value={c.CntctCode}>{c.Name || `${c.FirstName || ''} ${c.LastName || ''}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Sales Contract No.</label>
                    <input name="salesContractNo" className="po-field__input" value={header.salesContractNo} onChange={handleHeaderChange} />
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Our Branch</label>
                    <select name="branch" className={`po-field__select${valErrors.header.branch ? ' po-field__select--error' : ''}`} value={header.branch} onChange={handleHeaderChange}>
                      <option value="">Select</option>
                      {refData.branches.map(b => <option key={b.BPLId} value={b.BPLId}>{b.BPLName}</option>)}
                    </select>
                    {valErrors.header.branch && <span className="po-error-feedback">{valErrors.header.branch}</span>}
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Warehouse</label>
                    <select name="warehouse" className="po-field__select" value={header.warehouse || ''} onChange={handleHeaderChange}>
                      <option value="">Select Warehouse</option>
                      {branchFilteredWarehouses.map(w => (
                        <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode} - {w.WhsName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Place of Supply *</label>
                    <div style={{ display: 'flex', gap: 2 }}>
                      <input 
                        name="placeOfSupply" 
                        className={`po-field__input${valErrors.header.placeOfSupply ? ' po-field__input--error' : ''}`} 
                        value={getStateDisplayName(header.placeOfSupply, refData.states)} 
                        onChange={handleHeaderChange} 
                        style={{ flex: 1 }} 
                        placeholder="Select State"
                      />
                      <button type="button" onClick={openStateModal} style={{ padding: '0 6px', fontSize: 11, border: '1px solid #a0aab4', background: 'linear-gradient(180deg,#fff 0%,#e8ecf0 100%)', minWidth: 24, height: 22, cursor: 'pointer', borderRadius: 2 }} title="Select State">...</button>
                    </div>
                    {valErrors.header.placeOfSupply && <span className="po-error-feedback">{valErrors.header.placeOfSupply}</span>}
                    {!pageState.vendorLoading && header.vendor && !header.gstin && (
                      <div className="po-alert po-alert--warning" style={{ margin: '4px 0 0', padding: '3px 8px', fontSize: 11 }}>GSTIN missing - please verify tax calculation</div>
                    )}
                  </div>
                </div>

                {/* RIGHT — Document info */}
                <div style={{ paddingLeft: 16 }}>
                  <div className="po-field">
                    <label className="po-field__label">Series</label>
                    <select name="series" className="po-field__select" style={{ background: '#fff3cd' }} value={header.series} onChange={handleHeaderChange} disabled={!!currentDocEntry || pageState.seriesLoading}>
                      <option value="">Select Series</option>
                      {refData.series.map(s => <option key={s.Series} value={s.Series}>{s.SeriesName} ({s.Indicator})</option>)}
                    </select>
                    <input type="text" className="po-field__input" style={{ width: 80, background: '#f0f2f5', textAlign: 'center' }} value={pageState.seriesLoading ? '...' : header.nextNumber} readOnly title="Auto-assigned on save" />
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Status</label>
                    <input name="status" className="po-field__input" value={header.status} readOnly style={{ color: header.status === 'Open' ? '#1a7a30' : '#c00', fontWeight: 600 }} />
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Posting Date *</label>
                    <input type="date" name="postingDate" className={`po-field__input${valErrors.header.postingDate ? ' po-field__input--error' : ''}`} value={header.postingDate} onChange={handleHeaderChange} />
                    {valErrors.header.postingDate && <span className="po-error-feedback">{valErrors.header.postingDate}</span>}
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Delivery Date</label>
                    <input type="date" name="deliveryDate" className={`po-field__input${valErrors.header.deliveryDate ? ' po-field__input--error' : ''}`} value={header.deliveryDate} onChange={handleHeaderChange} />
                    {valErrors.header.deliveryDate && <span className="po-error-feedback">{valErrors.header.deliveryDate}</span>}
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Document Date *</label>
                    <input type="date" name="documentDate" className={`po-field__input${valErrors.header.documentDate ? ' po-field__input--error' : ''}`} value={header.documentDate} onChange={handleHeaderChange} />
                    {valErrors.header.documentDate && <span className="po-error-feedback">{valErrors.header.documentDate}</span>}
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Contract Date</label>
                    <input type="date" name="contractDate" className="po-field__input" value={header.contractDate} onChange={handleHeaderChange} />
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Branch Reg. No.</label>
                    <input name="branchRegNo" className="po-field__input" value={header.branchRegNo || ''} onChange={handleHeaderChange} />
                  </div>
                </div>

              </div>
            </div>

            {/* ══ TABS ══════════════════════════════════════════════════════ */}
            <div className="po-tabs">
              {TAB_NAMES.map(t => (
                <button type="button" key={t} className={`po-tab${activeTab === t ? ' po-tab--active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
              ))}
            </div>

            {/* ══ TAB CONTENT ═══════════════════════════════════════════════ */}
            <div className="po-tab-panel">
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
                onOpenHSNModal={(i) => {/* HSN modal not implemented in AP Invoice */}}
                onOpenItemModal={openItemModal}
                getBranchName={getBranchName}
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
                shippingTypeOptions={shipTypeOpts}
                onShipToCodeChange={handleShipToCodeChange}
                onOpenAddressModal={openAddressModal}
              />
            )}

            {activeTab === 'Accounting' && (
              <AccountingTab
                header={header}
                onHeaderChange={handleHeaderChange}
                paymentTermOptions={payTermOpts}
              />
            )}

            {activeTab === 'Tax' && (
              <TaxTab header={header} onHeaderChange={handleHeaderChange} onOpenTaxInfoModal={openTaxInfoModal} />
            )}

            {activeTab === 'Electronic Documents' && (
              <ElectronicDocumentsTab header={header} onHeaderChange={handleHeaderChange} />
            )}

            {activeTab === 'Attachments' && (
              <AttachmentsTab attachments={attachments} onBrowseAttachment={handleBrowseAttachment} />
            )}
            </div>{/* end po-tab-panel */}

            {/* ══ TOTALS FOOTER ═════════════════════════════════════════════ */}
            <div className="po-header-card" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <div className="po-field">
                    <label className="po-field__label">Purchaser</label>
                    <select name="purchaser" className="po-field__select" value={header.purchaser || ''} onChange={handleHeaderChange}>
                      <option value="">No Purchaser</option>
                      {effectiveSalesEmployees.map((employee) => (
                        <option key={employee.SlpCode ?? employee.SlpName} value={employee.SlpName || ''}>
                          {employee.SlpName || ''}
                        </option>
                      ))}
                      <option value="__DEFINE_NEW__">Define New</option>
                    </select>
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Owner</label>
                    <input name="owner" className="po-field__input" value={header.owner || ''} onChange={handleHeaderChange} />
                  </div>
                  <div className="po-field" style={{ alignItems: 'flex-start' }}>
                    <label className="po-field__label" style={{ paddingTop: 4 }}>Remarks</label>
                    <textarea className="po-textarea" rows={3} name="otherInstruction" value={header.otherInstruction} onChange={handleHeaderChange} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {totals.taxBreakdown.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div className="po-section-title">Tax Summary</div>
                      {totals.taxBreakdown.map(t => (
                        <div key={t.taxCode} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span>{t.taxCode} ({t.taxRate}%)</span>
                          <span>{fmtDec(t.taxAmount, numDec.tax)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <table className="po-grid" style={{ tableLayout: 'fixed' }}>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Total Before Discount</td>
                        <td><input className="po-grid__input" value={fmtDec(totals.subtotal, numDec.total)} readOnly style={{ background: '#f5f8fc' }} /></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Discount %</td>
                        <td><input className="po-grid__input" name="discount" value={header.discount} onChange={handleHeaderChange} onBlur={() => handleNumBlur('discount', 'header')} /></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Freight</td>
                        <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input className="po-grid__input" name="freight" value={header.freight} onChange={handleHeaderChange} onBlur={() => handleNumBlur('freight', 'header')} style={{ flex: 1 }} />
                          <button
                            type="button"
                            onClick={openFreightModal}
                            style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #d0d7de', borderRadius: 3, background: 'linear-gradient(180deg, #f6f8fa 0%, #e9ecef 100%)', cursor: 'pointer', minWidth: 24 }}
                            title="Select Freight Charge"
                          >
                            ...
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>
                          <label className="po-checkbox-label">
                            <input type="checkbox" name="rounding" checked={header.rounding} onChange={handleHeaderChange} />
                            Rounding
                          </label>
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Tax</td>
                        <td><input className="po-grid__input" value={fmtDec(totals.taxAmt, numDec.tax)} readOnly style={{ background: '#f5f8fc' }} /></td>
                      </tr>
                      <tr className="po-grid__total">
                        <td style={{ fontWeight: 700, color: '#003366', fontSize: 12 }}>Total</td>
                        <td><input className="po-grid__input" value={fmtDec(totals.total, numDec.totalPaymentDue)} readOnly style={{ background: '#e8f4fc', fontWeight: 700, color: '#003366' }} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ══ ACTION BUTTONS ════════════════════════════════════════════ */}
            {false && (
            <div className="po-toolbar sap-document-toolbar" style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="submit" className="po-btn po-btn--primary" disabled={pageState.posting}>
                  {secondaryActionLabel}
                </button>
                <button type="button" className="po-btn po-btn--danger" onClick={resetForm}>Cancel</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div className="po-dropdown">
                  <button
                    type="button"
                    className="po-btn"
                    disabled={!isDocumentEditable}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const dropdown = event.currentTarget.parentElement;
                      const isActive = dropdown.classList.contains('active');
                      document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
                      if (!isActive) dropdown.classList.add('active');
                    }}
                  >
                    Copy From ▼
                  </button>
                  <div className="po-dropdown-menu">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openCopyFromModal('grpo');
                        document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
                      }}
                    >
                      GRPO
                    </button>
                  </div>
                </div>
                <div className="po-dropdown">
                  <button
                    type="button"
                    className="po-btn"
                    disabled={!currentDocEntry}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const dropdown = event.currentTarget.parentElement;
                      const isActive = dropdown.classList.contains('active');
                      document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
                      if (!isActive) dropdown.classList.add('active');
                    }}
                  >
                    Copy To ▼
                  </button>
                  <div className="po-dropdown-menu">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleCopyTo('apCreditMemo');
                        document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
                      }}
                    >
                      A/P Credit Memo
                    </button>
                  </div>
                </div>
              </div>
            </div>
            )}

        </div>{/* end main flex */}

          <HeaderUdfSidebar
            className="po-layout__sidebar"
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
            className="po-layout__sidebar"
            isOpen={formSettingsOpen}
            onClose={() => setFormSettingsOpen(false)}
            matrixFields={BASE_MATRIX_COLUMNS}
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
        states={refData.states || []}
      />

      {/* Tax Information Modal */}
      <TaxInfoModal
        isOpen={taxInfoModal}
        onClose={closeTaxInfoModal}
        onSave={saveTaxInfoModal}
        taxInfoForm={taxInfoForm}
        onFormChange={handleTaxInfoFormChange}
      />

      {/* Item Selection Modal */}
      <ItemSelectionModal
        isOpen={itemModal.open}
        onClose={closeItemModal}
        onSelect={handleItemSelect}
        items={itemModal.items}
        loading={itemModal.loading}
      />

      {/* Business Partner Modal */}
      <BusinessPartnerModal
        isOpen={bpModal}
        onClose={closeBpModal}
        onSelect={handleBpSelect}
        businessPartners={refData.vendors || []}
      />

      {/* State Selection Modal */}
      <StateSelectionModal
        isOpen={stateModal}
        onClose={closeStateModal}
        onSelect={handleStateSelect}
        states={refData.states || []}
      />

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

export default APInvoice;
