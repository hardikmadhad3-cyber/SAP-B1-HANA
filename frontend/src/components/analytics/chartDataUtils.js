const AGGREGATORS = {
  sum: (values) => values.reduce((total, value) => total + value, 0),
  avg: (values) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0),
  count: (values) => values.length,
  min: (values) => Math.min(...values),
  max: (values) => Math.max(...values),
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

/**
 * Groups raw query rows by the dimension field and aggregates each measure.
 * Returns { categories: string[], series: [{ name, data: number[] }] }.
 */
export const aggregateForChart = (rows, fieldMapping) => {
  const dimension = fieldMapping?.dimension;
  const measures = Array.isArray(fieldMapping?.measures) && fieldMapping.measures.length
    ? fieldMapping.measures
    : [];

  if (!dimension || !measures.length || !Array.isArray(rows)) {
    return { categories: [], series: [] };
  }

  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row[dimension] ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const categories = [...groups.keys()];
  const series = measures.map((measure) => {
    const aggregator = AGGREGATORS[measure.agg] || AGGREGATORS.sum;
    return {
      name: measure.label || measure.field,
      data: categories.map((category) => aggregator(groups.get(category).map((row) => toNumber(row[measure.field])))),
    };
  });

  return { categories, series };
};

/** Aggregates a single measure across all rows - used for KPI cards and gauges. */
export const aggregateSingleValue = (rows, fieldMapping) => {
  const measure = fieldMapping?.measures?.[0];
  if (!measure || !Array.isArray(rows)) return 0;

  const aggregator = AGGREGATORS[measure.agg] || AGGREGATORS.sum;
  return aggregator(rows.map((row) => toNumber(row[measure.field])));
};

/**
 * Radar charts invert bar/line's dimension-to-measure relationship: each
 * dimension value becomes one radar "shape" (series), and each measure
 * becomes one indicator axis shared by every shape. Returns
 * { indicators: [{name, max}], series: [{name, value: number[]}] }.
 */
export const aggregateForRadar = (rows, fieldMapping) => {
  const dimension = fieldMapping?.dimension;
  const measures = Array.isArray(fieldMapping?.measures) && fieldMapping.measures.length
    ? fieldMapping.measures
    : [];

  if (!dimension || !measures.length || !Array.isArray(rows)) {
    return { indicators: [], series: [] };
  }

  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row[dimension] ?? '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const series = [...groups.entries()].map(([name, groupRows]) => ({
    name,
    value: measures.map((measure) => {
      const aggregator = AGGREGATORS[measure.agg] || AGGREGATORS.sum;
      return aggregator(groupRows.map((row) => toNumber(row[measure.field])));
    }),
  }));

  const indicators = measures.map((measure, index) => ({
    name: measure.label || measure.field,
    max: Math.max(1, ...series.map((entry) => entry.value[index] || 0)),
  }));

  return { indicators, series };
};

/**
 * Matrix (pivot table): groups rows hierarchically by rowFields (in order,
 * producing nested subtotal levels), optionally cross-tabulated by
 * columnField's distinct values. Each node's cells are aggregated over its
 * entire subset *before* descending into children, so a group row's cells
 * double as that group's subtotal - matches Power BI's collapsed-group
 * behavior. Returns { columnKeys, rowNodes: [{ key, level, cells, children }] }
 * where cells is keyed `${columnKey}::${measureField}`.
 */
export const buildMatrixData = (rows, fieldMapping) => {
  const rowFields = Array.isArray(fieldMapping?.rowFields) ? fieldMapping.rowFields.filter(Boolean) : [];
  const columnField = fieldMapping?.columnField || '';
  const measures = Array.isArray(fieldMapping?.measures) && fieldMapping.measures.length
    ? fieldMapping.measures
    : [];

  if (!rowFields.length || !measures.length || !Array.isArray(rows)) {
    return { columnKeys: [], rowNodes: [] };
  }

  const columnKeys = columnField
    ? [...new Set(rows.map((row) => String(row[columnField] ?? '')))].sort()
    : ['__value__'];

  const computeCells = (subset) => {
    const cells = {};
    columnKeys.forEach((columnKey) => {
      const scoped = columnField
        ? subset.filter((row) => String(row[columnField] ?? '') === columnKey)
        : subset;
      measures.forEach((measure) => {
        const aggregator = AGGREGATORS[measure.agg] || AGGREGATORS.sum;
        cells[`${columnKey}::${measure.field}`] = aggregator(scoped.map((row) => toNumber(row[measure.field])));
      });
    });
    return cells;
  };

  const group = (subset, level) => {
    const field = rowFields[level];
    const groups = new Map();
    subset.forEach((row) => {
      const key = String(row[field] ?? '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });

    return [...groups.entries()].map(([key, groupRows]) => ({
      key,
      level,
      cells: computeCells(groupRows),
      children: level + 1 < rowFields.length ? group(groupRows, level + 1) : null,
    }));
  };

  return { columnKeys, rowNodes: group(rows, 0) };
};

/**
 * Heatmap: groups rows by (dimension, yDimension) pairs and aggregates a
 * single measure per cell. Returns { xCategories, yCategories, data: [[xIndex,
 * yIndex, value], ...] } - the exact shape ECharts' heatmap series expects.
 */
export const aggregateForHeatmap = (rows, fieldMapping) => {
  const dimension = fieldMapping?.dimension;
  const yDimension = fieldMapping?.yDimension;
  const measure = fieldMapping?.measures?.[0];

  if (!dimension || !yDimension || !measure || !Array.isArray(rows)) {
    return { xCategories: [], yCategories: [], data: [] };
  }

  const xCategories = [...new Set(rows.map((row) => String(row[dimension] ?? '')))];
  const yCategories = [...new Set(rows.map((row) => String(row[yDimension] ?? '')))];
  const groups = new Map();
  rows.forEach((row) => {
    const key = `${row[dimension]}::${row[yDimension]}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const aggregator = AGGREGATORS[measure.agg] || AGGREGATORS.sum;
  const data = [];
  xCategories.forEach((xCategory, xIndex) => {
    yCategories.forEach((yCategory, yIndex) => {
      const groupRows = groups.get(`${xCategory}::${yCategory}`) || [];
      const value = groupRows.length ? aggregator(groupRows.map((row) => toNumber(row[measure.field]))) : null;
      data.push([xIndex, yIndex, value]);
    });
  });

  return { xCategories, yCategories, data };
};

/**
 * Scatter charts plot raw rows as x/y (optionally sized) points rather than
 * aggregating by dimension - uses plain column names (xField/yField/
 * sizeField), not the dimension+measures shape.
 */
export const buildScatterPoints = (rows, fieldMapping) => {
  const { xField, yField, sizeField } = fieldMapping || {};
  if (!xField || !yField || !Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const x = Number(row[xField]);
      const y = Number(row[yField]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const point = [x, y];
      if (sizeField) point.push(toNumber(row[sizeField]));
      return point;
    })
    .filter(Boolean);
};
