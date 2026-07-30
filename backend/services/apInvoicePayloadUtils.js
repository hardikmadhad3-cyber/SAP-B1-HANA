const { applyUdfValues } = require('./udfPayloadUtils');

const hasValue = (value) => (
  value !== undefined &&
  value !== null &&
  String(value).trim() !== ''
);

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toOptionalNumber = (value) => {
  if (!hasValue(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toSapYesNo = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (['Y', 'YES', 'TRUE', '1', 'TYES'].includes(normalized)) return 'tYES';
  if (['N', 'NO', 'FALSE', '0', 'TNO'].includes(normalized)) return 'tNO';
  return undefined;
};

const hasBaseDocumentLink = (line = {}) => (
  hasValue(line.baseEntry) &&
  hasValue(line.baseType) &&
  hasValue(line.baseLine)
);

/**
 * Builds an A/P Invoice line from the destination form state.
 *
 * A GRPO link remains on the line for document flow and open-quantity handling,
 * while values edited after Copy To/Copy From are explicitly sent to SAP.
 */
const buildAPInvoiceDocumentLine = (
  line = {},
  allowedLineUdfs = null,
) => {
  const hasBaseDoc = hasBaseDocumentLink(line);
  const unitPrice = toNumber(line.unitPrice, 0);
  const documentLine = {
    ...(hasBaseDoc ? {} : { ItemCode: String(line.itemNo || '').trim() }),
    ItemDescription: String(line.itemDescription || ''),
    Quantity: toNumber(line.quantity, 0),
    UnitPrice: unitPrice,
    Price: unitPrice,
    DiscountPercent: hasValue(line.stdDiscount)
      ? toNumber(line.stdDiscount, 0)
      : (hasBaseDoc ? 0 : undefined),
    TaxCode: hasValue(line.taxCode) ? String(line.taxCode).trim() : undefined,
    UoMCode: hasValue(line.uomCode) ? String(line.uomCode).trim() : undefined,
    WarehouseCode: String(line.whse || '').trim(),
  };

  const withholdingTaxLiable = toSapYesNo(line.wtaxLiable ?? line.wTaxLiable);
  if (withholdingTaxLiable) {
    documentLine.WTLiable = withholdingTaxLiable;
  }
  if (hasValue(line.glAccount)) {
    documentLine.AccountCode = String(line.glAccount).trim();
  }
  if (hasValue(line.distRule)) {
    documentLine.CostingCode = String(line.distRule).trim();
  }
  if (hasValue(line.countryOfOrigin)) {
    documentLine.CountryOrg = String(line.countryOfOrigin).trim();
  }

  const locationCode = toOptionalNumber(line.loc);
  if (locationCode !== undefined) {
    documentLine.LocationCode = locationCode;
  }
  const agreementNo = toOptionalNumber(line.blanketAgreementNo);
  if (agreementNo !== undefined) {
    documentLine.AgreementNo = agreementNo;
  }

  if (hasBaseDoc) {
    documentLine.BaseEntry = Number(line.baseEntry);
    documentLine.BaseType = Number(line.baseType);
    documentLine.BaseLine = Number(line.baseLine);
  }

  applyUdfValues(documentLine, line.udf, allowedLineUdfs);
  return documentLine;
};

module.exports = {
  buildAPInvoiceDocumentLine,
  hasBaseDocumentLink,
};
