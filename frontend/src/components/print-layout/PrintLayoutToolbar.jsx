import React, { useEffect, useMemo, useState } from 'react';
import {
  downloadDocumentLayoutPdf,
  fetchDocumentReportMetadata,
  printDocumentLayout,
} from '../../api/documentPrintApi';
import { base64ToPdfBlob, downloadPdfBlob } from '../../utils/pdfUtils';
import { useAuth } from '../../auth/AuthContext';

const DEFAULT_SCHEMA = process.env.REACT_APP_SAP_REPORT_SCHEMA || '';

const buildDefaultFileName = (documentType, docEntry, docNumber, docCode) =>
  `${String(documentType || 'document').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')}-${docNumber || docEntry || 'document'}-${docCode || 'layout'}.pdf`;

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.detail ||
  error.response?.data?.message ||
  error.message ||
  fallbackMessage;

const isPositiveDocumentKey = (value) => {
  const normalized = String(value ?? '').trim();
  return /^\d+$/.test(normalized) && Number(normalized) > 0;
};

const buildInputType = (paramType) => {
  if (paramType === 'date') return 'date';
  if (paramType === 'number') return 'number';
  return 'text';
};

const normalizeOptionValue = (option) => String(
  option && typeof option === 'object'
    ? (option.value ?? option.label ?? '')
    : option,
).trim();

const normalizeOptionLabel = (option) => String(
  option && typeof option === 'object'
    ? (option.label ?? option.value ?? '')
    : option,
).trim();

const normalizeOptions = (parameter) =>
  (Array.isArray(parameter?.options) ? parameter.options : [])
    .map((option) => ({
      value: normalizeOptionValue(option),
      label: normalizeOptionLabel(option),
    }))
    .filter((option) => option.value || option.label);

const buildInitialParameterValues = (parameters = []) =>
  parameters.reduce((values, parameter) => ({
    ...values,
    [parameter.paramName]: parameter.defaultValue ?? parameter.value ?? '',
  }), {});

const buildReportParameterPayload = (parameters = [], values = {}) =>
  parameters.map((parameter) => ({
    name: parameter.paramName,
    type: parameter.paramType,
    value: values[parameter.paramName] ?? '',
  }));

const AUTO_APPLY_PROMPT_DOCUMENT_TYPES = new Set([
  'salesOrder',
]);

const shouldAutoApplyPromptParameters = (documentType) =>
  AUTO_APPLY_PROMPT_DOCUMENT_TYPES.has(String(documentType || '').trim());

const buildDefaultReportParameterPayload = (parameters = []) =>
  parameters
    .map((parameter) => ({
      name: parameter.paramName,
      type: parameter.paramType,
      value: parameter.defaultValue ?? parameter.value ?? '',
    }))
    .filter((parameter) => String(parameter.name || '').trim());

function PdfPreviewModal({ documentLabel, previewPdf, onClose, onDownload }) {
  if (!previewPdf?.url) {
    return null;
  }

  return (
    <div className="sap-pdf-preview__backdrop" role="presentation" onClick={onClose}>
      <section
        className="sap-pdf-preview__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${documentLabel} print preview`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sap-pdf-preview__header">
          <div>
            <div className="sap-pdf-preview__title">{documentLabel} Print Preview</div>
            <div className="sap-pdf-preview__file-name">{previewPdf.fileName}</div>
          </div>
          <div className="sap-pdf-preview__actions">
            <button type="button" className="sap-pdf-preview__button" onClick={onDownload}>
              Download PDF
            </button>
            <button type="button" className="sap-pdf-preview__close" onClick={onClose} aria-label="Close print preview">
              x
            </button>
          </div>
        </header>
        <iframe
          className="sap-pdf-preview__frame"
          src={previewPdf.url}
          title={`${documentLabel} PDF preview`}
        />
      </section>
    </div>
  );
}

