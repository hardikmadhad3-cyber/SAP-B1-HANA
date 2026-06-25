const firstDisplayValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
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
