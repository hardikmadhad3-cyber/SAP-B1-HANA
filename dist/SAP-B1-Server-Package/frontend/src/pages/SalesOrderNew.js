import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/sales-order.css';
import {
  DEFAULT_HEADER,
  DEFAULT_LINE,
  TABS,
  VALIDATION_RULES,
  DECIMAL_CONFIG,
} from '../config/salesOrderMetadata';
import {
  fetchSalesOrderReferenceData,
  fetchSalesOrderCustomerDetails,
  submitSalesOrder,
  fetchSalesOrderByDocEntry,
  updateSalesOrder,
} from '../api/salesOrderApi';
import { parseNum, roundTo, formatDecimal, sanitizeNumber } from '../utils/numberUtils';
import { findTaxCode, getTaxComponentCodes } from '../utils/taxCodeComponents';
import ContentsTab from '../components/sales-order/ContentsTab';
import LogisticsTab from '../components/sales-order/LogisticsTab';
import AccountingTab from '../components/sales-order/AccountingTab';
import TaxTab from '../components/sales-order/TaxTab';
import AttachmentsTab from '../components/sales-order/AttachmentsTab';
import RightPanel from '../components/sales-order/RightPanel';

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (detail?.error?.message) return detail.error.message;
  if (detail?.message) return detail.message;
  return error?.message || fallback;
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function SalesOrderNew() {
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [lines, setLines] = useState([{ ...DEFAULT_LINE }]);
  const [activeTab, setActiveTab] = useState('contents');
  const [currentDocEntry, setCurrentDocEntry] = useState(null);

  // Reference Data
  const [customers, setCustomers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [salesEmployees, setSalesEmployees] = useState([]);
  const [uomGroups, setUomGroups] = useState([]);
  const [refData, setRefData] = useState({ branches: [] });

  // UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({ header: {}, lines: {} });

  // ─── LOAD REFERENCE DATA ────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    
    const loadReferenceData = async () => {
      setLoading(true);
      setError('');
      
      try {
        const response = await fetchSalesOrderReferenceData();
        
        if (isMounted) {
          const data = response.data;
          setCustomers(data.customers || data.vendors || []);
          setItems(data.items || []);
          setWarehouses(data.warehouses || []);
          setTaxCodes(data.tax_codes || []);
          setSalesEmployees(data.sales_employees || []);
          setUomGroups(data.uom_groups || []);
          setRefData({ branches: data.branches || [] });
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load reference data'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadReferenceData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // ─── LOAD EXISTING ORDER ────────────────────────────────────────────────────
  useEffect(() => {
    const docEntry = location.state?.docEntry;
    if (!docEntry) return;

    let isMounted = true;

    const loadOrder = async () => {
      setLoading(true);
      try {
        const response = await fetchSalesOrderByDocEntry(docEntry);
        const order = response.data.sales_order;

        if (isMounted && order) {
          setCurrentDocEntry(order.doc_entry || docEntry);
          setHeader({ ...DEFAULT_HEADER, ...(order.header || {}) });
          setLines(
            Array.isArray(order.lines) && order.lines.length
              ? order.lines.map(l => ({ ...DEFAULT_LINE, ...l }))
              : [{ ...DEFAULT_LINE }]
          );
          
          if (order.header?.customerCode) {
            loadCustomerDetails(order.header.customerCode);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err, 'Failed to load sales order'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    };

    loadOrder();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, location.state, navigate]);

  // ─── LOAD CUSTOMER DETAILS ──────────────────────────────────────────────────
  const loadCustomerDetails = async (customerCode) => {
    if (!customerCode) {
      setContacts([]);
      return;
    }

    try {
      const response = await fetchSalesOrderCustomerDetails(customerCode);
      setContacts(response.data.contacts || []);
    } catch (err) {
      console.error('Failed to load customer details:', err);
      setContacts([]);
    }
  };

  // ─── CALCULATIONS ───────────────────────────────────────────────────────────
  const calculateLineTotal = useCallback((line) => {
    const qty = parseNum(line.quantity);
    const price = parseNum(line.unitPrice);
    const disc = parseNum(line.discountPercent);
    
    const priceAfterDisc = price * (1 - disc / 100);
    const total = qty * priceAfterDisc;
    
    return {
      priceAfterDiscount: roundTo(priceAfterDisc, DECIMAL_CONFIG.unitPrice),
      totalLC: roundTo(total, DECIMAL_CONFIG.total),
    };
  }, []);

  const calculateTotals = useCallback(() => {
    const subtotal = lines.reduce((sum, line) => {
      const { totalLC } = calculateLineTotal(line);
      return sum + totalLC;
    }, 0);

    const discountPercent = parseNum(header.discount);
    const discountAmount = roundTo(subtotal * discountPercent / 100, DECIMAL_CONFIG.total);
    const afterDiscount = subtotal - discountAmount;
    
    const freight = parseNum(header.freight);
    
    // Calculate tax
    let taxAmount = 0;
    const taxBreakdown = new Map();
    
    lines.forEach(line => {
      const { totalLC } = calculateLineTotal(line);
      if (totalLC <= 0 || !line.taxCode) return;
      
      const taxCode = taxCodes.find(t => t.Code === line.taxCode);
      const taxRate = taxCode ? parseNum(taxCode.Rate) : 0;
      
      const lineTaxableAmount = afterDiscount > 0 ? (totalLC / subtotal) * afterDiscount : 0;
      const lineTaxAmount = roundTo(lineTaxableAmount * taxRate / 100, DECIMAL_CONFIG.tax);
      
      taxAmount += lineTaxAmount;
      
      if (!taxBreakdown.has(line.taxCode)) {
        taxBreakdown.set(line.taxCode, {
          taxCode: line.taxCode,
          taxRate,
          taxableAmount: 0,
          taxAmount: 0,
        });
      }
      
      const existing = taxBreakdown.get(line.taxCode);
      existing.taxableAmount = roundTo(existing.taxableAmount + lineTaxableAmount, DECIMAL_CONFIG.total);
      existing.taxAmount = roundTo(existing.taxAmount + lineTaxAmount, DECIMAL_CONFIG.tax);
    });

    taxAmount = roundTo(taxAmount, DECIMAL_CONFIG.tax);
    const total = roundTo(afterDiscount + freight + taxAmount, DECIMAL_CONFIG.documentTotal);

    return {
      subtotal: roundTo(subtotal, DECIMAL_CONFIG.total),
      discountAmount: roundTo(discountAmount, DECIMAL_CONFIG.total),
      afterDiscount: roundTo(afterDiscount, DECIMAL_CONFIG.total),
      freight: roundTo(freight, DECIMAL_CONFIG.total),
      taxAmount,
      total,
      taxBreakdown: Array.from(taxBreakdown.values()),
    };
  }, [lines, header.discount, header.freight, taxCodes, calculateLineTotal]);

  const totals = calculateTotals();

  // ─── HANDLERS ───────────────────────────────────────────────────────────────
  const handleHeaderChange = (field, value) => {
    setError('');
    setSuccess('');
    setValidationErrors(prev => ({
      ...prev,
      header: { ...prev.header, [field]: '' },
    }));

    if (field === 'customerCode') {
      const customer = customers.find(c => c.CardCode === value);
      setHeader(prev => ({
        ...prev,
        customerCode: value,
        customerName: customer ? customer.CardName : '',
        contactPerson: '',
      }));
      loadCustomerDetails(value);
      
      // Auto-fill tax code for all lines
      if (customer && customer.VatGroup) {
        setLines(prev => prev.map(line => ({
          ...line,
          taxCode: line.taxCode || customer.VatGroup,
        })));
      }
      return;
    }

    setHeader(prev => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index, field, value) => {
    setError('');
    setSuccess('');
    setValidationErrors(prev => ({
      ...prev,
      lines: {
        ...prev.lines,
        [index]: { ...(prev.lines[index] || {}), [field]: '' },
      },
    }));

    setLines(prev => prev.map((line, i) => {
      if (i !== index) return line;

      const updated = { ...line, [field]: value };

      // Auto-fill item details
      if (field === 'itemNo') {
        const item = items.find(it => it.ItemCode === value);
        if (item) {
          updated.itemDescription = item.ItemName || '';
          updated.uomCode = item.SalesUnit || item.InventoryUOM || '';
          updated.hsn = item.SWW || '';
          
          // Auto-fill tax code if not set
          if (!updated.taxCode) {
            const customer = customers.find(c => c.CardCode === header.customerCode);
            if (customer && customer.VatGroup) {
              updated.taxCode = customer.VatGroup;
            }
          }
        }
      }

      // Recalculate totals
      const calculated = calculateLineTotal(updated);
      updated.priceAfterDiscount = formatDecimal(calculated.priceAfterDiscount, DECIMAL_CONFIG.unitPrice);
      updated.totalLC = formatDecimal(calculated.totalLC, DECIMAL_CONFIG.total);

      return updated;
    }));
  };

  const handleAddLine = () => {
    setLines(prev => [...prev, { ...DEFAULT_LINE }]);
  };

  const handleRemoveLine = (index) => {
    if (lines.length === 1) {
      setError('At least one line is required');
      return;
    }
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  // ─── VALIDATION ─────────────────────────────────────────────────────────────
  const validate = () => {
    const errors = { header: {}, lines: {} };
    let hasError = false;

    // Validate header
    Object.entries(VALIDATION_RULES.header).forEach(([field, rule]) => {
      if (rule.required && !header[field]) {
        errors.header[field] = rule.message;
        hasError = true;
      }
    });

    // Validate lines
    const populatedLines = lines.filter(line => line.itemNo);
    
    if (populatedLines.length === 0) {
      setError(VALIDATION_RULES.document.message);
      return false;
    }

    populatedLines.forEach((line, index) => {
      const lineErrors = {};
      
      Object.entries(VALIDATION_RULES.lines).forEach(([field, rule]) => {
        if (rule.required && !line[field]) {
          lineErrors[field] = rule.message;
          hasError = true;
        }
        
        if (rule.min !== undefined && parseNum(line[field]) < rule.min) {
          lineErrors[field] = rule.message;
          hasError = true;
        }
      });

      if (Object.keys(lineErrors).length > 0) {
        errors.lines[index] = lineErrors;
      }
    });

    // SGST/CGST Validation
    if (VALIDATION_RULES.tax.sgstCgstPair) {
      const taxCodesUsed = new Set(populatedLines.map(l => l.taxCode).filter(Boolean));
      const sgstCodes = getTaxComponentCodes(taxCodesUsed, taxCodes, 'SGST');
      const cgstCodes = getTaxComponentCodes(taxCodesUsed, taxCodes, 'CGST');

      // If SGST is used, CGST must also be used
      if (sgstCodes.length > 0 && cgstCodes.length === 0) {
        setError('SGST requires CGST to be applied as well');
        hasError = true;
      }

      // If CGST is used, SGST must also be used
      if (cgstCodes.length > 0 && sgstCodes.length === 0) {
        setError('CGST requires SGST to be applied as well');
        hasError = true;
      }

      // Validate SGST and CGST rates are equal
      if (sgstCodes.length > 0 && cgstCodes.length > 0) {
        const sgstRates = sgstCodes.map(code => {
          const tax = findTaxCode(taxCodes, code);
          return tax ? parseNum(tax.Rate) : 0;
        });
        const cgstRates = cgstCodes.map(code => {
          const tax = findTaxCode(taxCodes, code);
          return tax ? parseNum(tax.Rate) : 0;
        });

        // Check if rates match
        const sgstRate = sgstRates[0];
        const cgstRate = cgstRates[0];
        
        if (sgstRate !== cgstRate) {
          setError('SGST and CGST rates must be equal');
          hasError = true;
        }
      }
    }

    setValidationErrors(errors);
    
    if (hasError) {
      if (!error) setError('Please correct the highlighted fields');
      return false;
    }

    return true;
  };

  // ─── SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        header: {
          ...header,
          deliveryDate: header.deliveryDate || header.postingDate,
        },
        lines: lines.filter(line => line.itemNo),
      };

      const response = currentDocEntry
        ? await updateSalesOrder(currentDocEntry, payload)
        : await submitSalesOrder(payload);

      const docNum = response.data.doc_num || response.data.DocNum;
      setSuccess(
        currentDocEntry
          ? `Sales Order updated successfully${docNum ? ` - Doc No: ${docNum}` : ''}`
          : `Sales Order created successfully${docNum ? ` - Doc No: ${docNum}` : ''}`
      );

      // Reset form after successful creation
      if (!currentDocEntry) {
        setHeader(DEFAULT_HEADER);
        setLines([{ ...DEFAULT_LINE }]);
        setCurrentDocEntry(null);
        setContacts([]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save sales order'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setHeader(DEFAULT_HEADER);
    setLines([{ ...DEFAULT_LINE }]);
    setCurrentDocEntry(null);
    setContacts([]);
    setError('');
    setSuccess('');
    setValidationErrors({ header: {}, lines: {} });
  };

  // ─── GET UOM OPTIONS ────────────────────────────────────────────────────────
  const getUomOptions = (line) => {
    const item = items.find(it => it.ItemCode === line.itemNo);
    if (!item) return [];

    const uomGroup = uomGroups.find(g => g.AbsEntry === item.UoMGroupEntry);
    if (uomGroup && uomGroup.uomCodes) {
      return uomGroup.uomCodes;
    }

    const defaultUom = item.SalesUnit || item.InventoryUOM;
    return defaultUom ? [defaultUom] : [];
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="sales-order-page">
      {/* Toolbar */}
      <div className="so-toolbar">
        <div className="so-toolbar-left">
          <button type="button" className="so-btn so-btn-icon" title="Data">
            <span>📊</span>
          </button>
          <button type="button" className="so-btn so-btn-icon" title="First">
            <span>⏮</span>
          </button>
          <button type="button" className="so-btn so-btn-icon" title="Previous">
            <span>◀</span>
          </button>
          <button type="button" className="so-btn so-btn-icon" title="Next">
            <span>▶</span>
          </button>
          <button type="button" className="so-btn so-btn-icon" title="Last">
            <span>⏭</span>
          </button>
        </div>
        <div className="so-toolbar-right">
          <button type="button" className="so-btn" onClick={() => navigate('/sales-order/list')}>
            Find
          </button>
          <button type="button" className="so-btn" onClick={handleReset}>
            New
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="so-title-bar">
        <h1 className="so-title">Sales Order</h1>
        {currentDocEntry && (
          <span className="so-doc-number">#{header.docNum || currentDocEntry}</span>
        )}
      </div>

      {/* Alerts */}
      {loading && <div className="so-alert so-alert-info">Loading...</div>}
      {error && <div className="so-alert so-alert-error">{error}</div>}
      {success && <div className="so-alert so-alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="so-form">
        <div className="so-layout">
          {/* Left Panel - Main Content */}
          <div className="so-main-panel">
            {/* Header Section */}
            <div className="so-header-section">
              <div className="so-header-left">
                {/* Buyer's Code */}
                <div className="so-form-group">
                  <label className="so-label">Buyer's Code</label>
                  <div className="so-input-with-icon">
                    <select
                      className={`so-input ${validationErrors.header.customerCode ? 'so-input-error' : ''}`}
                      value={header.customerCode}
                      onChange={(e) => handleHeaderChange('customerCode', e.target.value)}
                    >
                      <option value="">Select</option>
                      {customers.map(c => (
                        <option key={c.CardCode} value={c.CardCode}>
                          {c.CardCode}
                        </option>
                      ))}
                    </select>
                    <span className="so-dropdown-icon">▼</span>
                  </div>
                  {validationErrors.header.customerCode && (
                    <span className="so-error-text">{validationErrors.header.customerCode}</span>
                  )}
                </div>

                {/* Buyer's Name */}
                <div className="so-form-group">
                  <label className="so-label">Buyer's Name</label>
                  <input
                    type="text"
                    className="so-input so-input-readonly"
                    value={header.customerName}
                    readOnly
                  />
                </div>

                {/* Contact Person */}
                <div className="so-form-group">
                  <label className="so-label">Contact Person</label>
                  <div className="so-input-with-icon">
                    <select
                      className="so-input"
                      value={header.contactPerson}
                      onChange={(e) => handleHeaderChange('contactPerson', e.target.value)}
                      disabled={!header.customerCode}
                    >
                      <option value="">Select</option>
                      {contacts.map(c => (
                        <option key={c.CntctCode} value={c.CntctCode}>
                          {c.Name}
                        </option>
                      ))}
                    </select>
                    <span className="so-dropdown-icon">▼</span>
                  </div>
                </div>

                {/* Customer Ref. No. */}
                <div className="so-form-group">
                  <label className="so-label">Customer Ref. No.</label>
                  <input
                    type="text"
                    className="so-input"
                    value={header.customerRefNo}
                    onChange={(e) => handleHeaderChange('customerRefNo', e.target.value)}
                  />
                </div>

                {/* BP Currency */}
                <div className="so-form-group">
                  <label className="so-label">BP Currency</label>
                  <div className="so-input-with-icon">
                    <select
                      className="so-input"
                      value={header.currency || 'INR'}
                      onChange={(e) => handleHeaderChange('currency', e.target.value)}
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                    <span className="so-dropdown-icon">▼</span>
                  </div>
                </div>

                {/* Place of Supply */}
                <div className="so-form-group">
                  <label className="so-label">Place of Supply</label>
                  <input
                    type="text"
                    className="so-input"
                    value={header.placeOfSupply}
                    onChange={(e) => handleHeaderChange('placeOfSupply', e.target.value)}
                  />
                </div>

                {/* Branch */}
                <div className="so-form-group">
                  <label className="so-label">Branch</label>
                  <div className="so-input-with-icon">
                    <select
                      className="so-input"
                      value={header.branch}
                      onChange={(e) => handleHeaderChange('branch', e.target.value)}
                    >
                      <option value="">Select</option>
                      {refData.branches.map(b => (
                        <option key={b.BPLId} value={b.BPLId}>
                          {b.BPLName}
                        </option>
                      ))}
                    </select>
                    <span className="so-dropdown-icon">▼</span>
                  </div>
                </div>
              </div>

              <div className="so-header-right">
                {/* No. with Auto Number */}
                <div className="so-form-row">
                  <div className="so-form-group so-form-group-flex">
                    <label className="so-label">No.</label>
                    <div className="so-number-group">
                      <input
                        type="text"
                        className="so-input so-input-readonly so-input-number"
                        value={header.docNum || '2025-26'}
                        readOnly
                      />
                      <div className="so-input-with-icon so-input-auto">
                        <select className="so-input so-input-sm">
                          <option>35</option>
                        </select>
                        <span className="so-dropdown-icon-sm">▼</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="so-form-group">
                  <label className="so-label">Status</label>
                  <input
                    type="text"
                    className="so-input so-input-readonly"
                    value={header.status}
                    readOnly
                    style={{ color: header.status === 'Open' ? '#008000' : '#000' }}
                  />
                </div>

                {/* Posting Date */}
                <div className="so-form-group">
                  <label className="so-label">Posting Date</label>
                  <input
                    type="date"
                    className={`so-input ${validationErrors.header.postingDate ? 'so-input-error' : ''}`}
                    value={header.postingDate}
                    onChange={(e) => handleHeaderChange('postingDate', e.target.value)}
                  />
                  {validationErrors.header.postingDate && (
                    <span className="so-error-text">{validationErrors.header.postingDate}</span>
                  )}
                </div>

                {/* Delivery Date */}
                <div className="so-form-group">
                  <label className="so-label">Delivery Date</label>
                  <input
                    type="date"
                    className="so-input"
                    value={header.deliveryDate}
                    onChange={(e) => handleHeaderChange('deliveryDate', e.target.value)}
                  />
                </div>

                {/* Document Date */}
                <div className="so-form-group">
                  <label className="so-label">Document Date</label>
                  <input
                    type="date"
                    className={`so-input ${validationErrors.header.documentDate ? 'so-input-error' : ''}`}
                    value={header.documentDate}
                    onChange={(e) => handleHeaderChange('documentDate', e.target.value)}
                  />
                  {validationErrors.header.documentDate && (
                    <span className="so-error-text">{validationErrors.header.documentDate}</span>
                  )}
                </div>

                {/* Branch Reg. No. */}
                <div className="so-form-group">
                  <label className="so-label">Branch Reg. No.</label>
                  <input
                    type="text"
                    className="so-input"
                    value={header.branchRegNo}
                    onChange={(e) => handleHeaderChange('branchRegNo', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="so-tabs">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`so-tab ${activeTab === tab.key ? 'so-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="so-tab-content">
              {activeTab === 'contents' && (
                <ContentsTab
                  lines={lines}
                  items={items}
                  warehouses={warehouses}
                  taxCodes={taxCodes}
                  validationErrors={validationErrors.lines}
                  onLineChange={handleLineChange}
                  onAddLine={handleAddLine}
                  onRemoveLine={handleRemoveLine}
                  getUomOptions={getUomOptions}
                />
              )}

              {activeTab === 'logistics' && (
                <LogisticsTab
                  lines={lines}
                  onLineChange={handleLineChange}
                />
              )}

              {activeTab === 'accounting' && (
                <AccountingTab
                  lines={lines}
                  taxCodes={taxCodes}
                  onLineChange={handleLineChange}
                />
              )}

              {activeTab === 'tax' && (
                <TaxTab
                  lines={lines}
                  taxCodes={taxCodes}
                  totals={totals}
                />
              )}

              {activeTab === 'attachments' && (
                <AttachmentsTab />
              )}
            </div>

            {/* Totals Footer */}
            <div className="so-totals-section">
              <div className="so-totals-left">
                <div className="so-form-group">
                  <label className="so-label">Remarks</label>
                  <textarea
                    className="so-textarea"
                    rows={3}
                    value={header.remarks}
                    onChange={(e) => handleHeaderChange('remarks', e.target.value)}
                  />
                </div>
              </div>

              <div className="so-totals-right">
                {totals.taxBreakdown.length > 0 && (
                  <div className="so-tax-summary">
                    <div className="so-tax-summary-title">Tax Summary</div>
                    {totals.taxBreakdown.map(tax => (
                      <div key={tax.taxCode} className="so-tax-summary-row">
                        <span>{tax.taxCode} ({tax.taxRate}%)</span>
                        <span>{formatDecimal(tax.taxAmount, DECIMAL_CONFIG.tax)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="so-totals-table">
                  <div className="so-totals-row">
                    <span>Total Before Discount</span>
                    <input
                      type="text"
                      className="so-input so-input-readonly so-input-right"
                      value={formatDecimal(totals.subtotal, DECIMAL_CONFIG.total)}
                      readOnly
                    />
                  </div>
                  <div className="so-totals-row">
                    <span>Discount (%)</span>
                    <input
                      type="text"
                      className="so-input so-input-right"
                      value={header.discount}
                      onChange={(e) => handleHeaderChange('discount', sanitizeNumber(e.target.value, DECIMAL_CONFIG.discount))}
                      onBlur={(e) => handleHeaderChange('discount', formatDecimal(e.target.value, DECIMAL_CONFIG.discount))}
                    />
                  </div>
                  <div className="so-totals-row">
                    <span>Freight</span>
                    <input
                      type="text"
                      className="so-input so-input-right"
                      value={header.freight}
                      onChange={(e) => handleHeaderChange('freight', sanitizeNumber(e.target.value, DECIMAL_CONFIG.total))}
                      onBlur={(e) => handleHeaderChange('freight', formatDecimal(e.target.value, DECIMAL_CONFIG.total))}
                    />
                  </div>
                  <div className="so-totals-row">
                    <span>
                      <label>
                        <input
                          type="checkbox"
                          checked={header.rounding}
                          onChange={(e) => handleHeaderChange('rounding', e.target.checked)}
                        />
                        {' '}Rounding
                      </label>
                    </span>
                    <span></span>
                  </div>
                  <div className="so-totals-row">
                    <span>Tax</span>
                    <input
                      type="text"
                      className="so-input so-input-readonly so-input-right"
                      value={formatDecimal(totals.taxAmount, DECIMAL_CONFIG.tax)}
                      readOnly
                    />
                  </div>
                  <div className="so-totals-row so-totals-row-total">
                    <span>Total</span>
                    <input
                      type="text"
                      className="so-input so-input-readonly so-input-right so-input-total"
                      value={formatDecimal(totals.total, DECIMAL_CONFIG.documentTotal)}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="so-actions">
              <button
                type="submit"
                className="so-btn so-btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : currentDocEntry ? 'Update' : 'Add'}
              </button>
              <button
                type="button"
                className="so-btn so-btn-secondary"
                onClick={handleReset}
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Right Panel - Additional Fields */}
          <RightPanel header={header} onHeaderChange={handleHeaderChange} />
        </div>
      </form>
    </div>
  );
}


export default SalesOrderNew;
