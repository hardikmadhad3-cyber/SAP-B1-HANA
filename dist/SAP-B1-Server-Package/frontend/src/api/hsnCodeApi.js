import apiClient from './client';

/**
 * Get all HSN Codes from SAP B1 via ODBC
 * @param {string} query - Optional search query
 * @returns {Promise} Array of HSN codes
 */
export const fetchHSNCodes = async (query = '') => {
  const params = query ? { query } : {};
  return apiClient.get('/hsn-codes', { params });
};

/**
 * Get single HSN Code by ChapterID via ODBC
 * @param {string} code - HSN Code (ChapterID)
 * @returns {Promise} HSN code details
 */
export const fetchHSNCode = async (code) => {
  return apiClient.get(`/hsn-codes/${code}`);
};

/**
 * Get HSN Code from Item Master via ODBC
 * @param {string} itemCode - Item Code
 * @returns {Promise} HSN code from item
 */
export const fetchHSNCodeFromItem = async (itemCode) => {
  return apiClient.get(`/hsn-codes/item/${itemCode}`);
};
