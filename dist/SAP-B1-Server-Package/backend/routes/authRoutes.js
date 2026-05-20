const express = require('express');
const authController = require('../controllers/authController');
const { authenticatePendingOrAccessToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', authController.login);
router.get('/companies-public', authController.getActiveCompanies);
router.get('/companies/:userId', authenticatePendingOrAccessToken, authController.getCompanies);
router.post('/select-company', authenticatePendingOrAccessToken, authController.selectCompany);

module.exports = router;
