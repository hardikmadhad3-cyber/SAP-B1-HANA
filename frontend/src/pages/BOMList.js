import React from 'react';
import InventoryDocumentFindPage from '../components/InventoryDocumentFindPage';
import { listBOMs } from '../api/bomApi';

const typeLabel = (value) => ({
  iProductionTree: 'Production',
  iSalesTree: 'Sales',
  iTemplateTree: 'Template',
  iAssemblyTree: 'Assembly',
}[value] || value || '');

const columns = [
  { key: 'docNum', label: 'Product No' },
  { key: 'ProductDescription', label: 'Description' },
  { key: 'TreeType', label: 'Type', render: (row) => typeLabel(row.TreeType) },
  { key: 'Warehouse', label: 'Warehouse' },
  { key: 'Quantity', label: 'Quantity', align: 'end' },
  { key: 'PriceList', label: 'Price List' },
];

const filterFields = [
  { name: 'docNum', key: 'docNum', label: 'Product No', placeholder: 'Enter Product No' },
  { name: 'ProductDescription', key: 'ProductDescription', label: 'Description', placeholder: 'Description' },
  { name: 'TreeType', key: 'TreeType', label: 'Type', placeholder: 'Production, Sales, Template...' },
  { name: 'Warehouse', key: 'Warehouse', label: 'Warehouse', placeholder: 'Warehouse' },
];

const fetchDocuments = async () => {
  const rows = await listBOMs('', 5000, 0);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    docEntry: row.TreeCode,
    docNum: row.TreeCode || '',
  }));
};

export default function BOMList() {
  return (
    <InventoryDocumentFindPage
      title="Bill of Materials"
      subtitle="Filter by product, description, type, and warehouse."
      backPath="/bom"
      fetchDocuments={fetchDocuments}
      editPath="/bom"
      editStateKey="bomTreeCode"
      emptyLabel="bills of materials"
      loadingLabel="Loading bills of materials..."
      columns={columns}
      filterFields={filterFields}
      globalSearchPlaceholder="Search by product no, description, type, or warehouse"
      searchFields={['docNum', 'ProductDescription', 'TreeType', 'Warehouse']}
    />
  );
}
