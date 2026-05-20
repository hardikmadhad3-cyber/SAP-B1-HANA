/**
 * Enhanced Item API with better error handling and validation
 */
import apiClient from "../../../api/client";
import { validateItemForm } from '../validation/itemValidation';

// Base API functions (existing)
export const createItem = (data) =>
  apiClient.post("/items/create", data).then((r) => r.data);

export const generateItemCode = (prefix) =>
  apiClient.get("/items/generate-code", { params: { prefix } }).then((r) => r.data);

export const checkItemCodeExists = (itemCode) =>
  apiClient.get(`/items/check-exists/${encodeURIComponent(itemCode)}`).then((r) => r.data);

export const getItem = (itemCode) =>
  apiClient.get(`/items/${encodeURIComponent(itemCode)}`).then((r) => r.data);

export const updateItem = (itemCode, data) =>
  apiClient.patch(`/items/${encodeURIComponent(itemCode)}`, data).then((r) => r.data);

export const searchItems = (query = "", top = 50, skip = 0) =>
  apiClient.get("/items/search", { params: { query, top, skip } }).then((r) => r.data);

// Lookup helpers
export const fetchItemGroups = (query = "") =>
  apiClient.get("/items/lookup/item-groups", { params: { query } }).then((r) => r.data);

export const createItemGroup = (data) =>
  apiClient.post("/items/lookup/item-groups", data).then((r) => r.data);

export const fetchManufacturers = (query = "") =>
  apiClient.get("/items/lookup/manufacturers", { params: { query } }).then((r) => r.data);

export const fetchHSNCodes = (query = "") =>
  apiClient.get("/items/lookup/hsn-codes", { params: { query } }).then((r) => r.data);

export const createManufacturer = (data) =>
  apiClient.post("/items/lookup/manufacturers", data).then((r) => r.data);

export const fetchVendors = (query = "") =>
  apiClient.get("/items/lookup/vendors", { params: { query } }).then((r) => r.data);

export const fetchWarehouses = (query = "") =>
  apiClient.get("/items/lookup/warehouses", { params: { query } }).then((r) => r.data);

export const fetchUoMGroups = (query = "") =>
  apiClient.get("/items/lookup/uom-groups", { params: { query } }).then((r) => r.data);

export const fetchItemProperties = () =>
  apiClient.get("/items/lookup/item-properties").then((r) => r.data);

export const fetchGLAccounts = (query = "") =>
  apiClient.get("/items/lookup/gl-accounts", { params: { query } }).then((r) => r.data);

export const fetchPriceLists = (query = "") =>
  apiClient.get("/items/lookup/price-lists", { params: { query } }).then((r) => r.data);

export const fetchItemCodePrefixes = () =>
  apiClient.get("/items/lookup/item-code-prefixes").then((r) => r.data);

// Per-item data
export const getItemPrices = (itemCode) =>
  apiClient.get(`/items/${encodeURIComponent(itemCode)}/prices`).then((r) => r.data);

export const getItemStock = (itemCode) =>
  apiClient.get(`/items/${encodeURIComponent(itemCode)}/stock`).then((r) => r.data);

