/**
 * Tax Code Setup Validation
 * Validates tax code data according to SAP B1 business rules
 */

export const validateTaxCode = (form) => {
  const errors = [];

  // Required fields
  if (!form.Code || !form.Code.trim()) {
    errors.push("Tax Code is required.");
  } else if (form.Code.length > 8) {
    errors.push("Tax Code cannot exceed 8 characters.");
  }

  if (!form.Name || !form.Name.trim()) {
    errors.push("Description is required.");
  } else if (form.Name.length > 100) {
    errors.push("Description cannot exceed 100 characters.");
  }

  // Note: Tax Rate is auto-calculated from components, no validation needed

  return errors;
};

export const validateTaxCodeLine = (line, index) => {
  const errors = [];
  const lineNum = index + 1;

  // Check if line has meaningful data (excluding default "0.00" for NonDeductible)
  const hasData = line.TaxType || 
                  line.Code || 
                  line.Description || 
                  line.SalesTaxAccount || 
                  line.PurchasingTaxAccount || 
                  (line.NonDeductible && parseFloat(line.NonDeductible) > 0) ||
                  line.NonDeductibleAccount;

  if (hasData) {
    // Tax Type is required if line has data
    if (!line.TaxType) {
      errors.push(`Line ${lineNum}: Tax Type is required.`);
    }

    // Code validation (optional but if provided, check length)
    if (line.Code && line.Code.length > 8) {
      errors.push(`Line ${lineNum}: Code cannot exceed 8 characters.`);
    }

    // Description validation (optional but if provided, check length)
    if (line.Description && line.Description.length > 100) {
      errors.push(`Line ${lineNum}: Description cannot exceed 100 characters.`);
    }

    // Non-Deductible percentage validation
    if (line.NonDeductible !== "" && line.NonDeductible != null) {
      const nonDeductible = parseFloat(line.NonDeductible);
      if (isNaN(nonDeductible)) {
        errors.push(`Line ${lineNum}: Non-Deductible must be a valid number.`);
      } else if (nonDeductible < 0 || nonDeductible > 100) {
        errors.push(`Line ${lineNum}: Non-Deductible must be between 0 and 100.`);
      }
    }

    // If Non-Deductible > 0, Non-Deductible Account should be specified
    if (parseFloat(line.NonDeductible) > 0 && !line.NonDeductibleAccount) {
      errors.push(`Line ${lineNum}: Non-Deductible Account is required when Non-Deductible % is greater than 0.`);
    }
  }

  return errors;
};

export const validateTaxCodeLines = (lines) => {
  const errors = [];

  lines.forEach((line, index) => {
    const lineErrors = validateTaxCodeLine(line, index);
    errors.push(...lineErrors);
  });

  return errors;
};

export const validateTaxCodeForm = (form) => {
  const errors = [];

  // Validate header
  const headerErrors = validateTaxCode(form);
  errors.push(...headerErrors);

  // Validate lines
  if (form.VatGroups_Lines && form.VatGroups_Lines.length > 0) {
    const lineErrors = validateTaxCodeLines(form.VatGroups_Lines);
    errors.push(...lineErrors);
  }

  return errors;
};

/**
 * Business logic validations
 */
export const validateBusinessRules = (form) => {
  const warnings = [];

  // Note: Tax Rate is auto-calculated, no validation needed

  // Check if Freight is checked but no freight-related tax type
  if (form.Freight && form.VatGroups_Lines && form.VatGroups_Lines.length > 0) {
    const hasFreightType = form.VatGroups_Lines.some(line => 
      line.TaxType && line.TaxType.toLowerCase().includes("freight")
    );
    if (!hasFreightType) {
      warnings.push("Freight is enabled but no freight-related tax type is defined in components.");
    }
  }

  // Check for duplicate tax types in lines
  if (form.VatGroups_Lines && form.VatGroups_Lines.length > 1) {
    const taxTypes = form.VatGroups_Lines
      .filter(line => line.TaxType)
      .map(line => line.TaxType);
    
    const duplicates = taxTypes.filter((type, index) => 
      taxTypes.indexOf(type) !== index
    );
    
    if (duplicates.length > 0) {
      warnings.push(`Duplicate tax types found: ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  return warnings;
};
