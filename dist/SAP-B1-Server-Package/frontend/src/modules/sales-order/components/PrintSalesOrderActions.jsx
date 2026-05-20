import React from 'react';
import PrintLayoutToolbar from '../../../components/print-layout/PrintLayoutToolbar';

const DEFAULT_DOC_CODE = 'RDR20010';
const DEFAULT_SCHEMA = process.env.REACT_APP_SAP_REPORT_SCHEMA || 'NCPL_110126';

function PrintSalesOrderActions({
  docEntry,
  docNumber,
  disabled = false,
  defaultDocCode = DEFAULT_DOC_CODE,
  defaultSchema = DEFAULT_SCHEMA,
  onSuccess,
  onError,
}) {
  return (
    <PrintLayoutToolbar
      documentType="salesOrder"
      documentLabel="Sales Order"
      docEntry={docEntry}
      docNumber={docNumber}
      disabled={disabled}
      defaultDocCode={defaultDocCode}
      defaultSchema={defaultSchema}
      classPrefix="so"
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

export default PrintSalesOrderActions;
