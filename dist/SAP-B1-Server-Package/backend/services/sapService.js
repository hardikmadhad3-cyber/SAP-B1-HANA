/**
 * SAP Business One Service Layer integration service
 */
const axios = require('axios');
const https = require('https');
const { URL } = require('url');
const env = require('../config/env');
const authDbService = require('./authDbService');
const dbService = require('./dbService');
const { getRequestContext } = require('./requestContextService');

const httpsAgent = new https.Agent({
  rejectUnauthorized: env.sapRejectUnauthorized,
});

const SESSION_TTL_MS = 25 * 60 * 1000;
const sessionsByCompanyDb = new Map();
const pendingLoginsByCompanyDb = new Map();
const userStampFieldsByCompanyTable = new Map();
const userStampUserById = new Map();

const USER_STAMP_ENDPOINT_TABLES = new Map([
  ['Items', 'OITM'],
  ['Orders', 'ORDR'],
  ['DeliveryNotes', 'ODLN'],
  ['Quotations', 'OQUT'],
  ['Invoices', 'OINV'],
  ['CreditNotes', 'ORIN'],
  ['PurchaseOrders', 'OPOR'],
  ['PurchaseQuotations', 'OPQT'],
  ['PurchaseRequests', 'OPRQ'],
  ['PurchaseDeliveryNotes', 'OPDN'],
  ['PurchaseInvoices', 'OPCH'],
  ['PurchaseCreditNotes', 'ORPC'],
  ['InventoryGenEntries', 'OIGN'],
  ['InventoryGenExits', 'OIGE'],
  ['StockTransfers', 'OWTR'],
  ['InventoryTransferRequests', 'OWTQ'],
  ['ProductionOrders', 'OWOR'],
]);

const USER_STAMP_TARGETS = {
  userName: new Set(['WEBUSER']),
  userCode: new Set(['WEBUSERCODE']),
};
const USER_STAMP_STANDARD_FIELDS = ['U_WEBUSER', 'U_WEBUSERCODE'];
const USER_STAMP_DEPRECATED_FIELDS = ['U_WEBUSERID'];

const normalizeStampKey = (value = '') =>
  String(value || '').trim().toUpperCase().replace(/^U_/, '').replace(/[^A-Z0-9]/g, '');

