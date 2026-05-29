const express = require('express');
const predefinedTextController = require('../controllers/predefinedTextController');

const router = express.Router();

router.get('/', predefinedTextController.getPredefinedTexts);
router.post('/', predefinedTextController.createPredefinedText);

module.exports = router;
