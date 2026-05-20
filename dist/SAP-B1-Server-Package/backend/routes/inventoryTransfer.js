const express = require('express');
const inventoryTransferController = require('../controllers/inventoryTransferController');

const router = express.Router();

router.get('/metadata', inventoryTransferController.getMetadata);
router.get('/items', inventoryTransferController.getItems);
router.get('/warehouses', inventoryTransferController.getWarehouses);
router.get('/series', inventoryTransferController.getSeries);
router.get(
  '/business-partners/:cardCode',
  inventoryTransferController.getBusinessPartnerDetails
);
router.get('/list', inventoryTransferController.getInventoryTransfers);
router.get('/:docEntry', inventoryTransferController.getInventoryTransfer);
router.post('/', inventoryTransferController.createInventoryTransfer);
router.patch('/:docEntry', inventoryTransferController.updateInventoryTransfer);

module.exports = router;
