import { useCallback, useMemo, useState } from 'react';

const INITIAL_LOOKUP_MODAL = {
  open: false,
  lineIndex: -1,
  field: '',
  title: 'List of User-Defined Values',
  options: [],
  searchPlaceholder: 'Search values',
  emptyMessage: 'No values found',
  allowCreate: true,
};

const FIELD_TO_REF_BUCKET = {
  buyerQuality: ['quality_options', 'buyer'],
  sellerQuality: ['quality_options', 'seller'],
  buyerPrice: ['price_options', 'buyer'],
  sellerPrice: ['price_options', 'seller'],
};

const FIELD_TO_ALIAS = {
  buyerQuality: 'U_Buyer_Quality',
  sellerQuality: 'U_Seller_Quality',
  buyerPrice: 'U_Buyer_Price',
  sellerPrice: 'U_Seller_Price',
};

const FALLBACK_PAYMENT_TERMS = [
  { value: '0', label: 'Immediate' },
  { value: '1', label: 'Net 30' },
  { value: '2', label: 'Net 60' },
  { value: '3', label: 'Net 90' },
];

const buildPaymentTermOptions = (paymentTerms = []) => {
  const sourceTerms = paymentTerms.length
    ? paymentTerms.map((term) => ({
      code: String(term.GroupNum ?? ''),
      name: term.PymntGroup || String(term.GroupNum ?? ''),
    }))
    : FALLBACK_PAYMENT_TERMS.map((term) => ({
      code: term.value,
      name: term.label,
    }));

  return sourceTerms
    .filter((term) => term.name)
    .map((term) => ({
      value: term.name,
      description: term.code ? `Code: ${term.code}` : '',
      label: term.code ? `${term.name} (${term.code})` : term.name,
    }));
};

const getLookupConfig = (field, refData) => {
  const configs = {
    buyerQuality: {
      title: 'List of Buyer Quality Values',
      options: refData.quality_options?.buyer || [],
      searchPlaceholder: 'Search buyer quality values',
      emptyMessage: 'No buyer quality values found',
    },
    sellerQuality: {
      title: 'List of Seller Quality Values',
      options: refData.quality_options?.seller || [],
      searchPlaceholder: 'Search seller quality values',
      emptyMessage: 'No seller quality values found',
    },
    buyerPrice: {
      title: 'List of Buyer Price Values',
      options: refData.price_options?.buyer || [],
      searchPlaceholder: 'Search buyer price values',
      emptyMessage: 'No buyer price values found',
    },
    sellerPrice: {
      title: 'List of Seller Price Values',
      options: refData.price_options?.seller || [],
      searchPlaceholder: 'Search seller price values',
      emptyMessage: 'No seller price values found',
    },
  };

  return configs[field] || {
    title: 'List of User-Defined Values',
    options: [],
    searchPlaceholder: 'Search values',
    emptyMessage: 'No values found',
    allowCreate: true,
  };
};

export default function useSalesDocumentLineLookups({
  refData,
  setRefData,
  setLines,
  createLookupValue,
}) {
  const [lineLookupModal, setLineLookupModal] = useState(INITIAL_LOOKUP_MODAL);

  const paymentTermOptions = useMemo(
    () => buildPaymentTermOptions(refData.payment_terms || []),
    [refData.payment_terms]
  );

  const openPaymentTermsModal = useCallback((field, lineIndex) => {
    const isSellerField = field === 'sellerPaymentTerms';
    setLineLookupModal({
      open: true,
      lineIndex,
      field,
      title: isSellerField ? 'List of Seller Terms of Payment' : 'List of Buyer Terms of Payment',
      options: paymentTermOptions,
      searchPlaceholder: 'Search payment terms',
      emptyMessage: 'No payment terms found',
      allowCreate: false,
    });
  }, [paymentTermOptions]);

  const openQualityModal = useCallback((field, lineIndex) => {
    const nextConfig = getLookupConfig(field, refData);
    setLineLookupModal({
      open: true,
      lineIndex,
      field,
      title: nextConfig.title,
      options: nextConfig.options,
      searchPlaceholder: nextConfig.searchPlaceholder,
      emptyMessage: nextConfig.emptyMessage,
      allowCreate: nextConfig.allowCreate !== false,
    });
  }, [refData]);

  const closeLineLookupModal = useCallback(() => {
    setLineLookupModal(INITIAL_LOOKUP_MODAL);
  }, []);

  const handleLineLookupSelect = useCallback((option) => {
    if (lineLookupModal.lineIndex < 0 || !lineLookupModal.field) return;

    setLines((prev) => prev.map((line, idx) => (
      idx === lineLookupModal.lineIndex
        ? { ...line, [lineLookupModal.field]: option?.value || '' }
        : line
    )));
  }, [lineLookupModal.field, lineLookupModal.lineIndex, setLines]);

  const handleLineLookupCreate = useCallback(async ({ value, description }) => {
    const field = lineLookupModal.field;
    if (!field || !createLookupValue) return null;

    const aliasId = FIELD_TO_ALIAS[field] || field;
    const response = await createLookupValue(aliasId, value, description);
    const createdOption = response?.data?.option || {
      value,
      description: description || value,
      label: description && description !== value ? `${value} - ${description}` : value,
    };
    const nextOptions = response?.data?.options || [];

    const bucket = FIELD_TO_REF_BUCKET[field];
    if (bucket) {
      const [groupKey, sideKey] = bucket;
      setRefData((prev) => ({
        ...prev,
        [groupKey]: {
          ...(prev[groupKey] || { buyer: [], seller: [] }),
          [sideKey]: nextOptions,
        },
      }));
    }

    setLineLookupModal((prev) => ({
      ...prev,
      options: nextOptions,
    }));

    return createdOption;
  }, [createLookupValue, lineLookupModal.field, setRefData]);

  return {
    lineLookupModal,
    openQualityModal,
    openPaymentTermsModal,
    closeLineLookupModal,
    handleLineLookupSelect,
    handleLineLookupCreate,
  };
}
