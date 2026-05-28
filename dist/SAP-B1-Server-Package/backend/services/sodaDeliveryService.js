const db = require('./dbService');
const sapService = require('./sapService');
const deliveryService = require('./deliveryService');

const SODA_DELIVERY_LINE_UDFS = [
  {
    tableName: 'DLN1',
    name: 'S_BrokPerQty',
    fieldName: 'U_S_BrokPerQty',
    description: 'comm amt per tone',
    type: 'db_Float',
    subType: 'st_Price',
  },
  {
    tableName: 'DLN1',
    name: 'COMPRC',
    fieldName: 'U_COMPRC',
    description: 'Commission (Percent)',
    type: 'db_Float',
    subType: 'st_Percentage',
  },
  {
    tableName: 'DLN1',
    name: 'Brok_Seller',
    fieldName: 'U_Brok_Seller',
    description: 'Commission',
    type: 'db_Float',
    subType: 'st_Sum',
  },
  {
    tableName: 'DLN1',
    name: 'Seller_Payment_Terms',
    fieldName: 'U_Seller_Payment_Terms',
    description: 'Seller - Terms of Payment',
    type: 'db_Alpha',
    size: 100,
  },
];

let ensureUdfsPromise = null;

const getExistingLineUdfs = async () => {
  const rows = await db.query(`
    SELECT AliasID
    FROM CUFD
    WHERE TableID = 'DLN1'
      AND AliasID IN (${SODA_DELIVERY_LINE_UDFS.map((_, index) => `@alias${index}`).join(', ')})
  `, SODA_DELIVERY_LINE_UDFS.reduce((params, udf, index) => {
    params[`alias${index}`] = udf.name;
    return params;
  }, {}));

  return new Set((rows.recordset || []).map((row) => String(row.AliasID || '').trim().toUpperCase()));
};

const isAlreadyExistsError = (error) => {
  const detail = JSON.stringify(error.response?.data || error.message || '').toLowerCase();
  return detail.includes('already') || detail.includes('exists') || detail.includes('-2035');
};

const createLineUdf = async (udf) => {
  const data = {
    TableName: udf.tableName,
    Name: udf.name,
    Description: udf.description,
    Type: udf.type,
  };

  if (udf.subType) data.SubType = udf.subType;
  if (udf.size) data.Size = udf.size;

  await sapService.request({
    method: 'POST',
    url: '/UserFieldsMD',
    data,
  });
};

const ensureSODADeliveryLineUdfs = async ({ warnOnly = false } = {}) => {
  if (!ensureUdfsPromise) {
    ensureUdfsPromise = (async () => {
      const existingAliases = await getExistingLineUdfs();
      const missing = SODA_DELIVERY_LINE_UDFS.filter(
        (udf) => !existingAliases.has(udf.name.toUpperCase()),
      );

      for (const udf of missing) {
        try {
          await createLineUdf(udf);
          console.log(`[SODA Delivery] Created missing row UDF ${udf.fieldName}.`);
        } catch (error) {
          if (isAlreadyExistsError(error)) {
            continue;
          }
          throw error;
        }
      }
    })().finally(() => {
      ensureUdfsPromise = null;
    });
  }

  try {
    await ensureUdfsPromise;
  } catch (error) {
    if (!warnOnly) throw error;
    console.warn('[SODA Delivery] Unable to create missing row UDFs:', error.message || error);
  }
};

const getReferenceData = async (...args) => {
  await ensureSODADeliveryLineUdfs({ warnOnly: true });
  return deliveryService.getReferenceData(...args);
};

const submitDelivery = async (...args) => {
  await ensureSODADeliveryLineUdfs();
  return deliveryService.submitDelivery(...args);
};

const updateDelivery = async (...args) => {
  await ensureSODADeliveryLineUdfs();
  return deliveryService.updateDelivery(...args);
};

module.exports = {
  ...deliveryService,
  getReferenceData,
  submitDelivery,
  updateDelivery,
};
