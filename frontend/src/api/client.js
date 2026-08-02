import axios from 'axios';
import { API_BASE_URL } from '../config/appConfig';
import { getActiveAdminToken, getActiveToken } from '../auth/storage';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

const GET_CACHE_TTL_MS = 2 * 60 * 1000;
const getCache = new Map();
const pendingGets = new Map();

const isNextNumberLookup = (path = '') => (
  path.includes('/next-number') ||
  path.endsWith('/series/next') ||
  /\/lookup\/series\/[^/?#]+\/next$/.test(path)
);

const isCacheableGet = (url = '') => {
  const normalized = String(url || '').toLowerCase();
  const pathOnly = normalized.split(/[?#]/)[0];
  if (isNextNumberLookup(pathOnly)) return false;
  if (pathOnly === '/journal-entry/reference-data' || pathOnly === '/journal-entry/remark-templates') return false;
  if (pathOnly.includes('/bom/lookup/')) return false;

  return (
    normalized.includes('/reference-data') ||
    normalized.includes('/sap/layout/document') ||
    pathOnly.endsWith('/hsn-codes') ||
    normalized.includes('/lookup/') ||
    normalized.includes('/items-modal') ||
    normalized.includes('/freight-charges') ||
    normalized.includes('/print-layouts') ||
    pathOnly.endsWith('/predefined-texts') ||
    normalized.includes('/warehouse-state') ||
    normalized.includes('/state-from-address') ||
    normalized.includes('/customers/search') ||
    normalized.includes('/vendors/search') ||
    normalized.endsWith('/metadata') ||
    normalized === '/menu'
  );
};

const getCacheKey = (url, config = {}) => {
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${getActiveToken() || 'public'}:${url}:${params}`;
};

const isAdminPanelRequest = (url = '') => {
  const normalized = String(url || '').trim().replace(/^https?:\/\/[^/]+\/api/i, '');
  return normalized === '/admin-panel' || normalized.startsWith('/admin-panel/');
};

const clearGetCache = () => {
  getCache.clear();
  pendingGets.clear();
};

apiClient.interceptors.request.use((config) => {
  const token = isAdminPanelRequest(config.url)
    ? getActiveAdminToken()
    : getActiveToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || 'get').toLowerCase();
    if (method !== 'get') {
      clearGetCache();
    }

    return response;
  },
  (error) => {
    const method = String(error.config?.method || '').toLowerCase();
    if (method && method !== 'get') {
      clearGetCache();
    }

    return Promise.reject(error);
  },
);

const originalGet = apiClient.get.bind(apiClient);

apiClient.get = (url, config = {}) => {
  if (!isCacheableGet(url)) {
    return originalGet(url, config);
  }

  const key = getCacheKey(url, config);
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.response);
  }

  if (pendingGets.has(key)) {
    return pendingGets.get(key);
  }

  const request = originalGet(url, config)
    .then((response) => {
      getCache.set(key, {
        response,
        expiresAt: Date.now() + GET_CACHE_TTL_MS,
      });
      return response;
    })
    .finally(() => {
      pendingGets.delete(key);
    });

  pendingGets.set(key, request);
  return request;
};

export default apiClient;
