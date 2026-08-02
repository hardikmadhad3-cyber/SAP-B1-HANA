const journalEntryService = require('../services/journalEntryService');

const getErrorPayload = (error, fallbackMessage) => ({
  message: error.message || fallbackMessage,
  detail: error.response?.data || null,
});

const generateFromARInvoice = async (req, res) => {
  try {
    const docEntry = req.body?.docEntry || req.body?.DocEntry || null;
    const payload = req.body?.payload || (!docEntry ? req.body : null);
    const persist = Boolean(req.body?.persist || req.body?.createJournalEntry);
    const journalEntry = await journalEntryService.generateFromServiceARInvoice({
      docEntry,
      payload,
      persist,
    });
    res.json(journalEntry);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to generate Journal Entry.'));
  }
};

const generateFromAPInvoice = async (req, res) => {
  try {
    const docEntry = req.body?.docEntry || req.body?.DocEntry || null;
    const payload = req.body?.payload || (!docEntry ? req.body : null);
    const persist = Boolean(req.body?.persist || req.body?.createJournalEntry);
    const journalEntry = await journalEntryService.generateFromServiceAPInvoice({
      docEntry,
      payload,
      persist,
    });
    res.json(journalEntry);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to generate Journal Entry.'));
  }
};

const generateFromAPCreditMemo = async (req, res) => {
  try {
    const docEntry = req.body?.docEntry || req.body?.DocEntry || null;
    const payload = req.body?.payload || (!docEntry ? req.body : null);
    const persist = Boolean(req.body?.persist || req.body?.createJournalEntry);
    const journalEntry = await journalEntryService.generateFromServiceAPCreditMemo({
      docEntry,
      payload,
      persist,
    });
    res.json(journalEntry);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to generate Journal Entry.'));
  }
};

const generateFromARCreditMemo = async (req, res) => {
  try {
    const docEntry = req.body?.docEntry || req.body?.DocEntry || null;
    const payload = req.body?.payload || (!docEntry ? req.body : null);
    const persist = Boolean(req.body?.persist || req.body?.createJournalEntry);
    const journalEntry = await journalEntryService.generateFromServiceARCreditMemo({
      docEntry,
      payload,
      persist,
    });
    res.json(journalEntry);
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to generate Journal Entry.'));
  }
};

const previewJournalEntry = async (req, res) => {
  try {
    const result = await journalEntryService.previewJournalEntry(req.body || {});
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json(getErrorPayload(error, 'Failed to preview Journal Entry.'));
  }
};

const createManualJournalEntry = async (req, res) => {
  try {
    const result = await journalEntryService.createManualJournalEntry(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to add Journal Entry.'));
  }
};

const getJournalEntryByTransId = async (req, res) => {
  try {
    res.json(await journalEntryService.getJournalEntryByTransId(req.params.transId));
  } catch (error) {
    res.status(error.status || 500).json(getErrorPayload(error, 'Failed to load Journal Entry.'));
  }
};

const getReferenceData = async (_req, res) => {
  try {
    res.json(await journalEntryService.getJournalEntryReferenceData({
      postingDate: _req.query?.postingDate || '',
    }));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load Journal Entry reference data.'));
  }
};

const getRemarkTemplates = async (req, res) => {
  try {
    res.json(await journalEntryService.getJournalRemarkTemplates(req.query?.query || ''));
  } catch (error) {
    res.status(500).json(getErrorPayload(error, 'Failed to load SAP remark templates.'));
  }
};

module.exports = {
  previewJournalEntry,
  generateFromARInvoice,
  generateFromAPInvoice,
  generateFromAPCreditMemo,
  generateFromARCreditMemo,
  createManualJournalEntry,
  getJournalEntryByTransId,
  getReferenceData,
  getRemarkTemplates,
};
