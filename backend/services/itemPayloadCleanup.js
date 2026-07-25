const ROOT_ONLY_FIELDS = new Set(['ItemCode', 'ItemName', 'Series']);

const READ_ONLY_ITEM_FIELDS = new Set([
  'DocEntry',
  'CreateDate',
  'CreateTime',
  'UpdateDate',
  'UpdateTime',
  'LogInstanc',
  'DataSource',
  'UserSign',
  'UserSign2',
  'Transfered',
  'Canceled',
  'CancelDate',
  'ObjectType',
  'AttachmentEntry',
  'LastPurDat',
  'LastPurPrc',
  'LastPurCur',
  'LastPurPrcFc',
  'LastPurPrcSC',
  'LastPurPrcSys',
  'AvgStdPrice',
  'AvgPrice',
  'MovingAveragePrice',
  'QuantityOnStock',
  'QuantityOrderedFromVendors',
  'QuantityOrderedByCustomers',
  'CountedQuantity',
  'InventoryValue',
  'StockValue',
  'OpenBlnc',
  'NoOfSubstituteItems',
  'NoOfItemComponents',
  'NoOfResourceComponents',
  'NoOfRouteStages',
]);

const READ_ONLY_COLLECTION_FIELDS = new Set([
  'ItemCode',
  'ItemNo',
  'LineNum',
  'LineNumber',
  'VisualOrder',
  'RowNum',
  'AbsEntry',
  'BcdEntry',
  'BarcodeEntry',
  'ObjectKey',
  'PriceListName',
  'WarehouseName',
  'Branch',
  'BranchId',
  'AlternateUoMName',
  'VendorName',
  'UoMName',
  'UoMCode',
  'LogInstanc',
  'CreateDate',
  'CreateTime',
  'UpdateDate',
  'UpdateTime',
  'DataSource',
  'UserSign',
  'UserSign2',
  'InStock',
  'Committed',
  'Ordered',
  'Available',
  'CountedQuantity',
  'StandardAveragePrice',
  'AvgPrice',
  'InventoryValue',
  'StockValue',
]);

const SAP_INTERNAL_COLLECTIONS = new Set([
  'ItemLocalizationInfos',
]);

const CLIENT_CONTROL_FIELDS = new Set([
  '_duplicateFromItemCode',
  'duplicateFromItemCode',
  'DuplicateFromItemCode',
]);

const isMetadataKey = (key) => {
  const normalized = String(key || '').trim().toLowerCase();
  return normalized === '__metadata'
    || normalized.startsWith('@odata')
    || normalized.startsWith('odata.');
};

const shouldStripField = (key, depth) => {
  if (isMetadataKey(key)) return true;
  if (CLIENT_CONTROL_FIELDS.has(key)) return true;
  if (depth > 0 && ROOT_ONLY_FIELDS.has(key)) return true;
  if (READ_ONLY_ITEM_FIELDS.has(key)) return true;
  if (depth > 0 && READ_ONLY_COLLECTION_FIELDS.has(key)) return true;
  if (SAP_INTERNAL_COLLECTIONS.has(key)) return true;
  return false;
};

const cleanupItemCreatePayload = (value, depth = 0) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => cleanupItemCreatePayload(entry, depth + 1))
      .filter((entry) => entry !== undefined);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  return Object.entries(value).reduce((payload, [key, entry]) => {
    if (shouldStripField(key, depth)) {
      return payload;
    }

    const cleaned = cleanupItemCreatePayload(entry, depth + 1);
    if (cleaned !== undefined) {
      payload[key] = cleaned;
    }
    return payload;
  }, {});
};

module.exports = {
  cleanupItemCreatePayload,
};
