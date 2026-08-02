import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { previewJournalEntryDocument } from '../../api/journalEntryApi';
import { createActiveCompanyScopedRouteState } from '../../utils/companyStorageScope';
import JournalEntryPreviewModal from '../../modules/services-ar-invoice/JournalEntryPreviewModal';

const WORKING_PREVIEW_DOCUMENT_TYPES = new Set([
  'serviceArInvoice',
  'serviceApInvoice',
  'serviceArCreditMemo',
  'serviceApCreditMemo',
]);

const getErrorMessage = (error) => (
  error.response?.data?.message ||
  error.response?.data?.detail?.reason ||
  error.message ||
  'Failed to preview Journal Entry.'
);

function JournalEntryPreviewButton({
  documentType,
  documentLabel,
  docEntry = null,
  buildPayload,
  validate,
  disabled = false,
  className = 'del-btn sap-document-toolbar__journal-preview',
}) {
  const navigate = useNavigate();
  const [state, setState] = useState({
    open: false,
    loading: false,
    data: null,
    error: '',
  });

  const preview = async () => {
    if (typeof validate === 'function') {
      const valid = await validate();
      if (valid === false) return;
    }

    setState((prev) => ({ ...prev, open: true, loading: true, error: '' }));
    try {
      const payload = typeof buildPayload === 'function' ? buildPayload() : null;
      const data = await previewJournalEntryDocument({
        documentType,
        docEntry,
        payload,
      });
      setState({ open: true, loading: false, data, error: '' });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        open: true,
        loading: false,
        error: getErrorMessage(error),
      }));
    }
  };

  if (docEntry || !WORKING_PREVIEW_DOCUMENT_TYPES.has(documentType)) return null;

  const openLinkedMaster = (line = {}) => {
    const code = String(line.account || '').trim();
    if (!code) return;

    setState((prev) => ({ ...prev, open: false }));
    const isBusinessPartnerLine = line.goldenArrowTarget === 'businessPartner' || Boolean(String(line.controlAccount || '').trim());
    if (isBusinessPartnerLine) {
      navigate(`/business-partner?cardCode=${encodeURIComponent(code)}`, {
        state: createActiveCompanyScopedRouteState({
          businessPartnerCardCode: code,
          cardCode: code,
        }),
      });
      return;
    }

    navigate(`/chart-of-accounts?accountCode=${encodeURIComponent(code)}`, {
      state: createActiveCompanyScopedRouteState({
        accountCode: code,
        glAccountCode: code,
      }),
    });
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={preview}
        disabled={disabled || state.loading}
        title={`Preview Journal Entry for ${documentLabel}`}
      >
        Preview Journal Entry
      </button>
      <JournalEntryPreviewModal
        isOpen={state.open}
        loading={state.loading}
        error={state.error}
        journalEntry={state.data}
        onClose={() => setState((prev) => ({ ...prev, open: false }))}
        onOpenLinkedMaster={openLinkedMaster}
        onRegenerate={preview}
      />
    </>
  );
}

export default JournalEntryPreviewButton;
