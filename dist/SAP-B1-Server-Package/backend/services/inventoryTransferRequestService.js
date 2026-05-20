const sapService = require('./sapService');
const inventoryTransferRequestDb = require('./inventoryTransferRequestDbService');

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
  const [priceLists, branches, businessPartners, salesEmployees] = await Promise.all([
    inventoryTransferRequestDb.getPriceLists(),
    inventoryTransferRequestDb.getBranches(),
    inventoryTransferRequestDb.getBusinessPartners(),
    inventoryTransferRequestDb.getSalesEmployees(),
  ]);

  return {
    priceLists,
    branches,
    businessPartners,
    salesEmployees,
  };
};

const getItems = async () => inventoryTransferRequestDb.getItems();
const getWarehouses = async () => inventoryTransferRequestDb.getWarehouses();
const getSeries = async () => inventoryTransferRequestDb.getSeries();
const getBusinessPartnerDetails = async (cardCode) =>
  inventoryTransferRequestDb.getBusinessPartnerDetails(cardCode);
const getInventoryTransferRequests = async () =>
  inventoryTransferRequestDb.getInventoryTransferRequestList();
const getInventoryTransferRequest = async (docEntry) =>
  inventoryTransferRequestDb.getInventoryTransferRequest(docEntry);

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
    if (!String(line.fromWarehouse || header?.fromWarehouse || '').trim()) {
      throw new Error(`Line ${index + 1}: From Warehouse is required.`);
    }
    if (!String(line.toWarehouse || header?.toWarehouse || '').trim()) {
      throw new Error(`Line ${index + 1}: To Warehouse is required.`);
    }
  });

  if (!header?.postingDate) {
    throw new Error('Posting Date is required.');
  }

  if (!header?.dueDate) {
    throw new Error('Due Date is required.');
  }

  if (!header?.documentDate) {
    throw new Error('Document Date is required.');
  }
};

const createInventoryTransferRequest = async (payload) => {
  validatePayload(payload);

  const { header, lines = [] } = payload;
  const activeLines = lines.filter((line) => line.itemCode);
  const firstLine = activeLines[0] || {};
  const documentFromWarehouse = header.fromWarehouse || firstLine.fromWarehouse || '';
  const documentToWarehouse = header.toWarehouse || firstLine.toWarehouse || '';

  const sapPayload = {
    DocDate: toIsoDate(header.postingDate),
    DueDate: toIsoDate(header.dueDate || header.postingDate),
    TaxDate: toIsoDate(header.documentDate),
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Inventory Transfer Request',
    FromWarehouse: documentFromWarehouse,
    ToWarehouse: documentToWarehouse,
    StockTransferLines: activeLines
      .map((line) => {
        const documentLine = {
          ItemCode: line.itemCode,
          Quantity: toNumber(line.quantity, 0),
          FromWarehouseCode: line.fromWarehouse || documentFromWarehouse,
          WarehouseCode: line.toWarehouse || documentToWarehouse,
        };

        if (line.uomCode) {
          documentLine.UoMCode = line.uomCode;
        }

        if (line.distributionRule) {
          documentLine.CostingCode = line.distributionRule;
        }

        return documentLine;
      }),
  };

  if (header.series) {
    sapPayload.Series = Number(header.series);
  }

  if (header.businessPartner) {
    sapPayload.CardCode = header.businessPartner;
  }

  if (header.referencedDocument) {
    sapPayload.Reference2 = header.referencedDocument;
  }

  console.debug(
    '[InventoryTransferRequest] Posting payload:',
    JSON.stringify(sapPayload, null, 2)
  );

  try {
    const response = await sapService.request({
      method: 'POST',
      url: '/InventoryTransferRequests',
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Inventory Transfer Request created successfully.',
      docEntry: response.data.DocEntry,
      docNum: response.data.DocNum,
    };
  } catch (error) {
    const detail = extractSapError(
      error,
      'Failed to create Inventory Transfer Request.'
    );
    console.error('[InventoryTransferRequest] SAP error:', detail);
    throw new Error(detail);
  }
};

const updateInventoryTransferRequest = async (docEntry, payload) => {
  validatePayload(payload);

  const { header } = payload;
  const sapPayload = {
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Inventory Transfer Request',
  };

  if (header.referencedDocument) {
    sapPayload.Reference2 = header.referencedDocument;
  }

  try {
    await sapService.request({
      method: 'PATCH',
      url: `/InventoryTransferRequests(${docEntry})`,
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Inventory Transfer Request updated successfully.',
      docEntry: Number(docEntry),
      docNum: header.number || '',
    };
  } catch (error) {
    const detail = extractSapError(
      error,
      'Failed to update Inventory Transfer Request.'
    );
    console.error('[InventoryTransferRequest] SAP update error:', detail);
    throw new Error(detail);
  }
};

module.exports = {
  getMetadata,
  getItems,
  getWarehouses,
  getSeries,
  getBusinessPartnerDetails,
  getInventoryTransferRequests,
  getInventoryTransferRequest,
  createInventoryTransferRequest,
  updateInventoryTransferRequest,
};
