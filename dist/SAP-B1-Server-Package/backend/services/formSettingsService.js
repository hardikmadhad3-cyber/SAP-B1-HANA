const authDbService = require('./authDbService');

let ensureTablePromise = null;

const ensureTable = async () => {
  if (!ensureTablePromise) {
    ensureTablePromise = authDbService.ensureSchema().catch((error) => {
      ensureTablePromise = null;
      throw error;
    });
  }

  return ensureTablePromise;
};

const validateAuth = (auth = {}) => {
  const userId = Number(auth.userId);
  const companyId = Number(auth.companyId);

  if (!Number.isInteger(userId) || !Number.isInteger(companyId)) {
    const error = new Error('A valid user and company session is required.');
    error.statusCode = 401;
    throw error;
  }

  return { userId, companyId };
};

const normalizeFormKey = (formKey) => {
  const value = String(formKey || '').trim();
  if (!value || value.length > 150) {
    const error = new Error('A valid form key is required.');
    error.statusCode = 400;
    throw error;
  }

  return value;
};

const parseSettings = (settingsJson) => {
  try {
    const parsed = JSON.parse(settingsJson || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const getFormSettings = async (auth, formKey) => {
  const { userId, companyId } = validateAuth(auth);
  const normalizedFormKey = normalizeFormKey(formKey);

  await ensureTable();

  const row = await authDbService.queryOne(`
    SELECT SettingsJson
    FROM dbo.UserFormSettings
    WHERE UserId = @userId
      AND CompanyId = @companyId
      AND FormKey = @formKey
  `, { userId, companyId, formKey: normalizedFormKey });

  return {
    formKey: normalizedFormKey,
    userId,
    companyId,
    settings: row ? parseSettings(row.SettingsJson) : null,
  };
};

const saveFormSettings = async (auth, formKey, settings) => {
  const { userId, companyId } = validateAuth(auth);
  const normalizedFormKey = normalizeFormKey(formKey);

  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    const error = new Error('settings must be an object.');
    error.statusCode = 400;
    throw error;
  }

  const settingsJson = JSON.stringify(settings);
  await ensureTable();

  await authDbService.query(`
    INSERT INTO UserFormSettings (UserId, CompanyId, FormKey, SettingsJson, CreatedAt, UpdatedAt)
    VALUES (@userId, @companyId, @formKey, @settingsJson, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(UserId, CompanyId, FormKey) DO UPDATE SET
      SettingsJson = excluded.SettingsJson,
      UpdatedAt = CURRENT_TIMESTAMP
  `, {
    userId,
    companyId,
    formKey: normalizedFormKey,
    settingsJson,
  });

  return {
    formKey: normalizedFormKey,
    userId,
    companyId,
    settings,
  };
};

module.exports = {
  getFormSettings,
  saveFormSettings,
};
