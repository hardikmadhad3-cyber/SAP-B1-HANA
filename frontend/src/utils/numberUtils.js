/**
 * Number formatting and parsing utilities
 */

export const parseNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const roundTo = (v, decimals) => {
  const factor = Math.pow(10, decimals);
  return Math.round((v + Number.EPSILON) * factor) / factor;
};

export const formatDecimal = (value, decimals) => {
  if (value === '' || value == null) return '';
  const num = Number(value);
  return Number.isNaN(num) ? '' : num.toFixed(decimals);
};

export const sanitizeNumber = (value, decimals) => {
  const cleaned = String(value ?? '')
    .replace(/[^\d.-]/g, '')
    .replace(/(?!^)-/g, '')
    .replace(/^(-?)\./, '$10.')
    .replace(/(\..*)\./g, '$1');
  
  if (!cleaned) return '';
  if (!cleaned.includes('.')) return cleaned;
  
  const [whole, fraction] = cleaned.split('.');
  return `${whole}.${(fraction || '').slice(0, Math.max(decimals, 0))}`;
};
