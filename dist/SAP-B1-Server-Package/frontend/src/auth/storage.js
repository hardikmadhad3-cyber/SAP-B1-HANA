const AUTH_SESSION_KEY = 'sap-b1-auth-session';
const PENDING_AUTH_KEY = 'sap-b1-pending-auth';
const LAST_COMPANY_PREFIX = 'sap-b1-last-company';
const LAST_COMPANY_INFO_KEY = 'sap-b1-last-company-info';

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const readJson = (key) => {
  if (!canUseStorage()) return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (_error) {
    return null;
  }
};

const writeJson = (key, value) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const removeItem = (key) => {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(key);
};

export const getAuthSession = () => readJson(AUTH_SESSION_KEY);
export const setAuthSession = (session) => writeJson(AUTH_SESSION_KEY, session);
export const clearAuthSession = () => removeItem(AUTH_SESSION_KEY);

export const getPendingAuth = () => readJson(PENDING_AUTH_KEY);
export const setPendingAuth = (pendingAuth) => writeJson(PENDING_AUTH_KEY, pendingAuth);
export const clearPendingAuth = () => removeItem(PENDING_AUTH_KEY);

export const getActiveToken = () => {
  const session = getAuthSession();
  if (session?.token) return session.token;

  const pendingAuth = getPendingAuth();
  return pendingAuth?.preAuthToken || '';
};

export const getLastSelectedCompanyId = (userId) => {
  if (!userId) return null;
  const value = canUseStorage()
    ? window.localStorage.getItem(`${LAST_COMPANY_PREFIX}:${userId}`)
    : null;
  return value ? Number(value) : null;
};

export const setLastSelectedCompanyId = (userId, companyId) => {
  if (!canUseStorage() || !userId || !companyId) return;
  window.localStorage.setItem(`${LAST_COMPANY_PREFIX}:${userId}`, String(companyId));
};

export const getLastSelectedCompanyInfo = () => readJson(LAST_COMPANY_INFO_KEY);

export const setLastSelectedCompanyInfo = (company) => {
  if (!company?.companyId) return;
  writeJson(LAST_COMPANY_INFO_KEY, company);
};
