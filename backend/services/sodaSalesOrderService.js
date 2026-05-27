const db = require('./dbService');
const sapService = require('./sapService');
const salesOrderService = require('./salesOrderService');

const SODA_SALES_ORDER_LINE_UDFS = [
  {
    tableName: 'RDR1',
    name: 'S_BrokPerQty',
    fieldName: 'U_S_BrokPerQty',
    description: 'comm amt per tone',
    type: 'db_Float',
    subType: 'st_Price',
  },
  {
    tableName: 'RDR1',
    name: 'COMPRC',
    fieldName: 'U_COMPRC',
    description: 'Commission (Percent)',
    type: 'db_Float',
    subType: 'st_Percentage',
  },
  {
    tableName: 'RDR1',
    name: 'Brok_Seller',
    fieldName: 'U_Brok_Seller',
    description: 'Commission',
    type: 'db_Float',
    subType: 'st_Sum',
  },
];

let ensureUdfsPromise = null;

const getExistingLineUdfs = async () => {
  const rows = await db.query(`
    SELECT AliasID
    FROM CUFD
    WHERE TableID = 'RDR1'
      AND AliasID IN (${SODA_SALES_ORDER_LINE_UDFS.map((_, index) => `@alias${index}`).join(', ')})
  `, SODA_SALES_ORDER_LINE_UDFS.reduce((params, udf, index) => {
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
  await sapService.request({
    method: 'POST',
    url: '/UserFieldsMD',
    data: {
      TableName: udf.tableName,
      Name: udf.name,
      Description: udf.description,
      Type: udf.type,
      SubType: udf.subType,
    },
  });
};

const ensureSODASalesOrderLineUdfs = async ({ warnOnly = false } = {}) => {
  if (!ensureUdfsPromise) {
    ensureUdfsPromise = (async () => {
      const existingAliases = await getExistingLineUdfs();
      const missing = SODA_SALES_ORDER_LINE_UDFS.filter(
        (udf) => !existingAliases.has(udf.name.toUpperCase()),
      );

      for (const udf of missing) {
        try {
          await createLineUdf(udf);
          console.log(`[SODA Sales Order] Created missing row UDF ${udf.fieldName}.`);
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
    console.warn('[SODA Sales Order] Unable to create missing row UDFs:', error.message || error);
  }
};

const getReferenceData = async (...args) => {
  await ensureSODASalesOrderLineUdfs({ warnOnly: true });
  return salesOrderService.getReferenceData(...args);
};

const submitSalesOrder = async (...args) => {
  await ensureSODASalesOrderLineUdfs();
  return salesOrderService.submitSalesOrder(...args);
};

const updateSalesOrder = async (...args) => {
  await ensureSODASalesOrderLineUdfs();
  return salesOrderService.updateSalesOrder(...args);
};

module.exports = {
  ...salesOrderService,
  getReferenceData,
  submitSalesOrder,
  updateSalesOrder,
};
