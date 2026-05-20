import { fetchSalesOrderForCopy as fetchSalesOrderForDeliveryCopy } from '../api/deliveryApi';
import { BASE_TYPE, normaliseDocumentHeader, normaliseDocumentLine } from '../api/copyFromApi';
import { buildCopyToState, createCopyToWindowId, openCopyToDocument } from '../utils/copyToState';

const today = () => new Date().toISOString().split('T')[0];

const dateOnly = (value, fallback = '') => {
  if (!value) return fallback;
  const text = String(value);
  return text.includes('T') ? text.split('T')[0] : text.slice(0, 10);
};

const getDocEntry = (document, fallback) =>
  document?.DocEntry ?? document?.docEntry ?? document?.doc_entry ?? fallback;

const getDocNum = (document, fallback = '') =>
  document?.DocNum ?? document?.docNum ?? document?.doc_num ?? fallback;

const unwrapDocument = (payload = {}) =>
  payload.sales_order ||
  payload.salesOrder ||
  payload.document ||
  payload.delivery ||
  payload;

const getDocumentLines = (document = {}, payload = {}) =>
  document.DocumentLines ||
  document.lines ||
  payload.DocumentLines ||
  payload.lines ||
  [];

const mergeObjects = (...objects) =>
  objects.reduce((acc, object) => (
    object && typeof object === 'object' ? { ...acc, ...object } : acc
  ), {});

const getHeaderUdfs = (document = {}, payload = {}, snapshot = {}) =>
  mergeObjects(
    snapshot.headerUdfs,
    payload.header_udfs,
    payload.headerUdfs,
    document.header_udfs,
    document.headerUdfs
  );

const getLineUdfs = (line = {}) =>
  mergeObjects(line.line_udfs, line.lineUdfs, line.udf);

const copyTargetConfig = {
  salesOrder: {
    delivery: {
      targetDocType: 'delivery',
      targetLabel: 'Delivery',
      targetPath: '/delivery/new',
      targetAliases: ['/delivery'],
      requiresFetch: true,
    },
    'ar-invoice': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
    },
    'ar-dpm-request': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
      extraState: { dpmRequest: true },
    },
    'ar-dpm-invoice': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
      extraState: { dpmInvoice: true },
    },
  },
};

const sourceLabels = {
  salesOrder: 'Sales Order',
};

const sourceBaseTypes = {
  salesOrder: 17,
};

const fetchSourceForTarget = async ({ sourceDocType, targetDocType, sourceDocEntry }) => {
  if (sourceDocType === 'salesOrder' && targetDocType === 'delivery') {
    const response = await fetchSalesOrderForDeliveryCopy(sourceDocEntry);
    return response.data || {};
  }

  return null;
};

