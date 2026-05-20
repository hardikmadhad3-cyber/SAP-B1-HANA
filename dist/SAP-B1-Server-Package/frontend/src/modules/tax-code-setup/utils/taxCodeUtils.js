/**
 * Tax Code Utilities
 * Helper functions for tax code calculations and data manipulation
 */

/**
 * Calculate total tax rate from components
 * @param {Array} lines - Tax component lines
 * @returns {number} - Total tax rate
 */
export const calculateTotalTaxRate = (lines) => {
  if (!lines || lines.length === 0) return 0;

  return lines.reduce((total, line) => {
    // In real implementation, each line would have its own rate
    // For now, we'll use a placeholder calculation
    return total;
  }, 0);
};

/**
 * Calculate deductible and non-deductible amounts
 * @param {number} taxAmount - Total tax amount
 * @param {number} nonDeductiblePercent - Non-deductible percentage
 * @returns {Object} - { deductible, nonDeductible }
 */
export const calculateDeductibleAmounts = (taxAmount, nonDeductiblePercent) => {
  const nonDeductible = (taxAmount * nonDeductiblePercent) / 100;
  const deductible = taxAmount - nonDeductible;
  
  return {
    deductible: parseFloat(deductible.toFixed(2)),
    nonDeductible: parseFloat(nonDeductible.toFixed(2)),
  };
};

/**
 * Format tax rate for display
 * @param {number} rate - Tax rate
 * @returns {string} - Formatted rate
 */
export const formatTaxRate = (rate) => {
  if (rate == null || rate === "") return "0.00";
  return parseFloat(rate).toFixed(2);
};

/**
 * Check if tax code is composite (has multiple components)
 * @param {Array} lines - Tax component lines
 * @returns {boolean}
 */
export const isCompositeTaxCode = (lines) => {
  if (!lines || lines.length === 0) return false;
  
  const validLines = lines.filter(line => 
    line.TaxType || line.Code || line.Description
  );
  
  return validLines.length > 1;
};

/**
 * Get tax type label from value
 * @param {string} value - Tax type value
 * @returns {string} - Tax type label
 */
export const getTaxTypeLabel = (value) => {
  const taxTypes = {
    "sys_SGST": "State GST",
    "sys_CGST": "Central GST",
    "sys_IGST": "Integrated GST",
    "sys_CESS": "Cess",
    "sys_VAT": "VAT",
    "sys_CST": "CST",
    "sys_Service": "Service Tax",
    "sys_Excise": "Excise Duty",
    "sys_Custom": "Custom Duty",
  };
  
  return taxTypes[value] || value;
};

/**
 * Get tax combination label from value
 * @param {string} value - Tax combination value
 * @returns {string} - Tax combination label
 */
export const getTaxCombinationLabel = (value) => {
  const combinations = {
    "GST": "Goods and Services Tax",
    "CST": "Central Sales Tax",
    "CSTCS": "CST with Cess",
    "IGST": "Integrated GST",
    "ITCS": "Input Tax Credit Scheme",
    "Service": "Service Tax",
    "VAT": "Value Added Tax",
    "CENVAT+VAT": "Central VAT + VAT",
    "DefineNew": "Custom Tax Type",
  };
  
  return combinations[value] || value;
};

/**
 * Validate tax code uniqueness
 * @param {string} code - Tax code to validate
 * @param {Array} existingCodes - Array of existing tax codes
 * @returns {boolean}
 */
export const isTaxCodeUnique = (code, existingCodes) => {
  if (!code || !existingCodes) return true;
  
  return !existingCodes.some(
    existing => existing.Code.toLowerCase() === code.toLowerCase()
  );
};

/**
 * Filter empty tax component lines
 * @param {Array} lines - Tax component lines
 * @returns {Array} - Filtered lines
 */
export const filterEmptyLines = (lines) => {
  if (!lines || lines.length === 0) return [];
  
  return lines.filter(line => 
    line.TaxType || 
    line.Code || 
    line.Description || 
    line.SalesTaxAccount || 
    line.PurchasingTaxAccount || 
    line.NonDeductible || 
    line.NonDeductibleAccount
  );
};

