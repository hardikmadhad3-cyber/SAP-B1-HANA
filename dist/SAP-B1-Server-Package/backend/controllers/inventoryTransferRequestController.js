const inventoryTransferRequestService = require('../services/inventoryTransferRequestService');

const errorPayload = (error, fallbackMessage) => ({
  success: false,
  message: error.message || fallbackMessage,
});

const getMetadata = async (_req, res) => {
  try {
    res.json(await inventoryTransferRequestService.getMetadata());
  } catch (error) {
    res
      .status(500)
      .json(errorPayload(error, 'Failed to load Inventory Transfer Request metadata.'));
  }
};

const getItems = async (_req, res) => {
  try {
    res.json(await inventoryTransferRequestService.getItems());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load items.'));
  }
};

const getWarehouses = async (_req, res) => {
  try {
    res.json(await inventoryTransferRequestService.getWarehouses());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load warehouses.'));
  }
};

const getSeries = async (_req, res) => {
  try {
    res.json(await inventoryTransferRequestService.getSeries());
  } catch (error) {
    res.status(500).json(errorPayload(error, 'Failed to load series.'));
  }
};

const getBusinessPartnerDetails = async (req, res) => {
  try {
    res.json(
      await inventoryTransferRequestService.getBusinessPartnerDetails(req.params.cardCode)
    );
  } catch (error) {
    res
      .status(500)
      .json(errorPayload(error, 'Failed to load business partner details.'));
  }
};

const getInventoryTransferRequests = async (_req, res) => {
  try {
    res.json(await inventoryTransferRequestService.getInventoryTransferRequests());
  } catch (error) {
    res
      .status(500)
      .json(errorPayload(error, 'Failed to load inventory transfer requests.'));
  }
};

const getInventoryTransferRequest = async (req, res) => {
  try {
    res.json(
      await inventoryTransferRequestService.getInventoryTransferRequest(req.params.docEntry)
    );
  } catch (error) {
    res
      .status(500)
      .json(errorPayload(error, 'Failed to load inventory transfer request.'));
  }
};

const createInventoryTransferRequest = async (req, res) => {
  try {
    res.json(await inventoryTransferRequestService.createInventoryTransferRequest(req.body));
  } catch (error) {
    res
      .status(500)
      .json(errorPayload(error, 'Failed to create Inventory Transfer Request.'));
  }
};

const updateInventoryTransferRequest = async (req, res) => {
  try {
    res.json(
      await inventoryTransferRequestService.updateInventoryTransferRequest(
        req.params.docEntry,
        req.body
      )
    );
  } catch (error) {
    res
      .status(500)
      .json(errorPayload(error, 'Failed to update Inventory Transfer Request.'));
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
