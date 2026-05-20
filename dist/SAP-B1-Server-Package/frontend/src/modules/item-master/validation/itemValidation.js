/**
 * Item Master Validation Utilities
 * Comprehensive validation functions for SAP B1 Item Master compliance
 */

// Field validation helpers
export const validateRequired = (value, fieldName) => {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} is required.`;
  }
  return null;
};

export const validatePositiveNumber = (value, fieldName) => {
  if (value !== undefined && value !== "" && (isNaN(value) || parseFloat(value) < 0)) {
    return `${fieldName} must be a positive number.`;
  }
  return null;
  };

export const validateNumericRange = (value, fieldName, min = null, max = null) => {
  if (value !== undefined && value !== "" && !isNaN(value)) {
    const num = parseFloat(value);
    if (min !== null && num < min) {
      return `${fieldName} must be at least ${min}.`;
    }
    if (max !== null && num > max) {
      return `${fieldName} must not exceed ${max}.`;
    }
  }
  return null;
};

export const validateDateRange = (fromDate, toDate, fromFieldName, toFieldName) => {
  if (fromDate && toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) {
      return `${fromFieldName} cannot be after ${toFieldName}.`;
    }
  }
  return null;
};

export const validateItemCodeFormat = (itemCode) => {
  if (!itemCode || !itemCode.trim()) return null;
  
  const code = itemCode.trim();
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9\-_]+$/.test(code)) {
    return "Item Code can only contain letters, numbers, hyphens, and underscores.";
  }
  
  // Check minimum length
  if (code.length < 3) {
    return "Item Code must be at least 3 characters long.";
  }
  
  // Check maximum length
  if (code.length > 50) {
    return "Item Code cannot exceed 50 characters.";
  }
  
  return null;
};

// Business logic validation functions
export const validateItemBusinessRules = (form) => {
  const errors = [];
  
  // Item Group validation
  if (!form.ItemsGroupCode || form.ItemsGroupCode === "") {
    errors.push("Item Group is required.");
  }
  
  // UoM Group validation for inventory items
  if (form.InventoryItem === 'tYES' && (!form.UoMGroupEntry || form.UoMGroupEntry === "")) {
    errors.push("UoM Group is required for inventory items.");
  }
  
  // Sales Item validations - ItemPrices collection is used instead of a single PriceListNum field
  // The UI Price List selection is handled via ItemPrices collection
  
  // Inventory Item validations
  if (form.InventoryItem === 'tYES') {
    if (!form.DefaultWarehouse || form.DefaultWarehouse === "") {
      errors.push("Default Warehouse is required for inventory items.");
    }
  }
  
  // Asset Item validations
  if (form.AssetItem === 'tYES') {
    if (!form.IncomeAccount || form.IncomeAccount === "") {
      errors.push("Income Account is required for asset items.");
    }
  }
  
  // GST Validations
  if (form.GSTRelevnt === 'tYES') {
    if (!form.ChapterID || form.ChapterID.trim() === "") {
      errors.push("HSN/SAC Code is required when GST is enabled.");
    }
    if (!form.GSTTaxCategory || form.GSTTaxCategory === "") {
      errors.push("GST Tax Category is required when GST is enabled.");
    }
  }
  
  return errors;
};

export const validateManageItemByRules = (form) => {
  const errors = [];
  const manageItemBy = form.ManageItemBy || "None";
  
  if (manageItemBy === "Serial") {
    if (!form.SerialGenerationType || form.SerialGenerationType === "") {
      errors.push("Serial Generation Type is required for serial items.");
    }
    if (form.SerialGenerationType === "Auto") {
      if (!form.SerialNumberLength || isNaN(form.SerialNumberLength) || parseInt(form.SerialNumberLength) <= 0) {
        errors.push("Serial Number Length is required and must be a positive number for auto-generated serials.");
      }
      if (!form.StartingSerialNumber || form.StartingSerialNumber.trim() === "") {
        errors.push("Starting Serial Number is required for auto-generated serials.");
      }
    }
  }
  
  if (manageItemBy === "Batch") {
    if (!form.BatchGenerationType || form.BatchGenerationType === "") {
      errors.push("Batch Generation Type is required for batch items.");
    }
    if (form.BatchGenerationType === "Auto" && (!form.BatchNumberPrefix || form.BatchNumberPrefix.trim() === "")) {
      errors.push("Batch Number Prefix is required for auto-generated batches.");
    }
  }
  
  return errors;
};

export const validateNumericFields = (form) => {
  const errors = [];
  
  const numericFields = [
    { field: 'CommissionPercent', name: 'Commission Percent' },
    { field: 'MinInventory', name: 'Minimum Inventory' },
    { field: 'MaxInventory', name: 'Maximum Inventory' },
    { field: 'DesiredInventory', name: 'Desired Inventory' },
    { field: 'OrderMultiple', name: 'Order Multiple' },
    { field: 'MinOrderQuantity', name: 'Minimum Order Quantity' },
  ];
  
  numericFields.forEach(({ field, name }) => {
    const error = validatePositiveNumber(form[field], name);
    if (error) errors.push(error);
  });
  
  return errors;
};

export const validateDateFields = (form) => {
  const errors = [];
  
  // Valid date range validation
  const validDateError = validateDateRange(
    form.ValidFrom, 
    form.ValidTo, 
    'Valid From date', 
    'Valid To date'
  );
  if (validDateError) errors.push(validDateError);
  
  // Frozen date range validation
  const frozenDateError = validateDateRange(
    form.FrozenFrom, 
    form.FrozenTo, 
    'Frozen From date', 
    'Frozen To date'
  );
  if (frozenDateError) errors.push(frozenDateError);
  
  return errors;
};

// Main comprehensive validation function
export const validateItemForm = (form, isUpdate = false) => {
  const errors = [];
  
  // Basic Required Fields
  if (!isUpdate) {
    const itemCodeError = validateRequired(form.ItemCode, 'Item Code');
    if (itemCodeError) errors.push(itemCodeError);
  }
  
  const itemNameError = validateRequired(form.ItemName, 'Item Name');
  if (itemNameError) errors.push(itemNameError);
  
  // Item Code Format Validation
  if (form.ItemCode) {
    const codeFormatError = validateItemCodeFormat(form.ItemCode);
    if (codeFormatError) errors.push(codeFormatError);
  }
  
  // Business Rules Validation
  errors.push(...validateItemBusinessRules(form));
  
  // Manage Item By Validation
  errors.push(...validateManageItemByRules(form));
  
  // Numeric Fields Validation
  errors.push(...validateNumericFields(form));
  
  // Date Fields Validation
  errors.push(...validateDateFields(form));
  
  return errors;
};

// Default value application functions
export const applySmartDefaults = (form, fieldName, value) => {
  const newForm = { ...form, [fieldName]: value };
  
  // Set defaults based on item type changes
  if (fieldName === 'ItemType') {
    if (value === 'itItems') {
      newForm.ItemClass = 'itcMaterial';
    } else if (value === 'itService') {
      newForm.ItemClass = 'itcService';
      newForm.InventoryItem = 'tNO';
      newForm.SalesItem = 'tYES';
      newForm.PurchaseItem = 'tYES';
    }
  }
  
  // Set defaults based on inventory item flag
  if (fieldName === 'InventoryItem') {
    if (value === 'tYES') {
      if (!newForm.CostAccountingMethod) {
        newForm.CostAccountingMethod = 'bis_MovingAverage';
      }
      if (!newForm.GLMethod) {
        newForm.GLMethod = 'glm_WH';
      }
    }
  }
  
  // Set defaults based on sales item flag
  if (fieldName === 'SalesItem') {
    if (value === 'tYES') {
      // Sales item defaults are handled via ItemPrices collection
    }
  }
  
  // Set tax defaults based on VAT liability
  if (fieldName === 'VatLiable') {
    if (value === 'tYES') {
      newForm.WTLiable = 'tYES';
    }
  }
  
  // Set UoM defaults when UoM group changes
  if (fieldName === 'UoMGroupEntry' && value) {
    if (!newForm.DefaultSalesUoMEntry) {
      newForm.DefaultSalesUoMEntry = value;
    }
    if (!newForm.DefaultPurchasingUoMEntry) {
      newForm.DefaultPurchasingUoMEntry = value;
    }
    if (!newForm.InventoryUoMEntry) {
      newForm.InventoryUoMEntry = value;
    }
  }
  
  // Set planning defaults
  if (fieldName === 'PlanningSystem') {
    if (value === 'bop_MRP') {
      if (!newForm.ProcurementMethod) {
        newForm.ProcurementMethod = 'bom_Buy';
      }
      if (!newForm.DemandSource) {
        newForm.DemandSource = 'ds_SalesOrders';
      }
    }
  }
  
  // Clear dependent fields when primary fields are cleared
  if (fieldName === 'ItemsGroupCode' && !value) {
    newForm.ItemsGroupName = '';
  }
  
  if (fieldName === 'UoMGroupEntry' && !value) {
    newForm.UoMGroupName = '';
    newForm.DefaultSalesUoMEntry = '';
    newForm.DefaultPurchasingUoMEntry = '';
    newForm.InventoryUoMEntry = '';
  }
  
  return newForm;
};

export default {
  validateItemForm,
  validateRequired,
  validatePositiveNumber,
  validateItemCodeFormat,
  validateItemBusinessRules,
  validateManageItemByRules,
  validateNumericFields,
  validateDateFields,
  applySmartDefaults,
};
