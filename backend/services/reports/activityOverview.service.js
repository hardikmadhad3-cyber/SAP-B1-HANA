const db = require("../dbService");

const ACTIVITY_OPTIONS = [
  { value: "All Activities", label: "All Activities" },
  { value: "C", label: "Phone Call" },
  { value: "M", label: "Meeting" },
  { value: "T", label: "Task" },
  { value: "N", label: "Note" },
  { value: "E", label: "Campaign" },
  { value: "P", label: "Other" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "All Types", label: "All Types" },
  { value: "Business Partner", label: "Business Partner" },
  { value: "Contact Person", label: "Contact Person" },
  { value: "User", label: "User" },
  { value: "Employee", label: "Employee" },
];

const columnCache = new Map();
const tableCache = new Map();

const queryRows = async (sql, params = {}) => {
  const result = await db.query(sql, params);
  return result.recordset || result || [];
};

const normalizeText = (value) => String(value || "").trim();
const buildLike = (value) => `%${normalizeText(value)}%`;

const tableExists = async (tableName) => {
  const table = normalizeText(tableName).toUpperCase();
  if (!table) return false;
  if (tableCache.has(table)) return tableCache.get(table);

  const rows = await queryRows(
    `
      SELECT 1 AS present
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: table }
  );
  const exists = rows.length > 0;
  tableCache.set(table, exists);
  return exists;
};

const getColumns = async (tableName) => {
  const table = normalizeText(tableName).toUpperCase();
  if (!table) return new Set();
  if (columnCache.has(table)) return columnCache.get(table);

  const rows = await queryRows(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
    `,
    { tableName: table }
  );
  const columns = new Set(rows.map((row) => normalizeText(row.COLUMN_NAME).toUpperCase()));
  columnCache.set(table, columns);
  return columns;
};

const hasColumn = async (tableName, columnName) => {
  const columns = await getColumns(tableName);
  return columns.has(normalizeText(columnName).toUpperCase());
};

const firstColumn = async (tableName, candidates = []) => {
  for (const candidate of candidates) {
    if (await hasColumn(tableName, candidate)) return candidate;
  }
  return null;
};

const safeExpr = (alias, columnName, fallback = "''") =>
  columnName ? `${alias}.${columnName}` : fallback;

const normalizeDate = (value) => {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return raw;
  const [, day, month, yearText] = match;
  const year = yearText.length === 2 ? `20${yearText}` : yearText;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const buildPropertyFilter = (propertyFilter = {}, whereClauses = [], alias = "BP") => {
  const selectedNumbers = Array.isArray(propertyFilter?.selectedPropertyNumbers)
    ? propertyFilter.selectedPropertyNumbers
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 64)
    : [];

  if (propertyFilter?.ignoreProperties || !selectedNumbers.length) {
    return;
  }

  const selectedSet = new Set(selectedNumbers);
  const selectedClauses = selectedNumbers.map((number) => `ISNULL(${alias}.QryGroup${number}, 'N') = 'Y'`);
  const linkOperator = propertyFilter?.linkMode === "or" ? " OR " : " AND ";
  whereClauses.push(`(${selectedClauses.join(linkOperator)})`);

  if (propertyFilter?.exactlyMatch) {
    const unselectedClauses = [];
    for (let index = 1; index <= 64; index += 1) {
      if (!selectedSet.has(index)) {
        unselectedClauses.push(`ISNULL(${alias}.QryGroup${index}, 'N') <> 'Y'`);
      }
    }

    if (unselectedClauses.length) {
      whereClauses.push(`(${unselectedClauses.join(" AND ")})`);
    }
  }
};

const optionAll = (label) => ({ value: label, label });

const lookupCustomerGroups = async () => {
  const rows = await queryRows(`
    SELECT DISTINCT
      CAST(G.GroupCode AS NVARCHAR(50)) AS value,
      G.GroupName AS label
    FROM OCRG G
    INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
    WHERE BP.CardType = 'C'
    ORDER BY G.GroupName
  `);
  return [optionAll("All"), ...rows];
};

