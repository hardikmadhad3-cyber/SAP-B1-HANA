import React, { useEffect, useState, useCallback } from 'react';
import '../styles/purchase-order.css';
import { useLocation, useNavigate } from 'react-router-dom';
import FormSettingsPanel from '../components/purchase-order/FormSettingsPanel';
import HeaderUdfSidebar from '../components/purchase-order/HeaderUdfSidebar';
import {
  fetchSalesOrderByDocEntry,
  fetchSalesOrderCustomerDetails,
  fetchSalesOrderReferenceData,
  submitSalesOrder,
  updateSalesOrder,
  fetchDocumentSeries,
  fetchNextNumber,
  fetchStateFromAddress,
} from '../api/salesOrderApi';
import { SALES_ORDER_COMPANY_ID } from '../config/appConfig';
import {
  FORM_SETTINGS_STORAGE_KEY,
  HEADER_UDF_DEFINITIONS,
  ROW_UDF_DEFINITIONS,
  createUdfState,
  readSavedFormSettings,
} from '../config/purchaseOrderForm';
import { findTaxCode, getTaxComponentCodes } from '../utils/taxCodeComponents';

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

// ─── static fallbacks (shown when SAP is unreachable) ────────────────────────
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
const FALLBACK_TAX = [
  { Code: 'GST5', Name: 'GST 5%', Rate: 5 },
  { Code: 'GST12', Name: 'GST 12%', Rate: 12 },
  { Code: 'GST18', Name: 'GST 18%', Rate: 18 },
  { Code: 'GST28', Name: 'GST 28%', Rate: 28 },
  { Code: 'IGST5', Name: 'IGST 5%', Rate: 5 },
  { Code: 'IGST12', Name: 'IGST 12%', Rate: 12 },
  { Code: 'IGST18', Name: 'IGST 18%', Rate: 18 },
  { Code: 'IGST28', Name: 'IGST 28%', Rate: 28 },
  { Code: 'EXEMPT', Name: 'Exempt', Rate: 0 },
];
const FALLBACK_UOM = ['EA', 'PCS', 'KG', 'LTR', 'MTR', 'BOX', 'SET', 'NOS', 'PKT', 'DZN'];
const FALLBACK_WAREHOUSES = [
  { WhsCode: 'WH01', WhsName: 'Main Warehouse' },
  { WhsCode: 'WH02', WhsName: 'Secondary Warehouse' },
];

// ─── constants ────────────────────────────────────────────────────────────────
const DEC = { QtyDec: 2, PriceDec: 2, SumDec: 2, RateDec: 2, PercentDec: 2 };
const TAB_NAMES = ['Contents', 'Logistics', 'Accounting', 'Tax', 'Electronic Documents', 'Attachments'];

// Matrix columns including HSN Code
const MATRIX_COLS = [
  { key: 'itemNo', label: 'Item No.', minWidth: 130 },
  { key: 'itemDescription', label: 'Description', minWidth: 140 },
  { key: 'hsnCode', label: 'HSN Code', minWidth: 90 },
  { key: 'quantity', label: 'Qty', minWidth: 70 },
  { key: 'unitPrice', label: 'Unit Price', minWidth: 90 },
  { key: 'uomCode', label: 'UoM', minWidth: 70 },
  { key: 'stdDiscount', label: 'Disc %', minWidth: 65 },
  { key: 'taxCode', label: 'Tax Code', minWidth: 110 },
  { key: 'total', label: 'Total (LC)', minWidth: 90 },
  { key: 'whse', label: 'Whse', minWidth: 80 },
];

const createLine = () => ({
  itemNo: '', itemDescription: '', hsnCode: '', quantity: '', unitPrice: '',
  uomCode: '', stdDiscount: '', taxCode: '', total: '', whse: '',
  udf: createUdfState(ROW_UDF_DEFINITIONS),
});

const INIT_HEADER = {
  vendor: '', name: '', contactPerson: '', salesContractNo: '', branch: '',
  docNo: '', status: 'Open', series: '', nextNumber: '',
  postingDate: today(), deliveryDate: '', documentDate: today(), contractDate: '',
  branchRegNo: '', shipTo: '', shipToCode: '', payTo: '', payToCode: '',
  shippingType: '', confirmed: false, journalRemark: '', paymentTerms: '',
  paymentMethod: '', otherInstruction: '', discount: '', freight: '', tax: '',
  totalPaymentDue: '', rounding: false, owner: '', purchaser: '',
  placeOfSupply: '', currency: 'INR',
};

const INIT_ATTACH = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1, targetPath: '', fileName: '', attachmentDate: '',
  freeText: '', copyToTargetDocument: '', documentType: '', atchDocDate: '', alert: '',
}));

