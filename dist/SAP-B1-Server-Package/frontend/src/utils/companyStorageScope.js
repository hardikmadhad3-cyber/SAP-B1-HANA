import { getAuthSession } from '../auth/storage';

export const ROUTE_COMPANY_SCOPE_KEY = 'sapCompanyScope';

const normalizeScopePart = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

export const buildCompanyStorageScope = (company = {}) => {
  const safeCompany = company || {};
  const parts = [
    safeCompany.companyId !== undefined && safeCompany.companyId !== null
      ? `id:${normalizeScopePart(safeCompany.companyId)}`
      : '',
    safeCompany.dbName ? `db:${normalizeScopePart(safeCompany.dbName)}` : '',
    safeCompany.serverName ? `server:${normalizeScopePart(safeCompany.serverName)}` : '',
  ].filter(Boolean);

  return encodeURIComponent(parts.join('|') || 'unselected');
};

export const getActiveCompanyStorageScope = () =>
  buildCompanyStorageScope(getAuthSession()?.company);

export const buildCompanyScopedSessionKey = (baseKey, companyOrScope) => {
  const scope = typeof companyOrScope === 'string'
    ? companyOrScope
    : buildCompanyStorageScope(companyOrScope);

  return `${baseKey}::company:${scope || 'unselected'}`;
};

export const buildActiveCompanyScopedSessionKey = (baseKey) =>
  buildCompanyScopedSessionKey(baseKey, getActiveCompanyStorageScope());

export const createCompanyScopedRouteState = (state = {}, companyOrScope) => ({
  ...(state || {}),
  [ROUTE_COMPANY_SCOPE_KEY]: typeof companyOrScope === 'string'
    ? companyOrScope
    : buildCompanyStorageScope(companyOrScope),
});

export const createActiveCompanyScopedRouteState = (state = {}) =>
  createCompanyScopedRouteState(state, getActiveCompanyStorageScope());

export const isRouteStateForCompany = (state, companyOrScope) => {
  if (!state || typeof state !== 'object') return false;

  const expectedScope = typeof companyOrScope === 'string'
    ? companyOrScope
    : buildCompanyStorageScope(companyOrScope);

  return state[ROUTE_COMPANY_SCOPE_KEY] === expectedScope;
};

export const isRouteStateForActiveCompany = (state) =>
  isRouteStateForCompany(state, getActiveCompanyStorageScope());
