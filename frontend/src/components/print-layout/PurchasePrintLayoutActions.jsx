import React from 'react';
import PrintLayoutToolbar from './PrintLayoutToolbar';

const DEFAULT_SCHEMA = process.env.REACT_APP_SAP_REPORT_SCHEMA || 'NCPL_110126';

const PURCHASE_PRINT_DOCUMENTS = {
  purchaseQuotation: {
    documentType: 'purchaseQuotation',
    documentLabel: 'Purchase Quotation',
  },
  purchaseOrder: {
    documentType: 'purchaseOrder',
    documentLabel: 'Purchase Order',
  },
  goodsReceiptPo: {
    documentType: 'goodsReceiptPo',
    documentLabel: 'Goods Receipt PO',
  },
  goodsReturn: {
    documentType: 'goodsReturn',
    documentLabel: 'Goods Return',
  },
  apInvoice: {
    documentType: 'apInvoice',
    documentLabel: 'A/P Invoice',
  },
  apCreditMemo: {
    documentType: 'apCreditMemo',
    documentLabel: 'A/P Credit Memo',
  },
};

function PurchasePrintLayoutActions({
  documentKey,
  docEntry,
  docNumber,
  disabled = false,
  defaultDocCode = '',
  defaultSchema = DEFAULT_SCHEMA,
  onSuccess,
  onError,
}) {
  const config = PURCHASE_PRINT_DOCUMENTS[documentKey];

  if (!config) {
    return null;
  }

  return (
    <PrintLayoutToolbar
      documentType={config.documentType}
      documentLabel={config.documentLabel}
      docEntry={docEntry}
      docNumber={docNumber}
      disabled={disabled}
      defaultDocCode={defaultDocCode}
      defaultSchema={defaultSchema}
      classPrefix="po"
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

export default PurchasePrintLayoutActions;
