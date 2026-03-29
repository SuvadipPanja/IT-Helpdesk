import { formatReportCell } from './dateUtils';

function cellStr(v) {
  if (v === null || v === undefined) return '';
  return formatReportCell(v);
}

export function downloadCsv(columns, rows, filenameBase = 'report') {
  const esc = (v) => {
    const s = cellStr(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map(esc).join(',');
  const lines = rows.map((row) => columns.map((c) => esc(row[c])).join(','));
  const csv = '\uFEFF' + [head, ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
