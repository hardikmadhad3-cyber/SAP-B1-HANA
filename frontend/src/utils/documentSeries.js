export const SAP_MANUAL_SERIES_VALUE = '-1';

export const isManualDocumentSeries = (value) => (
  String(value ?? '').trim().toLowerCase() === SAP_MANUAL_SERIES_VALUE
  || String(value ?? '').trim().toLowerCase() === 'manual'
);

export const isValidManualDocumentNumber = (value) => (
  /^[1-9]\d*$/.test(String(value ?? '').trim())
);
