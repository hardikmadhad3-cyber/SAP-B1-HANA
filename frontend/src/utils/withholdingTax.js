export const isYesValue = (value) => ['Y', 'YES', 'TRUE', '1', 'TYES'].includes(String(value || '').trim().toUpperCase());

export const roundTo = (value, decimals = 2) => {
  const factor = 10 ** Math.max(Number(decimals) || 0, 0);
  return Math.round(((Number(value) || 0) + Number.EPSILON) * factor) / factor;
};

const normalizeBaseType = (row = {}) => String(row.baseTypeCode || row.baseType || 'N').trim().toUpperCase();

export const resolveWithholdingTaxBaseAmount = (row = {}, amounts = 0, decimals = 2) => {
  if (typeof amounts !== 'object' || amounts === null) return roundTo(amounts, decimals);

  const baseType = normalizeBaseType(row);
  let amount;
  if (['G', 'GROSS'].includes(baseType)) amount = amounts.grossAmount;
  else if (['V', 'VAT'].includes(baseType)) amount = amounts.taxAmount;
  else amount = amounts.netAmount;

  const percentage = Number(row.basePercentage ?? row.basePercent ?? 100);
  const appliedPercentage = Number.isFinite(percentage) ? percentage : 100;
  return roundTo((Number(amount) || 0) * appliedPercentage / 100, decimals);
};

export const createEmptyWithholdingTaxState = () => ({
  open: false,
  partnerSubject: false,
  defaultCode: '',
  allowedCodes: [],
  rows: [],
});

export const normalizePartnerWithholdingTax = (withholdingTax = {}) => ({
  partnerSubject: Boolean(withholdingTax.subject),
  defaultCode: withholdingTax.defaultCode || '',
  allowedCodes: Array.isArray(withholdingTax.allowedCodes) ? withholdingTax.allowedCodes : [],
});

export const recalcWithholdingRows = (rows = [], baseAmount = 0, decimals = {}) => (
  rows.map((row) => {
    const rate = Number(row.rate) || 0;
    const resolvedBaseAmount = resolveWithholdingTaxBaseAmount(row, baseAmount, decimals.total ?? 2);
    return {
      ...row,
      baseAmount: resolvedBaseAmount,
      taxableAmount: resolvedBaseAmount,
      wtaxAmount: roundTo(resolvedBaseAmount * rate / 100, decimals.tax ?? 2),
      baseType: row.baseType || 'Net',
      category: row.category || 'Invoice',
      criteria: row.criteria || 'Cash',
      tdsType: row.tdsType || 'eTDS',
    };
  })
);

export const createDefaultWithholdingRows = (withholdingTax = {}, baseAmount = 0, decimals = {}) => {
  const allowedCodes = withholdingTax.allowedCodes || [];
  const defaultCode = withholdingTax.defaultCode || allowedCodes[0]?.code || '';
  if (!defaultCode) return [];
  const codeRow = allowedCodes.find((row) => String(row.code || '') === String(defaultCode)) || allowedCodes[0];
  const rate = Number(codeRow?.rate) || 0;
  const rowDefaults = {
    baseTypeCode: codeRow?.baseTypeCode || 'N',
    baseType: codeRow?.baseType || 'Net',
    basePercentage: codeRow?.basePercentage ?? 100,
  };
  const resolvedBaseAmount = resolveWithholdingTaxBaseAmount(rowDefaults, baseAmount, decimals.total ?? 2);
  return [{
    code: codeRow?.code || defaultCode,
    name: codeRow?.name || '',
    rate,
    baseAmount: resolvedBaseAmount,
    taxableAmount: resolvedBaseAmount,
    wtaxAmount: roundTo(resolvedBaseAmount * rate / 100, decimals.tax ?? 2),
    category: codeRow?.taxCategory || 'Invoice',
    ...rowDefaults,
    tdsAccount: codeRow?.account || '',
    criteria: 'Cash',
    tdsType: 'eTDS',
  }];
};

export const calculateWithholdingTaxAmount = ({
  currentDocEntry,
  savedAmount,
  hasLiableLines,
  withholdingTax,
  baseAmount,
  decimals = {},
}) => {
  const parsedSavedAmount = Number(savedAmount) || 0;
  if (currentDocEntry && Math.abs(parsedSavedAmount) > 0) {
    return roundTo(parsedSavedAmount, decimals.tax ?? 2);
  }
  if (!hasLiableLines || !withholdingTax.partnerSubject) return 0;
  const rows = withholdingTax.rows.length ? withholdingTax.rows : [];
  return roundTo(
    recalcWithholdingRows(rows, baseAmount, decimals).reduce((sum, row) => sum + (Number(row.wtaxAmount) || 0), 0),
    decimals.tax ?? 2,
  );
};
