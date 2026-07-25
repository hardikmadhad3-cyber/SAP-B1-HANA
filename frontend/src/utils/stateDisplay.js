const normalizeStateToken = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const INDIA_STATE_NAMES_BY_GST_CODE = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman and Diu', '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory', '99': 'Centre Jurisdiction',
};

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
  const normalizedFallback = String(fallback || '').trim();
  return INDIA_STATE_NAMES_BY_GST_CODE[normalizedFallback.padStart(2, '0')] || normalizedFallback;
};
