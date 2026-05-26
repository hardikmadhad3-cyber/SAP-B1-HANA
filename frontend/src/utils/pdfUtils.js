const PDF_DATA_PREFIX = 'data:application/pdf;base64,';

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const normalizeBase64Pdf = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('The PDF response is empty.');
  }

  return value
    .trim()
    .replace(PDF_DATA_PREFIX, '')
    .replace(/\s+/g, '');
};

export const base64ToPdfBlob = (base64Pdf) => {
  const normalizedBase64 = normalizeBase64Pdf(base64Pdf);
  const byteCharacters = atob(normalizedBase64);
  const chunkSize = 512;
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += chunkSize) {
    const slice = byteCharacters.slice(offset, offset + chunkSize);
    const byteNumbers = new Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      byteNumbers[index] = slice.charCodeAt(index);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: 'application/pdf' });
};

const writePdfPreviewDocument = (targetWindow, objectUrl, title) => {
  const safeTitle = escapeHtml(title || 'PDF Preview');
  const safeUrl = escapeHtml(objectUrl);

  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      background: #f5f6f7;
      overflow: hidden;
    }

    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      background: #fff;
    }
  </style>
</head>
<body>
  <iframe src="${safeUrl}" title="${safeTitle}"></iframe>
</body>
</html>`);
  targetWindow.document.close();
};

export const openPdfBlobInNewTab = (blob, previewWindow = null, options = {}) => {
  const objectUrl = URL.createObjectURL(blob);
  const targetWindow = previewWindow || window.open('', '_blank', 'noopener,noreferrer');

  if (!targetWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Please allow pop-ups to preview the PDF.');
  }

  try {
    targetWindow.opener = null;
  } catch (_error) {
    // Some browsers block touching opener after a cross-origin navigation.
  }

  try {
    writePdfPreviewDocument(targetWindow, objectUrl, options.title || options.fileName);
  } catch (_error) {
    if (typeof targetWindow.location?.replace === 'function') {
      targetWindow.location.replace(objectUrl);
    } else {
      targetWindow.location.href = objectUrl;
    }
  }

  try {
    targetWindow.addEventListener('beforeunload', () => URL.revokeObjectURL(objectUrl), { once: true });
  } catch (_error) {
    // Keep the timeout cleanup below as the cross-browser fallback.
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 10 * 60 * 1000);

  return objectUrl;
};

export const downloadPdfBlob = (blob, fileName = 'document.pdf') => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
};
