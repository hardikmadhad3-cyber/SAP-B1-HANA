import { buildCopyToState, createCopyToWindowId, openCopyToDocument } from '../utils/copyToState';

const copyTargetConfig = {
  salesQuotation: {
    'sales-order': {
      targetDocType: 'salesOrder',
      targetLabel: 'Sales Order',
      targetPath: '/sales-order',
    },
    delivery: {
      targetDocType: 'delivery',
      targetLabel: 'Delivery',
      targetPath: '/delivery/new',
      targetAliases: ['/delivery'],
    },
    'ar-invoice': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
    },
  },
  salesOrder: {
    delivery: {
      targetDocType: 'delivery',
      targetLabel: 'Delivery',
      targetPath: '/delivery/new',
      targetAliases: ['/delivery'],
    },
    'ar-invoice': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
    },
  },
  dcSalesOrder: {
    delivery: {
      targetDocType: 'delivery',
      targetLabel: 'Delivery',
      targetPath: '/delivery/new',
      targetAliases: ['/delivery'],
    },
    'ar-invoice': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
    },
  },
  delivery: {
    'ar-invoice': {
      targetDocType: 'arInvoice',
      targetLabel: 'A/R Invoice',
      targetPath: '/ar-invoice',
    },
  },
  arInvoice: {
    'ar-credit-memo': {
      targetDocType: 'arCreditMemo',
      targetLabel: 'A/R Credit Memo',
      targetPath: '/ar-credit-memo',
    },
    arCreditMemo: {
      targetDocType: 'arCreditMemo',
      targetLabel: 'A/R Credit Memo',
      targetPath: '/ar-credit-memo',
    },
  },
  serviceArInvoice: {
    arCreditMemo: {
      targetDocType: 'arCreditMemo',
      targetLabel: 'A/R Credit Memo',
      targetPath: '/ar-credit-memo',
    },
    'ar-credit-memo': {
      targetDocType: 'arCreditMemo',
      targetLabel: 'A/R Credit Memo',
      targetPath: '/ar-credit-memo',
    },
  },
  serviceApInvoice: {
    apCreditMemo: {
      targetDocType: 'apCreditMemo',
      targetLabel: 'A/P Credit Memo',
      targetPath: '/ap-credit-memo',
    },
    'ap-credit-memo': {
      targetDocType: 'apCreditMemo',
      targetLabel: 'A/P Credit Memo',
      targetPath: '/ap-credit-memo',
    },
  },
  purchaseQuotation: {
    'purchase-order': {
      targetDocType: 'purchaseOrder',
      targetLabel: 'Purchase Order',
      targetPath: '/purchase-order',
    },
    purchaseOrder: {
      targetDocType: 'purchaseOrder',
      targetLabel: 'Purchase Order',
      targetPath: '/purchase-order',
    },
  },
  purchaseOrder: {
    grpo: {
      targetDocType: 'grpo',
      targetLabel: 'Goods Receipt PO',
      targetPath: '/grpo',
    },
  },
  grpo: {
    'ap-invoice': {
      targetDocType: 'apInvoice',
      targetLabel: 'A/P Invoice',
      targetPath: '/ap-invoice',
    },
    apInvoice: {
      targetDocType: 'apInvoice',
      targetLabel: 'A/P Invoice',
      targetPath: '/ap-invoice',
    },
  },
  apInvoice: {
    'ap-credit-memo': {
      targetDocType: 'apCreditMemo',
      targetLabel: 'A/P Credit Memo',
      targetPath: '/ap-credit-memo',
    },
    apCreditMemo: {
      targetDocType: 'apCreditMemo',
      targetLabel: 'A/P Credit Memo',
      targetPath: '/ap-credit-memo',
    },
  },
};

const sourceLabels = {
  salesQuotation: 'Sales Quotation',
  salesOrder: 'Sales Order',
  dcSalesOrder: 'DC Sales Order',
  delivery: 'Delivery',
  arInvoice: 'A/R Invoice',
  serviceArInvoice: 'Service A/R Invoice',
  serviceApInvoice: 'Service A/P Invoice',
  purchaseQuotation: 'Purchase Quotation',
  purchaseOrder: 'Purchase Order',
  grpo: 'Goods Receipt PO',
  apInvoice: 'A/P Invoice',
};

const sourceBaseTypes = {
  salesQuotation: 23,
  salesOrder: 17,
  dcSalesOrder: 17,
  delivery: 15,
  arInvoice: 13,
  serviceArInvoice: 13,
  serviceApInvoice: 18,
  purchaseQuotation: 540000006,
  purchaseOrder: 22,
  grpo: 20,
  apInvoice: 18,
};

export const getCopyToTargets = (sourceDocType) => {
  const sourceConfig = copyTargetConfig[sourceDocType] || {};
  return Object.entries(sourceConfig)
    .filter(([key]) => !key.includes('-') || !sourceConfig[key.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())])
    .map(([key, config]) => ({
      key,
      label: config.targetLabel,
      targetDocType: config.targetDocType,
      targetPath: config.targetPath,
    }));
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

  const copyState = buildCopyToState({
    sourceDocType,
    sourceLabel,
    sourceDocEntry,
    header: sourceSnapshot.header,
    lines: sourceSnapshot.lines,
    headerUdfs: sourceSnapshot.headerUdfs,
    baseType,
    extraState: targetConfig.extraState,
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
