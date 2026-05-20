import { useEffect, useRef, useState } from 'react';
import { fetchDocumentLayouts } from '../api/documentPrintApi';

export const isLayoutExportSupported = (layout) => {
  const rawValue = layout?.is_export_supported;

  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'number') return rawValue === 1;

  const normalizedValue = String(rawValue ?? '').trim().toLowerCase();
  if (['1', 'true', 'y', 'yes'].includes(normalizedValue)) return true;
  if (['0', 'false', 'n', 'no', ''].includes(normalizedValue)) return false;

  const categoryCode = String(layout?.category_code || '').trim().toUpperCase();
  if (categoryCode) return categoryCode === 'C';

  const layoutType = String(layout?.layout_type || '').trim().toLowerCase();
  return layoutType.includes('crystal');
};

const normalizeLayout = (layout) => ({
  ...layout,
  is_export_supported: isLayoutExportSupported(layout),
});

const chooseLayoutCode = (layouts, currentDocCode, preferredDocCode) => {
  if (!layouts.length) {
    return currentDocCode || preferredDocCode || '';
  }

  const currentLayout = layouts.find((layout) => layout.layout_id === currentDocCode);
  if (currentLayout?.is_export_supported) {
    return currentDocCode;
  }

  const preferredLayout =
    preferredDocCode &&
    layouts.find((layout) => layout.layout_id === preferredDocCode && layout.is_export_supported);

  const fallbackLayout =
    preferredLayout ||
    layouts.find((layout) => layout.is_export_supported) ||
    layouts[0];

  return fallbackLayout?.layout_id || currentDocCode || preferredDocCode || '';
};

const useDocumentLayouts = ({
  documentType,
  defaultDocCode = '',
  onError,
} = {}) => {
  const [docCode, setDocCode] = useState(defaultDocCode);
  const [layouts, setLayouts] = useState([]);
  const [layoutsLoading, setLayoutsLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    setDocCode(defaultDocCode || '');
  }, [defaultDocCode, documentType]);

  useEffect(() => {
    let ignore = false;

    const loadLayouts = async () => {
      if (!documentType) {
        setLayouts([]);
        setMetadata(null);
        return;
      }

      setLayoutsLoading(true);

      try {
        const response = await fetchDocumentLayouts(documentType);
        const nextLayouts = Array.isArray(response.data?.layouts)
          ? response.data.layouts.map(normalizeLayout)
          : [];
        const preferredDocCode = defaultDocCode || response.data?.defaultDocCode || '';

        if (ignore) {
          return;
        }

        setLayouts(nextLayouts);
        setMetadata({
          documentType: response.data?.documentType || documentType,
          documentLabel: response.data?.documentLabel || '',
          objectType: response.data?.objectType || '',
          typeCode: response.data?.typeCode || '',
          defaultSchema: response.data?.defaultSchema || '',
        });
        setDocCode((currentDocCode) => chooseLayoutCode(nextLayouts, currentDocCode, preferredDocCode));
      } catch (error) {
        if (!ignore) {
          onErrorRef.current?.(
            error.response?.data?.detail ||
              error.response?.data?.message ||
              error.message ||
              'Failed to load document print layouts.',
          );
        }
      } finally {
        if (!ignore) {
          setLayoutsLoading(false);
        }
      }
    };

    loadLayouts();

    return () => {
      ignore = true;
    };
  }, [defaultDocCode, documentType]);

  const selectedLayout = layouts.find((layout) => layout.layout_id === docCode) || null;
  const canExportSelectedLayout = !selectedLayout || selectedLayout.is_export_supported;

  return {
    docCode,
    setDocCode,
    layouts,
    layoutsLoading,
    metadata,
    selectedLayout,
    canExportSelectedLayout,
  };
};

export default useDocumentLayouts;
