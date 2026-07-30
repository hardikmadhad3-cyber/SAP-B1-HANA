const DOCUMENT_REFERENCE_TYPES = [
  { value: '22', label: 'Purchase Order', serviceLayer: 'rot_PurchaseOrder' },
  { value: '17', label: 'Sales Order', serviceLayer: 'rot_SalesOrder' },
  { value: '15', label: 'Delivery', serviceLayer: 'rot_DeliveryNotes' },
  { value: '13', label: 'A/R Invoice', serviceLayer: 'rot_SalesInvoice' },
  { value: '14', label: 'A/R Credit Memo', serviceLayer: 'rot_SalesCreditNote' },
  { value: '23', label: 'Sales Quotation', serviceLayer: 'rot_SalesQuotation' },
  { value: '20', label: 'Goods Receipt PO', serviceLayer: 'rot_PurchaseDeliveryNotes' },
  { value: '18', label: 'A/P Invoice', serviceLayer: 'rot_PurchaseInvoice' },
  { value: '19', label: 'A/P Credit Memo', serviceLayer: 'rot_PurchaseCreditNote' },
  { value: '1470000113', label: 'Purchase Request', serviceLayer: 'rot_PurchaseRequest' },
  { value: '540000006', label: 'Purchase Quotation', serviceLayer: 'rot_PurchaseQuotation' },
];

const normalizeReferenceDocType = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const match = DOCUMENT_REFERENCE_TYPES.find((type) => (
    type.value === normalized ||
    type.label.toLowerCase() === normalized.toLowerCase() ||
    type.serviceLayer.toLowerCase() === normalized.toLowerCase()
  ));
  return match?.value || normalized;
};

const isKnownReferenceDocType = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return false;
  return DOCUMENT_REFERENCE_TYPES.some((type) => (
    type.value === normalized ||
    type.label.toLowerCase() === normalized.toLowerCase() ||
    type.serviceLayer.toLowerCase() === normalized.toLowerCase()
  ));
};

const toOptionalReferenceNumber = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buildDocumentReferencesPayload = (references = [], options = {}) => {
  if (!Array.isArray(references)) return [];

  const defaultObjectType = options.defaultObjectType || options.defaultReferenceObjectType || '';
  const invalidRows = [];
  const result = references
    .filter((row) => String(row?.direction || 'to').toLowerCase() !== 'by')
    .map((row, index) => {
      const rawObjectType = row.transactionType || row.referencedObjectType || row.RefObjType || defaultObjectType;
      const referencedObjectType = normalizeReferenceDocType(
        rawObjectType
      );
      const referencedDocEntry = toOptionalReferenceNumber(
        row.docEntry || row.referencedDocEntry || row.RefDocEntr
      );
      const referencedDocNumber = toOptionalReferenceNumber(
        row.docNumber || row.referencedDocNumber || row.RefDocNum
      );
      const externalReferencedDocNumber = String(
        row.extDocNumber || row.externalDocNumber || row.ExtDocNum || ''
      ).trim();

      if (
        !referencedObjectType ||
        (!referencedDocEntry && !referencedDocNumber && !externalReferencedDocNumber)
      ) {
        return null;
      }

      if (!isKnownReferenceDocType(rawObjectType)) {
        invalidRows.push(index + 1);
        return null;
      }

      return {
        RefObjType: referencedObjectType,
        ...(referencedDocEntry !== undefined ? { RefDocEntr: referencedDocEntry } : {}),
        ...(referencedDocNumber !== undefined ? { RefDocNum: referencedDocNumber } : {}),
        ...(externalReferencedDocNumber
          ? { ExtDocNum: externalReferencedDocNumber }
          : {}),
        ...(row.issueDate ? { IssueDate: row.issueDate } : {}),
        ...(row.remark ? { Remark: row.remark } : {}),
      };
    })
    .filter(Boolean);

  if (invalidRows.length) {
    const error = new Error(`Referenced Document row ${invalidRows.join(', ')} has an invalid transaction type. Select a valid document type before adding.`);
    error.statusCode = 400;
    throw error;
  }

  return result;
};

module.exports = {
  buildDocumentReferencesPayload,
  normalizeReferenceDocType,
};
