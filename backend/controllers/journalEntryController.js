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

const createManualJournalEntry = async (req, res) => {
  try {
    const result = await journalEntryService.createManualJournalEntry(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(getErrorPayload(error, 'Failed to add Journal Entry.'));
  }
};

module.exports = {
  generateFromARInvoice,
  generateFromAPInvoice,
  createManualJournalEntry,
};
