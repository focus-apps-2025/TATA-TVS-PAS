// src/components/TataPDFReport.tsx
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid,
  Typography, Box, Paper, Alert, Stepper, Step, StepLabel, IconButton,
  Chip, List, ListItem, ListItemIcon, ListItemText, Divider, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import {
  Close, PictureAsPdf, Download, CheckCircle, CloudUpload,
  Delete, LocationOn
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Logo from '../assets/images/Focus_logo.png';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface LocationFile {
  file: File;
  locationName: string;
  data: any[];
  summaryData: SummaryRow[];
  fileName: string;
  rawData: any[][];
}

interface SummaryRow {
  category: string;
  dmsValue: number;
  dmsPartLines: number;
  dmsQuantity: number;
  physicalValue: number;
  physicalPartLines: number;
  physicalQuantity: number;
  excessValue: number;
  excessPartLines: number;
  shortValue: number;
  shortPartLines: number;
  netDifferenceValue: number;
  netDifferencePercent: number;
}

interface ConsolidatedSummary {
  location: string;
  category: string;
  dmsValue: number; dmsPartLines: number; dmsQuantity: number;
  physicalValue: number; physicalPartLines: number; physicalQuantity: number;
  excessValue: number; excessPartLines: number;
  shortValue: number; shortPartLines: number;
  netDifferenceValue: number; netDifferencePercent: number;
}

// ─── Additional Form Data Interfaces ─────────────────────────────────────────
interface AuditAccuracyData {
  partLinesChecked: string;
  partLinesOK: string;
  partLinesNotOK: string;
  accuracy: string;
}

interface P4IRow {
  category: string;
  noOfPartsLine: string;
  p4iValue: string;
}

interface DamageStockData {
  valueAddedInPhysical: string;
  valueNotAddedInPhysical: string;
  valueTotal: string;
  partLinesAddedInPhysical: string;
  partLinesNotAddedInPhysical: string;
  partLinesTotal: string;
  quantityAddedInPhysical: string;
  quantityNotAddedInPhysical: string;
  quantityTotal: string;
}

interface UnidentifiedPartsData {
  remarks: string;
  noOfPartLine: string;
  value: string;
}

interface PDFReportProps {
  open: boolean;
  onClose: () => void;
  dealerName: string;
  location: string;
  auditStartDate: string;
  auditEndDate: string;
}

// ─── Styled Components ────────────────────────────────────────────────────────
const StyledDialog = styled(Dialog)(() => ({
  '& .MuiDialog-paper': { borderRadius: '24px', maxWidth: '960px', width: '100%' }
}));

const UploadArea = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  border: '2px dashed #CBD5E1',
  borderRadius: '16px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': { borderColor: '#D35400', backgroundColor: alpha('#D35400', 0.02) }
}));

const SectionBox = styled(Box)(({ theme }) => ({
  border: '1px solid #E2E8F0',
  borderRadius: '12px',
  padding: theme.spacing(2.5),
  marginBottom: theme.spacing(3),
  backgroundColor: '#FAFBFF'
}));

const SectionTitle = styled(Typography)(() => ({
  fontWeight: 700,
  fontSize: '13px',
  color: '#1F4EA3',
  borderLeft: '4px solid #00A3D6',
  paddingLeft: '10px',
  marginBottom: '12px'
}));

const StyledTh = styled(TableCell)(() => ({
  backgroundColor: '#00A3D6',
  color: '#fff',
  fontWeight: 700,
  fontSize: '12px',
  padding: '6px 10px',
  border: '1px solid #0082AA'
}));

const StyledTd = styled(TableCell)(() => ({
  padding: '4px 8px',
  border: '1px solid #CBD5E1',
  fontSize: '12px'
}));

const StyledRowLabel = styled(TableCell)(() => ({
  backgroundColor: '#FFF9C4',
  fontWeight: 700,
  fontSize: '12px',
  padding: '4px 10px',
  border: '1px solid #CBD5E1',
  color: '#333'
}));

