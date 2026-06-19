import { getWindowOnlyRouteState } from './copyToState';

const DUPLICATE_NOTIFICATION_DISMISS_MS = 6500;
const duplicateDismissTimers = new WeakMap();

const clonePlain = (value) => {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      acc[key] = clonePlain(entry);
      return acc;
    }, {});
  }
  return value;
};

const clearKeys = (target, keys, emptyValue = '') => {
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = emptyValue;
    }
  });
};

const setIfPresent = (target, key, value) => {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    target[key] = value;
  }
};

const HEADER_ID_KEYS = [
  'docEntry',
  'DocEntry',
  'doc_entry',
  'docNum',
  'DocNum',
  'doc_num',
  'docNo',
  'DocNo',
  'documentNumber',
  'DocumentNumber',
  'number',
  'Number',
];

const HEADER_NEXT_NUMBER_KEYS = [
  'nextNumber',
  'NextNumber',
  'nextNum',
  'NextNum',
  'nextDocNum',
  'NextDocNum',
  'nextDocumentNumber',
  'NextDocumentNumber',
];

const LINE_ID_KEYS = [
  'id',
  'Id',
  'lineId',
  'LineId',
  'line_id',
  'docEntry',
  'DocEntry',
  'docNum',
  'DocNum',
  'docNo',
  'DocNo',
  'targetEntry',
  'TargetEntry',
  'targetLine',
  'TargetLine',
  'targetType',
  'TargetType',
  'copyToTarget',
  'copyToTargetDocument',
];

const LINE_BASE_KEYS = [
  'baseEntry',
  'BaseEntry',
  'baseType',
  'BaseType',
  'baseLine',
  'BaseLine',
  'previousBaseEntry',
  'previousBaseType',
  'previousBaseLine',
];

export const buildDuplicateHeader = (header = {}, initialHeader = {}) => {
  const duplicate = {
    ...clonePlain(initialHeader || {}),
    ...clonePlain(header || {}),
  };

  clearKeys(duplicate, HEADER_ID_KEYS);
  clearKeys(duplicate, HEADER_NEXT_NUMBER_KEYS);
  const duplicateStatus = initialHeader?.status || 'Open';
  duplicate.status = duplicateStatus;
  duplicate.nextNumber = '';
  ['Status', 'documentStatus', 'DocumentStatus'].forEach((key) => setIfPresent(duplicate, key, duplicateStatus));
  ['canceled', 'cancelled', 'Canceled', 'Cancelled'].forEach((key) => setIfPresent(duplicate, key, false));

  return duplicate;
};

export const buildDuplicateLines = (lines = [], createLine, rowUdfDefinitions) => {
  const sourceLines = Array.isArray(lines) && lines.length ? lines : [];

  if (!sourceLines.length) {
    return [createLine(rowUdfDefinitions)];
  }

  return sourceLines.map((line) => {
    const duplicate = {
      ...clonePlain(createLine(rowUdfDefinitions)),
      ...clonePlain(line || {}),
    };
    const quantity = duplicate.quantity ?? duplicate.Quantity ?? duplicate.sQty ?? duplicate.SQty ?? '';

    clearKeys(duplicate, LINE_ID_KEYS);
    LINE_BASE_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(duplicate, key)) duplicate[key] = null;
    });

    duplicate.lineNum = undefined;
    duplicate.LineNum = undefined;
    setIfPresent(duplicate, 'lineStatus', 'Open');
    setIfPresent(duplicate, 'LineStatus', 'Open');

    if (Object.prototype.hasOwnProperty.call(duplicate, 'openQty')) duplicate.openQty = quantity;
    if (Object.prototype.hasOwnProperty.call(duplicate, 'OpenQty')) duplicate.OpenQty = quantity;
    if (Object.prototype.hasOwnProperty.call(duplicate, 'balQty')) duplicate.balQty = quantity;
    if (Object.prototype.hasOwnProperty.call(duplicate, 'BalQty')) duplicate.BalQty = quantity;
    if (Object.prototype.hasOwnProperty.call(duplicate, 'deliveredQty')) duplicate.deliveredQty = '';
    if (Object.prototype.hasOwnProperty.call(duplicate, 'DeliveredQty')) duplicate.DeliveredQty = '';
    if (Object.prototype.hasOwnProperty.call(duplicate, 'batches')) duplicate.batches = [];
    if (Object.prototype.hasOwnProperty.call(duplicate, 'batchAllocations')) duplicate.batchAllocations = [];
    duplicate.taxCodeManuallyOverridden = Boolean(duplicate.taxCode || duplicate.TaxCode || duplicate.VatGroup);

    return duplicate;
  });
};

export const duplicateDocumentInPlace = ({
  currentDocEntry,
  header,
  initialHeader,
  lines,
  createLine,
  rowUdfDefinitions,
  setCurrentDocEntry,
  setHeader,
  setLines,
  setActiveTab,
  setValErrors,
  setPageState,
  setSnapshotPending,
  setIsDirty,
  setFreightModal,
  navigate,
  location,
  successMessage = 'Document duplicated. Review and add it as a new entry.',
  dismissAfterMs = DUPLICATE_NOTIFICATION_DISMISS_MS,
}) => {
  if (!currentDocEntry) return false;

  if (navigate && location?.pathname) {
    navigate(location.pathname, {
      replace: true,
      state: getWindowOnlyRouteState(location.state),
    });
  }

  setSnapshotPending?.(false);
  setCurrentDocEntry?.(null);
  setHeader?.(buildDuplicateHeader(header, initialHeader));
  setLines?.(buildDuplicateLines(lines, createLine, rowUdfDefinitions));
  setActiveTab?.('Contents');
  setValErrors?.({ header: {}, lines: {}, form: '' });
  setFreightModal?.({ open: false, freightCharges: [], loading: false });
  setIsDirty?.(true);
  setPageState?.((prev) => ({
    ...prev,
    error: '',
    success: successMessage,
  }));

  if (typeof window !== 'undefined' && typeof setPageState === 'function' && dismissAfterMs > 0) {
    const existingTimer = duplicateDismissTimers.get(setPageState);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      setPageState((prev) => {
        if (prev?.success !== successMessage) return prev;
        return { ...prev, success: '' };
      });
      duplicateDismissTimers.delete(setPageState);
    }, dismissAfterMs);

    duplicateDismissTimers.set(setPageState, timer);
  }

  return true;
};

export const refreshDuplicateSeries = (seriesList = [], currentSeries, handleSeriesChange) => {
  if (typeof handleSeriesChange !== 'function') return;
  const selectedSeries =
    seriesList.find((series) => String(series.Series || '') === String(currentSeries || '')) ||
    seriesList[0];
  if (selectedSeries?.Series != null) {
    handleSeriesChange(selectedSeries.Series);
  }
};
