import { render, screen } from '@testing-library/react';
import { hydrateDocumentLineFromItem } from '../../../utils/documentItemHydration';
import { hydrateWorkbookDocumentLine } from '../../../utils/workbookLineHydration';
import { getLineTotalsForDisplay } from '../../../utils/lineTotals';
import { buildMatrixColumnsFromSapLayout } from '../../../utils/liveDocumentLayout';
import { getDefaultSeriesForCurrentYear } from '../../../utils/seriesDefaults';
import { buildDuplicateHeader } from '../../../utils/documentDuplicate';
import { BASE_MATRIX_COLUMNS } from '../../../config/purchaseOrderForm';
import ContentsTab from '../components/ContentsTab';
import {
  buildPurchaseOrderLineUdfPayload,
  hydratePurchaseOrderLineUdfFields,
} from '../purchaseOrderLineUdfMapping';

const createLine = () => ({
  itemNo: '',
  unitPrice: '',
  unitPriceUdf: '',
  sellerItem: '',
  total: '',
  udf: {},
});

describe('purchase order live data mapping', () => {
  it('loads the purchase order contents table component', () => {
    expect(ContentsTab).toBeDefined();
  });

  it('renders packing type as a dropdown from live SAP UDF metadata aliases', () => {
    render(
      <ContentsTab
        lines={[{ packingType: 'Carton', udf: {} }]}
        onLineChange={jest.fn()}
        onNumBlur={jest.fn()}
        onAddLine={jest.fn()}
        onRemoveLine={jest.fn()}
        lineItemOptions={[]}
        getUomOptions={() => []}
        effectiveTaxCodes={[]}
        effectiveWarehouses={[]}
        valErrors={{ lines: {} }}
        onOpenHSNModal={jest.fn()}
        onOpenItemModal={jest.fn()}
        matrixFields={[]}
        formSettings={{ matrixColumns: {}, rowUdfs: {} }}
        rowUdfFields={[
          {
            key: 'U_PACKINGTYPE',
            label: 'Packing-Type',
            type: 'select',
            options: [{ value: 'Carton', label: 'Carton' }],
          },
        ]}
        onRowUdfChange={jest.fn()}
      />
    );

    const packingType = screen.getAllByRole('combobox').find((field) => field.getAttribute('name') === 'packingType');
    expect(packingType).toHaveValue('Carton');
    expect(screen.getByRole('option', { name: 'Carton' })).toBeInTheDocument();
  });

  it('keeps SAP matrix total as line total before tax', () => {
    expect(getLineTotalsForDisplay({ total: '1086680.0000', taxCode: '5-GST' }, [{ Code: '5-GST', Rate: 5 }]))
      .toEqual({ beforeTax: '1086680.0000', total: '1086680.0000' });
  });

  it('displays FOR-Price from unit price plus tax rate when no stored FOR value exists', () => {
    render(
      <ContentsTab
        lines={[{ itemNo: 'CARTON', unitPrice: '22.000000', taxCode: '12-GST', forRate: '', udf: {} }]}
        onLineChange={jest.fn()}
        onNumBlur={jest.fn()}
        onAddLine={jest.fn()}
        onRemoveLine={jest.fn()}
        lineItemOptions={[]}
        getUomOptions={() => []}
        effectiveTaxCodes={[{ Code: '12-GST', Rate: 12 }]}
        effectiveWarehouses={[]}
        valErrors={{ lines: {} }}
        onOpenHSNModal={jest.fn()}
        onOpenItemModal={jest.fn()}
        matrixFields={[]}
        formSettings={{ matrixColumns: {}, rowUdfs: {} }}
        rowUdfFields={[]}
        onRowUdfChange={jest.fn()}
      />
    );

    expect(screen.getByDisplayValue('24.64000')).toBeInTheDocument();
  });

  it('does not copy standard unit price into UDF unit price while hydrating SAP lines', () => {
    const line = hydrateWorkbookDocumentLine({
      line: { ItemCode: 'Y001', UnitPrice: '155.24', Price: '155.24' },
      createLine,
      rowUdfDefinitions: [],
    });

    expect(line.unitPrice).toBe('155.24');
    expect(line.unitPriceUdf).toBe('');
    expect(line.udf.U_Unit_Price).toBeUndefined();
  });

  it('does not copy selected item code or price into UDF-backed line fields', () => {
    const line = hydrateDocumentLineFromItem(createLine(), {
      ItemCode: 'Y001',
      ItemName: 'Cotton Yarn',
      SalesUnit: 'KGS',
      UnitPrice: '155.24',
    }, {
      side: 'sales',
      preserveQuantity: false,
    });

    expect(line.itemNo).toBe('Y001');
    expect(line.unitPrice).toBe('155.24');
    expect(line.unitPriceUdf).toBe('');
    expect(line.sellerItem).toBe('');
  });

  it('hydrates purchase order mapped UDF fields from SAP aliases without using standard price fields', () => {
    const line = hydratePurchaseOrderLineUdfFields({
      UnitPrice: '256.1900',
      Price: '256.1900',
      udf: {
        U_PackingType: 'Carton',
        U_FOR_PRICE: '268.99950',
        U_GrossWt: '1200.0000',
        U_TotalPackage: '122',
        U_Buyer_Brokerage: '15.50',
        U_COMPRC: '1.00',
      },
      CommissionPercent: '2.50',
    });

    expect(line.packingType).toBe('Carton');
    expect(line.forRate).toBe('268.99950');
    expect(line.grossWt).toBe('1200.0000');
    expect(line.totalPackage).toBe('122');
    expect(line.buyerBrokerage).toBe('15.50');
    expect(line.commPercent).toBe('2.50');
    expect(line.commission).toBe('1.00');
    expect(line.price).toBe('');
  });

  it('hydrates purchase order mapped UDF fields from uppercase metadata keys', () => {
    const line = hydratePurchaseOrderLineUdfFields({
      udf: {
        U_PACKINGTYPE: 'Pallet',
        U_GROSSWT: '1200.0000',
        U_TOTALPACKAGE: '122',
      },
    });

    expect(line.packingType).toBe('Pallet');
    expect(line.grossWt).toBe('1200.0000');
    expect(line.totalPackage).toBe('122');
  });

  it('saves mapped purchase order UDF values to the live SAP UDF keys only', () => {
    const payload = buildPurchaseOrderLineUdfPayload(
      {
        unitPrice: '256.1900',
        packingType: 'Carton',
        forRate: '268.99950',
        grossWt: '1200.0000',
        totalPackage: '122',
        buyerBrokerage: '15.50',
        commPercent: '1.00',
        commission: '2.00',
        price: '',
        udf: {},
      },
      [
        { key: 'U_PACKINGTYPE', active: true, visible: true },
        { key: 'U_FOR_PRICE', active: true, visible: true },
        { key: 'U_GrossWt', active: true, visible: true },
        { key: 'U_TotalPackage', active: true, visible: true },
        { key: 'U_Brok_Buyer', active: true, visible: true },
        { key: 'U_COMPRC', active: true, visible: true },
        { key: 'U_PRICE', active: true, visible: true },
      ],
      { matrixColumns: {}, rowUdfs: {} }
    );

    expect(payload).toEqual({
      U_PACKINGTYPE: 'Carton',
      U_FOR_PRICE: '268.99950',
      U_GrossWt: '1200.0000',
      U_TotalPackage: '122',
      U_Brok_Buyer: '15.50',
      U_COMPRC: '2.00',
    });
    expect(payload.U_PRICE).toBeUndefined();
  });

  it('does not save visible Comm. % into the U_COMPRC commission UDF', () => {
    const payload = buildPurchaseOrderLineUdfPayload(
      {
        commPercent: '3.50',
        commission: '',
        udf: {},
      },
      [{ key: 'U_COMPRC', active: true, visible: true }],
      { matrixColumns: {}, rowUdfs: {} }
    );

    expect(payload.U_COMPRC).toBeUndefined();
  });

  it('maps SAP POR1.Commission layout column to visible Comm. % field', () => {
    const columns = buildMatrixColumnsFromSapLayout({
      baseColumns: BASE_MATRIX_COLUMNS,
      layoutColumns: [
        {
          fieldName: 'Commission',
          columnTitle: 'Commission Percentage',
          columnUid: '28',
          columnOrder: 1,
          visible: true,
          editable: true,
        },
        {
          fieldName: 'U_COMPRC',
          columnTitle: 'Commision',
          columnUid: 'U_COMPRC',
          columnOrder: 2,
          visible: true,
          editable: true,
        },
      ],
    });

    expect(columns[0].key).toBe('commPercent');
    expect(columns[1].key).toBe('commission');
  });

  it('prefers live SAP series whose date range contains the document date', () => {
    const series = getDefaultSeriesForCurrentYear([
      { Series: 1, SeriesName: 'DPO2425', Indicator: '2024-25', FromDate: '2024-04-01', ToDate: '2025-03-31' },
      { Series: 2, SeriesName: 'DPO2526', Indicator: '2025-26', FromDate: '2025-04-01', ToDate: '2026-03-31' },
    ], new Date('2025-07-26T00:00:00'));

    expect(series.Series).toBe(2);
  });

  it('does not carry an unapproved state into duplicated purchase orders', () => {
    const header = buildDuplicateHeader(
      { docNo: '441', status: 'Open', confirmed: false, Confirmed: 'N' },
      { status: 'Open', confirmed: true }
    );

    expect(header.docNo).toBe('');
    expect(header.status).toBe('Open');
    expect(header.confirmed).toBe(true);
    expect(header.Confirmed).toBe('Y');
  });
});
