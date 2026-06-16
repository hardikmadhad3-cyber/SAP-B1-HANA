# SAP Live Layout Metadata

## Why this exists

SAP Business One SQL tables can tell us a lot about document fields and UDF definitions, but they do not fully reproduce what a specific SAP user sees in **Form Settings**. Exact visible/hidden state, caption text, and column order for the Sales Order or Delivery matrix needs a saved layout source that comes from the UI layer.

This project now supports that with an imported layout table stored in the app auth SQLite database.

## Current scope

This phase wires the imported layout system into:

- `SALES_ORDER` only

Backend document mappings are ready for:

- `SALES_ORDER` -> form type `139`, matrix id `38`, table `RDR1`
- `DELIVERY` -> form type `140`, matrix id `38`, table `DLN1`

Delivery frontend wiring is intentionally left for the next phase.

## Storage model

Two SQLite tables are used:

- `sap_form_layout_columns`
- `sap_form_layout_sync_runs`

Layouts are scoped by:

- `companyDb`
- `userCode`
- `documentType`
- `formType`
- `matrixId`

That means two companies can keep different layouts for the same app user, and two SAP users in the same company can also keep different layouts.

## API

### `GET /api/sap/layout/document`

Query params:

- `companyDb`
- `userCode`
- `documentType`

Behavior:

1. Returns imported layout rows first when found.
2. Falls back to a safe document layout when no imported rows exist.
3. Logs a backend warning when fallback is used.

### `POST /api/sap/layout/import`

Imports a full layout snapshot for one company, one user, and one document type.

The request body shape is:

```json
{
  "companyDb": "COMPANY_DB",
  "userCode": "manager",
  "documentType": "SALES_ORDER",
  "formType": "139",
  "matrixId": "38",
  "tableName": "RDR1",
  "columns": [
    {
      "columnUid": "1",
      "fieldName": "ItemCode",
      "columnTitle": "Item No.",
      "visible": true,
      "editable": true,
      "columnOrder": 1,
      "width": 140,
      "dataType": "string",
      "isUdf": false,
      "source": "sap-ui-api"
    }
  ]
}
```

The import endpoint replaces the saved layout scope with the submitted set, then upserts each submitted row.

## UDF sync

### `POST /api/sap/layout/sync-udfs`

This reads `CUFD` for the target document line table and stores missing UDF layout rows as helper metadata.

Important:

- UDF sync is **not** the authority for exact SAP visibility or order.
- Synced helper rows are stored with source `udf-sync`.
- Imported UI layout is still the primary truth source.

## Sales Order fallback order

When no imported Sales Order layout exists, the backend returns this safe fallback:

1. `LineNum`
2. `ItemCode`
3. `Dscription`
4. `Quantity`
5. `UomName`
6. `HsnCode`
7. `Price`
8. `VatGroup`
9. `LineTotal`
10. `U_PackingType`
11. `U_GrossWt`
12. `U_TotalPackage`
13. `DiscPrcnt`
14. `DelivrdQty`
15. `WhsCode`

## Frontend behavior

The Sales Order Contents grid now:

- asks the backend for layout metadata whenever selected company or authenticated user changes
- clears old layout state before rendering the new company
- renders only visible layout columns
- sorts by `columnOrder`
- uses imported `columnTitle` and width
- keeps existing custom editors and lookups where available
- falls back safely when a field exists in metadata but not yet in a custom renderer

## Future SAP UI API add-on

A Windows SAP B1 UI API add-on can export a user’s line-matrix layout and send it directly to:

- `POST /api/sap/layout/import`

That add-on should send one complete document layout snapshot at a time using the JSON format shown above.
