const inventoryTransferService = require('../services/inventoryTransferService');

const errorPayload = (error, fallbackMessage) => ({
  success: false,
  message: error.message || fallbackMessage,
});

const getMetadata = async (_req, res) => {
  try {
    res.json(await inventoryTransferService.getMetadata());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load Inventory Transfer metadata.'));
  }
};

const getItems = async (_req, res) => {
  try {
    res.json(await inventoryTransferService.getItems());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load items.'));
  }
};

const getWarehouses = async (_req, res) => {
  try {
    res.json(await inventoryTransferService.getWarehouses());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load warehouses.'));
  }
};

const getSeries = async (_req, res) => {
  try {
    res.json(await inventoryTransferService.getSeries());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load series.'));
  }
};

const getBusinessPartnerDetails = async (req, res) => {
  try {
    res.json(await inventoryTransferService.getBusinessPartnerDetails(req.params.cardCode));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load business partner details.'));
  }
};

const getInventoryTransfers = async (_req, res) => {
  try {
    res.json(await inventoryTransferService.getInventoryTransfers());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load inventory transfers.'));
  }
};

const getInventoryTransfer = async (req, res) => {
  try {
    res.json(await inventoryTransferService.getInventoryTransfer(req.params.docEntry));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load inventory transfer.'));
  }
};

const createInventoryTransfer = async (req, res) => {
  try {
    res.json(await inventoryTransferService.createInventoryTransfer(req.body));
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to create Inventory Transfer.'));
  }
};

const updateInventoryTransfer = async (req, res) => {
  try {
    res.json(
      await inventoryTransferService.updateInventoryTransfer(req.params.docEntry, req.body)
    );
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to update Inventory Transfer.'));
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
