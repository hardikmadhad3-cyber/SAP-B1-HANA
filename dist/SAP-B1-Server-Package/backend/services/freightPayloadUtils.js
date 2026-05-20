const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildDocumentAdditionalExpenses = (freightCharges = []) =>
  (Array.isArray(freightCharges) ? freightCharges : [])
    .map((charge) => {
      const expenseCode = toNumberOrUndefined(charge?.expnsCode ?? charge?.ExpnsCode);
      const lineTotal = toNumberOrUndefined(
        charge?.netAmount ??
        charge?.LineTotal ??
        charge?.NetAmount ??
        charge?.DefaultAmount
      );
      const taxCode = String(charge?.taxCode ?? charge?.TaxCode ?? '').trim();

      if (expenseCode === undefined) {
        return undefined;
      }

      if (lineTotal === undefined && !taxCode) {
        return undefined;
      }

      return {
        ExpenseCode: expenseCode,
        LineTotal: lineTotal ?? 0,
        ...(taxCode ? { TaxCode: taxCode } : {}),
      };
    })
    .filter(Boolean);

module.exports = {
  buildDocumentAdditionalExpenses,
};
