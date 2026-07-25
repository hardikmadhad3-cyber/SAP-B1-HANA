import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { fetchInventoryTransferList } from '../api/inventoryTransferApi';

const columns = [
  { key: 'docNum', label: 'Doc No' },
  { key: 'postingDate', label: 'Posting Date', type: 'date' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'fromWarehouse', label: 'From Warehouse' },
  { key: 'toWarehouse', label: 'To Warehouse' },
  { key: 'documentStatus', label: 'Status' },
  { key: 'journalRemark', label: 'Journal Remark' },
];

function InventoryTransferList() {
  return (
    <InventoryDocumentFindPage
      title="Inventory Transfers"
      backPath="/inventory-transfer"
      fetchDocuments={fetchInventoryTransferList}
      editPath="/inventory-transfer"
      editStateKey="inventoryTransferDocEntry"
      emptyLabel="inventory transfers"
      loadingLabel="Loading inventory transfers..."
      columns={columns}
      searchFields={[
        'docNum',
        'documentStatus',
        'fromWarehouse',
        'toWarehouse',
        'businessPartner',
        'businessPartnerName',
        'journalRemark',
        'remarks',
      ]}
    />
  );
}

export default InventoryTransferList;
