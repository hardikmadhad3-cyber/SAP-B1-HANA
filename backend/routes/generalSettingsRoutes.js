const express = require('express');
const generalSettingsController = require('../controllers/generalSettingsController');

const router = express.Router();

router.get('/', generalSettingsController.getAssignedSettings);

module.exports = router;