export const mapSalesOrderToDeliveryDraft = ({
  sourcePayload = {},
  sourceDocEntry,
  sourceDocNo,
  sourceSnapshot = {},
} = {}) => {
  const document = unwrapDocument(sourcePayload);
  const rawHeader = document.header
    ? { ...(sourceSnapshot.header || {}), ...document.header }
    : { ...(sourceSnapshot.header || {}), ...document };
  const normalizedHeader = normaliseDocumentHeader(rawHeader);
  const sourceLines = getDocumentLines(document, sourcePayload);
  const resolvedDocEntry = getDocEntry(document, sourcePayload.DocEntry ?? sourceDocEntry);
  const resolvedDocNum = getDocNum(document, sourcePayload.DocNum ?? sourceDocNo);
  const firstLine = Array.isArray(sourceLines) && sourceLines.length ? sourceLines[0] : {};
  const firstWarehouse =
    firstLine.whse ||
    firstLine.WarehouseCode ||
    firstLine.WhsCode ||
    rawHeader.warehouse ||
    '';
  const branch =
    normalizedHeader.branch ||
    rawHeader.branch ||
    rawHeader.BPL_IDAssignedToInvoice ||
    rawHeader.BPLId ||
    '';
  const deliveryHeader = {
    postingDate: today(),
    documentDate: today(),
    deliveryDate: dateOnly(rawHeader.deliveryDate || rawHeader.DocDueDate, today()),
    vendor: normalizedHeader.vendor || rawHeader.vendor || rawHeader.customerCode || rawHeader.CardCode || '',
    name: normalizedHeader.name || rawHeader.name || rawHeader.customerName || rawHeader.CardName || '',
    contactPerson: normalizedHeader.contactPerson || rawHeader.contactPerson || rawHeader.CntctCode || '',
    branch: String(branch || ''),
    warehouse: firstWarehouse,
    paymentTerms: String(normalizedHeader.paymentTerms || rawHeader.paymentTermsCode || rawHeader.paymentTerms || rawHeader.GroupNum || ''),
    placeOfSupply: normalizedHeader.placeOfSupply || rawHeader.placeOfSupply || rawHeader.PlaceOfSupply || '',
    otherInstruction: normalizedHeader.otherInstruction || rawHeader.otherInstruction || rawHeader.remarks || rawHeader.Comments || '',
    discount: rawHeader.discount ?? rawHeader.DiscPrcnt ?? '',
    freight: rawHeader.freight ?? rawHeader.Freight ?? '',
    tax: rawHeader.tax ?? rawHeader.TaxAmount ?? '',
    currency: rawHeader.currency || rawHeader.DocCur || 'INR',
    shipTo: rawHeader.shipTo || rawHeader.shipToAddress || rawHeader.Address || '',
    shipToCode: rawHeader.shipToCode || rawHeader.ShipToCode || '',
    shipToAddress: rawHeader.shipToAddress || rawHeader.shipTo || rawHeader.Address || '',
    payTo: rawHeader.payTo || rawHeader.billToAddress || rawHeader.Address2 || '',
    payToCode: rawHeader.payToCode || rawHeader.billToCode || rawHeader.PayToCode || '',
    billToCode: rawHeader.billToCode || rawHeader.payToCode || rawHeader.PayToCode || '',
    billToAddress: rawHeader.billToAddress || rawHeader.payTo || rawHeader.Address2 || '',
    sourceDocEntry: resolvedDocEntry,
    sourceDocNum: resolvedDocNum,
  };

  const deliveryLines = Array.isArray(sourceLines)
    ? sourceLines.map((line, index) => {
        const normalizedLine = normaliseDocumentLine(
          line,
          index,
          resolvedDocEntry,
          BASE_TYPE.salesOrder,
          deliveryHeader.branch
        );
        const baseLine = line.BaseLine ?? line.baseLine ?? line.LineNum ?? line.lineNum ?? normalizedLine.baseLine ?? index;

        return {
          ...line,
          ...normalizedLine,
          quantity: String(line.OpenQty ?? line.openQty ?? line.Quantity ?? line.quantity ?? normalizedLine.quantity ?? 0),
          uomCode: line.UomCode || line.unitMsr || line.uomCode || normalizedLine.uomCode || '',
          uomName: line.UomName || line.unitMsr || line.uomName || line.UomCode || line.uomCode || '',
          unitPrice: String(line.UnitPrice ?? line.Price ?? line.unitPrice ?? normalizedLine.unitPrice ?? 0),
          stdDiscount: String(line.DiscountPercent ?? line.DiscPrcnt ?? line.stdDiscount ?? normalizedLine.stdDiscount ?? 0),
          taxCode: normalizedLine.taxCode || line.TaxCode || line.VatGroup || line.taxCode || '',
          stcode: normalizedLine.stcode || line.STCODE || line.STACode || line.stcode || line.TaxCode || line.VatGroup || '',
          whse: normalizedLine.whse || line.WarehouseCode || line.WhsCode || line.whse || deliveryHeader.warehouse || '',
          total: line.LineTotal != null ? String(line.LineTotal) : (line.total != null ? String(line.total) : normalizedLine.total),
          taxAmount: line.TaxAmount != null ? String(line.TaxAmount) : (line.taxAmount != null ? String(line.taxAmount) : normalizedLine.taxAmount),
          baseEntry: line.BaseEntry ?? line.baseEntry ?? resolvedDocEntry,
          baseType: line.BaseType ?? line.baseType ?? BASE_TYPE.salesOrder,
          baseLine,
          lineNum: line.LineNum ?? line.lineNum ?? index,
          batchManaged: line.batchManaged ?? line.BatchManaged ?? false,
          batches: line.batches || line.Batches || line.BatchNumbers || [],
          serials: line.serials || line.SerialNumbers || [],
          bins: line.bins || line.BinAllocations || [],
          udf: getLineUdfs(line),
        };
      })
    : [];

  const draft = {
    targetDocType: 'delivery',
    source: {
      docType: 'salesOrder',
      label: 'Sales Order',
      docEntry: resolvedDocEntry,
      docNum: resolvedDocNum,
    },
    header: deliveryHeader,
    headerUdfs: getHeaderUdfs(document, sourcePayload, sourceSnapshot),
    lines: deliveryLines,
  };

  console.info('[CopyTo] mapped Sales Order -> Delivery draft', {
    sourceDocEntry: resolvedDocEntry,
    targetDocType: 'delivery',
    mappedHeader: draft.header,
    mappedRows: draft.lines,
  });

  return draft;
};

