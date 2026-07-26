/**
 * Field-value dashboard filters (slicers): unlike the query-parameter filter
 * bar, these filter widgets' already-fetched rows client-side by an arbitrary
 * column name, regardless of whether the underlying query declares a
 * matching SQL parameter. A filter only affects widgets whose data actually
 * contains that field.
 *
 * Four filter types:
 * - 'select' (default, backward compatible with filters saved before this
 *   type existed): checkbox multi-select, keeps only rows whose field value
 *   is one of the selected values.
 * - 'comparison': a numeric operator (>, >=, <, <=, =, !=) plus a value,
 *   configured at design time as the filter's default so it's already
 *   applied the moment the dashboard loads (e.g. "OnHand > 0"), and still
 *   adjustable from the live filter bar.
 * - 'dateRange': a from/to date pair, keeps rows whose field parses as a
 *   date within [from, to] inclusive.
 * - 'topN': ranks the *whole* row set by a numeric field and keeps only the
 *   first N (descending or ascending) - unlike the other three, which decide
 *   keep/drop per row independently, this needs the full set, so it's
 *   applied as a final pass after every row-level filter. Ranks/truncates
 *   raw rows, not grouped/aggregated categories (see plan for scope note).
 */

export const COMPARISON_OPERATORS = ['>', '>=', '<', '<=', '=', '!='];

/**
 * Multiple filters can legitimately target the same field (e.g. "OnHand > 0"
 * alongside "Top 10 by OnHand") - `field` alone can't key the values map or
 * React lists in that case. Filters created after this fix carry a unique
 * `id`; older saved filters (pre-multi-filter-per-field) fall back to `field`
 * for backward compatibility.
 */
export const getFilterKey = (filter) => filter.id != null ? String(filter.id) : filter.field;

const compare = (rowValue, operator, filterValue) => {
  const a = Number(rowValue);
  const b = Number(filterValue);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  switch (operator) {
    case '>': return a > b;
    case '>=': return a >= b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
    case '!=': return a !== b;
    default: return true;
  }
};

const withinDateRange = (rowValue, from, to) => {
  const date = new Date(rowValue);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < new Date(from)) return false;
  if (to && date > new Date(to)) return false;
  return true;
};

/** Scans every widget's fetched rows for `field` and returns sorted distinct string values. */
export const computeDistinctValues = (widgetRowsById, field) => {
  const values = new Set();
  Object.values(widgetRowsById || {}).forEach((rows) => {
    (rows || []).forEach((row) => {
      if (row && Object.prototype.hasOwnProperty.call(row, field)) {
        values.add(String(row[field] ?? ''));
      }
    });
  });
  return [...values].sort();
};

/** Builds the initial `values` state for a dashboard's filters from their design-time defaults. */
export const buildDefaultFieldFilterValues = (filters) => {
  const result = {};
  (filters || []).forEach((filter) => {
    const key = getFilterKey(filter);
    if (filter.type === 'comparison') {
      result[key] = { operator: filter.operator || '>', value: filter.value ?? '' };
    } else if (filter.type === 'dateRange') {
      result[key] = { from: filter.from || '', to: filter.to || '' };
    } else if (filter.type === 'topN') {
      result[key] = { n: filter.n ?? 10, direction: filter.direction || 'desc' };
    } else {
      result[key] = [];
    }
  });
  return result;
};

/**
 * Filters `rows` by every defined filter that (a) is active in `values` and
 * (b) targets a field present on these rows. Filters for fields absent from
 * this row set are no-ops, so a filter only narrows the widgets whose data
 * actually has that column. Top N is applied last, as a rank+truncate pass
 * over whatever survived the row-level filters.
 */
export const applyFieldFilters = (rows, filters, values) => {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(filters) || !filters.length) {
    return rows;
  }

  const rowLevelFilters = filters.filter((filter) => filter.type !== 'topN');
  const topNFilters = filters.filter((filter) => filter.type === 'topN');

  const activeRowFilters = rowLevelFilters.filter((filter) => {
    if (!Object.prototype.hasOwnProperty.call(rows[0], filter.field)) return false;
    const current = values?.[getFilterKey(filter)];
    if (filter.type === 'comparison') {
      return current && current.value !== '' && current.value != null;
    }
    if (filter.type === 'dateRange') {
      return current && (current.from || current.to);
    }
    return Array.isArray(current) && current.length;
  });

  let result = !activeRowFilters.length ? rows : rows.filter((row) =>
    activeRowFilters.every((filter) => {
      const current = values[getFilterKey(filter)];
      if (filter.type === 'comparison') {
        return compare(row[filter.field], current.operator, current.value);
      }
      if (filter.type === 'dateRange') {
        return withinDateRange(row[filter.field], current.from, current.to);
      }
      return current.includes(String(row[filter.field] ?? ''));
    }));

  topNFilters.forEach((filter) => {
    if (!result.length || !Object.prototype.hasOwnProperty.call(result[0], filter.field)) return;
    const current = values?.[getFilterKey(filter)];
    const n = Number(current?.n);
    if (!Number.isFinite(n) || n <= 0) return;

    const direction = current?.direction === 'asc' ? 1 : -1;
    result = [...result]
      .sort((a, b) => direction * (Number(a[filter.field]) - Number(b[filter.field])))
      .slice(0, n);
  });

  return result;
};
