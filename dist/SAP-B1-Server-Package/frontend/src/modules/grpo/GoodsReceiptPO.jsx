import React, { useEffect, useState, useCallback } from 'react';
import './styles/GoodsReceiptPO.css';
import { useLocation, useNavigate } from 'react-router-dom';
import FormSettingsPanel from './components/FormSettingsPanel';
import HeaderUdfSidebar from './components/HeaderUdfSidebar';
import ContentsTab from './components/ContentsTab';
import LogisticsTab from './components/LogisticsTab';
import AccountingTab from './components/AccountingTab';
import TaxTab from './components/TaxTab';
import ElectronicDocumentsTab from './components/ElectronicDocumentsTab';
import AttachmentsTab from './components/AttachmentsTab';
import AddressModal from './components/AddressModal';
import TaxInfoModal from './components/TaxInfoModal';
import CopyFromModal from './components/CopyFromModal';
import BatchAllocationModal from './components/BatchAllocationModal';
import ItemSelectionModal from './components/ItemSelectionModal';
import HSNCodeModal from './components/HSNCodeModal';
import BusinessPartnerModal from './components/BusinessPartnerModal';
import StateSelectionModal from './components/StateSelectionModal';
import FreightChargesModal from '../../components/freight/FreightChargesModal';
import PurchasePrintLayoutActions from '../../components/print-layout/PurchasePrintLayoutActions';
import SalesEmployeeSetupModal from '../../components/sales-employee/SalesEmployeeSetupModal';
import { useSapWindowTaskbarActions } from '../../components/SapWindowTaskbarContext';
import { copyToDocument } from '../../services/documentCopyService';
import { duplicateDocumentInPlace, refreshDuplicateSeries } from '../../utils/documentDuplicate';
import { filterWarehousesByBranch } from '../../utils/warehouseBranch';
import { mapAddressToModalForm, resolveAddressForModal } from '../../utils/documentAddress';
import { getDefaultSeriesForCurrentYear } from '../../utils/seriesDefaults';
import { useCompanyScopedFormSettings } from '../../utils/formSettingsStorage';
import { buildVisibleEnteredRowUdfPayload } from '../../utils/rowUdfPayload';
import { getStateCodeValue, getStateDisplayName } from '../../utils/stateDisplay';
import useSalesEmployeeSetup from '../../hooks/useSalesEmployeeSetup';
import {
  BATCH_QTY_TOLERANCE,
  getRequiredBatchQty,
  getLineUomFactor,
  sumBatchQty,
} from '../../utils/batchQuantity';
import {
  fetchGRPOReferenceData,
  fetchGRPOByDocEntry,
  fetchGRPOVendorDetails,
  submitGRPO,
  updateGRPO,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchPurchaseOrderForCopy,
  fetchBatchesByItem,
  fetchItemsForModal,
  fetchFreightCharges,
} from '../../api/grpoApi';
import { PURCHASE_ORDER_COMPANY_ID } from '../../config/appConfig';
import { fetchHSNCodeFromItem } from '../../api/hsnCodeApi';
import {
  BASE_MATRIX_COLUMNS,
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  readSavedFormSettings,
} from '../../config/grpoForm';
import { summarizeFreightRows } from '../../components/freight/freightUtils';
import { consumeCopyToState } from '../../utils/copyToState';
import useValidationHighlights from '../../utils/useValidationHighlights';

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
const isBatchManaged = (item) => String(item?.BatchManaged || '').toUpperCase() === 'Y';
const isGstTaxCode = (taxCode) => {
  const value = String(taxCode || '').trim().toUpperCase();
  return Boolean(value) && value.includes('GST') && !value.includes('NON-GST') && !value.includes('NONGST');
};
const normalizeState = (value) => String(value || '').trim().toUpperCase();
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
    isGstTaxCode(taxCode.Code) && normalizeState(taxCode.GSTType) === gstType
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
const DEFAULT_WAREHOUSE = '01';

