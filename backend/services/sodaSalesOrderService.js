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
  {
    tableName: 'RDR1',
    name: 'Seller_Payment_Terms',
    fieldName: 'U_Seller_Payment_Terms',
    description: 'Seller - Terms of Payment',
    type: 'db_Alpha',
    size: 100,
  },
];

const SODA_FREE_TEXT_PRICE_UDFS = [
  { aliasId: 'Buyer_Price', fieldName: 'U_Buyer_Price' },
  { aliasId: 'Seller_Price', fieldName: 'U_Seller_Price' },
];

let ensureUdfsPromise = null;
let ensurePriceUdfsFreeTextPromise = null;

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

const getPriceUdfDefinitions = async () => {
  const result = await db.query(`
    SELECT
      T0.FieldID,
      T0.AliasID,
      T0.Dflt AS DefaultValue,
      COUNT(T1.IndexID) AS ValidValueCount
    FROM CUFD T0
    LEFT JOIN UFD1 T1
      ON T0.TableID = T1.TableID
     AND T0.FieldID = T1.FieldID
    WHERE T0.TableID = 'RDR1'
      AND T0.AliasID IN (${SODA_FREE_TEXT_PRICE_UDFS.map((_, index) => `@alias${index}`).join(', ')})
    GROUP BY T0.FieldID, T0.AliasID, T0.Dflt
  `, SODA_FREE_TEXT_PRICE_UDFS.reduce((params, udf, index) => {
    params[`alias${index}`] = udf.aliasId;
    return params;
  }, {}));

  return result.recordset || [];
};

const ensureSODAPriceUdfsFreeText = async ({ warnOnly = false } = {}) => {
  if (!ensurePriceUdfsFreeTextPromise) {
    ensurePriceUdfsFreeTextPromise = (async () => {
      const definitions = await getPriceUdfDefinitions();

      for (const udf of definitions) {
        const hasValidValues = Number(udf.ValidValueCount || 0) > 0;
        const hasDefaultValue = String(udf.DefaultValue || '').trim() !== '';
        if (!hasValidValues && !hasDefaultValue) continue;

        await sapService.request({
          method: 'PATCH',
          url: `/UserFieldsMD(TableName='RDR1',FieldID=${Number(udf.FieldID)})`,
          headers: {
            'B1S-ReplaceCollectionsOnPatch': 'true',
          },
          data: {
            DefaultValue: null,
            ValidValuesMD: [],
          },
        });

        const fieldName = SODA_FREE_TEXT_PRICE_UDFS.find(
          (item) => item.aliasId === udf.AliasID,
        )?.fieldName || `U_${udf.AliasID}`;
        console.log(`[SODA Sales Order] Removed fixed valid values from ${fieldName}.`);
      }
    })().finally(() => {
      ensurePriceUdfsFreeTextPromise = null;
    });
  }

  try {
    await ensurePriceUdfsFreeTextPromise;
  } catch (error) {
    if (!warnOnly) throw error;
    console.warn('[SODA Sales Order] Unable to make price UDFs free text:', error.message || error);
  }
};

const getReferenceData = async (...args) => {
  await ensureSODASalesOrderLineUdfs({ warnOnly: true });
  await ensureSODAPriceUdfsFreeText({ warnOnly: true });
  return salesOrderService.getReferenceData(...args);
};

const submitSalesOrder = async (...args) => {
  await ensureSODASalesOrderLineUdfs();
  await ensureSODAPriceUdfsFreeText();
  return salesOrderService.submitSalesOrder(...args);
};

const updateSalesOrder = async (...args) => {
  await ensureSODASalesOrderLineUdfs();
  await ensureSODAPriceUdfsFreeText();
  return salesOrderService.updateSalesOrder(...args);
};

module.exports = {
  ...salesOrderService,
  getReferenceData,
  submitSalesOrder,
  updateSalesOrder,
};
