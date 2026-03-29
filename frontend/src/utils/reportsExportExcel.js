/**
 * Styled Excel export — lazy-loaded with exceljs (~900kb) only when user exports.
 */
import ExcelJS from 'exceljs';
import { formatReportCell } from './dateUtils';

const BRAND = { argb: 'FF4F46E5' };
const HEADER_BG = { argb: 'FFEEF2FF' };
const META_COLOR = { argb: 'FF64748B' };

function colLetters(n) {
  let s = '';
  let num = Math.max(1, n);
  while (num > 0) {
    const mod = (num - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function cellStr(v) {
  if (v === null || v === undefined) return '';
  return formatReportCell(v);
}

export async function downloadStyledExcel({ reportTitle, metaLines = [], columns, rows, filenameBase = 'report' }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IT Helpdesk Reports';
  const ws = wb.addWorksheet('Data', {
    properties: { defaultRowHeight: 18 },
    views: [{ state: 'frozen', ySplit: 3 + metaLines.length }],
  });

  let r = 1;
  const span = Math.max(4, columns.length);
  ws.mergeCells(`A${r}:${colLetters(span)}${r}`);
  const titleCell = ws.getCell(r, 1);
  titleCell.value = reportTitle;
  titleCell.font = { size: 18, bold: true, color: BRAND };
  titleCell.alignment = { vertical: 'middle' };
  r += 1;

  metaLines.forEach((line) => {
    ws.mergeCells(`A${r}:${colLetters(span)}${r}`);
    const c = ws.getCell(r, 1);
    c.value = line;
    c.font = { size: 11, color: META_COLOR, italic: true };
    r += 1;
  });

  r += 1;

  const headerRow = ws.getRow(r);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col;
    cell.font = { bold: true, color: BRAND };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: HEADER_BG,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
  r += 1;

  rows.forEach((row) => {
    const excelRow = ws.getRow(r);
    columns.forEach((col, i) => {
      excelRow.getCell(i + 1).value = cellStr(row[col]);
    });
    r += 1;
  });

  ws.columns.forEach((col) => {
    let max = 12;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = Math.min(len, 48);
    });
    col.width = max + 2;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
