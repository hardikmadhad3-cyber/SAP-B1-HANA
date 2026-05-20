const express = require("express");
const outgoingPaymentsController = require("../controllers/outgoingPaymentsController");

const router = express.Router();

router.post("/", outgoingPaymentsController.createOutgoingPayment);
router.get("/reference-data", outgoingPaymentsController.getReferenceData);
router.get("/business-partners", outgoingPaymentsController.searchBusinessPartners);
router.get("/control-accounts", outgoingPaymentsController.lookupControlAccounts);
router.get("/cash-accounts", outgoingPaymentsController.lookupCashAccounts);
router.get("/documents", outgoingPaymentsController.searchOutgoingPayments);
router.get("/open-invoices", outgoingPaymentsController.getOpenInvoices);

module.exports = router;