// ─── Main Component ───────────────────────────────────────────────────────────
function SalesOrderPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [currentDocEntry, setCurrentDocEntry] = useState(null);
  const [header, setHeader] = useState(INIT_HEADER);
  const [lines, setLines] = useState([createLine()]);
  const [attachments] = useState(INIT_ATTACH);
  const [activeTab, setActiveTab] = useState('Contents');
  const [headerUdfs, setHeaderUdfs] = useState(() => createUdfState(HEADER_UDF_DEFINITIONS));
  const [formSettings, setFormSettings] = useState(() => readSavedFormSettings());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [refData, setRefData] = useState({
    company: '', vendors: [], contacts: [], pay_to_addresses: [], items: [],
    warehouses: [], warehouse_addresses: [], company_address: {}, tax_codes: [],
    payment_terms: [], shipping_types: [], branches: [], uom_groups: [],
    decimal_settings: DEC, warnings: [], series: [], states: [],
  });
  const [pageState, setPageState] = useState({ loading: false, vendorLoading: false, posting: false, error: '', success: '', seriesLoading: false });
  const [valErrors, setValErrors] = useState({ header: {}, lines: {}, form: '' });
  const [addressModal, setAddressModal] = useState(null); // { type: 'shipTo' | 'billTo', data: {...} }
  const [taxInfoModal, setTaxInfoModal] = useState(false);
  const [addressForm, setAddressForm] = useState({
    streetNo: '', buildingFloorRoom: '', block: '', city: '', zipCode: '', county: '',
    state: '', countryRegion: '', addressName2: '', addressName3: '', gln: '', gstin: ''
  });
  const [taxInfoForm, setTaxInfoForm] = useState({
    panNo: '', panCircleNo: '', panWardNo: '', panAssessingOfficer: '', deducteeRefNo: '',
    lstVatNo: '', cstNo: '', tanNo: '', serviceTaxNo: '', companyType: '', natureOfBusiness: '',
    assesseeType: '', tinNo: '', itrFiling: '', gstType: '', gstin: ''
  });

  useEffect(() => { localStorage.setItem(FORM_SETTINGS_STORAGE_KEY, JSON.stringify(formSettings)); }, [formSettings]);

  // decimal config
  const dec = { ...DEC, ...(refData.decimal_settings || {}) };
  const numDec = {
    quantity: Number(dec.QtyDec), unitPrice: Number(dec.PriceDec),
    stdDiscount: Number(dec.PercentDec), total: Number(dec.SumDec),
    discount: Number(dec.PercentDec), freight: Number(dec.SumDec),
    tax: Number(dec.SumDec), totalPaymentDue: Number(dec.SumDec),
  };

  // ── load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const [refDataRes, seriesRes] = await Promise.all([
          fetchSalesOrderReferenceData(SALES_ORDER_COMPANY_ID),
          fetchDocumentSeries(),
        ]);
        
        if (!ignore) {
          setRefData({
            company: refDataRes.data.company || '',
            vendors: refDataRes.data.vendors || [],
            contacts: refDataRes.data.contacts || [],
            pay_to_addresses: refDataRes.data.pay_to_addresses || [],
            items: refDataRes.data.items || [],
            warehouses: refDataRes.data.warehouses || [],
            warehouse_addresses: refDataRes.data.warehouse_addresses || [],
            company_address: refDataRes.data.company_address || {},
            tax_codes: refDataRes.data.tax_codes || [],
            payment_terms: refDataRes.data.payment_terms || [],
            shipping_types: refDataRes.data.shipping_types || [],
            branches: refDataRes.data.branches || [],
            states: refDataRes.data.states || [],
            uom_groups: refDataRes.data.uom_groups || [],
            decimal_settings: { ...DEC, ...(refDataRes.data.decimal_settings || {}) },
            warnings: refDataRes.data.warnings || [],
            series: seriesRes.data.series || [],
          });
          
          // Auto-select first series if available
          if (seriesRes.data.series && seriesRes.data.series.length > 0 && !currentDocEntry) {
            const firstSeries = seriesRes.data.series[0];
            handleSeriesChange(firstSeries.Series);
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
  }, [currentDocEntry]);

  // ── load existing order ───────────────────────────────────────────────────
  useEffect(() => {
    const docEntry = location.state?.salesOrderDocEntry;
    if (!docEntry) return;
    let ignore = false;
    const load = async () => {
      setPageState(p => ({ ...p, loading: true, error: '', success: '' }));
      try {
        const r = await fetchSalesOrderByDocEntry(docEntry);
        const so = r.data.sales_order;
        console.log("🔥 BACKEND SO HEADER:", so.header);
        if (ignore || !so) return;
        setCurrentDocEntry(so.doc_entry || Number(docEntry));
        setHeader(prev => ({
          ...prev,
          ...INIT_HEADER,

          ...(so.header || {}),

          // ✅ FIX: Properly map all fields WITHOUT converting to Number
          vendor: so.header?.customerCode || '',
          contactPerson: so.header?.contactPerson || '',  // Keep as string
          name: so.header?.customerName || '',
          paymentTerms: so.header?.paymentTermsCode || so.header?.paymentTerms || '',
          placeOfSupply: so.header?.placeOfSupply || '',
          branch: so.header?.branch || '',
        }));

        setLines(
          Array.isArray(so.lines) && so.lines.length
            ? so.lines.map(l => ({ ...createLine(), ...l, udf: { ...createUdfState(ROW_UDF_DEFINITIONS), ...(l.udf || {}) } }))
            : [createLine()]
        );
        setHeaderUdfs({ ...createUdfState(HEADER_UDF_DEFINITIONS), ...(so.header_udfs || {}) });
        if (so.header?.customerCode) {
          loadVendorDetails(so.header.customerCode);
        }
        setPageState(p => ({ ...p, success: so.doc_num ? `Sales order ${so.doc_num} loaded.` : 'Sales order loaded.' }));
      } catch (e) {
        if (!ignore) setPageState(p => ({ ...p, error: getErrMsg(e, 'Failed to load sales order.') }));
      } finally {
        if (!ignore) {
          setPageState(p => ({ ...p, loading: false }));
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };
    load();
    return () => { ignore = true; };
  }, [location.pathname, location.state, navigate]); // eslint-disable-line
  useEffect(() => {
    console.log("🔥 CURRENT HEADER STATE:", header);
  }, [header]);

  // ── derived / computed ────────────────────────────────────────────────────
  const vendorContacts = refData.contacts.filter(c => String(c.CardCode || '') === String(header.vendor || ''));
  const vendorOptions = header.vendor && !refData.vendors.some(v => String(v.CardCode || '') === String(header.vendor || ''))
    ? [{ CardCode: header.vendor, CardName: header.name || header.vendor }, ...refData.vendors]
    : refData.vendors;
  const contactOptions = header.contactPerson && !vendorContacts.some(c => String(c.CntctCode || '') === String(header.contactPerson || ''))
    ? [{ CardCode: header.vendor, CntctCode: header.contactPerson, Name: header.contactPerson }, ...vendorContacts]
    : vendorContacts;
  const vendorPayToAddresses = refData.pay_to_addresses.filter(a => String(a.CardCode || '') === String(header.vendor || ''));
  const firstLineWhse = String(lines[0]?.whse || '').trim();
  const selectedWhseAddr = refData.warehouse_addresses.find(w => String(w.WhsCode || '') === firstLineWhse);
  const defaultShipTo = fmtAddr(refData.company_address);
  const uomGroupMap = (refData.uom_groups || []).reduce((acc, g) => { acc[g.AbsEntry] = g.uomCodes || []; return acc; }, {});

  // effective dropdowns — SAP data or fallback
  const effectiveTaxCodes = refData.tax_codes.length ? refData.tax_codes : FALLBACK_TAX;
  const effectiveWarehouses = refData.warehouses.length ? refData.warehouses : FALLBACK_WAREHOUSES;
  const effectiveWhseAddrs = refData.warehouse_addresses.length ? refData.warehouse_addresses : FALLBACK_WAREHOUSES;
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
    return { subtotal, discAmt, discSub, freight, taxAmt, total: roundTo(discSub + freight + taxAmt, numDec.totalPaymentDue), taxBreakdown: Array.from(taxMap.values()) };
  };

  const totals = calcTotals();

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
      const existing = vendorPayToAddresses.find(a => String(a.Address || '') === String(prev.payToCode || ''));
      if (existing) return prev;
      const def = vendorPayToAddresses[0];
      if (!def) return prev;
      const fmt = fmtAddr(def);
      if (prev.payToCode === def.Address && prev.payTo === fmt) return prev;
      return { ...prev, payToCode: def.Address || '', payTo: fmt };
    });
  }, [header.vendor, vendorPayToAddresses]); // eslint-disable-line

  // ── vendor details ────────────────────────────────────────────────────────
  const loadVendorDetails = async (code) => {
    if (!code) {
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [] }));
      return;
    }

    setPageState(p => ({ ...p, vendorLoading: true }));

    try {
      const r = await fetchSalesOrderCustomerDetails(code);
      console.log("API RESPONSE:", r.data);   // ✅ ADD HERE

      const contacts = r.data.contacts || [];
      console.log("API RESPONSE:", r.data);
      setRefData(p => ({
        ...p,
        contacts: contacts,
        pay_to_addresses: r.data.pay_to_addresses || []
      }));

      // ✅ AUTO SELECT FIRST CONTACT (SAP BEHAVIOR)
      if (contacts.length > 0) {
        setHeader(prev => ({
          ...prev,
          contactPerson: contacts[0].CntctCode
        }));
      }

    } catch (err) {
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [] }));
    } finally {
      setPageState(p => ({ ...p, vendorLoading: false }));
    }
  };

  const syncVendor = (code, hdr) => {
    const m = refData.vendors.find(v => String(v.CardCode || '') === String(code || ''));
    if (!m) return { nextHeader: hdr, vatGroup: '' };
    return {
      nextHeader: { ...hdr, name: m.CardName || hdr.name, paymentTerms: m.PayTermsGrpCode != null ? String(m.PayTermsGrpCode) : hdr.paymentTerms, contactPerson: '' },
      vatGroup: m.VatGroup || '',
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

        const { nextHeader, vatGroup } = syncVendor(value, prep);

        // ✅ CLEAR OLD CONTACT
        nextHeader.contactPerson = '';

        setLines(ls => ls.map(l => ({
          ...l,
          taxCode: vatGroup || l.taxCode
        })));

        return nextHeader;
      });

      // ✅ LOAD CONTACTS
      loadVendorDetails(value);

      return;
    }
    if (numDec[name] !== undefined && type !== 'checkbox') {
      setHeader(p => ({ ...p, [name]: sanitize(value, numDec[name]) }));
      return;
    }
    setHeader(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };
  
  const handleShipToChange = async (addressCode) => {
    if (!addressCode || !header.vendor) {
      setHeader(p => ({ ...p, shipToCode: addressCode, placeOfSupply: '' }));
      return;
    }
    
    // Update shipToCode immediately
    const addr = effectiveWhseAddrs.find(w => String(w.WhsCode) === addressCode);
    setHeader(p => ({ ...p, shipToCode: addressCode, shipTo: fmtAddr(addr) }));
    
    // Fetch state from address
    try {
      const res = await fetchStateFromAddress(header.vendor, addressCode);
      if (res.data.state) {
        setHeader(p => ({ ...p, placeOfSupply: res.data.state }));
      }
    } catch (err) {
      console.error('Failed to fetch state from address:', err);
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
      console.error('Failed to fetch next number:', err);
      setHeader(p => ({ ...p, nextNumber: 'Error' }));
      setPageState(p => ({ ...p, error: 'Failed to get next document number' }));
    } finally {
      setPageState(p => ({ ...p, seriesLoading: false }));
    }
  };

  const handleLineChange = (i, e) => {
    const { name, value } = e.target;
    setValErrors(p => ({ ...p, lines: { ...p.lines, [i]: { ...(p.lines[i] || {}), [name]: '' } }, form: '' }));
    setPageState(p => ({ ...p, error: '', success: '' }));
    setLines(prev => prev.map((line, idx) => {
      if (idx !== i) return line;
      const next = { ...line, [name]: numDec[name] !== undefined ? sanitize(value, numDec[name]) : value };
      if (name === 'itemNo') {
        const item = refData.items.find(it => String(it.ItemCode || '') === String(value || ''));
        if (item) {
          next.itemDescription = item.ItemName || next.itemDescription;
          next.uomCode = String(item.SalesUnit || item.InventoryUOM || '').trim();
          next.hsnCode = item.SWW || item.HSNCode || item.U_HSNCode || next.hsnCode || '';
        }
        if (!next.taxCode) {
          const v = refData.vendors.find(vv => String(vv.CardCode || '') === String(header.vendor || ''));
          if (v?.VatGroup) next.taxCode = v.VatGroup;
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

  const addLine = () => {
    setValErrors(p => ({ ...p, form: '' }));
    setLines(p => [...p, createLine()]);
  };

  const removeLine = (i) => {
    setValErrors(p => { const nl = { ...p.lines }; delete nl[i]; return { ...p, lines: nl, form: '' }; });
    setLines(p => p.filter((_, idx) => idx !== i));
  };

  const handleHeaderUdfChange = (k, v) => setHeaderUdfs(p => ({ ...p, [k]: v }));
  const updateFormSetting = (g, k, prop, val) => setFormSettings(p => ({ ...p, [g]: { ...p[g], [k]: { ...p[g][k], [prop]: val } } }));
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
    // Parse existing address if available
    setAddressForm({
      streetNo: '', buildingFloorRoom: '', block: '', city: '', zipCode: '', county: '',
      state: '', countryRegion: '', addressName2: '', addressName3: '', gln: '', gstin: ''
    });
    setAddressModal({ type });
  };

  const closeAddressModal = () => {
    setAddressModal(null);
  };

  const saveAddressModal = () => {
    // Format address from form
    const formatted = [
      [addressForm.streetNo, addressForm.buildingFloorRoom].filter(Boolean).join(', '),
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
    // Save tax info (could be stored in header or separate state)
    closeTaxInfoModal();
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
      console.log('Selected files:', files);
      // TODO: Handle file upload
      alert(`Selected ${files.length} file(s). Upload functionality to be implemented.`);
    };
    input.click();
  };

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const isUpdate = !!currentDocEntry;
    const e = { header: {}, lines: {}, form: '' };
    
    // Skip customer validation in edit mode (immutable field)
    if (!isUpdate) {
      const vc = String(header.vendor || '').trim();
      if (!vc) { e.header.vendor = 'Select a customer.'; e.form = 'Please correct the highlighted fields.'; return e; }
      if (!String(header.placeOfSupply || '').trim()) { e.header.placeOfSupply = 'Place of supply is required.'; e.form = 'Please correct the highlighted fields.'; return e; }
    }
    
    // Always validate dates (editable in both modes)
    if (!String(header.postingDate || '').trim()) { e.header.postingDate = 'Posting date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }
    if (!String(header.documentDate || '').trim()) { e.header.documentDate = 'Document date is required.'; e.form = 'Please correct the highlighted fields.'; return e; }

    const pop = lines.filter(l => String(l.itemNo || '').trim());
    if (!pop.length) { e.form = 'Add at least one item line.'; return e; }
    
    // ✅ Line validation
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];

      // Skip empty rows
      if (!String(l.itemNo || '').trim()) continue;

      // ✅ Item mandatory
      if (!l.itemNo) {
        e.lines[i] = { ...(e.lines[i] || {}), itemNo: 'Item is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }

      // ✅ Quantity validation
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
      
      // ✅ Tax Code validation (IMPORTANT for GST)
      if (!l.taxCode || !String(l.taxCode).trim()) {
        e.lines[i] = { ...(e.lines[i] || {}), taxCode: 'Tax Code is required' };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }
      
      // ✅ Validate tax code exists in SAP
      const taxCodeExists = effectiveTaxCodes.some(t => String(t.Code) === String(l.taxCode));
      if (!taxCodeExists) {
        e.lines[i] = { ...(e.lines[i] || {}), taxCode: `Tax code '${l.taxCode}' is not valid in SAP B1` };
        e.form = 'Please correct the highlighted fields.';
        return e;
      }
      
      // SGST/CGST Validation
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
        // ✅ ENSURE THESE FIELDS ARE INCLUDED
        placeOfSupply: header.placeOfSupply,
        branch: header.branch,
        contactPerson: header.contactPerson,
        series: header.series ? Number(header.series) : undefined, // ✅ ADD SERIES
      };
      
      console.log("🔥 SUBMIT PAYLOAD HEADER:", prep);
      
      const payload = { company_id: SALES_ORDER_COMPANY_ID, header: prep, lines, header_udfs: headerUdfs };
      const r = currentDocEntry ? await updateSalesOrder(currentDocEntry, payload) : await submitSalesOrder(payload);
      const dn = r.data.doc_num ? ` Doc No: ${r.data.doc_num}.` : '';
      setCurrentDocEntry(null); setHeader(INIT_HEADER); setLines([createLine()]);
      setHeaderUdfs(createUdfState(HEADER_UDF_DEFINITIONS)); setActiveTab('Contents');
      setRefData(p => ({ ...p, contacts: [], pay_to_addresses: [] }));
      setValErrors({ header: {}, lines: {}, form: '' });
      
      // ✅ Reload series after successful submit
      if (refData.series.length > 0) {
        handleSeriesChange(refData.series[0].Series);
      }
      
      setPageState(p => ({ ...p, success: `${r.data.message || 'Sales order saved.'}${dn}` }));
    } catch (e) {
      setPageState(p => ({ ...p, error: getErrMsg(e, 'Sales order submission failed.') }));
    } finally {
      setPageState(p => ({ ...p, posting: false }));
    }
  };

  const resetForm = () => {
    setCurrentDocEntry(null); setHeader(INIT_HEADER); setLines([createLine()]);
    setHeaderUdfs(createUdfState(HEADER_UDF_DEFINITIONS)); setActiveTab('Contents');
    setValErrors({ header: {}, lines: {}, form: '' });
    setPageState(p => ({ ...p, error: '', success: '' }));
  };

  const visHdrUdfs = HEADER_UDF_DEFINITIONS.filter(f => formSettings.headerUdfs?.[f.key]?.visible !== false);
  const isRightSidebarOpen = sidebarOpen || formSettingsOpen;
  useEffect(() => {
    console.log("Contacts updated:", refData.contacts);
  }, [refData.contacts]);
  // ── render ────────────────────────────────────────────────────────────────
  return (
    <form className="po-page container-fluid" onSubmit={handleSubmit}>

      {/* toolbar */}
      <div className="d-flex gap-2 mb-3">
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={toggleHeaderUdfs}>
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={toggleFormSettings}>
          Form Settings
        </button>
      </div>

      {/* title bar */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Sales Order{currentDocEntry ? ` — #${header.docNo || currentDocEntry}` : ''}</h2>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigate('/sales-order/find')}>Find</button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetForm}>New</button>
        </div>
      </div>

      {/* alerts */}
      {pageState.loading && <div className="alert alert-info py-2">Loading…</div>}
      {pageState.error && <div className="alert alert-danger py-2" role="alert">{pageState.error}</div>}
      {pageState.success && <div className="alert alert-success py-2" role="alert">{pageState.success}</div>}
      {refData.warnings?.length > 0 && (
        <div className="alert alert-warning py-2" style={{ fontSize: 11 }}>
          <strong>SAP warnings:</strong>
          {refData.warnings.map((w, i) => <div key={i}>{w}</div>)}
          <div style={{ marginTop: 4, color: '#555' }}>Dropdowns are showing fallback values. Connect to SAP to load live data.</div>
          <div style={{ marginTop: 4, color: '#d00', fontWeight: 600 }}>⚠️ Tax codes shown are examples only. Use actual SAP tax codes to avoid submission errors.</div>
        </div>
      )}

      <div className="container-fluid">
        <div className="row">
          <div className={isRightSidebarOpen ? 'col-md-9' : 'col-md-12'}>

            {/* ══ HEADER CARD — SAP B1 layout ══════════════════════════════ */}
            <div className="card p-3 mb-3">
              <div className="row g-3">

                {/* LEFT — Customer info */}
                <div className="col-md-5" style={{ borderRight: '2px solid #e0e6ed', paddingRight: 20 }}>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Buyer's Code *</label>
                    <select name="vendor" className={`form-control form-control-sm${valErrors.header.vendor ? ' is-invalid' : ''}`} value={header.vendor} onChange={handleHeaderChange} disabled={!!currentDocEntry} style={currentDocEntry ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}>
                      <option value="">Select</option>
                      {vendorOptions.map(v => <option key={v.CardCode} value={v.CardCode}>{v.CardCode}</option>)}
                    </select>
                    {valErrors.header.vendor && <div className="invalid-feedback d-block">{valErrors.header.vendor}</div>}
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Buyer's Name</label>
                    <input name="name" className="form-control form-control-sm" value={header.name} readOnly style={{ background: '#f5f5f5' }} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Contact Person</label>
                    <select
                      name="contactPerson"
                      className="form-control form-control-sm"
                      value={header.contactPerson || ''}
                      onChange={handleHeaderChange}
                      disabled={pageState.vendorLoading || !header.vendor || !!currentDocEntry}
                      style={currentDocEntry ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}
                    >
                      <option value="">Select</option>

                      {contactOptions.map(c => (
                        <option key={c.CntctCode} value={c.CntctCode}>
                          {c.Name || `${c.FirstName || ''} ${c.LastName || ''}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Customer Ref. No.</label>
                    <input name="salesContractNo" className="form-control form-control-sm" value={header.salesContractNo} onChange={handleHeaderChange} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>BP Currency</label>
                    <select name="currency" className="form-control form-control-sm" value={header.currency || 'INR'} onChange={handleHeaderChange} disabled={!!currentDocEntry} style={currentDocEntry ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}>
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Place of Supply *</label>
                    <select 
                      name="placeOfSupply" 
                      className={`form-control form-control-sm${valErrors.header.placeOfSupply ? ' is-invalid' : ''}`} 
                      value={header.placeOfSupply} 
                      onChange={handleHeaderChange}
                      title="Auto-filled from Ship-To address, can be changed manually"
                    >
                      <option value="">Select State</option>
                      {refData.states.map(st => (
                        <option key={st.Code} value={st.Code}>{st.Name}</option>
                      ))}
                    </select>
                    {valErrors.header.placeOfSupply && <div className="invalid-feedback d-block">{valErrors.header.placeOfSupply}</div>}
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Branch</label>
                    <select name="branch" className="form-control form-control-sm" value={header.branch} onChange={handleHeaderChange} disabled={!!currentDocEntry} style={currentDocEntry ? { background: '#f5f5f5', cursor: 'not-allowed' } : {}}>
                      <option value="">Select</option>
                      {refData.branches.map(b => (
                        <option key={b.BPLId} value={b.BPLId}>{b.BPLName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* RIGHT — Document info */}
                <div className="col-md-7" style={{ paddingLeft: 20 }}>
                  <div className="row g-2">
                    <div className="col-12">
                      <div className="mb-2 d-flex align-items-end gap-2">
                        <div style={{ flex: 1 }}>
                          <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Series</label>
                          <select 
                            name="series"
                            className="form-control form-control-sm" 
                            style={{ background: '#fff3cd' }} 
                            value={header.series}
                            onChange={handleHeaderChange}
                            disabled={!!currentDocEntry || pageState.seriesLoading}
                          >
                            <option value="">Select Series</option>
                            {refData.series.map(s => (
                              <option key={s.Series} value={s.Series}>
                                {s.SeriesName} ({s.Indicator})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ width: 100 }}>
                          <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Number</label>
                          <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            value={pageState.seriesLoading ? '...' : header.nextNumber} 
                            readOnly 
                            style={{ background: '#f5f5f5', textAlign: 'center', cursor: 'not-allowed' }}
                            title="Number will be assigned after saving"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-2">
                        <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Status</label>
                        <input name="status" className="form-control form-control-sm" value={header.status} readOnly style={{ background: '#f5f5f5', color: header.status === 'Open' ? '#1a7a30' : '#c00', fontWeight: 600 }} />
                      </div>
                      <div className="mb-2">
                        <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Posting Date *</label>
                        <input type="date" name="postingDate" className={`form-control form-control-sm${valErrors.header.postingDate ? ' is-invalid' : ''}`} value={header.postingDate} onChange={handleHeaderChange} />
                        {valErrors.header.postingDate && <div className="invalid-feedback d-block">{valErrors.header.postingDate}</div>}
                      </div>
                      <div className="mb-2">
                        <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Delivery Date</label>
                        <input type="date" name="deliveryDate" className="form-control form-control-sm" value={header.deliveryDate} onChange={handleHeaderChange} />
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="mb-2">
                        <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Document Date *</label>
                        <input type="date" name="documentDate" className={`form-control form-control-sm${valErrors.header.documentDate ? ' is-invalid' : ''}`} value={header.documentDate} onChange={handleHeaderChange} />
                        {valErrors.header.documentDate && <div className="invalid-feedback d-block">{valErrors.header.documentDate}</div>}
                      </div>
                      <div className="mb-2">
                        <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Payment Terms</label>
                        <select name="paymentTerms" className="form-control form-control-sm" value={header.paymentTerms} onChange={handleHeaderChange}>
                          <option value="">Select</option>
                          {payTermOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="mb-2">
                        <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Branch Reg. No.</label>
                        <input name="branchRegNo" className="form-control form-control-sm" value={header.branchRegNo || ''} onChange={handleHeaderChange} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* ══ TABS ══════════════════════════════════════════════════════ */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <ul className="nav nav-tabs mb-0" style={{ border: 'none' }}>
                {TAB_NAMES.map(t => (
                  <li className="nav-item" key={t}>
                    <button type="button" className={`nav-link${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
                  </li>
                ))}
              </ul>
              <div className="d-flex align-items-center gap-2">
                <label className="mb-0" style={{ fontSize: 11, fontWeight: 600 }}>Summary Type</label>
                <select className="form-control form-control-sm" style={{ width: 150 }}>
                  <option>No Summary</option>
                  <option>By Items</option>
                  <option>By Documents</option>
                </select>
              </div>
            </div>

            {/* ══ CONTENTS TAB ══════════════════════════════════════════════ */}
            {activeTab === 'Contents' && (
              <div className="card p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Document Lines</h6>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={addLine}>+ Add Line</button>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle" style={{ minWidth: 1100 }}>
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 30 }}>#</th>
                        {MATRIX_COLS.map(c => <th key={c.key} style={{ minWidth: c.minWidth }}>{c.label}</th>)}
                        <th style={{ width: 30 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => {
                        const uomOpts = getUomOptions(line);
                        return (
                          <tr key={i}>
                            <td style={{ textAlign: 'center', color: '#888', fontSize: 11 }}>{i + 1}</td>

                            {/* Item No */}
                            <td>
                              <select className={`form-control form-control-sm${valErrors.lines[i]?.itemNo ? ' is-invalid' : ''}`} name="itemNo" value={line.itemNo} onChange={e => handleLineChange(i, e)}>
                                <option value="">Select</option>
                                {lineItemOptions[i].map(it => <option key={it.ItemCode} value={it.ItemCode}>{it.ItemCode}</option>)}
                              </select>
                              {valErrors.lines[i]?.itemNo && <div className="invalid-feedback d-block">{valErrors.lines[i].itemNo}</div>}
                            </td>

                            {/* Description */}
                            <td><input className="form-control form-control-sm" name="itemDescription" value={line.itemDescription} onChange={e => handleLineChange(i, e)} /></td>

                            {/* HSN Code */}
                            <td>
                              <input className={`form-control form-control-sm${valErrors.lines[i]?.hsnCode ? ' is-invalid' : ''}`} name="hsnCode" value={line.hsnCode} onChange={e => handleLineChange(i, e)} placeholder="HSN/SAC" />
                              {valErrors.lines[i]?.hsnCode && <div className="invalid-feedback d-block">{valErrors.lines[i].hsnCode}</div>}
                            </td>

                            {/* Quantity */}
                            <td>
                              <input className={`form-control form-control-sm text-end${valErrors.lines[i]?.quantity ? ' is-invalid' : ''}`} name="quantity" value={line.quantity} onChange={e => handleLineChange(i, e)} onBlur={() => handleNumBlur('quantity', 'line', i)} />
                              {valErrors.lines[i]?.quantity && <div className="invalid-feedback d-block">{valErrors.lines[i].quantity}</div>}
                            </td>

                            {/* Unit Price */}
                            <td>
                              <input className={`form-control form-control-sm text-end${valErrors.lines[i]?.unitPrice ? ' is-invalid' : ''}`} name="unitPrice" value={line.unitPrice} onChange={e => handleLineChange(i, e)} onBlur={() => handleNumBlur('unitPrice', 'line', i)} />
                              {valErrors.lines[i]?.unitPrice && <div className="invalid-feedback d-block">{valErrors.lines[i].unitPrice}</div>}
                            </td>

                            {/* UoM */}
                            <td>
                              <select className={`form-control form-control-sm${valErrors.lines[i]?.uomCode ? ' is-invalid' : ''}`} name="uomCode" value={line.uomCode} onChange={e => handleLineChange(i, e)}>
                                <option value=""></option>
                                {uomOpts.map(u => <option key={u} value={u}>{u}</option>)}
                                {line.uomCode && !uomOpts.includes(line.uomCode) && <option value={line.uomCode}>{line.uomCode}</option>}
                              </select>
                            </td>

                            {/* Discount */}
                            <td><input className="form-control form-control-sm text-end" name="stdDiscount" value={line.stdDiscount} onChange={e => handleLineChange(i, e)} onBlur={() => handleNumBlur('stdDiscount', 'line', i)} /></td>

                            {/* Tax Code */}
                            <td>
                              <select className="form-control form-control-sm" name="taxCode" value={line.taxCode} onChange={e => handleLineChange(i, e)}>
                                <option value="">Select</option>
                                {effectiveTaxCodes.map(t => <option key={t.Code} value={t.Code}>{fmtTaxLabel(t)}</option>)}
                              </select>
                            </td>

                            {/* Total */}
                            <td><input className="form-control form-control-sm text-end" value={line.total} readOnly style={{ background: '#f5f8fc' }} /></td>

                            {/* Warehouse */}
                            <td>
                              <select className={`form-control form-control-sm${valErrors.lines[i]?.whse ? ' is-invalid' : ''}`} name="whse" value={line.whse} onChange={e => handleLineChange(i, e)}>
                                <option value=""></option>
                                {effectiveWarehouses.map(w => <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode}</option>)}
                                {line.whse && !effectiveWarehouses.some(w => w.WhsCode === line.whse) && <option value={line.whse}>{line.whse}</option>}
                              </select>
                              {valErrors.lines[i]?.whse && <div className="invalid-feedback d-block">{valErrors.lines[i].whse}</div>}
                            </td>

                            {/* Remove */}
                            <td><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeLine(i)}>×</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ LOGISTICS TAB ═════════════════════════════════════════════ */}
            {activeTab === 'Logistics' && (
              <div className="card p-3 mb-3">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label">Ship To Code</label>
                      <div className="d-flex gap-1">
                        <select className="form-control form-control-sm" name="shipToCode" value={header.shipToCode} onChange={handleHeaderChange} style={{ flex: 1 }}>
                          <option value="">— Select —</option>
                          {effectiveWhseAddrs.map(w => <option key={w.WhsCode} value={w.WhsCode}>{w.WhsCode} — {w.WhsName}</option>)}
                        </select>
                        <button type="button" className="btn btn-warning btn-sm" onClick={() => openAddressModal('shipTo')} style={{ padding: '2px 8px', fontSize: 11 }}>...</button>
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Ship To Address</label>
                      <textarea className="form-control form-control-sm" rows={3} name="shipTo" value={header.shipTo} onChange={handleHeaderChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Bill To Code</label>
                      <div className="d-flex gap-1">
                        <select className="form-control form-control-sm" name="payToCode" value={header.payToCode} onChange={handleHeaderChange} style={{ flex: 1 }}>
                          <option value="">— Select —</option>
                          {vendorPayToAddresses.map(a => <option key={a.Address} value={a.Address}>{a.Address}</option>)}
                        </select>
                        <button type="button" className="btn btn-warning btn-sm" onClick={() => openAddressModal('billTo')} style={{ padding: '2px 8px', fontSize: 11 }}>...</button>
                      </div>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Bill To Address</label>
                      <textarea className="form-control form-control-sm" rows={3} name="payTo" value={header.payTo} onChange={handleHeaderChange} />
                    </div>
                    <div className="form-check mt-3">
                      <input type="checkbox" className="form-check-input" id="useBillToAddress" />
                      <label className="form-check-label" htmlFor="useBillToAddress">Use Bill to Address to Determine Tax</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label">Shipping Type</label>
                      <select className="form-control form-control-sm" name="shippingType" value={header.shippingType} onChange={handleHeaderChange}>
                        <option value="">— Select —</option>
                        {shipTypeOpts.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Language</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Gujarati</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Tracking No.</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Stamp No.</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Pick and Pack Remarks</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">BP Channel Name</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">BP Channel Contact</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                      </select>
                    </div>
                    <div className="form-check mt-3">
                      <input type="checkbox" className="form-check-input" name="confirmed" checked={header.confirmed} onChange={handleHeaderChange} />
                      <label className="form-check-label">Confirmed</label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ACCOUNTING TAB ════════════════════════════════════════════ */}
            {activeTab === 'Accounting' && (
              <div className="card p-3 mb-3">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label">Journal Remark</label>
                      <input className="form-control form-control-sm" name="journalRemark" value={header.journalRemark} onChange={handleHeaderChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Payment Terms</label>
                      <select className="form-control form-control-sm" name="paymentTerms" value={header.paymentTerms} onChange={handleHeaderChange}>
                        <option value="">— Select —</option>
                        {payTermOpts.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Payment Method</label>
                      <select className="form-control form-control-sm" name="paymentMethod" value={header.paymentMethod} onChange={handleHeaderChange}>
                        <option value="">— Select —</option>
                        <option>Bank Transfer</option>
                        <option>Cheque</option>
                        <option>Cash</option>
                        <option>Credit Card</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Central Bank Ind.</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Manually Recalculate Due Date</label>
                      <div className="form-check">
                        <input type="radio" className="form-check-input" name="dueDateCalc" id="dueDateSelected" />
                        <label className="form-check-label" htmlFor="dueDateSelected">Selected Date</label>
                        <input type="date" className="form-control form-control-sm mt-1" />
                      </div>
                      <div className="form-check mt-2">
                        <input type="radio" className="form-check-input" name="dueDateCalc" id="dueDateMonths" />
                        <label className="form-check-label" htmlFor="dueDateMonths">Months + Days</label>
                        <div className="d-flex gap-2 mt-1">
                          <input type="number" className="form-control form-control-sm" placeholder="Months" style={{ width: 80 }} />
                          <input type="number" className="form-control form-control-sm" placeholder="Days" style={{ width: 80 }} />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="form-label">Cash Discount Date Offset</label>
                        <input type="number" className="form-control form-control-sm" />
                      </div>
                    </div>
                    <div className="form-check mb-2">
                      <input type="checkbox" className="form-check-input" id="useShippedGoods" />
                      <label className="form-check-label" htmlFor="useShippedGoods">Use Shipped Goods Account</label>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Consolidation Type</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Consolidating BP</label>
                      <input className="form-control form-control-sm" />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label">Business Partner Project</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Create QR Code From</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Indicator</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Order Number</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-3">
                      <button type="button" className="btn btn-outline-secondary btn-sm">Referenced Document</button>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Owner</label>
                      <input className="form-control form-control-sm" name="owner" value={header.owner || ''} onChange={handleHeaderChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Remarks / Instructions</label>
                      <textarea className="form-control form-control-sm" rows={4} name="otherInstruction" value={header.otherInstruction} onChange={handleHeaderChange} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ TAX TAB ═══════════════════════════════════════════════════ */}
            {activeTab === 'Tax' && (
              <div className="card p-3 mb-3">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="mb-3">
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={openTaxInfoModal}>Tax Information</button>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Transaction Category</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                        <option>B2B</option>
                        <option>B2C</option>
                        <option>Export</option>
                        <option>SEZ</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Form No.</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Duty Status</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                        <option>Paid</option>
                        <option>Unpaid</option>
                        <option>Exempted</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check mb-3">
                      <input type="checkbox" className="form-check-input" id="exportCheck" />
                      <label className="form-check-label" htmlFor="exportCheck">Export</label>
                    </div>
                    <div className="form-check mb-3">
                      <input type="checkbox" className="form-check-input" id="supplyCoveredCheck" />
                      <label className="form-check-label" htmlFor="supplyCoveredCheck">Supply Covered under Sec 2 of IGST Act</label>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Differential % of Tax Rate</label>
                      <select className="form-control form-control-sm">
                        <option value="100">100</option>
                        <option value="75">75</option>
                        <option value="50">50</option>
                        <option value="25">25</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ELECTRONIC DOCUMENTS TAB ══════════════════════════════════ */}
            {activeTab === 'Electronic Documents' && (
              <div className="card p-3 mb-3">
                <h6 className="mb-3">E-Way Bill</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label">eDoc Generation Type</label>
                      <select className="form-control form-control-sm">
                        <option value="Not Relevant">Not Relevant</option>
                        <option value="Manual">Manual</option>
                        <option value="Automatic">Automatic</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">eDoc Format</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                        <option>JSON</option>
                        <option>XML</option>
                      </select>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label">Documents Mapping Determination</label>
                      <input className="form-control form-control-sm" value="Double-click to open" readOnly style={{ background: '#f5f5f5' }} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Document Status</label>
                      <input className="form-control form-control-sm" readOnly style={{ background: '#f5f5f5' }} />
                    </div>
                    <div className="mb-2">
                      <button type="button" className="btn btn-outline-secondary btn-sm">E-Way Bill Details ...</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ATTACHMENTS TAB ═══════════════════════════════════════════ */}
            {activeTab === 'Attachments' && (
              <div className="card p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Attachments</h6>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm" type="button" onClick={handleBrowseAttachment}>Browse</button>
                    <button className="btn btn-outline-secondary btn-sm" type="button" disabled>Display</button>
                    <button className="btn btn-outline-danger btn-sm" type="button" disabled>Delete</button>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>#</th><th>Target Path</th><th>File Name</th><th>Attachment Date</th>
                        <th>Free Text</th><th>Copy to Target</th><th>Document Type</th><th>Doc Date</th><th>Alert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attachments.map(r => (
                        <tr key={r.id}>
                          <td>{r.id}</td><td>{r.targetPath}</td><td>{r.fileName}</td><td>{r.attachmentDate}</td>
                          <td>{r.freeText}</td><td>{r.copyToTargetDocument}</td><td>{r.documentType}</td><td>{r.atchDocDate}</td><td>{r.alert}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══ TOTALS FOOTER ═════════════════════════════════════════════ */}
            <div className="card p-3 mb-3">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Sales Employee</label>
                    <select name="purchaser" className="form-control form-control-sm" value={header.purchaser || ''} onChange={handleHeaderChange}>
                      <option value="">No Sales Employee / Buyer</option>
                      <option value="ASM">ASM</option>
                      <option value="Deepak Kothari">Deepak Kothari</option>
                      <option value="Dhaval">Dhaval</option>
                      <option value="Mala Garma">Mala Garma</option>
                      <option value="OM">OM</option>
                      <option value="Rajkumar Munjal">Rajkumar Munjal</option>
                      <option value="Zach Ibarra">Zach Ibarra</option>
                      <option value="Define New">Define New</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Owner</label>
                    <input name="owner" className="form-control form-control-sm" value={header.owner || ''} onChange={handleHeaderChange} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label mb-1" style={{ fontWeight: 600, fontSize: 11 }}>Remarks</label>
                    <textarea className="form-control form-control-sm" rows={3} name="otherInstruction" value={header.otherInstruction} onChange={handleHeaderChange} />
                  </div>
                </div>
                <div className="col-md-6">
                  {totals.taxBreakdown.length > 0 && (
                    <div className="mb-3">
                      <h6 className="border-bottom pb-1 mb-2" style={{ fontSize: 12, fontWeight: 600 }}>Tax Summary</h6>
                      {totals.taxBreakdown.map(t => (
                        <div key={t.taxCode} className="d-flex justify-content-between" style={{ fontSize: 11, marginBottom: 4 }}>
                          <span>{t.taxCode} ({t.taxRate}%)</span>
                          <span>{fmtDec(t.taxAmount, numDec.tax)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <table style={{ width: '100%', fontSize: 11 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#444', fontWeight: 600 }}>Total Before Discount</td>
                        <td style={{ textAlign: 'right', padding: '3px 0' }}><input className="form-control form-control-sm text-end" value={fmtDec(totals.subtotal, numDec.total)} readOnly style={{ background: '#f5f8fc', fontSize: 11 }} /></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#444', fontWeight: 600 }}>Discount <span style={{ fontSize: 10 }}>%</span></td>
                        <td style={{ textAlign: 'right', padding: '3px 0' }}><input className="form-control form-control-sm text-end" name="discount" value={header.discount} onChange={handleHeaderChange} onBlur={() => handleNumBlur('discount', 'header')} style={{ fontSize: 11 }} /></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#444', fontWeight: 600 }}>Freight</td>
                        <td style={{ textAlign: 'right', padding: '3px 0' }}><input className="form-control form-control-sm text-end" name="freight" value={header.freight} onChange={handleHeaderChange} onBlur={() => handleNumBlur('freight', 'header')} style={{ fontSize: 11 }} /></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#444', fontWeight: 600 }}>
                          <input type="checkbox" className="form-check-input" name="rounding" checked={header.rounding} onChange={handleHeaderChange} style={{ marginRight: 6 }} />
                          <span>Rounding</span>
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#444', fontWeight: 600 }}>Tax</td>
                        <td style={{ textAlign: 'right', padding: '3px 0' }}><input className="form-control form-control-sm text-end" value={fmtDec(totals.taxAmt, numDec.tax)} readOnly style={{ background: '#f5f8fc', fontSize: 11 }} /></td>
                      </tr>
                      <tr style={{ borderTop: '2px solid #0070c0' }}>
                        <td style={{ padding: '6px 0', fontWeight: 700, color: '#003366', fontSize: 12 }}>Total</td>
                        <td style={{ textAlign: 'right', padding: '6px 0' }}><input className="form-control form-control-sm text-end" value={fmtDec(totals.total, numDec.totalPaymentDue)} readOnly style={{ background: '#e8f4fc', fontWeight: 700, color: '#003366', fontSize: 12 }} /></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ══ ACTION BUTTONS ════════════════════════════════════════════ */}
            <div className="d-flex justify-content-between align-items-center mt-3 mb-4">
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-success btn-sm px-3" disabled={pageState.posting}>
                  {pageState.posting ? 'Saving…' : currentDocEntry ? 'Update' : 'Add & New'}
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm px-3" onClick={resetForm}>
                  Cancel
                </button>
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-primary btn-sm px-3">
                  Copy From
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm px-3">
                  Copy To
                </button>
              </div>
            </div>

          </div>{/* end main col */}

          <HeaderUdfSidebar
            isOpen={sidebarOpen}
            fields={visHdrUdfs}
            formSettings={formSettings}
            values={headerUdfs}
            onFieldChange={handleHeaderUdfChange}
            onClose={() => setSidebarOpen(false)}
          />
          <FormSettingsPanel
            variant="sidebar"
            className="col-xl-3 col-lg-4 align-self-start"
            isOpen={formSettingsOpen}
            onClose={() => setFormSettingsOpen(false)}
            matrixFields={MATRIX_COLS}
            headerUdfFields={HEADER_UDF_DEFINITIONS}
            rowUdfFields={ROW_UDF_DEFINITIONS}
            formSettings={formSettings}
            onSettingChange={updateFormSetting}
          />
        </div>
      </div>

      {/* Address Component Modal */}
      {addressModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeAddressModal}>
          <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#6c757d', color: 'white', padding: '8px 16px' }}>
                <h6 className="modal-title mb-0">Address Component</h6>
                <button type="button" className="btn-close btn-close-white" onClick={closeAddressModal}></button>
              </div>
              <div className="modal-body" style={{ padding: '16px' }}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Street / PO Box <span style={{ color: 'red' }}>*</span></label>
                      <input className="form-control form-control-sm" style={{ background: '#ffffcc' }} name="streetNo" value={addressForm.streetNo} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Street No.</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Building/Floor/Room</label>
                      <input className="form-control form-control-sm" name="buildingFloorRoom" value={addressForm.buildingFloorRoom} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Block</label>
                      <input className="form-control form-control-sm" name="block" value={addressForm.block} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>City</label>
                      <input className="form-control form-control-sm" name="city" value={addressForm.city} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Zip Code</label>
                      <input className="form-control form-control-sm" name="zipCode" value={addressForm.zipCode} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>County</label>
                      <input className="form-control form-control-sm" name="county" value={addressForm.county} onChange={handleAddressFormChange} />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>State</label>
                      <select className="form-control form-control-sm" name="state" value={addressForm.state} onChange={handleAddressFormChange}>
                        <option value="">— Select —</option>
                        {refData.states.map(st => <option key={st.Code} value={st.Code}>{st.Name}</option>)}
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Country/Region</label>
                      <input className="form-control form-control-sm" name="countryRegion" value={addressForm.countryRegion} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Address Name 2</label>
                      <input className="form-control form-control-sm" name="addressName2" value={addressForm.addressName2} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Address Name 3</label>
                      <input className="form-control form-control-sm" name="addressName3" value={addressForm.addressName3} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>GLN</label>
                      <input className="form-control form-control-sm" name="gln" value={addressForm.gln} onChange={handleAddressFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>GSTIN No</label>
                      <input className="form-control form-control-sm" name="gstin" value={addressForm.gstin} onChange={handleAddressFormChange} />
                    </div>
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-md-6">
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="printPickingSheet" />
                      <label className="form-check-label" htmlFor="printPickingSheet">Print Picking Sheet</label>
                    </div>
                    <div className="mb-2 mt-2">
                      <label className="form-label" style={{ fontSize: 11 }}>Language</label>
                      <select className="form-control form-control-sm">
                        <option>English</option>
                      </select>
                    </div>
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="procureNonDrop" />
                      <label className="form-check-label" htmlFor="procureNonDrop">Procure Non-Drop-Ship Items</label>
                    </div>
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="procureDrop" />
                      <label className="form-check-label" htmlFor="procureDrop">Procure Drop-Ship Items</label>
                    </div>
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="confirmed" />
                      <label className="form-check-label" htmlFor="confirmed">Confirmed</label>
                    </div>
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="allowPartial" />
                      <label className="form-check-label" htmlFor="allowPartial">Allow Partial Delivery</label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11 }}>Pick and Pack Remarks</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11 }}>BP Channel Name</label>
                      <input className="form-control form-control-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11 }}>BP Channel Contact</label>
                      <select className="form-control form-control-sm">
                        <option value="">— Select —</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '8px 16px' }}>
                <button type="button" className="btn btn-warning btn-sm px-4" onClick={saveAddressModal}>OK</button>
                <button type="button" className="btn btn-secondary btn-sm px-4" onClick={closeAddressModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tax Information Modal */}
      {taxInfoModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeTaxInfoModal}>
          <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header" style={{ background: '#6c757d', color: 'white', padding: '8px 16px' }}>
                <h6 className="modal-title mb-0">Tax Information</h6>
                <button type="button" className="btn-close btn-close-white" onClick={closeTaxInfoModal}></button>
              </div>
              <div className="modal-body" style={{ padding: '16px' }}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>P.A.N. No.</label>
                      <input className="form-control form-control-sm" style={{ background: '#ffffcc' }} name="panNo" value={taxInfoForm.panNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>P.A.N. Circle No.</label>
                      <input className="form-control form-control-sm" name="panCircleNo" value={taxInfoForm.panCircleNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>P.A.N. Ward No.</label>
                      <input className="form-control form-control-sm" name="panWardNo" value={taxInfoForm.panWardNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>P.A.N. Assessing Officer</label>
                      <input className="form-control form-control-sm" name="panAssessingOfficer" value={taxInfoForm.panAssessingOfficer} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Deductee Ref. No.</label>
                      <input className="form-control form-control-sm" name="deducteeRefNo" value={taxInfoForm.deducteeRefNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>LST/VAT No.</label>
                      <input className="form-control form-control-sm" name="lstVatNo" value={taxInfoForm.lstVatNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>CST No.</label>
                      <input className="form-control form-control-sm" name="cstNo" value={taxInfoForm.cstNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>TAN No.</label>
                      <input className="form-control form-control-sm" name="tanNo" value={taxInfoForm.tanNo} onChange={handleTaxInfoFormChange} />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Service Tax No.</label>
                      <input className="form-control form-control-sm" name="serviceTaxNo" value={taxInfoForm.serviceTaxNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Company Type</label>
                      <input className="form-control form-control-sm" name="companyType" value={taxInfoForm.companyType} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Nature of Business</label>
                      <input className="form-control form-control-sm" name="natureOfBusiness" value={taxInfoForm.natureOfBusiness} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>Assessee Type</label>
                      <input className="form-control form-control-sm" name="assesseeType" value={taxInfoForm.assesseeType} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>TIN No.</label>
                      <input className="form-control form-control-sm" name="tinNo" value={taxInfoForm.tinNo} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>ITR Filing</label>
                      <input className="form-control form-control-sm" name="itrFiling" value={taxInfoForm.itrFiling} onChange={handleTaxInfoFormChange} />
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>GST Type</label>
                      <select className="form-control form-control-sm" name="gstType" value={taxInfoForm.gstType} onChange={handleTaxInfoFormChange}>
                        <option value="">— Select —</option>
                        <option>Regular</option>
                        <option>Composition</option>
                        <option>Unregistered</option>
                      </select>
                    </div>
                    <div className="mb-2">
                      <label className="form-label" style={{ fontSize: 11, fontWeight: 600 }}>GSTIN</label>
                      <input className="form-control form-control-sm" name="gstin" value={taxInfoForm.gstin} onChange={handleTaxInfoFormChange} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '8px 16px' }}>
                <button type="button" className="btn btn-warning btn-sm px-4" onClick={saveTaxInfoModal}>OK</button>
                <button type="button" className="btn btn-secondary btn-sm px-4" onClick={closeTaxInfoModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

export default SalesOrderPage;
