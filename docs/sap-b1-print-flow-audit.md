# SAP B1 Document Print Flow Audit

This audit covers document print, preview, and PDF download flows. The required source of truth is SAP Business One Report Layout Manager plus the installed SAP B1 Report Service / Crystal Reports runtime.

## Required Runtime Path

- Resolve company database from the active company session.
- Resolve document identity from the SAP B1 marketing document table.
- Resolve the active Crystal layout list from SAP B1 `RDOC` for the document `TypeCode`.
- If SAP B1 exposes multiple active Crystal layouts and no single default, show the SAP-sourced Choose Layout list and render the selected SAP layout.
- Load Crystal parameter metadata through SAP B1 Report Service `LoadCR`.
- Show only prompt parameters returned by SAP B1 Report Service.
- Render PDF only through SAP B1 Report Service `ExportPDFData`.
- Do not select layouts by report name, service/item text, local mapping, hardcoded `.rpt` path, or static copy labels.

## Backend Entry Points

| Flow | Endpoint | Current replacement path |
| --- | --- | --- |
| Generic metadata | `GET /api/sap/reports/:documentType/:docEntry/metadata` | Resolves SAP B1 document, layout candidates, selected layout, system parameters, prompt parameters, and diagnostics dynamically. |
| Current document metadata | `GET /api/document-print/:documentType/:docEntry/metadata` | Same metadata resolver for existing document-print namespace. |
| Print preview | `POST /api/document-print/:documentType/print` | Uses resolved SAP B1 active Crystal layout, then Report Service PDF export. |
| Download PDF | `POST /api/document-print/:documentType/download-pdf` | Same as print endpoint. |
| Legacy sales order PDF | `POST /api/print-sales-order` | Delegates into the same SAP B1 document print resolver. |
| Legacy sales order print-layout list | `GET /api/*sales-order/print-layouts` | Legacy compatibility only. New print UI does not use this for selecting a layout. |
| Bulk all-layout export | `POST /api/document-print/:documentType/download-all-layouts` | Disabled with HTTP 410 because it conflicts with the single active SAP B1 layout rule. |

## Frontend Document Screens

These screens use `PrintLayoutToolbar`, which now resolves live SAP metadata and displays the SAP-selected layout as read-only:

| Screen/module | Document type |
| --- | --- |
| Sales Quotation | `salesQuotation` |
| Sales Order, DC Sales Order, NC Sales Order, SODA Sales Order | `salesOrder` |
| Delivery, DC Delivery, NC Delivery, SODA Delivery | `delivery` |
| A/R Invoice | `arInvoice` |
| Service A/R Invoice | `serviceArInvoice` |
| A/R Credit Memo | `arCreditMemo` |
| Service A/R Credit Memo | `serviceArCreditMemo` |
| Purchase Quotation | `purchaseQuotation` |
| Purchase Order | `purchaseOrder` |
| Goods Receipt PO | `goodsReceiptPo` |
| Goods Return | `goodsReturn` |
| A/P Invoice | `apInvoice` |
| Service A/P Invoice | `serviceApInvoice` |
| A/P Credit Memo | `apCreditMemo` |
| Service A/P Credit Memo | `serviceApCreditMemo` |

## Static Values Removed From Document Print Selection

- Service A/R and Service A/P invoice name-based layout filters.
- Sales order environment default layout code.
- Frontend static layout dropdown selection. The visible chooser is now populated only from SAP B1 active Crystal layouts.
- Frontend prompt/copy-type options not returned by SAP B1 Report Service.
- Silent fallback from failed `LoadCR` parameter metadata to a locally invented `DocKey@` parameter list.

## Non-Document Report Areas

| Area | Files | Note |
| --- | --- | --- |
| Report Studio / Report Runner | `backend/services/reportStudioService.js`, `frontend/src/pages/ReportsStudioPage.jsx`, `frontend/src/pages/ReportRunnerPage.jsx` | Custom report execution/export, not SAP B1 document-layout printing. |
| Report Layout Manager app storage | `backend/services/reportLayoutService.js` | Application-managed layout metadata, not SAP B1 `RDOC` document print selection. |
| Grid PDF/export utilities | `frontend/src/components/reports/*`, `frontend/src/utils/pdfUtils.js` | Grid/report export utilities, not Crystal document print preview. |

## Diagnostics

If SAP B1 exposes no active Crystal layout, the print API must return a clear configuration error. If SAP B1 exposes multiple active Crystal layouts without a single default marker, the UI must show the SAP-sourced Choose Layout list and pass the selected `DocCode` to Report Service.
