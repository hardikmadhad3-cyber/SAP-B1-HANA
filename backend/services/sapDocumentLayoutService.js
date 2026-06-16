const authDbService = require('./authDbService');
const { getUdfDefinitions } = require('./udfMetadataService');

const DOCUMENT_TYPES = {
  SALES_ORDER: {
    documentType: 'SALES_ORDER',
    formType: '139',
    matrixId: '38',
    headerTable: 'ORDR',
    tableName: 'RDR1',
    fallbackColumns: [
      { columnUid: 'LineNum', fieldName: 'LineNum', columnTitle: '#', columnOrder: 1, width: 42, dataType: 'number', isUdf: false },
      { columnUid: 'ItemCode', fieldName: 'ItemCode', columnTitle: 'Item No.', columnOrder: 2, width: 160, dataType: 'string', isUdf: false },
      { columnUid: 'Dscription', fieldName: 'Dscription', columnTitle: 'Item Description', columnOrder: 3, width: 240, dataType: 'string', isUdf: false },
      { columnUid: 'Quantity', fieldName: 'Quantity', columnTitle: 'Quantity', columnOrder: 4, width: 90, dataType: 'number', isUdf: false },
      { columnUid: 'UomName', fieldName: 'UomName', columnTitle: 'UoM Name', columnOrder: 5, width: 120, dataType: 'string', isUdf: false },
      { columnUid: 'HsnCode', fieldName: 'HsnCode', columnTitle: 'HSN', columnOrder: 6, width: 95, dataType: 'string', isUdf: false },
      { columnUid: 'Price', fieldName: 'Price', columnTitle: 'Unit Price', columnOrder: 7, width: 110, dataType: 'number', isUdf: false },
      { columnUid: 'VatGroup', fieldName: 'VatGroup', columnTitle: 'Tax Code', columnOrder: 8, width: 110, dataType: 'string', isUdf: false },
      { columnUid: 'LineTotal', fieldName: 'LineTotal', columnTitle: 'Total', columnOrder: 9, width: 115, dataType: 'number', isUdf: false },
      { columnUid: 'U_PackingType', fieldName: 'U_PackingType', columnTitle: 'Packing-Type', columnOrder: 10, width: 140, dataType: 'string', isUdf: true },
      { columnUid: 'U_GrossWt', fieldName: 'U_GrossWt', columnTitle: 'GrossWt', columnOrder: 11, width: 110, dataType: 'number', isUdf: true },
      { columnUid: 'U_TotalPackage', fieldName: 'U_TotalPackage', columnTitle: 'Total-Package', columnOrder: 12, width: 130, dataType: 'number', isUdf: true },
      { columnUid: 'DiscPrcnt', fieldName: 'DiscPrcnt', columnTitle: 'Discount %', columnOrder: 13, width: 95, dataType: 'number', isUdf: false },
      { columnUid: 'DelivrdQty', fieldName: 'DelivrdQty', columnTitle: 'Delivered Qty', columnOrder: 14, width: 120, dataType: 'number', isUdf: false },
      { columnUid: 'WhsCode', fieldName: 'WhsCode', columnTitle: 'Whse', columnOrder: 15, width: 80, dataType: 'string', isUdf: false },
    ],
  },
  DELIVERY: {
    documentType: 'DELIVERY',
    formType: '140',
    matrixId: '38',
    headerTable: 'ODLN',
    tableName: 'DLN1',
    fallbackColumns: [
      { columnUid: 'LineNum', fieldName: 'LineNum', columnTitle: '#', columnOrder: 1, width: 42, dataType: 'number', isUdf: false },
      { columnUid: 'ItemCode', fieldName: 'ItemCode', columnTitle: 'Item No.', columnOrder: 2, width: 160, dataType: 'string', isUdf: false },
      { columnUid: 'Dscription', fieldName: 'Dscription', columnTitle: 'Item Description', columnOrder: 3, width: 240, dataType: 'string', isUdf: false },
      { columnUid: 'Quantity', fieldName: 'Quantity', columnTitle: 'Quantity', columnOrder: 4, width: 90, dataType: 'number', isUdf: false },
      { columnUid: 'UomName', fieldName: 'UomName', columnTitle: 'UoM Name', columnOrder: 5, width: 120, dataType: 'string', isUdf: false },
      { columnUid: 'HsnCode', fieldName: 'HsnCode', columnTitle: 'HSN', columnOrder: 6, width: 95, dataType: 'string', isUdf: false },
      { columnUid: 'Price', fieldName: 'Price', columnTitle: 'Unit Price', columnOrder: 7, width: 110, dataType: 'number', isUdf: false },
      { columnUid: 'VatGroup', fieldName: 'VatGroup', columnTitle: 'Tax Code', columnOrder: 8, width: 110, dataType: 'string', isUdf: false },
      { columnUid: 'LineTotal', fieldName: 'LineTotal', columnTitle: 'Total', columnOrder: 9, width: 115, dataType: 'number', isUdf: false },
      { columnUid: 'U_PackingType', fieldName: 'U_PackingType', columnTitle: 'Packing-Type', columnOrder: 10, width: 140, dataType: 'string', isUdf: true },
      { columnUid: 'U_GrossWt', fieldName: 'U_GrossWt', columnTitle: 'GrossWt', columnOrder: 11, width: 110, dataType: 'number', isUdf: true },
      { columnUid: 'U_TotalPackage', fieldName: 'U_TotalPackage', columnTitle: 'Total-Package', columnOrder: 12, width: 130, dataType: 'number', isUdf: true },
      { columnUid: 'DiscPrcnt', fieldName: 'DiscPrcnt', columnTitle: 'Discount %', columnOrder: 13, width: 95, dataType: 'number', isUdf: false },
      { columnUid: 'WhsCode', fieldName: 'WhsCode', columnTitle: 'Whse', columnOrder: 14, width: 80, dataType: 'string', isUdf: false },
    ],
  },
};

