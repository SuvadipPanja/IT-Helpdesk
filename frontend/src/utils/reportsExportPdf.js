/**
 * PDF export — lazy-loaded (jspdf + autotable) to keep initial bundle small.
 */
import { formatReportCell } from './dateUtils';

function cellStr(v) {
  if (v === null || v === undefined) return '';
  return formatReportCell(v);
}

/**
 * @param {object} opts
 * @param {string} opts.reportTitle
 * @param {string[]} [opts.metaLines]
 * @param {string[]} opts.columns
 * @param {object[]} opts.rows
 * @param {string} [opts.filenameBase]
 */
export async function downloadReportPdf({ reportTitle, metaLines = [], columns, rows, filenameBase = 'report' }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);

  const orientation = columns.length > 10 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const margin = 36;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text(reportTitle, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  metaLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 12;
  });
  y += 8;

  const head = [columns];
  const body = rows.map((row) =>
    columns.map((c) => {
      const s = cellStr(row[c]);
      return s.length > 240 ? `${s.slice(0, 237)}...` : s;
    })
  );

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: columns.length > 12 ? 6 : 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: {
      fillColor: [238, 242, 255],
      textColor: [79, 70, 229],
      fontStyle: 'bold',
      fontSize: columns.length > 12 ? 6 : 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    tableWidth: 'auto',
    theme: 'striped',
    showHead: 'everyPage',
  });

  doc.save(`${filenameBase}.pdf`);
}