/**
 * Create empty tax component line
 * @returns {Object} - Empty line object
 */
export const createEmptyLine = () => ({
  TaxType: "",
  Code: "",
  Description: "",
  SalesTaxAccount: "",
  SalesTaxAccountName: "",
  PurchasingTaxAccount: "",
  PurchasingTaxAccountName: "",
  NonDeductible: "0.00",
  NonDeductibleAccount: "",
  NonDeductibleAccountName: "",
});

/**
 * Clone tax code for duplication
 * @param {Object} taxCode - Tax code to clone
 * @param {string} newCode - New code for cloned tax code
 * @returns {Object} - Cloned tax code
 */
export const cloneTaxCode = (taxCode, newCode) => {
  return {
    ...taxCode,
    Code: newCode,
    Name: `${taxCode.Name} (Copy)`,
    VatGroups_Lines: taxCode.VatGroups_Lines ? 
      taxCode.VatGroups_Lines.map(line => ({ ...line })) : [],
  };
};

/**
 * Export tax code to JSON
 * @param {Object} taxCode - Tax code to export
 * @returns {string} - JSON string
 */
export const exportTaxCodeToJSON = (taxCode) => {
  return JSON.stringify(taxCode, null, 2);
};

/**
 * Import tax code from JSON
 * @param {string} jsonString - JSON string
 * @returns {Object} - Parsed tax code
 */
export const importTaxCodeFromJSON = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error("Invalid JSON format");
  }
};

/**
 * Calculate tax amount based on base amount and tax rate
 * @param {number} baseAmount - Base amount
 * @param {number} taxRate - Tax rate percentage
 * @returns {number} - Tax amount
 */
export const calculateTaxAmount = (baseAmount, taxRate) => {
  if (!baseAmount || !taxRate) return 0;
  
  const amount = (baseAmount * taxRate) / 100;
  return parseFloat(amount.toFixed(2));
};

/**
 * Calculate base amount from gross amount and tax rate
 * @param {number} grossAmount - Gross amount (including tax)
 * @param {number} taxRate - Tax rate percentage
 * @returns {number} - Base amount
 */
export const calculateBaseAmount = (grossAmount, taxRate) => {
  if (!grossAmount || !taxRate) return grossAmount || 0;
  
  const base = grossAmount / (1 + taxRate / 100);
  return parseFloat(base.toFixed(2));
};

/**
 * Get tax code summary for display
 * @param {Object} taxCode - Tax code object
 * @returns {string} - Summary string
 */
export const getTaxCodeSummary = (taxCode) => {
  if (!taxCode) return "";
  
  const parts = [
    taxCode.Code,
    taxCode.Name,
    `${formatTaxRate(taxCode.Rate)}%`,
  ];
  
  if (taxCode.Inactive) {
    parts.push("(Inactive)");
  }
  
  if (taxCode.Freight) {
    parts.push("(Freight)");
  }
  
  return parts.join(" - ");
};

/**
 * Sort tax codes by code
 * @param {Array} taxCodes - Array of tax codes
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} - Sorted tax codes
 */
export const sortTaxCodes = (taxCodes, order = 'asc') => {
  if (!taxCodes || taxCodes.length === 0) return [];
  
  return [...taxCodes].sort((a, b) => {
    const comparison = a.Code.localeCompare(b.Code);
    return order === 'asc' ? comparison : -comparison;
  });
};

/**
 * Group tax codes by tax type combination
 * @param {Array} taxCodes - Array of tax codes
 * @returns {Object} - Grouped tax codes
 */
export const groupTaxCodesByType = (taxCodes) => {
  if (!taxCodes || taxCodes.length === 0) return {};
  
  return taxCodes.reduce((groups, taxCode) => {
    const type = taxCode.TaxTypeCombination || "Other";
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(taxCode);
    return groups;
  }, {});
};