export const copyToDocument = async ({
  sourceDocType,
  targetType,
  sourceDocEntry,
  sourceDocNo,
  sourcePath,
  sourceSnapshot = {},
  restoreState = {},
  navigate,
  upsertTask,
  removeTask,
  beforeNavigate,
  setError,
  errorMessage,
}) => {
  const sourceConfig = copyTargetConfig[sourceDocType] || {};
  const targetConfig = sourceConfig[targetType];
  const sourceLabel = sourceLabels[sourceDocType] || 'Document';
  const baseType = sourceBaseTypes[sourceDocType];

  if (!sourceDocEntry) {
    setError?.(errorMessage || `Open a saved ${sourceLabel.toLowerCase()} before using Copy To.`);
    return false;
  }

  if (!targetConfig) {
    setError?.('Copy To is not configured for this target document.');
    return false;
  }

  console.info('[CopyTo] requested', {
    sourceDocType,
    sourceDocEntry,
    targetType,
    targetRoute: targetConfig.targetPath,
  });

  let sourcePayload = null;
  let copyToDraft = null;

  try {
    if (targetConfig.requiresFetch) {
      sourcePayload = await fetchSourceForTarget({
        sourceDocType,
        targetDocType: targetConfig.targetDocType,
        sourceDocEntry,
      });
      console.info('[CopyTo] fetched source document', {
        sourceDocType,
        sourceDocEntry,
        targetDocType: targetConfig.targetDocType,
        sourcePayload,
      });
    }

    if (sourceDocType === 'salesOrder' && targetConfig.targetDocType === 'delivery') {
      copyToDraft = mapSalesOrderToDeliveryDraft({
        sourcePayload,
        sourceDocEntry,
        sourceDocNo,
        sourceSnapshot,
      });
    }
  } catch (error) {
    console.error('[CopyTo] failed to prepare target draft', error);
    setError?.(error?.response?.data?.detail || error?.message || 'Failed to prepare copied document.');
    return false;
  }

  const document = unwrapDocument(sourcePayload || {});
  const sourceLines = getDocumentLines(document, sourcePayload || {});
  const copyState = buildCopyToState({
    sourceDocType,
    sourceLabel,
    sourceDocEntry,
    header: sourcePayload ? (document.header || document) : sourceSnapshot.header,
    lines: sourcePayload ? sourceLines : sourceSnapshot.lines,
    headerUdfs: sourcePayload ? getHeaderUdfs(document, sourcePayload, sourceSnapshot) : sourceSnapshot.headerUdfs,
    baseType,
    extraState: {
      ...(targetConfig.extraState || {}),
      ...(copyToDraft ? { copyToDraft } : {}),
    },
    extraCopyFrom: copyToDraft ? { loadMode: 'draft' } : {},
  });

  console.info('[CopyTo] final open request', {
    sourceDocEntry,
    targetDocType: targetConfig.targetDocType,
    targetRoute: targetConfig.targetPath,
    targetWindowId: createCopyToWindowId(targetConfig.targetDocType, sourceDocType, sourceDocEntry),
  });

  return openCopyToDocument({
    sourceDocType,
    sourceLabel,
    sourceDocEntry,
    sourceDocNo,
    sourcePath,
    targetDocType: targetConfig.targetDocType,
    targetLabel: targetConfig.targetLabel,
    targetPath: targetConfig.targetPath,
    targetAliases: targetConfig.targetAliases,
    copyState,
    restoreState,
    navigate,
    upsertTask,
    removeTask,
    beforeNavigate,
    setError,
    errorMessage,
  });
};
