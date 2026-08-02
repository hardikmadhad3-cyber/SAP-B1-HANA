import { buildSalesOrderMatrixColumnsFromLayout } from './documentLayout';

describe('buildSalesOrderMatrixColumnsFromLayout', () => {
  it('keeps Item No. on the standard item lookup renderer when SAP layout marks it as a UDF column', () => {
    const [itemColumn] = buildSalesOrderMatrixColumnsFromLayout({
      includeLineNumber: false,
      layoutColumns: [
        {
          fieldName: 'U_ItemCode',
          columnUid: 'U_ItemCode',
          columnTitle: 'Item No.',
          columnOrder: 1,
          width: 160,
          dataType: 'string',
          isUdf: true,
        },
      ],
      liveMatrixColumns: [
        {
          key: 'itemNo',
          label: 'Item No.',
          sapField: 'ItemCode',
          minWidth: 160,
        },
      ],
      rowUdfFields: [
        {
          key: 'U_ItemCode',
          label: 'Item No.',
          type: 'select',
          options: ['A0001', 'A0002'],
        },
      ],
    });

    expect(itemColumn).toMatchObject({
      key: 'itemNo',
      valueKey: 'itemNo',
      rendererKey: 'itemNo',
      isUdf: false,
      type: 'text',
    });
    expect(itemColumn.options).toBeUndefined();
  });
});
