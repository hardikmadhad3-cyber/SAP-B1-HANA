import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { fetchInventoryTransferRequestList } from '../api/inventoryTransferRequestApi';

const columns = [
  { key: 'docNum', label: 'Doc No' },
  { key: 'postingDate', label: 'Posting Date', type: 'date' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  {
    key: 'businessPartner',
    label: 'Business Partner',
    render: (document) =>
      document.businessPartner
        ? `${document.businessPartner} - ${document.businessPartnerName || ''}`.trim()
        : '',
  },
  { key: 'fromWarehouse', label: 'From Warehouse' },
  { key: 'toWarehouse', label: 'To Warehouse' },
  { key: 'documentStatus', label: 'Status' },
];

function InventoryTransferRequestList() {
  return (
    <InventoryDocumentFindPage
      title="Inventory Transfer Requests"
      backPath="/inventory-transfer-request"
      fetchDocuments={fetchInventoryTransferRequestList}
      editPath="/inventory-transfer-request"
      editStateKey="inventoryTransferRequestDocEntry"
      emptyLabel="inventory transfer requests"
      loadingLabel="Loading inventory transfer requests..."
      columns={columns}
      searchFields={[
        'docNum',
        'documentStatus',
        'businessPartner',
        'businessPartnerName',
        'fromWarehouse',
        'toWarehouse',
        'journalRemark',
        'remarks',
      ]}
    />
  );
}

export default InventoryTransferRequestList;
