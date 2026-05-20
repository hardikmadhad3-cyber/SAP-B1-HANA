const normalizeStateToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const toStateCandidates = (value) => {
  if (value && typeof value === 'object') {
    return [value.Code, value.State, value.Name].filter(Boolean);
  }
  return [value];
};

const findStateMatch = (value, states = []) => {
  const normalizedValue = normalizeStateToken(toStateCandidates(value)[0]);
  if (!normalizedValue) return null;

  return states.find((state) =>
    [state?.Code, state?.State, state?.Name].some(
      (candidate) => normalizeStateToken(candidate) === normalizedValue
    )
  ) || null;
};

export const getStateCodeValue = (value, states = []) => {
  const match = findStateMatch(value, states);
  if (match) return String(match.Code || match.State || match.Name || '').trim();

  const fallback = toStateCandidates(value).find(Boolean);
  return String(fallback || '').trim();
};

export const getStateDisplayName = (value, states = []) => {
  const match = findStateMatch(value, states);
  if (match) return String(match.Name || match.State || match.Code || '').trim();

  const fallback = toStateCandidates(value).find(Boolean);
  return String(fallback || '').trim();
};
