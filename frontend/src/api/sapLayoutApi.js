import apiClient from './client';

const getDocumentLayout = ({ companyDb, userCode, documentType }) =>
  apiClient.get('/sap/layout/document', {
    params: { companyDb, userCode, documentType },
  });

const importDocumentLayout = (payload) =>
  apiClient.post('/sap/layout/import', payload);

const syncDocumentLayoutUdfs = (payload) =>
  apiClient.post('/sap/layout/sync-udfs', payload);

export {
  getDocumentLayout,
  importDocumentLayout,
  syncDocumentLayoutUdfs,
};
