import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/appConfig';


const getTodayDate = () => new Date().toISOString().split('T')[0];
const FORM_SETTINGS_STORAGE_KEY = 'sapb1.purchaseOrder.formSettings.v1';

const HEADER_UDF_DEFINITIONS = [
  { key: 'U_LoadPortRemark', label: 'Load Port Remark', type: 'text', defaultValue: '' },
  { key: 'U_InspectionReq', label: 'Inspection Required', type: 'select', defaultValue: 'No', options: ['No', 'Yes'] },
  { key: 'U_SupplierRefDate', label: 'Supplier Ref. Date', type: 'date', defaultValue: '' },
  { key: 'U_PaymentAdvice', label: 'Payment Advice', type: 'textarea', defaultValue: '' },
];

const ROW_UDF_DEFINITIONS = [
  { key: 'U_Brand', label: 'Brand', type: 'text', defaultValue: '' },
  { key: 'U_Origin', label: 'Origin', type: 'text', defaultValue: '' },
  { key: 'U_PackSize', label: 'Pack Size', type: 'text', defaultValue: '' },
  { key: 'U_QcStatus', label: 'QC Status', type: 'select', defaultValue: 'Pending', options: ['Pending', 'Approved', 'Rejected'] },
];

const BASE_MATRIX_COLUMNS = [
  { key: 'itemNo', label: 'Item No.' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'stdDiscount', label: 'Discount %' },
  { key: 'taxCode', label: 'Tax Code' },
  { key: 'total', label: 'Total (LC)' },
  { key: 'whse', label: 'Whse' },
];

const createUdfState = (definitions) =>
  definitions.reduce((acc, field) => {
    acc[field.key] = field.defaultValue;
    return acc;
  }, {});

const createInitialLine = () => ({
  itemNo: '',
  itemDescription: '',
  quantity: '',
  unitPrice: '',
  stdDiscount: '',
  taxCode: '',
  total: '',
  whse: '',
  udf: createUdfState(ROW_UDF_DEFINITIONS),
});

const createDefaultFormSettings = () => ({
  headerUdfs: HEADER_UDF_DEFINITIONS.reduce((acc, field) => {
    acc[field.key] = { visible: true, active: true };
    return acc;
  }, {}),
  matrixColumns: BASE_MATRIX_COLUMNS.reduce((acc, field) => {
    acc[field.key] = { visible: true, active: true };
    return acc;
  }, {}),
  rowUdfs: ROW_UDF_DEFINITIONS.reduce((acc, field) => {
    acc[field.key] = { visible: true, active: true };
    return acc;
  }, {}),
});

const DEFAULT_DECIMAL_SETTINGS = {
  QtyDec: 2,
  PriceDec: 2,
  SumDec: 2,
  RateDec: 2,
  PercentDec: 2,
};

