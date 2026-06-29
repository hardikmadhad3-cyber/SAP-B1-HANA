import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { fetchGoodsReceipts } from '../api/goodsReceiptApi';

const columns = [
  { key: 'docNum', label: 'Doc No' },
  { key: 'postingDate', label: 'Posting Date', type: 'date' },
  { key: 'documentDate', label: 'Document Date', type: 'date' },
  { key: 'documentStatus', label: 'Status' },
  { key: 'journalRemark', label: 'Journal Remark' },
  {
    key: 'docTotal',
    label: 'Total',
    align: 'end',
    render: (document) => Number(document.docTotal || 0).toFixed(2),
  },
];

function GoodsReceiptList() {
  return (
    <InventoryDocumentFindPage
      title="Goods Receipts"
      backPath="/goods-receipt"
      fetchDocuments={fetchGoodsReceipts}
      editPath="/goods-receipt"
      editStateKey="goodsReceiptDocEntry"
      emptyLabel="goods receipts"
      loadingLabel="Loading goods receipts..."
      columns={columns}
      searchFields={['docNum', 'documentStatus', 'journalRemark', 'remarks', 'docTotal']}
    />
  );
}

export default GoodsReceiptList;
