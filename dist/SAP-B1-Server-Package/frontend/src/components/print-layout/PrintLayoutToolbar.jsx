import React, { useEffect, useMemo, useState } from 'react';
import {
  downloadDocumentLayoutPdf,
  printDocumentLayout,
} from '../../api/documentPrintApi';
import useDocumentLayouts, { isLayoutExportSupported } from '../../hooks/useDocumentLayouts';
import { base64ToPdfBlob, downloadPdfBlob, openPdfBlobInNewTab } from '../../utils/pdfUtils';
import { useAuth } from '../../auth/AuthContext';

const DEFAULT_SCHEMA = process.env.REACT_APP_SAP_REPORT_SCHEMA || '';

const buildDefaultFileName = (documentType, docEntry, docNumber, docCode) =>
  `${String(documentType || 'document').replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')}-${docNumber || docEntry || 'document'}-${docCode || 'layout'}.pdf`;

const buildLayoutLabel = (layout) => {
  const name = layout.layout_name || layout.layout_id;
  const type = layout.layout_type ? ` - ${layout.layout_type}` : '';
  const language = layout.language_name ? ` - ${layout.language_name}` : '';
  const support = isLayoutExportSupported(layout) ? '' : ' - PDF API not supported';
  return `${layout.layout_id} - ${name}${type}${language}${support}`;
};

const getErrorMessage = (error, fallbackMessage) =>
  error.response?.data?.detail ||
  error.response?.data?.message ||
  error.message ||
  fallbackMessage;

