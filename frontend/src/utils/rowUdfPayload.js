const hasEnteredUdfValue = (value) => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim() !== '';
};

export const buildVisibleEnteredRowUdfPayload = (
  rowUdfDefinitions = [],
  values = {},
  formSettings = {},
) => {
  const rowSettings = formSettings?.rowUdfs || {};

  return (rowUdfDefinitions || []).reduce((acc, field) => {
    const key = field?.key;
    if (!key) return acc;

    const setting = rowSettings[key];
    const isVisible = setting ? setting.visible === true : field.visible !== false;
    const isActive = setting?.active !== false;
    const value = values?.[key];

    if (isVisible && isActive && hasEnteredUdfValue(value)) {
      acc[key] = value;
    }

    return acc;
  }, {});
};
