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

const printSalesOrder = async (req, res) => {
  try {
    const { docEntry, docNum, series, schema, docCode, cardCode } = req.body || {};

    const data = await documentPrintLayoutService.printDocument({
      documentType: 'salesOrder',
      docEntry,
      docNum,
      series,
      schema,
      docCode,
      cardCode,
      auth: req.auth,
    });

    res.json(data);
  } catch (error) {
    const statusCode = error.statusCode || error.response?.status || 500;
    res.status(statusCode).json(getErrorPayload(error, 'Failed to generate sales order PDF.'));
  }
};

module.exports = {
  printSalesOrder,
};