const AUTHORITATIVE_SOURCE_EXCLUSION = 'udf-sync';

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value, fieldName, { required = false, maxLength = 200 } = {}) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    if (required) {
      throw createHttpError(400, `${fieldName} is required.`);
    }
    return '';
  }

  if (normalized.length > maxLength) {
    throw createHttpError(400, `${fieldName} is too long.`);
  }

  return normalized;
};

const normalizeBooleanFlag = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'y', 't', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'f', 'off'].includes(normalized)) return false;
  return fallback;
};

const normalizeInteger = (value, fallback, fieldName, { min = 0, max = 5000 } = {}) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw createHttpError(400, `${fieldName} must be numeric.`);
  }

  const integer = Math.trunc(parsed);
  if (integer < min || integer > max) {
    throw createHttpError(400, `${fieldName} is out of range.`);
  }

  return integer;
};

const normalizeDocumentType = (value) => {
  const normalized = normalizeText(value, 'documentType', { required: true, maxLength: 50 }).toUpperCase();
  const mapping = DOCUMENT_TYPES[normalized];
  if (!mapping) {
    throw createHttpError(400, 'documentType must be SALES_ORDER or DELIVERY.');
  }

  return mapping;
};

const normalizeColumnInput = (column = {}, index = 0) => {
  const columnUid = normalizeText(column.columnUid, `columns[${index}].columnUid`, { required: true, maxLength: 200 });
  const fieldName = normalizeText(column.fieldName || columnUid, `columns[${index}].fieldName`, { required: true, maxLength: 200 });
  const columnTitle = normalizeText(column.columnTitle, `columns[${index}].columnTitle`, { required: true, maxLength: 200 });

  return {
    columnUid,
    fieldName,
    columnTitle,
    visible: normalizeBooleanFlag(column.visible, true),
    editable: normalizeBooleanFlag(column.editable, true),
    columnOrder: normalizeInteger(column.columnOrder, index + 1, `columns[${index}].columnOrder`, { min: 0, max: 100000 }),
    width: normalizeInteger(column.width, 120, `columns[${index}].width`, { min: 40, max: 4000 }),
    dataType: normalizeText(column.dataType, `columns[${index}].dataType`, { required: false, maxLength: 100 }) || null,
    isUdf: normalizeBooleanFlag(column.isUdf, fieldName.toUpperCase().startsWith('U_')),
    source: normalizeText(column.source, `columns[${index}].source`, { required: false, maxLength: 100 }) || 'manual',
  };
};

