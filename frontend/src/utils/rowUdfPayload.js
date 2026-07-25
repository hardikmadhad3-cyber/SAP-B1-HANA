const hasEnteredUdfValue = (value) => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== '';
};

const isSapUdfKey = (key) => String(key || '').startsWith('U_');

const getRowUdfSetting = (key, rowSettings = {}, matrixSettings = {}) =>
  matrixSettings[key] || rowSettings[key];

const resolveVisible = (field = {}, setting = {}) => (
  setting?.visible !== undefined ? setting.visible !== false : field.visible !== false
);

const resolveActive = (field = {}, setting = {}) => (
  setting?.active !== undefined ? setting.active !== false : field.active !== false
);

const canIncludeRowUdf = (field, setting = {}) => {
  if (field) {
    return resolveVisible(field, setting) && resolveActive(field, setting);
  }

  return setting?.visible !== false && setting?.active !== false;
};

export const buildVisibleEnteredRowUdfPayload = (
  rowUdfDefinitions = [],
  values = {},
  formSettings = {},
) => {
  const rowSettings = formSettings?.rowUdfs || {};
  const matrixSettings = formSettings?.matrixColumns || {};
  const definitionsByKey = new Map(
    (rowUdfDefinitions || [])
      .filter((field) => field?.key)
      .map((field) => [field.key, field])
  );

  const payload = (rowUdfDefinitions || []).reduce((acc, field) => {
    const key = field?.key;
    if (!key) return acc;

    const setting = getRowUdfSetting(key, rowSettings, matrixSettings);
    const value = values?.[key];

    if (canIncludeRowUdf(field, setting) && hasEnteredUdfValue(value)) {
      acc[key] = value;
    }

    return acc;
  }, {});

  Object.entries(values || {}).forEach(([key, value]) => {
    if (
      !isSapUdfKey(key) ||
      Object.prototype.hasOwnProperty.call(payload, key) ||
      !hasEnteredUdfValue(value)
    ) {
      return;
    }

    const field = definitionsByKey.get(key);

    const setting = getRowUdfSetting(key, rowSettings, matrixSettings);
    if (canIncludeRowUdf(field, setting)) {
      payload[key] = value;
    }
  });

  return payload;
};
