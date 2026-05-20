const sapService = require('./sapService');
const inventoryTransferDb = require('./inventoryTransferDbService');

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

const loadBusinessPartnerPayload = async (header = {}) => {
  const cardCode = String(header.businessPartner || '').trim();
  if (!cardCode) return {};

  const bpResponse = await sapService.request({
    method: 'GET',
    url: `/BusinessPartners('${encodeURIComponent(cardCode)}')`,
  });
  const businessPartner = bpResponse.data || {};
  const documentBranch = String(header.fromBranch || '').trim();
  const activeAssignments = Array.isArray(businessPartner.BPBranchAssignment)
    ? businessPartner.BPBranchAssignment.filter(
        (assignment) => String(assignment.DisabledForBP || '').toLowerCase() !== 'tyes'
      ).map((assignment) => String(assignment.BPLID))
    : [];

  if (
    documentBranch &&
    activeAssignments.length &&
    !activeAssignments.includes(documentBranch)
  ) {
    throw new Error(
      `Selected business partner ${cardCode} is not assigned to branch ${documentBranch}.`
    );
  }

  let shipToAddress = String(header.shipToAddress || '').trim();
  if (!shipToAddress && header.shipTo) {
    const details = await inventoryTransferDb.getBusinessPartnerDetails(cardCode);
    const matchedAddress = (details.shipToAddresses || []).find(
      (address) => address.id === header.shipTo || address.label === header.shipTo
    );
    shipToAddress = matchedAddress?.fullAddress || '';
  }

  const partnerPayload = {
    CardCode: cardCode,
  };

  if (header.contactPerson) {
    partnerPayload.ContactPerson = Number(header.contactPerson);
  }

  if (header.shipTo) {
    partnerPayload.ShipToCode = header.shipTo;
  }

  if (shipToAddress) {
    partnerPayload.Address = shipToAddress;
  }

  if (header.priceList) {
    partnerPayload.PriceList = Number(header.priceList);
  } else if (businessPartner.PriceListNum != null) {
    partnerPayload.PriceList = Number(businessPartner.PriceListNum);
  }

  return partnerPayload;
};

const getMetadata = async () => {
  const [priceLists, branches, businessPartners, salesEmployees] = await Promise.all([
    inventoryTransferDb.getPriceLists(),
    inventoryTransferDb.getBranches(),
    inventoryTransferDb.getBusinessPartners(),
    inventoryTransferDb.getSalesEmployees(),
  ]);

  return {
    priceLists,
    branches,
    businessPartners,
    salesEmployees,
  };
};

const getItems = async () => inventoryTransferDb.getItems();
const getWarehouses = async () => inventoryTransferDb.getWarehouses();
const getSeries = async () => inventoryTransferDb.getSeries();
const getBusinessPartnerDetails = async (cardCode) =>
  inventoryTransferDb.getBusinessPartnerDetails(cardCode);
const getInventoryTransfers = async () => inventoryTransferDb.getInventoryTransferList();
const getInventoryTransfer = async (docEntry) =>
  inventoryTransferDb.getInventoryTransfer(docEntry);

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

const createInventoryTransfer = async (payload) => {
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
    JournalMemo: header.journalRemark || 'Inventory Transfer',
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

  Object.assign(sapPayload, await loadBusinessPartnerPayload(header));

  if (header.referencedDocument) {
    sapPayload.Reference2 = header.referencedDocument;
  }

  console.debug('[InventoryTransfer] Posting payload:', JSON.stringify(sapPayload, null, 2));

  try {
    const response = await sapService.request({
      method: 'POST',
      url: '/StockTransfers',
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Inventory Transfer created successfully.',
      docEntry: response.data.DocEntry,
      docNum: response.data.DocNum,
    };
  } catch (error) {
    const detail = extractSapError(error, 'Failed to create Inventory Transfer.');
    console.error('[InventoryTransfer] SAP error:', detail);
    throw new Error(detail);
  }
};

const updateInventoryTransfer = async (docEntry, payload) => {
  validatePayload(payload);

  const { header } = payload;
  const sapPayload = {
    Comments: header.remarks || '',
    JournalMemo: header.journalRemark || 'Inventory Transfer',
  };

  if (header.referencedDocument) {
    sapPayload.Reference2 = header.referencedDocument;
  }

  try {
    await sapService.request({
      method: 'PATCH',
      url: `/StockTransfers(${docEntry})`,
      data: sapPayload,
    });

    return {
      success: true,
      message: 'Inventory Transfer updated successfully.',
      docEntry: Number(docEntry),
      docNum: header.number || '',
    };
  } catch (error) {
    const detail = extractSapError(error, 'Failed to update Inventory Transfer.');
    console.error('[InventoryTransfer] SAP update error:', detail);
    throw new Error(detail);
  }
};

module.exports = {
  getMetadata,
  getItems,
  getWarehouses,
  getSeries,
  getBusinessPartnerDetails,
  getInventoryTransfers,
  getInventoryTransfer,
  createInventoryTransfer,
  updateInventoryTransfer,
};
