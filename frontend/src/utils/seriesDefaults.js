const normalizeText = (value) => String(value || '').trim().toUpperCase();

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const buildYearTokens = (year) => {
  const currentYear = String(year);
  const nextYear = String(year + 1);
  const shortYear = currentYear.slice(-2);
  const nextShortYear = nextYear.slice(-2);

  return [
    currentYear,
    `${currentYear}-${nextYear}`,
    `${currentYear}/${nextYear}`,
    `${shortYear}-${nextShortYear}`,
    `${shortYear}/${nextShortYear}`,
    `FY${currentYear}`,
    `FY${shortYear}`,
  ].map(normalizeText);
};

const getSeriesScore = (series, yearTokens) => {
  const indicator = normalizeText(series?.Indicator);
  const seriesName = normalizeText(series?.SeriesName);
  const combined = `${indicator} ${seriesName}`.trim();
  let score = 0;

  for (const token of yearTokens) {
    if (!token) continue;
    if (indicator === token) score = Math.max(score, 500);
    if (seriesName === token) score = Math.max(score, 450);
    if (indicator.includes(token)) score = Math.max(score, 400);
    if (seriesName.includes(token)) score = Math.max(score, 350);
    if (combined.includes(token)) score = Math.max(score, 300);
  }

  return score;
};

const isSeriesMarkedDefault = (series) => {
  const raw = series?.IsDefault ?? series?.isDefault ?? series?.DefaultSeries ?? series?.DfltSeries;
  if (typeof raw === 'number') return raw === 1;
  const normalized = normalizeText(raw);
  return normalized === '1' || normalized === 'Y' || normalized === 'YES' || normalized === 'TRUE';
};

export const getDefaultSeriesForCurrentYear = (seriesList = [], now = new Date()) => {
  if (!Array.isArray(seriesList) || !seriesList.length) return null;

  const targetDate = parseDate(now) || new Date();
  const yearTokens = buildYearTokens(targetDate.getFullYear());
  const dateMatchedSeries = seriesList.filter((series) => {
    const fromDate = parseDate(series?.FromDate);
    const toDate = parseDate(series?.ToDate);
    return fromDate && toDate && targetDate >= startOfDay(fromDate) && targetDate <= endOfDay(toDate);
  });
  const defaultSeries = (dateMatchedSeries.length ? dateMatchedSeries : seriesList)
    .find(isSeriesMarkedDefault);
  if (defaultSeries) return defaultSeries;

  let bestMatch = null;
  let bestScore = -1;

  for (const series of seriesList) {
    const fromDate = parseDate(series?.FromDate);
    const toDate = parseDate(series?.ToDate);
    const isDateMatch = fromDate && toDate && targetDate >= startOfDay(fromDate) && targetDate <= endOfDay(toDate);
    const score = getSeriesScore(series, yearTokens) + (isDateMatch ? 1000 : 0);
    if (score > bestScore) {
      bestMatch = series;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestMatch : seriesList[0];
};