function PrintLayoutToolbar({
  documentType,
  documentLabel = 'Document',
  docEntry,
  docNumber,
  cardCode,
  disabled = false,
  defaultDocCode = '',
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
  const [cachedPdfByKey, setCachedPdfByKey] = useState({});
  const {
    docCode,
    setDocCode,
    layouts,
    layoutsLoading,
    metadata,
    selectedLayout,
    canExportSelectedLayout,
  } = useDocumentLayouts({
    documentType,
    defaultDocCode,
    reloadKey: layoutReloadKey,
    onError,
  });
  const resolvedDefaultSchema = String(
    metadata?.defaultSchema ||
      companySchema ||
      defaultSchema ||
      DEFAULT_SCHEMA ||
      '',
  ).trim();

  useEffect(() => {
    setSchema(resolvedDefaultSchema);
  }, [resolvedDefaultSchema, documentType, layoutReloadKey]);

  useEffect(() => {
    setCachedPdfByKey({});
  }, [documentType, docEntry, docCode, schema]);

  const notifySuccess = (message) => {
    onSuccess?.(message);
  };

  const notifyError = (message) => {
    onError?.(message);
  };

  const validatePrintableSelection = () => {
    if (!String(docEntry ?? '').trim()) {
      notifyError(`Save or load a ${documentLabel.toLowerCase()} before printing.`);
      return false;
    }

    if (!String(docCode ?? '').trim()) {
      notifyError('Layout DocCode is required before printing.');
      return false;
    }

    if (selectedLayout && !isLayoutExportSupported(selectedLayout)) {
      notifyError(
        `${selectedLayout.layout_id || 'Selected layout'} is a PLD layout. The PDF API exports Crystal layouts only.`,
      );
      return false;
    }

    return true;
  };

  const getPdfDocument = async (layoutDocCode = docCode) => {
    const normalizedDocEntry = String(docEntry ?? '').trim();
    const normalizedDocCode = String(layoutDocCode ?? '').trim();
    const normalizedSchema = String(schema ?? '').trim();
    const normalizedDocNumber = String(docNumber ?? '').trim();
    const normalizedCardCode = String(cardCode ?? '').trim();
    const cacheKey = [
      documentType,
      normalizedDocEntry,
      normalizedDocNumber,
      normalizedCardCode,
      normalizedDocCode,
      normalizedSchema,
    ].join('::');

    if (!normalizedDocEntry) {
      throw new Error(`Save or load a ${documentLabel.toLowerCase()} before printing.`);
    }

    if (!normalizedDocCode) {
      throw new Error('Layout DocCode is required before printing.');
    }

    if (!normalizedSchema) {
      throw new Error('Schema is required before printing.');
    }

    if (selectedLayout && !isLayoutExportSupported(selectedLayout)) {
      throw new Error(
        `${selectedLayout.layout_id || normalizedDocCode} is a PLD layout. The PDF API exports Crystal layouts only.`,
      );
    }

    if (cachedPdfByKey[cacheKey]) {
      return cachedPdfByKey[cacheKey];
    }

    const response = await printDocumentLayout({
      documentType,
      docEntry: normalizedDocEntry,
      docNum: docNumber,
      cardCode,
      docCode: normalizedDocCode,
      layoutName: selectedLayout?.layout_name || '',
      schema: normalizedSchema,
    });

    const nextPdf = {
      blob: base64ToPdfBlob(response.data?.base64Pdf),
      fileName:
        response.data?.fileName ||
        buildDefaultFileName(documentType, normalizedDocEntry, docNumber, normalizedDocCode),
      docEntry: normalizedDocEntry,
      docCode: normalizedDocCode,
      schema: normalizedSchema,
    };

    setCachedPdfByKey((current) => ({
      ...current,
      [cacheKey]: nextPdf,
    }));

    return nextPdf;
  };

  const handlePreview = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!validatePrintableSelection()) {
      return;
    }

    const previewWindow = window.open('', '_blank');

    if (!previewWindow) {
      notifyError('Please allow pop-ups to preview the PDF.');
      return;
    }

    try {
      previewWindow.opener = null;
      previewWindow.document.title = `Generating ${documentLabel} PDF...`;
      previewWindow.document.body.innerHTML =
        '<p style="font-family: Segoe UI, Arial, sans-serif; padding: 16px;">Generating PDF preview...</p>';
    } catch (_error) {
      // Keep going: the PDF URL can still be assigned once it is generated.
    }

    setLoading(true);

    try {
      const pdfDocument = await getPdfDocument();

      openPdfBlobInNewTab(pdfDocument.blob, previewWindow);
      notifySuccess(`${documentLabel} PDF opened for layout ${pdfDocument.docCode}.`);
    } catch (error) {
      previewWindow.close();
      notifyError(getErrorMessage(error, `Failed to preview the ${documentLabel.toLowerCase()} PDF.`));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (!validatePrintableSelection()) {
      return;
    }

    setLoading(true);

    try {
      const response = await downloadDocumentLayoutPdf({
        documentType,
        docEntry,
        docNum: docNumber,
        cardCode,
        docCode,
        layoutName: selectedLayout?.layout_name || '',
        schema,
      });
      const fileName =
        response.data?.fileName ||
        buildDefaultFileName(documentType, docEntry, docNumber, docCode);

      downloadPdfBlob(base64ToPdfBlob(response.data?.base64Pdf), fileName);
      notifySuccess(`${documentLabel} PDF downloaded as ${fileName}.`);
    } catch (error) {
      notifyError(getErrorMessage(error, `Failed to download the ${documentLabel.toLowerCase()} PDF.`));
    } finally {
      setLoading(false);
    }
  };

  const actionDisabled =
    disabled ||
    loading ||
    layoutsLoading ||
    !docEntry ||
    !canExportSelectedLayout ||
    (selectedLayout && !isLayoutExportSupported(selectedLayout));
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
        <select
          id={`${documentType}-print-doc-code`}
          className={`${inputClass} ${inputClass}--layout`}
          value={docCode}
          onChange={(event) => setDocCode(event.target.value)}
          disabled={loading || layoutsLoading || disabled}
        >
          {layouts.length === 0 && (
            <option value={docCode}>
              {layoutsLoading ? 'Loading layouts...' : docCode || 'No layouts found'}
            </option>
          )}
          {layouts.map((layout) => (
            <option key={layout.layout_id} value={layout.layout_id} disabled={!isLayoutExportSupported(layout)}>
              {buildLayoutLabel(layout)}
            </option>
          ))}
        </select>
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
          disabled={loading || disabled}
          placeholder={resolvedDefaultSchema || 'Schema'}
        />
      </div>

      <button
        type="button"
        className={buttonClass}
        onClick={handlePreview}
        disabled={actionDisabled}
        title={docEntry ? `Open the selected ${documentLabel.toLowerCase()} layout PDF in a new browser tab.` : `Load a saved ${documentLabel.toLowerCase()} to print.`}
      >
        {loading ? 'Generating PDF...' : `Print ${documentLabel}`}
      </button>

      <button
        type="button"
        className={buttonClass}
        onClick={handleDownload}
        disabled={actionDisabled}
        title={docEntry ? `Download the selected ${documentLabel.toLowerCase()} layout PDF.` : `Load a saved ${documentLabel.toLowerCase()} to download.`}
      >
        Download PDF
      </button>

    </div>
  );
}

export default PrintLayoutToolbar;
