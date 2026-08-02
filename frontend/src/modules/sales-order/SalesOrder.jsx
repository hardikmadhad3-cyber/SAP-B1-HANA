import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import '../../modules/item-master/styles/itemMaster.css';
import './styles/salesOrder.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import FormSettingsPanel from '../../components/purchase-order/FormSettingsPanel';
import HeaderUdfSidebar from '../../components/purchase-order/HeaderUdfSidebar';
import ContentsTab from './components/ContentsTab';
import LogisticsTab from './components/LogisticsTab';
import AccountingTab from './components/AccountingTab';
import TaxTab from './components/TaxTab';
import ElectronicDocumentsTab from './components/ElectronicDocumentsTab';
import AttachmentsTab from './components/AttachmentsTab';
import ReferenceDocumentsModal from './components/ReferenceDocumentsModal';
import AddressModal from '../../components/document/AddressComponentModal';
import { mapAddressFields, normalizeBusinessPartnerAddress } from '../../utils/documentAddress';
import TaxInfoModal from './components/TaxInfoModal';
import StateSelectionModal from '../../components/common/StateSelectionModal';
import BusinessPartnerModal from './components/BusinessPartnerModal';
import CopyFromModal from '../../components/document/CopyFromModal';
import HSNCodeModal from '../../components/common/HSNCodeModal';
import ItemSelectionModal from '../../components/common/ItemSelectionModal';
import LineValueLookupModal from '../../components/sales-document/LineValueLookupModal';
import DocumentCurrencySelect from '../../components/document/DocumentCurrencySelect';
import SapGoldenArrowButton from '../../components/document/SapGoldenArrowButton';
import PrintSalesOrderActions from './components/PrintSalesOrderActions';
import FreightChargesModal from '../../components/freight/FreightChargesModal';
import { summarizeFreightRows } from '../../components/freight/freightUtils';
import { useSapWindowTaskbarActions } from '../../components/SapWindowTaskbarContext';
import useDocumentDraftTask from '../../hooks/useDocumentDraftTask';
import { determineTaxCode, recalculateAllTaxCodes, getGSTTypeLabel } from '../../utils/taxEngine';
import { filterWarehousesByBranch } from '../../utils/warehouseBranch';
import { hydrateDocumentLineFromItem, mergeItemMaster } from '../../utils/documentItemHydration';
import { calculateDocumentRounding } from '../../utils/documentRounding';
import { getDefaultSeriesForCurrentYear } from '../../utils/seriesDefaults';
import {
    SAP_MANUAL_SERIES_VALUE,
    isManualDocumentSeries,
    isValidManualDocumentNumber,
} from '../../utils/documentSeries';
import { readGeneralSettings } from '../../utils/generalSettingsStorage';
import { useCompanyScopedFormSettings } from '../../utils/formSettingsStorage';
import { buildVisibleEnteredRowUdfPayload } from '../../utils/rowUdfPayload';
import { normalizeLineUdfAliases } from '../../utils/workbookLineHydration';
import { getStateCodeValue, getStateDisplayName } from '../../utils/stateDisplay';
import { findTaxCode, getTaxComponentCodes, taxCodeHasComponent } from '../../utils/taxCodeComponents';
import { getCalculatedForRate } from '../../utils/lineTotals';
import { consumeCopyToState, replaceRouteStatePreservingWindow } from '../../utils/copyToState';
import { openLinkedBusinessPartner, openLinkedReferenceDocument } from '../../utils/sapLinkedNavigation';
import { isRouteStateForActiveCompany } from '../../utils/companyStorageScope';
import { copyToDocument } from '../../services/documentCopyService';
import { duplicateDocumentInPlace } from '../../utils/documentDuplicate';
import useValidationHighlights from '../../utils/useValidationHighlights';
import useSalesEmployeeSetup from '../../hooks/useSalesEmployeeSetup';
import useSalesDocumentLineLookups from '../../hooks/useSalesDocumentLineLookups';
import SalesEmployeeSetupModal from '../../components/sales-employee/SalesEmployeeSetupModal';
import { useRelationshipMapRegistration } from '../../components/relationship-map/RelationshipMapHost';
import { getDocumentLayout } from '../../api/sapLayoutApi';
import {
    fetchSalesOrderByDocEntry,
    fetchSalesOrderCustomerDetails,
    fetchSalesOrderReferenceData,
    submitSalesOrder,
    updateSalesOrder,
    fetchDocumentSeries,
    fetchNextNumber,
    fetchItemsForModal,
    fetchFreightCharges,
    createSalesOrderLookupValue,
    fetchSalesOrderLookupOptions,
    fetchSalesOrderReferenceDocumentLookup,
} from '../../api/salesOrderApi';
import { fetchSalesOrderForCopy as fetchSalesOrderForDeliveryCopy } from '../../api/deliveryApi';
import { fetchHSNCodes, fetchHSNCodeFromItem } from '../../api/hsnCodeApi';
import { salesOrderCopyFromApi, normaliseDocumentHeader, normaliseDocumentLine, unwrapCopyFromDocument, BASE_TYPE } from '../../api/copyFromApi';
import {
    FORM_SETTINGS_STORAGE_KEY,
    HEADER_UDF_DEFINITIONS,
    ROW_UDF_DEFINITIONS,
    BASE_MATRIX_COLUMNS,
    createUdfState,
    filterSalesOrderRowUdfDefinitions,
    normalizeUdfState,
    readSavedFormSettings,
} from '../../config/salesOrderForm';
import {
    buildSalesOrderMatrixColumnsFromLayout,
    SALES_ORDER_LAYOUT_DOCUMENT_TYPE,
} from './documentLayout';

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

const cleanAddressValue = (value) => String(value ?? '').trim();
const joinAddressLine = (...parts) => parts.map(cleanAddressValue).filter(Boolean).join(', ');
const pickAddressComponentFields = (form = {}) => ({
    streetPoBox: form.streetPoBox || '',
    streetNo: form.streetNo || '',
    buildingFloorRoom: form.buildingFloorRoom || '',
    block: form.block || '',
    city: form.city || '',
    zipCode: form.zipCode || '',
    county: form.county || '',
    state: form.state || '',
    countryRegion: form.countryRegion || '',
    addressName2: form.addressName2 || '',
    addressName3: form.addressName3 || '',
    gln: form.gln || '',
    erpAddress: form.erpAddress || '',
    contactPerson: form.contactPerson || '',
    mobile: form.mobile || '',
    dateOfRegistration: form.dateOfRegistration || '',
    dateDetailsOfRegistration: form.dateDetailsOfRegistration || '',
    addressStatus: form.addressStatus || '',
    gstin: form.gstin || '',
});
const formatAddressComponent = (form = {}) => [
    joinAddressLine(form.streetPoBox, form.streetNo),
    cleanAddressValue(form.buildingFloorRoom),
    cleanAddressValue(form.block),
    cleanAddressValue(form.city),
    cleanAddressValue(form.zipCode),
    cleanAddressValue(form.county),
    cleanAddressValue(form.state),
    cleanAddressValue(form.countryRegion),
    cleanAddressValue(form.addressName2),
    cleanAddressValue(form.addressName3),
].filter(Boolean).join('\n');

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

const normalizeSalesOrderReferenceDocuments = (rows = []) => (
    Array.isArray(rows)
        ? rows.map((row) => ({
            direction: row.direction || row.Direction || 'to',
            transactionType: String(row.transactionType ?? row.referencedObjectType ?? row.RefObjType ?? row.RefType ?? ''),
            docEntry: String(row.docEntry ?? row.referencedDocEntry ?? row.RefDocEntr ?? row.RefDocEntry ?? ''),
            docNumber: String(row.docNumber ?? row.referencedDocNumber ?? row.RefDocNum ?? row.RefDocNo ?? ''),
            extDocNumber: String(row.extDocNumber ?? row.externalDocNumber ?? row.ExtDocNum ?? row.ExtDocNo ?? ''),
            issueDate: row.issueDate || row.IssueDate || '',
            remark: row.remark || row.Remark || '',
        })).filter((row) => (
            String(row.transactionType || row.docEntry || row.docNumber || row.extDocNumber || '').trim()
        ))
        : []
);

// ─── static fallbacks ────────────────────────────────────────────────────────
const normalizeTaxInfoAlias = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const TAX_INFO_UDF_ALIASES = {
    panNo: ['U_PANNo', 'U_PAN_No', 'U_PAN'],
    panCircleNo: ['U_PANCircleNo', 'U_PAN_Circle_No'],
    panWardNo: ['U_PANWardNo', 'U_PAN_Ward_No'],
    panAssessingOfficer: ['U_PANAssessingOfficer', 'U_PAN_Assessing_Officer'],
    deducteeRefNo: ['U_DeducteeRefNo', 'U_Deductee_Ref_No'],
    lstVatNo: ['U_LSTVATNo', 'U_LST_VAT_No', 'U_LSTVAT'],
    cstNo: ['U_CSTNo', 'U_CST_No'],
    tanNo: ['U_TANNo', 'U_TAN_No'],
    serviceTaxNo: ['U_ServiceTaxNo', 'U_Service_Tax_No'],
    companyType: ['U_CompanyType', 'U_Company_Type'],
    natureOfBusiness: ['U_NatureOfBusiness', 'U_Nature_Business'],
    assesseeType: ['U_AssesseeType', 'U_Assessee_Type'],
    tinNo: ['U_TINNo', 'U_TIN_No'],
    itrFiling: ['U_ITRFiling', 'U_ITR_Filing'],
    gstType: ['U_GSTType', 'U_GST_Type'],
    gstin: ['U_GSTIN', 'U_GSTINNo', 'U_GSTIN_No'],
};

const getTaxInfoUdfValue = (values = {}, aliases = []) => {
    const entries = Object.entries(values || {});
    for (const alias of aliases) {
        const normalizedAlias = normalizeTaxInfoAlias(alias);
        const match = entries.find(([key]) => normalizeTaxInfoAlias(key) === normalizedAlias);
        if (match && match[1] !== undefined && match[1] !== null && String(match[1]).trim() !== '') {
            return String(match[1]);
        }
    }
    return '';
};

const buildTaxInfoFormFromUdfs = (values = {}, fallback = {}) => (
    Object.entries(TAX_INFO_UDF_ALIASES).reduce((next, [field, aliases]) => {
        const value = getTaxInfoUdfValue(values, aliases);
        if (value !== '') next[field] = value;
        return next;
    }, { ...fallback })
);

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
const FALLBACK_UOM = ['EA', 'PCS', 'KG', 'LTR', 'MTR', 'BOX', 'SET', 'NOS', 'PKT', 'DZN'];
const FALLBACK_WAREHOUSES = [
    { WhsCode: 'WH01', WhsName: 'Main Warehouse' },
    { WhsCode: 'WH02', WhsName: 'Secondary Warehouse' },
];
// ─── constants ────────────────────────────────────────────────────────────────
const DEC = { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 };
const TAB_NAMES = ['Contents', 'Logistics', 'Accounting', 'Tax', 'Electronic Documents', 'Attachments'];

const createLine = (rowUdfDefinitions = ROW_UDF_DEFINITIONS) => ({
    itemServiceType: 'Item',
    itemNo: '', itemDescription: '',
    sellerQuality: '', buyerQuality: '',
    hsnCode: '', quantity: '', unitPrice: '',
    forRate: '',
    sellerPrice: '', buyerPrice: '',
    sellerDelivery: '', buyerDelivery: '',
    sellerBrokerageAmtPer: '', sellerBrokeragePercent: '',
    sellerBrokerage: '', buyerBrokerage: '',
    specialRebate: '', commission: '', sellerBrokeragePerQty: '', unitPriceUdf: '',
    qtySpecialInstruction: '', deliverySpecialInstruction: '',
    buyerPaymentTerms: '', sellerPaymentTerms: '', buyerSpecialInstruction: '', sellerSpecialInstruction: '',
    buyerBillDiscount: '', sellerBillDiscount: '', sellerItem: '', sellerQty: '',
    freightPurchase: '', freightSales: '', freightProvider: '', freightProviderName: '',
    brokerageNumber: '',
    uomCode: '', uomName: '', stdDiscount: '', stcode: '', taxCode: '', total: '', whse: '',
    distRule: '', distRule2: '', distRule3: '', distRule4: '', distRule5: '', freeText: '', countryOfOrigin: '', sacCode: '',
    openQty: '', deliveredQty: '', taxAmount: '', documentCreated: '',
    loc: '', branch: '', lineNum: undefined, baseEntry: null, baseType: null, baseLine: null,
    udf: createUdfState(rowUdfDefinitions),
});

