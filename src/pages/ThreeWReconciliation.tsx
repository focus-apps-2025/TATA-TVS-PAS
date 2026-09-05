import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Grid, LinearProgress, Stack, Step, StepLabel, Stepper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography, alpha,
} from '@mui/material';
import {
  ArrowBack, CheckCircle, CloudUpload, Description, DirectionsBus, Download,
  InfoOutlined, InsertDriveFile, Inventory2,
} from '@mui/icons-material';

type UploadKind = 'dms' | 'physical';
type CellValue = string | number | boolean | Date | null | undefined;

interface SourceRow {
  partNo: string;
  mrp: number;
  quantity: number;
  description: string;
  category: string;
  rack: string;
  dealerId: string;
  branchId: string;
}

interface ParsedWorkbook {
  file: File;
  sheetName: string;
  rawRows: CellValue[][];
  headerRow: number;
  rows: SourceRow[];
  groupedRows: number;
}

interface ComparisonRow {
  partNo: string;
  category: string;
  description: string;
  dmsQty: number;
  physicalQty: number;
  difference: number;
  dmsMrp: number;
  physicalMrp: number;
  stockValue: number;
  physicalValue: number;
  varianceValue: number;
  remark: 'MATCHED' | 'SHORTAGE' | 'EXCESS';
}

interface TemplateRow extends SourceRow {
  systemQty: number;
}

interface UploadPanelProps {
  kind: UploadKind;
  data: ParsedWorkbook | null;
  onFileChange: (file: File | null) => Promise<void>;
  disabled?: boolean;
}

const steps = ['Set up', 'Upload data', 'Validate files', 'Export workbook'];
const blue = 'FF0070C0';
const teal = '#0F766E';

const formatFileSize = (size: number) => size < 1024 * 1024
  ? `${Math.max(1, Math.round(size / 1024))} KB`
  : `${(size / (1024 * 1024)).toFixed(1)} MB`;

const cleanHeader = (value: CellValue) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const cleanPartNo = (value: CellValue) => String(value ?? '').trim().toUpperCase();
const normalizeCategory = (value: CellValue) => {
  const category = String(value ?? '').trim().toUpperCase();
  if (category.includes('ACCESSOR')) return 'ACCESSORIES';
  if (category.includes('SPARE')) return 'SPARES';
  return category || 'SPARES';
};
const numberValue = (value: CellValue) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatAuditDate = (value: string) => {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}-${month}-${year}` : value;
};
const varianceColor = (value: number) => value === 0 ? '#15803D' : value < 0 ? '#B91C1C' : '#B45309';
const excelVarianceColor = (value: number) => value === 0 ? 'FF15803D' : value < 0 ? 'FFB91C1C' : 'FFB45309';

const findHeaderRow = (rows: CellValue[][], aliases: string[][]) => {
  for (let index = 0; index < Math.min(25, rows.length); index += 1) {
    const headers = rows[index].map(cleanHeader);
    if (aliases.every((group) => group.some((alias) => headers.includes(alias)))) return index;
  }
  return -1;
};

const findColumn = (headers: CellValue[], aliases: string[]) => {
  const normalized = headers.map(cleanHeader);
  for (const alias of aliases) {
    const exactIndex = normalized.indexOf(alias);
    if (exactIndex >= 0) return exactIndex;
  }
  return -1;
};

// Groups rows by Rack No + Part No + MRP — duplicate entries sharing all three fields
// have their quantities summed into a single consolidated row.
const groupRows = (rows: SourceRow[]) => {
  const grouped = new Map<string, SourceRow>();
  rows.forEach((row) => {
    const key = `${row.rack}|${row.partNo}|${row.mrp.toFixed(2)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      if (!existing.description && row.description) existing.description = row.description;
      if (!existing.category && row.category) existing.category = row.category;
    } else {
      grouped.set(key, { ...row });
    }
  });
  return grouped;
};