const createLine = (rowUdfDefinitions = ROW_UDF_DEFINITIONS) => ({
  itemNo: '',
  itemDescription: '',
  hsnCode: '',
  quantity: '',
  uomCode: '',
  unitPrice: '',
  stdDiscount: '',
  taxCode: '',
  total: '',
  whse: DEFAULT_WAREHOUSE,
  batchManaged: false,
  batches: [],
  inventoryUOM: '',
  uomFactor: 1,
  openQty: '',
  baseEntry: null,
  baseType: 22,
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
  warehouse: DEFAULT_WAREHOUSE,
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
  splitGoodsReceiptPO: false,
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

// ─── Main Component ───────────────────────────────────────────────────────────
const FALLBACK_UOM = ['EA', 'PCS', 'KG', 'LTR', 'MTR', 'BOX', 'SET', 'NOS', 'PKT', 'DZN'];

function GoodsReceiptPO() {
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
  const [formSettings, setFormSettings, formSettingsStorageKey] = useCompanyScopedFormSettings(
    FORM_SETTINGS_STORAGE_KEY,
    readSavedFormSettings,
    [headerUdfDefinitions, rowUdfDefinitions],
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    warnings: [],
    series: [],
    states: [],
    udf_metadata: { header: [], rows: [] },
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
  const [copyFromModal, setCopyFromModal] = useState(false);
  const [batchModal, setBatchModal] = useState({ open: false, lineIndex: null, availableBatches: [], loading: false, error: '' });
  const [itemModal, setItemModal] = useState({ open: false, lineIndex: -1, items: [], loading: false });
  const [freightModal, setFreightModal] = useState({ open: false, freightCharges: [], loading: false });
  const [hsnModal, setHsnModal] = useState({ open: false, lineIndex: -1 });
  const [bpModal, setBpModal] = useState(false);
  const [stateModal, setStateModal] = useState(false);
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
          fetchGRPOReferenceData(PURCHASE_ORDER_COMPANY_ID),
          fetchDocumentSeries(),
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
          const nextDefaults = readSavedFormSettings(nextHeaderUdfs, nextRowUdfs, formSettingsStorageKey);
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
    const docEntry = location.state?.grpoDocEntry;
    if (!docEntry) return;
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const r = await fetchGRPOByDocEntry(docEntry);
        const grpo = r.data.grpo;
        if (ignore || !grpo) return;
        setCurrentDocEntry(grpo.doc_entry || Number(docEntry));
        setHeader(prev => ({
          ...prev,
          ...INIT_HEADER,
          ...(grpo.header || {}),
        }));

        setLines(
          Array.isArray(grpo.lines) && grpo.lines.length
            ? grpo.lines.map(l => ({ ...createLine(rowUdfDefinitions), ...l, taxCodeManuallyOverridden: true, udf: { ...createUdfState(rowUdfDefinitions), ...(l.udf || {}) } }))
            : [createLine(rowUdfDefinitions)]
        );
        setHeaderUdfs({ ...createUdfState(headerUdfDefinitions), ...(grpo.header_udfs || {}) });
        setSnapshotPending(true);
        setIsDirty(false);
        if (grpo.header?.vendor) {
          loadVendorDetails(grpo.header.vendor);
        }
        setPageState(p => ({ ...p, success: grpo.doc_num ? `Goods Receipt PO ${grpo.doc_num} loaded.` : 'Goods Receipt PO loaded.' }));
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load Goods Receipt PO.') }));
      } finally {
        if (!ignore) {
          setPageState(p => ({ ...p, loading: false }));
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };
    load();
    return () => { ignore = true; };
  }, [location.pathname, location.state, navigate, headerUdfDefinitions, rowUdfDefinitions]);

  useEffect(() => {
    const routedCopyFrom = location.state?.copyFrom;
    const persistedCopyState = routedCopyFrom ? null : consumeCopyToState(location.pathname, ['/grpo']);
    const copyFrom = routedCopyFrom || persistedCopyState?.copyFrom;
    if (!copyFrom) return;

    const { header: sourceHeader = {}, lines: sourceLines = [], baseDocument } = copyFrom;

    setHeader((prev) => ({
      ...prev,
      vendor: sourceHeader.vendor || sourceHeader.CardCode || '',
      name: sourceHeader.name || sourceHeader.CardName || '',
      contactPerson: sourceHeader.contactPerson || sourceHeader.CntctCode || '',
      branch: sourceHeader.branch || sourceHeader.BPL_IDAssignedToInvoice || '',
      paymentTerms: sourceHeader.paymentTerms || sourceHeader.GroupNum || '',
      placeOfSupply: sourceHeader.placeOfSupply || '',
      otherInstruction: sourceHeader.otherInstruction || sourceHeader.Comments || '',
    }));

    if (Array.isArray(sourceLines) && sourceLines.length > 0) {
      setLines(sourceLines.map((line, index) => ({
        ...createLine(rowUdfDefinitions),
        itemNo: line.itemNo || line.ItemCode || '',
        itemDescription: line.itemDescription || line.ItemDescription || line.Dscription || '',
        quantity: String(line.quantity || line.Quantity || line.OpenQty || 0),
        unitPrice: String(line.unitPrice || line.UnitPrice || line.Price || 0),
        uomCode: line.uomCode || line.UomCode || line.unitMsr || '',
        hsnCode: line.hsnCode || line.HSNCode || '',
        taxCode: '',
        whse: line.whse || line.WarehouseCode || line.WhsCode || '',
        stdDiscount: String(line.stdDiscount || line.discount || line.DiscountPercent || line.DiscPrcnt || 0),
        baseEntry: baseDocument?.baseEntry || copyFrom.docEntry,
        baseType: baseDocument?.baseType || 22,
        baseLine: line.lineNum ?? line.LineNum ?? index,
        branch: line.branch || sourceHeader.branch || '',
      })));
    }

    const vendorCode = sourceHeader.vendor || sourceHeader.CardCode;
    if (vendorCode) loadVendorDetails(vendorCode);

    setPageState((prev) => ({ ...prev, success: 'Copied from Purchase Order. Please review and save.' }));
    navigate(location.pathname, { replace: true, state: null });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const vendorEffectiveShipToAddresses = vendorShipToAddresses.length ? vendorShipToAddresses : vendorPayToAddresses;

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

  const uomOptions = lines.reduce((acc, line, i) => {
    acc[i] = getUomOptions(line);
    return acc;
  }, {});
  const effectiveTaxCodes = refData.tax_codes || [];
  const effectiveWarehouses = refData.warehouses.length ? refData.warehouses : [];
  const branchFilteredWarehouses = filterWarehousesByBranch(effectiveWarehouses, header.branch);
  const freightTotals = summarizeFreightRows(freightModal.freightCharges, effectiveTaxCodes);

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

  const derivedGstType = getDerivedGstType(header.vendorState, header.placeOfSupply);
  const inferredGstType = formatDerivedGstType(derivedGstType);
  const getPreferredLineTaxCode = useCallback((currentTaxCode = '') => {
    if (!derivedGstType) return '';

    const vendor = refData.vendors.find(v => String(v.CardCode || '') === String(header.vendor || ''));
    const preferredTaxCode = findPreferredGstTaxCode({
      taxCodes: effectiveTaxCodes,
      gstType: derivedGstType,
      currentTaxCode: currentTaxCode || vendor?.VatGroup || '',
    });

    return preferredTaxCode?.Code || '';
  }, [derivedGstType, effectiveTaxCodes, header.vendor, refData.vendors]);

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

  // ── GST Logic ─────────────────────────────────────────────────────────────
  const applyGstLogic = useCallback(() => {
    if (!derivedGstType) return;

    setLines(prevLines => prevLines.map(line => {
      if (!line.itemNo || line.taxCodeManuallyOverridden) {
        return line;
      }

      const defaultTax = findPreferredGstTaxCode({
        taxCodes: effectiveTaxCodes,
        gstType: derivedGstType,
        currentTaxCode: line.taxCode,
      });
      if (!defaultTax?.Code || String(line.taxCode || '') === String(defaultTax.Code)) {
        return line;
      }

      return { ...line, taxCode: defaultTax.Code };
    }));
  }, [derivedGstType, effectiveTaxCodes]);

  // Trigger GST logic when vendor GST context changes
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
    setHeader(prev => {
      const existing = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === String(prev.shipToCode || ''));
      if (existing) return prev;
      const def = vendorEffectiveShipToAddresses[0];
      if (!def) return prev;
      const fmt = fmtAddr(def);
      const nextState = String(def.State || '').trim();
      if (prev.shipToCode === def.Address && prev.shipTo === fmt && prev.placeOfSupply === nextState) return prev;
      return { ...prev, shipToCode: def.Address || '', shipTo: fmt, placeOfSupply: nextState };
    });
  }, [header.vendor, vendorEffectiveShipToAddresses]);

  useEffect(() => {
    if (!header.vendor) return;
    setHeader(prev => {
      const existing = vendorPayToAddresses.find(a => String(a.Address || '') === String(prev.payToCode || ''));
      if (existing) return prev;
      const def = vendorPayToAddresses[0];
      if (!def) return prev;
      const fmt = fmtAddr(def);
      if (prev.payToCode === def.Address && prev.payTo === fmt) return prev;
      return { ...prev, payToCode: def.Address || '', payTo: fmt };
    });
  }, [header.vendor, vendorPayToAddresses]);

  // ── vendor details ────────────────────────────────────────────────────────
  const loadVendorDetails = async (code) => {
    if (!code) {
      setRefData(p => ({
        ...p,
        contacts: [],
        pay_to_addresses: [],
        ship_to_addresses: [],
        bill_to_addresses: [],
      }));
      setHeader(prev => ({
        ...prev,
        gstin: '',
        vendorState: '',
        gstType: '',
        allowGstOverride: false,
        contactPerson: '',
      }));
      return;
    }

    setPageState(p => ({ ...p, vendorLoading: true }));

    try {
      const r = await fetchGRPOVendorDetails(code);
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
      setRefData(p => ({
        ...p,
        contacts: [],
        pay_to_addresses: [],
        ship_to_addresses: [],
        bill_to_addresses: [],
      }));
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
      },
      vatGroup: String(m.VatGroup || '').trim(),
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
    const selectedAddress = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === selectedCode);

    setHeader(prev => ({
      ...prev,
      shipToCode: selectedCode,
      shipTo: fmtAddr(selectedAddress),
      placeOfSupply: String(selectedAddress?.State || '').trim(),
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
        next.batches = [];
        next.batchManaged = isBatchManaged(item);
        if (item) {
          next.itemDescription = item.ItemName || next.itemDescription;
          next.hsnCode = item.HSNCode || next.hsnCode || '';
          next.uomCode = String(item.PurchaseUnit || item.InventoryUOM || '').trim();
          next.inventoryUOM = String(item.InventoryUOM || '').trim();
          next.uomFactor = getLineUomFactor({
            uomCode: String(item.PurchaseUnit || item.InventoryUOM || '').trim(),
          });

          // Auto-assign default warehouse
          if (item.DefaultWarehouse) {
            next.whse = item.DefaultWarehouse;
          }

          if (!next.taxCodeManuallyOverridden) {
            const preferredTaxCode = getPreferredLineTaxCode(next.taxCode);
            if (preferredTaxCode) {
              next.taxCode = preferredTaxCode;
            }
          }
        }

      }
      if (name === 'uomCode') {
        next.batches = [];
        next.uomFactor = getLineUomFactor({ ...next, uomCode: value });
      }
      if (name === 'whse') {
        next.batches = [];
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
    setLines(p => [...p, { ...createLine(rowUdfDefinitions), whse: header.warehouse || DEFAULT_WAREHOUSE, branch: header.branch || '', loc: header.branch || '' }]);
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
  const updateFormSetting = (g, k, prop, val) => setFormSettings(p => ({ ...p, [g]: { ...p[g], [k]: { ...p[g][k], [prop]: val } } }));
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

    const addr = vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === addressCode);
    setHeader(p => ({
      ...p,
      shipToCode: addressCode,
      shipTo: fmtAddr(addr),
      placeOfSupply: String(addr?.State || '').trim(),
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
      vendorPayToAddresses,
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
    try {
      const hsnResponse = await fetchHSNCodeFromItem(item.ItemCode);
      const hsnCode = hsnResponse.data?.hsnCode || item.HSNCode || '';
      setLines(prev => prev.map((line, idx) => {
        if (idx !== lineIndex) return line;
        const next = { ...line };
        next.itemNo = item.ItemCode;
        next.itemDescription = item.ItemName || '';
        next.uomCode = String(item.PurchaseUnit || item.InventoryUOM || '').trim();
        next.hsnCode = hsnCode;
        next.batches = [];
        next.batchManaged = item.BatchManaged === 'Y';
        next.inventoryUOM = String(item.InventoryUOM || '').trim();
        next.uomFactor = getLineUomFactor({
          uomCode: String(item.PurchaseUnit || item.InventoryUOM || '').trim(),
        });
        if (item.DefaultWarehouse) next.whse = item.DefaultWarehouse;
        if (!next.taxCodeManuallyOverridden) {
          const preferredTaxCode = getPreferredLineTaxCode(next.taxCode);
          if (preferredTaxCode) {
            next.taxCode = preferredTaxCode;
          }
        }
        next.total = fmtDec(calcLineTotal(next), numDec.total);
        return next;
      }));
    } catch {
      setLines(prev => prev.map((line, idx) => {
        if (idx !== lineIndex) return line;
        return {
          ...line,
          itemNo: item.ItemCode,
          itemDescription: item.ItemName || '',
          uomCode: String(item.PurchaseUnit || item.InventoryUOM || '').trim(),
          hsnCode: item.HSNCode || '',
          batches: [],
          batchManaged: item.BatchManaged === 'Y',
          inventoryUOM: String(item.InventoryUOM || '').trim(),
          uomFactor: getLineUomFactor({
            uomCode: String(item.PurchaseUnit || item.InventoryUOM || '').trim(),
          }),
          taxCode: !line.taxCodeManuallyOverridden ? (getPreferredLineTaxCode(line.taxCode) || line.taxCode) : line.taxCode,
        };
      }));
    }
    closeItemModal();
  };

  // ── HSN Modal handlers ────────────────────────────────────────────────────
  const openHSNModal = (lineIndex) => setHsnModal({ open: true, lineIndex });
  const closeHSNModal = () => setHsnModal({ open: false, lineIndex: -1 });

  const handleHSNSelect = (hsn) => {
    if (hsnModal.lineIndex >= 0) {
      setLines(prev => prev.map((line, idx) =>
        idx === hsnModal.lineIndex ? { ...line, hsnCode: hsn.code || hsn.Code || '' } : line
      ));
    }
    closeHSNModal();
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

  // ── Copy From handler ─────────────────────────────────────────────────────
  const handleCopyFrom = async (poDocEntry) => {
    try {
      setPageState(p => ({ ...p, loading: true }));
      const res = await fetchPurchaseOrderForCopy(poDocEntry);
      setHeader(prev => ({ ...prev, ...res.data.header }));
      setLines(res.data.lines.map(l => ({ ...createLine(rowUdfDefinitions), ...l, udf: { ...createUdfState(rowUdfDefinitions), ...(l.udf || {}) } })));
      setCopyFromModal(false);
      if (res.data.header.vendor) {
        loadVendorDetails(res.data.header.vendor);
      }
      setPageState(p => ({ ...p, loading: false, success: 'Purchase Order copied successfully.' }));
    } catch (err) {
      setPageState(p => ({ ...p, loading: false, error: 'Failed to copy from Purchase Order.' }));
    }
  };

  const openCopyFromModal = () => {
    if (currentDocEntry) return;

    if (!String(header.vendor || '').trim()) {
      setValErrors({ header: { vendor: 'Select a vendor first.' }, lines: {}, form: '' });
      setPageState((prev) => ({ ...prev, error: '', success: '' }));
      return;
    }

    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState((prev) => ({ ...prev, error: '', success: '' }));
    setCopyFromModal(true);
  };

  const handleCopyTo = async (targetType) => {
    await copyToDocument({
      sourceDocType: 'grpo',
      targetType,
      sourceDocEntry: currentDocEntry,
      sourceDocNo: header.docNo,
      sourcePath: location.pathname,
      sourceSnapshot: { header, lines },
      restoreState: { grpoDocEntry: currentDocEntry },
      navigate,
      upsertTask,
      removeTask,
      setError: (message) => setPageState(p => ({ ...p, success: '', error: message })),
      errorMessage: 'Please save the goods receipt PO first before copying to another document.',
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
      successMessage: 'Goods receipt PO duplicated. Review and add it as a new entry.',
    });

    if (duplicated) {
      refreshDuplicateSeries(refData.series, header.series, handleSeriesChange);
    }
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

  const openBatchModal = (lineIndex) => {
    const line = lines[lineIndex];
    if (!line?.itemNo) {
      setPageState(p => ({ ...p, error: 'Select an item before allocating batches.' }));
      return;
    }
    if (!line?.whse) {
      setPageState(p => ({ ...p, error: 'Select a warehouse before allocating batches.' }));
      return;
    }

    setBatchModal({ open: true, lineIndex, availableBatches: [], loading: true, error: '' });
    window.setTimeout(async () => {
      try {
        const response = await fetchBatchesByItem(line.itemNo, line.whse);
        setBatchModal(current => (
          current.open && current.lineIndex === lineIndex
            ? {
              open: true,
              lineIndex,
              availableBatches: response.data.batches || [],
              loading: false,
              error: '',
            }
            : current
        ));
      } catch (error) {
        setBatchModal(current => (
          current.open && current.lineIndex === lineIndex
            ? {
              open: true,
              lineIndex,
              availableBatches: [],
              loading: false,
              error: getErrMsg(error, 'Failed to load warehouse batches.'),
            }
            : current
        ));
      }
    }, 0);
  };

  const closeBatchModal = () => {
    setBatchModal({ open: false, lineIndex: null, availableBatches: [], loading: false, error: '' });
  };

  const saveLineBatches = (nextBatches) => {
    if (batchModal.lineIndex == null) return;
    setLines(prev => prev.map((line, index) => (
      index === batchModal.lineIndex ? { ...line, batches: nextBatches } : line
    )));
    closeBatchModal();
  };

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const isUpdate = !!currentDocEntry;
    const e = { header: {}, lines: {}, form: '' };

    if (!isUpdate) {
      const vc = String(header.vendor || '').trim();
      if (!vc) { e.header.vendor = 'Select a vendor.'; e.form = 'Please correct the highlighted fields.'; return e; }

      // Place of Supply is mandatory (based on Ship-To warehouse)
      if (!String(header.placeOfSupply || '').trim()) {
        e.header.placeOfSupply = 'Place of Supply is required.';
        e.form = 'Please correct the highlighted fields.';
        return e;
      }
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

      // Validate against open quantity if copying from PO
      if (l.openQty && Number(l.quantity) > Number(l.openQty)) {
        e.lines[i] = {
          ...(e.lines[i] || {}),
          quantity: `Cannot exceed open qty (${l.openQty})`
        };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.uomCode && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), uomCode: 'UoM is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if ((!l.unitPrice || Number(l.unitPrice) <= 0) && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), unitPrice: 'Unit Price must be > 0' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (!l.whse && !isUpdate) {
        e.lines[i] = { ...(e.lines[i] || {}), whse: 'Warehouse is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      if (l.batchManaged) {
        if (!Array.isArray(l.batches) || l.batches.length === 0) {
          e.lines[i] = { ...(e.lines[i] || {}), itemNo: 'Allocate at least one batch for this item.' };
          e.form = 'Please correct the highlighted fields.';
          return e;
        }
        const requiredBatchQty = getRequiredBatchQty(l);
        const assignedBatchQty = sumBatchQty(l.batches);
        const inventoryUOM = l.inventoryUOM || l.uomCode || 'Base UoM';
        if (Math.abs(assignedBatchQty - requiredBatchQty) > BATCH_QTY_TOLERANCE) {
          e.lines[i] = {
            ...(e.lines[i] || {}),
            quantity: `Batch quantity (${assignedBatchQty.toFixed(2)} ${inventoryUOM}) must match base quantity (${requiredBatchQty.toFixed(2)} ${inventoryUOM}).`
          };
          e.form = 'Please correct the highlighted fields.';
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
        series: header.series ? Number(header.series) : undefined,
      };

      const payloadLines = lines.map((line) => ({
        ...line,
        udf: buildVisibleEnteredRowUdfPayload(rowUdfDefinitions, line.udf || {}, formSettings),
      }));
      const payload = { company_id: PURCHASE_ORDER_COMPANY_ID, header: prep, lines: payloadLines, freightCharges: freightModal.freightCharges, header_udfs: headerUdfs };
      const r = currentDocEntry ? await updateGRPO(currentDocEntry, payload) : await submitGRPO(payload);
      const dn = r.data.doc_num ? ` Doc No: ${r.data.doc_num}.` : '';
      setSnapshotPending(false);
      setIsDirty(false);
      setCurrentDocEntry(null); setHeader(INIT_HEADER); setLines([createLine(rowUdfDefinitions)]);
      setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
      setRefData(p => ({
        ...p,
        contacts: [],
        pay_to_addresses: [],
        ship_to_addresses: [],
        bill_to_addresses: [],
      }));
      setValErrors({ header: {}, lines: {}, form: '' });

      if (refData.series.length > 0) {
        handleSeriesChange(refData.series[0].Series);
      }

      setPageState(p => ({ ...p, success: `${r.data.message || 'Goods Receipt PO saved.'}${dn}` }));
    } catch (e) {
      setPageState(p => ({ ...p, error: getErrMsg(e, 'Goods Receipt PO submission failed.') }));
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
  const visibleColumns = BASE_MATRIX_COLUMNS.filter(c => formSettings.matrixColumns?.[c.key]?.visible !== false);
  const visibleRowUdfs = rowUdfDefinitions.filter(f => formSettings.rowUdfs?.[f.key]?.visible !== false);

  // Continue in next message with render...

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form className={`po-page sap-document-page${isRightSidebarOpen ? ' po-page--sidebar-open' : ''}`} onSubmit={handleSubmit} onChangeCapture={markDirty}>

      {/* ── Toolbar ── */}
      <div className="po-toolbar sap-document-toolbar">
        <span className="po-toolbar__title">Goods Receipt PO{currentDocEntry ? ` — #${header.docNo || currentDocEntry}` : ''}</span>
        <button type="submit" className="po-btn po-btn--primary sap-document-toolbar__primary" disabled={pageState.posting}>
          {primaryActionLabel}
        </button>
        <button type="button" className="po-btn po-btn--danger sap-document-toolbar__cancel" onClick={resetForm}>Cancel</button>
        <button type="button" className="po-btn sap-document-toolbar__find" onClick={() => navigate('/grpo/find')}>Find</button>
        <button type="button" className="po-btn sap-document-toolbar__new" onClick={resetForm}>New</button>
        <button type="button" className="po-btn sap-document-toolbar__udf" onClick={toggleHeaderUdfs}>
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button type="button" className="po-btn sap-document-toolbar__settings" onClick={toggleFormSettings}>Form Settings</button>
        <div className="po-dropdown">
          <button
            type="button"
            className="po-btn"
            disabled={!isDocumentEditable || !!currentDocEntry}
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
                openCopyFromModal();
                document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
              }}
            >
              Purchase Orders
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
                handleCopyTo('apInvoice');
                document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
              }}
            >
              A/P Invoice
            </button>
          </div>
        </div>
        {currentDocEntry && (
          <button type="button" className="po-btn sap-document-toolbar__duplicate" onClick={handleDuplicate}>
            Duplicate
          </button>
        )}
        <PurchasePrintLayoutActions
          documentKey="goodsReceiptPo"
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
                    <select name="branch" className="po-field__select" value={header.branch} onChange={handleHeaderChange}>
                      <option value="">Select</option>
                      {refData.branches.map(b => <option key={b.BPLId} value={b.BPLId}>{b.BPLName}</option>)}
                    </select>
                  </div>
                  <div className="po-field">
                    <label className="po-field__label">Warehouse</label>
                    <select name="warehouse" className="po-field__select" value={header.warehouse || ''} onChange={handleHeaderChange}>
                      <option value="">Select Warehouse</option>
                      {branchFilteredWarehouses.map(w => (
                        <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode} - {w.WhsName}</option>
                      ))}
                      {header.warehouse && !branchFilteredWarehouses.some(w => String(w.WhsCode) === String(header.warehouse)) && (
                        <option value={header.warehouse}>{header.warehouse}</option>
                      )}
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
                    <input type="date" name="deliveryDate" className="po-field__input" value={header.deliveryDate} onChange={handleHeaderChange} />
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
                onOpenBatchModal={openBatchModal}
                onOpenItemModal={openItemModal}
                onOpenHSNModal={openHSNModal}
                lineItemOptions={lineItemOptions}
                taxCodeOptions={effectiveTaxCodes}
                warehouseOptions={branchFilteredWarehouses}
                uomOptions={uomOptions}
                formatTaxLabel={fmtTaxLabel}
                valErrors={valErrors}
                visibleColumns={visibleColumns}
                visibleRowUdfs={visibleRowUdfs}
                onRowUdfChange={handleRowUdfChange}
                formSettings={formSettings}
              />
            )}

            {activeTab === 'Logistics' && (
              <LogisticsTab
                header={header}
                onHeaderChange={handleHeaderChange}
                vendorShipToAddresses={vendorEffectiveShipToAddresses}
                vendorPayToAddresses={vendorPayToAddresses}
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
            <div className="po-toolbar" style={{ justifyContent: 'space-between', marginTop: 10 }}>
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
                    disabled={!isDocumentEditable || !!currentDocEntry}
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
                        openCopyFromModal();
                        document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
                      }}
                    >
                      Purchase Orders
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
                        handleCopyTo('apInvoice');
                        document.querySelectorAll('.po-dropdown').forEach((node) => node.classList.remove('active'));
                      }}
                    >
                      A/P Invoice
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

      {/* Copy From Modal */}
      <CopyFromModal
        isOpen={copyFromModal}
        onClose={() => setCopyFromModal(false)}
        onCopy={handleCopyFrom}
        vendorCode={header.vendor}
      />

      <SalesEmployeeSetupModal
        isOpen={salesEmployeeSetup.open}
        rows={salesEmployeeSetup.rows}
        saving={salesEmployeeSetup.saving}
        onClose={closeSalesEmployeeSetup}
        onSave={saveSalesEmployeeSetup}
        onUpdateRow={updateSalesEmployeeSetupRow}
      />

      <BatchAllocationModal
        isOpen={batchModal.open}
        mode="receipt"
        line={batchModal.lineIndex != null ? lines[batchModal.lineIndex] : null}
        availableBatches={batchModal.availableBatches}
        loading={batchModal.loading}
        error={batchModal.error}
        onClose={closeBatchModal}
        onSave={saveLineBatches}
      />

      {/* Item Selection Modal */}
      <ItemSelectionModal
        isOpen={itemModal.open}
        onClose={closeItemModal}
        onSelect={handleItemSelect}
        items={itemModal.items}
        loading={itemModal.loading}
      />

      {/* HSN Code Modal */}
      <HSNCodeModal
        isOpen={hsnModal.open}
        onClose={closeHSNModal}
        onSelect={handleHSNSelect}
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

export default GoodsReceiptPO;