const INIT_HEADER = {
    vendor: '', name: '', contactPerson: '', salesContractNo: '', customerRefNo: '', branch: '', warehouse: '',
    docNo: '', status: 'Open', series: '', nextNumber: '',
    postingDate: today(), deliveryDate: '', documentDate: today(), contractDate: '',
    branchRegNo: '', shipTo: '', shipToCode: '', payTo: '', payToCode: '',
    shippingType: '', confirmed: true, language: '8', printPickingSheet: false,
    procureNonDropShipItems: false, procureDropShipItems: true, allowPartialDelivery: true,
    pickAndPackRemarks: '', bpChannelName: '', bpChannelContact: '',
    journalRemark: '', paymentTerms: '',
    paymentMethod: '', otherInstruction: '', discount: '', freight: '', tax: '',
    totalPaymentDue: '', rounding: false, roundingAmount: '', owner: '', purchaser: '',
    placeOfSupply: '', currency: 'INR', useBillToForTax: false,
    billToAddress: '', billToCode: '', shipToAddress: '',
    shipToAddressComponents: null, billToAddressComponents: null,
    bpProject: '', createQrCodeFrom: '', cancellationDate: '', requiredDate: '',
    indicator: '', orderNumber: '', cashDiscountDateOffset: '', useShippedGoodsAccount: false,
    transactionCategory: '', taxFormNo: '', dutyStatus: 'Y', exportFlag: false,
    differentialTaxRate: '100', supplyCovered: true,
};

const createInitialHeader = (settings = readGeneralSettings()) => ({
    ...INIT_HEADER,
    warehouse: settings.salesWarehouse || '',
    series: settings.salesSeries || '',
    postingDate: today(),
    documentDate: today(),
});

const INIT_ATTACH = Array.from({ length: 9 }, (_, i) => ({
    id: i + 1, targetPath: '', fileName: '', attachmentDate: '',
    freeText: '', copyToTargetDocument: '', documentType: '', atchDocDate: '', alert: '',
}));

const INIT_TAX_INFO_FORM = {
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
};

const getBpGstTypeLabel = (value) => ({
    1: 'Regular/TDS/ISD',
    2: 'Composition',
    3: 'Casual Taxable Person',
    4: 'Government Department',
    5: 'Non-Resident Taxable Person',
    6: 'OIDAR',
    7: 'TDS',
    8: 'TCS',
    9: 'UN Embassy/Body',
})[String(value || '')] || String(value || '');

const closeDocumentDropdowns = () => {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
};

const buildHeaderFieldMap = (fields = []) =>
    (fields || []).reduce((acc, field) => {
        if (field?.key) acc[field.key] = field;
        return acc;
    }, {});

const getHeaderFieldLabel = (fieldMap, key, fallback, forceRequired = false) => {
    const field = fieldMap[key] || {};
    const label = field.label || fallback;
    return (forceRequired || field.required) ? `${label} *` : label;
};

const resolveFormSettingFlag = (field = {}, setting = {}, prop = 'visible') => (
    setting?.[prop] !== undefined ? setting[prop] !== false : field[prop] !== false
);

const buildVisibleHeaderUdfPayload = (definitions = [], values = {}, settings = {}) => {
    const normalized = normalizeUdfState(definitions, values);
    return (definitions || []).reduce((acc, field) => {
        const key = field.key;
        if (!key) return acc;
        const fieldSettings = settings?.headerUdfs?.[key] || {};
        const visible = resolveFormSettingFlag(field, fieldSettings, 'visible');
        const active = resolveFormSettingFlag(field, fieldSettings, 'active');
        if (visible && active) acc[key] = normalized[key];
        return acc;
    }, {});
};

