const express = require('express');
const reportLayoutController = require('../controllers/reportLayoutController');

const router = express.Router();

/*  */router.get('/reports', reportLayoutController.listReports);
router.get('/reports/fields', reportLayoutController.getReportFields);

router.get('/layout-manager/catalog', reportLayoutController.listManagerCatalog);
router.get('/layout-manager/search', reportLayoutController.searchManagerCatalog);
router.post('/layout-manager/menu-entries', reportLayoutController.createMenuEntry);
router.put('/layout-manager/menu-entries/:id', reportLayoutController.updateMenuEntry);
router.delete('/layout-manager/menu-entries/:id', reportLayoutController.deleteMenuEntry);

router.get('/layouts', reportLayoutController.listLayouts);
router.post('/layouts', reportLayoutController.createLayout);
router.put('/layouts/:id', reportLayoutController.updateLayout);
router.delete('/layouts/:id', reportLayoutController.deleteLayout);
router.post('/layouts/set-default', reportLayoutController.setDefaultLayout);
router.post('/layouts/preview', reportLayoutController.previewLayout);
router.post('/layouts/:id/copy', reportLayoutController.copyLayout);
router.get('/layouts/:id/versions', reportLayoutController.getLayoutVersions);

module.exports = router;
