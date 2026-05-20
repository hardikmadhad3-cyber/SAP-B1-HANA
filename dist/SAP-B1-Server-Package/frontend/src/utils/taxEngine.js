/**
 * SAP B1 Compliant Tax Engine
 * Handles GST determination based on Place of Supply
 */

// Tax Code Mapping - Maps base tax codes to intra-state and inter-state variants
export const TAX_MAPPING = {
  // 5% GST
  'GST5': { intra: ['CGST2.5', 'SGST2.5'], inter: 'IGST5', rate: 5 },
  'GST@5': { intra: ['CGST2.5', 'SGST2.5'], inter: 'IGST5', rate: 5 },
  
  // 12% GST
  'GST12': { intra: ['CGST6', 'SGST6'], inter: 'IGST12', rate: 12 },
  'GST@12': { intra: ['CGST6', 'SGST6'], inter: 'IGST12', rate: 12 },
  
  // 18% GST
  'GST18': { intra: ['CGST9', 'SGST9'], inter: 'IGST18', rate: 18 },
  'GST@18': { intra: ['CGST9', 'SGST9'], inter: 'IGST18', rate: 18 },
  
  // 28% GST
  'GST28': { intra: ['CGST14', 'SGST14'], inter: 'IGST28', rate: 28 },
  'GST@28': { intra: ['CGST14', 'SGST14'], inter: 'IGST28', rate: 28 },
  
  // Exempt
  'EXEMPT': { intra: 'EXEMPT', inter: 'EXEMPT', rate: 0 },
  'GST0': { intra: 'EXEMPT', inter: 'EXEMPT', rate: 0 },
};

/**
 * Determine tax code for a line item
 * @param {Object} item - Item from OITM
 * @param {string} shipToState - Ship-To address state
 * @param {string} billToState - Bill-To address state
 * @param {boolean} useBillToForTax - Use Bill-To for tax determination
 * @param {string} companyState - Company/Branch state
 * @param {Array} availableTaxCodes - List of tax codes from SAP
 * @returns {string|null} - Tax code to apply
 */
export function determineTaxCode(
  item,
  shipToState,
  billToState,
  useBillToForTax,
  companyState,
  availableTaxCodes = []
) {
  // Validation
  if (!item || !item.TaxCodeAR) {
    console.warn('Item missing TaxCodeAR:', item);
    return null;
  }

  // Determine GST state based on checkbox
  const gstState = useBillToForTax ? billToState : shipToState;

  if (!gstState || !companyState) {
    console.warn('Missing state information:', { gstState, companyState });
    return null;
  }

  // Get base tax code from item
  const baseTaxCode = String(item.TaxCodeAR || '').trim();

  // Determine if intra-state or inter-state
  const isIntraState = gstState === companyState;

  console.log('Tax Determination:', {
    itemCode: item.ItemCode,
    baseTaxCode,
    gstState,
    companyState,
    isIntraState,
    useBillToForTax
  });

  // Map to appropriate tax code
  if (isIntraState) {
    return mapToIntraStateTax(baseTaxCode, availableTaxCodes);
  } else {
    return mapToInterStateTax(baseTaxCode, availableTaxCodes);
  }
}

/**
 * Map base tax code to intra-state tax (CGST + SGST)
 * @param {string} baseTaxCode - Base tax code from item
 * @param {Array} availableTaxCodes - Available tax codes
 * @returns {string|null} - Intra-state tax code
 */
function mapToIntraStateTax(baseTaxCode, availableTaxCodes) {
  // Find mapping
  const mapping = findTaxMapping(baseTaxCode);
  
  if (!mapping) {
    console.error(`No tax mapping found for: ${baseTaxCode}`);
    return null;
  }

  // For intra-state, we need CGST or SGST (or a combined code)
  // SAP B1 might have a single code that represents CGST+SGST
  const halfRate = mapping.rate / 2;
  
  // Option 1: Find a code with GSTType = 'INTRASTATE' and full rate
  const intraCode = availableTaxCodes.find(t => {
    const gstType = String(t.GSTType || '').toUpperCase();
    const rate = Number(t.Rate || 0);
    
    if (gstType === 'INTRASTATE' && Math.abs(rate - mapping.rate) < 0.01) {
      return true;
    }
    
    return false;
  });

  if (intraCode) {
    console.log(`✅ Mapped ${baseTaxCode} → ${intraCode.Code} (CGST+SGST ${mapping.rate}%)`);
    return intraCode.Code;
  }

  // Option 2: Find CGST code with half rate
  const cgstCode = availableTaxCodes.find(t => {
    const codeUpper = String(t.Code || '').toUpperCase();
    const nameUpper = String(t.Name || '').toUpperCase();
    const rate = Number(t.Rate || 0);
    
    if ((codeUpper.includes('CGST') || nameUpper.includes('CGST')) && 
        Math.abs(rate - halfRate) < 0.01) {
      return true;
    }
    
    return false;
  });

  if (cgstCode) {
    console.log(`✅ Mapped ${baseTaxCode} → ${cgstCode.Code} (CGST ${halfRate}%)`);
    return cgstCode.Code;
  }

  console.error(`❌ No CGST/INTRASTATE code found for rate ${mapping.rate}%`);
  console.log('Available tax codes:', availableTaxCodes.map(t => `${t.Code} (${t.Rate}%, ${t.GSTType})`));
  return null;
}

