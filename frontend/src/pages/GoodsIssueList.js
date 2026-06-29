import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { fetchGoodsIssueList } from '../api/goodsIssueApi';

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

function GoodsIssueList() {
  return (
    <InventoryDocumentFindPage
      title="Goods Issues"
      backPath="/goods-issue"
      fetchDocuments={fetchGoodsIssueList}
      editPath="/goods-issue"
      editStateKey="goodsIssueDocEntry"
      emptyLabel="goods issues"
      loadingLabel="Loading goods issues..."
      columns={columns}
      searchFields={['docNum', 'documentStatus', 'journalRemark', 'remarks', 'docTotal']}
    />
  );
}

export default GoodsIssueList;
