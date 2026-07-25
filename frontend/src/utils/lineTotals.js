const firstDisplayValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const parseLineNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getTaxRateForCode = (taxCode = '', taxCodes = []) => {
  const code = String(taxCode || '').trim();
  if (!code) return 0;

  const matchedTaxCode = (taxCodes || []).find((entry) => (
    String(entry?.Code || '').trim().toUpperCase() === code.toUpperCase()
  ));
  if (matchedTaxCode?.Rate !== undefined && matchedTaxCode?.Rate !== null) {
    return parseLineNumber(matchedTaxCode.Rate);
  }

  const rateFromCode = code.match(/(\d+(?:\.\d+)?)/);
  return rateFromCode ? parseLineNumber(rateFromCode[1]) : 0;
};

export const getCalculatedForRate = (line = {}, taxCodes = [], decimals = 5) => {
  const unitPrice = parseLineNumber(line.unitPrice ?? line.Price ?? line.UnitPrice);
  if (unitPrice <= 0) return '';

  const discountPercent = Math.min(
    100,
    Math.max(0, parseLineNumber(line.stdDiscount ?? line.discountPercent ?? line.DiscountPercent ?? line.DiscPrcnt))
  );
  const taxRate = getTaxRateForCode(line.taxCode ?? line.TaxCode ?? line.VatGroup, taxCodes);
  const value = unitPrice * (1 - discountPercent / 100) * (1 + taxRate / 100);

  return Number.isFinite(value) ? value.toFixed(decimals) : '';
};

export const getLineTotalsForDisplay = (line = {}, taxCodes = [], fallbackDecimals = 2) => {
  void taxCodes;
  void fallbackDecimals;

  const beforeTax = firstDisplayValue(
    line.totalBeforeTax,
    line.totalLC,
    line.LineTotal,
    line.total
  );
  if (!beforeTax) {
    return { beforeTax: "", total: "" };
  }

  return {
    beforeTax,
    total: firstDisplayValue(line.totalLC, line.LineTotal, line.total, beforeTax),
  };
};
