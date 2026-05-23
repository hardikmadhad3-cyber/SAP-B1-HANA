const express = require('express');
const formSettingsController = require('../controllers/formSettingsController');

const router = express.Router();

router.get('/:formKey', formSettingsController.getFormSettings);
router.put('/:formKey', formSettingsController.saveFormSettings);

module.exports = router;
