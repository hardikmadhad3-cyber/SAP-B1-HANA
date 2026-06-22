import { render, screen } from '@testing-library/react';
import ContentsTab from './ContentsTab';

const baseProps = {
  onLineChange: jest.fn(),
  onNumBlur: jest.fn(),
  onAddLine: jest.fn(),
  onRemoveLine: jest.fn(),
  onOpenBatchModal: jest.fn(),
  onOpenItemModal: jest.fn(),
  onOpenHSNModal: jest.fn(),
  lineItemOptions: [],
  taxCodeOptions: [],
  warehouseOptions: [],
  uomOptions: [],
  formatTaxLabel: (value) => value,
  valErrors: { lines: {} },
  visibleRowUdfs: [],
  onRowUdfChange: jest.fn(),
  formSettings: { matrixColumns: {}, rowUdfs: {} },
};

test('renders packing type as a dropdown from live SAP UDF metadata', () => {
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ packingType: 'BAG' }]}
      visibleColumns={[{ key: 'packingType', label: 'Packing-Type', udfKey: 'U_PackingType' }]}
      visibleRowUdfs={[
        {
          key: 'U_PACKINGTYPE',
          label: 'Packing-Type',
          type: 'select',
          options: [{ value: 'BAG', label: 'Bag' }],
        },
      ]}
    />
  );

  const packingType = screen.getByRole('combobox');
  expect(packingType).toHaveValue('BAG');
  expect(screen.getByRole('option', { name: 'Bag' })).toBeInTheDocument();
});

test('keeps item no as a lookup input while mapped UDF columns render as dropdowns', () => {
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ itemNo: 'RM-001', packingType: 'Pallet' }]}
      visibleColumns={[
        { key: 'itemNo', label: 'Item No.', minWidth: 160 },
        { key: 'packingType', label: 'Packing-Type', udfKey: ['U_PackingType', 'U_PackingStatus'] },
      ]}
      visibleRowUdfs={[
        {
          key: 'U_PackingStatus',
          label: 'Packing Status',
          type: 'select',
          options: [{ value: 'Pallet', label: 'Pallet' }],
        },
      ]}
    />
  );

  const itemNo = screen.getByPlaceholderText('Item Code');
  expect(itemNo.tagName).toBe('INPUT');
  expect(itemNo).toHaveAttribute('data-sap-lookup', 'item');
  expect(screen.getByTitle('Select Item')).toBeInTheDocument();

  const packingType = screen.getByRole('combobox');
  expect(packingType).toHaveValue('Pallet');
  expect(packingType).toHaveAttribute('name', 'packingType');
});

test('keeps a loaded GRPO line warehouse even when it is not in filtered options', () => {
  render(
    <ContentsTab
      {...baseProps}
      lines={[{ whse: 'GJ-Sales' }]}
      visibleColumns={[{ key: 'whse', label: 'Whse' }]}
      warehouseOptions={[{ WhsCode: 'ACMECL' }]}
    />
  );

  const warehouse = screen.getByRole('combobox');
  expect(warehouse).toHaveValue('GJ-Sales');
  expect(screen.getByRole('option', { name: 'GJ-Sales' })).toBeInTheDocument();
});
