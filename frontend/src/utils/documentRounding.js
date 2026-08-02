const toFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const roundDocumentValue = (value, decimals = 2) => {
  const precision = Math.max(0, Number(decimals) || 0);
  const factor = 10 ** precision;
  return Math.round((toFiniteNumber(value) + Number.EPSILON) * factor) / factor;
};

export const calculateDocumentRounding = (value, enabled, decimals = 2) => {
  const totalBeforeRounding = roundDocumentValue(value, decimals);
  const roundingAmount = enabled
    ? roundDocumentValue(Math.round(totalBeforeRounding) - totalBeforeRounding, decimals)
    : 0;
  const total = roundDocumentValue(totalBeforeRounding + roundingAmount, decimals);

  return { totalBeforeRounding, roundingAmount, total };
};
