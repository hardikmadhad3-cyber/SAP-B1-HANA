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

const getLayoutParameters = async (req, res) => {
  try {
    const data = await documentPrintLayoutService.getLayoutParameters({
      documentType: req.params.documentType,
      docCode: req.query?.docCode || req.query?.layoutCode,
      schema: req.query?.schema,
      auth: req.auth,
    });
    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to load document print parameters.'));
  }
};

const getReportMetadata = async (req, res) => {
  try {
    const data = await documentPrintLayoutService.getDocumentReportMetadata({
      documentType: req.params.documentType,
      docEntry: req.params.docEntry || req.query?.docEntry,
      docNum: req.query?.docNum,
      series: req.query?.series,
      schema: req.query?.schema,
      docCode: req.query?.docCode || req.query?.layoutCode,
      cardCode: req.query?.cardCode,
      auth: req.auth,
    });
    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to resolve SAP B1 report metadata.'));
  }
};

const printDocument = async (req, res) => {
  try {
    const data = await documentPrintLayoutService.printDocument({
      documentType: req.params.documentType,
      docEntry: req.body?.docEntry,
      docNum: req.body?.docNum,
      series: req.body?.series,
      schema: req.body?.schema,
      docCode: req.body?.docCode || req.body?.layoutCode,
      cardCode: req.body?.cardCode,
      reportParameters: req.body?.reportParameters,
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
      series: req.body?.series,
      schema: req.body?.schema,
      cardCode: req.body?.cardCode,
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
  getLayoutParameters,
  getReportMetadata,
  printDocument,
  downloadPdf,
  downloadAllLayouts,
};
