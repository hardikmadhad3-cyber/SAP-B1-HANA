const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/productionOrderController');

// Lookups (before /:docEntry)
router.get('/lookup/items',              ctrl.lookupItems);
router.get('/lookup/component-items',    ctrl.lookupComponentItems);
router.get('/lookup/resources',          ctrl.lookupResources);
router.get('/lookup/route-stages',       ctrl.lookupRouteStages);
router.get('/lookup/warehouses',         ctrl.lookupWarehouses);
router.get('/lookup/distribution-rules', ctrl.lookupDistributionRules);
router.get('/lookup/projects',           ctrl.lookupProjects);
router.get('/lookup/branches',           ctrl.lookupBranches);
router.get('/lookup/customers',          ctrl.lookupCustomers);

// Reference data
router.get('/reference-data', ctrl.getReferenceData);

// BOM explosion
router.get('/bom-explode/:itemCode', ctrl.explodeBOM);

// CRUD
router.get('/list',         ctrl.getProductionOrders);
router.get('/:docEntry',    ctrl.getProductionOrderByDocEntry);
router.post('/',            ctrl.createProductionOrder);
router.patch('/:docEntry',  ctrl.updateProductionOrder);
router.post('/:docEntry/release', ctrl.releaseProductionOrder);
router.post('/:docEntry/close', ctrl.closeProductionOrder);

module.exports = router;