const readSavedFormSettings = () => {
  try {
    const raw = localStorage.getItem(FORM_SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultFormSettings();
    return {
      ...createDefaultFormSettings(),
      ...JSON.parse(raw),
    };
  } catch (error) {
    return createDefaultFormSettings();
  }
};

const formatAddressBlock = (address) => {
  if (!address) return '';
  const lineOne = [address.Street, address.StreetNo].filter(Boolean).join(', ');
  const lineTwo = [address.Block, address.Building, address.Address2, address.Address3]
    .filter(Boolean)
    .join(', ');
  const lineThree = [address.City, address.County, address.State, address.ZipCode]
    .filter(Boolean)
    .join(', ');
  const lineFour = [address.Country].filter(Boolean).join(', ');

  return [lineOne, lineTwo, lineThree, lineFour].filter(Boolean).join('\n');
};

const initialLine = createInitialLine();

const initialAttachmentRow = {
  targetPath: '',
  fileName: '',
  attachmentDate: '',
  freeText: '',
  copyToTargetDocument: '',
  documentType: '',
  atchDocDate: '',
  alert: '',
};

const initialHeader = {
  vendor: '',
  name: '',
  contactPerson: '',
  salesContractNo: '',
  currency: 'Local Currency',
  branch: '',
  bank: '',
  bankAcNo: '',
  rateFix: '',
  incoterms: '',
  docNo: '',
  status: 'Open',
  postingDate: getTodayDate(),
  deliveryDate: '',
  documentDate: getTodayDate(),
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
  splitPurchaseOrder: false,
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
  owner: '',
  agentCode: '',
  agentName: '',
  otherInstruction: '',
  totalBeforeDiscount: '',
  discount: '',
  freight: '',
  rounding: false,
  tax: '',
  totalPaymentDue: '',
};

const tabNames = [
  'Contents',
  'Logistics',
  'Accounting',
  'Tax',
  'Electronic Documents',
  'Attachments',
];

const PURCHASE_ORDER_COMPANY_ID = '1';

function PurchaseOrderPage() {
  const [header, setHeader] = useState(initialHeader);
  const [lines, setLines] = useState([{ ...initialLine, udf: { ...initialLine.udf } }]);
  const [attachments] = useState(
    Array.from({ length: 9 }, (_, index) => ({
      ...initialAttachmentRow,
      id: index + 1,
    }))
  );
  const [activeTab, setActiveTab] = useState('Contents');
  const [headerUdfs, setHeaderUdfs] = useState(() => createUdfState(HEADER_UDF_DEFINITIONS));
  const [formSettings, setFormSettings] = useState(() => readSavedFormSettings());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formSettingsOpen, setFormSettingsOpen] = useState(false);
  const [referenceData, setReferenceData] = useState({
    company: '',
    vendors: [],
    contacts: [],
    pay_to_addresses: [],
    items: [],
    warehouses: [],
    warehouse_addresses: [],
    company_address: {},
    tax_codes: [],
    payment_terms: [],
    shipping_types: [],
    branches: [],
    decimal_settings: DEFAULT_DECIMAL_SETTINGS,
    warnings: [],
  });
  const [pageState, setPageState] = useState({
    loading: false,
    posting: false,
    error: '',
    success: '',
  });

  useEffect(() => {
    localStorage.setItem(FORM_SETTINGS_STORAGE_KEY, JSON.stringify(formSettings));
  }, [formSettings]);

  useEffect(() => {
    let ignore = false;

    const loadReferenceData = async () => {
      setPageState((prev) => ({ ...prev, loading: true, error: '', success: '' }));
      try {
        const response = await axios.get(`${API_BASE_URL}/purchase-order/reference-data`, {
         params: { company_id: PURCHASE_ORDER_COMPANY_ID },
        });
        if (!ignore) {
          setReferenceData({
            company: response.data.company || '',
            vendors: response.data.vendors || [],
            contacts: response.data.contacts || [],
            pay_to_addresses: response.data.pay_to_addresses || [],
            items: response.data.items || [],
            warehouses: response.data.warehouses || [],
            warehouse_addresses: response.data.warehouse_addresses || [],
            company_address: response.data.company_address || {},
            tax_codes: response.data.tax_codes || [],
            payment_terms: response.data.payment_terms || [],
            shipping_types: response.data.shipping_types || [],
            branches: response.data.branches || [],
            decimal_settings: {
              ...DEFAULT_DECIMAL_SETTINGS,
              ...(response.data.decimal_settings || {}),
            },
            warnings: response.data.warnings || [],
          });
        }
      } catch (error) {
        if (!ignore) {
          setPageState((prev) => ({
            ...prev,
            error: error.response?.data?.detail || error.message || 'Failed to load Metrec data.',
          }));
        }
      } finally {
        if (!ignore) {
          setPageState((prev) => ({ ...prev, loading: false }));
        }
      }
    };

    loadReferenceData();
    return () => {
      ignore = true;
    };
  }, []);

  const vendorContacts = referenceData.contacts.filter(
    (contact) => String(contact.CardCode || '') === String(header.vendor || '')
  );
  const vendorPayToAddresses = referenceData.pay_to_addresses.filter(
    (address) => String(address.CardCode || '') === String(header.vendor || '')
  );
  const selectedBranch = referenceData.branches.find(
    (branch) => String(branch.BPLId || '') === String(header.branch || '')
  );
  const firstLineWarehouseCode = String(lines[0]?.whse || '').trim();
  const selectedWarehouseAddress = referenceData.warehouse_addresses.find(
    (warehouse) => String(warehouse.WhsCode || '') === firstLineWarehouseCode
  );
  const defaultCompanyShipTo = formatAddressBlock(referenceData.company_address);
  const decimalSettings = {
    ...DEFAULT_DECIMAL_SETTINGS,
    ...(referenceData.decimal_settings || {}),
  };

  const paymentTermOptions = referenceData.payment_terms.length
    ? referenceData.payment_terms.map((term) => ({
      value: String(term.GroupNum),
      label: term.PymntGroup,
    }))
    : [
      { value: 'Net 30', label: 'Net 30' },
      { value: 'Net 60', label: 'Net 60' },
    ];

  const shippingTypeOptions = referenceData.shipping_types.length
    ? referenceData.shipping_types.map((shippingType) => ({
      value: String(shippingType.TrnspCode),
      label: shippingType.TrnspName,
    }))
    : [
      { value: 'Air', label: 'Air' },
      { value: 'Sea', label: 'Sea' },
      { value: 'Road', label: 'Road' },
    ];

  const formatIndianTaxCodeLabel = (taxCode) => {
    const code = String(taxCode?.Code || '').trim();
    const name = String(taxCode?.Name || '').trim();
    const combined = `${code} ${name}`.toUpperCase();

    let taxType = '';
    if (combined.includes('IGST')) taxType = 'IGST';
    else if (combined.includes('CGST') && combined.includes('SGST')) taxType = 'CGST+SGST';
    else if (combined.includes('CGST')) taxType = 'CGST';
    else if (combined.includes('SGST')) taxType = 'SGST';
    else if (combined.includes('UTGST')) taxType = 'UTGST';
    else if (combined.includes('CESS')) taxType = 'CESS';
    else if (combined.includes('GST')) taxType = 'GST';

    const rateValue =
      taxCode?.Rate !== undefined && taxCode?.Rate !== null && taxCode?.Rate !== ''
        ? Number(taxCode.Rate)
        : null;
    const percentMatch = combined.match(/(\d+(?:\.\d+)?)\s*%/);
    const percentText =
      rateValue !== null && !Number.isNaN(rateValue)
        ? `${rateValue}%`
        : percentMatch
          ? `${percentMatch[1]}%`
          : '';

    if (taxType && percentText) {
      return `${code} - ${taxType} ${percentText}`;
    }
    if (taxType) {
      return `${code} - ${taxType}`;
    }
    return name ? `${code} - ${name}` : code;
  };

  const gstPattern = /(IGST|CGST|SGST|UTGST|CESS|GST)/i;
  const gstTaxCodes = referenceData.tax_codes.filter((taxCode) =>
    gstPattern.test(`${taxCode.Code || ''} ${taxCode.Name || ''}`)
  );
  const taxCodeOptions = gstTaxCodes.length > 0 ? gstTaxCodes : referenceData.tax_codes;

  const numericFieldDecimals = {
    quantity: Number(decimalSettings.QtyDec ?? DEFAULT_DECIMAL_SETTINGS.QtyDec),
    unitPrice: Number(decimalSettings.PriceDec ?? DEFAULT_DECIMAL_SETTINGS.PriceDec),
    stdDiscount: Number(decimalSettings.PercentDec ?? DEFAULT_DECIMAL_SETTINGS.PercentDec),
    total: Number(decimalSettings.SumDec ?? DEFAULT_DECIMAL_SETTINGS.SumDec),
    rateFix: Number(decimalSettings.RateDec ?? DEFAULT_DECIMAL_SETTINGS.RateDec),
    advancePaymentPercent: Number(decimalSettings.PercentDec ?? DEFAULT_DECIMAL_SETTINGS.PercentDec),
    advanceAmt: Number(decimalSettings.SumDec ?? DEFAULT_DECIMAL_SETTINGS.SumDec),
    withinDays: 0,
    discount: Number(decimalSettings.PercentDec ?? DEFAULT_DECIMAL_SETTINGS.PercentDec),
    freight: Number(decimalSettings.SumDec ?? DEFAULT_DECIMAL_SETTINGS.SumDec),
    tax: Number(decimalSettings.SumDec ?? DEFAULT_DECIMAL_SETTINGS.SumDec),
    totalPaymentDue: Number(decimalSettings.SumDec ?? DEFAULT_DECIMAL_SETTINGS.SumDec),
  };

  const sanitizeDecimalInput = (value, decimals) => {
    const cleaned = String(value ?? '').replace(/[^\d.-]/g, '');
    if (!cleaned) return '';
    const normalized = cleaned
      .replace(/(?!^)-/g, '')
      .replace(/^(-?)\./, '$10.')
      .replace(/(\..*)\./g, '$1');
    if (!normalized.includes('.')) return normalized;
    const [whole, fraction] = normalized.split('.');
    return `${whole}.${(fraction || '').slice(0, Math.max(decimals, 0))}`;
  };

  const formatDecimalValue = (value, decimals) => {
    if (value === '' || value === null || value === undefined) return '';
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return '';
    return parsed.toFixed(Math.max(decimals, 0));
  };

  const parseNumericValue = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const roundTo = (value, decimals) => {
    const factor = 10 ** Math.max(decimals, 0);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  };

  const calculateLineTotalValue = (line) => {
    const quantity = parseNumericValue(line.quantity);
    const unitPrice = parseNumericValue(line.unitPrice);
    const rowDiscount = parseNumericValue(line.stdDiscount);
    const gross = quantity * unitPrice;
    const net = gross - (gross * rowDiscount) / 100;
    return roundTo(net, numericFieldDecimals.total);
  };

  const calculateDocumentTotals = () => {
    const taxRateByCode = new Map(
      taxCodeOptions.map((taxCode) => [String(taxCode.Code || ''), parseNumericValue(taxCode.Rate)])
    );

    const subtotal = lines.reduce((sum, line) => sum + calculateLineTotalValue(line), 0);
    const docDiscountPercent = parseNumericValue(header.discount);
    const discountAmount = roundTo((subtotal * docDiscountPercent) / 100, numericFieldDecimals.total);
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const freightAmount = roundTo(parseNumericValue(header.freight), numericFieldDecimals.total);

    let taxAmount = 0;
    const taxBreakdownMap = new Map();

    if (subtotal > 0) {
      lines.forEach((line) => {
        const lineNet = calculateLineTotalValue(line);
        if (lineNet <= 0 || !line.taxCode) return;
        const taxRate = taxRateByCode.get(String(line.taxCode || '')) || 0;
        const apportionedBase = discountedSubtotal * (lineNet / subtotal);
        const lineTax = roundTo((apportionedBase * taxRate) / 100, numericFieldDecimals.tax);
        taxAmount += lineTax;

        const existing = taxBreakdownMap.get(line.taxCode) || {
          taxCode: line.taxCode,
          taxRate,
          taxableAmount: 0,
          taxAmount: 0,
        };
        existing.taxableAmount = roundTo(existing.taxableAmount + apportionedBase, numericFieldDecimals.total);
        existing.taxAmount = roundTo(existing.taxAmount + lineTax, numericFieldDecimals.tax);
        taxBreakdownMap.set(line.taxCode, existing);
      });
    }

    taxAmount = roundTo(taxAmount, numericFieldDecimals.tax);
    const totalPaymentDue = roundTo(
      discountedSubtotal + freightAmount + taxAmount,
      numericFieldDecimals.totalPaymentDue
    );

    return {
      subtotal,
      discountAmount,
      discountedSubtotal,
      freightAmount,
      taxAmount,
      totalPaymentDue,
      taxBreakdown: Array.from(taxBreakdownMap.values()),
    };
  };

  const handleNumericFieldBlur = (fieldName, target = 'line', index = null) => {
    const decimals = numericFieldDecimals[fieldName];
    if (decimals === undefined) return;
    if (target === 'header') {
      setHeader((prev) => ({
        ...prev,
        [fieldName]: formatDecimalValue(prev[fieldName], decimals),
      }));
      return;
    }
    setLines((prev) =>
      prev.map((line, currentIndex) =>
        currentIndex === index
          ? {
            ...line,
            [fieldName]: formatDecimalValue(line[fieldName], decimals),
          }
          : line
      )
    );
  };

  const visibleMatrixColumns = BASE_MATRIX_COLUMNS.filter(
    (column) => formSettings.matrixColumns[column.key]?.visible !== false
  );
  const visibleRowUdfs = ROW_UDF_DEFINITIONS.filter(
    (field) => formSettings.rowUdfs[field.key]?.visible !== false
  );
  const visibleHeaderUdfs = HEADER_UDF_DEFINITIONS.filter(
    (field) => formSettings.headerUdfs[field.key]?.visible !== false
  );
  const documentTotals = calculateDocumentTotals();

  const handleHeaderUdfChange = (key, value) => {
    setHeaderUdfs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRowUdfChange = (index, key, value) => {
    setLines((prev) =>
      prev.map((line, currentIndex) =>
        currentIndex === index
          ? {
            ...line,
            udf: {
              ...(line.udf || {}),
              [key]: value,
            },
          }
          : line
      )
    );
  };

  const updateFormSetting = (group, key, prop, value) => {
    setFormSettings((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: {
          ...prev[group][key],
          [prop]: value,
        },
      },
    }));
  };

  useEffect(() => {
    setHeader((prev) => {
      if (prev.shipToCode) return prev;
      const nextShipTo = selectedWarehouseAddress
        ? formatAddressBlock(selectedWarehouseAddress)
        : defaultCompanyShipTo;
      if (!nextShipTo || prev.shipTo === nextShipTo) return prev;
      return {
        ...prev,
        shipToCode: selectedWarehouseAddress ? selectedWarehouseAddress.WhsCode : 'COMPANY',
        shipTo: nextShipTo,
      };
    });
  }, [selectedWarehouseAddress, defaultCompanyShipTo]);

  useEffect(() => {
    if (!header.vendor) return;
    setHeader((prev) => {
      const existingPayTo = vendorPayToAddresses.find(
        (address) => String(address.Address || '') === String(prev.payToCode || '')
      );
      if (existingPayTo) return prev;
      const defaultPayTo = vendorPayToAddresses[0];
      if (!defaultPayTo) return prev;
      const formattedAddress = formatAddressBlock(defaultPayTo);
      if (
        prev.payToCode === defaultPayTo.Address &&
        prev.payTo === formattedAddress
      ) {
        return prev;
      }
      return {
        ...prev,
        payToCode: defaultPayTo.Address || '',
        payTo: formattedAddress,
      };
    });
  }, [header.vendor, vendorPayToAddresses]);

  const syncVendorDetails = (vendorCode, nextHeader) => {
    const matchedVendor = referenceData.vendors.find(
      (vendor) => String(vendor.CardCode || '') === String(vendorCode || '')
    );
    if (!matchedVendor) {
      return { nextHeader, vendorTaxCode: '' };
    }

    return {
      nextHeader: {
        ...nextHeader,
        name: matchedVendor.CardName || nextHeader.name,
        currency: matchedVendor.Currency || nextHeader.currency,
        paymentTerms:
          matchedVendor.GroupNum !== undefined && matchedVendor.GroupNum !== null
            ? String(matchedVendor.GroupNum)
            : nextHeader.paymentTerms,
        contactPerson: '',
      },
      vendorTaxCode: matchedVendor.VatGroup || '',
    };
  };

  const handleHeaderChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === 'vendor') {
      setHeader((prev) => {
        const preparedHeader = {
          ...prev,
          [name]: type === 'checkbox' ? checked : value,
        };
        const { nextHeader, vendorTaxCode } = syncVendorDetails(value, preparedHeader);
        setLines((currentLines) =>
          currentLines.map((line) => ({
            ...line,
            taxCode: vendorTaxCode || line.taxCode,
          }))
        );
        return nextHeader;
      });
      return;
    }

    if (numericFieldDecimals[name] !== undefined && type !== 'checkbox') {
      setHeader((prev) => ({
        ...prev,
        [name]: sanitizeDecimalInput(value, numericFieldDecimals[name]),
      }));
      return;
    }

    setHeader((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLineChange = (index, event) => {
    const { name, value } = event.target;
    setLines((prev) =>
      prev.map((line, currentIndex) =>
        currentIndex === index
          ? (() => {
            const nextLine = {
              ...line,
              [name]:
                numericFieldDecimals[name] !== undefined
                  ? sanitizeDecimalInput(value, numericFieldDecimals[name])
                  : value,
            };
            if (name === 'itemNo') {
              const matchedItem = referenceData.items.find(
                (item) => String(item.ItemCode || '') === String(value || '')
              );
              if (matchedItem) {
                nextLine.itemDescription = matchedItem.ItemName || nextLine.itemDescription;
              }
              if (!nextLine.taxCode) {
                const matchedVendor = referenceData.vendors.find(
                  (vendor) => String(vendor.CardCode || '') === String(header.vendor || '')
                );
                if (matchedVendor?.VatGroup) {
                  nextLine.taxCode = matchedVendor.VatGroup;
                }
              }
            }
            nextLine.total = formatDecimalValue(
              calculateLineTotalValue(nextLine),
              numericFieldDecimals.total
            );
            return nextLine;
          })()
          : line
      )
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, createInitialLine()]);
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPageState((prev) => ({ ...prev, posting: true, error: '', success: '' }));

    try {
      const response = await axios.post(`${API_BASE_URL}/purchase-order/submit`, {
        company_id: PURCHASE_ORDER_COMPANY_ID,
        header,
        lines,
        header_udfs: headerUdfs,
      });
      const docNum = response.data.doc_num ? ` Doc No: ${response.data.doc_num}.` : '';
      setPageState((prev) => ({
        ...prev,
        success: `${response.data.message || 'Purchase order posted successfully.'}${docNum}`,
      }));
    } catch (error) {
      const detail = error.response?.data?.detail;
      setPageState((prev) => ({
        ...prev,
        error:
          typeof detail === 'string'
            ? detail
            : error.message || 'Purchase order submission failed.',
      }));
    } finally {
      setPageState((prev) => ({ ...prev, posting: false }));
    }
  };

  return (
    <form className="container-fluid" onSubmit={handleSubmit}>
      <h2 className="mb-4">Purchase Order</h2>
      <div className="d-flex gap-2 mb-3">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          {sidebarOpen ? 'Hide UDFs' : 'Show UDFs'}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => setFormSettingsOpen((prev) => !prev)}
        >
          Form Settings
        </button>
      </div>
      {/* <div className="po-system-banner">
        <div>
          <strong>Source DB:</strong> {referenceData.company || 'Metrec SQL Server'}
        </div>
        <div>
          <strong>Posting:</strong> SAP Business One Service Layer
        </div>
        <div>
          <strong>Decimals:</strong> Qty {decimalSettings.QtyDec}, Price {decimalSettings.PriceDec}, Amount {decimalSettings.SumDec}, % {decimalSettings.PercentDec}
        </div>
      </div> */}
      <div className="container-fluid">
        <div className="row">

          {/* MAIN CONTENT */}
          <div className={sidebarOpen ? "col-md-9" : "col-md-12"}>
            {/* {pageState.loading && <div className="po-status po-status-info">Loading Metrec master data...</div>} */}
            {/* {referenceData.warnings.length > 0 && (
        <div className="po-status po-status-warn">
          Some SAP Business One reference lists could not be loaded from Metrec. Manual entry is still available.
        </div>
      )} */}
            {/* {pageState.error && <div className="po-status po-status-error">{pageState.error}</div>}
      {pageState.success && <div className="po-status po-status-success">{pageState.success}</div>} */}

            <div className="card p-3 mb-3">
              <div className="row g-2">

                {/* COLUMN 1 */}
                <div className="col-md-3">

                  <div className="mb-2">
                    <label className="form-label mb-1">Vendor</label>
                    <input
                      name="vendor"
                      className="form-control form-control-sm"
                      value={header.vendor}
                      onChange={handleHeaderChange}
                      list="po-vendor-list"
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Name</label>
                    <input
                      name="name"
                      className="form-control form-control-sm"
                      value={header.name}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Contact Person</label>
                    <select
                      name="contactPerson"
                      className="form-control form-control-sm"
                      value={header.contactPerson}
                      onChange={handleHeaderChange}
                    >
                      <option value="">Select contact</option>
                      {vendorContacts.map((contact) => (
                        <option key={contact.CntctCode} value={contact.CntctCode}>
                          {contact.Name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Sales Contract No.</label>
                    <input
                      name="salesContractNo"
                      className="form-control form-control-sm"
                      value={header.salesContractNo}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Currency</label>
                    <select
                      name="currency"
                      className="form-control form-control-sm"
                      value={header.currency}
                      onChange={handleHeaderChange}
                    >
                      <option value="Local Currency">Local Currency</option>
                      {referenceData.vendors
                        .map((v) => v.Currency)
                        .filter((c, i, arr) => c && arr.indexOf(c) === i)
                        .map((currency) => (
                          <option key={currency}>{currency}</option>
                        ))}
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Our Branch</label>
                    <select
                      name="branch"
                      className="form-control form-control-sm"
                      value={header.branch}
                      onChange={handleHeaderChange}
                    >
                      <option value="">Select branch</option>
                      {referenceData.branches.map((b) => (
                        <option key={b.BPLId} value={b.BPLId}>
                          {b.BPLName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedBranch && (
                    <div className="text-muted small">
                      Branch Name: {selectedBranch.BPLName}
                    </div>
                  )}

                </div>

                {/* COLUMN 2 */}
                <div className="col-md-3">

                  <div className="mb-2">
                    <label className="form-label mb-1">Bank</label>
                    <input
                      name="bank"
                      className="form-control form-control-sm"
                      value={header.bank}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Bank A/c No.</label>
                    <input
                      name="bankAcNo"
                      className="form-control form-control-sm"
                      value={header.bankAcNo}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Rate Fix</label>
                    <input
                      name="rateFix"
                      className="form-control form-control-sm text-end"
                      value={header.rateFix}
                      onChange={handleHeaderChange}
                      onBlur={() => handleNumericFieldBlur('rateFix', 'header')}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">INCOTERMS</label>
                    <input
                      name="incoterms"
                      className="form-control form-control-sm"
                      value={header.incoterms}
                      onChange={handleHeaderChange}
                    />
                  </div>

                </div>

                {/* COLUMN 3 */}
                <div className="col-md-3">

                  <div className="mb-2">
                    <label className="form-label mb-1">No.</label>
                    <input
                      name="docNo"
                      className="form-control form-control-sm"
                      value={header.docNo}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Status</label>
                    <input
                      name="status"
                      className="form-control form-control-sm"
                      value={header.status}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Posting Date</label>
                    <input
                      type="date"
                      name="postingDate"
                      className="form-control form-control-sm"
                      value={header.postingDate}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Delivery Date</label>
                    <input
                      type="date"
                      name="deliveryDate"
                      className="form-control form-control-sm"
                      value={header.deliveryDate}
                      onChange={handleHeaderChange}
                    />
                  </div>

                </div>

                {/* COLUMN 4 */}
                <div className="col-md-3">

                  <div className="mb-2">
                    <label className="form-label mb-1">Document Date</label>
                    <input
                      type="date"
                      name="documentDate"
                      className="form-control form-control-sm"
                      value={header.documentDate}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Contract Date</label>
                    <input
                      type="date"
                      name="contractDate"
                      className="form-control form-control-sm"
                      value={header.contractDate}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label mb-1">Branch Reg. No.</label>
                    <input
                      name="branchRegNo"
                      className="form-control form-control-sm"
                      value={header.branchRegNo}
                      onChange={handleHeaderChange}
                    />
                  </div>

                </div>

              </div>
            </div>

            <ul className="nav nav-tabs mb-3">
              {tabNames.map((tab) => (
                <li className="nav-item" key={tab}>
                  <button
                    type="button"
                    className={`nav-link ${activeTab === tab ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                </li>
              ))}
            </ul>

            {activeTab === "Contents" && (
              <div className="card p-3 mb-3">

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Item Matrix</h6>
                  <button
                    type="button"
                    onClick={addLine}
                    className="btn btn-outline-primary btn-sm"
                  >
                    + Add Line
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle">

                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        {visibleMatrixColumns.map((col) => (
                          <th key={col.key}>{col.label}</th>
                        ))}
                        {visibleRowUdfs.map((f) => (
                          <th key={f.key}>{f.label}</th>
                        ))}
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {lines.map((line, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>

                          {visibleMatrixColumns.map((col) => {
                            const isActive = formSettings.matrixColumns[col.key]?.active !== false;
                            const isTotal = col.key === "total";

                            if (col.key === "taxCode") {
                              return (
                                <td key={col.key}>
                                  <select
                                    className="form-control form-control-sm"
                                    value={line.taxCode || ""}
                                    disabled={!isActive}
                                    onChange={(e) => handleLineChange(index, e)}
                                  >
                                    <option value="">Select</option>
                                    {taxCodeOptions.map((t) => (
                                      <option key={t.Code} value={t.Code}>
                                        {formatIndianTaxCodeLabel(t)}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }

                            return (
                              <td key={col.key}>
                                <input
                                  className="form-control form-control-sm"
                                  name={col.key}
                                  value={line[col.key] || ""}
                                  disabled={!isActive || isTotal}
                                  onChange={(e) => handleLineChange(index, e)}
                                />
                              </td>
                            );
                          })}

                          {visibleRowUdfs.map((f) => (
                            <td key={f.key}>
                              <input
                                className="form-control form-control-sm"
                                value={line.udf?.[f.key] || ""}
                                onChange={(e) =>
                                  handleRowUdfChange(index, f.key, e.target.value)
                                }
                              />
                            </td>
                          ))}

                          <td>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => removeLine(index)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>
              </div>
            )}

            {activeTab === "Logistics" && (
              <div className="card p-3 mb-3">

                <div className="row g-3">

                  {/* LEFT */}
                  <div className="col-md-6">

                    <div className="mb-2">
                      <label className="form-label">Ship To Code</label>
                      <select
                        className="form-control form-control-sm"
                        name="shipToCode"
                        value={header.shipToCode}
                        onChange={(e) => {
                          const selectedCode = e.target.value;
                          const selectedAddress =
                            selectedCode === "COMPANY"
                              ? referenceData.company_address
                              : referenceData.warehouse_addresses.find(
                                (w) => String(w.WhsCode) === selectedCode
                              );

                          setHeader((prev) => ({
                            ...prev,
                            shipToCode: selectedCode,
                            shipTo: formatAddressBlock(selectedAddress),
                          }));
                        }}
                      >
                        <option value="">Select</option>
                        {referenceData.warehouse_addresses.map((w) => (
                          <option key={w.WhsCode} value={w.WhsCode}>
                            {w.WhsCode} - {w.WhsName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Ship To</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows={3}
                        name="shipTo"
                        value={header.shipTo}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Pay To Code</label>
                      <select
                        className="form-control form-control-sm"
                        name="payToCode"
                        value={header.payToCode}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        {vendorPayToAddresses.map((a) => (
                          <option key={a.Address} value={a.Address}>
                            {a.Address}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>

                  {/* RIGHT */}
                  <div className="col-md-6">

                    <div className="mb-2">
                      <label className="form-label">Shipping Type</label>
                      <select
                        className="form-control form-control-sm"
                        name="shippingType"
                        value={header.shippingType}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        {shippingTypeOptions.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-check mt-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        name="confirmed"
                        checked={header.confirmed}
                        onChange={handleHeaderChange}
                      />
                      <label className="form-check-label">
                        Confirmed
                      </label>
                    </div>

                  </div>

                </div>

              </div>
            )}

            {activeTab === "Accounting" && (
              <div className="card p-3 mb-3">
                <div className="row g-3">

                  {/* COLUMN 1 */}
                  <div className="col-md-3">

                    <div className="mb-2">
                      <label className="form-label">Journal Remark</label>
                      <input
                        className="form-control form-control-sm"
                        name="journalRemark"
                        value={header.journalRemark}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Payment Terms</label>
                      <select
                        className="form-control form-control-sm"
                        name="paymentTerms"
                        value={header.paymentTerms}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        {paymentTermOptions.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Payment Method</label>
                      <select
                        className="form-control form-control-sm"
                        name="paymentMethod"
                        value={header.paymentMethod}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        <option>Bank Transfer</option>
                        <option>Cheque</option>
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Central Bank Ind.</label>
                      <select
                        className="form-control form-control-sm"
                        name="centralBankInd"
                        value={header.centralBankInd}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        <option>CBI1</option>
                        <option>CBI2</option>
                      </select>
                    </div>

                  </div>

                  {/* COLUMN 2 */}
                  <div className="col-md-5">

                    <div className="mb-2">
                      <label className="form-label">Payment Terms</label>
                      <select
                        className="form-control form-control-sm"
                        name="paymentTerms2"
                        value={header.paymentTerms2}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        {paymentTermOptions.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Advance Payment %</label>
                      <input
                        className="form-control form-control-sm text-end"
                        name="advancePaymentPercent"
                        value={header.advancePaymentPercent}
                        onChange={handleHeaderChange}
                        onBlur={() => handleNumericFieldBlur("advancePaymentPercent", "header")}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Advance Amount</label>
                      <input
                        className="form-control form-control-sm text-end"
                        name="advanceAmt"
                        value={header.advanceAmt}
                        onChange={handleHeaderChange}
                        onBlur={() => handleNumericFieldBlur("advanceAmt", "header")}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Balance Payment Against</label>
                      <select
                        className="form-control form-control-sm"
                        name="balancePaymentAgainst"
                        value={header.balancePaymentAgainst}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        <option>Invoice</option>
                        <option>Order</option>
                      </select>
                    </div>

                  </div>

                  {/* COLUMN 3 */}
                  <div className="col-md-4">

                    <div className="mb-2">
                      <label className="form-label">Business Partner Project</label>
                      <input
                        className="form-control form-control-sm"
                        name="bpProject"
                        value={header.bpProject}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Required Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        name="requiredDate"
                        value={header.requiredDate}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Indicator</label>
                      <select
                        className="form-control form-control-sm"
                        name="indicator"
                        value={header.indicator}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        <option>Ind1</option>
                        <option>Ind2</option>
                      </select>
                    </div>

                  </div>

                </div>
              </div>
            )}

            {activeTab === "Tax" && (
              <div className="card p-3 mb-3">

                <div className="row g-3">

                  {/* LEFT */}
                  <div className="col-md-8">

                    <div className="mb-2">
                      <label className="form-label">Tax Information</label>
                      <div className="input-group input-group-sm">
                        <input
                          className="form-control"
                          name="taxInformation"
                          value={header.taxInformation}
                          onChange={handleHeaderChange}
                        />
                        <button className="btn btn-outline-secondary" type="button">
                          ...
                        </button>
                      </div>
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Transaction Category</label>
                      <select
                        className="form-control form-control-sm"
                        name="transactionCategory"
                        value={header.transactionCategory}
                        onChange={handleHeaderChange}
                      >
                        <option value="">Select</option>
                        <option>Domestic</option>
                        <option>Export</option>
                        <option>Import</option>
                      </select>
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Form No.</label>
                      <input
                        className="form-control form-control-sm"
                        name="formNo"
                        value={header.formNo}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Duty Status</label>
                      <select
                        className="form-control form-control-sm"
                        name="dutyStatus"
                        value={header.dutyStatus}
                        onChange={handleHeaderChange}
                      >
                        <option>With Payment of Duty</option>
                        <option>Without Payment of Duty</option>
                      </select>
                    </div>

                  </div>

                  {/* RIGHT */}
                  <div className="col-md-4">

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        name="importTax"
                        checked={header.importTax}
                        onChange={handleHeaderChange}
                      />
                      <label className="form-check-label">Import</label>
                    </div>

                  </div>

                </div>

                {/* FOOTER */}
                <div className="mt-3 border-top pt-2">

                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="supplyCovered"
                      checked={header.supplyCovered}
                      onChange={handleHeaderChange}
                    />
                    <label className="form-check-label">
                      Supply Covered under Sec 7 of IGST Act
                    </label>
                  </div>

                  <div className="row g-2 align-items-center">
                    <div className="col-md-6">
                      <label className="form-label">Differential % of Tax Rate</label>
                    </div>
                    <div className="col-md-3">
                      <select
                        className="form-control form-control-sm"
                        name="differentialTaxRate"
                        value={header.differentialTaxRate}
                        onChange={handleHeaderChange}
                      >
                        <option value="100">100</option>
                        <option value="65">65</option>
                        <option value="50">50</option>
                      </select>
                    </div>
                  </div>

                </div>

              </div>
            )}
            {activeTab === "Electronic Documents" && (
              <div className="card p-3 mb-3">

                <h6 className="mb-3 border-bottom pb-2">Generic eDoc Protocol</h6>

                <div className="row g-3">

                  <div className="col-md-6">

                    <div className="mb-2">
                      <label className="form-label">eDoc Format</label>
                      <input
                        className="form-control form-control-sm"
                        name="edocFormat"
                        value={header.edocFormat}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Document Status</label>
                      <div className="input-group input-group-sm">
                        <button className="btn btn-outline-secondary" type="button">
                          →
                        </button>
                        <input
                          className="form-control"
                          name="documentStatus"
                          value={header.documentStatus}
                          onChange={handleHeaderChange}
                        />
                      </div>
                    </div>

                  </div>

                  <div className="col-md-6">

                    <div className="mb-2">
                      <label className="form-label">Total of Imported Document</label>
                      <input
                        className="form-control form-control-sm text-end"
                        name="totalImportedDocument"
                        value={header.totalImportedDocument}
                        onChange={handleHeaderChange}
                      />
                    </div>

                    <div className="mb-2">
                      <label className="form-label">Date Received</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        name="dateReceived"
                        value={header.dateReceived}
                        onChange={handleHeaderChange}
                      />
                    </div>

                  </div>

                </div>

              </div>
            )}

            {activeTab === "Attachments" && (
              <div className="card p-3 mb-3">

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Attachments</h6>

                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm">Browse</button>
                    <button className="btn btn-outline-secondary btn-sm" disabled>
                      Display
                    </button>
                    <button className="btn btn-outline-danger btn-sm" disabled>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle">

                    <thead className="table-light">
                      <tr>
                        <th>#</th>
                        <th>Target Path</th>
                        <th>File Name</th>
                        <th>Attachment Date</th>
                        <th>Free Text</th>
                        <th>Copy to Target</th>
                        <th>Document Type</th>
                        <th>Doc Date</th>
                        <th>Alert</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attachments.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.targetPath}</td>
                          <td>{row.fileName}</td>
                          <td>{row.attachmentDate}</td>
                          <td>{row.freeText}</td>
                          <td>{row.copyToTargetDocument}</td>
                          <td>{row.documentType}</td>
                          <td>{row.atchDocDate}</td>
                          <td>{row.alert}</td>
                        </tr>
                      ))}
                    </tbody>

                  </table>
                </div>

              </div>
            )}

            <div className="card p-3 mb-3">

              <div className="row g-3">

                {/* LEFT SIDE */}
                <div className="col-md-6">

                  <div className="mb-2">
                    <label className="form-label">Purchaser</label>
                    <select
                      className="form-control form-control-sm"
                      name="purchaser"
                      value={header.purchaser}
                      onChange={handleHeaderChange}
                    >
                      <option>-No Sales Employee-</option>
                    </select>
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Owner</label>
                    <input
                      className="form-control form-control-sm"
                      name="owner"
                      value={header.owner}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Agent Code</label>
                    <input
                      className="form-control form-control-sm"
                      name="agentCode"
                      value={header.agentCode}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Agent Name</label>
                    <input
                      className="form-control form-control-sm"
                      name="agentName"
                      value={header.agentName}
                      onChange={handleHeaderChange}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Other Instruction</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      name="otherInstruction"
                      value={header.otherInstruction}
                      onChange={handleHeaderChange}
                    />
                  </div>

                </div>

                {/* RIGHT SIDE (TOTALS) */}
                <div className="col-md-6">

                  {/* TAX SUMMARY */}
                  {documentTotals.taxBreakdown.length > 0 && (
                    <div className="mb-3">
                      <h6 className="border-bottom pb-1 mb-2">Tax Summary</h6>

                      {documentTotals.taxBreakdown.map((taxLine) => (
                        <div
                          key={taxLine.taxCode}
                          className="d-flex justify-content-between small"
                        >
                          <span>{taxLine.taxCode} ({taxLine.taxRate}%)</span>
                          <span>
                            {formatDecimalValue(taxLine.taxAmount, numericFieldDecimals.tax)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TOTAL FIELDS */}
                  <div className="mb-2">
                    <label className="form-label">Total Before Discount</label>
                    <input
                      className="form-control form-control-sm text-end"
                      value={formatDecimalValue(
                        documentTotals.subtotal,
                        numericFieldDecimals.total
                      )}
                      readOnly
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Discount (%)</label>
                    <input
                      className="form-control form-control-sm text-end"
                      name="discount"
                      value={header.discount}
                      onChange={handleHeaderChange}
                      onBlur={() => handleNumericFieldBlur("discount", "header")}
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Freight</label>
                    <input
                      className="form-control form-control-sm text-end"
                      name="freight"
                      value={header.freight}
                      onChange={handleHeaderChange}
                      onBlur={() => handleNumericFieldBlur("freight", "header")}
                    />
                  </div>

                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      name="rounding"
                      checked={header.rounding}
                      onChange={handleHeaderChange}
                    />
                    <label className="form-check-label">Rounding</label>
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Tax</label>
                    <input
                      className="form-control form-control-sm text-end"
                      value={formatDecimalValue(
                        documentTotals.taxAmount,
                        numericFieldDecimals.tax
                      )}
                      readOnly
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-bold">Total Payment Due</label>
                    <input
                      className="form-control form-control-sm text-end fw-bold"
                      value={formatDecimalValue(
                        documentTotals.totalPaymentDue,
                        numericFieldDecimals.totalPaymentDue
                      )}
                      readOnly
                    />
                  </div>

                </div>

              </div>

            </div>

            <div className="d-flex justify-content-end gap-2 mt-3">

              <button
                type="submit"
                className="btn btn-success btn-sm"
                disabled={pageState.posting}
              >
                {pageState.posting ? "Posting..." : "Add & View"}
              </button>

              <button type="button" className="btn btn-outline-danger btn-sm">
                Cancel
              </button>

            </div>
          </div>

          {sidebarOpen && (
            <div className="col-md-3">
              <div className="card p-3 h-100">

                {/* HEADER */}
                <div className="mb-3 border-bottom pb-2">
                  <h6 className="mb-1">Header UDFs</h6>
                  <small className="text-muted">
                    Marketing document header user-defined fields
                  </small>
                </div>

                {/* BODY */}
                <div style={{ maxHeight: "70vh", overflowY: "auto" }}>

                  {visibleHeaderUdfs.map((field) => {
                    const setting = formSettings.headerUdfs[field.key];
                    const disabled = setting?.active === false;

                    return (
                      <div key={field.key} className="mb-3">

                        {/* LABEL */}
                        <label className="form-label mb-1">
                          {field.label}
                        </label>

                        {/* SELECT */}
                        {field.type === "select" && (
                          <select
                            className="form-control form-control-sm"
                            value={headerUdfs[field.key]}
                            disabled={disabled}
                            onChange={(e) =>
                              handleHeaderUdfChange(field.key, e.target.value)
                            }
                          >
                            {field.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* TEXTAREA */}
                        {field.type === "textarea" && (
                          <textarea
                            rows={3}
                            className="form-control form-control-sm"
                            value={headerUdfs[field.key]}
                            disabled={disabled}
                            onChange={(e) =>
                              handleHeaderUdfChange(field.key, e.target.value)
                            }
                          />
                        )}

                        {/* INPUT */}
                        {(field.type === "text" || field.type === "date") && (
                          <input
                            type={field.type === "date" ? "date" : "text"}
                            className="form-control form-control-sm"
                            value={headerUdfs[field.key]}
                            disabled={disabled}
                            onChange={(e) =>
                              handleHeaderUdfChange(field.key, e.target.value)
                            }
                          />
                        )}

                      </div>
                    );
                  })}

                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {formSettingsOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "380px",
            height: "100%",
            background: "#fff",
            borderLeft: "1px solid #dee2e6",
            zIndex: 1050,
            overflowY: "auto"
          }}
        >
          {/* HEADER */}
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
            <div>
              <h6 className="mb-1">Form Settings</h6>
              <small className="text-muted">
                Control visibility & activity
              </small>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => setFormSettingsOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* BODY */}
          <div className="p-3">

            {/* MATRIX */}
            <div className="mb-4">
              <h6 className="border-bottom pb-1 mb-2">Matrix Columns</h6>

              {BASE_MATRIX_COLUMNS.map((field) => (
                <div
                  key={field.key}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <span className="small">{field.label}</span>

                  <div className="d-flex gap-2">
                    <div className="form-check form-check-sm">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formSettings.matrixColumns[field.key]?.visible !== false}
                        onChange={(e) =>
                          updateFormSetting(
                            "matrixColumns",
                            field.key,
                            "visible",
                            e.target.checked
                          )
                        }
                      />
                      <label className="form-check-label small">V</label>
                    </div>

                    <div className="form-check form-check-sm">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formSettings.matrixColumns[field.key]?.active !== false}
                        onChange={(e) =>
                          updateFormSetting(
                            "matrixColumns",
                            field.key,
                            "active",
                            e.target.checked
                          )
                        }
                      />
                      <label className="form-check-label small">A</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* HEADER UDF */}
            <div className="mb-4">
              <h6 className="border-bottom pb-1 mb-2">Header UDF Sidebar</h6>

              {HEADER_UDF_DEFINITIONS.map((field) => (
                <div
                  key={field.key}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <span className="small">{field.label}</span>

                  <div className="d-flex gap-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formSettings.headerUdfs[field.key]?.visible !== false}
                        onChange={(e) =>
                          updateFormSetting(
                            "headerUdfs",
                            field.key,
                            "visible",
                            e.target.checked
                          )
                        }
                      />
                      <label className="form-check-label small">V</label>
                    </div>

                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formSettings.headerUdfs[field.key]?.active !== false}
                        onChange={(e) =>
                          updateFormSetting(
                            "headerUdfs",
                            field.key,
                            "active",
                            e.target.checked
                          )
                        }
                      />
                      <label className="form-check-label small">A</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ROW UDF */}
            <div>
              <h6 className="border-bottom pb-1 mb-2">Row UDF Columns</h6>

              {ROW_UDF_DEFINITIONS.map((field) => (
                <div
                  key={field.key}
                  className="d-flex justify-content-between align-items-center mb-2"
                >
                  <span className="small">{field.label}</span>

                  <div className="d-flex gap-2">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formSettings.rowUdfs[field.key]?.visible !== false}
                        onChange={(e) =>
                          updateFormSetting(
                            "rowUdfs",
                            field.key,
                            "visible",
                            e.target.checked
                          )
                        }
                      />
                      <label className="form-check-label small">V</label>
                    </div>

                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={formSettings.rowUdfs[field.key]?.active !== false}
                        onChange={(e) =>
                          updateFormSetting(
                            "rowUdfs",
                            field.key,
                            "active",
                            e.target.checked
                          )
                        }
                      />
                      <label className="form-check-label small">A</label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      <datalist id="po-vendor-list">
        {referenceData.vendors.map((vendor) => (
          <option key={vendor.CardCode} value={vendor.CardCode}>
            {vendor.CardName}
          </option>
        ))}
      </datalist>

      <datalist id="po-item-list">
        {referenceData.items.map((item) => (
          <option key={item.ItemCode} value={item.ItemCode}>
            {item.ItemName}
          </option>
        ))}
      </datalist>

      <datalist id="po-tax-code-list">
        {referenceData.tax_codes.map((taxCode) => (
          <option key={taxCode.Code} value={taxCode.Code}>
            {taxCode.Name}
          </option>
        ))}
      </datalist>

      <datalist id="po-warehouse-list">
        {referenceData.warehouses.map((warehouse) => (
          <option key={warehouse.WhsCode} value={warehouse.WhsCode}>
            {warehouse.WhsName}
          </option>
        ))}
      </datalist>
    </form>
  );
}

export default PurchaseOrderPage;
