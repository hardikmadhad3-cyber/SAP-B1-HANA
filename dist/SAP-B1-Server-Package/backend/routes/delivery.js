const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');

// ⚠️ IMPORTANT: Specific routes MUST come before dynamic routes like /:docEntry

// Items modal (must be before /:docEntry)
router.get('/items-modal', deliveryController.getItemsForModal);

// UoM conversion factor (must be before /:docEntry)
router.get('/uom-conversion', deliveryController.getUomConversionFactor);

// Reference data
router.get('/reference-data', deliveryController.getReferenceData);

// Customer details
router.get('/customers/search', deliveryController.getCustomerFilterOptions);
router.get('/customers/:customerCode', deliveryController.getCustomerDetails);

// Sales employees setup
router.post('/sales-employees/setup', deliveryController.saveSalesEmployeesSetup);

// Document series
router.get('/series', deliveryController.getDocumentSeries);
router.get('/series/:series/next-number', deliveryController.getNextNumber);

// State from warehouse
router.get('/warehouse-state/:whsCode', deliveryController.getStateFromWarehouse);
router.get('/warehouse/:whsCode/state', deliveryController.getStateFromWarehouse);

// Sales orders (for copy from)
router.get('/open-sales-orders', deliveryController.getOpenSalesOrders);
router.get('/sales-order/:docEntry/copy', deliveryController.getSalesOrderForCopy);
router.get('/sales-orders/open', deliveryController.getOpenSalesOrders);
router.get('/sales-orders/:docEntry/copy', deliveryController.getSalesOrderForCopy);

// Delivery for copy to credit memo (must be before /:docEntry)
router.get('/delivery/:docEntry/copy-to-credit-memo', deliveryController.getDeliveryForCopyToCreditMemo);

// Batches
router.get('/batches', deliveryController.getBatchesByItem);

// Freight charges
router.get('/freight-charges', deliveryController.getFreightCharges);

// Lookup values
router.post('/lookup-values', deliveryController.createLookupValue);

// Validation
router.post('/validate', deliveryController.validateDelivery);

// Delivery list
router.get('/list', deliveryController.getDeliveries);
router.get('/', deliveryController.getDeliveries);

// Get single delivery (must be last GET route)
router.get('/:docEntry', deliveryController.getDeliveryByDocEntry);

// Submit new delivery
router.post('/', deliveryController.submitDelivery);

// Update existing delivery
router.patch('/:docEntry', deliveryController.updateDelivery);

module.exports = router;
