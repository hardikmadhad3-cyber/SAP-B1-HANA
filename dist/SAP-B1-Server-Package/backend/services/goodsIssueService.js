const sapService = require('./sapService');
const goodsIssueDb = require('./goodsIssueDbService');

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
    goodsIssueDb.getPriceLists(),
    goodsIssueDb.getBranches(),
  ]);

  return {
    priceLists,
    branches,
  };
};

const getItems = async () => goodsIssueDb.getItems();
const getBatchesByItem = async (itemCode, whsCode) =>
  goodsIssueDb.getBatchesByItem(itemCode, whsCode);
const getWarehouses = async () => goodsIssueDb.getWarehouses();
const getSeries = async () => goodsIssueDb.getSeries();
const getGoodsIssues = async () => goodsIssueDb.getGoodsIssueList();
const getGoodsIssue = async (docEntry) => goodsIssueDb.getGoodsIssue(docEntry);

const validatePayload = ({ header, lines }) => {
  if (!Array.isArray(lines) || !lines.length) {
    throw new Error('Add at least one line before saving.');
  }

  const activeLines = lines.filter((line) => line.itemCode);
  if (!activeLines.length) {
    throw new Error('Add at least one valid row before saving.');
  }

  activeLines.forEach((line, index) => {
    if (!String(line.itemCode || '').trim()) {
      throw new Error(`Line ${index + 1}: Item No is required.`);
    }
    if (toNumber(line.quantity, 0) <= 0) {
      throw new Error(`Line ${index + 1}: Quantity must be greater than zero.`);
    }
    if (!String(line.warehouse || '').trim()) {
      throw new Error(`Line ${index + 1}: Warehouse is required.`);
    }
    if (line.serialManaged) {
      throw new Error(
        `Line ${index + 1}: Serial-managed items are not yet supported on Goods Issue.`
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

const createGoodsIssue = async (payload) => {
  validatePayload(payload);

  const { header, lines = [] } = payload;

  const sapPayload = {
    DocDate: toIsoDate(header.postingDate),
    TaxDate: toIsoDate(header.documentDate),
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Goods Issue',
    DocumentLines: lines
      .filter((line) => line.itemCode)
      .map((line) => {
        const documentLine = {
          ItemCode: line.itemCode,
          Quantity: toNumber(line.quantity, 0),
          WarehouseCode: line.warehouse || '',
          Price: toNumber(line.unitPrice, 0),
        };

        if (line.uomCode) {
          documentLine.UoMCode = line.uomCode;
        }

        if (line.distributionRule) {
          documentLine.CostingCode = line.distributionRule;
        }

        if (line.batchManaged && Array.isArray(line.batches) && line.batches.length > 0) {
          documentLine.BatchNumbers = line.batches.map((batch) => ({
            BatchNumber: String(batch.batchNumber || '').trim(),
            Quantity: toNumber(batch.quantity, 0),
          }));
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

  console.debug('[GoodsIssue] Posting payload:', JSON.stringify(sapPayload, null, 2));

  try {
    const response = await sapService.request({
      method: 'POST',
      url: '/InventoryGenExits',
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Goods Issue created successfully.',
      docEntry: response.data.DocEntry,
      docNum: response.data.DocNum,
    };
  } catch (error) {
    const detail = extractSapError(error, 'Failed to create Goods Issue.');
    console.error('[GoodsIssue] SAP error:', detail);
    throw new Error(detail);
  }
};

const updateGoodsIssue = async (docEntry, payload) => {
  validatePayload(payload);

  const { header } = payload;
  const sapPayload = {
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Goods Issue',
  };

  if (header.ref2) {
    sapPayload.Reference2 = header.ref2;
  }

  try {
    await sapService.request({
      method: 'PATCH',
      url: `/InventoryGenExits(${docEntry})`,
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Goods Issue updated successfully.',
      docEntry: Number(docEntry),
      docNum: header.number || '',
    };
  } catch (error) {
    const detail = extractSapError(error, 'Failed to update Goods Issue.');
    console.error('[GoodsIssue] SAP update error:', detail);
    throw new Error(detail);
  }
};

module.exports = {
  getMetadata,
  getItems,
  getBatchesByItem,
  getWarehouses,
  getSeries,
  getGoodsIssues,
  getGoodsIssue,
  createGoodsIssue,
  updateGoodsIssue,
};
