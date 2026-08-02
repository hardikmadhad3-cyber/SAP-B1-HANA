const SAP_MANUAL_SERIES = -1;

const isManualDocumentSeries = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === String(SAP_MANUAL_SERIES) || normalized === 'manual';
};

const getManualDocumentNumber = (header = {}) => {
  const rawValue = header.manualDocumentNumber ?? header.nextNumber ?? header.docNo;
  const normalized = String(rawValue ?? '').trim();
  const documentNumber = Number(normalized);

  if (!/^[1-9]\d*$/.test(normalized) || !Number.isSafeInteger(documentNumber)) {
    const error = new Error('Document number must be a positive integer when Series is Manual.');
    error.statusCode = 400;
    throw error;
  }

  return documentNumber;
};

const buildDocumentSeriesPayload = (header = {}) => {
  if (isManualDocumentSeries(header.series)) {
    return {
      Series: SAP_MANUAL_SERIES,
      DocNum: getManualDocumentNumber(header),
    };
  }

  const series = Number(header.series);
  return Number.isSafeInteger(series) && series > 0 ? { Series: series } : {};
};

module.exports = {
  SAP_MANUAL_SERIES,
  isManualDocumentSeries,
  getManualDocumentNumber,
  buildDocumentSeriesPayload,
};
