const express = require('express');
const inventoryTransferRequestController = require('../controllers/inventoryTransferRequestController');

const router = express.Router();

router.get('/metadata', inventoryTransferRequestController.getMetadata);
router.get('/items', inventoryTransferRequestController.getItems);
router.get('/warehouses', inventoryTransferRequestController.getWarehouses);
router.get('/series', inventoryTransferRequestController.getSeries);
router.get(
  '/business-partners/:cardCode',
  inventoryTransferRequestController.getBusinessPartnerDetails
);
router.get('/list', inventoryTransferRequestController.getInventoryTransferRequests);
router.get('/:docEntry', inventoryTransferRequestController.getInventoryTransferRequest);
router.post('/', inventoryTransferRequestController.createInventoryTransferRequest);
router.patch('/:docEntry', inventoryTransferRequestController.updateInventoryTransferRequest);

module.exports = router;
