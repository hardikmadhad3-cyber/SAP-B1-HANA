const AUTH_SESSION_KEY = 'sap-b1-auth-session';
const ADMIN_AUTH_SESSION_KEY = 'sap-b1-admin-auth-session';
const PENDING_AUTH_KEY = 'sap-b1-pending-auth';
const LAST_COMPANY_PREFIX = 'sap-b1-last-company';
const LAST_COMPANY_INFO_KEY = 'sap-b1-last-company-info';

const getStorage = (storageName) => {
  if (typeof window === 'undefined') return null;

  try {
    return window[storageName] || null;
  } catch (_error) {
    return null;
  }
};

const readJson = (storageName, key) => {
  const storage = getStorage(storageName);
  if (!storage) return null;

  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (_error) {
    return null;
  }
};

const writeJson = (storageName, key, value) => {
  const storage = getStorage(storageName);
  if (!storage) return;
  storage.setItem(key, JSON.stringify(value));
};

const removeItem = (storageName, key) => {
  const storage = getStorage(storageName);
  if (!storage) return;
  storage.removeItem(key);
};

const clearLegacySharedAuth = () => {
  removeItem('localStorage', AUTH_SESSION_KEY);
  removeItem('localStorage', PENDING_AUTH_KEY);
};

export const getAuthSession = () => readJson('sessionStorage', AUTH_SESSION_KEY);
export const setAuthSession = (session) => {
  clearLegacySharedAuth();
  writeJson('sessionStorage', AUTH_SESSION_KEY, session);
};
export const clearAuthSession = () => {
  removeItem('sessionStorage', AUTH_SESSION_KEY);
  clearLegacySharedAuth();
};

export const getPendingAuth = () => readJson('sessionStorage', PENDING_AUTH_KEY);
export const setPendingAuth = (pendingAuth) => {
  clearLegacySharedAuth();
  writeJson('sessionStorage', PENDING_AUTH_KEY, pendingAuth);
};
export const clearPendingAuth = () => {
  removeItem('sessionStorage', PENDING_AUTH_KEY);
  clearLegacySharedAuth();
};

export const getAdminSession = () => readJson('sessionStorage', ADMIN_AUTH_SESSION_KEY);
export const setAdminSession = (session) => {
  writeJson('sessionStorage', ADMIN_AUTH_SESSION_KEY, session);
};
export const clearAdminSession = () => {
  removeItem('sessionStorage', ADMIN_AUTH_SESSION_KEY);
};

export const getActiveToken = () => {
  const session = getAuthSession();
  if (session?.token) return session.token;

  const pendingAuth = getPendingAuth();
  return pendingAuth?.preAuthToken || '';
};

export const getActiveAdminToken = () => getAdminSession()?.token || '';

export const getLastSelectedCompanyId = (userId) => {
  if (!userId) return null;
  const storage = getStorage('localStorage');
  const value = storage ? storage.getItem(`${LAST_COMPANY_PREFIX}:${userId}`) : null;
  return value ? Number(value) : null;
};

export const setLastSelectedCompanyId = (userId, companyId) => {
  const storage = getStorage('localStorage');
  if (!storage || !userId || !companyId) return;
  storage.setItem(`${LAST_COMPANY_PREFIX}:${userId}`, String(companyId));
};

export const getLastSelectedCompanyInfo = () => readJson('localStorage', LAST_COMPANY_INFO_KEY);

export const setLastSelectedCompanyInfo = (company) => {
  if (!company?.companyId) return;
  writeJson('localStorage', LAST_COMPANY_INFO_KEY, company);
};
