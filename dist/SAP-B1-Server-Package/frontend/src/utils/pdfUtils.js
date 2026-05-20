const PDF_DATA_PREFIX = 'data:application/pdf;base64,';

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

export const openPdfBlobInNewTab = (blob, previewWindow = null) => {
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

  if (typeof targetWindow.location?.replace === 'function') {
    targetWindow.location.replace(objectUrl);
  } else {
    targetWindow.location.href = objectUrl;
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60000);

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
