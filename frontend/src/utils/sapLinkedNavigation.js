import {
  createActiveCompanyScopedRouteState,
} from './companyStorageScope';
import {
  minimizeSourceDocumentWindow,
  normalizeCopyToPath,
  restoreTargetWindowState,
} from './copyToState';

export const DOCUMENT_LINKS_BY_REFERENCE_TYPE = {
  '13': { path: '/ar-invoice', stateKey: 'arInvoiceDocEntry', label: 'A/R Invoice' },
  '14': { path: '/ar-credit-memo', stateKey: 'arCreditMemoDocEntry', label: 'A/R Credit Memo' },
  '15': { path: '/delivery', stateKey: 'deliveryDocEntry', label: 'Delivery' },
  '17': { path: '/sales-order', stateKey: 'salesOrderDocEntry', label: 'Sales Order' },
  '18': { path: '/ap-invoice', stateKey: 'apInvoiceDocEntry', label: 'A/P Invoice' },
  '19': { path: '/ap-credit-memo', stateKey: 'apCreditMemoDocEntry', label: 'A/P Credit Memo' },
  '20': { path: '/grpo', stateKey: 'grpoDocEntry', label: 'Goods Receipt PO' },
  '22': { path: '/purchase-order', stateKey: 'purchaseOrderDocEntry', label: 'Purchase Order' },
  '23': { path: '/sales-quotation', stateKey: 'salesQuotationDocEntry', label: 'Sales Quotation' },
  '540000006': { path: '/purchase-quotation', stateKey: 'purchaseQuotationDocEntry', label: 'Purchase Quotation' },
  '1470000113': { path: '/purchase-request', stateKey: 'purchaseRequestDocEntry', label: 'Purchase Request' },
  goodsReceipt: { path: '/goods-receipt', stateKey: 'goodsReceiptDocEntry', label: 'Goods Receipt' },
  goodsIssue: { path: '/goods-issue', stateKey: 'goodsIssueDocEntry', label: 'Goods Issue' },
  inventoryTransferRequest: { path: '/inventory-transfer-request', stateKey: 'inventoryTransferRequestDocEntry', label: 'Inventory Transfer Request' },
  inventoryTransfer: { path: '/inventory-transfer', stateKey: 'inventoryTransferDocEntry', label: 'Inventory Transfer' },
};

const REFERENCE_TYPE_ALIASES = {
  'A/P Credit Memo': '19',
  'A/P Invoice': '18',
  'A/R Credit Memo': '14',
  'A/R Invoice': '13',
  Delivery: '15',
  'Delivery Notes': '15',
  'Goods Issue': 'goodsIssue',
  'Goods Receipt': 'goodsReceipt',
  'Goods Receipt PO': '20',
  'Inventory Transfer': 'inventoryTransfer',
  'Inventory Transfer Request': 'inventoryTransferRequest',
  'Purchase Order': '22',
  'Purchase Quotation': '540000006',
  'Purchase Request': '1470000113',
  'Sales Order': '17',
  'Sales Quotation': '23',
};

const normalizeIdPart = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const buildSourceState = ({ sourcePath, sourceTitle, sourceRestoreState }) => {
  const normalizedSourcePath = normalizeCopyToPath(sourcePath || window.location.pathname);
  const sourceWindow = sourceRestoreState?.sapWindow || {
    id: `page-window:${normalizedSourcePath}`,
    path: normalizedSourcePath,
    title: sourceTitle,
  };

  return createActiveCompanyScopedRouteState({
    ...(sourceRestoreState || {}),
    sapWindow: sourceWindow,
  });
};

const openLinkedTarget = ({
  sourcePath,
  sourceTitle,
  sourceRestoreState,
  targetPath,
  targetTitle,
  targetState,
  targetWindowId,
  navigate,
  upsertTask,
}) => {
  if (!targetPath || !navigate) return false;

  const sourceState = buildSourceState({ sourcePath, sourceTitle, sourceRestoreState });
  const normalizedSourcePath = normalizeCopyToPath(sourcePath || window.location.pathname);
  const targetWindow = {
    id: targetWindowId,
    path: targetPath,
    title: targetTitle,
  };
  const nextTargetState = createActiveCompanyScopedRouteState({
    ...(targetState || {}),
    sapWindow: targetWindow,
  });

  minimizeSourceDocumentWindow({
    pathname: normalizedSourcePath,
    title: sourceTitle,
    restoreState: sourceState,
    upsertTask,
    dispatchEvent: true,
  });
  restoreTargetWindowState(targetPath, targetWindowId);
  navigate(targetPath, { state: nextTargetState, replace: false });
  return true;
};

export const openLinkedBusinessPartner = ({
  cardCode,
  sourcePath,
  sourceTitle = 'Document',
  sourceRestoreState,
  navigate,
  upsertTask,
}) => {
  const normalizedCardCode = String(cardCode || '').trim();
  if (!normalizedCardCode) return false;

  return openLinkedTarget({
    sourcePath,
    sourceTitle,
    sourceRestoreState,
    targetPath: `/business-partner?cardCode=${encodeURIComponent(normalizedCardCode)}`,
    targetTitle: `Business Partner ${normalizedCardCode}`,
    targetState: {
      businessPartnerCardCode: normalizedCardCode,
      cardCode: normalizedCardCode,
    },
    targetWindowId: `page-window:business-partner-${normalizeIdPart(normalizedCardCode) || 'card'}`,
    navigate,
    upsertTask,
  });
};

export const openLinkedReferenceDocument = ({
  transactionType,
  docEntry,
  docNumber,
  sourcePath,
  sourceTitle = 'Document',
  sourceRestoreState,
  navigate,
  upsertTask,
}) => {
  const rawTransactionType = String(transactionType || '').trim();
  const normalizedTransactionType = DOCUMENT_LINKS_BY_REFERENCE_TYPE[rawTransactionType]
    ? rawTransactionType
    : REFERENCE_TYPE_ALIASES[rawTransactionType];
  const link = DOCUMENT_LINKS_BY_REFERENCE_TYPE[normalizedTransactionType];
  const normalizedDocEntry = String(docEntry || '').trim();
  if (!link || !normalizedDocEntry) return false;

  return openLinkedTarget({
    sourcePath,
    sourceTitle,
    sourceRestoreState,
    targetPath: link.path,
    targetTitle: `${link.label}${docNumber || normalizedDocEntry ? ` #${docNumber || normalizedDocEntry}` : ''}`,
    targetState: {
      [link.stateKey]: normalizedDocEntry,
      docEntry: normalizedDocEntry,
    },
    targetWindowId: `page-window:${normalizeIdPart(link.label)}-${normalizeIdPart(normalizedDocEntry)}`,
    navigate,
    upsertTask,
  });
};
