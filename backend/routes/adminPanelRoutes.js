const express = require('express');
const adminPanelController = require('../controllers/adminPanelController');
const generalSettingsController = require('../controllers/generalSettingsController');
const { requireAdminPanelAccess } = require('../middleware/adminPanelAccess');

const router = express.Router();

router.use(requireAdminPanelAccess);

router.get('/entities', adminPanelController.listEntities);
router.get('/general-settings/bootstrap', generalSettingsController.getAdminBootstrap);
router.get('/general-settings/options', generalSettingsController.getAdminOptions);
router.get('/general-settings', generalSettingsController.getAdminSettings);
router.put('/general-settings', generalSettingsController.saveAdminSettings);
router.get('/:entityKey/bootstrap', adminPanelController.getEntityBootstrap);
router.post('/:entityKey', adminPanelController.createRecord);
router.put('/:entityKey/:recordId', adminPanelController.updateRecord);
router.delete('/:entityKey/:recordId', adminPanelController.deleteRecord);

module.exports = router;