function PrintParameterModal({
  isOpen,
  documentLabel,
  layoutName,
  parameters,
  values,
  loading,
  onChange,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="sap-print-params__backdrop" role="presentation" onClick={(event) => event.stopPropagation()}>
      <section
        className="sap-print-params__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${documentLabel} print parameters`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sap-print-params__header">
          <div>
            <div className="sap-print-params__title">Enter Parameter Values</div>
            <div className="sap-print-params__layout">{layoutName || documentLabel}</div>
          </div>
          <button type="button" className="sap-print-params__close" onClick={onCancel} disabled={loading}>
            x
          </button>
        </header>

        <div className="sap-print-params__body">
          {parameters.map((parameter) => {
            const options = normalizeOptions(parameter);
            const label = parameter.displayName || parameter.paramName;
            const value = values[parameter.paramName] ?? '';

            return (
              <label key={parameter.paramName} className="sap-print-params__field">
                <span>{label}{parameter.isRequired ? ':' : ''}</span>
                {options.length ? (
                  <select
                    value={value}
                    onChange={(event) => onChange(parameter.paramName, event.target.value)}
                    disabled={loading}
                  >
                    <option value="">...</option>
                    {options.map((option) => (
                      <option key={`${parameter.paramName}-${option.value || option.label}`} value={option.value || option.label}>
                        {option.label || option.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={buildInputType(parameter.paramType)}
                    value={value}
                    onChange={(event) => onChange(parameter.paramName, event.target.value)}
                    disabled={loading}
                  />
                )}
              </label>
            );
          })}
        </div>

        <footer className="sap-print-params__footer">
          <button type="button" className="sap-print-params__button sap-print-params__button--primary" onClick={onConfirm} disabled={loading}>
            OK
          </button>
          <button type="button" className="sap-print-params__button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </footer>
      </section>
    </div>
  );
}

function PrintLayoutToolbar({
  documentType,
  documentLabel = 'Document',
  docEntry,
  docNumber,
  series,
  cardCode,
  disabled = false,
  defaultSchema = DEFAULT_SCHEMA,
  classPrefix = 'so',
  onSuccess,
  onError,
}) {
  const { company } = useAuth();
  const companySchema = String(company?.dbName || '').trim();
  const layoutReloadKey = useMemo(
    () => [company?.companyId, companySchema].filter(Boolean).join(':'),
    [company?.companyId, companySchema],
  );
  const [schema, setSchema] = useState(() => companySchema || defaultSchema || DEFAULT_SCHEMA);
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [reportMetadata, setReportMetadata] = useState(null);
  const [selectedDocCode, setSelectedDocCode] = useState('');
  const [previewPdf, setPreviewPdf] = useState(null);
  const [parameterPrompt, setParameterPrompt] = useState({
    open: false,
    action: '',
    parameters: [],
    values: {},
    layoutName: '',
    metadata: null,
  });
  const resolvedDefaultSchema = String(
    reportMetadata?.schema ||
      companySchema ||
      defaultSchema ||
      DEFAULT_SCHEMA ||
      '',
  ).trim();
  const resolvedLayout = reportMetadata?.layout || null;
  const layoutCandidates = Array.isArray(reportMetadata?.layoutCandidates)
    ? reportMetadata.layoutCandidates
    : [];
  const requiresLayoutSelection = Boolean(reportMetadata?.requiresLayoutSelection);
  const showLayoutChooser = requiresLayoutSelection || layoutCandidates.length > 1;
  const docCode = String(resolvedLayout?.docCode || '').trim();
  const effectiveDocCode = String(selectedDocCode || docCode || '').trim();
  const selectedCandidate = layoutCandidates.find((layout) =>
    String(layout.docCode || layout.layoutId || '').trim().toLowerCase() === effectiveDocCode.toLowerCase(),
  );
  const layoutDisplayValue = metadataLoading
    ? 'Loading SAP B1 layout...'
    : effectiveDocCode
      ? `${effectiveDocCode} - ${resolvedLayout?.reportName || resolvedLayout?.docName || selectedCandidate?.reportName || selectedCandidate?.docName || effectiveDocCode}`
      : 'SAP B1 layout resolves when document is loaded';

  useEffect(() => {
    setSchema(resolvedDefaultSchema);
  }, [resolvedDefaultSchema, documentType, layoutReloadKey]);

  useEffect(() => {
    setReportMetadata(null);
    setSelectedDocCode('');
  }, [documentType, docEntry, docNumber, series, cardCode, layoutReloadKey]);

  useEffect(() => () => {
    if (previewPdf?.url) {
      URL.revokeObjectURL(previewPdf.url);
    }
  }, [previewPdf?.url]);

  useEffect(() => {
    if (!previewPdf) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPreviewPdf(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPdf]);

  const notifySuccess = (message) => {
    onSuccess?.(message);
  };

  const notifyError = (message) => {
    onError?.(message);
  };

  useEffect(() => {
    if (!isPositiveDocumentKey(docEntry) || !String(schema ?? '').trim()) {
      return undefined;
    }

    let isCurrent = true;
    setMetadataLoading(true);

    fetchDocumentReportMetadata({
      documentType,
      docEntry,
      docNum: docNumber,
      series,
      cardCode,
      schema,
      docCode: selectedDocCode || undefined,
    })
      .then((response) => {
        if (!isCurrent) return;
        setReportMetadata(response.data);
        setSchema(response.data?.schema || schema);
      })
      .catch((error) => {
        if (!isCurrent) return;
        setReportMetadata(null);
        notifyError(getErrorMessage(error, `Failed to resolve the SAP B1 ${documentLabel.toLowerCase()} print layout.`));
      })
      .finally(() => {
        if (isCurrent) setMetadataLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [documentType, docEntry, docNumber, series, cardCode, schema, selectedDocCode, layoutReloadKey]);

  const validatePrintableSelection = () => {
    if (!isPositiveDocumentKey(docEntry)) {
      notifyError(`Save or load a ${documentLabel.toLowerCase()} before printing.`);
      return false;
    }

    if (!String(schema ?? '').trim()) {
      notifyError('Schema is required before printing.');
      return false;
    }

    if (showLayoutChooser && !effectiveDocCode) {
      notifyError(`Choose a SAP B1 layout before printing ${documentLabel.toLowerCase()}.`);
      return false;
    }

    return true;
  };

  const loadReportMetadata = async () => {
    const normalizedDocEntry = String(docEntry ?? '').trim();
    const normalizedSchema = String(schema ?? '').trim();

    if (!isPositiveDocumentKey(normalizedDocEntry)) {
      throw new Error(`Save or load a ${documentLabel.toLowerCase()} before printing.`);
    }

    if (!normalizedSchema) {
      throw new Error('Schema is required before printing.');
    }

    setMetadataLoading(true);

    try {
      const response = await fetchDocumentReportMetadata({
        documentType,
        docEntry: normalizedDocEntry,
        docNum: docNumber,
        series,
        cardCode,
        schema: normalizedSchema,
        docCode: selectedDocCode || docCode || undefined,
      });
      setReportMetadata(response.data);
      setSchema(response.data?.schema || normalizedSchema);
      return response.data;
    } finally {
      setMetadataLoading(false);
    }
  };

  const getPdfDocument = async (metadataPayload, reportParameters = []) => {
    const normalizedDocEntry = String(metadataPayload?.document?.docEntry || docEntry || '').trim();
    const normalizedDocCode = String(metadataPayload?.layout?.docCode || '').trim();
    const normalizedSchema = String(metadataPayload?.schema || schema || '').trim();

    const response = await printDocumentLayout({
      documentType,
      docEntry: normalizedDocEntry,
      docNum: docNumber,
      series,
      cardCode,
      docCode: normalizedDocCode,
      schema: normalizedSchema,
      reportParameters,
    });

    const nextPdf = {
      blob: base64ToPdfBlob(response.data?.base64Pdf),
      fileName:
        response.data?.fileName ||
        buildDefaultFileName(documentType, normalizedDocEntry, docNumber, normalizedDocCode),
      docEntry: normalizedDocEntry,
      docCode: response.data?.docCode || normalizedDocCode,
      schema: normalizedSchema,
    };

    return nextPdf;
  };

  const loadPromptParameters = async (action) => {
    const metadataPayload = await loadReportMetadata();
    if (metadataPayload?.requiresLayoutSelection && !metadataPayload?.layout?.docCode) {
      throw new Error(`Choose a SAP B1 layout before printing ${documentLabel.toLowerCase()}.`);
    }

    const parameters = Array.isArray(metadataPayload?.promptParameters)
      ? metadataPayload.promptParameters
      : [];

    if (!parameters.length) {
      return { metadata: metadataPayload, reportParameters: [] };
    }

    if (shouldAutoApplyPromptParameters(documentType)) {
      return {
        metadata: metadataPayload,
        reportParameters: buildDefaultReportParameterPayload(parameters),
      };
    }

    setParameterPrompt({
      open: true,
      action,
      parameters,
      values: buildInitialParameterValues(parameters),
      layoutName: metadataPayload?.layout?.reportName || metadataPayload?.layout?.docName || metadataPayload?.layout?.docCode,
      metadata: metadataPayload,
    });

    return null;
  };

  const runPreview = async (reportParameters = [], metadataPayload = reportMetadata) => {
    const resolvedMetadata = metadataPayload || await loadReportMetadata();
    const pdfDocument = await getPdfDocument(resolvedMetadata, reportParameters);
    const url = URL.createObjectURL(pdfDocument.blob);

    setPreviewPdf({
      ...pdfDocument,
      url,
    });
    notifySuccess(`${documentLabel} PDF preview loaded for layout ${pdfDocument.docCode}.`);
  };

  const runDownload = async (reportParameters = [], metadataPayload = reportMetadata) => {
    const resolvedMetadata = metadataPayload || await loadReportMetadata();
    const resolvedDocCode = String(resolvedMetadata?.layout?.docCode || '').trim();
    const resolvedSchema = String(resolvedMetadata?.schema || schema || '').trim();
    const response = await downloadDocumentLayoutPdf({
      documentType,
      docEntry: resolvedMetadata?.document?.docEntry || docEntry,
      docNum: docNumber,
      series,
      cardCode,
      docCode: resolvedDocCode,
      schema: resolvedSchema,
      reportParameters,
    });
    const fileName =
      response.data?.fileName ||
      buildDefaultFileName(documentType, resolvedMetadata?.document?.docEntry || docEntry, docNumber, resolvedDocCode);

    downloadPdfBlob(base64ToPdfBlob(response.data?.base64Pdf), fileName);
    notifySuccess(`${documentLabel} PDF downloaded as ${fileName}.`);
  };

  const handlePreview = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!validatePrintableSelection()) {
      return;
    }

    setLoading(true);

    try {
      const promptedParameters = await loadPromptParameters('preview');
      if (promptedParameters === null) {
        return;
      }

      await runPreview(promptedParameters.reportParameters, promptedParameters.metadata);
    } catch (error) {
      notifyError(getErrorMessage(error, `Failed to preview the ${documentLabel.toLowerCase()} PDF.`));
    } finally {
      setLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewPdf(null);
  };

  const downloadPreview = () => {
    if (!previewPdf?.blob) {
      return;
    }

    downloadPdfBlob(previewPdf.blob, previewPdf.fileName);
  };

  const handleDownload = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!validatePrintableSelection()) {
      return;
    }

    setLoading(true);

    try {
      const promptedParameters = await loadPromptParameters('download');
      if (promptedParameters === null) {
        return;
      }

      await runDownload(promptedParameters.reportParameters, promptedParameters.metadata);
    } catch (error) {
      notifyError(getErrorMessage(error, `Failed to download the ${documentLabel.toLowerCase()} PDF.`));
    } finally {
      setLoading(false);
    }
  };

  const closeParameterPrompt = () => {
    setParameterPrompt({
      open: false,
      action: '',
      parameters: [],
      values: {},
      layoutName: '',
      metadata: null,
    });
  };

  const updatePromptValue = (paramName, value) => {
    setParameterPrompt((current) => ({
      ...current,
      values: {
        ...current.values,
        [paramName]: value,
      },
    }));
  };

  const confirmParameterPrompt = async () => {
    const missingParameter = parameterPrompt.parameters.find((parameter) =>
      parameter.isRequired && !String(parameterPrompt.values[parameter.paramName] ?? '').trim(),
    );

    if (missingParameter) {
      notifyError(`${missingParameter.displayName || missingParameter.paramName} is required before printing.`);
      return;
    }

    const reportParameters = buildReportParameterPayload(parameterPrompt.parameters, parameterPrompt.values);
    const action = parameterPrompt.action;

    setLoading(true);

    try {
      closeParameterPrompt();
      if (action === 'download') {
        await runDownload(reportParameters, parameterPrompt.metadata);
      } else {
        await runPreview(reportParameters, parameterPrompt.metadata);
      }
    } catch (error) {
      notifyError(getErrorMessage(error, `Failed to generate the ${documentLabel.toLowerCase()} PDF.`));
    } finally {
      setLoading(false);
    }
  };

  const actionDisabled =
    disabled ||
    loading ||
    metadataLoading ||
    !isPositiveDocumentKey(docEntry) ||
    !String(schema ?? '').trim() ||
    (showLayoutChooser && !effectiveDocCode);
  const fieldClass = `${classPrefix}-toolbar__field`;
  const labelClass = `${classPrefix}-toolbar__field-label`;
  const inputClass = `${classPrefix}-toolbar__field-input`;
  const buttonClass = `${classPrefix}-btn`;

  return (
    <div
      className={`${classPrefix}-toolbar__group ${classPrefix}-print-tools`}
      data-document-dirty-ignore="true"
    >
      <div className={fieldClass}>
        <label className={labelClass} htmlFor={`${documentType}-print-doc-code`}>
          Layout
        </label>
        {showLayoutChooser ? (
          <select
            id={`${documentType}-print-doc-code`}
            className={`${inputClass} ${inputClass}--layout`}
            value={effectiveDocCode}
            onChange={(event) => setSelectedDocCode(event.target.value)}
            disabled={loading || metadataLoading || disabled}
            title="Choose one of the active SAP B1 Crystal layouts."
          >
            <option value="">Choose Layout</option>
            {layoutCandidates.map((layout) => {
              const candidateDocCode = String(layout.docCode || layout.layoutId || '').trim();
              const candidateName = layout.reportName || layout.docName || candidateDocCode;
              return (
                <option key={candidateDocCode} value={candidateDocCode}>
                  {candidateName}
                </option>
              );
            })}
          </select>
        ) : (
          <input
            id={`${documentType}-print-doc-code`}
            className={`${inputClass} ${inputClass}--layout`}
            value={layoutDisplayValue}
            readOnly
            disabled={loading || metadataLoading || disabled}
            title="Resolved from the active SAP B1 Crystal Report layout at print time."
          />
        )}
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor={`${documentType}-print-schema`}>
          Schema
        </label>
        <input
          id={`${documentType}-print-schema`}
          className={`${inputClass} ${inputClass}--schema`}
          value={schema}
          onChange={(event) => setSchema(event.target.value)}
          readOnly
          disabled={loading || disabled}
          placeholder={resolvedDefaultSchema || 'Schema'}
          title="Uses the selected company database from your current session."
        />
      </div>

      <button
        type="button"
        className={buttonClass}
        onClick={handlePreview}
        disabled={actionDisabled}
        title={docEntry ? `Preview the SAP B1 ${documentLabel.toLowerCase()} Crystal PDF.` : `Load a saved ${documentLabel.toLowerCase()} to print.`}
      >
        {loading || metadataLoading ? 'Generating PDF...' : `Print ${documentLabel}`}
      </button>

      <button
        type="button"
        className={buttonClass}
        onClick={handleDownload}
        disabled={actionDisabled}
        title={docEntry ? `Download the SAP B1 ${documentLabel.toLowerCase()} Crystal PDF.` : `Load a saved ${documentLabel.toLowerCase()} to download.`}
      >
        Download PDF
      </button>

      <PdfPreviewModal
        documentLabel={documentLabel}
        previewPdf={previewPdf}
        onClose={closePreview}
        onDownload={downloadPreview}
      />

      <PrintParameterModal
        isOpen={parameterPrompt.open}
        documentLabel={documentLabel}
        layoutName={parameterPrompt.layoutName}
        parameters={parameterPrompt.parameters}
        values={parameterPrompt.values}
        loading={loading}
        onChange={updatePromptValue}
        onCancel={closeParameterPrompt}
        onConfirm={confirmParameterPrompt}
      />

    </div>
  );
}

export default PrintLayoutToolbar;
