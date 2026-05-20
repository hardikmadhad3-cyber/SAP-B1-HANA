export const FREIGHT_DISTRIBUTION_METHOD_OPTIONS = [
  { value: 'N', label: 'None' },
  { value: 'Q', label: 'Quantity' },
  { value: 'V', label: 'Volume' },
  { value: 'W', label: 'Weight' },
  { value: 'E', label: 'Equally' },
  { value: 'R', label: 'Row Total' },
];

export const DEFAULT_FREIGHT_DIMENSIONS = [
  { id: 1, name: 'PRODUCT' },
  { id: 2, name: 'DIVISION' },
  { id: 3, name: 'BRANCH' },
];

const roundTo = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

const toNumber = (value) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const getDistributionMethodLabel = (value) =>
  FREIGHT_DISTRIBUTION_METHOD_OPTIONS.find((option) => option.value === value)?.label || value || '';

export const getTaxRate = (taxCodes = [], taxCode = '') => {
  const selectedTaxCode = taxCodes.find((code) => String(code.Code || '') === String(taxCode || ''));
  return selectedTaxCode?.Rate != null ? Number(selectedTaxCode.Rate) : 0;
};

export const calculateFreightAmounts = (row, taxCodes = []) => {
  const netAmount = roundTo(toNumber(row.netAmount));
  const taxRate = getTaxRate(taxCodes, row.taxCode);
  const taxAmount = roundTo(netAmount * taxRate / 100);
  const grossAmount = roundTo(netAmount + taxAmount);

  return {
    netAmount,
    taxRate,
    taxAmount,
    grossAmount,
  };
};

export const normalizeFreightChargeRow = (charge = {}, index = 0, taxCodes = []) => {
  const netAmount = toNumber(charge.netAmount ?? charge.LineTotal ?? charge.NetAmount ?? charge.DefaultAmount);
  const taxCode = charge.taxCode || charge.TaxCode || '';
  const computedAmounts = calculateFreightAmounts({ netAmount, taxCode }, taxCodes);
  const explicitTaxAmount = charge.taxAmount ?? charge.TaxAmount;
  const taxAmount = explicitTaxAmount != null ? roundTo(explicitTaxAmount) : computedAmounts.taxAmount;
  const grossAmount = roundTo(netAmount + taxAmount);
  const distributionRules = Array.isArray(charge.distributionRules) && charge.distributionRules.length
    ? charge.distributionRules
    : DEFAULT_FREIGHT_DIMENSIONS.map((dimension) => ({
        ...dimension,
        code: '',
        name: '',
      }));

  return {
    id: charge.id || `${charge.ExpnsCode || 'FRT'}-${index}`,
    expnsCode: charge.expnsCode || charge.ExpnsCode || '',
    expnsName: charge.expnsName || charge.ExpnsName || '',
    remarks: charge.remarks || charge.Comments || '',
    taxCode,
    totalTaxAmount: taxAmount,
    distributionMethod: charge.distributionMethod || charge.DistributionMethod || charge.DistrbMthd || 'N',
    netAmount: roundTo(netAmount),
    status: charge.status || charge.Status || 'O',
    freightTaxDistributionMethod:
      charge.freightTaxDistributionMethod ||
      charge.FreightTaxDistributionMethod ||
      charge.DistributionMethod ||
      charge.DistrbMthd ||
      'N',
    distributionRules,
    projectCode: charge.projectCode || charge.ProjectCode || charge.Project || '',
    projectName: charge.projectName || charge.ProjectName || '',
    grossAmount,
    taxLiable: charge.taxLiable ?? charge.TaxLiable ?? 'Y',
  };
};

export const summarizeFreightRows = (rows = [], taxCodes = []) => {
  const normalizedRows = rows.map((row, index) => {
    const normalized = normalizeFreightChargeRow(row, index, taxCodes);
    const amounts = calculateFreightAmounts(normalized, taxCodes);
    return {
      ...normalized,
      totalTaxAmount: amounts.taxAmount,
      grossAmount: amounts.grossAmount,
      netAmount: amounts.netAmount,
    };
  });

  const totalNet = roundTo(normalizedRows.reduce((sum, row) => sum + toNumber(row.netAmount), 0));
  const totalTax = roundTo(normalizedRows.reduce((sum, row) => sum + toNumber(row.totalTaxAmount), 0));
  const totalGross = roundTo(normalizedRows.reduce((sum, row) => sum + toNumber(row.grossAmount), 0));

  return {
    rows: normalizedRows,
    totalNet,
    totalTax,
    totalGross,
  };
};
