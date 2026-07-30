const SEARCH_SEPARATOR_PATTERN = /[^a-z0-9]+/gi;

export const normalizeSapSearchText = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(SEARCH_SEPARATOR_PATTERN, ' ')
    .trim()
    .toLowerCase();

export const compactSapSearchText = (value) =>
  normalizeSapSearchText(value).replace(/\s+/g, '');

export const getSapSearchTokens = (query) =>
  normalizeSapSearchText(query)
    .split(/\s+/)
    .filter(Boolean);

export const matchesSapSearchText = (value, query) => {
  const normalizedQuery = normalizeSapSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedValue = normalizeSapSearchText(value);
  if (normalizedValue.includes(normalizedQuery)) return true;

  const compactQuery = normalizedQuery.replace(/\s+/g, '');
  const compactValue = normalizedValue.replace(/\s+/g, '');
  if (compactQuery && compactValue.includes(compactQuery)) return true;

  const tokens = getSapSearchTokens(query);
  return tokens.length > 0 && tokens.every((token) =>
    normalizedValue.includes(token) || compactValue.includes(token)
  );
};
