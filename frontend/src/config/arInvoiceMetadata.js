/**
 * SAP Business One AR Invoice - Field Metadata
 * Defines all fields, tabs, and configurations for the AR Invoice screen
 */

// ─── DECIMAL PRECISION ────────────────────────────────────────────────────────
export const DECIMAL_CONFIG = {
  quantity: 2,
  unitPrice: 2,
  discount: 2,
  total: 2,
  tax: 2,
  documentTotal: 2,
};

// ─── HEADER FIELDS ────────────────────────────────────────────────────────────
export const HEADER_FIELDS = {
  // Customer Section
  customerCode: { label: 'Customer Code', required: true, type: 'select', section: 'customer' },
  customerName: { label: 'Customer Name', required: true, type: 'text', section: 'customer' },
  contactPerson: { label: 'Contact Person', required: false, type: 'select', section: 'customer' },
  customerRefNo: { label: 'Customer Ref. No.', required: false, type: 'text', section: 'customer' },

  // Document Section
  docNum: { label: 'No.', required: false, type: 'text', readOnly: true, section: 'document' },
  status: { label: 'Status', required: false, type: 'text', readOnly: true, section: 'document' },
  postingDate: { label: 'Posting Date', required: true, type: 'date', section: 'document' },
  dueDate: { label: 'Due Date', required: false, type: 'date', section: 'document' },
  documentDate: { label: 'Document Date', required: true, type: 'date', section: 'document' },

  // Additional Fields
  salesEmployee: { label: 'Sales Employee', required: false, type: 'select', section: 'document' },
  owner: { label: 'Owner', required: false, type: 'text', section: 'document' },

  // Payment Terms
  paymentGroupCode: { label: 'Payment Terms', required: false, type: 'select', section: 'document' },

  // Address Fields
  billToAddress: { label: 'Bill To', required: false, type: 'textarea', section: 'address' },
  shipToAddress: { label: 'Ship To', required: false, type: 'textarea', section: 'address' },

  // Comments
  comments: { label: 'Remarks', required: false, type: 'textarea', section: 'comments' },

  // Base Document
  baseDocument: { label: 'Copy From', required: false, type: 'select', section: 'baseDocument' },
};

// ─── CONTENTS TAB - MATRIX COLUMNS ────────────────────────────────────────────
export const MATRIX_COLUMNS = [
  {
    key: 'itemServiceType',
    label: 'Item/Service Type',
    width: 120,
    type: 'select',
    required: true,
    options: ['Item', 'Service']
  },
  {
    key: 'itemNo',
    label: 'Item No.',
    width: 140,
    type: 'select',
    required: true,
    searchable: true
  },
  {
    key: 'itemDescription',
    label: 'Item Description',
    width: 200,
    type: 'text',
    required: false
  },
  {
    key: 'quantity',
    label: 'Quantity',
    width: 90,
    type: 'number',
    required: true,
    align: 'right',
    decimals: 2
  },
  {
    key: 'unitPrice',
    label: 'Unit Price',
    width: 100,
    type: 'number',
    required: true,
    align: 'right',
    decimals: 2
  },
  {
    key: 'discountPercent',
    label: 'Discount %',
    width: 90,
    type: 'number',
    required: false,
    align: 'right',
    decimals: 2
  },
  {
    key: 'priceAfterDiscount',
    label: 'Price after Discount',
    width: 120,
    type: 'number',
    required: false,
    align: 'right',
    decimals: 2,
    calculated: true
  },
  {
    key: 'taxCode',
    label: 'Tax Code',
    width: 120,
    type: 'select',
    required: true
  },
  {
    key: 'totalLC',
    label: 'Total (LC)',
    width: 110,
    type: 'number',
    required: false,
    align: 'right',
    decimals: 2,
    calculated: true,
    readOnly: true
  },
  {
    key: 'warehouse',
    label: 'Whse',
    width: 100,
    type: 'select',
    required: true
  },
  {
    key: 'baseType',
    label: 'Base Type',
    width: 100,
    type: 'text',
    required: false,
    readOnly: true
  },
  {
    key: 'baseEntry',
    label: 'Base Entry',
    width: 100,
    type: 'text',
    required: false,
    readOnly: true
  },
  {
    key: 'baseLine',
    label: 'Base Line',
    width: 100,
    type: 'number',
    required: false,
    readOnly: true
  },
];

