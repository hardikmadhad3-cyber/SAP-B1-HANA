import apiClient from './client';

const DOCUMENT_OBJECT_TYPES = {
  SALES_ORDER: '17',
  SALES_QUOTATION: '23',
  DELIVERY: '15',
  AR_INVOICE: '13',
  AR_CREDIT_MEMO: '14',
  PURCHASE_REQUEST: '1470000113',
  PURCHASE_QUOTATION: '540000006',
  PURCHASE_ORDER: '22',
  GRPO: '20',
  SERVICE_AR_INVOICE: '13',
  SERVICE_AP_INVOICE: '18',
};

const getDocumentLayout = ({ companyDb, userCode, documentType, objectType }) => {
  const resolvedDocumentType = String(documentType || '').trim().toUpperCase() || undefined;
  const resolvedObjectType = String(objectType || DOCUMENT_OBJECT_TYPES[resolvedDocumentType] || '').trim() || undefined;

  return apiClient.get('/sap/layout/document', {
    params: {
      companyDb,
      userCode,
      documentType: resolvedDocumentType,
      objectType: resolvedObjectType,
    },
  });
};

const importDocumentLayout = (payload) =>
  apiClient.post('/sap/layout/import', payload);

const syncDocumentLayoutUdfs = (payload) =>
  apiClient.post('/sap/layout/sync-udfs', payload);

export {
  getDocumentLayout,
  importDocumentLayout,
  syncDocumentLayoutUdfs,
};
