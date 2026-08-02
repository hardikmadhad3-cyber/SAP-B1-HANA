const parseNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasValue = (value) => String(value ?? '').trim() !== '';

const formatNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '';
};

const effectiveQuantity = (value) => {
  const quantity = parseNumber(value);
  return quantity > 0 ? quantity : 1;
};

/**
 * Keeps the SAP B1 service-line amount fields in sync.
 *
 * Unit Price is the undiscounted price retained behind the visible fields.
 * Price after Disc. is the discounted unit price, and Total (LC) is that
 * discounted price multiplied by quantity (SAP uses quantity 1 when omitted).
 */
export const calculateServiceInvoiceLine = (line, changedField, taxRate = 0) => {
  const next = { ...line };
  const quantity = effectiveQuantity(next.sQty);
  let unitPrice = parseNumber(next.unitPrice);
  let discountPercent = parseNumber(next.discountPercent);
  let priceAfterDiscount = parseNumber(next.priceAfterDisc);
  let total = parseNumber(next.totalLC);

  if (changedField === 'priceAfterDiscCommit' && next._pendingPriceDiscountApplication) {
    priceAfterDiscount = unitPrice * (1 - (discountPercent / 100));
    total = priceAfterDiscount * quantity;
    next.priceAfterDisc = formatNumber(priceAfterDiscount);
    next.totalLC = formatNumber(total);
    next._priceBaselineEstablished = true;
    next._pendingPriceDiscountApplication = false;
  } else if (changedField === 'priceAfterDisc') {
    if (!hasValue(next.priceAfterDisc)) {
      next.totalLC = '';
      next.taxAmountLC = '';
      return next;
    }

    // When discount is entered first, let the user finish typing the base
    // amount and apply that discount on blur. This avoids transforming each
    // intermediate keystroke ("1", "12", "120", "1200").
    const applyExistingDiscountOnCommit = !next._priceBaselineEstablished && discountPercent !== 0;
    const discountFactor = 1 - (discountPercent / 100);
    unitPrice = applyExistingDiscountOnCommit
      ? priceAfterDiscount
      : (discountFactor !== 0 ? priceAfterDiscount / discountFactor : priceAfterDiscount);
    next.unitPrice = formatNumber(unitPrice);
    next._priceBaselineEstablished = !applyExistingDiscountOnCommit;
    next._pendingPriceDiscountApplication = applyExistingDiscountOnCommit;
    total = priceAfterDiscount * quantity;
    next.totalLC = formatNumber(total);
  } else if (changedField === 'discountPercent') {
    if (!next._priceBaselineEstablished) {
      const currentPriceAfterDiscount = hasValue(next.priceAfterDisc)
        ? priceAfterDiscount
        : total / quantity;
      if (currentPriceAfterDiscount > 0) {
        unitPrice = currentPriceAfterDiscount;
        next.unitPrice = formatNumber(unitPrice);
        next._priceBaselineEstablished = true;
      }
    } else if (unitPrice <= 0) {
      const currentDiscountFactor = 1 - (discountPercent / 100);
      if (priceAfterDiscount > 0 && currentDiscountFactor !== 0) {
        unitPrice = priceAfterDiscount / currentDiscountFactor;
        next.unitPrice = formatNumber(unitPrice);
      }
    }

    if (unitPrice > 0) {
      priceAfterDiscount = unitPrice * (1 - (discountPercent / 100));
      total = priceAfterDiscount * quantity;
      next.priceAfterDisc = formatNumber(priceAfterDiscount);
      next.totalLC = formatNumber(total);
    }
  } else if (changedField === 'totalLC') {
    if (!hasValue(next.totalLC)) {
      next.priceAfterDisc = '';
      next.taxAmountLC = '';
      return next;
    }

    priceAfterDiscount = total / quantity;
    next.priceAfterDisc = formatNumber(priceAfterDiscount);
    const discountFactor = 1 - (discountPercent / 100);
    unitPrice = discountFactor !== 0 ? priceAfterDiscount / discountFactor : priceAfterDiscount;
    next.unitPrice = formatNumber(unitPrice);
    next._priceBaselineEstablished = true;
    next._pendingPriceDiscountApplication = false;
  } else if (changedField === 'unitPrice' || changedField === 'sQty') {
    if (unitPrice > 0) {
      next._priceBaselineEstablished = true;
      priceAfterDiscount = unitPrice * (1 - (discountPercent / 100));
      total = priceAfterDiscount * quantity;
      next.priceAfterDisc = formatNumber(priceAfterDiscount);
      next.totalLC = formatNumber(total);
    }
  }

  next.taxAmountLC = hasValue(next.totalLC)
    ? formatNumber(parseNumber(next.totalLC) * parseNumber(taxRate) / 100)
    : '';
  return next;
};