const lookupVendorGroups = async () => {
  const rows = await queryRows(`
    SELECT DISTINCT
      CAST(G.GroupCode AS NVARCHAR(50)) AS value,
      G.GroupName AS label
    FROM OCRG G
    INNER JOIN OCRD BP ON BP.GroupCode = G.GroupCode
    WHERE BP.CardType = 'S'
    ORDER BY G.GroupName
  `);
  return [optionAll("All"), ...rows];
};

const lookupActivityTypes = async () => {
  if (!(await tableExists("OCLT"))) return [optionAll("All Types")];
  const codeColumn = await firstColumn("OCLT", ["Code", "TypeID", "typeID"]);
  const nameColumn = await firstColumn("OCLT", ["Name", "Type", "TypeName"]);
  if (!codeColumn || !nameColumn) return [optionAll("All Types")];

  const rows = await queryRows(`
    SELECT
      CAST(${codeColumn} AS NVARCHAR(50)) AS value,
      ${nameColumn} AS label
    FROM OCLT
    ORDER BY ${nameColumn}
  `);
  return [optionAll("All Types"), ...rows.filter((row) => normalizeText(row.label))];
};

const lookupSubjects = async () => {
  if (!(await tableExists("OCLS"))) return [optionAll("All Subjects")];
  const codeColumn = await firstColumn("OCLS", ["Code", "Subject", "ClgCode"]);
  const nameColumn = await firstColumn("OCLS", ["Name", "Subject", "Descript"]);
  if (!codeColumn || !nameColumn) return [optionAll("All Subjects")];

  const rows = await queryRows(`
    SELECT
      CAST(${codeColumn} AS NVARCHAR(50)) AS value,
      ${nameColumn} AS label
    FROM OCLS
    ORDER BY ${nameColumn}
  `);
  return [optionAll("All Subjects"), ...rows.filter((row) => normalizeText(row.label))];
};

const lookupLocations = async () => {
  if (!(await tableExists("OCLO"))) return [optionAll("All Locations")];
  const codeColumn = await firstColumn("OCLO", ["Code", "LocationID", "Location"]);
  const nameColumn = await firstColumn("OCLO", ["Name", "Location", "LocationName"]);
  if (!codeColumn || !nameColumn) return [optionAll("All Locations")];

  const rows = await queryRows(`
    SELECT
      CAST(${codeColumn} AS NVARCHAR(50)) AS value,
      ${nameColumn} AS label
    FROM OCLO
    ORDER BY ${nameColumn}
  `);
  return [optionAll("All Locations"), ...rows.filter((row) => normalizeText(row.label))];
};

const getLookups = async () => ({
  activities: ACTIVITY_OPTIONS,
  sourceTypes: SOURCE_TYPE_OPTIONS,
  customerGroups: await lookupCustomerGroups().catch(() => [optionAll("All")]),
  vendorGroups: await lookupVendorGroups().catch(() => [optionAll("All")]),
  activityTypes: await lookupActivityTypes().catch(() => [optionAll("All Types")]),
  subjects: await lookupSubjects().catch(() => [optionAll("All Subjects")]),
  meetingLocations: await lookupLocations().catch(() => [optionAll("All Locations")]),
});

const lookupUsers = async (query = "") => {
  const hasQuery = Boolean(normalizeText(query));
  const branchColumn = await firstColumn("OUSR", ["Branch", "DfltsGroup", "Department"]);
  const rows = await queryRows(
    `
      SELECT TOP 200
        USERID AS code,
        USER_CODE AS userCode,
        U_NAME AS name,
        ${branchColumn ? branchColumn : "''"} AS branch
      FROM OUSR
      WHERE (
        @hasQuery = 0
        OR CAST(USERID AS NVARCHAR(50)) LIKE @query
        OR USER_CODE LIKE @query
        OR U_NAME LIKE @query
      )
      ORDER BY USERID
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  );

  return rows.map((row) => ({
    code: String(row.code),
    userCode: row.userCode || "",
    name: row.name || row.userCode || "",
    department: "General",
    branch: row.branch || "Main",
  }));
};

const lookupEmployees = async (query = "") => {
  if (!(await tableExists("OHEM"))) return [];
  const hasQuery = Boolean(normalizeText(query));
  const rows = await queryRows(
    `
      SELECT TOP 200
        empID AS code,
        firstName,
        lastName,
        middleName,
        dept,
        branch
      FROM OHEM
      WHERE (
        @hasQuery = 0
        OR CAST(empID AS NVARCHAR(50)) LIKE @query
        OR ISNULL(firstName, '') LIKE @query
        OR ISNULL(lastName, '') LIKE @query
      )
      ORDER BY lastName, firstName, empID
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  );

  return rows.map((row) => {
    const nameParts = [row.lastName, row.firstName, row.middleName].map(normalizeText).filter(Boolean);
    return {
      code: String(row.code),
      name: nameParts.join(", ").replace(", ,", ","),
      department: row.dept || "General",
      branch: row.branch || "Main",
    };
  });
};

