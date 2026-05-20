const sapService = require('./sapService');
const goodsReceiptDb = require('./goodsReceiptDbService');

const toIsoDate = (value) => {
  if (!value) return null;
  return String(value).split('T')[0];
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractSapError = (error, fallback) =>
  error.response?.data?.error?.message?.value ||
  error.response?.data?.error?.message ||
  error.response?.data?.detail ||
  error.message ||
  fallback;

const getMetadata = async () => {
  const [priceLists, branches] = await Promise.all([
    goodsReceiptDb.getPriceLists(),
    goodsReceiptDb.getBranches(),
  ]);

  return {
    priceLists,
    branches,
  };
};

const getItems = async () => goodsReceiptDb.getItems();
const getBatchesByItem = async (itemCode, whsCode) =>
  goodsReceiptDb.getBatchesByItem(itemCode, whsCode);
const getWarehouses = async () => goodsReceiptDb.getWarehouses();
const getSeries = async () => goodsReceiptDb.getSeries();
const getPurchaseOrders = async () => goodsReceiptDb.getPurchaseOrders();
const getPurchaseInvoices = async () => goodsReceiptDb.getPurchaseInvoices();
const getGoodsIssues = async () => goodsReceiptDb.getGoodsIssues();
const getGoodsReceipts = async () => goodsReceiptDb.getGoodsReceiptList();
const getGoodsReceipt = async (docEntry) => goodsReceiptDb.getGoodsReceipt(docEntry);

const getCopyFromDocument = async (sourceType, docEntry) => {
  if (sourceType === 'goods-issue') {
    return goodsReceiptDb.getGoodsIssueForCopy(docEntry);
  }

  throw new Error(`Unsupported copy source: ${sourceType}`);
};

const validatePayload = ({ header, lines }) => {
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error('Add at least one line before saving.');
  }

  const activeLines = lines.filter((line) => line.itemCode || line.baseEntry != null);
  if (!activeLines.length) {
    throw new Error('Add at least one valid row before saving.');
  }

  activeLines.forEach((line, index) => {
    const isBaseLine = line.baseEntry != null && line.baseLine != null && line.baseType != null;
    if (!isBaseLine && !String(line.itemCode || '').trim()) {
      throw new Error(`Line ${index + 1}: Item No is required.`);
    }
    if (!isBaseLine && toNumber(line.quantity, 0) <= 0) {
      throw new Error(`Line ${index + 1}: Quantity must be greater than zero.`);
    }
    if (String(line.itemCode || '').trim() && !String(line.warehouse || '').trim()) {
      throw new Error(`Line ${index + 1}: Warehouse is required.`);
    }
    if (line.serialManaged) {
      throw new Error(
        `Line ${index + 1}: Serial-managed items are not yet supported on Goods Receipt.`
      );
    }
    if (line.batchManaged && (!Array.isArray(line.batches) || line.batches.length === 0)) {
      throw new Error(
        `Line ${index + 1}: Batch allocation is required for batch-managed items.`
      );
    }
  });

  if (!header?.postingDate) {
    throw new Error('Posting Date is required.');
  }

  if (!header?.documentDate) {
    throw new Error('Document Date is required.');
  }
};

const createGoodsReceipt = async (payload) => {
  validatePayload(payload);

  const { header, lines = [] } = payload;

  const sapPayload = {
    DocDate: toIsoDate(header.postingDate),
    TaxDate: toIsoDate(header.documentDate),
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Goods Receipt',
    DocumentLines: lines
      .filter((line) => line.itemCode || line.baseEntry != null)
      .map((line) => {
        const documentLine = {
          Quantity: toNumber(line.quantity, 0),
          WarehouseCode: line.warehouse || '',
        };

        if (line.baseEntry != null && line.baseLine != null && line.baseType != null) {
          documentLine.BaseEntry = Number(line.baseEntry);
          documentLine.BaseLine = Number(line.baseLine);
          documentLine.BaseType = Number(line.baseType);
        } else {
          documentLine.ItemCode = line.itemCode;
          documentLine.Price = toNumber(line.unitPrice, 0);
          if (line.uomCode) {
            documentLine.UoMCode = line.uomCode;
          }
        }

        if (line.distributionRule) {
          documentLine.CostingCode = line.distributionRule;
        }

        if (line.batchManaged && Array.isArray(line.batches) && line.batches.length > 0) {
          documentLine.BatchNumbers = line.batches.map((batch) => {
            const nextBatch = {
              BatchNumber: String(batch.batchNumber || '').trim(),
              Quantity: toNumber(batch.quantity, 0),
            };

            if (batch.expiryDate) {
              nextBatch.ExpiryDate = toIsoDate(batch.expiryDate);
            }

            return nextBatch;
          });
        }

        return documentLine;
      }),
  };

  if (header.series) {
    sapPayload.Series = Number(header.series);
  }

  if (header.ref2) {
    sapPayload.Reference2 = header.ref2;
  }

  if (header.branch) {
    sapPayload.BPL_IDAssignedToInvoice = Number(header.branch);
  }

  console.debug('[GoodsReceipt] Posting payload:', JSON.stringify(sapPayload, null, 2));

  try {
    const response = await sapService.request({
      method: 'POST',
      url: '/InventoryGenEntries',
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Goods Receipt created successfully.',
      docEntry: response.data.DocEntry,
      docNum: response.data.DocNum,
    };
  } catch (error) {
    const detail = extractSapError(error, 'Failed to create Goods Receipt.');
    console.error('[GoodsReceipt] SAP error:', detail);
    throw new Error(detail);
  }
};

const updateGoodsReceipt = async (docEntry, payload) => {
  validatePayload(payload);

  const { header } = payload;
  const sapPayload = {
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Goods Receipt',
  };

  if (header.ref2) {
    sapPayload.Reference2 = header.ref2;
  }

  try {
    await sapService.request({
      method: 'PATCH',
      url: `/InventoryGenEntries(${docEntry})`,
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Goods Receipt updated successfully.',
      docEntry: Number(docEntry),
      docNum: header.number || '',
    };
  } catch (error) {
    const detail = extractSapError(error, 'Failed to update Goods Receipt.');
    console.error('[GoodsReceipt] SAP update error:', detail);
    throw new Error(detail);
  }
};

module.exports = {
  getMetadata,
  getItems,
  getBatchesByItem,
  getWarehouses,
  getSeries,
  getPurchaseOrders,
  getPurchaseInvoices,
  getGoodsIssues,
  getGoodsReceipts,
  getGoodsReceipt,
  getCopyFromDocument,
  createGoodsReceipt,
  updateGoodsReceipt,
};