const getServiceLayerEntity = (url = '') => {
  const path = String(url || '').split('?')[0].replace(/^\/+/, '');
  const match = path.match(/^([A-Za-z0-9_]+)(?:\(|\/|$)/);
  return match ? match[1] : '';
};

const buildUrl = (path) => {
  const qIdx = path.indexOf('?');
  if (qIdx === -1) return `${env.sapBaseUrl}${path}`;

  const base = path.slice(0, qIdx);
  const qs = path.slice(qIdx + 1);
  const encodedQs = qs
    .replace(/\$/g, '%24')
    .replace(/ /g, '%20')
    .replace(/'/g, '%27');

  return `${env.sapBaseUrl}${base}?${encodedQs}`;
};

const extractCookie = (header) => {
  if (!Array.isArray(header)) return header || '';
  return header.map((cookie) => String(cookie).split(';')[0]).filter(Boolean).join('; ');
};

const getSessionKey = (companyDb) => String(companyDb || '').trim().toLowerCase();

const getSessionState = (companyDb) => {
  const sessionKey = getSessionKey(companyDb);

  if (!sessionsByCompanyDb.has(sessionKey)) {
    sessionsByCompanyDb.set(sessionKey, {
      companyDb: String(companyDb || '').trim(),
      sessionCookie: '',
      sessionActive: false,
      sessionExpireAt: 0,
    });
  }

  return sessionsByCompanyDb.get(sessionKey);
};

const resolveCompanyDb = async (requestConfig = {}) => {
  const explicitCompanyDb = String(requestConfig.companyDb || '').trim();
  if (explicitCompanyDb) {
    return explicitCompanyDb;
  }

  const context = getRequestContext();
  if (context?.companyDb) {
    return context.companyDb;
  }

  const authUserId = Number(context?.req?.auth?.userId);
  const authCompanyId = Number(context?.req?.auth?.companyId);

  if (Number.isFinite(authUserId) && Number.isFinite(authCompanyId)) {
    const assignedCompany = await authDbService.getAssignedCompanyForUser(authUserId, authCompanyId);
    const companyDb = String(assignedCompany?.DbName || '').trim();

    if (companyDb) {
      if (context) {
        context.companyDb = companyDb;
      }
      return companyDb;
    }
  }

  return String(env.sapCompanyDb || '').trim();
};

const getUserStampFields = async (companyDb, tableName) => {
  const cacheKey = `${String(companyDb || '').trim().toLowerCase()}:${tableName}`;
  if (userStampFieldsByCompanyTable.has(cacheKey)) {
    return userStampFieldsByCompanyTable.get(cacheKey);
  }

  const columnResult = await dbService.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = @tableName
      AND COLUMN_NAME LIKE 'U_%'
  `, { tableName }, { databaseName: companyDb });

  const metadataResult = await dbService.query(`
    SELECT AliasID, Descr
    FROM CUFD
    WHERE TableID = @tableName
  `, { tableName }, { databaseName: companyDb }).catch((error) => {
    console.warn(`[SAP] Could not read UDF metadata for ${companyDb}.${tableName}: ${error.message}`);
    return { recordset: [] };
  });

  const columns = new Set((columnResult.recordset || []).map((row) => String(row.COLUMN_NAME || '').trim()));
  const fields = {
    fieldNames: columns,
    userNameField: '',
    userCodeFields: [],
  };

  const addResolvedField = (fieldName, targetType) => {
    const normalizedFieldName = String(fieldName || '').trim();
    if (!normalizedFieldName || !columns.has(normalizedFieldName)) {
      return;
    }

    if (targetType === 'userName' && !fields.userNameField) {
      fields.userNameField = normalizedFieldName;
      return;
    }

    if (targetType === 'userCode' && !fields.userCodeFields.includes(normalizedFieldName)) {
      fields.userCodeFields.push(normalizedFieldName);
    }
  };

  for (const columnName of columns) {
    const normalizedColumn = normalizeStampKey(columnName);
    if (USER_STAMP_TARGETS.userName.has(normalizedColumn)) {
      addResolvedField(columnName, 'userName');
    }
    if (USER_STAMP_TARGETS.userCode.has(normalizedColumn)) {
      addResolvedField(columnName, 'userCode');
    }
  }

  for (const row of metadataResult.recordset || []) {
    const alias = String(row.AliasID || '').trim();
    const serviceLayerField = alias ? `U_${alias.replace(/^U_/i, '')}` : '';
    const keysToMatch = [alias, row.Descr].map(normalizeStampKey);

    if (keysToMatch.some((key) => USER_STAMP_TARGETS.userName.has(key))) {
      addResolvedField(serviceLayerField, 'userName');
    }

    if (keysToMatch.some((key) => USER_STAMP_TARGETS.userCode.has(key))) {
      addResolvedField(serviceLayerField, 'userCode');
    }
  }

  userStampFieldsByCompanyTable.set(cacheKey, fields);
  return fields;
};

const getAuthenticatedUserStamp = async () => {
  const context = getRequestContext();
  const userId = Number(context?.req?.auth?.userId);
  if (!Number.isFinite(userId)) {
    return null;
  }

  if (userStampUserById.has(userId)) {
    return userStampUserById.get(userId);
  }

  const user = await authDbService.queryOne(`
    SELECT UserId, Username, FullName
    FROM dbo.Users
    WHERE UserId = @userId
  `, { userId });

  const stamp = {
    userCode: String(user?.UserId ?? userId).trim(),
    userName: String(user?.FullName || user?.Username || userId).trim(),
  };

  userStampUserById.set(userId, stamp);
  return stamp;
};

const withAuthenticatedUserStamp = async (config, companyDb) => {
  const method = String(config.method || 'get').trim().toUpperCase();
  if (!['POST', 'PATCH'].includes(method) || !config.data || typeof config.data !== 'object' || Array.isArray(config.data)) {
    return config.data || null;
  }

  const entity = getServiceLayerEntity(config.url);
  const tableName = USER_STAMP_ENDPOINT_TABLES.get(entity);
  if (!tableName) {
    return config.data;
  }

  const stamp = await getAuthenticatedUserStamp();
  if (!stamp) {
    return config.data;
  }

  const fields = await getUserStampFields(companyDb, tableName);

  const stampedPayload = { ...config.data };
  for (const field of [...USER_STAMP_STANDARD_FIELDS, ...USER_STAMP_DEPRECATED_FIELDS]) {
    if (!fields.fieldNames.has(field)) {
      delete stampedPayload[field];
    }
  }

  for (const field of USER_STAMP_DEPRECATED_FIELDS) {
    delete stampedPayload[field];
  }

  if (!fields.userNameField && fields.userCodeFields.length === 0) {
    return stampedPayload;
  }

  if (fields.userNameField && stamp.userName) {
    stampedPayload[fields.userNameField] = stamp.userName;
  }

  for (const field of fields.userCodeFields) {
    if (stamp.userCode) {
      stampedPayload[field] = stamp.userCode;
    }
  }

  return stampedPayload;
};

const login = async (companyDb) => {
  const resolvedCompanyDb = String(companyDb || '').trim();
  if (!env.sapBaseUrl || !env.sapUsername || !env.sapPassword || !resolvedCompanyDb) {
    throw new Error('Missing SAP configuration. Check backend/.env and company assignment.');
  }

  const loginKey = getSessionKey(resolvedCompanyDb);
  const pendingLogin = pendingLoginsByCompanyDb.get(loginKey);
  if (pendingLogin) {
    return pendingLogin;
  }

  const loginPromise = axios.post(
    buildUrl('/Login'),
    {
      UserName: env.sapUsername,
      Password: env.sapPassword,
      CompanyDB: resolvedCompanyDb,
    },
    { httpsAgent },
  ).then((response) => {
    const sessionState = getSessionState(resolvedCompanyDb);
    sessionState.sessionCookie = extractCookie(response.headers['set-cookie']);
    sessionState.sessionActive = true;
    sessionState.sessionExpireAt = Date.now() + SESSION_TTL_MS;
    console.log(`[SAP] Session established for ${resolvedCompanyDb}`);
    return sessionState.sessionCookie;
  }).finally(() => {
    pendingLoginsByCompanyDb.delete(loginKey);
  });

  pendingLoginsByCompanyDb.set(loginKey, loginPromise);
  return loginPromise;
};

const ensureSession = async (companyDb) => {
  const resolvedCompanyDb = String(companyDb || '').trim();
  const sessionState = getSessionState(resolvedCompanyDb);

  if (!sessionState.sessionActive || !sessionState.sessionCookie || Date.now() >= sessionState.sessionExpireAt) {
    await login(resolvedCompanyDb);
  }
};

const rawRequest = (method, fullUrl, headers, body) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(fullUrl);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json', ...headers },
      rejectUnauthorized: env.sapRejectUnauthorized,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const err = new Error(`SAP ${res.statusCode}`);
          try {
            err.response = { status: res.statusCode, data: JSON.parse(data) };
          } catch {
            err.response = { status: res.statusCode, data };
          }
          return reject(err);
        }

        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });

const request = async (config, retryOnAuth = true) => {
  const companyDb = await resolveCompanyDb(config);
  await ensureSession(companyDb);
  const sessionState = getSessionState(companyDb);
  const requestData = await withAuthenticatedUserStamp(config, companyDb);

  try {
    return await rawRequest(
      config.method || 'get',
      buildUrl(config.url),
      { Cookie: sessionState.sessionCookie, ...(config.headers || {}) },
      requestData,
    );
  } catch (error) {
    if (retryOnAuth && [401, 403].includes(error.response?.status)) {
      console.log(`[SAP] Auth error for ${companyDb}; re-logging in`);
      sessionState.sessionActive = false;
      sessionState.sessionCookie = '';
      sessionState.sessionExpireAt = 0;
      await login(companyDb);
      return request(config, false);
    }

    throw error;
  }
};

const createItem = async (data) => {
  const res = await request({ method: 'POST', url: '/Items', data });
  return res.data;
};

const getItem = async (itemCode) => {
  const res = await request({ method: 'GET', url: `/Items('${encodeURIComponent(itemCode)}')` });
  return res.data;
};

const updateItem = async (itemCode, data) => {
  await request({ method: 'PATCH', url: `/Items('${encodeURIComponent(itemCode)}')`, data });
  return getItem(itemCode);
};

const searchItems = async (query = '', top = 50, skip = 0) => {
  const filter = query
    ? `&$filter=contains(ItemCode,'${query}') or contains(ItemName,'${query}')`
    : '';

  const res = await request({
    method: 'GET',
    url: `/Items?$select=ItemCode,ItemName,ForeignName,ItemsGroupCode,InventoryItem,SalesItem,PurchaseItem,AssetItem,Valid,Frozen,ItemType,ItemClass&$top=${top}&$skip=${skip}${filter}`,
  });

  return res.data.value || [];
};

const getItemGroups = async () => {
  const res = await request({ method: 'GET', url: '/ItemGroups?$select=Number,GroupName' });
  return res.data.value || [];
};

const getPriceLists = async () => {
  const res = await request({ method: 'GET', url: '/PriceLists?$select=PriceListNo,PriceListName' });
  return res.data.value || [];
};

const createItem_generic = async (endpoint, data) => {
  const res = await request({ method: 'POST', url: endpoint, data });
  return res.data;
};

module.exports = {
  login,
  ensureSession,
  request,
  resolveCompanyDb,
  createItem,
  createItem_generic,
  getItem,
  updateItem,
  searchItems,
  getItemGroups,
  getPriceLists,
};