const lookupRecipientLists = async (query = "") => {
  if (!(await tableExists("OCLG"))) return [];
  const hasQuery = Boolean(normalizeText(query));
  const recipientColumn = await firstColumn("OCLG", ["AttendList", "Recipients", "Recipient"]);
  if (!recipientColumn) return [];

  const rows = await queryRows(
    `
      SELECT DISTINCT TOP 200
        CAST(${recipientColumn} AS NVARCHAR(200)) AS code,
        CAST(${recipientColumn} AS NVARCHAR(200)) AS name
      FROM OCLG
      WHERE ${recipientColumn} IS NOT NULL
        AND CAST(${recipientColumn} AS NVARCHAR(200)) <> ''
        AND (
          @hasQuery = 0
          OR CAST(${recipientColumn} AS NVARCHAR(200)) LIKE @query
        )
      ORDER BY CAST(${recipientColumn} AS NVARCHAR(200))
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  );
  return rows;
};

const lookupUserDefinedFields = async (query = "") => {
  const hasQuery = Boolean(normalizeText(query));
  const rows = await queryRows(
    `
      SELECT TOP 200
        AliasID AS code,
        Descr AS name,
        TypeID AS typeId
      FROM CUFD
      WHERE TableID = 'OCLG'
        AND (
          @hasQuery = 0
          OR AliasID LIKE @query
          OR Descr LIKE @query
        )
      ORDER BY FieldID
    `,
    { hasQuery: hasQuery ? 1 : 0, query: buildLike(query) }
  ).catch(() => []);

  return rows.map((row) => ({
    code: row.code || "",
    name: row.name || row.code || "",
    rule: "",
    value: "",
    toValue: "",
    typeId: row.typeId || "",
  }));
};

const formatSapTime = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  const padded = String(Math.trunc(number)).padStart(4, "0");
  const hours24 = Number(padded.slice(0, -2));
  const minutes = padded.slice(-2);
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${minutes}${suffix}`;
};

const formatDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(-2)}`;
};

const activityLabel = (value) => (
  ACTIVITY_OPTIONS.find((option) => option.value === normalizeText(value))?.label ||
  normalizeText(value) ||
  "Other"
);

const recurrenceLabel = (value) => {
  const text = normalizeText(value);
  if (!text || text === "0" || text.toUpperCase() === "N") return "None";
  return text;
};

const formatIsoDate = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeText(value);
  return date.toISOString().slice(0, 10);
};

const statusLabel = (closedValue) => (
  normalizeText(closedValue).toUpperCase() === "Y" ? "Closed" : "Not Started"
);

const priorityLabel = (value) => {
  const text = normalizeText(value);
  const numeric = Number(text);
  if (numeric === 0) return "Low";
  if (numeric === 1) return "Normal";
  if (numeric === 2) return "High";
  return text || "High";
};

const getActivityByNumber = async (activityNo = "") => {
  const normalizedNo = Number(activityNo);
  if (!Number.isFinite(normalizedNo)) {
    const error = new Error("Activity number is required.");
    error.status = 400;
    throw error;
  }

  const columns = await getColumns("OCLG");
  if (!columns.size) {
    const error = new Error("Activity table OCLG is not available in the selected company database.");
    error.status = 404;
    throw error;
  }

  const startDateColumn = await firstColumn("OCLG", ["Recontact", "CntctDate", "BeginDate", "StartDate"]);
  const closeDateColumn = await firstColumn("OCLG", ["CloseDate", "endDate", "EndDate"]);
  const startTimeColumn = await firstColumn("OCLG", ["BeginTime", "CntctTime", "StartTime"]);
  const endTimeColumn = await firstColumn("OCLG", ["ENDTime", "EndTime", "CloseTime"]);
  const actionColumn = await firstColumn("OCLG", ["Action"]);
  const detailsColumn = await firstColumn("OCLG", ["Details", "Notes", "Memo"]);
  const handledUserColumn = await firstColumn("OCLG", ["AttendUser", "UserSign"]);
  const assignedByColumn = await firstColumn("OCLG", ["UserSign", "AssignedBy"]);
  const employeeColumn = await firstColumn("OCLG", ["AttendEmpl", "empID"]);
  const contactColumn = await firstColumn("OCLG", ["CntctCode"]);
  const closedColumn = await firstColumn("OCLG", ["Closed"]);
  const inactiveColumn = await firstColumn("OCLG", ["Inactive"]);
  const recurrenceColumn = await firstColumn("OCLG", ["RecurType", "RecurPat", "Repeat"]);
  const typeColumn = await firstColumn("OCLG", ["CntctType", "Type"]);
  const subjectColumn = await firstColumn("OCLG", ["CntctSbjct", "Subject"]);
  const locationColumn = await firstColumn("OCLG", ["Location", "LocCode"]);
  const priorityColumn = await firstColumn("OCLG", ["Priority"]);
  const personalColumn = await firstColumn("OCLG", ["Personal"]);
  const durationColumn = await firstColumn("OCLG", ["Duration", "Durat"]);
  const durationTypeColumn = await firstColumn("OCLG", ["DurType"]);
  const reminderColumn = await firstColumn("OCLG", ["Reminder", "Remind"]);
  const reminderTimeColumn = await firstColumn("OCLG", ["RemQty", "RemindTime"]);

  const hasOclt = await tableExists("OCLT");
  const hasOcls = await tableExists("OCLS");
  const hasOclo = await tableExists("OCLO");
  const typeNameColumn = hasOclt ? await firstColumn("OCLT", ["Name", "Type", "TypeName"]) : null;
  const typeCodeColumn = hasOclt ? await firstColumn("OCLT", ["Code", "TypeID", "typeID"]) : null;
  const subjectNameColumn = hasOcls ? await firstColumn("OCLS", ["Name", "Subject", "Descript"]) : null;
  const subjectCodeColumn = hasOcls ? await firstColumn("OCLS", ["Code", "Subject", "ClgCode"]) : null;
  const locationNameColumn = hasOclo ? await firstColumn("OCLO", ["Name", "Location", "LocationName"]) : null;
  const locationCodeColumn = hasOclo ? await firstColumn("OCLO", ["Code", "LocationID", "Location"]) : null;

  const handledByExpr = [
    handledUserColumn ? "NULLIF(HU.U_NAME, '')" : "",
    handledUserColumn ? "NULLIF(HU.USER_CODE, '')" : "",
    employeeColumn ? "NULLIF(CONCAT(NULLIF(EH.lastName, ''), CASE WHEN EH.firstName IS NULL THEN '' ELSE CONCAT(', ', EH.firstName) END), '')" : "",
  ].filter(Boolean).join(", ") || "''";
  const assignedByExpr = assignedByColumn
    ? "COALESCE(NULLIF(AU.U_NAME, ''), NULLIF(AU.USER_CODE, ''), '')"
    : "''";
  const contactPersonExpr = contactColumn ? "COALESCE(NULLIF(CP.Name, ''), '')" : "''";
  const contactPhoneExpr = contactColumn ? "COALESCE(NULLIF(CP.Tel1, ''), NULLIF(CP.Cellolar, ''), NULLIF(BP.Phone1, ''), '')" : "COALESCE(NULLIF(BP.Phone1, ''), '')";

  const joins = [
    "LEFT JOIN OCRD BP ON BP.CardCode = A.CardCode",
    contactColumn ? `LEFT JOIN OCPR CP ON CP.CntctCode = A.${contactColumn}` : "",
    handledUserColumn ? `LEFT JOIN OUSR HU ON HU.USERID = A.${handledUserColumn}` : "",
    assignedByColumn ? `LEFT JOIN OUSR AU ON AU.USERID = A.${assignedByColumn}` : "",
    employeeColumn ? `LEFT JOIN OHEM EH ON EH.empID = A.${employeeColumn}` : "",
    hasOclt && typeColumn && typeCodeColumn ? `LEFT JOIN OCLT T ON CAST(T.${typeCodeColumn} AS NVARCHAR(50)) = CAST(A.${typeColumn} AS NVARCHAR(50))` : "",
    hasOcls && subjectColumn && subjectCodeColumn ? `LEFT JOIN OCLS S ON CAST(S.${subjectCodeColumn} AS NVARCHAR(50)) = CAST(A.${subjectColumn} AS NVARCHAR(50))` : "",
    hasOclo && locationColumn && locationCodeColumn ? `LEFT JOIN OCLO L ON CAST(L.${locationCodeColumn} AS NVARCHAR(50)) = CAST(A.${locationColumn} AS NVARCHAR(50))` : "",
  ].filter(Boolean);

  const rows = await queryRows(
    `
      SELECT TOP 1
        A.ClgCode AS number,
        ${safeExpr("A", actionColumn)} AS activity,
        ${typeNameColumn ? `T.${typeNameColumn}` : safeExpr("A", typeColumn)} AS activityType,
        ${subjectNameColumn ? `S.${subjectNameColumn}` : safeExpr("A", subjectColumn)} AS subject,
        ${safeExpr("A", startDateColumn, "NULL")} AS startDate,
        ${safeExpr("A", closeDateColumn, "NULL")} AS endDate,
        ${safeExpr("A", startTimeColumn, "NULL")} AS startTime,
        ${safeExpr("A", endTimeColumn, "NULL")} AS endTime,
        ${safeExpr("A", durationColumn, "NULL")} AS duration,
        ${safeExpr("A", durationTypeColumn)} AS durationType,
        ${safeExpr("A", recurrenceColumn)} AS recurrence,
        ${safeExpr("A", priorityColumn)} AS priority,
        ${locationNameColumn ? `L.${locationNameColumn}` : safeExpr("A", locationColumn)} AS meetingLocation,
        ${safeExpr("A", detailsColumn)} AS remarks,
        ${safeExpr("A", closedColumn)} AS closed,
        ${safeExpr("A", inactiveColumn)} AS inactive,
        ${safeExpr("A", personalColumn)} AS personal,
        ${safeExpr("A", reminderColumn)} AS reminder,
        ${safeExpr("A", reminderTimeColumn, "NULL")} AS reminderTime,
        COALESCE(${handledByExpr}, '') AS handledBy,
        ${assignedByExpr} AS assignedBy,
        A.CardCode AS bpCode,
        COALESCE(NULLIF(BP.CardName, ''), '') AS bpName,
        ${contactPersonExpr} AS contactPerson,
        ${contactPhoneExpr} AS telephoneNo
      FROM OCLG A
      ${joins.join("\n      ")}
      WHERE A.ClgCode = @activityNo
      ORDER BY A.ClgCode
    `,
    { activityNo: normalizedNo }
  );

  const row = rows[0];
  if (!row) {
    const error = new Error(`Activity ${normalizedNo} was not found.`);
    error.status = 404;
    throw error;
  }

  return {
    number: String(row.number || ""),
    activity: activityLabel(row.activity),
    activityType: row.activityType || "General",
    subject: row.subject || "",
    assignedToType: "User",
    assignedToName: row.handledBy || "",
    assignedBy: row.assignedBy || "",
    personal: normalizeText(row.personal).toUpperCase() === "Y",
    remarks: row.remarks || "",
    startDate: formatIsoDate(row.startDate),
    startDateDisplay: formatDate(row.startDate),
    startTime: formatSapTime(row.startTime),
    endDate: formatIsoDate(row.endDate || row.startDate),
    endDateDisplay: formatDate(row.endDate || row.startDate),
    endTime: formatSapTime(row.endTime),
    duration: row.duration ? `${row.duration} ${row.durationType || "Minutes"}` : "",
    status: statusLabel(row.closed),
    recurrence: recurrenceLabel(row.recurrence),
    priority: priorityLabel(row.priority),
    meetingLocation: row.meetingLocation || "",
    reminder: normalizeText(row.reminder).toUpperCase() === "Y",
    reminderText: row.reminderTime ? `${row.reminderTime} Minutes` : "15 Minutes",
    inactive: normalizeText(row.inactive).toUpperCase() === "Y",
    closed: normalizeText(row.closed).toUpperCase() === "Y",
    bpCode: row.bpCode || "",
    bpName: row.bpName || "",
    contactPerson: row.contactPerson || "",
    telephoneNo: row.telephoneNo || "",
  };
};

const getActivityOverview = async (criteria = {}) => {
  const columns = await getColumns("OCLG");
  if (!columns.size) {
    return {
      title: "Activities Overview",
      rows: [],
      message: "Activity table OCLG is not available in the selected company database.",
    };
  }

  const startDateColumn = await firstColumn("OCLG", ["Recontact", "CntctDate", "BeginDate", "StartDate"]);
  const closeDateColumn = await firstColumn("OCLG", ["CloseDate", "endDate", "EndDate"]);
  const startTimeColumn = await firstColumn("OCLG", ["BeginTime", "CntctTime", "StartTime"]);
  const actionColumn = await firstColumn("OCLG", ["Action"]);
  const detailsColumn = await firstColumn("OCLG", ["Details", "Notes", "Memo"]);
  const notesColumn = await firstColumn("OCLG", ["Notes", "Details", "Memo"]);
  const handledUserColumn = await firstColumn("OCLG", ["AttendUser", "UserSign"]);
  const assignedByColumn = await firstColumn("OCLG", ["UserSign", "AssignedBy"]);
  const employeeColumn = await firstColumn("OCLG", ["AttendEmpl", "empID"]);
  const contactColumn = await firstColumn("OCLG", ["CntctCode"]);
  const cardNameColumn = await firstColumn("OCLG", ["CardName"]);
  const closedColumn = await firstColumn("OCLG", ["Closed"]);
  const recurrenceColumn = await firstColumn("OCLG", ["RecurType", "RecurPat", "Repeat"]);
  const typeColumn = await firstColumn("OCLG", ["CntctType", "Type"]);
  const subjectColumn = await firstColumn("OCLG", ["CntctSbjct", "Subject"]);
  const locationColumn = await firstColumn("OCLG", ["Location", "LocCode"]);

  const params = {};
  const where = ["1 = 1"];
  const bpFrom = normalizeText(criteria.bpFrom);
  const bpTo = normalizeText(criteria.bpTo);

  if (bpFrom) {
    where.push("A.CardCode >= @bpFrom");
    params.bpFrom = bpFrom;
  }
  if (bpTo) {
    where.push("A.CardCode <= @bpTo");
    params.bpTo = bpTo;
  }

  const groupClauses = [];
  if (normalizeText(criteria.customerGroup) && normalizeText(criteria.customerGroup) !== "All") {
    groupClauses.push("(BP.CardType = 'C' AND CAST(BP.GroupCode AS NVARCHAR(50)) = @customerGroup)");
    params.customerGroup = normalizeText(criteria.customerGroup);
  }
  if (normalizeText(criteria.vendorGroup) && normalizeText(criteria.vendorGroup) !== "All") {
    groupClauses.push("(BP.CardType = 'S' AND CAST(BP.GroupCode AS NVARCHAR(50)) = @vendorGroup)");
    params.vendorGroup = normalizeText(criteria.vendorGroup);
  }
  if (groupClauses.length) where.push(`(${groupClauses.join(" OR ")})`);
  buildPropertyFilter(criteria.propertyFilter, where, "BP");

  const userCodes = Array.isArray(criteria.users) ? criteria.users.map(normalizeText).filter(Boolean) : [];
  if (userCodes.length && handledUserColumn) {
    where.push(`CAST(A.${handledUserColumn} AS NVARCHAR(50)) IN (${userCodes.map((_, index) => `@user${index}`).join(", ")})`);
    userCodes.forEach((code, index) => { params[`user${index}`] = code; });
  }

  const employeeCodes = Array.isArray(criteria.employees) ? criteria.employees.map(normalizeText).filter(Boolean) : [];
  if (employeeCodes.length && employeeColumn) {
    where.push(`CAST(A.${employeeColumn} AS NVARCHAR(50)) IN (${employeeCodes.map((_, index) => `@employee${index}`).join(", ")})`);
    employeeCodes.forEach((code, index) => { params[`employee${index}`] = code; });
  }

  const activity = normalizeText(criteria.activity);
  if (activity && activity !== "All Activities" && actionColumn) {
    where.push(`A.${actionColumn} = @activity`);
    params.activity = activity;
  }

  const activityType = normalizeText(criteria.activityType);
  if (activityType && activityType !== "All Types" && typeColumn) {
    where.push(`CAST(A.${typeColumn} AS NVARCHAR(50)) = @activityType`);
    params.activityType = activityType;
  }

  const subject = normalizeText(criteria.subject);
  if (subject && subject !== "All Subjects" && subjectColumn) {
    where.push(`CAST(A.${subjectColumn} AS NVARCHAR(50)) = @subject`);
    params.subject = subject;
  }

  const meetingLocation = normalizeText(criteria.meetingLocation);
  if (meetingLocation && meetingLocation !== "All Locations" && locationColumn) {
    where.push(`CAST(A.${locationColumn} AS NVARCHAR(50)) = @meetingLocation`);
    params.meetingLocation = meetingLocation;
  }

  const remarks = normalizeText(criteria.remarks);
  if (remarks && (detailsColumn || notesColumn)) {
    const remarkExpr = `CONCAT(ISNULL(${safeExpr("A", detailsColumn)}, ''), ' ', ISNULL(${safeExpr("A", notesColumn)}, ''))`;
    where.push(`${remarkExpr} LIKE @remarks`);
    params.remarks = buildLike(remarks);
  }

  const startFrom = normalizeDate(criteria.startDateFrom);
  const startTo = normalizeDate(criteria.startDateTo);
  if (startDateColumn && startFrom) {
    where.push(`A.${startDateColumn} >= @startFrom`);
    params.startFrom = startFrom;
  }
  if (startDateColumn && startTo) {
    where.push(`A.${startDateColumn} <= @startTo`);
    params.startTo = startTo;
  }

  const closeFrom = normalizeDate(criteria.closeDateFrom);
  const closeTo = normalizeDate(criteria.closeDateTo);
  if (closeDateColumn && closeFrom) {
    where.push(`A.${closeDateColumn} >= @closeFrom`);
    params.closeFrom = closeFrom;
  }
  if (closeDateColumn && closeTo) {
    where.push(`A.${closeDateColumn} <= @closeTo`);
    params.closeTo = closeTo;
  }

  if (criteria.displayOnlyOpen !== false && closedColumn) {
    where.push(`ISNULL(A.${closedColumn}, 'N') <> 'Y'`);
  }

  const hasOclt = await tableExists("OCLT");
  const hasOcls = await tableExists("OCLS");
  const typeNameColumn = hasOclt ? await firstColumn("OCLT", ["Name", "Type", "TypeName"]) : null;
  const typeCodeColumn = hasOclt ? await firstColumn("OCLT", ["Code", "TypeID", "typeID"]) : null;
  const subjectNameColumn = hasOcls ? await firstColumn("OCLS", ["Name", "Subject", "Descript"]) : null;
  const subjectCodeColumn = hasOcls ? await firstColumn("OCLS", ["Code", "Subject", "ClgCode"]) : null;
  const handledByExpr = [
    handledUserColumn ? "NULLIF(HU.U_NAME, '')" : "",
    handledUserColumn ? "NULLIF(HU.USER_CODE, '')" : "",
    employeeColumn ? "NULLIF(CONCAT(NULLIF(EH.lastName, ''), CASE WHEN EH.firstName IS NULL THEN '' ELSE CONCAT(', ', EH.firstName) END), '')" : "",
  ].filter(Boolean).join(", ") || "''";
  const assignedByExpr = assignedByColumn
    ? "COALESCE(NULLIF(AU.U_NAME, ''), NULLIF(AU.USER_CODE, ''), '')"
    : "''";
  const contactPersonExpr = contactColumn ? "COALESCE(NULLIF(CP.Name, ''), '')" : "''";

  const joins = [
    "LEFT JOIN OCRD BP ON BP.CardCode = A.CardCode",
    contactColumn ? `LEFT JOIN OCPR CP ON CP.CntctCode = A.${contactColumn}` : "",
    handledUserColumn ? `LEFT JOIN OUSR HU ON HU.USERID = A.${handledUserColumn}` : "",
    assignedByColumn ? `LEFT JOIN OUSR AU ON AU.USERID = A.${assignedByColumn}` : "",
    employeeColumn ? `LEFT JOIN OHEM EH ON EH.empID = A.${employeeColumn}` : "",
    hasOclt && typeColumn && typeCodeColumn ? `LEFT JOIN OCLT T ON CAST(T.${typeCodeColumn} AS NVARCHAR(50)) = CAST(A.${typeColumn} AS NVARCHAR(50))` : "",
    hasOcls && subjectColumn && subjectCodeColumn ? `LEFT JOIN OCLS S ON CAST(S.${subjectCodeColumn} AS NVARCHAR(50)) = CAST(A.${subjectColumn} AS NVARCHAR(50))` : "",
  ].filter(Boolean);

  const rows = await queryRows(
    `
      SELECT TOP 1000
        A.ClgCode AS number,
        ${safeExpr("A", startDateColumn, "NULL")} AS startDate,
        ${safeExpr("A", startTimeColumn, "NULL")} AS startTime,
        COALESCE(${handledByExpr}, '') AS handledBy,
        ${safeExpr("A", actionColumn)} AS activity,
        ${safeExpr("A", recurrenceColumn)} AS recurrence,
        COALESCE(NULLIF(BP.CardName, ''), NULLIF(${safeExpr("A", cardNameColumn)}, ''), '') AS bpName,
        ${contactPersonExpr} AS contactPerson,
        CASE WHEN ${closedColumn ? `ISNULL(A.${closedColumn}, 'N')` : "'N'"} = 'Y' THEN 'Closed' ELSE 'Not Started' END AS status,
        ${safeExpr("A", detailsColumn)} AS remarks,
        ${assignedByExpr} AS assignedBy,
        ${typeNameColumn ? `T.${typeNameColumn}` : "''"} AS typeName,
        ${subjectNameColumn ? `S.${subjectNameColumn}` : "''"} AS subjectName,
        A.CardCode AS bpCode
      FROM OCLG A
      ${joins.join("\n      ")}
      WHERE ${where.join("\n        AND ")}
      ORDER BY
        ${startDateColumn ? `A.${startDateColumn}` : "A.ClgCode"},
        A.ClgCode
    `,
    params
  );

  return {
    title: "Activities Overview",
    rows: rows.map((row) => ({
      number: row.number == null ? "" : String(row.number),
      startDate: formatDate(row.startDate),
      startTime: formatSapTime(row.startTime),
      handledBy: row.handledBy || "",
      activity: activityLabel(row.activity),
      recurrence: recurrenceLabel(row.recurrence),
      bpCode: row.bpCode || "",
      bpName: row.bpName || "",
      contactPerson: row.contactPerson || "",
      status: row.status || "",
      remarks: row.remarks || "",
      assignedBy: row.assignedBy || "",
      typeName: row.typeName || "",
      subjectName: row.subjectName || "",
    })),
    message: "",
  };
};

module.exports = {
  getLookups,
  getActivityOverview,
  getActivityByNumber,
  lookupUsers,
  lookupEmployees,
  lookupRecipientLists,
  lookupUserDefinedFields,
};