// ─── LOGISTICS TAB - MATRIX COLUMNS ───────────────────────────────────────────
export const LOGISTICS_COLUMNS = [
  { key: 'itemServiceType', label: 'Item/Service Type', width: 120, type: 'text', readOnly: true },
  { key: 'itemNo', label: 'Item No.', width: 140, type: 'text', readOnly: true },
  { key: 'freeText', label: 'Free Text', width: 120, type: 'text' },
  { key: 'uomCode', label: 'UoM Code', width: 100, type: 'select' },
  { key: 'cogsOcrCode', label: 'COGS Ocrcode', width: 120, type: 'select' },
  { key: 'distRule', label: 'Distr. Rule', width: 100, type: 'select' },
  { key: 'branch', label: 'Branch', width: 100, type: 'select' },
  { key: 'hsn', label: 'HSN', width: 100, type: 'text' },
  { key: 'sac', label: 'SAC', width: 100, type: 'text' },
];

// ─── ACCOUNTING TAB - MATRIX COLUMNS ──────────────────────────────────────────
export const ACCOUNTING_COLUMNS = [
  { key: 'itemServiceType', label: 'Item/Service Type', width: 120, type: 'text', readOnly: true },
  { key: 'itemNo', label: 'Item No.', width: 140, type: 'text', readOnly: true },
  { key: 'glAccount', label: 'G/L Account', width: 140, type: 'select' },
  { key: 'taxCode', label: 'Tax Code', width: 120, type: 'select' },
  { key: 'taxOnly', label: 'Tax Only', width: 80, type: 'checkbox' },
  { key: 'wTLiable', label: 'W/T Liable', width: 90, type: 'checkbox' },
  { key: 'deferredTax', label: 'Deferred Tax', width: 100, type: 'checkbox' },
  { key: 'cogsOcrCode', label: 'COGS Ocrcode', width: 120, type: 'select' },
  { key: 'cogsAccountCode', label: 'COGS Account Code', width: 140, type: 'select' },
];

// ─── TAX TAB - MATRIX COLUMNS ─────────────────────────────────────────────────
export const TAX_COLUMNS = [
  { key: 'itemServiceType', label: 'Item/Service Type', width: 120, type: 'text', readOnly: true },
  { key: 'itemNo', label: 'Item No.', width: 140, type: 'text', readOnly: true },
  { key: 'taxCode', label: 'Tax Code', width: 120, type: 'select' },
  { key: 'taxRate', label: 'Tax Rate', width: 90, type: 'number', align: 'right', readOnly: true },
  { key: 'taxableAmount', label: 'Taxable Amount', width: 120, type: 'number', align: 'right', readOnly: true },
  { key: 'taxAmount', label: 'Tax Amount', width: 110, type: 'number', align: 'right', readOnly: true },
  { key: 'totalAmount', label: 'Total Amount', width: 120, type: 'number', align: 'right', readOnly: true },
];

// ─── ATTACHMENTS TAB ──────────────────────────────────────────────────────────
export const ATTACHMENT_FIELDS = [
  { key: 'targetPath', label: 'Target Path', width: 200, type: 'text' },
  { key: 'fileName', label: 'File Name', width: 180, type: 'text' },
  { key: 'attachmentDate', label: 'Attachment Date', width: 120, type: 'date' },
  { key: 'freeText', label: 'Free Text', width: 150, type: 'text' },
  { key: 'copyToTarget', label: 'Copy to Target Document', width: 150, type: 'checkbox' },
];