// Re-aggregates rack-level groups to Part No + MRP level for DMS comparison
// (DMS data has no rack info, so comparison is done at part+MRP granularity).
const aggregateByPartMrp = (grouped: Map<string, SourceRow>) => {
  const aggregated = new Map<string, SourceRow>();
  grouped.forEach((row) => {
    const key = `${row.partNo}|${row.mrp.toFixed(2)}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += row.quantity;
    } else {
      aggregated.set(key, { ...row });
    }
  });
  return aggregated;
};

const parseWorkbook = async (file: File, kind: UploadKind): Promise<ParsedWorkbook> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The workbook does not contain a worksheet.');
  const rawRows = XLSX.utils.sheet_to_json<CellValue[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });

  const requiredAliases = kind === 'dms'
    ? [['partno', 'partnumber'], ['unitprice', 'mrp'], ['totalstock', 'quantity', 'qty']]
    : [['partno', 'partnumber'], ['mrp'], ['quantity', 'qty']];
  const headerRow = findHeaderRow(rawRows, requiredAliases);
  if (headerRow < 0) {
    const expected = kind === 'dms'
      ? 'PartNo, Unit Price/MRP, and Total Stock/Quantity'
      : 'PartNo, MRP, and Quantity';
    throw new Error(`Could not find the required columns: ${expected}.`);
  }

  const headers = rawRows[headerRow];
  const partIndex = findColumn(headers, ['partno', 'partnumber']);
  const mrpIndex = findColumn(headers, kind === 'dms' ? ['unitprice', 'mrp'] : ['mrp', 'unitprice']);
  const quantityIndex = findColumn(headers, kind === 'dms' ? ['totalstock', 'quantity', 'qty', 'freeqty'] : ['quantity', 'qty', 'physicalqty']);
  const descriptionIndex = findColumn(headers, kind === 'dms' ? ['partdesc', 'partdescription', 'description'] : ['description', 'partdescription', 'partdesc']);
  const categoryIndex = findColumn(headers, kind === 'dms' ? ['category', 'locationname', 'location'] : ['location', 'category']);
  const rackIndex = findColumn(headers, ['rack', 'rackno', 'racknumber']);
  const dealerIdIndex = findColumn(headers, ['dealerid', 'dealercode']);
  const branchIdIndex = findColumn(headers, ['branchid', 'branchcode']);

  const rows = rawRows.slice(headerRow + 1).reduce<SourceRow[]>((result, row) => {
    const partNo = cleanPartNo(row[partIndex]);
    if (!partNo) return result;
    result.push({
      partNo,
      mrp: numberValue(row[mrpIndex]),
      quantity: numberValue(row[quantityIndex]),
      description: descriptionIndex >= 0 ? String(row[descriptionIndex] ?? '').trim() : '',
      category: categoryIndex >= 0 ? normalizeCategory(row[categoryIndex]) : 'SPARES',
      rack: rackIndex >= 0 ? String(row[rackIndex] ?? '').trim() : '',
      dealerId: dealerIdIndex >= 0 ? String(row[dealerIdIndex] ?? '').trim() : '',
      branchId: branchIdIndex >= 0 ? String(row[branchIdIndex] ?? '').trim() : '',
    });
    return result;
  }, []);

  if (!rows.length) throw new Error('No valid rows were found below the header row.');
  return { file, sheetName, rawRows, headerRow, rows, groupedRows: groupRows(rows).size };
};

const compareSources = (dms: ParsedWorkbook, physical: ParsedWorkbook): ComparisonRow[] => {
  // First group by Rack+Part+MRP, then aggregate to Part+MRP for DMS comparison.
  const dmsGroups = aggregateByPartMrp(groupRows(dms.rows));
  const physicalGroups = aggregateByPartMrp(groupRows(physical.rows));
  const keys = new Set([...dmsGroups.keys(), ...physicalGroups.keys()]);
  return [...keys].map((key) => {
    const dmsRow = dmsGroups.get(key);
    const physicalRow = physicalGroups.get(key);
    const dmsQty = dmsRow?.quantity || 0;
    const physicalQty = physicalRow?.quantity || 0;
    const difference = physicalQty - dmsQty;
    const dmsMrp = dmsRow?.mrp || 0;
    const physicalMrp = physicalRow?.mrp || 0;
    const remark: ComparisonRow['remark'] = difference === 0 ? 'MATCHED' : difference > 0 ? 'EXCESS' : 'SHORTAGE';
    return {
      partNo: dmsRow?.partNo || physicalRow?.partNo || '',
      category: physicalRow?.category || dmsRow?.category || 'SPARES',
      description: dmsRow?.description || physicalRow?.description || '',
      dmsQty,
      physicalQty,
      difference,
      dmsMrp,
      physicalMrp,
      stockValue: dmsQty * dmsMrp,
      physicalValue: physicalQty * physicalMrp,
      varianceValue: (physicalQty * physicalMrp) - (dmsQty * dmsMrp),
      remark,
    };
  }).sort((a, b) => a.partNo.localeCompare(b.partNo, undefined, { numeric: true }) || a.physicalMrp - b.physicalMrp);
};

const buildTemplateRows = (dms: ParsedWorkbook, physical: ParsedWorkbook): TemplateRow[] => {
  // DMS aggregated at Part+MRP level; physical kept at Rack+Part+MRP level for template detail.
  const dmsAggregated = aggregateByPartMrp(groupRows(dms.rows));
  const physicalGrouped = groupRows(physical.rows);
  const assignedDmsKeys = new Set<string>();
  const templateRows = [...physicalGrouped.values()].sort((a, b) => (
    a.partNo.localeCompare(b.partNo, undefined, { numeric: true }) || a.mrp - b.mrp
  )).map((row) => {
    const key = `${row.partNo}|${row.mrp.toFixed(2)}`;
    const systemQty = assignedDmsKeys.has(key) ? 0 : (dmsAggregated.get(key)?.quantity || 0);
    assignedDmsKeys.add(key);
    return { ...row, systemQty };
  });

  return templateRows.sort((a, b) => (
    a.partNo.localeCompare(b.partNo, undefined, { numeric: true }) || a.mrp - b.mrp
  ));
};

const setBorder = (cell: ExcelJS.Cell) => {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF1F2937' } }, bottom: { style: 'thin', color: { argb: 'FF1F2937' } },
    left: { style: 'thin', color: { argb: 'FF1F2937' } }, right: { style: 'thin', color: { argb: 'FF1F2937' } },
  };
};

const styleRawSheet = (sheet: ExcelJS.Worksheet, widths: number[], headerRowNumber: number) => {
  const header = sheet.getRow(headerRowNumber);
  header.height = 25;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004F98' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    setBorder(cell);
  });
  for (let rowIndex = headerRowNumber + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    sheet.getRow(rowIndex).eachCell((cell) => { setBorder(cell); cell.alignment = { vertical: 'middle' }; });
  }
  sheet.columns.forEach((column, index) => { column.width = widths[index] || 16; });
  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  sheet.autoFilter = { from: `A${headerRowNumber}`, to: `${String.fromCharCode(64 + Math.min(sheet.columnCount, 26))}${headerRowNumber}` };
};

const createWorkbook = async (
  rows: ComparisonRow[],
  templateRows: TemplateRow[],
  dms: ParsedWorkbook,
  physical: ParsedWorkbook,
  name: string,
  dealershipName: string,
  dealerId: string,
  branchId: string,
  locationName: string,
  auditStartDate: string,
  auditCloseDate: string,
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PAS 3W TVS Reconciliation';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const report = workbook.addWorksheet('REPORT');
  const reportHeaders = ['S.No.', 'Category', 'Part Number', 'Part Description', 'DMS Qty', 'Phy Qty', 'Diff.', 'DMS MRP', 'PHY MRP', 'Stock Value', 'Phy Value', 'Short / Excess', 'Remarks'];
  report.addRow(reportHeaders);
  rows.forEach((row, index) => report.addRow([index + 1, row.category, row.partNo, row.description, row.dmsQty, row.physicalQty, row.difference, row.dmsMrp, row.physicalMrp, row.stockValue, row.physicalValue, row.varianceValue, row.remark]));
  report.getRow(1).height = 36;
  report.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    setBorder(cell);
  });
  for (let rowIndex = 2; rowIndex <= report.rowCount; rowIndex += 1) {
    const row = report.getRow(rowIndex);
    const status = String(row.getCell(13).value || '');
    row.eachCell((cell) => { setBorder(cell); cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(13).font = { bold: true, color: { argb: status === 'MATCHED' ? 'FF166534' : status === 'SHORTAGE' ? 'FFB91C1C' : 'FFB45309' } };
    const variance = Number(row.getCell(12).value) || 0;
    row.getCell(12).font = { bold: true, color: { argb: excelVarianceColor(variance) } };
    [8, 9, 10, 11, 12].forEach((column) => { row.getCell(column).numFmt = '#,##0.00'; });
  }
  report.columns = [8, 16, 18, 42, 11, 11, 10, 12, 12, 16, 16, 18, 14].map((width) => ({ width }));
  report.views = [{ state: 'frozen', ySplit: 1 }];
  report.autoFilter = { from: 'A1', to: 'M1' };

  const summary = workbook.addWorksheet('SUMMARY');
  const categoryMap = new Map<string, ComparisonRow[]>();
  rows.forEach((row) => {
    const category = row.category || 'SPARES';
    categoryMap.set(category, [...(categoryMap.get(category) || []), row]);
  });
  const categorySummary = [...categoryMap.entries()].map(([category, categoryRows]) => ({
    category,
    dmsValue: categoryRows.reduce((sum, row) => sum + row.stockValue, 0),
    dmsLines: categoryRows.filter((row) => row.dmsQty > 0).length,
    dmsQuantity: categoryRows.reduce((sum, row) => sum + row.dmsQty, 0),
    physicalValue: categoryRows.reduce((sum, row) => sum + row.physicalValue, 0),
    physicalLines: categoryRows.filter((row) => row.physicalQty > 0).length,
    physicalQuantity: categoryRows.reduce((sum, row) => sum + row.physicalQty, 0),
    excessValue: categoryRows.filter((row) => row.varianceValue > 0).reduce((sum, row) => sum + row.varianceValue, 0),
    excessLines: categoryRows.filter((row) => row.difference > 0).length,
    shortageValue: categoryRows.filter((row) => row.varianceValue < 0).reduce((sum, row) => sum + row.varianceValue, 0),
    shortageLines: categoryRows.filter((row) => row.difference < 0).length,
  }));
  const totalSummary = categorySummary.reduce((total, row) => ({
    category: 'TOTAL', dmsValue: total.dmsValue + row.dmsValue, dmsLines: total.dmsLines + row.dmsLines, dmsQuantity: total.dmsQuantity + row.dmsQuantity,
    physicalValue: total.physicalValue + row.physicalValue, physicalLines: total.physicalLines + row.physicalLines, physicalQuantity: total.physicalQuantity + row.physicalQuantity,
    excessValue: total.excessValue + row.excessValue, excessLines: total.excessLines + row.excessLines, shortageValue: total.shortageValue + row.shortageValue, shortageLines: total.shortageLines + row.shortageLines,
  }), { category: 'TOTAL', dmsValue: 0, dmsLines: 0, dmsQuantity: 0, physicalValue: 0, physicalLines: 0, physicalQuantity: 0, excessValue: 0, excessLines: 0, shortageValue: 0, shortageLines: 0 });
  const plusRows = rows.filter((row) => row.difference > 0);
  const minusRows = rows.filter((row) => row.difference < 0);
  const zeroRows = rows.filter((row) => row.difference === 0);
  summary.getCell('B3').value = '(+/-)'; summary.getCell('C3').value = 'PARTS\nVALUE'; summary.getCell('D3').value = 'PARTS\nQUANTITY'; summary.getCell('E3').value = 'PARTS\nLINE ITEMS';
  [[ '(+)', plusRows ], [ '(-)', minusRows ], [ '(0)', zeroRows ]].forEach(([label, group], offset) => {
    const groupRows = group as ComparisonRow[];
    const rowNumber = offset + 4;
    summary.getCell(rowNumber, 2).value = label as string;
    summary.getCell(rowNumber, 3).value = groupRows.reduce((sum, row) => sum + row.varianceValue, 0);
    summary.getCell(rowNumber, 4).value = groupRows.reduce((sum, row) => sum + row.difference, 0);
    summary.getCell(rowNumber, 5).value = groupRows.length;
  });
  summary.mergeCells('B10:L10'); summary.getCell('B10').value = 'STOCK AUDIT FINAL REPORT';
  [['Dealership Name', dealershipName || name || 'Not specified'], ['Location', locationName || 'Not specified'], ['Audit Start Date', formatAuditDate(auditStartDate)], ['Audit Closed Date', formatAuditDate(auditCloseDate)]].forEach(([label, value], index) => {
    const rowNumber = index + 11;
    summary.mergeCells(`B${rowNumber}:D${rowNumber}`); summary.mergeCells(`E${rowNumber}:L${rowNumber}`);
    summary.getCell(rowNumber, 2).value = `${label} :`; summary.getCell(rowNumber, 5).value = value as string;
  });
  summary.mergeCells('B15:B16'); summary.getCell('B15').value = 'Category';
  [['C15:E15', 'DMS Stock'], ['F15:H15', 'Physical Stock as Counted'], ['I15:J15', 'Excess Found'], ['K15:L15', 'Short Found']].forEach(([range, label]) => { summary.mergeCells(range as string); summary.getCell((range as string).slice(0, 1) + '15').value = label as string; });
  ['Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Value', 'Part Lines'].forEach((label, index) => { summary.getCell(16, index + 3).value = label; });
  [...categorySummary, totalSummary].forEach((row, index) => {
    const rowNumber = index + 17;
    summary.addRow([]);
    [row.category, row.dmsValue, row.dmsLines, row.dmsQuantity, row.physicalValue, row.physicalLines, row.physicalQuantity, row.excessValue, row.excessLines, row.shortageValue, row.shortageLines].forEach((value, column) => { summary.getCell(rowNumber, column + 2).value = value; });
  });
  const summaryLastRow = 16 + categorySummary.length + 1;
  summary.mergeCells(`I${summaryLastRow + 1}:L${summaryLastRow + 1}`); summary.getCell(summaryLastRow + 1, 9).value = '(Value @ MRP in Rs; Part Lines & Quantity in Nos.)';
  for (let rowNumber = 3; rowNumber <= 6; rowNumber += 1) {
    for (let column = 2; column <= 5; column += 1) setBorder(summary.getCell(rowNumber, column));
  }
  for (let rowNumber = 10; rowNumber <= summaryLastRow; rowNumber += 1) {
    for (let column = 2; column <= 12; column += 1) setBorder(summary.getCell(rowNumber, column));
  }
  summary.getRow(3).eachCell({ includeEmpty: true }, (cell) => { cell.font = { bold: true }; cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  summary.getCell('B10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; summary.getCell('B10').font = { bold: true }; summary.getCell('B10').alignment = { horizontal: 'center' };
  for (let rowNumber = 11; rowNumber <= 14; rowNumber += 1) { summary.getCell(rowNumber, 2).font = { bold: true }; summary.getCell(rowNumber, 5).font = { bold: true }; }
  ['B15', 'C15', 'F15', 'I15', 'K15'].forEach((address, index) => { const colors = ['FFFFFF00', 'FFFCE4D6', 'FF9DC3E6', 'FFFFE699', 'FFA9D18E']; summary.getCell(address).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[index] } }; summary.getCell(address).font = { bold: true }; summary.getCell(address).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });
  for (let column = 3; column <= 12; column += 1) { summary.getCell(16, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: column <= 5 ? 'FFFCE4D6' : column <= 8 ? 'FF9DC3E6' : column <= 10 ? 'FFFFE699' : 'FFA9D18E' } }; summary.getCell(16, column).font = { bold: true }; summary.getCell(16, column).alignment = { horizontal: 'center', wrapText: true }; }
  for (let rowNumber = 17; rowNumber <= summaryLastRow; rowNumber += 1) { summary.getCell(rowNumber, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; if (rowNumber === summaryLastRow) { for (let column = 2; column <= 12; column += 1) summary.getCell(rowNumber, column).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; } for (let column = 3; column <= 12; column += 1) summary.getCell(rowNumber, column).numFmt = '#,##0.00'; }
  // Use explicit ExcelJS column definitions so large monetary values do not display as #######.
  summary.columns = [4, 23, 24, 14, 14, 24, 14, 14, 24, 14, 24, 14].map((width) => ({ width }));

  const template = workbook.addWorksheet('TEMPLATE');
  template.addRow(['DEALER_ID', 'BRANCH_ID', 'SPARE_PART_NO', 'MRP', 'SYSTEM QTY', 'PHYSICAL QTY', 'LOCATION_ID', 'RACK', 'DIFFERENCE QTY LINE', 'DIFFERENCE VALUE']);
  templateRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const difference = row.quantity - row.systemQty;
    template.addRow([
      dealerId || row.dealerId, branchId || row.branchId, row.partNo, row.mrp, row.systemQty,
      row.quantity, row.category, row.rack, null, null,
    ]);
    template.getCell(`I${rowNumber}`).value = { formula: `F${rowNumber}-E${rowNumber}`, result: difference };
    template.getCell(`J${rowNumber}`).value = { formula: `I${rowNumber}*D${rowNumber}`, result: difference * row.mrp };
  });
  template.getRow(1).height = 34;
  template.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    cell.font = { bold: true, color: { argb: 'FFFF0000' }, size: 10, name: 'Arial' };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    setBorder(cell);
  });
  for (let rowNumber = 2; rowNumber <= template.rowCount; rowNumber += 1) {
    const row = template.getRow(rowNumber);
    row.eachCell((cell) => { setBorder(cell); cell.alignment = { horizontal: 'center', vertical: 'middle' }; });
    row.getCell(3).numFmt = '@';
    row.getCell(10).numFmt = '#,##0.00';
  }
  template.columns = [11, 15, 17, 10, 13, 15, 16, 12, 18, 16].map((width) => ({ width }));
  template.views = [{ state: 'frozen', ySplit: 1 }];
  template.autoFilter = { from: 'A1', to: 'J1' };

  const countSheet = workbook.addWorksheet('COUNT SHEET');
  physical.rawRows.forEach((rawRow) => countSheet.addRow(rawRow));
  styleRawSheet(countSheet, [13, 19, 18, 14, 18, 12, 14, 45, 18, 24], physical.headerRow + 1);

  const p201 = workbook.addWorksheet('P201');
  dms.rawRows.forEach((rawRow) => p201.addRow(rawRow));
  styleRawSheet(p201, [10, 18, 16, 18, 16, 28, 14, 13, 13, 14, 13, 16, 12, 10, 10], dms.headerRow + 1);

  const output = await workbook.xlsx.writeBuffer();
  const safeName = (name || dealershipName || '3W_TVS_Reconciliation').replace(/[^a-z0-9]+/gi, '_');
  saveAs(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const UploadPanel = ({ kind, data, onFileChange, disabled }: UploadPanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDms = kind === 'dms';
  const color = isDms ? '#004F98' : teal;
  const title = isDms ? 'DMS data (P201)' : 'Physical audit export (Count Sheet)';
  const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await onFileChange(event.target.files?.[0] || null);
    event.target.value = '';
  };
  return <Card sx={{ height: '100%', border: `1px solid ${alpha(color, 0.22)}`, boxShadow: 'none' }}><CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}><Avatar sx={{ bgcolor: alpha(color, 0.12), color }}>{isDms ? <Description /> : <Inventory2 />}</Avatar><Box><Typography variant="h6" fontWeight={800}>{title}</Typography><Typography variant="body2" color="text.secondary">{isDms ? 'Reads PartNo, Unit Price and Total Stock.' : 'Reads PartNo., MRP (₹) and Quantity.'}</Typography></Box></Stack>
    {!data ? <Box onClick={() => !disabled && inputRef.current?.click()} onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) inputRef.current?.click(); }} role="button" tabIndex={0} sx={{ minHeight: 170, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', p: 2, border: `1.5px dashed ${alpha(color, 0.55)}`, borderRadius: 3, cursor: disabled ? 'wait' : 'pointer', bgcolor: alpha(color, 0.025), '&:hover, &:focus-visible': { bgcolor: alpha(color, 0.08), borderColor: color, outline: 'none' } }}><CloudUpload sx={{ fontSize: 36, color, mb: 1 }} /><Typography fontWeight={700}>Choose Excel file</Typography><Typography variant="caption" color="text.secondary">.xlsx or .xls · first worksheet is used</Typography></Box>
      : <Box sx={{ minHeight: 170, border: `1px solid ${alpha(color, 0.28)}`, borderRadius: 3, p: 2.25, bgcolor: alpha(color, 0.035) }}><Stack direction="row" spacing={1.25} alignItems="flex-start"><InsertDriveFile sx={{ color, mt: 0.25 }} /><Box sx={{ minWidth: 0, flex: 1 }}><Typography fontWeight={700} noWrap title={data.file.name}>{data.file.name}</Typography><Typography variant="body2" color="text.secondary">{formatFileSize(data.file.size)} · {data.rows.length} input rows · {data.groupedRows} grouped rows</Typography><Typography variant="caption" color="text.secondary">Worksheet: {data.sheetName}</Typography></Box><CheckCircle sx={{ color: '#16A34A' }} /></Stack><LinearProgress variant="determinate" value={100} sx={{ mt: 2.5, height: 6, borderRadius: 5, bgcolor: alpha(color, 0.12), '& .MuiLinearProgress-bar': { bgcolor: color } }} /><Button size="small" onClick={() => inputRef.current?.click()} sx={{ mt: 1.5, color }}>Replace file</Button></Box>}
    <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={selectFile} />
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}><Chip label="Part No." size="small" variant="outlined" /><Chip label="MRP" size="small" variant="outlined" /><Chip label="Quantity" size="small" variant="outlined" /></Stack>
  </CardContent></Card>;
};

const ThreeWReconciliation = () => {
  const navigate = useNavigate();
  const [reconciliationName, setReconciliationName] = useState('');
  const [dealershipName, setDealershipName] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [auditStartDate, setAuditStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [auditCloseDate, setAuditCloseDate] = useState(new Date().toISOString().slice(0, 10));
  const [dmsData, setDmsData] = useState<ParsedWorkbook | null>(null);
  const [physicalData, setPhysicalData] = useState<ParsedWorkbook | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const comparison = useMemo(() => dmsData && physicalData ? compareSources(dmsData, physicalData) : [], [dmsData, physicalData]);

  const handleFile = async (kind: UploadKind, file: File | null) => {
    setError('');
    if (!file) { kind === 'dms' ? setDmsData(null) : setPhysicalData(null); return; }
    setProcessing(true);
    try {
      const parsed = await parseWorkbook(file, kind);
      kind === 'dms' ? setDmsData(parsed) : setPhysicalData(parsed);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Unable to read the selected workbook.');
    } finally { setProcessing(false); }
  };

  const handleExport = async () => {
    if (!dmsData || !physicalData) return;
    setProcessing(true); setError('');
    try { await createWorkbook(comparison, buildTemplateRows(dmsData, physicalData), dmsData, physicalData, reconciliationName, dealershipName, dealerId, branchId, locationName, auditStartDate, auditCloseDate); }
    catch (exportError) { setError(exportError instanceof Error ? exportError.message : 'Unable to create the Excel report.'); }
    finally { setProcessing(false); }
  };

  const matched = comparison.filter((row) => row.remark === 'MATCHED').length;
  const shortages = comparison.filter((row) => row.remark === 'SHORTAGE').length;
  const excesses = comparison.filter((row) => row.remark === 'EXCESS').length;

  return <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 }, pb: 8 }}>
    <Button startIcon={<ArrowBack />} onClick={() => navigate('/admin/reports')} sx={{ mb: 2, color: '#475569' }}>Back to reports</Button>
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', mb: 4 }}><Avatar sx={{ width: 56, height: 56, bgcolor: '#E6F7F3', color: teal }}><DirectionsBus fontSize="large" /></Avatar><Box><Typography variant="h4" fontWeight={850} color="#123B45">3W TVS Reconciliation</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>Compare grouped DMS and physical count-sheet data, then download the five-sheet Excel workbook.</Typography></Box></Box>
    <Stepper activeStep={comparison.length ? 3 : dmsData || physicalData ? 2 : 1} alternativeLabel sx={{ mb: 4, '& .MuiStepLabel-label': { fontWeight: 600 } }}>{steps.map((step) => <Step key={step}><StepLabel>{step}</StepLabel></Step>)}</Stepper>
    <Alert icon={<InfoOutlined />} severity="info" sx={{ mb: 3, borderRadius: 2 }}>Physical file rows with the same <strong>Rack No. + Part No. + MRP</strong> are consolidated (quantities summed) before comparison. DMS rows are grouped by <strong>Part No. + MRP</strong>. Missing items are assigned quantity 0.</Alert>
    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
    <Card sx={{ mb: 3, boxShadow: '0 8px 24px rgba(15, 118, 110, 0.08)', border: '1px solid #E2E8F0' }}><CardContent sx={{ p: { xs: 2.5, md: 3 } }}><Typography variant="h6" fontWeight={800}>Reconciliation details</Typography><Grid container spacing={2} sx={{ mt: 0.5 }}><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Reconciliation name" placeholder="e.g. Teppets 3W — August 2026" value={reconciliationName} onChange={(event) => setReconciliationName(event.target.value)} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Dealership name" placeholder="e.g. Teepees Future Mobility LLP" value={dealershipName} onChange={(event) => setDealershipName(event.target.value)} /></Grid><Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Location" placeholder="e.g. Kasaragod, Kerala" value={locationName} onChange={(event) => setLocationName(event.target.value)} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Dealer ID" placeholder="e.g. 14854" value={dealerId} onChange={(event) => setDealerId(event.target.value)} helperText="Displayed in TEMPLATE" /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Branch ID" placeholder="Enter branch ID" value={branchId} onChange={(event) => setBranchId(event.target.value)} helperText="Displayed in TEMPLATE" /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Audit start date" type="date" value={auditStartDate} onChange={(event) => setAuditStartDate(event.target.value)} InputLabelProps={{ shrink: true }} /></Grid><Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Audit close date" type="date" value={auditCloseDate} onChange={(event) => setAuditCloseDate(event.target.value)} InputLabelProps={{ shrink: true }} /></Grid></Grid></CardContent></Card>
    <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>Upload source files</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>The raw uploads are retained in the exported workbook as COUNT SHEET and P201.</Typography>
    <Grid container spacing={3}><Grid size={{ xs: 12, md: 6 }}><UploadPanel kind="dms" data={dmsData} onFileChange={(file) => handleFile('dms', file)} disabled={processing} /></Grid><Grid size={{ xs: 12, md: 6 }}><UploadPanel kind="physical" data={physicalData} onFileChange={(file) => handleFile('physical', file)} disabled={processing} /></Grid></Grid>
    {comparison.length > 0 && <><Grid container spacing={2} sx={{ mt: 3 }}>
      {[['Compared rows', comparison.length, '#004F98'], ['Matched', matched, '#15803D'], ['Shortage', shortages, '#B91C1C'], ['Excess', excesses, '#B45309']].map(([label, value, color]) => <Grid size={{ xs: 6, md: 3 }} key={String(label)}><Card variant="outlined"><CardContent sx={{ py: 2, textAlign: 'center' }}><Typography variant="h5" fontWeight={850} color={String(color)}>{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography></CardContent></Card></Grid>)}
    </Grid><Card sx={{ mt: 3, border: '1px solid #E2E8F0', boxShadow: 'none' }}><CardContent><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2 }}><Box><Typography variant="h6" fontWeight={800}>Comparison preview</Typography><Typography variant="body2" color="text.secondary">First 12 grouped rows. The download contains the complete report.</Typography></Box><Button variant="contained" size="large" onClick={handleExport} disabled={processing} startIcon={processing ? <CircularProgress size={18} color="inherit" /> : <Download />} sx={{ bgcolor: teal, '&:hover': { bgcolor: '#115E59' } }}>Download Excel report</Button></Stack><TableContainer sx={{ maxHeight: 480 }}><Table stickyHeader size="small"><TableHead><TableRow>{['Part No.', 'DMS Qty', 'Phy Qty', 'Diff.', 'DMS MRP', 'PHY MRP', 'Short / Excess', 'Remarks'].map((header) => <TableCell key={header} sx={{ bgcolor: '#EAF4F7', fontWeight: 800, whiteSpace: 'nowrap' }}>{header}</TableCell>)}</TableRow></TableHead><TableBody>{comparison.slice(0, 12).map((row) => <TableRow key={`${row.partNo}-${row.physicalMrp}`}><TableCell>{row.partNo}</TableCell><TableCell>{row.dmsQty}</TableCell><TableCell>{row.physicalQty}</TableCell><TableCell sx={{ color: varianceColor(row.difference), fontWeight: 700 }}>{row.difference}</TableCell><TableCell>{money(row.dmsMrp)}</TableCell><TableCell>{money(row.physicalMrp)}</TableCell><TableCell sx={{ color: varianceColor(row.varianceValue), fontWeight: 700 }}>{money(row.varianceValue)}</TableCell><TableCell><Chip label={row.remark} size="small" color={row.remark === 'MATCHED' ? 'success' : row.remark === 'SHORTAGE' ? 'error' : 'warning'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer></CardContent></Card></>}
  </Container>;
};

export default ThreeWReconciliation;
