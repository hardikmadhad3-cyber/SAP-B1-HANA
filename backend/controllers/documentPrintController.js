const documentPrintLayoutService = require('../services/documentPrintLayoutService');

const getErrorPayload = (error, fallbackMessage) => {
  const message =
    error.response?.data?.error?.message?.value ||
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    error.response?.data?.detail ||
    error.message ||
    fallbackMessage;

  return {
    message,
    detail: message,
  };
};

const getLayouts = async (req, res) => {
  try {
    const data = await documentPrintLayoutService.getLayouts(req.params.documentType);
    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to load document print layouts.'));
  }
};

const printDocument = async (req, res) => {
  try {
    const data = await documentPrintLayoutService.printDocument({
      documentType: req.params.documentType,
      docEntry: req.body?.docEntry,
      docNum: req.body?.docNum,
      schema: req.body?.schema,
      docCode: req.body?.docCode || req.body?.layoutCode,
      auth: req.auth,
    });

    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to generate document PDF.'));
  }
};

const downloadPdf = printDocument;

const downloadAllLayouts = async (req, res) => {
  try {
    const data = await documentPrintLayoutService.downloadAllLayouts({
      documentType: req.params.documentType,
      docEntry: req.body?.docEntry,
      docNum: req.body?.docNum,
      schema: req.body?.schema,
      auth: req.auth,
    });

    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to download all document layouts.'));
  }
};

module.exports = {
  getLayouts,
  printDocument,
  downloadPdf,
  downloadAllLayouts,
};