// ─── Main Component ───────────────────────────────────────────────────────────
const TataPDFReport: React.FC<PDFReportProps> = ({
  open, onClose,
  dealerName: propDealerName,
  location: propLocation,
  auditStartDate: propStartDate,
  auditEndDate: propEndDate
}) => {
  const [locationFiles, setLocationFiles] = useState<LocationFile[]>([]);
  const [generating, setGenerating] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Additional form states ──────────────────────────────────────
  const [auditAccuracy, setAuditAccuracy] = useState<AuditAccuracyData>({
    partLinesChecked: '', partLinesOK: '', partLinesNotOK: '', accuracy: ''
  });

  const [p4iRows, setP4iRows] = useState<P4IRow[]>([
    { category: 'Spare Part', noOfPartsLine: '', p4iValue: '' },
    { category: 'Lubricant', noOfPartsLine: '', p4iValue: '' },
    { category: 'Total', noOfPartsLine: '', p4iValue: '' },
  ]);

  const [damageStock, setDamageStock] = useState<DamageStockData>({
    valueAddedInPhysical: '', valueNotAddedInPhysical: '', valueTotal: '',
    partLinesAddedInPhysical: '', partLinesNotAddedInPhysical: '', partLinesTotal: '',
    quantityAddedInPhysical: '', quantityNotAddedInPhysical: '', quantityTotal: ''
  });

  const [unidentifiedParts, setUnidentifiedParts] = useState<UnidentifiedPartsData>({
    remarks: 'Without MRP Label - Identified by Dealer', noOfPartLine: '', value: ''
  });

  const steps = ['Upload & Fill Data', 'Review Data', 'Generate PDF'];

  // ─── Helpers ────────────────────────────────────────────────────
  const parseNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[₹,$%\s]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const extractLocationName = (data: any[][]): string => {
    try {
      for (let i = 0; i < Math.min(10, data.length); i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        const locationKeywords = ['thanjavur', 'pudukottai', 'kumbakonam', 'thiruvarur', 'trichy', 'madurai', 'coimbatore', 'chennai', 'salem'];
        for (let j = 0; j < row.length; j++) {
          const cell = String(row[j] || '').toLowerCase().trim();
          if (locationKeywords.some(k => cell.includes(k))) return String(row[j]).trim();
        }
      }
      return 'Unknown Location';
    } catch { return 'Unknown Location'; }
  };

  const extractSummaryFromExcel = (data: any[][]): SummaryRow[] => {
    const summaryRows: SummaryRow[] = [];
    const possibleCategories = ['Spare Part', 'Battery', 'Oil', 'Lubricant', 'Nano Spares', 'Tyres', 'Accessories'];
    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        const firstCell = String(row[0] || '').trim();
        if (possibleCategories.includes(firstCell) || firstCell.toLowerCase().includes('total')) {
          const numbers: number[] = [];
          for (let j = 1; j < row.length; j++) {
            const val = row[j];
            if (val !== undefined && val !== null && val !== '') {
              numbers.push(parseNumber(val));
            }
          }
          if (numbers.length > 0) {
            summaryRows.push({
              category: firstCell,
              dmsValue: numbers[0] || 0, dmsPartLines: numbers[1] || 0, dmsQuantity: numbers[2] || 0,
              physicalValue: numbers[3] || 0, physicalPartLines: numbers[4] || 0, physicalQuantity: numbers[5] || 0,
              excessValue: numbers[6] || 0, excessPartLines: numbers[7] || 0,
              shortValue: Math.abs(numbers[8] || 0), shortPartLines: numbers[9] || 0,
              netDifferenceValue: numbers[10] || 0, netDifferencePercent: numbers[11] || 0
            });
          }
        }
      }
    } catch (err) { console.error('Error extracting summary:', err); }
    return summaryRows;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setError('');
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
        const locationName = extractLocationName(jsonData);
        const summaryData = extractSummaryFromExcel(jsonData);
        setLocationFiles(prev => [...prev, { file, locationName, data: [], summaryData, fileName: file.name, rawData: jsonData }]);
      }
    } catch (err: any) { setError(`Error reading files: ${err.message}`); }
  };

  const handleRemoveLocation = (index: number) => setLocationFiles(prev => prev.filter((_, i) => i !== index));

  const getAllCategories = (): string[] => {
    const s = new Set<string>();
    locationFiles.forEach(loc => loc.summaryData.forEach(item => {
      if (item.category?.trim() && item.category.toLowerCase() !== 'total') s.add(item.category.trim());
    }));
    return Array.from(s);
  };

  const generateConsolidatedData = () => {
    const categories = getAllCategories();
    const consolidated: { [key: string]: ConsolidatedSummary[] } = {};
    locationFiles.forEach(loc => {
      consolidated[loc.locationName] = [];
      categories.forEach(category => {
        const d = loc.summaryData.find(x => x.category?.trim() === category);
        consolidated[loc.locationName].push(d ? { location: loc.locationName, ...d } : {
          location: loc.locationName, category,
          dmsValue: 0, dmsPartLines: 0, dmsQuantity: 0,
          physicalValue: 0, physicalPartLines: 0, physicalQuantity: 0,
          excessValue: 0, excessPartLines: 0, shortValue: 0, shortPartLines: 0,
          netDifferenceValue: 0, netDifferencePercent: 0
        });
      });
    });
    return { consolidated, categories };
  };

  const calculateCategoryTotals = (consolidated: { [key: string]: ConsolidatedSummary[] }, categories: string[]) => {
    const totals: { [key: string]: ConsolidatedSummary } = {};
    categories.forEach(category => {
      const t: ConsolidatedSummary = {
        location: 'Total', category,
        dmsValue: 0, dmsPartLines: 0, dmsQuantity: 0,
        physicalValue: 0, physicalPartLines: 0, physicalQuantity: 0,
        excessValue: 0, excessPartLines: 0, shortValue: 0, shortPartLines: 0,
        netDifferenceValue: 0, netDifferencePercent: 0
      };
      Object.values(consolidated).forEach(ls => {
        const c = ls.find(x => x.category === category);
        if (c) {
          t.dmsValue += c.dmsValue; t.dmsPartLines += c.dmsPartLines; t.dmsQuantity += c.dmsQuantity;
          t.physicalValue += c.physicalValue; t.physicalPartLines += c.physicalPartLines; t.physicalQuantity += c.physicalQuantity;
          t.excessValue += c.excessValue; t.excessPartLines += c.excessPartLines;
          t.shortValue += c.shortValue; t.shortPartLines += c.shortPartLines;
          t.netDifferenceValue += c.netDifferenceValue;
        }
      });
      if (t.dmsValue > 0) t.netDifferencePercent = (t.netDifferenceValue / t.dmsValue) * 100;
      totals[category] = t;
    });
    return totals;
  };

  const calculateLocationTotals = (consolidated: { [key: string]: ConsolidatedSummary[] }) => {
    const locationTotals: { [key: string]: ConsolidatedSummary } = {};
    Object.entries(consolidated).forEach(([location, summaries]) => {
      const t: ConsolidatedSummary = {
        location, category: 'Total',
        dmsValue: 0, dmsPartLines: 0, dmsQuantity: 0,
        physicalValue: 0, physicalPartLines: 0, physicalQuantity: 0,
        excessValue: 0, excessPartLines: 0, shortValue: 0, shortPartLines: 0,
        netDifferenceValue: 0, netDifferencePercent: 0
      };
      summaries.forEach(item => {
        if (!item.category.toLowerCase().includes('total')) {
          t.dmsValue += item.dmsValue; t.dmsPartLines += item.dmsPartLines; t.dmsQuantity += item.dmsQuantity;
          t.physicalValue += item.physicalValue; t.physicalPartLines += item.physicalPartLines; t.physicalQuantity += item.physicalQuantity;
          t.excessValue += item.excessValue; t.excessPartLines += item.excessPartLines;
          t.shortValue += item.shortValue; t.shortPartLines += item.shortPartLines;
          t.netDifferenceValue += item.netDifferenceValue;
        }
      });
      if (t.dmsValue > 0) t.netDifferencePercent = (t.netDifferenceValue / t.dmsValue) * 100;
      locationTotals[location] = t;
    });
    return locationTotals;
  };

  const getBase64Logo = (): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = Logo;
  });

  // ─── PDF Helpers ─────────────────────────────────────────────────
  const addPageDecorations = (
    doc: jsPDF, pageCount: number, logoBase64: string,
    pageWidth: number, pageHeight: number, margin: number,
    tataColor: [number, number, number]
  ) => {
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Page border
      doc.setDrawColor(tataColor[0], tataColor[1], tataColor[2]);
      doc.setLineWidth(0.8);
      doc.rect(4, 4, pageWidth - 8, pageHeight - 8);
      doc.setLineWidth(0.2);
      doc.setDrawColor(180, 200, 230);
      doc.rect(5.5, 5.5, pageWidth - 11, pageHeight - 11);

      // Header white bg
      doc.setFillColor(255, 255, 255);
      doc.rect(4, 4, pageWidth - 8, 28, 'F');
      doc.setFillColor(tataColor[0], tataColor[1], tataColor[2]);
      doc.rect(4, 31, pageWidth - 8, 0.8, 'F');
      doc.setFillColor(0, 163, 214);
      doc.rect(4, 32.2, pageWidth - 8, 0.4, 'F');

      // Title
      doc.setFontSize(18);
      doc.setTextColor(tataColor[0], tataColor[1], tataColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('TATA MOTORS', pageWidth / 2, 16, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text('WALL-TO-WALL SMART INVENTORY AUDIT SUMMARY', pageWidth / 2, 24, { align: 'center' });

      // Logo
      try { doc.addImage(logoBase64, 'PNG', pageWidth - 38, 5, 30, 16); } catch { }

      // Footer banner
      const footerH = 10;
      const footerY = pageHeight - 4 - footerH;
      doc.setFillColor(0, 128, 128);
      doc.rect(4, footerY, pageWidth - 8, footerH, 'F');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('FOCUS ENGINEERING', margin + 2, footerY + 6.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.text('149, Thangam Nagar, Gudiyattam, Tamil Nadu, India', pageWidth - margin - 2, footerY + 6.5, { align: 'right' });

      // Page number
      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
    }
  };

  const drawSectionTitle = (
    doc: jsPDF, title: string, yPos: number,
    pageWidth: number, margin: number, tataColor: [number, number, number]
  ): number => {
    doc.setFillColor(tataColor[0], tataColor[1], tataColor[2]);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 9, 'F');
    doc.setFillColor(0, 163, 214);
    doc.rect(margin, yPos - 5, 3, 9, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 6, yPos + 1);
    return yPos + 8;
  };

  // ─── Generate PDF ────────────────────────────────────────────────
  const generatePDF = async () => {
    setGenerating(true);
    setError('');
    try {
      if (locationFiles.length === 0) throw new Error('Please upload at least one location file');

      const { consolidated, categories } = generateConsolidatedData();
      const categoryTotals = calculateCategoryTotals(consolidated, categories);
      const locationTotals = calculateLocationTotals(consolidated);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'A4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const tataColor: [number, number, number] = [31, 78, 163];
      const contentTop = 36;
      const footerSafeY = pageHeight - 20; // safe area above footer

      const fmt = (n: number) => n === 0 ? '0' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n).replace(/[^\d,.-]/g, '');
      const fmtC = (n: number) => n === 0 ? '0' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n).replace(/[^\d,.-]/g, '');

      const locationsList = locationFiles.map(l => l.locationName).join(', ');
      const locationsDisplay = locationsList.length > 80 ? locationsList.substring(0, 80) + '...' : locationsList;

      // ── PAGE 1 ────────────────────────────────────────────────────
      let yPos = contentTop + 4;

      // Dealership Info
      yPos = drawSectionTitle(doc, 'DEALERSHIP INFORMATION', yPos, pageWidth, margin, tataColor);
      yPos += 3;
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPos - 1, pageWidth - margin * 2, 22, 'F');
      doc.setDrawColor(220, 230, 240); doc.setLineWidth(0.2);
      doc.rect(margin, yPos - 1, pageWidth - margin * 2, 22);
      doc.setFontSize(8.5); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
      doc.text(`Dealer Name:   ${propDealerName || '_________________'}`, margin + 5, yPos + 5);
      doc.text(`Locations:        ${locationsDisplay}`, margin + 5, yPos + 11);
      doc.text(`Audit Period:    ${propStartDate || '__________'}  to  ${propEndDate || '__________'}`, margin + 5, yPos + 17);
      yPos += 28;

      // Location-Wise Summary
      yPos = drawSectionTitle(doc, 'LOCATION-WISE SUMMARY', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      const locHeaders = [
        ['Location', 'DMS Stock', '', '', 'Physical Stock as Counted', '', '', 'Excess Found', '', 'Short Found', '', 'Net Difference', 'Diff %'],
        ['', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Value', 'Part Lines', 'Value', '']
      ];
      const locRows: any[][] = [];
      let tDMS = 0, tDMSPL = 0, tDMSQty = 0, tPhy = 0, tPhyPL = 0, tPhyQty = 0, tExc = 0, tExcPL = 0, tSho = 0, tShoPL = 0, tNet = 0;

      Object.entries(locationTotals).forEach(([location, total]) => {
        tDMS += total.dmsValue; tDMSPL += total.dmsPartLines; tDMSQty += total.dmsQuantity;
        tPhy += total.physicalValue; tPhyPL += total.physicalPartLines; tPhyQty += total.physicalQuantity;
        tExc += total.excessValue; tExcPL += total.excessPartLines;
        tSho += total.shortValue; tShoPL += total.shortPartLines; tNet += total.netDifferenceValue;
        locRows.push([location, fmtC(total.dmsValue), fmt(total.dmsPartLines), fmt(total.dmsQuantity),
          fmtC(total.physicalValue), fmt(total.physicalPartLines), fmt(total.physicalQuantity),
          fmtC(total.excessValue), fmt(total.excessPartLines),
          fmtC(total.shortValue), fmt(total.shortPartLines),
          fmtC(total.netDifferenceValue), `${total.netDifferencePercent.toFixed(1)}%`]);
      });
      const tPct = tDMS > 0 ? (tNet / tDMS) * 100 : 0;
      locRows.push(['TOTAL', fmtC(tDMS), fmt(tDMSPL), fmt(tDMSQty), fmtC(tPhy), fmt(tPhyPL), fmt(tPhyQty), fmtC(tExc), fmt(tExcPL), fmtC(tSho), fmt(tShoPL), fmtC(tNet), `${tPct.toFixed(1)}%`]);

      autoTable(doc, {
        head: locHeaders, body: locRows, startY: yPos,
        margin: { left: margin, right: margin }, tableWidth: 'wrap',
        styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [180, 200, 230] as any, lineWidth: 0.15 },
        headStyles: { fillColor: [0, 163, 214] as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center', lineColor: [0, 120, 170] as any, lineWidth: 0.2 },
        bodyStyles: { lineColor: [200, 215, 230] as any, lineWidth: 0.12 },
        alternateRowStyles: { fillColor: [245, 249, 255] as any },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 22, halign: 'right' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 16, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 16, halign: 'right' }, 6: { cellWidth: 16, halign: 'right' }, 7: { cellWidth: 18, halign: 'right' }, 8: { cellWidth: 14, halign: 'right' }, 9: { cellWidth: 18, halign: 'right' }, 10: { cellWidth: 14, halign: 'right' }, 11: { cellWidth: 22, halign: 'right' }, 12: { cellWidth: 13, halign: 'right' } },
        didParseCell: (data) => {
          if (data.row.index === locRows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [31, 78, 163]; data.cell.styles.textColor = [255, 255, 255]; }
        },
        theme: 'grid'
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Detailed Category Summary
      if (yPos > footerSafeY - 50) { doc.addPage(); yPos = contentTop + 4; }
      yPos = drawSectionTitle(doc, 'DETAILED CATEGORY SUMMARY BY LOCATION', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      const detHeaders = [
        ['Location', 'Category', 'DMS Stock', '', '', 'Physical Stock as Counted', '', '', 'Excess Found', '', 'Short Found', '', 'Net Difference', 'Diff %'],
        ['', '', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Value', 'Part Lines', 'Value', '']
      ];
      const detRows: any[][] = [];
      Object.entries(consolidated).forEach(([location, summaries]) => {
        summaries.forEach(item => {
          if (item.category !== 'Total' && (item.dmsValue > 0 || item.physicalValue > 0)) {
            detRows.push([location, item.category, fmtC(item.dmsValue), fmt(item.dmsPartLines), fmt(item.dmsQuantity),
              fmtC(item.physicalValue), fmt(item.physicalPartLines), fmt(item.physicalQuantity),
              fmtC(item.excessValue), fmt(item.excessPartLines),
              fmtC(item.shortValue), fmt(item.shortPartLines),
              fmtC(item.netDifferenceValue), `${item.netDifferencePercent.toFixed(1)}%`]);
          }
        });
      });

      autoTable(doc, {
        head: detHeaders, body: detRows, startY: yPos,
        margin: { left: margin, right: margin }, tableWidth: 'wrap',
        styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [180, 200, 230] as any, lineWidth: 0.12 },
        headStyles: { fillColor: [0, 163, 214] as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', lineColor: [0, 120, 170] as any, lineWidth: 0.2 },
        bodyStyles: { lineColor: [200, 215, 230] as any, lineWidth: 0.1 },
        alternateRowStyles: { fillColor: [245, 249, 255] as any },
        columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 28 }, 2: { cellWidth: 18, halign: 'right' }, 3: { cellWidth: 13, halign: 'right' }, 4: { cellWidth: 13, halign: 'right' }, 5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 13, halign: 'right' }, 7: { cellWidth: 13, halign: 'right' }, 8: { cellWidth: 16, halign: 'right' }, 9: { cellWidth: 11, halign: 'right' }, 10: { cellWidth: 16, halign: 'right' }, 11: { cellWidth: 11, halign: 'right' }, 12: { cellWidth: 18, halign: 'right' }, 13: { cellWidth: 11, halign: 'right' } },
        theme: 'grid'
      });

      // ── PAGE 2: CONSOLIDATED CATEGORY SUMMARY ─────────────────────
      doc.addPage();
      yPos = contentTop + 4;
      yPos = drawSectionTitle(doc, 'CONSOLIDATED CATEGORY SUMMARY', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      const conHeaders = [
        ['Category', 'DMS Stock', '', '', 'Physical Stock as Counted', '', '', 'Excess Found', '', 'Short Found', '', 'Net Difference', 'Diff %'],
        ['', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Quantity', 'Value', 'Part Lines', 'Value', 'Part Lines', 'Value', '']
      ];
      const conRows: any[][] = [];
      categories.forEach(category => {
        const t = categoryTotals[category];
        if (t && (t.dmsValue > 0 || t.physicalValue > 0)) {
          conRows.push([category, fmtC(t.dmsValue), fmt(t.dmsPartLines), fmt(t.dmsQuantity),
            fmtC(t.physicalValue), fmt(t.physicalPartLines), fmt(t.physicalQuantity),
            fmtC(t.excessValue), fmt(t.excessPartLines),
            fmtC(t.shortValue), fmt(t.shortPartLines),
            fmtC(t.netDifferenceValue), `${t.netDifferencePercent.toFixed(1)}%`]);
        }
      });

      const tDMS2 = Object.values(categoryTotals).reduce((s, c) => s + c.dmsValue, 0);
      const tDMSPL2 = Object.values(categoryTotals).reduce((s, c) => s + c.dmsPartLines, 0);
      const tDMSQty2 = Object.values(categoryTotals).reduce((s, c) => s + c.dmsQuantity, 0);
      const tPhy2 = Object.values(categoryTotals).reduce((s, c) => s + c.physicalValue, 0);
      const tPhyPL2 = Object.values(categoryTotals).reduce((s, c) => s + c.physicalPartLines, 0);
      const tPhyQty2 = Object.values(categoryTotals).reduce((s, c) => s + c.physicalQuantity, 0);
      const tExc2 = Object.values(categoryTotals).reduce((s, c) => s + c.excessValue, 0);
      const tExcPL2 = Object.values(categoryTotals).reduce((s, c) => s + c.excessPartLines, 0);
      const tSho2 = Object.values(categoryTotals).reduce((s, c) => s + c.shortValue, 0);
      const tShoPL2 = Object.values(categoryTotals).reduce((s, c) => s + c.shortPartLines, 0);
      const tNet2 = Object.values(categoryTotals).reduce((s, c) => s + c.netDifferenceValue, 0);
      const tPct2 = tDMS2 > 0 ? (tNet2 / tDMS2) * 100 : 0;

      conRows.push(['TOTAL', fmtC(tDMS2), fmt(tDMSPL2), fmt(tDMSQty2), fmtC(tPhy2), fmt(tPhyPL2), fmt(tPhyQty2), fmtC(tExc2), fmt(tExcPL2), fmtC(tSho2), fmt(tShoPL2), fmtC(tNet2), `${tPct2.toFixed(1)}%`]);

      autoTable(doc, {
        head: conHeaders, body: conRows, startY: yPos,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 2, lineColor: [180, 200, 230] as any, lineWidth: 0.12 },
        headStyles: { fillColor: [0, 163, 214] as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center', lineColor: [0, 120, 170] as any, lineWidth: 0.2 },
        bodyStyles: { lineColor: [200, 215, 230] as any, lineWidth: 0.1 },
        alternateRowStyles: { fillColor: [245, 249, 255] as any },
        didParseCell: (data) => {
          if (data.row.index === conRows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [31, 78, 163]; data.cell.styles.textColor = [255, 255, 255]; }
        },
        columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 22, halign: 'right' }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 16, halign: 'right' }, 4: { cellWidth: 22, halign: 'right' }, 5: { cellWidth: 16, halign: 'right' }, 6: { cellWidth: 16, halign: 'right' }, 7: { cellWidth: 18, halign: 'right' }, 8: { cellWidth: 14, halign: 'right' }, 9: { cellWidth: 18, halign: 'right' }, 10: { cellWidth: 14, halign: 'right' }, 11: { cellWidth: 22, halign: 'right' }, 12: { cellWidth: 13, halign: 'right' } },
        theme: 'grid'
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;
      if (yPos > footerSafeY - 40) { doc.addPage(); yPos = contentTop + 4; }

      // Summary Statistics
      yPos = drawSectionTitle(doc, 'SUMMARY STATISTICS', yPos, pageWidth, margin, tataColor);
      yPos += 4;
      autoTable(doc, {
        body: [
          ['Total Locations:', locationFiles.length.toString()],
          ['Total Part Lines:', fmt(tDMSPL2)],
          ['Total Quantity:', fmt(tDMSQty2)],
          ['Overall Accuracy:', `${(100 - Math.abs(tPct2)).toFixed(1)}%`]
        ],
        startY: yPos,
        margin: { left: margin, right: pageWidth - 120 },
        styles: { fontSize: 8, cellPadding: 2.5, lineColor: [180, 200, 230] as any, lineWidth: 0.15 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45, fillColor: [240, 245, 255] as any }, 1: { cellWidth: 40 } },
        theme: 'grid'
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // ══════════════════════════════════════════════════════════════
      // 4 ADDITIONAL TABLES AFTER SUMMARY STATISTICS
      // ══════════════════════════════════════════════════════════════

      // ── 1. AUDIT ACCURACY CHECK ──────────────────────────────────
      if (yPos > footerSafeY - 40) { doc.addPage(); yPos = contentTop + 4; }
      yPos = drawSectionTitle(doc, 'AUDIT ACCURACY CHECK', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      // Sub-header row
      autoTable(doc, {
        head: [
          [{ content: 'Audit Accuracy Check by Dealer Team', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 220, 255] as any, textColor: [0, 0, 0], fontSize: 9 } }],
          ['Part Lines Checked', 'Part Lines found OK', 'Part Lines Found Not OK', '% Accuracy']
        ],
        body: [[
          auditAccuracy.partLinesChecked || '',
          auditAccuracy.partLinesOK || '',
          auditAccuracy.partLinesNotOK || '',
          auditAccuracy.accuracy || ''
        ]],
        startY: yPos,
        margin: { left: margin, right: margin + 160 },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        headStyles: { fillColor: [200, 220, 255] as any, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center', lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        bodyStyles: { fillColor: [240, 248, 220] as any, lineColor: [0, 0, 0] as any, lineWidth: 0.2, minCellHeight: 8 },
        columnStyles: { 0: { cellWidth: 33, halign: 'center' }, 1: { cellWidth: 33, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' }, 3: { cellWidth: 25, halign: 'center' } },
        theme: 'grid'
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // ── 2. PENDING FOR ISSUE (P4I) ───────────────────────────────
      if (yPos > footerSafeY - 50) { doc.addPage(); yPos = contentTop + 4; }
      yPos = drawSectionTitle(doc, 'PENDING FOR ISSUE (P4I)', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      const p4iTableRows = p4iRows.map(row => [row.category, row.noOfPartsLine || '', row.p4iValue || '']);
      autoTable(doc, {
        head: [
          [{ content: 'Pending for Issue (P4I) Parts', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 220, 255] as any, textColor: [0, 0, 0], fontSize: 9 } }],
          ['Part Category', 'No. Of Parts Line', 'P4I Value']
        ],
        body: p4iTableRows,
        startY: yPos,
        margin: { left: margin, right: margin + 160 },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        headStyles: { fillColor: [200, 220, 255] as any, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center', lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        bodyStyles: { lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const isTotal = p4iRows[data.row.index]?.category === 'Total';
            data.cell.styles.fillColor = isTotal ? [255, 220, 100] as any : [255, 210, 210] as any;
            data.cell.styles.fontStyle = isTotal ? 'bold' : 'bold';
          }
        },
        columnStyles: { 0: { cellWidth: 33, halign: 'center' }, 1: { cellWidth: 33, halign: 'center' }, 2: { cellWidth: 33, halign: 'center' } },
        theme: 'grid'
      });

      // P4I note
      yPos = (doc as any).lastAutoTable.finalY + 2;
      doc.setFontSize(6.5); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'italic');
      doc.text('P4I – Pending for Issue Parts as declared by Spare Parts Manager. These are the parts which were issued physically but not issued in system.', margin, yPos + 4);
      yPos += 12;

      // ── 3. DAMAGE STOCK SUMMARY ──────────────────────────────────
      if (yPos > footerSafeY - 50) { doc.addPage(); yPos = contentTop + 4; }
      yPos = drawSectionTitle(doc, 'DAMAGE STOCK SUMMARY', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      autoTable(doc, {
        head: [
          [{ content: 'Damages Stock Found', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', fillColor: [255, 200, 0] as any, textColor: [0, 0, 0], fontSize: 9 } }],
          ['', 'Added in Physical', 'Not added in Physical', 'Total']
        ],
        body: [
          ['Value', damageStock.valueAddedInPhysical || '', damageStock.valueNotAddedInPhysical || '', damageStock.valueTotal || ''],
          ['Part Lines', damageStock.partLinesAddedInPhysical || '', damageStock.partLinesNotAddedInPhysical || '', damageStock.partLinesTotal || ''],
          ['Quantity', damageStock.quantityAddedInPhysical || '', damageStock.quantityNotAddedInPhysical || '', damageStock.quantityTotal || ''],
        ],
        startY: yPos,
        margin: { left: margin, right: margin + 145 },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        headStyles: { fillColor: [255, 200, 0] as any, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center', lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        bodyStyles: { fillColor: [220, 235, 255] as any, lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            data.cell.styles.fillColor = [255, 220, 100] as any;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        columnStyles: { 0: { cellWidth: 25, halign: 'left' }, 1: { cellWidth: 35, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' }, 3: { cellWidth: 30, halign: 'center' } },
        theme: 'grid'
      });

      yPos = (doc as any).lastAutoTable.finalY + 2;
      doc.setFontSize(6.5); doc.setTextColor(60, 60, 60); doc.setFont('helvetica', 'italic');
      doc.text('*Quantities of Damaged Parts added in physical are the ones which are found short else are not added (If found excess)', margin, yPos + 4);
      yPos += 12;

      // ── 4. UNIDENTIFIED PARTS SUMMARY ───────────────────────────
      if (yPos > footerSafeY - 40) { doc.addPage(); yPos = contentTop + 4; }
      yPos = drawSectionTitle(doc, 'UNIDENTIFIED PARTS SUMMARY', yPos, pageWidth, margin, tataColor);
      yPos += 3;

      autoTable(doc, {
        head: [['Remarks', 'No. Of Part Line', 'Value']],
        body: [[unidentifiedParts.remarks, unidentifiedParts.noOfPartLine || '', unidentifiedParts.value || '']],
        startY: yPos,
        margin: { left: margin, right: margin + 130 },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        headStyles: { fillColor: [255, 200, 0] as any, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8, halign: 'center', lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        bodyStyles: { fillColor: [255, 210, 210] as any, fontStyle: 'bold', lineColor: [0, 0, 0] as any, lineWidth: 0.2 },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 30, halign: 'center' }, 2: { cellWidth: 30, halign: 'center' } },
        theme: 'grid'
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // ── PAGE 3: NOTES & SIGNATURES ───────────────────────────────
      doc.addPage();
      yPos = contentTop + 4;
      yPos = drawSectionTitle(doc, 'IMPORTANT NOTES', yPos, pageWidth, margin, tataColor);
      yPos += 5;

      const notes = [
        '1. Part prices are referred from Stock purchase price & price master shared with us by TMCVL/Dealer.',
        '2. Sign off of Report taken from all stakeholders.',
        '3. Parts found without Packing/Label have been counted based on dealership team identification.',
        '4. Please ensure new material is warded in base locations only.',
        '5. Multi-location parts need to be reviewed for location optimization.',
        '6. Value at NDP in Rs.; Parts Lines & Quantity in Nos.',
      ];
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
      notes.forEach(note => { doc.text(note, margin + 2, yPos); yPos += 6; });
      yPos += 6;

      yPos = drawSectionTitle(doc, 'LOCATIONS INCLUDED', yPos, pageWidth, margin, tataColor);
      yPos += 5;
      locationFiles.forEach((loc, index) => {
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
        doc.text(`${index + 1}.  ${loc.locationName}  —  ${loc.fileName}`, margin + 2, yPos);
        yPos += 5.5;
      });
      yPos += 8;

      yPos = drawSectionTitle(doc, 'SIGN-OFF', yPos, pageWidth, margin, tataColor);
      yPos += 8;
      const sigWidth = (pageWidth - margin * 2 - 40) / 2;
      doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40);
      doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.3);
      doc.text('Audit Team:', margin, yPos); doc.line(margin + 28, yPos - 1, margin + sigWidth, yPos - 1);
      doc.text('Dealer Team:', margin + sigWidth + 30, yPos); doc.line(margin + sigWidth + 58, yPos - 1, margin + sigWidth * 2 + 10, yPos - 1);
      doc.text('Verified By:', margin, yPos + 10); doc.line(margin + 28, yPos + 9, margin + sigWidth, yPos + 9);
      doc.text('Approved By:', margin + sigWidth + 30, yPos + 10); doc.line(margin + sigWidth + 58, yPos + 9, margin + sigWidth * 2 + 10, yPos + 9);

      // Apply decorations
      const logoBase64 = await getBase64Logo();
      const pageCount = doc.getNumberOfPages();
      addPageDecorations(doc, pageCount, logoBase64, pageWidth, pageHeight, margin, tataColor);

      doc.save(`TATA_Consolidated_Audit_Report_${new Date().getTime()}.pdf`);
      setSuccess('PDF generated successfully!');
      setActiveStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Step Navigation ─────────────────────────────────────────────
  const handleNext = () => {
    if (activeStep === 0 && locationFiles.length === 0) { setError('Please upload at least one location file'); return; }
    setActiveStep(activeStep + 1);
  };
  const handleBack = () => setActiveStep(activeStep - 1);
  const handleClose = () => { setLocationFiles([]); setActiveStep(0); setError(''); setSuccess(''); onClose(); };

  // ─── Input helpers ───────────────────────────────────────────────
  const inputSx = { '& .MuiInputBase-input': { padding: '6px 10px', fontSize: '12px' }, '& .MuiOutlinedInput-root': { borderRadius: '6px' } };

  // ─── RENDER ──────────────────────────────────────────────────────
  return (
    <StyledDialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #D35400 0%, #A04000 100%)',
        color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PictureAsPdf />
          <Typography variant="h6">Generate TATA Consolidated PDF Report</Typography>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: 'white' }}><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2, maxHeight: '75vh', overflowY: 'auto' }}>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

        {/* ── STEP 0: Upload + Fill Forms ── */}
        {activeStep === 0 && (
          <Box>
            {/* File Upload */}
            <SectionBox>
              <SectionTitle>📁 Upload Location Files</SectionTitle>
              <Typography variant="body2" sx={{ mb: 2, color: '#555' }}>
                Upload Excel summary files for each location. The system will auto-detect location names.
              </Typography>
              <input type="file" accept=".xlsx,.xls" id="location-files-upload" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
              <UploadArea onClick={() => document.getElementById('location-files-upload')?.click()}>
                <CloudUpload sx={{ fontSize: 40, color: '#64748B', mb: 1 }} />
                <Typography variant="body1" sx={{ mb: 0.5 }}>Click to upload location files</Typography>
                <Typography variant="body2" color="text.secondary">Multiple files supported (.xlsx, .xls)</Typography>
              </UploadArea>

              {locationFiles.length > 0 && (
                <List sx={{ mt: 2 }}>
                  {locationFiles.map((loc, index) => (
                    <React.Fragment key={index}>
                      <ListItem secondaryAction={
                        <IconButton edge="end" onClick={() => handleRemoveLocation(index)} sx={{ color: '#EF4444' }}><Delete /></IconButton>
                      }>
                        <ListItemIcon><LocationOn sx={{ color: '#D35400' }} /></ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>{loc.locationName}</Typography>
                              <Chip label={`${loc.summaryData.filter(d => d.category?.toLowerCase() !== 'total').length} categories`} size="small" sx={{ bgcolor: alpha('#D35400', 0.1), color: '#D35400' }} />
                            </Box>
                          }
                          secondary={<Typography variant="caption" color="text.secondary">File: {loc.fileName}</Typography>}
                        />
                      </ListItem>
                      {index < locationFiles.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </SectionBox>

            {/* ── 1. Audit Accuracy Check ── */}
            <SectionBox>
              <SectionTitle>✅ Audit Accuracy Check</SectionTitle>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <StyledTh colSpan={4} align="center">Audit Accuracy Check by Dealer Team</StyledTh>
                    </TableRow>
                    <TableRow>
                      {['Part Lines Checked', 'Part Lines found OK', 'Part Lines Found Not OK', '% Accuracy'].map(h => (
                        <TableCell key={h} align="center" sx={{ backgroundColor: '#D4ECD4', fontWeight: 700, fontSize: '11px', border: '1px solid #B0D0B0', padding: '5px 8px' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      {(['partLinesChecked', 'partLinesOK', 'partLinesNotOK', 'accuracy'] as (keyof AuditAccuracyData)[]).map(field => (
                        <StyledTd key={field} align="center" sx={{ backgroundColor: '#F0FAF0' }}>
                          <TextField variant="outlined" size="small" value={auditAccuracy[field]}
                            onChange={e => setAuditAccuracy(prev => ({ ...prev, [field]: e.target.value }))}
                            placeholder="0" sx={{ width: '90px', ...inputSx }} />
                        </StyledTd>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionBox>

            {/* ── 2. Pending for Issue (P4I) ── */}
            <SectionBox>
              <SectionTitle>📋 Pending for Issue (P4I)</SectionTitle>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', maxWidth: 440 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <StyledTh colSpan={3} align="center">Pending for Issue (P4I) Parts</StyledTh>
                    </TableRow>
                    <TableRow>
                      {['Part Category', 'No. Of Parts Line', 'P4I Value'].map(h => (
                        <TableCell key={h} align="center" sx={{ backgroundColor: '#FFF3CD', fontWeight: 700, fontSize: '11px', border: '1px solid #F0C040', padding: '5px 8px' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {p4iRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <StyledRowLabel>{row.category}</StyledRowLabel>
                        <StyledTd align="center" sx={{ backgroundColor: '#FFF0F0' }}>
                          <TextField variant="outlined" size="small" value={row.noOfPartsLine}
                            onChange={e => setP4iRows(prev => prev.map((r, i) => i === idx ? { ...r, noOfPartsLine: e.target.value } : r))}
                            placeholder="0" sx={{ width: '90px', ...inputSx }} />
                        </StyledTd>
                        <StyledTd align="center" sx={{ backgroundColor: '#FFF0F0' }}>
                          <TextField variant="outlined" size="small" value={row.p4iValue}
                            onChange={e => setP4iRows(prev => prev.map((r, i) => i === idx ? { ...r, p4iValue: e.target.value } : r))}
                            placeholder="0" sx={{ width: '90px', ...inputSx }} />
                        </StyledTd>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionBox>

            {/* ── 3. Damage Stock Summary ── */}
            <SectionBox>
              <SectionTitle>⚠️ Damage Stock Summary</SectionTitle>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', maxWidth: 520 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ backgroundColor: '#FFD700', fontWeight: 700, fontSize: '12px', border: '1px solid #C8A000', padding: '6px' }}>
                        Damages Stock Found
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ border: '1px solid #CBD5E1', backgroundColor: '#f9f9f9', fontWeight: 600, width: '80px', padding: '5px 8px', fontSize: '11px' }}></TableCell>
                      {['Added in Physical', 'Not added in Physical', 'Total'].map(h => (
                        <TableCell key={h} align="center" sx={{ backgroundColor: '#E0E8FF', fontWeight: 700, fontSize: '11px', border: '1px solid #B0C0E8', padding: '5px 8px' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      { label: 'Value', fields: ['valueAddedInPhysical', 'valueNotAddedInPhysical', 'valueTotal'] as (keyof DamageStockData)[] },
                      { label: 'Part Lines', fields: ['partLinesAddedInPhysical', 'partLinesNotAddedInPhysical', 'partLinesTotal'] as (keyof DamageStockData)[] },
                      { label: 'Quantity', fields: ['quantityAddedInPhysical', 'quantityNotAddedInPhysical', 'quantityTotal'] as (keyof DamageStockData)[] },
                    ].map(row => (
                      <TableRow key={row.label}>
                        <StyledRowLabel>{row.label}</StyledRowLabel>
                        {row.fields.map(field => (
                          <StyledTd key={field} align="center" sx={{ backgroundColor: '#EDF4FF' }}>
                            <TextField variant="outlined" size="small" value={damageStock[field]}
                              onChange={e => setDamageStock(prev => ({ ...prev, [field]: e.target.value }))}
                              placeholder="0" sx={{ width: '90px', ...inputSx }} />
                          </StyledTd>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionBox>

            {/* ── 4. Unidentified Parts Summary ── */}
            <SectionBox>
              <SectionTitle>🔍 Unidentified Parts Summary</SectionTitle>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', maxWidth: 520 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Remarks', 'No. Of Part Line', 'Value'].map(h => (
                        <TableCell key={h} align="center" sx={{ backgroundColor: '#FFD700', fontWeight: 700, fontSize: '11px', border: '1px solid #C8A000', padding: '5px 8px' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <StyledRowLabel sx={{ width: '200px' }}>
                        <TextField variant="outlined" size="small" value={unidentifiedParts.remarks}
                          onChange={e => setUnidentifiedParts(prev => ({ ...prev, remarks: e.target.value }))}
                          placeholder="Remarks" sx={{ width: '200px', ...inputSx }} />
                      </StyledRowLabel>
                      <StyledTd align="center" sx={{ backgroundColor: '#FFF0F0' }}>
                        <TextField variant="outlined" size="small" value={unidentifiedParts.noOfPartLine}
                          onChange={e => setUnidentifiedParts(prev => ({ ...prev, noOfPartLine: e.target.value }))}
                          placeholder="0" sx={{ width: '80px', ...inputSx }} />
                      </StyledTd>
                      <StyledTd align="center" sx={{ backgroundColor: '#FFF0F0' }}>
                        <TextField variant="outlined" size="small" value={unidentifiedParts.value}
                          onChange={e => setUnidentifiedParts(prev => ({ ...prev, value: e.target.value }))}
                          placeholder="0" sx={{ width: '80px', ...inputSx }} />
                      </StyledTd>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </SectionBox>
          </Box>
        )}

        {/* ── STEP 1: Review ── */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: '#1F4EA3' }}>Review Data Before Generating PDF</Typography>

            <Paper sx={{ p: 2.5, bgcolor: '#F8FAFC', borderRadius: 2, mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#D35400' }}>📁 Uploaded Locations</Typography>
              <Grid container spacing={2}>
                {locationFiles.map((loc, idx) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                    <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #E2E8F0' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#D35400' }}>{loc.locationName}</Typography>
                      <Typography variant="caption" display="block">Categories: {loc.summaryData.filter(d => !d.category?.toLowerCase().includes('total')).length}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">File: {loc.fileName}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1F4EA3' }}>✅ Audit Accuracy Check</Typography>
                  {[['Part Lines Checked', auditAccuracy.partLinesChecked], ['Part Lines OK', auditAccuracy.partLinesOK], ['Part Lines Not OK', auditAccuracy.partLinesNotOK], ['Accuracy', auditAccuracy.accuracy]].map(([k, v]) => (
                    <Typography key={k} variant="caption" display="block"><b>{k}:</b> {v || '—'}</Typography>
                  ))}
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1F4EA3' }}>📋 P4I Summary</Typography>
                  {p4iRows.map(row => (
                    <Typography key={row.category} variant="caption" display="block"><b>{row.category}:</b> Lines: {row.noOfPartsLine || '—'} | Value: {row.p4iValue || '—'}</Typography>
                  ))}
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1F4EA3' }}>⚠️ Damage Stock</Typography>
                  {[['Value (Added)', damageStock.valueAddedInPhysical], ['Value (Not Added)', damageStock.valueNotAddedInPhysical], ['Value (Total)', damageStock.valueTotal], ['Part Lines (Total)', damageStock.partLinesTotal], ['Qty (Total)', damageStock.quantityTotal]].map(([k, v]) => (
                    <Typography key={k} variant="caption" display="block"><b>{k}:</b> {v || '—'}</Typography>
                  ))}
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#1F4EA3' }}>🔍 Unidentified Parts</Typography>
                  <Typography variant="caption" display="block"><b>Remarks:</b> {unidentifiedParts.remarks || '—'}</Typography>
                  <Typography variant="caption" display="block"><b>Part Lines:</b> {unidentifiedParts.noOfPartLine || '—'}</Typography>
                  <Typography variant="caption" display="block"><b>Value:</b> {unidentifiedParts.value || '—'}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Alert severity="info" sx={{ mt: 3 }}>
              All {locationFiles.length} location(s) and 4 additional tables are ready. Click "Generate PDF" to create the report.
            </Alert>
          </Box>
        )}

        {/* ── STEP 2: Done ── */}
        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircle sx={{ fontSize: 60, color: '#10B981', mb: 2 }} />
            <Typography variant="h6" gutterBottom>PDF Generated Successfully!</Typography>
            <Typography variant="body2" color="text.secondary">Your consolidated report has been downloaded.</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={handleClose} variant="outlined">Cancel</Button>
        {activeStep === 0 && (
          <Button onClick={handleNext} variant="contained" disabled={locationFiles.length === 0}
            sx={{ bgcolor: '#D35400', '&:hover': { bgcolor: '#A04000' } }}>
            Next ({locationFiles.length} files)
          </Button>
        )}
        {activeStep === 1 && (
          <>
            <Button onClick={handleBack}>Back</Button>
            <Button onClick={generatePDF} variant="contained" disabled={generating} startIcon={generating ? undefined : <Download />}
              sx={{ bgcolor: '#D35400', '&:hover': { bgcolor: '#A04000' } }}>
              {generating ? 'Generating...' : 'Generate PDF'}
            </Button>
          </>
        )}
        {activeStep === 2 && (
          <Button onClick={handleClose} variant="contained" sx={{ bgcolor: '#10B981' }}>Close</Button>
        )}
      </DialogActions>
    </StyledDialog>
  );
};

export default TataPDFReport;