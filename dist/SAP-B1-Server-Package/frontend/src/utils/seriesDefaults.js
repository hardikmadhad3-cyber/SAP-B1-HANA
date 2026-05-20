const normalizeText = (value) => String(value || '').trim().toUpperCase();

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

  for (const token of yearTokens) {
    if (!token) continue;
    if (indicator === token) return 500;
    if (seriesName === token) return 450;
    if (indicator.includes(token)) return 400;
    if (seriesName.includes(token)) return 350;
    if (combined.includes(token)) return 300;
  }

  return 0;
};

export const getDefaultSeriesForCurrentYear = (seriesList = [], now = new Date()) => {
  if (!Array.isArray(seriesList) || !seriesList.length) return null;

  const yearTokens = buildYearTokens(now.getFullYear());
  let bestMatch = null;
  let bestScore = -1;

  for (const series of seriesList) {
    const score = getSeriesScore(series, yearTokens);
    if (score > bestScore) {
      bestMatch = series;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestMatch : seriesList[0];
};
