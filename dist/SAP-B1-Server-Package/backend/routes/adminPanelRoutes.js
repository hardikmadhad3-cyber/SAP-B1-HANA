const express = require('express');
const adminPanelController = require('../controllers/adminPanelController');
const { requireAdminPanelAccess } = require('../middleware/adminPanelAccess');

const router = express.Router();

router.use(requireAdminPanelAccess);

router.get('/entities', adminPanelController.listEntities);
router.get('/:entityKey/bootstrap', adminPanelController.getEntityBootstrap);
router.post('/:entityKey', adminPanelController.createRecord);
router.put('/:entityKey/:recordId', adminPanelController.updateRecord);
router.delete('/:entityKey/:recordId', adminPanelController.deleteRecord);

module.exports = router;