export const uploadAttachment = (itemCode, formData) =>
  apiClient.post(`/items/${encodeURIComponent(itemCode)}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

export const deleteAttachment = (itemCode, attachmentId) =>
  apiClient.delete(`/items/${encodeURIComponent(itemCode)}/attachments/${attachmentId}`).then((r) => r.data);

// Enhanced functions with client-side validation
export const createItemWithValidation = async (formData, prices = [], barcodes = [], uoms = [], prefVendors = []) => {
  // Client-side validation first
  const validationErrors = validateItemForm(formData, false);
  if (validationErrors.length > 0) {
    throw new Error(`Validation Error: ${validationErrors[0]}`);
  }
  
  try {
    const result = await createItem(formData);
    return result;
  } catch (error) {
    // Enhance error messages for better UX
    if (error.response?.status === 400) {
      const message = error.response.data?.message || 'Validation failed';
      throw new Error(`Validation Error: ${message}`);
    } else if (error.response?.status === 409) {
      throw new Error('Duplicate Item: An item with this code already exists.');
    } else if (error.response?.status >= 500) {
      throw new Error('Server Error: Unable to create item. Please try again later.');
    }
    throw error;
  }
};

export const updateItemWithValidation = async (itemCode, formData, prices = [], barcodes = [], uoms = [], prefVendors = []) => {
  // Client-side validation first
  const validationErrors = validateItemForm(formData, true);
  if (validationErrors.length > 0) {
    throw new Error(`Validation Error: ${validationErrors[0]}`);
  }
  
  try {
    const result = await updateItem(itemCode, formData);
    return result;
  } catch (error) {
    // Enhance error messages for better UX
    if (error.response?.status === 400) {
      const message = error.response.data?.message || 'Validation failed';
      throw new Error(`Validation Error: ${message}`);
    } else if (error.response?.status === 404) {
      throw new Error('Not Found: Item not found or may have been deleted.');
    } else if (error.response?.status >= 500) {
      throw new Error('Server Error: Unable to update item. Please try again later.');
    }
    throw error;
  }
};

// Batch validation for multiple items
export const validateMultipleItems = (items) => {
  const results = items.map((item, index) => {
    const errors = validateItemForm(item, !!item.ItemCode);
    return {
      index,
      itemCode: item.ItemCode || `Item ${index + 1}`,
      errors,
      isValid: errors.length === 0
    };
  });
  
  return {
    results,
    allValid: results.every(r => r.isValid),
    invalidItems: results.filter(r => !r.isValid)
  };
};

// Enhanced search with filtering
export const searchItemsAdvanced = async (filters = {}, top = 50, skip = 0) => {
  const params = { top, skip, ...filters };
  
  try {
    const response = await apiClient.get("/items/search", { params });
    return response.data;
  } catch (error) {
    if (error.response?.status >= 500) {
      throw new Error('Server Error: Unable to search items. Please try again later.');
    }
    throw error;
  }
};

// Item duplication check
export const checkItemDuplication = async (itemData) => {
  const checks = [];
  
  // Check by item code
  if (itemData.ItemCode) {
    try {
      const exists = await checkItemCodeExists(itemData.ItemCode);
      checks.push({ type: 'code', value: itemData.ItemCode, exists: exists.exists });
    } catch (error) {
      checks.push({ type: 'code', value: itemData.ItemCode, exists: false, error: error.message });
    }
  }
  
  // Check by item name (optional enhancement)
  if (itemData.ItemName) {
    try {
      const results = await searchItems(itemData.ItemName, 5, 0);
      const exactMatch = results.find(item => 
        item.ItemName.toLowerCase() === itemData.ItemName.toLowerCase()
      );
      checks.push({ 
        type: 'name', 
        value: itemData.ItemName, 
        exists: !!exactMatch,
        duplicateItem: exactMatch || null
      });
    } catch (error) {
      checks.push({ type: 'name', value: itemData.ItemName, exists: false, error: error.message });
    }
  }
  
  return checks;
};

// Export all functions
const itemApiEnhanced = {
  // Basic functions
  createItem,
  generateItemCode,
  checkItemCodeExists,
  getItem,
  updateItem,
  searchItems,
  
  // Lookup functions
  fetchItemGroups,
  createItemGroup,
  fetchManufacturers,
  fetchHSNCodes,
  createManufacturer,
  fetchVendors,
  fetchWarehouses,
  fetchUoMGroups,
  fetchItemProperties,
  fetchGLAccounts,
  fetchPriceLists,
  fetchItemCodePrefixes,
  
  // Per-item data
  getItemPrices,
  getItemStock,
  uploadAttachment,
  deleteAttachment,
  
  // Enhanced functions
  createItemWithValidation,
  updateItemWithValidation,
  validateMultipleItems,
  searchItemsAdvanced,
  checkItemDuplication,
};

export default itemApiEnhanced;
