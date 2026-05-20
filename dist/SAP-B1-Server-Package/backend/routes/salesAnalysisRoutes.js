const express = require('express');
const {
  getCustomerSalesAnalysisReport,
  getCustomerSalesAnalysisDetailReport,
  getItemSalesAnalysisReport,
  getSalesEmployeeSalesAnalysisReport,
} = require('../controllers/salesAnalysisController');

const router = express.Router();

router.post('/sales-analysis/customers', getCustomerSalesAnalysisReport);
router.post('/sales-analysis/customers/:customerCode/detail', getCustomerSalesAnalysisDetailReport);
router.post('/sales-analysis/items', getItemSalesAnalysisReport);
router.post('/sales-analysis/sales-employees', getSalesEmployeeSalesAnalysisReport);

module.exports = router;
