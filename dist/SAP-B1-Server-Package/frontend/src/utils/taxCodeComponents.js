export const findTaxCode = (taxCodes = [], code = '') =>
  taxCodes.find((tax) => String(tax?.Code || '') === String(code || ''));

export const taxCodeHasComponent = (taxCodes = [], code = '', component = '') => {
  const normalizedComponent = String(component || '').trim().toUpperCase();
  if (!normalizedComponent) return false;

  const tax = findTaxCode(taxCodes, code);
  const gstType = String(tax?.GSTType || '').trim().toUpperCase();
  const searchText = `${tax?.Code || code || ''} ${tax?.Name || ''}`.toUpperCase();

  if (gstType === 'INTRASTATE' && ['CGST', 'SGST'].includes(normalizedComponent)) {
    return true;
  }

  if (gstType === 'INTERSTATE' && normalizedComponent === 'IGST') {
    return true;
  }

  return searchText.includes(normalizedComponent);
};

export const getTaxComponentCodes = (codes = [], taxCodes = [], component = '') =>
  Array.from(codes).filter((code) => taxCodeHasComponent(taxCodes, code, component));