const mapRowToColumn = (row = {}) => ({
  columnUid: String(row.columnUid || ''),
  fieldName: String(row.fieldName || ''),
  columnTitle: String(row.columnTitle || ''),
  visible: Number(row.visible) === 1,
  editable: Number(row.editable) === 1,
  columnOrder: Number(row.columnOrder) || 0,
  width: Number(row.width) || 120,
  dataType: row.dataType || '',
  isUdf: Number(row.isUdf) === 1,
  source: row.source || 'manual',
});

const normalizeAuth = async (auth = {}, requestedCompanyDb, requestedUserCode) => {
  const userId = Number(auth.userId);
  const companyId = Number(auth.companyId);

  if (!Number.isInteger(userId) || !Number.isInteger(companyId)) {
    throw createHttpError(401, 'A valid company session is required.');
  }

  const sessionUser = auth.username
    ? { Username: auth.username }
    : await authDbService.queryOne(`
        SELECT Username
        FROM Users
        WHERE UserId = @userId
      `, { userId });
  const username = normalizeText(sessionUser?.Username, 'Authenticated username', { required: true, maxLength: 150 });

  const assignedCompany = await authDbService.getAssignedCompanyForUser(userId, companyId);
  if (!assignedCompany) {
    throw createHttpError(403, 'Selected company is not assigned to this user.');
  }

  const sessionCompanyDb = normalizeText(assignedCompany.DbName, 'Assigned company database', { required: true, maxLength: 200 });
  const normalizedRequestedCompanyDb = requestedCompanyDb
    ? normalizeText(requestedCompanyDb, 'companyDb', { required: true, maxLength: 200 })
    : sessionCompanyDb;
  if (normalizedRequestedCompanyDb.toUpperCase() !== sessionCompanyDb.toUpperCase()) {
    throw createHttpError(403, 'companyDb does not match the selected company session.');
  }

  const normalizedRequestedUserCode = requestedUserCode
    ? normalizeText(requestedUserCode, 'userCode', { required: true, maxLength: 150 })
    : username;
  if (normalizedRequestedUserCode.toUpperCase() !== username.toUpperCase()) {
    throw createHttpError(403, 'userCode does not match the authenticated user.');
  }

  return {
    userId,
    companyId,
    companyDb: sessionCompanyDb,
    userCode: username,
  };
};

const buildResponse = ({ scope, mapping, columns, source, warning = '' }) => ({
  success: true,
  companyDb: scope.companyDb,
  userCode: scope.userCode,
  documentType: mapping.documentType,
  formType: mapping.formType,
  matrixId: mapping.matrixId,
  tableName: mapping.tableName,
  source,
  ...(warning ? { warning } : {}),
  columns,
});

const getAuthoritativeLayoutRows = async ({ companyDb, userCode, documentType, formType, matrixId }) => (
  authDbService.queryRows(`
    SELECT
      columnUid,
      fieldName,
      columnTitle,
      visible,
      editable,
      columnOrder,
      width,
      dataType,
      isUdf,
      source
    FROM sap_form_layout_columns
    WHERE companyDb = @companyDb
      AND userCode = @userCode
      AND documentType = @documentType
      AND formType = @formType
      AND matrixId = @matrixId
      AND LOWER(COALESCE(source, 'manual')) <> LOWER(@excludedSource)
    ORDER BY columnOrder ASC, id ASC
  `, {
    companyDb,
    userCode,
    documentType,
    formType,
    matrixId,
    excludedSource: AUTHORITATIVE_SOURCE_EXCLUSION,
  })
);

const getDocumentLayout = async (auth, input = {}) => {
  const mapping = normalizeDocumentType(input.documentType);
  const scope = await normalizeAuth(auth, input.companyDb, input.userCode);
  const rows = await getAuthoritativeLayoutRows({
    companyDb: scope.companyDb,
    userCode: scope.userCode,
    documentType: mapping.documentType,
    formType: mapping.formType,
    matrixId: mapping.matrixId,
  });

  if (rows.length) {
    return buildResponse({
      scope,
      mapping,
      columns: rows.map(mapRowToColumn),
      source: 'imported-layout',
    });
  }

  const warning = `No imported layout found for ${mapping.documentType} (${scope.companyDb}/${scope.userCode}). Using fallback layout.`;
  console.warn(`[SAP_LAYOUT] ${warning}`);

  return buildResponse({
    scope,
    mapping,
    columns: mapping.fallbackColumns.map((column) => ({
      ...column,
      visible: true,
      editable: column.fieldName !== 'LineNum',
      source: 'fallback',
    })),
    source: 'fallback',
    warning,
  });
};

