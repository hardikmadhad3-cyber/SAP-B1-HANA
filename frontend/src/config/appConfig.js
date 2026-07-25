const getDefaultApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:5001/api`;
  }

  return 'http://localhost:5001/api';
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || getDefaultApiBaseUrl();
const PURCHASE_ORDER_COMPANY_ID = process.env.REACT_APP_PURCHASE_ORDER_COMPANY_ID || '1';
const PURCHASE_REQUEST_COMPANY_ID = process.env.REACT_APP_PURCHASE_REQUEST_COMPANY_ID || '1';
const SALES_ORDER_COMPANY_ID = process.env.REACT_APP_SALES_ORDER_COMPANY_ID || '1';
const AR_INVOICE_COMPANY_ID = process.env.REACT_APP_AR_INVOICE_COMPANY_ID || '1';

export {
  API_BASE_URL,
  PURCHASE_ORDER_COMPANY_ID,
  PURCHASE_REQUEST_COMPANY_ID,
  SALES_ORDER_COMPANY_ID,
  AR_INVOICE_COMPANY_ID,
};
