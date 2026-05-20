const express = require('express');
const blanketAgreementController = require('../controllers/blanketAgreementController');

const router = express.Router();

router.get('/open', blanketAgreementController.getOpenBlanketAgreements);
router.get('/:docEntry/copy', blanketAgreementController.getBlanketAgreementForCopy);

module.exports = router;
