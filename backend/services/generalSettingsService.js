const authDbService = require('./authDbService');
const salesOrderService = require('./salesOrderService');
const deliveryService = require('./deliveryService');

const SETTING_KEYS = [
  'salesWarehouse',
  'salesSeries',
  'dcSalesWarehouse',
  'dcSalesSeries',
  'ncSalesWarehouse',
  'ncSalesSeries',
  'sodaSalesWarehouse',
  'sodaSalesSeries',
  'deliveryWarehouse',
  'deliverySeries',
  'dcDeliveryWarehouse',
  'dcDeliverySeries',
  'ncDeliveryWarehouse',
  'ncDeliverySeries',
  'sodaDeliveryWarehouse',
  'sodaDeliverySeries',
];

let ensureTablePromise = null;

const ensureTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = authDbService.query(`
      IF OBJECT_ID('dbo.UserGeneralSettings', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.UserGeneralSettings (
          UserGeneralSettingId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          UserId INT NOT NULL,
          CompanyId INT NOT NULL,
          SettingsJson NVARCHAR(MAX) NOT NULL,
          CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_UserGeneralSettings_CreatedAt DEFAULT SYSUTCDATETIME(),
          UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_UserGeneralSettings_UpdatedAt DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_UserGeneralSettings_UserCompany UNIQUE (UserId, CompanyId)
        );
      END
    `).catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
};

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeId = (value, label) => {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw createHttpError(400, `A valid ${label} is required.`);
  }
  return normalized;
};

const emptySettings = () => Object.fromEntries(SETTING_KEYS.map((key) => [key, '']));

const normalizeSettings = (settings = {}) => Object.fromEntries(
  SETTING_KEYS.map((key) => [key, String(settings?.[key] || '').trim()]),
);

const parseSettings = (settingsJson) => {
  try {
    return normalizeSettings(JSON.parse(settingsJson || '{}'));
  } catch (_error) {
    return emptySettings();
  }
};

const ensureAssignment = async (userId, companyId) => {
  const assignment = await authDbService.queryOne(`
    SELECT TOP 1 Id
    FROM dbo.UserCompanies
    WHERE UserId = @userId
      AND CompanyId = @companyId
  `, { userId, companyId });

  if (!assignment) {
    throw createHttpError(400, 'The selected user is not assigned to the selected company.');
  }
};

const getSettings = async (userIdValue, companyIdValue) => {
  const userId = normalizeId(userIdValue, 'user');
  const companyId = normalizeId(companyIdValue, 'company');
  await ensureTable();

  const row = await authDbService.queryOne(`
    SELECT SettingsJson
    FROM dbo.UserGeneralSettings
    WHERE UserId = @userId
      AND CompanyId = @companyId
  `, { userId, companyId });

  return row ? parseSettings(row.SettingsJson) : emptySettings();
};

const getSettingsForAuth = async (auth = {}) =>
  getSettings(auth.userId, auth.companyId);

const getAdminBootstrap = async () => {
  await ensureTable();

  const [companies, users, assignments] = await Promise.all([
    authDbService.queryRows(`
      SELECT CompanyId, CompanyName, DbName
      FROM dbo.Companies
      WHERE IsActive = 1
      ORDER BY CompanyName, CompanyId
    `),
    authDbService.queryRows(`
      SELECT UserId, Username, FullName
      FROM dbo.Users
      WHERE IsActive = 1
      ORDER BY FullName, Username, UserId
    `),
    authDbService.queryRows(`
      SELECT UserId, CompanyId
      FROM dbo.UserCompanies
      ORDER BY CompanyId, UserId
    `),
  ]);

  return { companies, users, assignments };
};

const getAdminSettings = async (userIdValue, companyIdValue) => {
  const userId = normalizeId(userIdValue, 'user');
  const companyId = normalizeId(companyIdValue, 'company');
  await ensureAssignment(userId, companyId);

  return {
    userId,
    companyId,
    settings: await getSettings(userId, companyId),
  };
};

const saveAdminSettings = async (userIdValue, companyIdValue, settings) => {
  const userId = normalizeId(userIdValue, 'user');
  const companyId = normalizeId(companyIdValue, 'company');
  await ensureAssignment(userId, companyId);
  await ensureTable();

  const normalizedSettings = normalizeSettings(settings);
  await authDbService.query(`
    MERGE dbo.UserGeneralSettings WITH (HOLDLOCK) AS target
    USING (SELECT @userId AS UserId, @companyId AS CompanyId) AS source
    ON target.UserId = source.UserId
      AND target.CompanyId = source.CompanyId
    WHEN MATCHED THEN
      UPDATE SET SettingsJson = @settingsJson, UpdatedAt = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (UserId, CompanyId, SettingsJson)
      VALUES (@userId, @companyId, @settingsJson);
  `, {
    userId,
    companyId,
    settingsJson: JSON.stringify(normalizedSettings),
  });

  return { userId, companyId, settings: normalizedSettings };
};

const getAdminOptions = async (req, userIdValue, companyIdValue, dateValue) => {
  const userId = normalizeId(userIdValue, 'user');
  const companyId = normalizeId(companyIdValue, 'company');
  await ensureAssignment(userId, companyId);

  req.auth = { ...req.auth, userId, companyId };
  const [referenceData, salesSeries, deliverySeries] = await Promise.all([
    salesOrderService.getReferenceData(companyId),
    salesOrderService.getDocumentSeries(dateValue || null),
    deliveryService.getDocumentSeries(dateValue || null),
  ]);

  return {
    warehouses: referenceData?.warehouses || [],
    seriesByGroup: {
      sales: salesSeries?.series || [],
      delivery: deliverySeries?.series || [],
    },
  };
};

module.exports = {
  getSettings,
  getSettingsForAuth,
  getAdminBootstrap,
  getAdminSettings,
  saveAdminSettings,
  getAdminOptions,
};
