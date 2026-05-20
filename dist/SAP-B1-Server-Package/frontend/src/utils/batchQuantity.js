export const BATCH_QTY_TOLERANCE = 0.001;

const normalizeLine = (line) => (line && typeof line === 'object' ? line : {});
const normalizeBatches = (batches) => (Array.isArray(batches) ? batches : []);

export const parseBatchNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const getLineUomFactor = (line = {}) => {
  const safeLine = normalizeLine(line);
  const explicitFactor = parseBatchNumber(safeLine.uomFactor);
  if (explicitFactor > 0) return explicitFactor;

  const rawUomCode = String(safeLine.uomCode || '').trim();
  const numericFactor = parseFloat(rawUomCode);
  if (Number.isFinite(numericFactor) && numericFactor > 0) {
    return numericFactor;
  }

  return 1;
};

export const getBatchInventoryUom = (line = {}) => {
  const safeLine = normalizeLine(line);
  return (
    String(safeLine.inventoryUOM || safeLine.InventoryUOM || '').trim() ||
    String(safeLine.uomCode || '').trim()
  );
};

export const getDocumentUomLabel = (line = {}) => {
  const safeLine = normalizeLine(line);
  const rawUomCode = String(safeLine.uomCode || '').trim();
  const inventoryUom = getBatchInventoryUom(safeLine);
  const numericFactor = parseFloat(rawUomCode);

  if (!rawUomCode) return inventoryUom;
  if (Number.isFinite(numericFactor) && numericFactor > 0 && inventoryUom) {
    return `${rawUomCode} ${inventoryUom}`;
  }

  return rawUomCode;
};

export const getRequiredBatchQty = (line = {}) => {
  const safeLine = normalizeLine(line);
  return parseBatchNumber(safeLine.quantity) * getLineUomFactor(safeLine);
};

export const sumBatchQty = (batches = []) =>
  normalizeBatches(batches).reduce((sum, batch) => sum + parseBatchNumber(batch?.quantity), 0);

export const batchQtyMatchesLine = (line = {}, batches = []) =>
  Math.abs(sumBatchQty(batches) - getRequiredBatchQty(line)) <= BATCH_QTY_TOLERANCE;
