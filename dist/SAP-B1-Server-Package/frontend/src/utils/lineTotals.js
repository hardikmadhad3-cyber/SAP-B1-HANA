const parseNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const getDecimalPlaces = (value, fallback = 2) => {
  const text = String(value ?? "").trim();
  if (!text || !text.includes(".")) return fallback;
  return text.split(".")[1].length;
};

export const getLineTotalsForDisplay = (line = {}, taxCodes = [], fallbackDecimals = 2) => {
  const beforeTax = String(line.total ?? "").trim();
  if (!beforeTax) {
    return { beforeTax: "", total: "" };
  }

  const beforeTaxValue = parseNumber(beforeTax);
  const taxCode = String(line.taxCode ?? "").trim();
  const tax = taxCodes.find((entry) => String(entry?.Code ?? "").trim() === taxCode);
  const taxRate = parseNumber(tax?.Rate);
  const decimals = getDecimalPlaces(beforeTax, fallbackDecimals);
  const totalValue = beforeTaxValue + (beforeTaxValue * taxRate) / 100;

  return {
    beforeTax,
    total: totalValue.toFixed(Math.max(decimals, 0)),
  };
};
