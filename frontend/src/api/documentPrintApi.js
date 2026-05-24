import apiClient from './client';

const buildDocumentPrintUrl = (documentType, action) =>
  `/document-print/${encodeURIComponent(documentType)}/${action}`;

export const fetchDocumentLayouts = (documentType) =>
  apiClient.get(buildDocumentPrintUrl(documentType, 'layouts'));

export const printDocumentLayout = ({
  documentType,
  docEntry,
  docNum,
  schema,
  cardCode,
  docCode,
  layoutCode,
  layoutName,
}) =>
  apiClient.post(buildDocumentPrintUrl(documentType, 'print'), {
    docEntry,
    docNum,
    schema,
    cardCode,
    docCode: docCode || layoutCode,
    layoutName,
  });

export const downloadDocumentLayoutPdf = ({
  documentType,
  docEntry,
  docNum,
  schema,
  cardCode,
  docCode,
  layoutCode,
  layoutName,
}) =>
  apiClient.post(buildDocumentPrintUrl(documentType, 'download-pdf'), {
    docEntry,
    docNum,
    schema,
    cardCode,
    docCode: docCode || layoutCode,
    layoutName,
  });

export const downloadAllDocumentLayouts = ({
  documentType,
  docEntry,
  docNum,
  schema,
  cardCode,
}) =>
  apiClient.post(buildDocumentPrintUrl(documentType, 'download-all-layouts'), {
    docEntry,
    docNum,
    schema,
    cardCode,
  });
