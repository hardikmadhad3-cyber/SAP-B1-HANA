import apiClient from './client';

const buildDocumentPrintUrl = (documentType, action) =>
  `/document-print/${encodeURIComponent(documentType)}/${action}`;

export const fetchDocumentLayouts = (documentType) =>
  apiClient.get(buildDocumentPrintUrl(documentType, 'layouts'));

export const fetchDocumentReportMetadata = ({
  documentType,
  docEntry,
  docNum,
  series,
  schema,
  docCode,
  layoutCode,
  cardCode,
}) =>
  apiClient.get(`/sap/reports/${encodeURIComponent(documentType)}/${encodeURIComponent(docEntry)}/metadata`, {
    params: {
      docNum,
      series,
      schema,
      docCode: docCode || layoutCode,
      cardCode,
    },
  });

export const fetchDocumentLayoutParameters = ({
  documentType,
  docCode,
  layoutCode,
  schema,
}) =>
  apiClient.get(buildDocumentPrintUrl(documentType, 'parameters'), {
    params: {
      docCode: docCode || layoutCode,
      schema,
    },
  });

export const printDocumentLayout = ({
  documentType,
  docEntry,
  docNum,
  series,
  schema,
  cardCode,
  docCode,
  layoutCode,
  layoutName,
  reportParameters,
}) =>
  apiClient.post(buildDocumentPrintUrl(documentType, 'print'), {
    docEntry,
    docNum,
    series,
    schema,
    cardCode,
    docCode: docCode || layoutCode,
    layoutName,
    reportParameters,
  });

export const downloadDocumentLayoutPdf = ({
  documentType,
  docEntry,
  docNum,
  series,
  schema,
  cardCode,
  docCode,
  layoutCode,
  layoutName,
  reportParameters,
}) =>
  apiClient.post(buildDocumentPrintUrl(documentType, 'download-pdf'), {
    docEntry,
    docNum,
    series,
    schema,
    cardCode,
    docCode: docCode || layoutCode,
    layoutName,
    reportParameters,
  });

export const downloadAllDocumentLayouts = ({
  documentType,
  docEntry,
  docNum,
  series,
  schema,
  cardCode,
}) =>
  apiClient.post(buildDocumentPrintUrl(documentType, 'download-all-layouts'), {
    docEntry,
    docNum,
    series,
    schema,
    cardCode,
  });
