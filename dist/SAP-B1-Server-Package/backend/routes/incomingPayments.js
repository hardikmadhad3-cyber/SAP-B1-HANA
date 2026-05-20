const express = require("express");
const incomingPaymentsController = require("../controllers/incomingPaymentsController");

const router = express.Router();

router.post("/", incomingPaymentsController.createIncomingPayment);
router.get("/reference-data", incomingPaymentsController.getReferenceData);
router.get("/business-partners", incomingPaymentsController.searchBusinessPartners);
router.get("/control-accounts", incomingPaymentsController.lookupControlAccounts);
router.get("/cash-accounts", incomingPaymentsController.lookupCashAccounts);
router.get("/documents", incomingPaymentsController.searchIncomingPayments);
router.get("/open-invoices", incomingPaymentsController.getOpenInvoices);

module.exports = router;
