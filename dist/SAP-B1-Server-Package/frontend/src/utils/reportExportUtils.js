const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeFileName = (value, fallback = 'report') => {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');

  return normalized || fallback;
};

const formatExportStamp = (value) => {
  const date = value instanceof Date ? value : new Date();

  return {
    dateText: date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }),
    timeText: date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  };
};

const normalizeCell = (cell) => {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
    return {
      value: cell.value ?? '',
      align: cell.align || 'left',
      colSpan: Number(cell.colSpan || 1),
      className: cell.className || '',
    };
  }

  return {
    value: cell ?? '',
    align: 'left',
    colSpan: 1,
    className: '',
  };
};

const buildCriteriaRowsHtml = (criteriaRows = []) => {
  if (!criteriaRows.length) {
    return '';
  }

  return criteriaRows
    .map(
      (row) => `
        <div class="report-export__criteria-row">
          <span class="report-export__criteria-label">${escapeHtml(row.label)}</span>
          <span>From</span>
          <span class="report-export__criteria-value">${escapeHtml(row.from || '')}</span>
          <span>To</span>
          <span class="report-export__criteria-value">${escapeHtml(row.to || '')}</span>
        </div>
      `,
    )
    .join('');
};

const buildTableHeaderHtml = (columns = []) =>
  columns
    .map(
      (column) => `
        <th class="align-${escapeHtml(column.align || 'left')}">${escapeHtml(column.label || '')}</th>
      `,
    )
    .join('');

const buildTableRowHtml = (row = [], tagName = 'td') =>
  row
    .map((cell) => {
      const normalized = normalizeCell(cell);
      const className = [normalized.className, `align-${normalized.align}`].filter(Boolean).join(' ');
      const colSpan = normalized.colSpan > 1 ? ` colspan="${normalized.colSpan}"` : '';

      return `<${tagName}${colSpan} class="${escapeHtml(className)}">${escapeHtml(normalized.value)}</${tagName}>`;
    })
    .join('');

const buildTableHtml = ({ columns = [], rows = [], footer = [] } = {}) => `
  <table class="report-export__table">
    <thead>
      <tr>${buildTableHeaderHtml(columns)}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `<tr>${buildTableRowHtml(row)}</tr>`).join('')}
    </tbody>
    ${footer.length ? `<tfoot><tr>${buildTableRowHtml(footer)}</tr></tfoot>` : ''}
  </table>
`;

const buildSectionsHtml = (sections = []) =>
  sections
    .filter((section) => String(section || '').trim())
    .map((section) => `<div class="report-export__section">${section}</div>`)
    .join('');

const buildReportDocumentHtml = ({
  companyName = 'SAP Business One',
  reportTitle = 'Report',
  documentLabel = '',
  criteriaRows = [],
  columns = [],
  rows = [],
  footer = [],
  sections = [],
}) => {
  const { dateText, timeText } = formatExportStamp(new Date());

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(reportTitle)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #000000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 11px;
            background: #ffffff;
          }

          .report-export {
            width: 100%;
          }

          .report-export__meta {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 10px;
          }

          .report-export__page {
            font-size: 11px;
            font-weight: 600;
          }

          .report-export__stamp {
            min-width: 170px;
            margin-left: 16px;
          }

          .report-export__stamp-row {
            display: grid;
            grid-template-columns: 48px 1fr;
            gap: 8px;
            margin-bottom: 4px;
          }

          .report-export__header {
            margin-bottom: 10px;
          }

          .report-export__company {
            margin: 0;
            text-align: center;
            font-size: 24px;
            font-weight: 700;
            text-decoration: underline;
          }

          .report-export__title {
            margin: 10px 0 12px;
            text-align: center;
            font-size: 20px;
            font-weight: 700;
          }

          .report-export__filters {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 18px;
            margin-bottom: 12px;
          }

          .report-export__criteria {
            flex: 1 1 auto;
          }

          .report-export__criteria-row {
            display: grid;
            grid-template-columns: 100px 34px 74px 20px 74px;
            gap: 8px;
            margin-bottom: 4px;
            align-items: center;
          }

          .report-export__criteria-label {
            font-weight: 600;
          }

          .report-export__criteria-value {
            min-height: 16px;
          }

          .report-export__document-label {
            white-space: nowrap;
            font-size: 18px;
            font-weight: 700;
          }

          .report-export__table {
            width: 100%;
            border-collapse: collapse;
            table-layout: auto;
          }

          .report-export__table th,
          .report-export__table td {
            border: 1px solid #222222;
            padding: 4px 6px;
            vertical-align: middle;
          }

          .report-export__table thead th {
            background: #f1f1f1;
            font-weight: 700;
          }

          .report-export__table tfoot td {
            font-weight: 700;
          }

          .align-left {
            text-align: left;
          }

          .align-center {
            text-align: center;
          }

          .align-right {
            text-align: right;
          }

          .report-export__section {
            margin-top: 14px;
          }

          .report-export__diagram-title {
            margin: 0 0 8px;
            font-size: 12px;
            font-weight: 700;
          }

          .report-export__diagram-grid {
            display: flex;
            gap: 14px;
            align-items: flex-start;
          }

          .report-export__diagram-grid svg {
            max-width: 100%;
            height: auto;
          }
        </style>
      </head>
      <body>
        <div class="report-export">
          <div class="report-export__meta">
            <div class="report-export__page">Page 1</div>
            <div class="report-export__stamp">
              <div class="report-export__stamp-row">
                <strong>Date</strong>
                <span>${escapeHtml(dateText)}</span>
              </div>
              <div class="report-export__stamp-row">
                <strong>Time</strong>
                <span>${escapeHtml(timeText)}</span>
              </div>
            </div>
          </div>

          <div class="report-export__header">
            <h1 class="report-export__company">${escapeHtml(companyName)}</h1>
            <div class="report-export__title">${escapeHtml(reportTitle)}</div>
          </div>

          <div class="report-export__filters">
            <div class="report-export__criteria">
              ${buildCriteriaRowsHtml(criteriaRows)}
            </div>
            ${documentLabel ? `<div class="report-export__document-label">${escapeHtml(documentLabel)}</div>` : ''}
          </div>

          ${buildTableHtml({ columns, rows, footer })}
          ${buildSectionsHtml(sections)}
        </div>
      </body>
    </html>
  `;
};

const downloadBlob = (blob, fileName) => {
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

export const exportReportAsExcel = (config) => {
  const fileName = `${sanitizeFileName(config?.fileName || config?.reportTitle || 'report')}.xls`;
  const html = buildReportDocumentHtml(config);
  const blob = new Blob([html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });

  downloadBlob(blob, fileName);
};

export const exportReportAsPdf = (config) => {
  const printWindow = window.open('', '_blank');

  if (!printWindow) {
    throw new Error('Please allow pop-ups to export the report as PDF.');
  }

  const html = buildReportDocumentHtml(config);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  };
};