const startSyncRun = async ({ companyDb, userCode, documentType, message }) => {
  const result = await authDbService.query(`
    INSERT INTO sap_form_layout_sync_runs (companyDb, userCode, documentType, status, message, startedAt)
    VALUES (@companyDb, @userCode, @documentType, 'running', @message, CURRENT_TIMESTAMP)
  `, {
    companyDb,
    userCode,
    documentType,
    message: message || null,
  });

  return Number(result.lastInsertId || 0);
};

const finishSyncRun = async (id, status, message) => {
  if (!id) return;
  await authDbService.query(`
    UPDATE sap_form_layout_sync_runs
    SET status = @status,
        message = @message,
        completedAt = CURRENT_TIMESTAMP
    WHERE id = @id
  `, {
    id,
    status,
    message: message || null,
  });
};

const importDocumentLayout = async (auth, input = {}) => {
  const mapping = normalizeDocumentType(input.documentType);
  const scope = await normalizeAuth(auth, input.companyDb, input.userCode);
  const formType = normalizeText(input.formType || mapping.formType, 'formType', { required: true, maxLength: 50 });
  const matrixId = normalizeText(input.matrixId || mapping.matrixId, 'matrixId', { required: true, maxLength: 50 });
  const tableName = normalizeText(input.tableName || mapping.tableName, 'tableName', { required: true, maxLength: 50 });

  if (!Array.isArray(input.columns)) {
    throw createHttpError(400, 'columns must be an array.');
  }

  const columns = input.columns.map(normalizeColumnInput);
  const syncRunId = await startSyncRun({
    companyDb: scope.companyDb,
    userCode: scope.userCode,
    documentType: mapping.documentType,
    message: `Importing ${columns.length} layout columns.`,
  });

  try {
    await authDbService.transaction(async (tx) => {
      await tx.query(`
        DELETE FROM sap_form_layout_columns
        WHERE companyDb = @companyDb
          AND userCode = @userCode
          AND documentType = @documentType
          AND formType = @formType
          AND matrixId = @matrixId
      `, {
        companyDb: scope.companyDb,
        userCode: scope.userCode,
        documentType: mapping.documentType,
        formType,
        matrixId,
      });

      for (const column of columns) {
        await tx.query(`
          INSERT INTO sap_form_layout_columns (
            companyDb,
            userCode,
            documentType,
            formType,
            matrixId,
            tableName,
            columnUid,
            fieldName,
            columnTitle,
            visible,
            editable,
            columnOrder,
            width,
            dataType,
            isUdf,
            source,
            createdAt,
            updatedAt
          )
          VALUES (
            @companyDb,
            @userCode,
            @documentType,
            @formType,
            @matrixId,
            @tableName,
            @columnUid,
            @fieldName,
            @columnTitle,
            @visible,
            @editable,
            @columnOrder,
            @width,
            @dataType,
            @isUdf,
            @source,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(companyDb, userCode, documentType, formType, matrixId, columnUid) DO UPDATE SET
            tableName = excluded.tableName,
            fieldName = excluded.fieldName,
            columnTitle = excluded.columnTitle,
            visible = excluded.visible,
            editable = excluded.editable,
            columnOrder = excluded.columnOrder,
            width = excluded.width,
            dataType = excluded.dataType,
            isUdf = excluded.isUdf,
            source = excluded.source,
            updatedAt = CURRENT_TIMESTAMP
        `, {
          companyDb: scope.companyDb,
          userCode: scope.userCode,
          documentType: mapping.documentType,
          formType,
          matrixId,
          tableName,
          columnUid: column.columnUid,
          fieldName: column.fieldName,
          columnTitle: column.columnTitle,
          visible: column.visible ? 1 : 0,
          editable: column.editable ? 1 : 0,
          columnOrder: column.columnOrder,
          width: column.width,
          dataType: column.dataType,
          isUdf: column.isUdf ? 1 : 0,
          source: column.source,
        });
      }
    });

    await finishSyncRun(syncRunId, 'completed', `Imported ${columns.length} layout columns.`);
  } catch (error) {
    await finishSyncRun(syncRunId, 'failed', error.message);
    throw error;
  }

  return buildResponse({
    scope,
    mapping: { ...mapping, formType, matrixId, tableName },
    columns,
    source: 'imported-layout',
  });
};

