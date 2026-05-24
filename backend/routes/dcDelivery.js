const express = require('express');
const deliveryController = require('../controllers/dcDeliveryController');

const router = express.Router();

// DC Delivery is a separate menu/route copy of Delivery. It reuses the same
// Delivery controller so SAP document behavior stays identical.
router.get('/items-modal', deliveryController.getItemsForModal);
router.get('/uom-conversion', deliveryController.getUomConversionFactor);
router.get('/reference-data', deliveryController.getReferenceData);

router.get('/customers/search', deliveryController.getCustomerFilterOptions);
router.get('/customers/:customerCode', deliveryController.getCustomerDetails);

router.post('/sales-employees/setup', deliveryController.saveSalesEmployeesSetup);

router.get('/series', deliveryController.getDocumentSeries);
router.get('/series/:series/next-number', deliveryController.getNextNumber);

router.get('/warehouse-state/:whsCode', deliveryController.getStateFromWarehouse);
router.get('/warehouse/:whsCode/state', deliveryController.getStateFromWarehouse);

router.get('/open-sales-orders', deliveryController.getOpenSalesOrders);
router.get('/sales-order/:docEntry/copy', deliveryController.getSalesOrderForCopy);
router.get('/sales-orders/open', deliveryController.getOpenSalesOrders);
router.get('/sales-orders/:docEntry/copy', deliveryController.getSalesOrderForCopy);

router.get('/delivery/:docEntry/copy-to-credit-memo', deliveryController.getDeliveryForCopyToCreditMemo);

router.get('/batches', deliveryController.getBatchesByItem);
router.get('/freight-charges', deliveryController.getFreightCharges);
router.post('/lookup-values', deliveryController.createLookupValue);
router.post('/validate', deliveryController.validateDelivery);

router.get('/list', deliveryController.getDeliveries);
router.get('/', deliveryController.getDeliveries);
router.get('/:docEntry', deliveryController.getDeliveryByDocEntry);

router.post('/', deliveryController.submitDelivery);
router.patch('/:docEntry', deliveryController.updateDelivery);

module.exports = router;