/**
 * Map base tax code to inter-state tax (IGST)
 * @param {string} baseTaxCode - Base tax code from item
 * @param {Array} availableTaxCodes - Available tax codes
 * @returns {string|null} - Inter-state tax code
 */
function mapToInterStateTax(baseTaxCode, availableTaxCodes) {
  // Find mapping
  const mapping = findTaxMapping(baseTaxCode);
  
  if (!mapping) {
    console.error(`No tax mapping found for: ${baseTaxCode}`);
    return null;
  }

  // For inter-state, we need IGST with the full rate
  // Find matching IGST code by rate and GSTType
  const igstCode = availableTaxCodes.find(t => {
    const codeUpper = String(t.Code || '').toUpperCase();
    const nameUpper = String(t.Name || '').toUpperCase();
    const gstType = String(t.GSTType || '').toUpperCase();
    const rate = Number(t.Rate || 0);
    
    // Match by GSTType = 'INTERSTATE' and rate
    if (gstType === 'INTERSTATE' && Math.abs(rate - mapping.rate) < 0.01) {
      return true;
    }
    
    // Fallback: Match by name containing IGST and rate
    if ((codeUpper.includes('IGST') || nameUpper.includes('IGST')) && 
        Math.abs(rate - mapping.rate) < 0.01) {
      return true;
    }
    
    return false;
  });

  if (igstCode) {
    console.log(`✅ Mapped ${baseTaxCode} → ${igstCode.Code} (IGST ${mapping.rate}%)`);
    return igstCode.Code;
  }

  console.error(`❌ No IGST code found for rate ${mapping.rate}%`);
  console.log('Available tax codes:', availableTaxCodes.map(t => `${t.Code} (${t.Rate}%, ${t.GSTType})`));
  return null;
}

/**
 * Find tax mapping for a base tax code
 * @param {string} baseTaxCode - Base tax code
 * @returns {Object|null} - Tax mapping object
 */
function findTaxMapping(baseTaxCode) {
  const normalized = String(baseTaxCode).toUpperCase().trim();
  
  // Direct match
  if (TAX_MAPPING[normalized]) {
    return TAX_MAPPING[normalized];
  }

  // Try to extract rate from code
  const rateMatch = normalized.match(/(\d+)/);
  if (rateMatch) {
    const rate = parseInt(rateMatch[1]);
    const key = `GST${rate}`;
    if (TAX_MAPPING[key]) {
      return TAX_MAPPING[key];
    }
  }

  return null;
}

/**
 * Validate tax code selection
 * @param {string} taxCode - Selected tax code
 * @param {Array} availableTaxCodes - Available tax codes from SAP
 * @returns {boolean} - Is valid
 */
export function validateTaxCode(taxCode, availableTaxCodes) {
  if (!taxCode) return false;
  return availableTaxCodes.some(t => t.Code === taxCode);
}

/**
 * Get GST type label for display
 * @param {string} companyState - Company state
 * @param {string} customerState - Customer state
 * @returns {string} - GST type label
 */
export function getGSTTypeLabel(companyState, customerState) {
  if (!companyState || !customerState) return 'Unknown';
  return companyState === customerState ? 'CGST + SGST (Intra-State)' : 'IGST (Inter-State)';
}

/**
 * Recalculate tax codes for all line items
 * @param {Array} lines - Line items
 * @param {Array} items - Item master data
 * @param {string} shipToState - Ship-To state
 * @param {string} billToState - Bill-To state
 * @param {boolean} useBillToForTax - Use Bill-To for tax
 * @param {string} companyState - Company state
 * @param {Array} availableTaxCodes - Available tax codes
 * @returns {Array} - Updated lines
 */
export function recalculateAllTaxCodes(
  lines,
  items,
  shipToState,
  billToState,
  useBillToForTax,
  companyState,
  availableTaxCodes
) {
  return lines.map(line => {
    if (!line.itemNo) return line;

    const item = items.find(it => String(it.ItemCode) === String(line.itemNo));
    if (!item) return line;

    const taxCode = determineTaxCode(
      item,
      shipToState,
      billToState,
      useBillToForTax,
      companyState,
      availableTaxCodes
    );

    return {
      ...line,
      taxCode: taxCode || line.taxCode
    };
  });
}