// ─── TAB DEFINITIONS ──────────────────────────────────────────────────────────
export const TABS = [
  { key: 'contents', label: 'Contents', icon: null },
  { key: 'logistics', label: 'Logistics', icon: null },
  { key: 'accounting', label: 'Accounting', icon: null },
  { key: 'tax', label: 'Tax', icon: null },
  { key: 'attachments', label: 'Attachments', icon: null },
];

// ─── TOTALS SECTION ───────────────────────────────────────────────────────────
export const TOTALS_FIELDS = {
  totalBeforeDiscount: { label: 'Total Before Discount', readOnly: true, decimals: 2 },
  discount: { label: 'Discount', editable: true, decimals: 2, type: 'percent' },
  freight: { label: 'Freight', editable: true, decimals: 2 },
  rounding: { label: 'Rounding', editable: true, type: 'checkbox' },
  tax: { label: 'Tax', readOnly: true, decimals: 2 },
  total: { label: 'Total', readOnly: true, decimals: 2, highlight: true },
};

// ─── VALIDATION RULES ─────────────────────────────────────────────────────────
export const VALIDATION_RULES = {
  header: {
    customerCode: { required: true, message: 'Customer is required' },
    postingDate: { required: true, message: 'Posting date is required' },
    documentDate: { required: true, message: 'Document date is required' },
  },
  lines: {
    itemNo: { required: true, message: 'Item is required' },
    quantity: { required: true, min: 0.01, message: 'Quantity must be greater than 0' },
    unitPrice: { required: true, min: 0, message: 'Unit price is required' },
    taxCode: { required: true, message: 'Tax code is required' },
    warehouse: { required: true, message: 'Warehouse is required' },
  },
  document: {
    minLines: 1,
    message: 'At least one item line is required',
  },
  tax: {
    // SGST + CGST validation: If one is used, both must be used with same rate
    sgstCgstPair: true,
    message: 'SGST and CGST must be used together with equal rates',
  },
};

// ─── DEFAULT VALUES ───────────────────────────────────────────────────────────
export const DEFAULT_HEADER = {
  customerCode: '',
  customerName: '',
  contactPerson: '',
  customerRefNo: '',
  currency: 'INR',
  docNum: '',
  status: 'Open',
  postingDate: new Date().toISOString().split('T')[0],
  dueDate: '',
  documentDate: new Date().toISOString().split('T')[0],
  salesEmployee: '',
  owner: '',
  paymentGroupCode: '',
  billToAddress: '',
  shipToAddress: '',
  comments: '',
  baseDocument: '',
  // Totals
  discount: '0',
  freight: '0',
  rounding: false,
  remarks: '',
};

export const DEFAULT_LINE = {
  itemServiceType: 'Item',
  itemNo: '',
  itemDescription: '',
  quantity: '',
  unitPrice: '',
  discountPercent: '0',
  priceAfterDiscount: '',
  taxCode: '',
  totalLC: '',
  warehouse: '',
  baseType: '',
  baseEntry: '',
  baseLine: '',
  // Logistics
  freeText: '',
  uomCode: '',
  cogsOcrCode: '',
  distRule: '',
  branch: '',
  hsn: '',
  sac: '',
  // Accounting
  glAccount: '',
  taxOnly: false,
  wTLiable: false,
  deferredTax: false,
  cogsAccountCode: '',
};

// ─── BASE DOCUMENT TYPES ──────────────────────────────────────────────────────
export const BASE_DOCUMENT_TYPES = [
  { value: '', label: 'None' },
  { value: '17', label: 'Sales Order' },
  { value: '15', label: 'Delivery' },
];

// ─── MODULE CONFIGURATION ─────────────────────────────────────────────────────
export const MODULE_CONFIG = {
  module: "AR_INVOICE",
  serviceLayerEntity: "Invoices",
  baseDocument: {
    supported: true,
    types: ["SalesOrder", "Delivery"]
  }
};