const syncDocumentLayoutUdfs = async (auth, input = {}) => {
  const mapping = normalizeDocumentType(input.documentType);
  const scope = await normalizeAuth(auth, input.companyDb, input.userCode);
  const syncRunId = await startSyncRun({
    companyDb: scope.companyDb,
    userCode: scope.userCode,
    documentType: mapping.documentType,
    message: `Syncing UDF helper metadata for ${mapping.tableName}.`,
  });

  try {
    const udfDefinitions = await getUdfDefinitions(mapping.tableName);
    const existingRows = await authDbService.queryRows(`
      SELECT fieldName
      FROM sap_form_layout_columns
      WHERE companyDb = @companyDb
        AND userCode = @userCode
        AND documentType = @documentType
        AND formType = @formType
        AND matrixId = @matrixId
    `, {
      companyDb: scope.companyDb,
      userCode: scope.userCode,
      documentType: mapping.documentType,
      formType: mapping.formType,
      matrixId: mapping.matrixId,
    });

    const existingFieldNames = new Set(
      existingRows.map((row) => String(row.fieldName || '').trim().toUpperCase()).filter(Boolean),
    );

    const columnsToInsert = udfDefinitions
      .filter((field) => String(field.key || '').trim().toUpperCase().startsWith('U_'))
      .filter((field) => !existingFieldNames.has(String(field.key || '').trim().toUpperCase()))
      .map((field, index) => ({
        columnUid: field.key,
        fieldName: field.key,
        columnTitle: field.label || field.key,
        visible: false,
        editable: !field.readOnly,
        columnOrder: 5000 + index,
        width: field.type === 'textarea' ? 180 : 120,
        dataType: field.type || 'string',
        isUdf: true,
        source: AUTHORITATIVE_SOURCE_EXCLUSION,
      }));

    for (const column of columnsToInsert) {
      await authDbService.query(`
        INSERT INTO sap_form_layout_columns (
          companyDb,
          userCode,
          documentType,
          formType,
          matrixId,
          tableName,
          columnUid,
          fieldName,
          columnTitle,
          visible,
          editable,
          columnOrder,
          width,
          dataType,
          isUdf,
          source,
          createdAt,
          updatedAt
        )
        VALUES (
          @companyDb,
          @userCode,
          @documentType,
          @formType,
          @matrixId,
          @tableName,
          @columnUid,
          @fieldName,
          @columnTitle,
          @visible,
          @editable,
          @columnOrder,
          @width,
          @dataType,
          @isUdf,
          @source,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(companyDb, userCode, documentType, formType, matrixId, columnUid) DO UPDATE SET
          fieldName = excluded.fieldName,
          columnTitle = excluded.columnTitle,
          editable = excluded.editable,
          width = excluded.width,
          dataType = excluded.dataType,
          isUdf = excluded.isUdf,
          source = excluded.source,
          updatedAt = CURRENT_TIMESTAMP
      `, {
        companyDb: scope.companyDb,
        userCode: scope.userCode,
        documentType: mapping.documentType,
        formType: mapping.formType,
        matrixId: mapping.matrixId,
        tableName: mapping.tableName,
        columnUid: column.columnUid,
        fieldName: column.fieldName,
        columnTitle: column.columnTitle,
        visible: column.visible ? 1 : 0,
        editable: column.editable ? 1 : 0,
        columnOrder: column.columnOrder,
        width: column.width,
        dataType: column.dataType,
        isUdf: column.isUdf ? 1 : 0,
        source: column.source,
      });
    }

    await finishSyncRun(syncRunId, 'completed', `Synced ${columnsToInsert.length} helper UDF columns.`);

    return {
      success: true,
      companyDb: scope.companyDb,
      userCode: scope.userCode,
      documentType: mapping.documentType,
      formType: mapping.formType,
      matrixId: mapping.matrixId,
      tableName: mapping.tableName,
      syncedCount: columnsToInsert.length,
      columns: columnsToInsert,
    };
  } catch (error) {
    await finishSyncRun(syncRunId, 'failed', error.message);
    throw error;
  }
};

module.exports = {
  DOCUMENT_TYPES,
  getDocumentLayout,
  importDocumentLayout,
  syncDocumentLayoutUdfs,
};