// ─── Main Component ───────────────────────────────────────────────────────────
function SalesOrder() {
    const location = useLocation();
    const navigate = useNavigate();
    const { company } = useAuth();
    const activeCompanyId = company?.companyId || '';
    const activeCompanyDb = company?.dbName || '';
    const { removeTask, upsertTask } = useSapWindowTaskbarActions();
    const formRef = useRef(null);
    const handledCopyFromRef = useRef('');
    const generalSettingsRef = useRef(readGeneralSettings());
    const defaultWarehouseAppliedRef = useRef(false);
    const restoringDraftRef = useRef(false);
    const [isCopyFromClick, setIsCopyFromClick] = useState(false);
    const [currentDocEntry, setCurrentDocEntry] = useState(null);
    const [header, setHeader] = useState(() => createInitialHeader(generalSettingsRef.current));
    const [headerUdfDefinitions, setHeaderUdfDefinitions] = useState(HEADER_UDF_DEFINITIONS);
    const [rowUdfDefinitions, setRowUdfDefinitions] = useState(ROW_UDF_DEFINITIONS);
    const [matrixColumnDefinitions, setMatrixColumnDefinitions] = useState(BASE_MATRIX_COLUMNS);
    const [headerFieldDefinitions, setHeaderFieldDefinitions] = useState([]);
    const [lines, setLines] = useState([createLine()]);
    const [attachments] = useState(INIT_ATTACH);
    const [activeTab, setActiveTab] = useState('Contents');
    const [headerUdfs, setHeaderUdfs] = useState(() => normalizeUdfState(HEADER_UDF_DEFINITIONS));
    const [formSettings, setFormSettings, formSettingsStorageKey] = useCompanyScopedFormSettings(
        FORM_SETTINGS_STORAGE_KEY,
        readSavedFormSettings,
    );
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [formSettingsOpen, setFormSettingsOpen] = useState(false);
    const [refData, setRefData] = useState({
        company: '', vendors: [], contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [], items: [],
        warehouses: [], warehouse_addresses: [], company_address: {}, tax_codes: [], hsn_codes: [],
        payment_terms: [], payment_methods: [], shipping_types: [], branches: [], branches_enabled: false, uom_groups: [], sales_employees: [], owners: [],
        countries: [], distribution_rules: [], distribution_dimensions: [], quality_options: { buyer: [], seller: [] }, price_options: { buyer: [], seller: [] },
        decimal_settings: DEC, warnings: [], series: [], states: [], udf_metadata: { header: [], rows: [] },
        header_field_metadata: { fields: [] }, line_field_metadata: { matrix_columns: BASE_MATRIX_COLUMNS, sap_form: {} }, lookup_sources: {},
    });
    const [pageState, setPageState] = useState({ loading: false, vendorLoading: false, posting: false, error: '', success: '', seriesLoading: false });
    const [valErrors, setValErrors] = useState({ header: {}, lines: {}, form: '' });
    const [snapshotPending, setSnapshotPending] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [addressModal, setAddressModal] = useState(null);
    const [referenceDocumentsModal, setReferenceDocumentsModal] = useState(false);
    const [referenceDocuments, setReferenceDocuments] = useState([]);
    const [referenceDocumentsChanged, setReferenceDocumentsChanged] = useState(false);
    const [taxInfoModal, setTaxInfoModal] = useState(false);
    const [stateModal, setStateModal] = useState(false);
    const [bpModal, setBpModal] = useState(false);
    const [hsnModal, setHsnModal] = useState({ open: false, lineIndex: -1 });
    const [itemModal, setItemModal] = useState({ open: false, lineIndex: -1, items: [], loading: false });
    const [freightModal, setFreightModal] = useState({ open: false, freightCharges: [], loading: false });
    const [copyFromModal, setCopyFromModal] = useState(false);
    const [copyFromMode, setCopyFromMode] = useState(false);
    const [copyFromDocType, setCopyFromDocType] = useState('quotation'); // 'quotation' or 'blanket'
    const headerFieldMap = useMemo(
        () => buildHeaderFieldMap(headerFieldDefinitions),
        [headerFieldDefinitions],
    );
    useValidationHighlights(valErrors, { enabled: !copyFromMode, rootRef: formRef });

    const [addressForm, setAddressForm] = useState({
        shipToCode: '', shipToAddress: '', billToCode: '', billToAddress: '',
        streetPoBox: '', streetNo: '', buildingFloorRoom: '', block: '', city: '', zipCode: '', county: '',
        state: '', countryRegion: '', addressName2: '', addressName3: '', gln: '', gstin: ''
    });
    const [taxInfoForm, setTaxInfoForm] = useState(INIT_TAX_INFO_FORM);
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
        createLookupValue: createSalesOrderLookupValue,
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

    const resolvePreferredSeries = (seriesList, postingDateValue, selectedSeries = '') => {
        if (!Array.isArray(seriesList) || !seriesList.length) return null;

        const normalizedSeries = String(selectedSeries || '').trim();
        const matchedSeries = normalizedSeries
            ? seriesList.find((series) => String(series.Series) === normalizedSeries)
            : null;

        if (matchedSeries) return matchedSeries;

        const preferredSeries = String(generalSettingsRef.current.salesSeries || '').trim();
        const settingsSeries = preferredSeries
            ? seriesList.find((series) => String(series.Series) === preferredSeries)
            : null;

        if (settingsSeries) return settingsSeries;

        const seriesDate = postingDateValue ? new Date(`${postingDateValue}T00:00:00`) : new Date();
        return getDefaultSeriesForCurrentYear(seriesList, seriesDate) || seriesList[0];
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.so-dropdown')) {
                document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
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
    const isUpdateMode = Boolean(currentDocEntry);
    const hasUnsavedChanges = Boolean(currentDocEntry && isDirty);
    const updateActionLabel = hasUnsavedChanges ? 'Update' : 'OK';
    const isSalesOrderHeaderOpen = String(header.status || '').trim().toLowerCase() === 'open';
    const copyQuantityChecks = (lines || [])
        .filter((line = {}) => String(line.itemNo || line.ItemCode || '').trim())
        .map((line = {}) => {
            const rawOpenQty = line.openQty ?? line.OpenQty ?? line.OpenQuantity;
            if (rawOpenQty !== undefined && rawOpenQty !== null && String(rawOpenQty).trim() !== '') {
                return parseNum(rawOpenQty) > 0;
            }

            const lineStatus = String(line.lineStatus ?? line.LineStatus ?? '').trim().toUpperCase();
            if (lineStatus && !['O', 'OPEN'].includes(lineStatus)) return false;

            return null;
        });
    const hasKnownCopyQuantityState = copyQuantityChecks.some((value) => value !== null);
    const hasOpenCopyQuantity = Boolean(currentDocEntry) && lines.some((line = {}) => {
        const rawOpenQty = line.openQty ?? line.OpenQty ?? line.OpenQuantity;
        if (rawOpenQty !== undefined && rawOpenQty !== null && String(rawOpenQty).trim() !== '') {
            return parseNum(rawOpenQty) > 0;
        }

        const lineStatus = String(line.lineStatus ?? line.LineStatus ?? '').trim().toUpperCase();
        if (lineStatus && !['O', 'OPEN'].includes(lineStatus)) return false;

        return parseNum(line.quantity ?? line.Quantity) > 0;
    });
    const canAttemptCopyTo = Boolean(currentDocEntry) && (
        hasOpenCopyQuantity ||
        (isSalesOrderHeaderOpen && !hasKnownCopyQuantityState)
    );
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
        const draft = location.state?.salesOrderDraft;
        if (!draft) return;

        restoringDraftRef.current = true;
        setCurrentDocEntry(draft.currentDocEntry || null);
        setHeader(draft.header || createInitialHeader(generalSettingsRef.current));
        setLines(Array.isArray(draft.lines) && draft.lines.length ? draft.lines : [createLine()]);
        setHeaderUdfs(draft.headerUdfs || normalizeUdfState(HEADER_UDF_DEFINITIONS));
        setReferenceDocuments(Array.isArray(draft.referenceDocuments) ? draft.referenceDocuments : []);
        setReferenceDocumentsChanged(Boolean(draft.referenceDocumentsChanged));
        setActiveTab(draft.activeTab || 'Contents');
        setIsDirty(Boolean(draft.isDirty));
        setReferenceDocumentsModal(Boolean(draft.referenceDocumentsModalOpen));
        if (Array.isArray(draft.freightCharges)) {
            setFreightModal((prev) => ({
                ...prev,
                freightCharges: draft.freightCharges,
                loading: false,
            }));
        }

        const clearDraftStateTimer = window.setTimeout(() => {
            restoringDraftRef.current = false;
            replaceRouteStatePreservingWindow(navigate, location.pathname, location.state);
        }, 0);

        return () => {
            window.clearTimeout(clearDraftStateTimer);
            restoringDraftRef.current = false;
        };
    }, [location.state, navigate, location.pathname]);

    const buildLinkedRestoreState = useCallback((overrides = {}) => ({
        salesOrderDraft: {
            currentDocEntry,
            header,
            lines,
            headerUdfs,
            referenceDocuments: Array.isArray(overrides.referenceDocuments)
                ? overrides.referenceDocuments
                : referenceDocuments,
            referenceDocumentsChanged: overrides.referenceDocumentsChanged ?? referenceDocumentsChanged,
            referenceDocumentsModalOpen: overrides.referenceDocumentsModalOpen ?? referenceDocumentsModal,
            freightCharges: freightModal.freightCharges,
            activeTab,
            isDirty,
        },
    }), [activeTab, currentDocEntry, freightModal.freightCharges, header, headerUdfs, isDirty, lines, referenceDocuments, referenceDocumentsChanged, referenceDocumentsModal]);

    useDocumentDraftTask({
        buildDraftState: buildLinkedRestoreState,
        title: 'Sales Order',
    });

    const openBusinessPartnerLink = useCallback(() => {
        openLinkedBusinessPartner({
            cardCode: header.vendor,
            sourcePath: location.pathname,
            sourceTitle: `Sales Order${header.docNo || currentDocEntry ? ` #${header.docNo || currentDocEntry}` : ''}`,
            sourceRestoreState: buildLinkedRestoreState(),
            navigate,
            upsertTask,
        });
    }, [buildLinkedRestoreState, currentDocEntry, header.docNo, header.vendor, location.pathname, navigate, upsertTask]);

    const resolveReferenceDocEntry = useCallback(async (row) => {
        const currentDocEntryValue = String(row?.docEntry || '').trim();
        if (currentDocEntryValue) return currentDocEntryValue;

        const docNumber = String(row?.docNumber || '').trim();
        const transactionType = String(row?.transactionType || '').trim();
        if (!docNumber || !transactionType) return '';

        const response = await fetchSalesOrderReferenceDocumentLookup({
            transactionType,
            query: docNumber,
            top: 20,
        });
        const options = response.data?.options || [];
        const exactMatch = options.find((option) => String(option.docNumber || '').trim() === docNumber);
        return String((exactMatch || options[0])?.docEntry || '').trim();
    }, []);

    const openReferenceDocumentLink = useCallback(async (row, options = {}) => {
        try {
            const docEntry = await resolveReferenceDocEntry(row);
            if (!docEntry) {
                setPageState(p => ({
                    ...p,
                    success: '',
                    error: 'Referenced document was not found. Choose a document from the lookup first.',
                }));
                return false;
            }

            const opened = openLinkedReferenceDocument({
                transactionType: row?.transactionType,
                docEntry,
                docNumber: row?.docNumber,
                sourcePath: location.pathname,
                sourceTitle: `Sales Order${header.docNo || currentDocEntry ? ` #${header.docNo || currentDocEntry}` : ''}`,
                sourceRestoreState: buildLinkedRestoreState(options),
                navigate,
                upsertTask,
            });

            if (!opened) {
                setPageState(p => ({
                    ...p,
                    success: '',
                    error: 'This referenced document type is not configured for navigation.',
                }));
            }
            return opened;
        } catch (error) {
            setPageState(p => ({
                ...p,
                success: '',
                error: getErrMsg(error, 'Failed to open referenced document.'),
            }));
            return false;
        }
    }, [buildLinkedRestoreState, currentDocEntry, header.docNo, location.pathname, navigate, resolveReferenceDocEntry, upsertTask]);

    useEffect(() => {
        if (!snapshotPending || !currentDocEntry || pageState.loading || pageState.vendorLoading) return;
        setSnapshotPending(false);
    }, [snapshotPending, currentDocEntry, pageState.loading, pageState.vendorLoading, header, lines, headerUdfs]);

    const markDirty = useCallback((event) => {
        if (event?.target?.closest?.('[data-document-dirty-ignore="true"]')) return;
        if (currentDocEntry) {
            setIsDirty(true);
        }
    }, [currentDocEntry]);

    const loadDynamicUdfLookupOptions = useCallback(async (source) => {
        if (!source) return [];
        const response = await fetchSalesOrderLookupOptions(source, { limit: 200 });
        return response.data?.options || [];
    }, []);

    // Continue in next part...

    // ── load reference data ───────────────────────────────────────────────────
    useEffect(() => {
        let ignore = false;
        const pendingRouteDocEntry =
            location.state?.salesOrderDocEntry ||
            location.state?.docEntry ||
            location.state?.document?.docEntry ||
            location.state?.document?.DocEntry;
        const pendingRouteCopyFrom = Boolean(
            location.state?.copyFrom && isRouteStateForActiveCompany(location.state)
        );
        const pendingRouteDraft = Boolean(
            location.state?.salesOrderDraft && isRouteStateForActiveCompany(location.state)
        );
        const hasPendingRouteDocument = Boolean(pendingRouteDocEntry || pendingRouteCopyFrom || pendingRouteDraft || restoringDraftRef.current);
        const load = async () => {
            setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
            try {
                if (!activeCompanyId) {
                    setHeaderUdfDefinitions([]);
                    setRowUdfDefinitions([]);
                    setMatrixColumnDefinitions(BASE_MATRIX_COLUMNS);
                    setHeaderFieldDefinitions([]);
                    setHeaderUdfs({});
                    setLines([createLine([])]);
                    defaultWarehouseAppliedRef.current = false;
                    setRefData(prev => ({
                        ...prev,
                        company: '',
                        vendors: [], contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [],
                        items: [], warehouses: [], warehouse_addresses: [], company_address: {}, tax_codes: [], hsn_codes: [],
                        payment_terms: [], payment_methods: [], shipping_types: [], branches: [], branches_enabled: false, uom_groups: [], sales_employees: [], owners: [],
                        countries: [], distribution_rules: [], distribution_dimensions: [], quality_options: { buyer: [], seller: [] },
                        price_options: { buyer: [], seller: [] }, warnings: [], series: [], states: [], udf_metadata: { header: [], rows: [] },
                        header_field_metadata: { fields: [] }, line_field_metadata: { matrix_columns: BASE_MATRIX_COLUMNS, sap_form: {} },
                        lookup_sources: {},
                    }));
                    return;
                }

                setMatrixColumnDefinitions([]);

                if (!hasPendingRouteDocument) {
                    const resetHeader = createInitialHeader(generalSettingsRef.current);
                    setCurrentDocEntry(null);
                    setSnapshotPending(false);
                    setIsDirty(false);
                    defaultWarehouseAppliedRef.current = false;
                    setHeader(resetHeader);
                    setHeaderUdfs({});
                    setLines([createLine([])]);
                    setFreightModal({ open: false, freightCharges: [], loading: false });
                    setValErrors({ header: {}, lines: {}, form: '' });
                }

                const [refDataRes, hsnRes, layoutRes] = await Promise.all([
                    fetchSalesOrderReferenceData(activeCompanyId),
                    fetchHSNCodes(),
                    getDocumentLayout({
                        companyDb: activeCompanyDb || undefined,
                        documentType: SALES_ORDER_LAYOUT_DOCUMENT_TYPE,
                        objectType: '17',
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
                console.log('  - Payment Methods:', refDataRes.data.payment_methods?.length || 0);
                console.log('  - Shipping Types:', refDataRes.data.shipping_types?.length || 0);
                console.log('  - Branches:', refDataRes.data.branches?.length || 0);
                console.log('  - States:', refDataRes.data.states?.length || 0);
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
                    const usesSapMatrixOrder = Boolean(refDataRes.data.line_field_metadata?.sap_form?.preferenceRows);
                    const nextRowUdfs = usesSapMatrixOrder
                        ? (refDataRes.data.udf_metadata?.rows || [])
                        : filterSalesOrderRowUdfDefinitions(refDataRes.data.udf_metadata?.rows || []);
                    const liveMatrixColumns = refDataRes.data.line_field_metadata?.matrix_columns?.length
                        ? refDataRes.data.line_field_metadata.matrix_columns
                        : BASE_MATRIX_COLUMNS;
                    const nextMatrixColumns = buildSalesOrderMatrixColumnsFromLayout({
                        layoutColumns: layoutRes?.data?.columns || [],
                        liveMatrixColumns,
                        rowUdfFields: nextRowUdfs,
                    });
                    const nextHeaderFields = refDataRes.data.header_field_metadata?.fields || [];
                    const nextUdfMetadata = {
                        ...(refDataRes.data.udf_metadata || {}),
                        rows: nextRowUdfs,
                    };
                    setHeaderUdfDefinitions(nextHeaderUdfs);
                    setRowUdfDefinitions(nextRowUdfs);
                    setMatrixColumnDefinitions(nextMatrixColumns);
                    setHeaderFieldDefinitions(nextHeaderFields);
                    setHeaderUdfs((prev) => hasPendingRouteDocument
                        ? normalizeUdfState(nextHeaderUdfs, prev)
                        : createUdfState(nextHeaderUdfs));
                    setLines((prev) => {
                        if (pendingRouteDraft || restoringDraftRef.current) {
                            return Array.isArray(prev) && prev.length
                                ? prev.map((line) => ({
                                    ...line,
                                    udf: normalizeUdfState(nextRowUdfs, line.udf || {}, { preserveExtra: true }),
                                }))
                                : [createLine(nextRowUdfs)];
                        }

                        const hasLoadedLines = hasPendingRouteDocument && (prev || []).some((line) =>
                            String(line.itemNo || '').trim() || line.lineNum !== undefined
                        );
                        return hasLoadedLines
                            ? prev.map((line) => ({
                                ...line,
                                udf: normalizeUdfState(nextRowUdfs, line.udf || {}),
                            }))
                            : [createLine(nextRowUdfs)];
                    });
                    setFormSettings(readSavedFormSettings(
                        nextHeaderUdfs,
                        nextRowUdfs,
                        nextMatrixColumns,
                        formSettingsStorageKey,
                    ));
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
                        payment_methods: refDataRes.data.payment_methods || [],
                        shipping_types: refDataRes.data.shipping_types || [],
                        branches: refDataRes.data.branches || [],
                        branches_enabled: Boolean(refDataRes.data.branches_enabled ?? (refDataRes.data.branches || []).length > 0),
                        states: refDataRes.data.states || [],
                        uom_groups: refDataRes.data.uom_groups || [],
                        sales_employees: refDataRes.data.sales_employees || [],
                        owners: refDataRes.data.owners || [],
                        countries: refDataRes.data.countries || [],
                        distribution_rules: refDataRes.data.distribution_rules || [],
                        distribution_dimensions: refDataRes.data.distribution_dimensions || [],
                        quality_options: refDataRes.data.quality_options || { buyer: [], seller: [] },
                        price_options: refDataRes.data.price_options || { buyer: [], seller: [] },
                        decimal_settings: { ...DEC, ...(refDataRes.data.decimal_settings || {}) },
                        warnings: [
                            ...(refDataRes.data.warnings || []),
                            ...(layoutRes?.data?.warning ? [layoutRes.data.warning] : []),
                        ],
                        udf_metadata: nextUdfMetadata,
                        header_field_metadata: refDataRes.data.header_field_metadata || { fields: nextHeaderFields },
                        line_field_metadata: {
                            ...(refDataRes.data.line_field_metadata || { sap_form: {} }),
                            matrix_columns: nextMatrixColumns,
                            imported_layout: layoutRes?.data || null,
                        },
                        lookup_sources: refDataRes.data.lookup_sources || {},
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
                if (!ignore) {
                    setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load document series.') }));
                }
            }
        };

        loadSeriesForPostingDate();

        return () => { ignore = true; };
    }, [currentDocEntry, header.postingDate]);

    useEffect(() => {
        const docEntry =
            location.state?.salesOrderDocEntry ||
            location.state?.docEntry ||
            location.state?.document?.docEntry ||
            location.state?.document?.DocEntry;
        if (!docEntry) return;
        if (!isRouteStateForActiveCompany(location.state)) {
            setPageState(p => ({ ...p, loading: false, error: '', success: '' }));
            replaceRouteStatePreservingWindow(navigate, location.pathname, location.state);
            return;
        }
        let ignore = false;
        const load = async () => {
            setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
            try {
                const r = await fetchSalesOrderByDocEntry(docEntry);
                const so = r.data.sales_order;
                let editSeries = [];
                try {
                    const seriesDate = so?.header?.documentDate || so?.header?.postingDate || '';
                    const seriesResponse = await fetchDocumentSeries(seriesDate);
                    editSeries = seriesResponse.data?.series || [];
                } catch (_seriesError) {
                    editSeries = [];
                }

                console.log('📥 Loaded Sales Order:', so);
                console.log('📥 Header data:', so.header);
                console.log('📥 Series:', so.header?.series);

                if (ignore || !so) return;
                setCurrentDocEntry(so.doc_entry || Number(docEntry));

                // Get warehouse from first line if available
                const firstLineWarehouse = so.lines && so.lines.length > 0 ? so.lines[0].whse : '';
                const loadedReferenceDocuments = normalizeSalesOrderReferenceDocuments(
                    so.reference_documents || so.referenceDocuments || []
                );

                console.log('📥 EDIT DATA - Sales Employee:', so.header?.salesEmployee, 'Code:', so.header?.salesEmployee);
                console.log('📥 EDIT DATA - Purchaser:', so.header?.purchaser);
                console.log('📥 EDIT DATA - Owner:', so.header?.owner);
                console.log('📥 EDIT DATA - Remarks:', so.header?.remarks);
                console.log('📥 EDIT DATA - Other Instruction:', so.header?.otherInstruction);
                console.log('📥 EDIT DATA - Freight:', so.header?.freight);
                console.log('📥 EDIT DATA - refData.sales_employees:', refData.sales_employees?.length || 0);
                console.log('📥 EDIT DATA - refData.owners:', refData.owners?.length || 0);

                if (editSeries.length) {
                    setRefData(prev => ({
                        ...prev,
                        series: editSeries,
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
                    salesContractNo: so.header?.customerRefNo || so.header?.salesContractNo || '',
                    customerRefNo: so.header?.customerRefNo || so.header?.salesContractNo || '',
                    docNo: String(so.header?.docNum || ''),
                    nextNumber: String(so.header?.docNum || ''),
                    status: so.header?.status || '',
                    shippingType: so.header?.shippingType || '',
                    confirmed: so.header?.confirmed !== false,
                    language: so.header?.language || so.header?.languageCode || '8',
                    pickAndPackRemarks: so.header?.pickAndPackRemarks || '',
                    bpChannelName: so.header?.bpChannelName || so.header?.bpChannelCode || '',
                    bpChannelContact: so.header?.bpChannelContact || '',
                    journalRemark: so.header?.journalRemark || '',
                    paymentMethod: so.header?.paymentMethod || '',
                    rounding: Boolean(so.header?.rounding),
                    roundingAmount: so.header?.roundingAmount || '',
                    totalPaymentDue: so.header?.totalPaymentDue || '',
                    transactionCategory: so.header?.transactionCategory || '',
                    taxFormNo: so.header?.taxFormNo || '',
                    dutyStatus: so.header?.dutyStatus || 'Y',
                    exportFlag: Boolean(so.header?.exportFlag),
                    differentialTaxRate: so.header?.differentialTaxRate || '100',
                    supplyCovered: so.header?.supplyCovered !== false,
                    currency: so.header?.currency || 'INR',
                };

                console.log('📥 Final header state:', newHeader);
                setHeader(newHeader);
                setReferenceDocuments(loadedReferenceDocuments);
                setReferenceDocumentsChanged(false);
                setFreightModal({ open: false, freightCharges: [], loading: false });

                setLines(
                    Array.isArray(so.lines) && so.lines.length
                        ? so.lines.map((l, index) => {
                            // If HSN is empty, try to get it from item master
                            let hsnCode = l.hsnCode || '';
                            if (!hsnCode && l.itemNo) {
                                const item = refData.items.find(it => String(it.ItemCode) === String(l.itemNo));
                                if (item) {
                                    hsnCode = item.SWW || item.HSNCode || '';
                                }
                            }

                            return {
                                ...createLine(rowUdfDefinitions),
                                ...l,
                                lineNum: l.lineNum ?? l.LineNum ?? index,
                                hsnCode: hsnCode,
                                stcode: l.stcode || '',
                                taxCodeManuallyOverridden: Boolean(String(l.taxCode || l.TaxCode || l.VatGroup || '').trim()),
                                uomName: l.uomName || l.uomCode || '',
                                documentCreated: l.documentCreated || so.header?.documentCreated || '',
                                loc: l.loc || resolveLineLocation(l.whse, l.branch || so.header?.branch || header.branch),
                                udf: normalizeLineUdfAliases(
                                    normalizeUdfState(rowUdfDefinitions, l.udf || {}, { preserveExtra: true }),
                                    l
                                )
                            };
                        })
                        : [createLine(rowUdfDefinitions)]
                );
                const loadedHeaderUdfs = so.header_udfs || {};
                const applyLoadedTaxInfo = () => setTaxInfoForm(current => buildTaxInfoFormFromUdfs(loadedHeaderUdfs, current));
                setHeaderUdfs(normalizeUdfState(headerUdfDefinitions, loadedHeaderUdfs));
                applyLoadedTaxInfo();
                setSnapshotPending(true);
                setIsDirty(false);

                if (so.header?.customerCode) {
                    loadVendorDetails(so.header.customerCode, {
                        billToCode: newHeader.billToCode || newHeader.payToCode,
                    }).then(() => {
                        if (!ignore) applyLoadedTaxInfo();
                    });
                }
                setPageState(p => ({ ...p, success: so.doc_num ? `Sales order ${so.doc_num} loaded.` : 'Sales order loaded.' }));
            } catch (e) {
                if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load sales order.') }));
            } finally {
                if (!ignore) {
                    setPageState(p => ({ ...p, loading: false }));
                    replaceRouteStatePreservingWindow(navigate, location.pathname, location.state);
                }
            }
        };
        load();
        return () => { ignore = true; };
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
    const branchesEnabled = Boolean(refData.branches_enabled ?? (refData.branches || []).length > 0);
    const selectedBranch = branchesEnabled
        ? refData.branches.find(b => String(b.BPLId || '') === String(header.branch || ''))
        : null;
    const uomGroupMap = (refData.uom_groups || []).reduce((acc, g) => { acc[g.AbsEntry] = g.uomCodes || []; return acc; }, {});

    const effectiveTaxCodes = refData.tax_codes || [];
    const effectiveWarehouses = refData.warehouses.length ? refData.warehouses : FALLBACK_WAREHOUSES;
    const freightTotals = summarizeFreightRows(freightModal.freightCharges, effectiveTaxCodes);

    // Filter warehouses by selected branch
    const branchFilteredWarehouses = branchesEnabled
        ? filterWarehousesByBranch(effectiveWarehouses, header.branch)
        : effectiveWarehouses;

    useEffect(() => {
        if (branchesEnabled || !header.branch) return;
        setHeader((prev) => prev.branch ? { ...prev, branch: '' } : prev);
        setLines((prev) => prev.map((line) => (
            line.branch ? { ...line, branch: '', loc: resolveLineLocation(line.whse || header.warehouse, '') } : line
        )));
    }, [branchesEnabled, header.branch, header.warehouse]);

    useEffect(() => {
        if (!branchesEnabled) return;
        if (currentDocEntry || copyFromMode || isCopyFromClick || header.branch) return;
        if ((refData.branches || []).length !== 1) return;
        const onlyBranch = refData.branches[0];
        if (!onlyBranch?.BPLId && onlyBranch?.BPLId !== 0) return;
        setHeader((prev) => prev.branch ? prev : { ...prev, branch: String(onlyBranch.BPLId) });
    }, [branchesEnabled, copyFromMode, currentDocEntry, header.branch, isCopyFromClick, refData.branches]);

    useEffect(() => {
        if (currentDocEntry || copyFromMode || isCopyFromClick || defaultWarehouseAppliedRef.current) return;

        const defaultWarehouse = String(generalSettingsRef.current.salesWarehouse || '').trim();
        if (!defaultWarehouse) {
            defaultWarehouseAppliedRef.current = true;
            return;
        }

        if (!effectiveWarehouses.length) return;

        const warehouse = effectiveWarehouses.find((entry) => String(entry.WhsCode || '') === defaultWarehouse);
        defaultWarehouseAppliedRef.current = true;
        if (!warehouse) return;

        const warehouseBranch = warehouse.BranchID ?? warehouse.BPLid ?? warehouse.BPLId ?? warehouse.BPLID ?? '';
        setHeader((prev) => {
            if (prev.warehouse && String(prev.warehouse) !== defaultWarehouse) return prev;
            return {
                ...prev,
                warehouse: prev.warehouse || defaultWarehouse,
                branch: branchesEnabled
                    ? prev.branch || (warehouseBranch !== '' ? String(warehouseBranch) : '')
                    : '',
            };
        });
    }, [branchesEnabled, copyFromMode, currentDocEntry, effectiveWarehouses, isCopyFromClick]);

    const payTermOpts = refData.payment_terms.length
        ? refData.payment_terms.map(t => ({ value: String(t.GroupNum), label: t.PymntGroup }))
        : FALLBACK_PAYMENT_TERMS;
    const paymentMethodOpts = (refData.payment_methods || []).map(method => ({
        value: String(method.Code || '').trim(),
        label: method.Description
            ? `${method.Code} - ${method.Description}`
            : String(method.Code || '').trim(),
    })).filter(method => method.value);
    const shipTypeOpts = refData.shipping_types.length
        ? refData.shipping_types.map(s => ({ value: String(s.TrnspCode), label: s.TrnspName }))
        : FALLBACK_SHIPPING;
    const resolveSalesOrderAddress = useCallback((code, addresses = [], fallbackText = '') => {
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

    const getWarehouseLocation = (warehouseCode) => {
        if (!warehouseCode) return '';
        const warehouse = effectiveWarehouses.find(w => String(w.WhsCode || '') === String(warehouseCode || ''));
        return warehouse?.City || warehouse?.County || warehouse?.State || '';
    };

    const resolveLineLocation = (warehouseCode, branchId) => (
        getWarehouseLocation(warehouseCode) || getBranchName(branchId) || ''
    );

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
        const rounding = calculateDocumentRounding(
            discSub + freight + taxAmt,
            header.rounding,
            numDec.totalPaymentDue,
        );
        return { subtotal, discAmt, discSub, freight, freightTaxAmt, taxAmt, ...rounding, taxBreakdown: Array.from(taxMap.values()) };
    };

    const totals = calcTotals();
    useRelationshipMapRegistration({
        enabled: Boolean(currentDocEntry),
        objectType: 17,
        docEntry: currentDocEntry,
        header,
        total: totals.total,
    });
    const totalsForDisplay = currentDocEntry && !isDirty
        ? {
            ...totals,
            taxAmt: header.tax !== '' ? parseNum(header.tax) : totals.taxAmt,
            roundingAmount: header.roundingAmount !== '' ? parseNum(header.roundingAmount) : totals.roundingAmount,
            total: header.totalPaymentDue !== '' ? parseNum(header.totalPaymentDue) : totals.total,
        }
        : totals;

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
       if (copyFromMode || isCopyFromClick) return;
        if (header.branch) {
            console.log('🔄 Syncing branch to all lines:', header.branch);
            setLines(prev => {
                const updated = prev.map(l => ({
                    ...l,
                    branch: String(header.branch),
                    loc: resolveLineLocation(l.whse || header.warehouse, header.branch)
                }));
                console.log('✅ Lines updated with branch:', updated.map(l => ({ branch: l.branch, loc: l.loc })));
                return updated;
            });
        }
    }, [copyFromMode, header.branch, header.warehouse, isCopyFromClick, refData.warehouses.length]);

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
                ? { ...line, whse: '', loc: resolveLineLocation('', line.branch || header.branch) }
                : line
        )));
    }, [branchFilteredWarehouses, header.branch, refData.warehouses.length]);

    // Sync warehouse to all lines when header warehouse changes
    useEffect(() => {
        if (copyFromMode || isCopyFromClick) return;
        if (header.warehouse) {
            setLines(prev => prev.map(l => ({
                ...l,
                whse: header.warehouse,
                loc: resolveLineLocation(header.warehouse, l.branch || header.branch)
            })));

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
        const updatedLines = recalculateAllTaxCodes(
            lines,
            refData.items,
            header.placeOfSupply,  // shipToState
            header.placeOfSupply,  // billToState
            false,                 // useBillToForTax
            companyState,
            effectiveTaxCodes
        );

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
    const updateTaxInfoFromAddress = useCallback((address = null) => {
        if (!address) {
            setTaxInfoForm((current) => ({
                ...current,
                panNo: '',
                gstType: '',
                gstin: '',
            }));
            return;
        }

        const gstin = String(address.GSTIN || address.GSTRegnNo || '').trim();
        const gstType = getBpGstTypeLabel(address.GSTType || address.GstType || address.gstType);
        setTaxInfoForm((current) => ({
            ...current,
            panNo: gstin.length >= 12 ? gstin.slice(2, 12) : '',
            gstType: gstType || '',
            gstin,
        }));
    }, []);

    const loadVendorDetails = async (code, options = {}) => {
        if (!code) {
            setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [], ship_to_addresses: [], bill_to_addresses: [] }));
            updateTaxInfoFromAddress(null);
            return;
        }

        setPageState(p => ({ ...p, vendorLoading: true }));

        try {
            const r = await fetchSalesOrderCustomerDetails(code);

            const normalizeAddresses = (rows) => (Array.isArray(rows) ? rows : [])
                .map((address) => normalizeBusinessPartnerAddress(address, code))
                .filter((address) => address.Address);
            const contacts = (Array.isArray(r.data.contacts) ? r.data.contacts : []).map((contact) => ({
                ...contact,
                CardCode: String(contact.CardCode || code).trim(),
            }));
            const payToAddresses = normalizeAddresses(r.data.pay_to_addresses);
            const shipToAddresses = normalizeAddresses(r.data.ship_to_addresses);
            const billToAddresses = normalizeAddresses(r.data.bill_to_addresses);
            setRefData(p => ({
                ...p,
                contacts: contacts,
                pay_to_addresses: payToAddresses,
                ship_to_addresses: shipToAddresses,
                bill_to_addresses: billToAddresses
            }));

            const selectedBillToCode = options.billToCode || header.billToCode || header.payToCode || '';
            const selectedTaxAddress = billToAddresses.find((address) => (
                String(address.Address || '') === String(selectedBillToCode)
            )) || billToAddresses[0] || payToAddresses[0] || shipToAddresses[0] || null;
            updateTaxInfoFromAddress(selectedTaxAddress);

            if (contacts.length > 0) {
                setHeader(prev => ({
                    ...prev,
                    contactPerson: prev.contactPerson || contacts[0].CntctCode
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

    const getDefaultJournalRemark = (code) => {
        const normalizedCode = String(code || '').trim();
        return normalizedCode ? `Sales Orders - ${normalizedCode}` : '';
    };

    const getDefaultPaymentMethod = (bp = {}) => (
        String(bp.PaymentMethod || bp.PymCode || bp.PeymentMethodCode || '').trim()
    );

    const syncVendor = (code, hdr) => {
        const m = refData.vendors.find(v => String(v.CardCode || '') === String(code || ''));
        if (!m) return { nextHeader: hdr };
        return {
            nextHeader: {
                ...hdr,
                name: m.CardName || hdr.name,
                journalRemark: getDefaultJournalRemark(code),
                paymentTerms: m.PayTermsGrpCode != null ? String(m.PayTermsGrpCode) : hdr.paymentTerms,
                paymentMethod: getDefaultPaymentMethod(m) || hdr.paymentMethod,
                contactPerson: '',
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
            markDirty();
            setHeader(p => ({ ...p, [name]: sanitize(value, numDec[name]) }));
            return;
        }
        markDirty();
        setHeader(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleShipToChange = (addressCode) => {
        markDirty();
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
        markDirty();
        if (!addressCode || !header.vendor) {
            setHeader(p => ({ ...p, billToCode: addressCode, billToAddress: '' }));
            return;
        }

        const addr = vendorEffectiveBillToAddresses.find(a => String(a.Address || '') === addressCode)
            || vendorEffectiveShipToAddresses.find(a => String(a.Address || '') === addressCode);
        if (addr) {
            updateTaxInfoFromAddress(addr);
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

    const handleLineChange = async (i, e) => {
        const { name, value } = e.target;
        markDirty();
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
                        const next = { ...line, itemNo: value, forRate: '', taxCodeManuallyOverridden: false };

                        // Step 1: Set Item Details
                        next.itemDescription = item.ItemName || next.itemDescription;
                        next.uomCode = String(item.SalesUnit || item.InventoryUOM || '').trim();
                        next.uomName = next.uomName || next.uomCode;
                        next.countryOfOrigin = item.ItemCountryOrg || next.countryOfOrigin || '';
                        next.sacCode = item.SACEntry || next.sacCode || '';
                        next.distRule = next.distRule || item.DistributionRule || '';
                        next.whse = next.whse || item.DefaultWarehouse || header.warehouse || '';
                        next.loc = resolveLineLocation(next.whse, next.branch || header.branch);
                        next.openQty = next.openQty || '';

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
                            next.stcode = next.stcode || '';
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
                                next.stcode = next.stcode || '';
                                console.log('✅ Tax Code Auto-Selected:', {
                                    gstType: getGSTTypeLabel(companyState, gstState),
                                    taxCode: determinedTaxCode
                                });
                            } else {
                                console.warn('⚠️ Could not determine tax code');
                                next.taxCode = '';
                                next.stcode = next.stcode || '';
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
                    const next = { ...line, itemNo: value, forRate: '', taxCodeManuallyOverridden: false };
                    const item = refData.items.find(it => String(it.ItemCode || '') === String(value || ''));
                    if (item) {
                        next.itemDescription = item.ItemName || next.itemDescription;
                        next.uomCode = String(item.SalesUnit || item.InventoryUOM || '').trim();
                        next.uomName = next.uomName || next.uomCode;
                        next.hsnCode = item.SWW || item.HSNCode || item.U_HSNCode || next.hsnCode || '';
                        next.countryOfOrigin = item.ItemCountryOrg || next.countryOfOrigin || '';
                        next.sacCode = item.SACEntry || next.sacCode || '';
                        next.distRule = next.distRule || item.DistributionRule || '';
                        next.whse = next.whse || item.DefaultWarehouse || header.warehouse || '';
                        next.loc = resolveLineLocation(next.whse, next.branch || header.branch);
                        next.stcode = next.stcode || '';
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
                if (['unitPrice', 'stdDiscount', 'taxCode'].includes(name)) next.forRate = '';
                if (name === 'uomCode') next.uomName = value;
                if (name === 'taxCode') {
                    next.stcode = next.stcode || '';
                    next.taxCodeManuallyOverridden = Boolean(String(next.taxCode || '').trim());
                }
                if (name === 'whse') next.loc = resolveLineLocation(next.whse, next.branch || header.branch);
                next.total = fmtDec(calcLineTotal(next), numDec.total);
                return next;
            }));
        }
    };

    const handleDistributionRuleChange = (lineIndex, valuesByDimension = {}) => {
        const fieldByDimension = {
            1: 'distRule',
            2: 'distRule2',
            3: 'distRule3',
            4: 'distRule4',
            5: 'distRule5',
        };

        markDirty();
        setValErrors(p => ({ ...p, lines: { ...p.lines, [lineIndex]: { ...(p.lines[lineIndex] || {}), distRule: '' } }, form: '' }));
        setPageState(p => ({ ...p, error: '', success: '' }));
        setLines(prev => prev.map((line, idx) => {
            if (idx !== lineIndex) return line;
            const next = { ...line };
            Object.entries(valuesByDimension).forEach(([dimensionCode, ruleCode]) => {
                const fieldName = fieldByDimension[Number(dimensionCode)];
                if (fieldName) next[fieldName] = ruleCode || '';
            });
            return next;
        }));
    };

    const handleNumBlur = (field, target = 'line', i = null) => {
        const d = numDec[field];
        if (d === undefined) return;
        if (target === 'header') { setHeader(p => ({ ...p, [field]: fmtDec(p[field], d) })); return; }
        setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: fmtDec(l[field], d) } : l));
    };

    const addLine = () => {
        markDirty();
        // 🚨 SKIP ALL VALIDATION DURING COPY MODE
        if (copyFromMode) {
            setLines(p => [...p, {
                ...createLine(rowUdfDefinitions),
                branch: header.branch || '',
                loc: resolveLineLocation(header.warehouse, header.branch),
                whse: header.warehouse || ''
            }]);
            return;
        }
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
        setLines(p => [...p, {
            ...createLine(rowUdfDefinitions),
            branch: header.branch || '',
            loc: resolveLineLocation(header.warehouse, header.branch),
            whse: header.warehouse || ''
        }]);
    };

    const removeLine = (i) => {
        setValErrors(p => { const nl = { ...p.lines }; delete nl[i]; return { ...p, lines: nl, form: '' }; });
        setLines(p => p.filter((_, idx) => idx !== i));
    };

    const handleHeaderUdfChange = (k, v) => {
        markDirty();
        setHeaderUdfs(p => ({ ...p, [k]: v }));
    };
    const handleRowUdfChange = (i, k, v) => setLines(p => p.map((l, idx) => idx === i ? { ...l, udf: { ...(l.udf || {}), [k]: v } } : l));
    const updateFormSetting = (g, k, prop, val) => setFormSettings((p) => {
        const current = ((p[g] || {})[k] || {});
        return { ...p, [g]: { ...(p[g] || {}), [k]: { ...current, [prop]: val } } };
    });
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
        const shipAddress = resolveSalesOrderAddress(
            header.shipToCode,
            vendorEffectiveShipToAddresses,
            header.shipToAddress || header.shipTo,
        );
        const billAddress = resolveSalesOrderAddress(
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
            const selectedAddress = resolveSalesOrderAddress(value, vendorEffectiveShipToAddresses);
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
            const selectedAddress = resolveSalesOrderAddress(value, vendorEffectiveBillToAddresses);
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
    // ── Tax Info Modal handlers ───────────────────────────────────────────────
    const openReferenceDocumentsModal = () => {
        setReferenceDocumentsModal(true);
    };

    const closeReferenceDocumentsModal = () => {
        setReferenceDocumentsModal(false);
    };

    const saveReferenceDocumentsModal = (rows) => {
        setReferenceDocuments(normalizeSalesOrderReferenceDocuments(rows));
        setReferenceDocumentsChanged(true);
        if (currentDocEntry) setIsDirty(true);
        setReferenceDocumentsModal(false);
    };

    const openTaxInfoModal = () => {
        setTaxInfoModal(true);
    };

    const closeTaxInfoModal = () => {
        setTaxInfoModal(false);
    };

    const saveTaxInfoModal = () => {
        setIsDirty(true);
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
    const closeItemModal = () => {
        setItemModal({ open: false, lineIndex: -1, items: [], loading: false });
    };

    const openItemModalSafe = async (lineIndex) => {
        const fallbackItems = Array.isArray(refData.items) ? refData.items : [];

        setItemModal({
            open: true,
            lineIndex,
            items: fallbackItems,
            loading: fallbackItems.length === 0
        });

        try {
            const selectedWarehouse = lines[lineIndex]?.whse || header.warehouse || '';
            const response = await fetchItemsForModal(selectedWarehouse);
            const payload = response?.data;
            const normalizedItems = Array.isArray(payload?.items)
                ? payload.items
                : Array.isArray(payload)
                    ? payload
                    : [];

            setItemModal((prev) => ({
                ...prev,
                items: normalizedItems.length > 0 ? normalizedItems : fallbackItems,
                loading: false,
            }));
        } catch (error) {
            console.error('Failed to load items for Sales Order modal:', error);
            setItemModal((prev) => ({
                ...prev,
                items: prev.items.length > 0 ? prev.items : fallbackItems,
                loading: false,
            }));
        }
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
                    resolveLineLocation,
                    headerBranch: header.branch,
                    calcLineTotal,
                    formatTotal: (value) => fmtDec(value, numDec.total),
                });

                // Auto-determine tax code
                const gstState = header.placeOfSupply;
                const companyState = refData.company_address?.State || selectedBranch?.State || '';

                if (gstState && companyState) {
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
                        next.stcode = next.stcode || '';
                    }
                }

                if (!next.stcode) {
                    next.stcode = next.stcode || '';
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
                return {
                    ...line,
                    ...hydrateDocumentLineFromItem(line, mergedItem, {
                        side: 'sales',
                        fallbackWarehouse: header.warehouse,
                        resolveLineLocation,
                        headerBranch: header.branch,
                        calcLineTotal,
                        formatTotal: (value) => fmtDec(value, numDec.total),
                    }),
                };
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
    const handleCopyFrom = (data, docType) => {
        const copySource = unwrapCopyFromDocument(data);
        const baseType = BASE_TYPE[docType] || 23;
        const normHeader = normaliseDocumentHeader(copySource.header);
        const sourceHeaderUdfs = copySource.document?.header_udfs || copySource.source?.header_udfs || data?.header_udfs || {};
        const sourceFreightCharges = copySource.document?.freightCharges || copySource.source?.freightCharges || data?.freightCharges || [];

        const rawLines = copySource.lines;
        const copiedLines = rawLines.map((line, idx) => ({
            ...createLine(rowUdfDefinitions),
            ...normaliseDocumentLine(line, idx, copySource.docEntry, baseType, normHeader.branch),
            stcode: line.STCODE || line.STACode || line.stcode || '',
            taxCodeManuallyOverridden: Boolean(String(line.TaxCode || line.VatGroup || line.taxCode || '').trim()),
            documentCreated: line.DocumentCreated || line.documentCreated || copySource.header.DocumentCreated || normHeader.documentCreated || '',
            loc: line.loc || resolveLineLocation(line.WarehouseCode || line.WhsCode || line.whse || '', normHeader.branch),
        }));
        const firstLineWarehouse = copiedLines.find(line => String(line.whse || '').trim())?.whse || '';

        setHeader(prev => ({
            ...prev,
            ...normHeader,
            warehouse: normHeader.warehouse || firstLineWarehouse || prev.warehouse || '',
        }));
        setLines(copiedLines.length > 0 ? copiedLines : [createLine(rowUdfDefinitions)]);
        setHeaderUdfs(normalizeUdfState(headerUdfDefinitions, sourceHeaderUdfs));
        setFreightModal({ open: false, freightCharges: Array.isArray(sourceFreightCharges) ? sourceFreightCharges : [], loading: false });

        if (normHeader.vendor) loadVendorDetails(normHeader.vendor);

        setCopyFromModal(false);
        setCopyFromMode(false);
    };

    // ── Copy From Modal Handlers ───────────────────────────────────────────────
    useEffect(() => {
        const routedCopyFrom = location.state?.copyFrom;
        if (routedCopyFrom && !isRouteStateForActiveCompany(location.state)) {
            replaceRouteStatePreservingWindow(navigate, location.pathname, location.state);
            return;
        }

        const persistedCopyState = routedCopyFrom ? null : consumeCopyToState(location.pathname, ['/sales-order']);
        const copyFrom = routedCopyFrom || persistedCopyState?.copyFrom;

        if (!copyFrom || copyFrom.type !== 'salesQuotation') return;

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
        setCurrentDocEntry(null);
        setSnapshotPending(false);
        setIsDirty(false);
        setValErrors({ header: {}, lines: {}, form: '' });
        setFreightModal({ open: false, freightCharges: [], loading: false });
        handleCopyFrom({
            ...(copyFrom.header || {}),
            header: copyFrom.header || {},
            DocumentLines: copyFrom.lines || [],
            DocEntry: copyFrom.docEntry,
        }, copyFrom.type);

        const sourceLabel = copyFrom.sourceLabel || 'Sales Quotation';
        setPageState(p => ({ ...p, error: '', success: `Copied from ${sourceLabel}. Please review and save.` }));
        replaceRouteStatePreservingWindow(navigate, location.pathname, location.state || persistedCopyState);
    }, [location.pathname, location.state?.copyFrom, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

    const openCopyFromModal = (docType) => {
        if (currentDocEntry) return;

        console.log('🟢 Copy From Clicked');

        // ✅ ONLY BUYER VALIDATION
        const buyerCode = String(header.vendor || '').trim();

        if (!buyerCode) {
            setValErrors({
                header: { vendor: 'Select Buyer first' },
                lines: {},
                form: ''
            });
            return;
        }

        // ✅ ENABLE COPY MODE
        setCopyFromMode(true);

        // ✅ CLEAR ALL ERRORS
        setValErrors({ header: {}, lines: {}, form: '' });
        setPageState(p => ({ ...p, error: '', success: '' }));

        setCopyFromDocType(docType);
        setCopyFromModal(true);
    };
    const fetchCopyFromDocuments = async (docType) => {
        try {
            const buyerCode = String(header.vendor || '').trim();
            if (!buyerCode) return [];
            return await salesOrderCopyFromApi.fetchOpenDocuments(docType, buyerCode);
        } catch (error) {
            console.error('Error fetching documents:', error);
            throw error;
        }
    };

    const fetchCopyFromDocumentDetails = async (docType, docEntry) => {
        try {
            return await salesOrderCopyFromApi.fetchDocumentForCopy(docType, docEntry);
        } catch (error) {
            console.error('Error fetching document details:', error);
            throw error;
        }
    };

    // ── Copy To Handler ────────────────────────────────────────────────────────
    const handleCopyTo = async (targetType) => {
        if (currentDocEntry && hasKnownCopyQuantityState && !hasOpenCopyQuantity) {
            setPageState(p => ({
                ...p,
                success: '',
                error: 'This Sales Order has no open quantity left. Use the related Delivery to create the A/R Invoice.',
            }));
            return;
        }

        let sourceSnapshot = { header, lines, headerUdfs };
        if (targetType === 'delivery' && currentDocEntry) {
            try {
                const response = await fetchSalesOrderForDeliveryCopy(currentDocEntry);
                const copyDocument = response.data?.sales_order || response.data?.salesOrder || response.data?.document || response.data || {};
                const copyLines = Array.isArray(copyDocument.lines) ? copyDocument.lines : [];
                if (!copyLines.length) {
                    setPageState(p => ({
                        ...p,
                        success: '',
                        error: 'This Sales Order is open, but it has no open item quantity available for Delivery.',
                    }));
                    return;
                }
                sourceSnapshot = {
                    header: copyDocument.header || header,
                    lines: copyLines,
                    headerUdfs: copyDocument.headerUdfs || copyDocument.header_udfs || headerUdfs,
                };
            } catch (error) {
                setPageState(p => ({
                    ...p,
                    success: '',
                    error: getErrMsg(error, 'Could not load open Sales Order lines for Delivery.'),
                }));
                return;
            }
        }

        await copyToDocument({
            sourceDocType: 'salesOrder',
            targetType,
            sourceDocEntry: currentDocEntry,
            sourceDocNo: header.docNo,
            sourcePath: '/sales-order',
            sourceSnapshot,
            restoreState: { salesOrderDocEntry: currentDocEntry },
            navigate,
            upsertTask,
            removeTask,
            beforeNavigate: closeDocumentDropdowns,
            setError: (message) => setPageState(p => ({ ...p, success: '', error: message })),
            errorMessage: pageState.loading
                ? 'Please wait until the sales order has finished loading before using Copy To.'
                : 'Open a saved sales order before using Copy To.',
        });
    };

    const handleDuplicate = () => {
        const duplicateDate = today();
        const duplicated = duplicateDocumentInPlace({
            currentDocEntry,
            header,
            initialHeader: createInitialHeader(generalSettingsRef.current),
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
            successMessage: 'Sales order duplicated. Review and add it as a new entry.',
        });

        if (duplicated) {
            setHeader(prev => ({
                ...prev,
                postingDate: duplicateDate,
                documentDate: duplicateDate,
                deliveryDate: duplicateDate,
                series: '',
                nextNumber: '',
            }));
            const defaultSeries = resolvePreferredSeries(refData.series, duplicateDate, '');
            if (defaultSeries?.Series != null) {
                handleSeriesChange(defaultSeries.Series);
            }
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

    // Continue in next part...

    // ── validation ────────────────────────────────────────────────────────────
    const validate = () => {
        // 🚨 GLOBAL BYPASS FOR COPY MODE
        if (copyFromMode) {
            console.log('🚫 Validation skipped (Copy Mode)');
            return { header: {}, lines: {}, form: '' };
        }

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

        if (branchesEnabled && !String(header.branch || '').trim()) {
            e.header.branch = 'Branch is required.';
            e.form = 'Please correct the highlighted fields.';
            return e;
        }

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
        if (copyFromMode) {
            console.log('⚠️ Submit blocked in Copy Mode');
            return;
        }
        ev.preventDefault();

        // 🚨 Don't submit if in copy mode
        if (copyFromMode) {
            console.log('⚠️ Form submission blocked - Copy From mode is active');
            return;
        }

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
                customerRefNo: header.customerRefNo || header.salesContractNo || '',
                deliveryDate: header.deliveryDate || header.postingDate || header.documentDate,
                placeOfSupply: header.placeOfSupply,
                branch: header.branch,
                contactPerson: header.contactPerson,
                series: header.series ? Number(header.series) : undefined,
            };

            // Clean lines - remove any readonly/computed fields
            const cleanedLines = lines.map(line => ({
                lineNum: line.lineNum,
                itemServiceType: line.itemServiceType,
                itemNo: line.itemNo,
                itemDescription: line.itemDescription,
                sellerQuality: line.sellerQuality,
                buyerQuality: line.buyerQuality,
                hsnCode: line.hsnCode,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                forRate: line.forRate || getCalculatedForRate(line, effectiveTaxCodes),
                sellerPrice: line.sellerPrice,
                buyerPrice: line.buyerPrice,
                sellerDelivery: line.sellerDelivery,
                buyerDelivery: line.buyerDelivery,
                sellerBrokerageAmtPer: line.sellerBrokerageAmtPer,
                sellerBrokeragePercent: line.sellerBrokeragePercent,
                sellerBrokerage: line.sellerBrokerage,
                buyerBrokerage: line.buyerBrokerage,
                specialRebate: line.specialRebate,
                commission: line.commission,
                sellerBrokeragePerQty: line.sellerBrokeragePerQty,
                unitPriceUdf: line.unitPriceUdf,
                qtySpecialInstruction: line.qtySpecialInstruction,
                deliverySpecialInstruction: line.deliverySpecialInstruction,
                buyerPaymentTerms: line.buyerPaymentTerms,
                sellerPaymentTerms: line.sellerPaymentTerms,
                buyerSpecialInstruction: line.buyerSpecialInstruction,
                sellerSpecialInstruction: line.sellerSpecialInstruction,
                buyerBillDiscount: line.buyerBillDiscount,
                sellerBillDiscount: line.sellerBillDiscount,
                sellerItem: line.sellerItem,
                sellerQty: line.sellerQty,
                freightPurchase: line.freightPurchase,
                freightSales: line.freightSales,
                freightProvider: line.freightProvider,
                freightProviderName: line.freightProviderName,
                brokerageNumber: line.brokerageNumber,
                uomCode: line.uomCode,
                stdDiscount: line.stdDiscount,
                stcode: line.stcode,
                taxCode: line.taxCode,
                total: line.total,
                whse: line.whse,
                distRule: line.distRule,
                distRule2: line.distRule2,
                distRule3: line.distRule3,
                distRule4: line.distRule4,
                distRule5: line.distRule5,
                freeText: line.freeText,
                countryOfOrigin: line.countryOfOrigin,
                sacCode: line.sacCode,
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
                header_udfs: buildVisibleHeaderUdfPayload(headerUdfDefinitions, headerUdfs, formSettings),
                tax_info: taxInfoForm,
                reference_documents: referenceDocuments,
                reference_documents_changed: referenceDocumentsChanged || (!currentDocEntry && referenceDocuments.length > 0),
            };

            // ═══ LOGGING: Payload Before Submit ═══
            console.log('═══════════════════════════════════════════════════');
            console.log('📤 SUBMITTING SALES ORDER:');
            console.log('Header:', prep);
            console.log('Lines:', cleanedLines);
            console.log('Header UDFs:', headerUdfs);
            console.log('═══════════════════════════════════════════════════');

            const r = currentDocEntry ? await updateSalesOrder(currentDocEntry, payload) : await submitSalesOrder(payload);
            const dn = r.data.doc_num ? ` Doc No: ${r.data.doc_num}.` : '';
            defaultWarehouseAppliedRef.current = false;
            const resetHeader = createInitialHeader(generalSettingsRef.current);
            setSnapshotPending(false);
            setIsDirty(false);
            setCurrentDocEntry(null); setHeader(resetHeader); setLines([createLine(rowUdfDefinitions)]);
            setReferenceDocuments([]);
            setReferenceDocumentsChanged(false);
            setFreightModal({ open: false, freightCharges: [], loading: false });
            setTaxInfoForm(INIT_TAX_INFO_FORM);
            setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
            setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [] }));
            setValErrors({ header: {}, lines: {}, form: '' });

            const defaultSeries = resolvePreferredSeries(refData.series, resetHeader.postingDate);
            if (defaultSeries?.Series != null) {
                handleSeriesChange(defaultSeries.Series);
            }

            setPageState(p => ({ ...p, success: `${r.data.message || 'Sales order saved.'}${dn}` }));
        } catch (e) {
            console.error('❌ Sales Order Submission Error:', e);
            console.error('Error Response:', e.response?.data);
            setPageState(p => ({ ...p, error: getErrMsg(e, 'Sales order submission failed.') }));
        } finally {
            setPageState(p => ({ ...p, posting: false }));
        }
    };

    const resetForm = () => {
        defaultWarehouseAppliedRef.current = false;
        const resetHeader = createInitialHeader(generalSettingsRef.current);
        setSnapshotPending(false);
        setIsDirty(false);
        setCurrentDocEntry(null); setHeader(resetHeader); setLines([createLine(rowUdfDefinitions)]);
        setReferenceDocuments([]);
        setReferenceDocumentsChanged(false);
        setFreightModal({ open: false, freightCharges: [], loading: false });
        setTaxInfoForm(INIT_TAX_INFO_FORM);
        setHeaderUdfs(createUdfState(headerUdfDefinitions)); setActiveTab('Contents');
        setValErrors({ header: {}, lines: {}, form: '' });
        setPageState(p => ({ ...p, error: '', success: '' }));

        const defaultSeries = resolvePreferredSeries(refData.series, resetHeader.postingDate);
        if (defaultSeries?.Series != null) {
            handleSeriesChange(defaultSeries.Series);
        }
    };

    const visHdrUdfs = headerUdfDefinitions.filter((field) => (
        resolveFormSettingFlag(field, formSettings.headerUdfs?.[field.key] || {}, 'visible')
    ));
    const visibleRowUdfs = rowUdfDefinitions.filter((field) => (
        resolveFormSettingFlag(field, formSettings.rowUdfs?.[field.key] || {}, 'visible')
    ));
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
        <form ref={formRef} className={`so-page sap-document-page so-sales-order-page${isRightSidebarOpen ? ' so-page--sidebar-open' : ''}`} onSubmit={handleSubmit} onChangeCapture={markDirty}>

            {/* toolbar */}
            <div className="so-toolbar sap-document-toolbar">
                <span className="so-toolbar__title">Sales Order{currentDocEntry ? ` — #${header.docNo || currentDocEntry}` : ''}</span>
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
                <PrintSalesOrderActions
                    docEntry={currentDocEntry}
                    docNumber={header.docNo}
                    series={header.series}
                    cardCode={header.vendor}
                    disabled={pageState.posting}
                    onSuccess={(message) => setPageState(p => ({ ...p, error: '', success: message }))}
                    onError={(message) => setPageState(p => ({ ...p, success: '', error: message }))}
                />

                {/* Copy From Dropdown */}
                <div className="so-dropdown">
                    <button
                        type="button"
                        className="so-btn"
                        disabled={!isDocumentEditable || !!currentDocEntry || !hasBuyerCode}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (currentDocEntry || !hasBuyerCode) return;

                            console.log('🔵 Copy From dropdown clicked');

                            setIsCopyFromClick(true);   // 🚀 ADD THIS
                            // // ✅ FIRST: Activate copy mode to disable all validation
                            // setCopyFromMode(true);

                            // ✅ SECOND: Clear all validation errors immediately
                            setValErrors({ header: {}, lines: {}, form: '' });
                            setPageState({ error: '', success: '', loading: false, posting: false, vendorLoading: false, seriesLoading: false });

                            // ✅ THIRD: Force re-render by toggling dropdown
                            const dropdown = e.currentTarget.parentElement;
                            const isActive = dropdown.classList.contains('active');
                            // Close all other dropdowns
                            document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                            if (!isActive) {
                                dropdown.classList.add('active');
                            }
                        }}
                        style={{ opacity: (!isDocumentEditable || !!currentDocEntry || !hasBuyerCode) ? 0.5 : 1 }}
                    >
                        Copy From ▼
                    </button>
                    <div className="so-dropdown-menu">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                console.log('📋 Sales Quotations clicked');

                                // Clear everything before opening modal
                                // setCopyFromMode(true);
                                setValErrors({ header: {}, lines: {}, form: '' });
                                setPageState({ error: '', success: '', loading: false, posting: false, vendorLoading: false, seriesLoading: false });

                                // Small delay to ensure state is updated
                                setTimeout(() => {
                                    openCopyFromModal('quotation');
                                    document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                                }, 10);
                            }}
                        >
                            Sales Quotations
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                console.log('📋 Blanket Agreements clicked');

                                // Clear everything before opening modal
                                // setCopyFromMode(true);
                                setValErrors({ header: {}, lines: {}, form: '' });
                                setPageState({ error: '', success: '', loading: false, posting: false, vendorLoading: false, seriesLoading: false });

                                // Small delay to ensure state is updated
                                setTimeout(() => {
                                    openCopyFromModal('blanket');
                                    document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                                }, 10);
                            }}
                        >
                            Blanket Agreements
                        </button>
                    </div>
                </div>
                <div className="so-dropdown">
                    <button
                        type="button"
                        className="so-btn"
                        disabled={!canAttemptCopyTo}
                        title={!currentDocEntry
                            ? 'Open a saved sales order before using Copy To.'
                            : hasKnownCopyQuantityState && !hasOpenCopyQuantity
                                ? 'This Sales Order has no open quantity left. Create the A/R Invoice from the related Delivery.'
                                : 'Copy To'}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!canAttemptCopyTo) return;
                            const dropdown = e.currentTarget.parentElement;
                            const isActive = dropdown.classList.contains('active');
                            document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                            if (!isActive) dropdown.classList.add('active');
                        }}
                        style={{ opacity: !canAttemptCopyTo ? 0.5 : 1 }}
                    >
                        Copy To ▼
                    </button>
                    <div className="so-dropdown-menu">
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyTo('delivery'); document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active')); }}>
                            Delivery
                        </button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyTo('ar-invoice'); document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active')); }}>
                            A/R Invoice
                        </button>
                    </div>
                </div>
                {currentDocEntry && (
                    <button type="button" className="so-btn sap-document-toolbar__duplicate" onClick={handleDuplicate}>
                        Duplicate
                    </button>
                )}

                <button type="button" className="so-btn sap-document-toolbar__find" onClick={() => navigate('/sales-order/find')}>Find</button>
                <button type="button" className="so-btn sap-document-toolbar__new" onClick={resetForm}>New</button>
            </div>

            {/* alerts */}
            {pageState.loading && <div className="so-alert so-alert--success" style={{ marginTop: 0 }}>Loading…</div>}
            {!copyFromMode && pageState.error && <div className="so-alert so-alert--error">{pageState.error}</div>}
            {pageState.success && <div className="so-alert so-alert--success">{pageState.success}</div>}
            {refData.warnings?.length > 0 && (
                <div className="so-alert so-alert--warning">
                    <strong>SAP warnings:</strong>
                    {refData.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    <div style={{ marginTop: 4, color: '#555' }}>Dropdowns are showing fallback values. Connect to SAP to load live data.</div>
                    <div style={{ marginTop: 4, color: '#d00', fontWeight: 600 }}>⚠️ Tax codes shown are examples only. Use actual SAP tax codes to avoid submission errors.</div>
                </div>
            )}

            <div className="so-fieldset" style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <div className={`sap-document-layout so-layout${isRightSidebarOpen ? ' is-sidebar-open' : ' sap-document-layout--no-udf'}`}>
                <div className="sap-document-main so-layout__main">

                        {/* ══ HEADER CARD ══════════════════════════════════════════════ */}
                        <div className="so-header-card">
                            <div className="so-header-columns">
                                {/* LEFT COLUMN */}
                                <div className="so-header-column">
                                    <div className="so-field-grid so-field-grid--single">

                                        {/* Buyer's Code */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'vendor', "Buyer's Code", true)}</label>
                                            <div className="sap-input-group">
                                                <input
                                                    name="vendor"
                                                    className={`so-field__input${valErrors.header.vendor ? ' so-field__input--error' : ''}`}
                                                    value={header.vendor}
                                                    onChange={handleHeaderChange}
                                                    disabled={!!currentDocEntry}
                                                    placeholder="Customer code"
                                                />
                                                <SapGoldenArrowButton
                                                    onClick={openBusinessPartnerLink}
                                                    disabled={!header.vendor}
                                                    title="Open Business Partner"
                                                />
                                                <button
                                                    type="button"
                                                    className="so-btn so-btn--lookup"
                                                    onClick={openBpModal}
                                                    disabled={!!currentDocEntry}
                                                    title="Select Business Partner"
                                                >
                                                    ...
                                                </button>
                                            </div>
                                        </div>

                                        {/* Buyer's Name */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'name', "Buyer's Name")}</label>
                                            <input name="name" className="so-field__input" value={header.name} readOnly />
                                        </div>

                                        <fieldset
                                            className="so-fieldset"
                                            disabled={!isDocumentEditable || !hasBuyerCode}
                                            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
                                        >
                                        {/* Contact Person */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'contactPerson', 'Contact Person')}</label>
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
                                            disabled={pageState.vendorLoading || !header.vendor || !!currentDocEntry}
                                        />

                                        {/* Place of Supply */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'placeOfSupply', 'Place of Supply', true)}</label>
                                            <div className="sap-input-group">
                                                <input
                                                    name="placeOfSupply"
                                                    className={`so-field__input${valErrors.header.placeOfSupply ? ' so-field__input--error' : ''}`}
                                                    value={getStateDisplayName(header.placeOfSupply, refData.states)}
                                                    onChange={handleHeaderChange}
                                                    placeholder="State code"
                                                />
                                                <button
                                                    type="button"
                                                    className="so-btn so-btn--lookup"
                                                    onClick={openStateModal}
                                                    title="Select State"
                                                >
                                                    ...
                                                </button>
                                            </div>
                                        </div>

                                        {/* Payment Terms */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'paymentTerms', 'Payment Terms')}</label>
                                            <select name="paymentTerms" className="so-field__select" value={header.paymentTerms} onChange={handleHeaderChange}>
                                                <option value="">Select</option>
                                                {payTermOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>

                                        {/* Branch */}
                                        {branchesEnabled && (
                                            <div className="so-field">
                                                <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'branch', 'Branch', true)}</label>
                                                <select
                                                    name="branch"
                                                    className="so-field__select"
                                                    value={header.branch || ''}
                                                    onChange={handleHeaderChange}
                                                    style={{ border: (!copyFromMode && valErrors.header.branch) ? '1px solid #c00' : undefined }}
                                                >
                                                    <option value="">Select Branch</option>
                                                    {refData.branches.map(b => (
                                                        <option key={b.BPLId} value={b.BPLId}>
                                                            {b.BPLName}
                                                        </option>
                                                    ))}
                                                </select>
                                                {!copyFromMode && valErrors.header.branch && (
                                                    <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.header.branch}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* Warehouse */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'warehouse', 'Warehouse', true)}</label>
                                            <select
                                                name="warehouse"
                                                className="so-field__select"
                                                value={header.warehouse || ''}
                                                onChange={handleHeaderChange}
                                                style={{ border: (!copyFromMode && valErrors.header.warehouse) ? '1px solid #c00' : undefined }}
                                                title={branchesEnabled
                                                    ? (header.branch ? 'Showing warehouses for selected branch' : 'Select a branch first to filter warehouses')
                                                    : 'Showing warehouses for selected company'}
                                            >
                                                <option value="">Select Warehouse</option>
                                                {branchFilteredWarehouses.map(w => (
                                                    <option key={w.WhsCode} value={w.WhsCode}>
                                                        {w.WhsCode} - {w.WhsName}
                                                    </option>
                                                ))}
                                            </select>
                                            {!copyFromMode && valErrors.header.warehouse && (
                                                <div style={{ color: '#c00', fontSize: 10 }}>
                                                    {valErrors.header.warehouse}
                                                </div>
                                            )}
                                        </div>
                                        </fieldset>

                                    </div>
                                </div>

                                {/* RIGHT COLUMN */}
                                <div className="so-header-column">
                                    <fieldset
                                        className="so-fieldset"
                                        disabled={!isDocumentEditable}
                                        style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
                                    >
                                    <div className="so-field-grid so-field-grid--single">

                                        {/* Series */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'series', 'Series')}</label>
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
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'nextNumber', 'Number')}</label>
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
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'customerRefNo', 'Customer Ref. No.')}</label>
                                            <input name="customerRefNo" className="so-field__input" value={header.customerRefNo || header.salesContractNo || ''} onChange={handleHeaderChange} />
                                        </div>

                                        {/* Status */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'status', 'Status')}</label>
                                            <input name="status" className="so-field__input" value={header.status} readOnly style={{ background: '#f0f2f5', color: header.status === 'Open' ? '#1a7a30' : '#c00', fontWeight: 600 }} />
                                        </div>

                                        {/* Posting Date */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'postingDate', 'Posting Date', true)}</label>
                                            <input type="date" name="postingDate" className="so-field__input" value={header.postingDate} onChange={handleHeaderChange} />
                                        </div>

                                        {/* Delivery Date */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'deliveryDate', 'Delivery Date')}</label>
                                            <input type="date" name="deliveryDate" className="so-field__input" value={header.deliveryDate} onChange={handleHeaderChange} />
                                        </div>

                                        {/* Document Date */}
                                        <div className="so-field">
                                            <label className="so-field__label">{getHeaderFieldLabel(headerFieldMap, 'documentDate', 'Document Date', true)}</label>
                                            <input
                                                type="date"
                                                name="documentDate"
                                                className="so-field__input"
                                                value={header.documentDate}
                                                onChange={handleHeaderChange}
                                                style={{ border: valErrors.header.documentDate ? '1px solid #c00' : undefined }}
                                            />
                                            {!copyFromMode && valErrors.header.documentDate && (
                                                <div style={{ color: '#c00', fontSize: 10, marginTop: 2 }}>{valErrors.header.documentDate}</div>
                                            )}
                                        </div>

                                    </div>
                                    </fieldset>
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

                        <fieldset
                            className="so-fieldset"
                            disabled={!isDocumentEditable}
                            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
                        >

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
                                loading={pageState.loading}
                                branches={refData.branches}
                                distributionRules={refData.distribution_rules || []}
                                distributionDimensions={refData.distribution_dimensions || []}
                                onDistributionRuleChange={handleDistributionRuleChange}
                                countries={refData.countries || []}
                                onOpenHSNModal={openHSNModal}
                                onOpenItemModal={openItemModalSafe}
                                onOpenQualityModal={openQualityModal}
                                onOpenPaymentTermsModal={openPaymentTermsModal}
                                getBranchName={getBranchName}
                                copyFromMode={copyFromMode}
                                formSettings={formSettings}
                                matrixFields={matrixColumnDefinitions}
                                useSapMatrixOrder={Boolean(refData.line_field_metadata?.sap_form?.preferenceRows)}
                                rowUdfFields={visibleRowUdfs}
                                onRowUdfChange={handleRowUdfChange}
                                onLoadLookupOptions={loadDynamicUdfLookupOptions}
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
                            />
                        )}

                        {activeTab === 'Accounting' && (
                            <AccountingTab
                                header={header}
                                onHeaderChange={handleHeaderChange}
                                payTermOpts={payTermOpts}
                                paymentMethodOpts={paymentMethodOpts}
                                referenceDocuments={referenceDocuments}
                                onOpenReferenceDocuments={openReferenceDocumentsModal}
                                isEditable={isDocumentEditable}
                            />
                        )}

                        {activeTab === 'Tax' && (
                            <TaxTab
                                header={header}
                                onHeaderChange={handleHeaderChange}
                                onOpenTaxInfoModal={openTaxInfoModal}
                                isEditable={isDocumentEditable}
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
                        <div className="so-header-card so-document-summary">
                            <div className="so-header-columns">
                                <div className="so-header-column">
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
                                    </div>
                                    <div className="so-field">
                                        <label className="so-field__label">Remarks</label>
                                        <textarea className="so-textarea" rows={3} name="otherInstruction" value={header.otherInstruction || ''} onChange={handleHeaderChange} />
                                    </div>
                                </div>
                                <div className="so-header-column">
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
                                                    <td>
                                                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                                            <input type="checkbox" name="rounding" checked={header.rounding} onChange={handleHeaderChange} />
                                                            Rounding
                                                        </label>
                                                    </td>
                                                    <td className="so-grid__cell--num"><input className="so-grid__input" value={fmtDec(totalsForDisplay.roundingAmount, numDec.totalPaymentDue)} readOnly /></td>
                                                </tr>
                                                <tr>
                                                    <td>Tax</td>
                                                    <td className="so-grid__cell--num"><input className="so-grid__input" value={fmtDec(totalsForDisplay.taxAmt, numDec.tax)} readOnly /></td>
                                                </tr>
                                                <tr style={{ borderTop: '2px solid #a0aab4' }}>
                                                    <td style={{ fontWeight: 700, color: '#003366' }}>Total</td>
                                                    <td className="so-grid__cell--num" style={{ fontWeight: 700, color: '#003366' }}><input className="so-grid__input" style={{ fontWeight: 700, color: '#003366' }} value={fmtDec(totalsForDisplay.total, numDec.totalPaymentDue)} readOnly /></td>
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
                                <div className="so-dropdown">
                                    <button
                                      type="button"
                                      className="so-btn"
                                      disabled={!isDocumentEditable || !!currentDocEntry || !hasBuyerCode}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (currentDocEntry || !hasBuyerCode) return;
                                        setCopyFromMode(true);
                                        setValErrors({ header: {}, lines: {}, form: '' });
                                        setPageState({ error: '', success: '', loading: false, posting: false, vendorLoading: false, seriesLoading: false });
                                        const dropdown = e.currentTarget.parentElement;
                                        const isActive = dropdown.classList.contains('active');
                                        document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                                        if (!isActive) dropdown.classList.add('active');
                                      }}
                                      style={{ opacity: (!isDocumentEditable || !!currentDocEntry || !hasBuyerCode) ? 0.5 : 1 }}
                                    >
                                      Copy From ▼
                                    </button>
                                    <div className="so-dropdown-menu">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setCopyFromMode(true);
                                            setValErrors({ header: {}, lines: {}, form: '' });
                                            setPageState({ error: '', success: '', loading: false, posting: false, vendorLoading: false, seriesLoading: false });
                                            setTimeout(() => {
                                              openCopyFromModal('quotation');
                                              document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                                            }, 10);
                                          }}
                                        >
                                            Sales Quotations
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setCopyFromMode(true);
                                            setValErrors({ header: {}, lines: {}, form: '' });
                                            setPageState({ error: '', success: '', loading: false, posting: false, vendorLoading: false, seriesLoading: false });
                                            setTimeout(() => {
                                              openCopyFromModal('blanket');
                                              document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                                            }, 10);
                                          }}
                                        >
                                            Blanket Agreements
                                        </button>
                                    </div>
                                </div>
                                {/* Copy To Dropdown - SAP B1 style */}
                                <div className="so-dropdown">
                                    <button
                                        type="button"
                                        className="so-btn"
                                        disabled={!canAttemptCopyTo}
                                        title={!currentDocEntry
                                            ? 'Open a saved sales order before using Copy To.'
                                            : hasKnownCopyQuantityState && !hasOpenCopyQuantity
                                                ? 'This Sales Order has no open quantity left. Create the A/R Invoice from the related Delivery.'
                                                : 'Copy To'}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!canAttemptCopyTo) return;
                                            const dropdown = e.currentTarget.parentElement;
                                            const isActive = dropdown.classList.contains('active');
                                            document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active'));
                                            if (!isActive) dropdown.classList.add('active');
                                        }}
                                        style={{ opacity: !canAttemptCopyTo ? 0.5 : 1 }}
                                    >
                                        Copy To ▼
                                    </button>
                                    <div className="so-dropdown-menu">
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyTo('delivery'); document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active')); }}>
                                            Delivery
                                        </button>
                                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyTo('ar-invoice'); document.querySelectorAll('.so-dropdown').forEach(d => d.classList.remove('active')); }}>
                                            A/R Invoice
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        )}
                        </fieldset>

                    </div>

                    <HeaderUdfSidebar
                        className="sap-header-udf-panel so-layout__sidebar"
                        isOpen={sidebarOpen}
                        fields={visHdrUdfs}
                        formSettings={formSettings}
                        values={headerUdfs}
                        disabled={!hasBuyerCode}
                        onFieldChange={handleHeaderUdfChange}
                        onLoadLookupOptions={loadDynamicUdfLookupOptions}
                        onClose={() => setSidebarOpen(false)}
                    />
                    <FormSettingsPanel
                        variant="sidebar"
                        className="sap-header-udf-panel so-layout__sidebar"
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

            </div>

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
                onCreateNew={() => {
                    closeBpModal();
                    navigate('/business-partner');
                }}
                businessPartners={refData.vendors || []}
            />

            {/* Copy From Modal */}
            <CopyFromModal
                isOpen={copyFromModal}
                onClose={() => {
                    setCopyFromModal(false);
                    setCopyFromMode(false);
                     setIsCopyFromClick(false); 
                }}
                onCopy={handleCopyFrom}
                documentType={copyFromDocType}
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

            <ReferenceDocumentsModal
                isOpen={referenceDocumentsModal}
                referenceDocuments={referenceDocuments}
                onClose={closeReferenceDocumentsModal}
                onSave={saveReferenceDocumentsModal}
                isEditable={isDocumentEditable}
                cardCode={header.vendor}
                onOpenDocument={openReferenceDocumentLink}
            />

            {/* Freight Charges Modal */}
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

export default SalesOrder;
