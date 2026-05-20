const express = require('express');
const printController = require('../controllers/printController');

const router = express.Router();

router.post('/print-sales-order', printController.printSalesOrder);

module.exports = router;
