import React, { useState, type ChangeEvent, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Logo from '../assets/images/Focus_logo.png';
import Corner from '../assets/images/Corner.png';


import { renderToBlob } from '@react-docx/core';
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  AlignmentType,
  Header,
  ImageRun,
  PageNumber,
  Footer,
  PageBreak,
  Packer,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  HorizontalPositionAlign,
} from 'docx';
import { saveAs } from 'file-saver';


 const response = await fetch(Corner);
const buffer = await response.arrayBuffer();
// ── TYPES ──────────────────────────────────
interface DealerReAuditRow {
  partNumber: string;
  location: string;
  partDesc: string;
  partPrice: number;
  finalCount: number;
  dealerCount: number;
  remarks: string;
  value: number;
}

export interface SummaryRow {
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

export interface ShortExcessRow {
  partNumber: string;
  partDesc: string;
  category: string;
  partPrice: number;
  stockQty: number;
  phyQty: number;
  dmgQty: number;
  p41: number;
  finalPhy: number;
  diff: number;
  stockValue: number;
  phyValue: number;
  shortExcess: number;
  spmRemark?: string;
  location?: string;
}

interface PostAuditDocumentProps {
  summaryData?: SummaryRow[];
  shortageParts?: ShortExcessRow[];
  excessParts?: ShortExcessRow[];
  dealerName?: string;
  location?: string;
  auditStartDate?: string;
  auditEndDate?: string;
  onClose?: () => void;
  logoBase64?: string;
}

// ── CONSTANTS ──────────────────────────────
const NAVY = '#1A237E'; // Dark navy blue
const NAVY_LIGHT = '#283593';
const NAVY_DARK = '#0D1642';
const NAVY_BG = '#E8EAF6'; // Light navy background
const BORDER_COLOR = '#C5CAE9';

// Table header colors for different sections
const HEADER_COLORS = {
  primary: NAVY,           // Navy blue for main headers
  success: '#2E7D32',      // Green for excess
  danger: '#C62828',       // Red for shortage
  warning: '#EF6C00',      // Orange for re-audit
  info: '#0277BD'          // Light blue for summaries
};

// ── TINY HELPERS ───────────────────────────
const formatNumber = (n: number) => {
  if (n === 0) return '0';
  // Format to 1 decimal place for thousands, remove ₹ symbol
  return n.toLocaleString('en-IN', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1
  }).replace(/[^\d,.-]/g, '');
};

const formatPercent = (n: number) => {
  return n.toFixed(1) + '%';
}; 

// ── COMPONENT ──────────────────────────────
const PostAuditDocument: React.FC<PostAuditDocumentProps> = ({
  summaryData = [],
  shortageParts = [],
  excessParts = [],
  dealerName: propDealer = '',
  location: propLoc = '',
  auditStartDate = '',
  auditEndDate = '',
  onClose,
  logoBase64,
}) => {
  // ── Form state ──
  const [dealerName, setDealerName] = useState(propDealer);
  const [location, setLocation] = useState(propLoc);
  const [brandName, setBrandName] = useState('TATA');
  const [undefinedRemarks, setUndefinedRemarks] = useState('Some Parts Undefine.');
  const [multiLocCount, setMultiLocCount] = useState('');

  // Signature fields
  const [auditSupervisor, setAuditSupervisor] = useState('');
  const [spmSig, setSpmSig] = useState('');
  const [ownerSig, setOwnerSig] = useState('');
  const [focusName, setFocusName] = useState('');
  const [focusMob, setFocusMob] = useState('');
  const [spareMgrName, setSpareMgrName] = useState('');
  const [spareMgrMob, setSpareMgrMob] = useState('');
  const [wmGmName, setWmGmName] = useState('');
  const [wmGmMob, setWmGmMob] = useState('');
  const [scsName, setScsName] = useState('');
  const [scsMob, setScsMob] = useState('');
  const [raSpmName, setRaSpmName] = useState('');
  const [raSpmMob, setRaSpmMob] = useState('');
  const [raWmMob, setRaWmMob] = useState('');

  // Dealer re-audit
  const [raRows, setRaRows] = useState<DealerReAuditRow[]>([]);
  const [raFileName, setRaFileName] = useState('');
  const [raSummary, setRaSummary] = useState({ total: 0, totalVal: 0, ok: 0, okVal: 0, notOk: 0, notOkVal: 0 });

  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<string | undefined>(logoBase64);
  
  

  useEffect(() => {
    // Convert image to base64
    const convertToBase64 = async () => {
      try {
        const response = await fetch(Logo);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogo(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.error('Error converting logo to base64:', error);
      }
    };

    convertToBase64();
  }, []);

  // Load logo if not provided
  useEffect(() => {
    if (!logo && !logoBase64) {
      // Create a simple TATA logo text as fallback
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 30;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = NAVY;
        ctx.font = 'bold 20px Arial';
        ctx.fillText('TATA', 10, 22);
        setLogo(canvas.toDataURL());
      }
    }
  }, [logoBase64]);

  // ── Upload handler ──────────────────────
  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRaFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) return;

      const hdrs = json[0].map((h: any) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''));
      const fi = (names: string[]) => { for (const n of names) { const i = hdrs.findIndex((h: string) => h.includes(n)); if (i !== -1) return i; } return -1; };
      const pnI = fi(['partnumber', 'partno', 'part']);
      const locI = fi(['location', 'loc']);
      const dscI = fi(['partdesc', 'description', 'desc']);
      const prI = fi(['partprice', 'price', 'mrp']);
      const fcI = fi(['finalcount', 'final']);
      const dcI = fi(['dealercount', 'dealer']);
      const rmI = fi(['remarks', 'remark']);
      const vlI = fi(['value', 'val']);

      const rows: DealerReAuditRow[] = [];
      for (let i = 1; i < json.length; i++) {
        const r = json[i];
        const pn = String(r[pnI] ?? '').trim();
        if (!pn) continue;
        const price = parseFloat(String(r[prI] ?? 0).replace(/[^0-9.]/g, '')) || 0;
        const fc = parseFloat(String(r[fcI] ?? 0)) || 0;
        const dc = parseFloat(String(r[dcI] ?? 0)) || 0;
        const val = vlI !== -1 ? (parseFloat(String(r[vlI] ?? 0).replace(/[^0-9.]/g, '')) || 0) : price * Math.abs(fc - dc);
        rows.push({ partNumber: pn, location: String(r[locI] ?? '').trim(), partDesc: String(r[dscI] ?? '').trim(), partPrice: price, finalCount: fc, dealerCount: dc, remarks: String(r[rmI] ?? '').trim(), value: val });
      }
      setRaRows(rows);
      const ok = rows.filter(r => r.finalCount === r.dealerCount);
      const notOk = rows.filter(r => r.finalCount !== r.dealerCount);
      setRaSummary({
        total: rows.length, totalVal: rows.reduce((s, r) => s + r.value, 0),
        ok: ok.length, okVal: ok.reduce((s, r) => s + r.value, 0),
        notOk: notOk.length, notOkVal: notOk.reduce((s, r) => s + r.value, 0),
      });
    };
    reader.readAsArrayBuffer(file);
  };

  // ── PDF Download ────────────────────────
  const downloadPDF = () => {
    setLoading(true);
    setTimeout(() => {
      try {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const PW = doc.internal.pageSize.getWidth();
        const PH = doc.internal.pageSize.getHeight();
        let y = 22; // Start Y position

        const addLogo = () => {
          if (logo) {
            try {
              doc.addImage(logo, 'PNG', PW - 45, 5, 30, 10);
            } catch (e) {
              console.log('Logo could not be added');
            }
          }
        };

        // Helper: Page header with navy blue
        const pageHeader = (title: string, subtitle?: string) => {
          doc.setFillColor(26, 35, 126);
          doc.rect(0, 0, PW, 16, 'F');

          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text(title, 15, 11);

          if (subtitle) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(subtitle, 15, 15);
          }

          doc.setTextColor(0, 0, 0);
          addLogo();
          return 22;
        };

        // Helper: Section heading
        const sectionHeading = (title: string, yPos: number) => {
          doc.setFillColor(240, 245, 255);
          doc.rect(10, yPos - 4, PW - 20, 7, 'F');

          doc.setDrawColor(26, 35, 126);
          doc.setLineWidth(0.5);
          doc.line(10, yPos + 2, PW - 10, yPos + 2);

          doc.setTextColor(26, 35, 126);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.text(title.toUpperCase(), 12, yPos);

          doc.setTextColor(0, 0, 0);
          return yPos + 8;
        };

        // Helper: Draw input field (box with optional text)
        const drawInputField = (x: number, y: number, width: number, height: number, value: string = '') => {
          doc.setDrawColor(180, 180, 180);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(x, y - height + 2, width, height, 1, 1, 'FD');

          if (value) {
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(value, x + 2, y - 1);
          }
        };

        // ============================================
        // PAGE 1 - POST AUDIT DOCUMENT (Part 1)
        // ============================================
        y = pageHeader('POST AUDIT DOCUMENT', '(To be filled by Audit Supervisor)');

        // Dealer Information Card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y, PW - 20, 18, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(26, 35, 126);
        doc.text('Dealer Name:', 15, y + 6);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(dealerName || '_______________', 42, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 35, 126);
        doc.text('Location:', 120, y + 6);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(location || '_______________', 142, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 35, 126);
        doc.text('Brand:', 210, y + 6);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text(brandName || '_______________', 230, y + 6);

        y += 25;

        // Dealer Re-Audit Summary table
        y = sectionHeading('DEALER RE-AUDIT SUMMARY', y);

        const pct = (n: number, t: number) => t > 0 ? ((n / t) * 100).toFixed(1) + '%' : '0%';

        autoTable(doc, {
          startY: y,
          head: [['No of Items', 'Value (₹)', 'Ok Items', 'Ok Value', 'Not Ok', 'Not Ok Value', 'Ok %', 'Not Ok %']],
          body: [[
            raSummary.total,
            formatNumber(raSummary.totalVal),
            raSummary.ok,
            formatNumber(raSummary.okVal),
            raSummary.notOk,
            formatNumber(raSummary.notOkVal),
            pct(raSummary.ok, raSummary.total),
            pct(raSummary.notOk, raSummary.total),
          ]],
          styles: { fontSize: 8, cellPadding: 2, lineColor: [197, 202, 233], lineWidth: 0.1 },
          headStyles: { fillColor: [26, 35, 126], textColor: [255, 255, 255], fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 10, right: 10 },
          theme: 'grid'
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // Undefined Parts Card
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y - 5, PW - 20, 25, 3, 3, 'FD');

        doc.setTextColor(26, 35, 126);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('UNDEFINED PARTS', 15, y);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Have you taken deadline date from SPM for defining undefined parts? If yes please mention date in remarks.', 15, y + 6);
        doc.text('Remarks: ' + (undefinedRemarks || '_______________'), 15, y + 13);
        y += 25;

        // Multi-Location Card
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y - 5, PW - 20, 25, 3, 3, 'FD');

        doc.setTextColor(26, 35, 126);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('MULTI-LOCATION PARTS', 15, y);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.text('Multi location corrected count: ' + (multiLocCount || '___________________'), 15, y + 6);
        doc.setFont('helvetica', 'italic');
        doc.text('Note: Multilocation corrected to the extent possible during the audit', 15, y + 13);
        y += 25;

        // Parts Summary
        doc.setFillColor(240, 245, 255);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y - 5, PW - 20, 15, 3, 3, 'FD');

        doc.setTextColor(26, 35, 126);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('Parts Re-audited by Focus Engineering team', 15, y);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        const shortValue = formatNumber(shortageParts.reduce((s, r) => s + Math.abs(r.shortExcess), 0));
        const excessValue = formatNumber(excessParts.reduce((s, r) => s + r.shortExcess, 0));
        doc.text(`Short Parts: ${shortageParts.length} | Value: ${shortValue}`, 15, y + 6);
        doc.text(`Excess Parts: ${excessParts.length} | Value: ${excessValue}`, 130, y + 6);
        y += 20;

        // AUDIT SUPERVISOR & MANAGER SIGNATURES (on Page 1)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y - 5, PW - 20, 52, 3, 3, 'FD');

        doc.setTextColor(26, 35, 126);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('AUDIT SUPERVISOR & MANAGER SIGNATURES', 15, y);
        y += 10;

        // First signature line
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Audit Supervisor Name & Sign:', 15, y);
        drawInputField(85, y, 120, 7, auditSupervisor);
        y += 10;

        // Second signature line
        doc.setFont('helvetica', 'bold');
        doc.text('Spare Part Manager Name & Sign:', 15, y);
        drawInputField(88, y, 120, 7, spmSig);
        y += 10;

        // Third signature line
        doc.setFont('helvetica', 'bold');
        doc.text('Owner/VP/GM/WM Name & Sign:', 15, y);
        drawInputField(90, y, 120, 7, ownerSig);
        y += 5; // Small padding before page end

        // ============================================
        // PAGE 2 - ACKNOWLEDGEMENT LETTER (Moved to separate page)
        // ============================================
        doc.addPage();
        y = pageHeader('ACKNOWLEDGEMENT LETTER');

        // Acknowledgement Letter Card
        doc.setFillColor(240, 245, 255);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y - 5, PW - 20, 150, 3, 3, 'FD');

        doc.setTextColor(26, 35, 126);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('ACKNOWLEDGEMENT LETTER', 15, y);
        y += 12;

        // Dealership Name
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.text('Dealership Name:', 15, y);
        drawInputField(70, y, 140, 7, dealerName);
        y += 12;

        // SPM Name
        doc.setFont('helvetica', 'bold');
        doc.text('SPM Name:', 15, y);
        drawInputField(70, y, 140, 7, spareMgrName);
        y += 14;

        // Acknowledgement statement
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text('I hereby provide acknowledgement on below points:', 15, y);
        y += 8;

        // Acknowledgement points - ALL 5 POINTS with proper spacing
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);

        // Point 1
        const point1 = doc.splitTextToSize('• All parts which store had given to workshop physically or to some other location is issued in system also.', PW - 40);
        doc.text(point1, 15, y);
        y += point1.length * 5 + 2;

        // Point 2
        const point2 = doc.splitTextToSize('• All Parts which are issued in system stock is issued physically also to the workshop.', PW - 40);
        doc.text(point2, 15, y);
        y += point2.length * 5 + 2;

        // Point 3
        const point3 = doc.splitTextToSize('• No inwarding was done in audit duration, if any inwarding done for emergency same is issued in system or it had been counted by Focus Engineering team.', PW - 40);
        doc.text(point3, 15, y);
        y += point3.length * 5 + 2;

        // Point 4
        const point4 = doc.splitTextToSize('• If any part physically given but not issued in system for some specific reason, In that case I had given pending for issue parts to auditor for adding in physical quantity.', PW - 40);
        doc.text(point4, 15, y);
        y += point4.length * 5 + 2;

        // Point 5
        const point5 = doc.splitTextToSize('• I (Dealership Team) hereby declared all area at our audit location is shown to the Focus Engineering Audit Team and those are Audited/Verified by the Focus Engineering Audit Team.', PW - 40);
        doc.text(point5, 15, y);
        y += point5.length * 5 + 15;

        // Final signatures
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('Audit Supervisor Name & Sign:', 15, y);
        drawInputField(80, y, 130, 7, auditSupervisor);
        y += 12;

        doc.setFont('helvetica', 'bold');
        doc.text('SPM Name & Sign:', 15, y);
        drawInputField(70, y, 130, 7, spmSig);
        y += 10;

        // ============================================
        // PAGE 3 - WWSIA SUMMARY
        // ============================================
        doc.addPage();
        y = pageHeader('WALL-TO-WALL SMART INVENTORY AUDIT');

        // Audit Info Card
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(26, 35, 126);
        doc.roundedRect(10, y, PW - 20, 15, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(26, 35, 126);
        doc.text('Dealer:', 15, y + 5);
        doc.setTextColor(0, 0, 0);
        doc.text(dealerName || '', 40, y + 5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 35, 126);
        doc.text('Location:', 120, y + 5);
        doc.setTextColor(0, 0, 0);
        doc.text(location || '', 150, y + 5);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(26, 35, 126);
        doc.text('Period:', 200, y + 5);
        doc.setTextColor(0, 0, 0);
        doc.text(`${auditStartDate || ''} to ${auditEndDate || ''}`, 225, y + 5);

        y += 20;

        // WWSIA Summary Table
        if (summaryData.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [
              [
                { content: 'Category', rowSpan: 2, styles: { halign: 'center', fillColor: [120, 53, 15], textColor: 255 } },
                { content: 'DMS Stock', colSpan: 3, styles: { halign: 'center', fillColor: [29, 78, 216], textColor: 255 } },
                { content: 'Physical Stock', colSpan: 3, styles: { halign: 'center', fillColor: [22, 101, 52], textColor: 255 } },
                { content: 'Excess', colSpan: 2, styles: { halign: 'center', fillColor: [21, 128, 61], textColor: 255 } },
                { content: 'Short', colSpan: 2, styles: { halign: 'center', fillColor: [185, 28, 28], textColor: 255 } },
                { content: 'Net Diff', colSpan: 2, styles: { halign: 'center', fillColor: [109, 40, 217], textColor: 255 } },
              ],
              ['', 'Value', 'Lines', 'Qty', 'Value', 'Lines', 'Qty', 'Value', 'Lines', 'Value', 'Lines', 'Value', 'Diff %'],
            ],
            body: summaryData.map(r => [
              r.category,
              formatNumber(r.dmsValue),
              r.dmsPartLines,
              r.dmsQuantity,
              formatNumber(r.physicalValue),
              r.physicalPartLines,
              r.physicalQuantity,
              formatNumber(r.excessValue),
              r.excessPartLines,
              formatNumber(r.shortValue),
              r.shortPartLines,
              formatNumber(r.netDifferenceValue),
              r.netDifferencePercent.toFixed(1) + '%',
            ]),
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fontStyle: 'bold', textColor: 255 },
            didParseCell: (d) => {
              if (d.section === 'body' && d.row.index === summaryData.length - 1) {
                d.cell.styles.fontStyle = 'bold';
                d.cell.styles.fillColor = [255, 243, 224];
              }
            },
            margin: { left: 10, right: 10 },
            theme: 'grid'
          });
          y = (doc as any).lastAutoTable.finalY + 10;
        }

        // Signature boxes
        const sigBox = (label: string, name: string, mob: string, x: number, yy: number) => {
          doc.setDrawColor(26, 35, 126);
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(x, yy, 85, 18, 2, 2, 'FD');

          doc.setTextColor(26, 35, 126);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(label, x + 3, yy + 6);

          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.text(name || '____________________', x + 3, yy + 12);
          doc.text('MOB: ' + (mob || '____________'), x + 3, yy + 17);
        };

        sigBox('FOCUS AUDITOR', focusName, focusMob, 10, y);
        sigBox('SPARE PARTS MGR', spareMgrName, spareMgrMob, 105, y);
        sigBox('WM/GM', wmGmName, wmGmMob, 200, y);

        // ============================================
        // PAGE 4 - SHORTAGE PARTS
        // ============================================
        if (shortageParts.length > 0) {
          doc.addPage();
          y = pageHeader('SHORTAGE PARTS DETAILS');

          autoTable(doc, {
            startY: y,
            head: [['Part No', 'Description', 'Category', 'Price', 'Stock', 'Phy', 'Dmg', 'P41', 'Final', 'Diff', 'Stock Val', 'Phy Val', 'Type', 'Remark', 'Location']],
            body: shortageParts.map(r => [
              r.partNumber,
              r.partDesc,
              r.category,
              formatNumber(r.partPrice),
              r.stockQty,
              r.phyQty,
              r.dmgQty || 0,
              r.p41 || 0,
              r.finalPhy,
              r.diff,
              formatNumber(r.stockValue),
              formatNumber(r.phyValue),
              'SHORT',
              r.spmRemark || '',
              r.location || '',
            ]),
            styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fillColor: [198, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [255, 235, 235] },
            columnStyles: { 1: { cellWidth: 38 } },
            margin: { left: 10, right: 10 },
            theme: 'grid'
          });
          y = (doc as any).lastAutoTable.finalY + 10;

          sigBox('FOCUS AUDITOR', focusName, focusMob, 10, y);
          sigBox('SPARE PARTS MGR', spareMgrName, spareMgrMob, 105, y);
          sigBox('WM/GM', wmGmName, wmGmMob, 200, y);
        }

        // ============================================
        // PAGE 5 - EXCESS PARTS
        // ============================================
        if (excessParts.length > 0) {
          doc.addPage();
          y = pageHeader('EXCESS PARTS DETAILS');

          autoTable(doc, {
            startY: y,
            head: [['Part No', 'Description', 'Category', 'Price', 'Stock', 'Phy', 'Dmg', 'P41', 'Final', 'Diff', 'Stock Val', 'Phy Val', 'Type', 'Remark', 'Location']],
            body: excessParts.map(r => [
              r.partNumber,
              r.partDesc,
              r.category,
              formatNumber(r.partPrice),
              r.stockQty,
              r.phyQty,
              r.dmgQty || 0,
              r.p41 || 0,
              r.finalPhy,
              '+' + r.diff,
              formatNumber(r.stockValue),
              formatNumber(r.phyValue),
              'EXCESS',
              r.spmRemark || '',
              r.location || '',
            ]),
            styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fillColor: [46, 125, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [232, 245, 233] },
            columnStyles: { 1: { cellWidth: 38 } },
            margin: { left: 10, right: 10 },
            theme: 'grid'
          });
          y = (doc as any).lastAutoTable.finalY + 10;

          sigBox('FOCUS AUDITOR', focusName, focusMob, 10, y);
          sigBox('SPARE PARTS MGR', spareMgrName, spareMgrMob, 105, y);
          sigBox('WM/GM', wmGmName, wmGmMob, 200, y);
        }

        // ============================================
        // PAGE 6 - DEALER RE-AUDIT
        // ============================================
        if (raRows.length > 0) {
          doc.addPage();
          y = pageHeader('DEALER RE-AUDIT PARTS');

          autoTable(doc, {
            startY: y,
            head: [['Part No', 'Location', 'Description', 'Price', 'Final', 'Dealer', 'Remarks', 'Value']],
            body: raRows.map(r => [
              r.partNumber,
              r.location,
              r.partDesc,
              formatNumber(r.partPrice),
              r.finalCount,
              r.dealerCount,
              r.remarks,
              formatNumber(r.value)
            ]),
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
            headStyles: { fillColor: [230, 81, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [255, 243, 224] },
            columnStyles: { 2: { cellWidth: 45 } },
            margin: { left: 10, right: 10 },
            theme: 'grid'
          });
          y = (doc as any).lastAutoTable.finalY + 10;

          sigBox('SCS AUDITOR', scsName, scsMob, 10, y);
          sigBox('SPARE PARTS MGR', raSpmName, raSpmMob, 105, y);
          sigBox('WM/GM', wmGmName, raWmMob, 200, y);
        }

        // Page numbers
        const total = doc.getNumberOfPages();
        for (let p = 1; p <= total; p++) {
          doc.setPage(p);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`Page ${p} of ${total}`, PW - 15, PH - 8, { align: 'right' });

          doc.setDrawColor(26, 35, 126);
          doc.setLineWidth(0.5);
          doc.line(10, PH - 12, PW - 10, PH - 12);
        }

        doc.save(`TATA_Audit_Report_${dealerName || 'Dealer'}_${new Date().toISOString().split('T')[0]}.pdf`);
      } catch (err: any) {
        alert('PDF Error: ' + err.message);
      } finally {
        setLoading(false);
      }
    }, 80);
  };
  const downloadWordDocx = async () => {
    setLoading(true);

    try {
      // Helper function to convert base64 to array buffer
      const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
        const base64Data = base64.includes('base64,')
          ? base64.split('base64,')[1]
          : base64;

        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer;
      };

      // Prepare logo image if available
      let logoImageBuffer: ArrayBuffer | undefined;
      if (logo) {
        try {
          logoImageBuffer = base64ToArrayBuffer(logo);
        } catch (e) {
          console.error('Error processing logo:', e);
        }
      }

      // Format number helper for docx
      const formatWordNumber = (n: number): string => {
        if (n === 0) return '0';
        return n.toLocaleString('en-IN', {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1
        }).replace(/[^\d,.-]/g, '');
      };

      // Calculate values
      const shortValue = formatWordNumber(shortageParts.reduce((s, r) => s + Math.abs(r.shortExcess), 0));
      const excessValue = formatWordNumber(excessParts.reduce((s, r) => s + r.shortExcess, 0));
      const pct = (n: number, t: number): string => t > 0 ? ((n / t) * 100).toFixed(1) + '%' : '0%';

      const geometricSvg = `<svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
  <polygon points="0,0 120,0 0,80" fill="#1A237E"/>
  <polygon points="0,0 80,0 0,55" fill="#283593"/>
  <polygon points="0,0 45,0 0,30" fill="#3949AB"/>
</svg>`;
const geometricBase64 = btoa(geometricSvg);
const geometricBuffer = base64ToArrayBuffer(`data:image/svg+xml;base64,${geometricBase64}`);

// Create a fallback PNG for the geometric shape (optional)
// You can use the same geometricBuffer as fallback or create a simple colored rectangle
const fallbackSvg = `<svg width="120" height="80" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="80" fill="#1A237E"/>
</svg>`;
const fallbackBase64 = btoa(fallbackSvg);
const fallbackBuffer = base64ToArrayBuffer(`data:image/svg+xml;base64,${fallbackBase64}`);

const headerChildren: any[] = [];

// LEFT SIDE: Geometric Shape (your existing code)
headerChildren.push(
  new Paragraph({

    children: [
      new ImageRun({
        data: buffer,  // Your geometric shape buffer
        type: "png",
        transformation: {
          width: 160,
          height: 130,
        },
        floating: {
          horizontalPosition: {
            relative: HorizontalPositionRelativeFrom.PAGE,
            offset: 0,
          },
          verticalPosition: {
            relative: VerticalPositionRelativeFrom.PAGE,
            offset: 0,
          },
          wrap: {
            type: TextWrappingType.NONE,
          },
        },
      })
    ],
  })
);

// RIGHT SIDE: Logo + Address (NEW CODE TO ADD)


// Add Logo (right aligned)
headerChildren.push(
 new Paragraph({
  children: [
    new ImageRun({
      data: logoImageBuffer,
      type: "png",
      transformation: { width: 140, height: 60 },
        floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.MARGIN,
        align: HorizontalPositionAlign.RIGHT,
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.MARGIN,
        offset: 0, // fine tune
      },
      wrap: {
        type: TextWrappingType.NONE,
      },
    },
    }),
  ],
})
);

// Add Address line 1 (right aligned)
headerChildren.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: '149, Gandhi Ji Street, Thangam Nagar,',
        size: 14,
        color: '333333',
      }),
    ],
  })
);

// Add Address line 2 (right aligned)
headerChildren.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: 'Thalayattam, Gudiyattam. 632602',
        size: 14,
        color: '333333',
      }),
    ],
  })
);

// Add Address line 3 (right aligned)
headerChildren.push(
  new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [
      new TextRun({
        text: 'Vellore District, Tamil Nadu',
        size: 14,
        color: '333333',
      }),
    ],
  })
);

// Add some spacing before the border line
headerChildren.push(
  new Paragraph({
    children: [new TextRun({ text: '' })],
    spacing: { before: 40, after: 0 },
  })
);

// Add header border line (your existing code)
headerChildren.push(
  new Paragraph({
    children: [new TextRun({ text: '' })],
    thematicBreak: true,
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '1A237E' },
    },
  })
);


      // Create footer with page numbers
      const footerChildren = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Page ',
              size: 16,
              color: '666666',
            }),
            new TextRun({
              children: [PageNumber.CURRENT],
              size: 16,
              color: '666666',
            }),
            new TextRun({
              text: ' of ',
              size: 16,
              color: '666666',
            }),
            new TextRun({
              children: [PageNumber.TOTAL_PAGES],
              size: 16,
              color: '666666',
            }),
          ],
        }),
      ];

      // Create the document with all pages
      const doc = new Document({
        sections: [
          {
            headers: {
              default: new Header({
                children: headerChildren,
              }),
            },
            footers: {
              default: new Footer({
                children: footerChildren,
              }),
            },
            properties: {
              page: {
                margin: {
                   top: 600,
                  right: 1440,
                  bottom: 1440,
                  left: 1440,
                },
              },
            },
            children: [
              // ==================== PAGE 1: POST AUDIT DOCUMENT ====================
              new Paragraph({
                heading: 'Heading1',
                children: [
                  new TextRun({
                    text: 'POST AUDIT DOCUMENT',
                    bold: true,
                    size: 36,
                    color: '1A237E',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: '(To be filled by Audit Supervisor)',
                    italics: true,
                    size: 18,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // Dealer Information Card
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                },
                shading: {
                  fill: 'F8FAFC',
                },
                children: [
                  new TextRun({
                    text: `Dealer Name: ${dealerName || '_______________'}`,
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: `\nLocation: ${location || '_______________'}`,
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: `\nBrand: ${brandName || 'TATA'}`,
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // DEALER RE-AUDIT SUMMARY
              new Paragraph({
                heading: 'Heading2',
                children: [
                  new TextRun({
                    text: 'DEALER RE-AUDIT SUMMARY',
                    bold: true,
                    size: 28,
                    color: '1A237E',
                  }),
                ],
              }),

              // Summary Table
              new Table({
  rows: [
    // Header Row
    new TableRow({
      children: [
        new TableCell({ 
          children: [new Paragraph('Items')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Value')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Ok')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Ok Value')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Not Ok')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Not Ok Val')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Ok %')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
        new TableCell({ 
          children: [new Paragraph('Not Ok %')],
          shading: { fill: '1A237E' },
          margins: { top: 100, bottom: 100, left: 100, right: 100 }
        }),
      ],
    }),

    // Data Row
    new TableRow({
      children: [
        new TableCell({ 
          children: [new Paragraph(raSummary.total.toString())],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(formatWordNumber(raSummary.totalVal))],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(raSummary.ok.toString())],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(formatWordNumber(raSummary.okVal))],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(raSummary.notOk.toString())],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(formatWordNumber(raSummary.notOkVal))],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(pct(raSummary.ok, raSummary.total))],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
        new TableCell({ 
          children: [new Paragraph(pct(raSummary.notOk, raSummary.total))],
          margins: { top: 80, bottom: 80, left: 80, right: 80 }
        }),
      ],
    }),
  ],
  width: {
    size: 100,
    type: WidthType.PERCENTAGE,
  },
}),
              new Paragraph({ text: '' }),

              // UNDEFINED PARTS
              new Paragraph({
                heading: 'Heading2',
                children: [
                  new TextRun({
                    text: 'UNDEFINED PARTS',
                    bold: true,
                    size: 28,
                    color: '1A237E',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Have you taken deadline date from SPM for defining undefined parts? If yes please mention date in remarks.',
                    size: 18,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Remarks: ${undefinedRemarks || '_______________'}`,
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // MULTI-LOCATION PARTS
              new Paragraph({
                heading: 'Heading2',
                children: [
                  new TextRun({
                    text: 'MULTI-LOCATION PARTS',
                    bold: true,
                    size: 28,
                    color: '1A237E',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Multi location corrected count: ${multiLocCount || '___________________'}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Note: Multilocation corrected to the extent possible during the audit',
                    italics: true,
                    size: 16,
                    color: '666666',
                  }),
                ],
              }),

              // Parts Summary Stats
              new Paragraph({
                shading: {
                  fill: 'E8EAF6',
                },
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                },
                children: [
                  new TextRun({
                    text: `Short Parts: ${shortageParts.length} | Value: ${shortValue}     Excess Parts: ${excessParts.length} | Value: ${excessValue}`,
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // AUDIT SUPERVISOR & MANAGER SIGNATURES
              new Paragraph({
                heading: 'Heading2',
                children: [
                  new TextRun({
                    text: 'AUDIT SUPERVISOR & MANAGER SIGNATURES',
                    bold: true,
                    size: 28,
                    color: '1A237E',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Audit Supervisor Name & Sign: ${auditSupervisor || '____________________'}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Spare Part Manager Name & Sign: ${spmSig || '____________________'}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Owner/VP/GM/WM Name & Sign: ${ownerSig || '____________________'}`,
                    size: 20,
                  }),
                ],
              }),

              // Page Break
              new Paragraph({ children: [new PageBreak()] }),

              // ==================== PAGE 2: ACKNOWLEDGEMENT LETTER ====================
              new Paragraph({
                heading: 'Heading1',
                children: [
                  new TextRun({
                    text: 'ACKNOWLEDGEMENT LETTER',
                    bold: true,
                    size: 36,
                    color: '1A237E',
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // Acknowledgement Card
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                },
                shading: {
                  fill: 'F8FAFC',
                },
                children: [
                  new TextRun({
                    text: `Dealership Name: ${dealerName || '____________________'}`,
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: `\nSPM Name: ${spareMgrName || '____________________'}`,
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: 'I hereby provide acknowledgement on below points:',
                    bold: true,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // Acknowledgement Points
              ...['All parts which store had given to workshop physically or to some other location is issued in system also.',
                'All Parts which are issued in system stock is issued physically also to the workshop.',
                'No inwarding was done in audit duration, if any inwarding done for emergency same is issued in system or it had been counted by Focus Engineering team.',
                'If any part physically given but not issued in system for some specific reason, In that case I had given pending for issue parts to auditor for adding in physical quantity.',
                'I (Dealership Team) hereby declared all area at our audit location is shown to the Focus Engineering Audit Team and those are Audited/Verified by the Focus Engineering Audit Team.'
              ].map(point =>
                new Paragraph({
                  indent: { left: 720 },
                  children: [
                    new TextRun({
                      text: `• ${point}`,
                      size: 18,
                    }),
                  ],
                })
              ),
              new Paragraph({ text: '' }),

              // Signatures
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Audit Supervisor Name & Sign: ${auditSupervisor || '____________________'}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `SPM Name & Sign: ${spmSig || '____________________'}`,
                    size: 20,
                  }),
                ],
              }),

              // Page Break
              new Paragraph({ children: [new PageBreak()] }),

              // ==================== PAGE 3: WWSIA SUMMARY ====================
              new Paragraph({
                heading: 'Heading1',
                children: [
                  new TextRun({
                    text: 'WALL-TO-WALL SMART INVENTORY AUDIT',
                    bold: true,
                    size: 36,
                    color: '1A237E',
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // Audit Info Card
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  left: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                  right: { style: BorderStyle.SINGLE, size: 1, color: '1A237E' },
                },
                shading: {
                  fill: 'F8FAFC',
                },
                children: [
                  new TextRun({
                    text: `Dealer: ${dealerName || ''} | Location: ${location || ''} | Period: ${auditStartDate || ''} to ${auditEndDate || ''}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({ text: '' }),

              // WWSIA Summary Table
              ...(summaryData.length > 0 ? [
  new Table({
    rows: [
      // Header Row 1
      new TableRow({
        children: [
          new TableCell({ 
            rowSpan: 2,
            children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })],
            shading: { fill: '78350F' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
          new TableCell({ 
            colSpan: 3,
            children: [new Paragraph({ children: [new TextRun({ text: 'DMS Stock', bold: true, color: 'FFFFFF' })] })],
            shading: { fill: '1D4ED8' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
          new TableCell({ 
            colSpan: 3,
            children: [new Paragraph({ children: [new TextRun({ text: 'Physical Stock', bold: true, color: 'FFFFFF' })] })],
            shading: { fill: '166534' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
          new TableCell({ 
            colSpan: 2,
            children: [new Paragraph({ children: [new TextRun({ text: 'Excess', bold: true, color: 'FFFFFF' })] })],
            shading: { fill: '15803D' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
          new TableCell({ 
            colSpan: 2,
            children: [new Paragraph({ children: [new TextRun({ text: 'Short', bold: true, color: 'FFFFFF' })] })],
            shading: { fill: 'DC2626' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
          new TableCell({ 
            colSpan: 2,
            children: [new Paragraph({ children: [new TextRun({ text: 'Net Diff', bold: true, color: 'FFFFFF' })] })],
            shading: { fill: '7C3AED' },
            margins: { top: 100, bottom: 100, left: 100, right: 100 }
          }),
        ],
      }),
      // Header Row 2
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph('Value')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Lines')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Qty')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Value')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Lines')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Qty')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Value')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Lines')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Value')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Lines')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Value')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
          new TableCell({ 
            children: [new Paragraph('Diff %')], 
            shading: { fill: 'F97316' },
            margins: { top: 80, bottom: 80, left: 80, right: 80 }
          }),
        ],
      }),
      // Data Rows
      ...summaryData.map((r, index) => 
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(r.category)], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(r.dmsValue))], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.dmsPartLines.toString())], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.dmsQuantity.toString())], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(r.physicalValue))], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.physicalPartLines.toString())], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.physicalQuantity.toString())], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(r.excessValue))], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.excessPartLines.toString())], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(r.shortValue))], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.shortPartLines.toString())], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(Math.abs(r.netDifferenceValue)))], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
            new TableCell({ children: [new Paragraph(r.netDifferencePercent.toFixed(1) + '%')], margins: { top: 50, bottom: 50, left: 50, right: 50 } }),
          ],
        })
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }),
] : []),


              // Signatures for WWSIA
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Focus Auditor: ${focusName || '____________________'}    MOB: ${focusMob || ''}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `SPM: ${spareMgrName || '____________________'}    MOB: ${spareMgrMob || ''}`,
                    size: 20,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `WM/GM: ${wmGmName || '____________________'}    MOB: ${wmGmMob || ''}`,
                    size: 20,
                  }),
                ],
              }),

              // Page Break
              new Paragraph({ children: [new PageBreak()] }),

              // ==================== PAGE 4: SHORTAGE PARTS ====================
              ...(shortageParts.length > 0 ? [
                new Paragraph({
                  heading: 'Heading1',
                  children: [
                    new TextRun({
                      text: 'SHORTAGE PARTS DETAILS',
                      bold: true,
                      size: 36,
                      color: '1A237E',
                    }),
                  ],
                }),
                new Paragraph({ text: '' }),

                // Shortage Parts Table
               new Table({
  rows: [
    // Header
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph('Part No')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Description')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Category')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Price')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Stock')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Phy')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Dmg')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('P41')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Final')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Diff')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Stock Val')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Phy Val')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Type')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
        new TableCell({ children: [new Paragraph('Remark')], shading: { fill: 'C62828' }, margins: { top: 60, bottom: 60, left: 60, right: 60 } }),
      ],
    }),
    // Data Rows
    ...shortageParts.slice(0, 50).map(r => 
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.partNumber)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.partDesc)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.category)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(formatWordNumber(r.partPrice))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.stockQty.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.phyQty.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph((r.dmgQty || 0).toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph((r.p41 || 0).toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.finalPhy.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.diff.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(formatWordNumber(r.stockValue))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(formatWordNumber(r.phyValue))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph('SHORT')], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.spmRemark || '')], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
        ],
      })
    ),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
}),
                ...(shortageParts.length > 50 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `... and ${shortageParts.length - 50} more items`,
                        italics: true,
                        size: 16,
                      }),
                    ],
                  }),
                ] : []),
                new Paragraph({ text: '' }),

                // Signatures
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Focus Auditor: ${focusName || '____________________'}    MOB: ${focusMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `SPM: ${spareMgrName || '____________________'}    MOB: ${spareMgrMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `WM/GM: ${wmGmName || '____________________'}    MOB: ${wmGmMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),

                // Page Break
                new Paragraph({ children: [new PageBreak()] }),
              ] : []),

              // ==================== PAGE 5: EXCESS PARTS ====================
              ...(excessParts.length > 0 ? [
                new Paragraph({
                  heading: 'Heading1',
                  children: [
                    new TextRun({
                      text: 'EXCESS PARTS DETAILS',
                      bold: true,
                      size: 36,
                      color: '1A237E',
                    }),
                  ],
                }),
                new Paragraph({ text: '' }),

                // Excess Parts Table
                new Table({
                  rows: [
                    // Header
                    new TableRow({
                      children: [
                        'Part No', 'Description', 'Category', 'Price', 'Stock', 'Phy',
                        'Dmg', 'P41', 'Final', 'Diff', 'Stock Val', 'Phy Val', 'Type', 'Remark'
                      ].map(text =>
                        new TableCell({
                          children: [new Paragraph(text)],
                          shading: { fill: '2E7D32' },
                        })
                      ),
                    }),
                    // Data Rows
                    ...excessParts.slice(0, 50).map(r => 
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(r.partNumber)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.partDesc)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.category)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(formatWordNumber(r.partPrice))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.stockQty.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.phyQty.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph((r.dmgQty || 0).toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph((r.p41 || 0).toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.finalPhy.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph('+' + r.diff)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(formatWordNumber(r.stockValue))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(formatWordNumber(r.phyValue))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph('EXCESS')], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          new TableCell({ children: [new Paragraph(r.spmRemark || '')], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
        ],
      })
    ),
  ],
  width: { size: 100, type: WidthType.PERCENTAGE },
}),
                ...(excessParts.length > 50 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `... and ${excessParts.length - 50} more items`,
                        italics: true,
                        size: 16,
                      }),
                    ],
                  }),
                ] : []),
                new Paragraph({ text: '' }),

                // Signatures
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Focus Auditor: ${focusName || '____________________'}    MOB: ${focusMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `SPM: ${spareMgrName || '____________________'}    MOB: ${spareMgrMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `WM/GM: ${wmGmName || '____________________'}    MOB: ${wmGmMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),

                // Page Break
                new Paragraph({ children: [new PageBreak()] }),
              ] : []),

              // ==================== PAGE 6: DEALER RE-AUDIT PARTS ====================
              ...(raRows.length > 0 ? [
                new Paragraph({
                  heading: 'Heading1',
                  children: [
                    new TextRun({
                      text: 'DEALER RE-AUDIT PARTS',
                      bold: true,
                      size: 36,
                      color: '1A237E',
                    }),
                  ],
                }),
                new Paragraph({ text: '' }),

                // Dealer Re-Audit Table
                new Table({
                  rows: [
                    // Header
                    new TableRow({
                      children: [
                        'Part No', 'Location', 'Description', 'Price',
                        'Final', 'Dealer', 'Remarks', 'Value'
                      ].map(text =>
                        new TableCell({
                          children: [new Paragraph(text)],
                          shading: { fill: 'EF6C00' },
                        })
                      ),
                    }),
                    // Data Rows
                    ...raRows.slice(0, 50).map(r => 
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(r.partNumber)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(r.location)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(r.partDesc)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(r.partPrice))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(r.finalCount.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(r.dealerCount.toString())], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(r.remarks)], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
            new TableCell({ children: [new Paragraph(formatWordNumber(r.value))], margins: { top: 40, bottom: 40, left: 40, right: 40 } }),
          ],
        })
      ),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }),
                ...(raRows.length > 50 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `... and ${raRows.length - 50} more items`,
                        italics: true,
                        size: 16,
                      }),
                    ],
                  }),
                ] : []),
                new Paragraph({ text: '' }),

                // Signatures
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `SCS Auditor: ${scsName || '____________________'}    MOB: ${scsMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `SPM: ${raSpmName || '____________________'}    MOB: ${raSpmMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `WM/GM: ${wmGmName || '____________________'}    MOB: ${raWmMob || ''}`,
                      size: 20,
                    }),
                  ],
                }),
              ] : []),

              // Footer Note
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Value @ NDP in Rs. | Part Lines & Quantity in Nos.',
                    size: 14,
                    color: '666666',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          },
        ],
      });

      // Generate and download the document
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `TATA_Audit_Report_${dealerName || 'Dealer'}_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (err: any) {
      alert('Word Document Error: ' + err.message);
      console.error('Word generation error:', err);
    } finally {
      setLoading(false);
    }
  };
  // ── RENDER HELPERS ─────────────────────
  const S = {
    overlay: { position: 'relative' as const, inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
    modal: { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '1120px', maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 30px 80px rgba(0,0,0,0.35)' },
    hdr: { background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`, color: '#fff', padding: '18px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    body: { overflowY: 'auto' as const, padding: '22px 26px', flex: 1, background: '#FAFAFA', marginTop: 10 },
    card: { background: '#fff', border: `1px solid ${NAVY_LIGHT}`, borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(26,35,126,0.08)' },
    secHdr: { fontSize: '14px', fontWeight: 700, color: NAVY, borderBottom: `3px solid ${NAVY}`, paddingBottom: '8px', marginBottom: '16px', letterSpacing: '0.5px' },
    row: { display: 'flex', gap: '14px', flexWrap: 'wrap' as const, marginBottom: '12px' },
    fg: { display: 'flex', flexDirection: 'column' as const, flex: 1, minWidth: '180px' },
    lbl: { fontSize: '10px', fontWeight: 700, color: '#4A5568', marginBottom: '3px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
    inp: { border: `1.5px solid ${NAVY_LIGHT}`, borderRadius: '8px', padding: '7px 11px', fontSize: '13px', outline: 'none', background: '#fff', width: '100%', boxSizing: 'border-box' as const },
    th: { background: NAVY, color: '#fff', padding: '8px 10px', textAlign: 'center' as const, fontWeight: 700, fontSize: '11px', border: `1px solid ${NAVY_DARK}`, whiteSpace: 'nowrap' as const },
    td: { padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, textAlign: 'center' as const, fontSize: '11px' },
    sigCard: { flex: 1, minWidth: '180px', border: `1.5px solid ${NAVY_LIGHT}`, borderRadius: '10px', padding: '12px', background: '#F8FAFC' },
    sigLbl: { fontSize: '10px', fontWeight: 700, color: NAVY, marginBottom: '5px', textTransform: 'uppercase' as const },
    dlBtn: { background: `linear-gradient(135deg, ${NAVY}, ${NAVY_DARK})`, color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 26px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: `0 4px 14px ${NAVY}80` },
    closeBtn: { background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', padding: '6px 14px', fontSize: '13px', fontWeight: 600 },
    uploadBtn: { background: NAVY, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' },
    note: { fontSize: '10px', color: '#64748B', fontStyle: 'italic' as const, textAlign: 'right' as const, marginTop: '4px' },
  };

  const Field = ({ label: lbl, value: v, onChange, placeholder = '' }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string }) => (
    <div style={S.fg}>
      <label style={S.lbl}>{lbl}</label>
      <input value={v} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={S.inp} />
    </div>
  );

  const SigPair = ({ title, name, setName, mob, setMob }: { title: string; name: string; setName: (s: string) => void; mob: string; setMob: (s: string) => void }) => (
    <div style={S.sigCard}>
      <div style={S.sigLbl}>{title}</div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" style={{ ...S.inp, marginBottom: '6px' }} />
      <input value={mob} onChange={e => setMob(e.target.value)} placeholder="MOB NO." style={S.inp} />
    </div>
  );

  const DataTable = ({ heads, rows, headerColor = NAVY, altBg = '#F8FAFC' }: { heads: string[]; rows: (string | number)[][]; headerColor?: string; altBg?: string }) => (
    <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
          <tr>{heads.map(h => <th key={h} style={{ ...S.th, background: headerColor }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : altBg }}>
              {r.map((cell, j) => <td key={j} style={S.td}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const pct = (n: number, t: number) => t > 0 ? formatPercent((n / t) * 100) : '0%';

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* ── HEADER ── */}
        <div style={S.hdr}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>Post Audit Document</div>
            <div style={{ fontSize: '11.5px', opacity: 0.85, marginTop: '2px' }}>Focus Engineering — TATA Dealership Audit</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button style={S.dlBtn} onClick={downloadPDF} disabled={loading}>
              {loading ? '⏳ Generating…' : '📄 Download PDF'}
            </button>
            <button
              style={{ ...S.dlBtn, background: 'linear-gradient(135deg, #2E7D32, #1B5E20)' }}
              onClick={downloadWordDocx}
              disabled={loading}
            >
              {loading ? '⏳ Generating…' : '📝 Download Word'}
            </button>
            {onClose && <button style={S.closeBtn} onClick={onClose}>✕ Close</button>}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={S.body}>

          {/* ① SUPERVISOR DETAILS */}
          <div style={S.card}>
            <div style={S.secHdr}>① AUDIT SUPERVISOR DETAILS</div>
            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic', marginBottom: '10px' }}>(To be filled by Audit Supervisor)</div>
            <div style={S.row}>
              <Field label="Dealer Name" value={dealerName} onChange={setDealerName} placeholder="Enter dealer name" />
              <Field label="Location" value={location} onChange={setLocation} placeholder="Enter location" />
              <Field label="Brand Name" value={brandName} onChange={setBrandName} placeholder="TATA" />
            </div>
          </div>

          {/* ② DEALER RE-AUDIT SUMMARY */}
          <div style={S.card}>
            <div style={S.secHdr}>② DEALER RE-AUDIT SUMMARY</div>
            <div style={{ overflowX: 'auto', marginBottom: '14px', border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr>
                    {['No of Items', 'Value', 'Ok Items', 'Ok Value', 'Not Ok', 'Not Ok Value', 'Ok %', 'Not Ok %'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {[
                      raSummary.total,
                      formatNumber(raSummary.totalVal),
                      raSummary.ok,
                      formatNumber(raSummary.okVal),
                      raSummary.notOk,
                      formatNumber(raSummary.notOkVal),
                      pct(raSummary.ok, raSummary.total),
                      pct(raSummary.notOk, raSummary.total),
                    ].map((v, i) => <td key={i} style={{ ...S.td, background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>{v}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Undefined Parts */}
            <div style={{ background: '#F8FAFC', border: `1px solid ${NAVY_LIGHT}`, borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: NAVY, marginBottom: '6px' }}>● UNDEFINED PARTS</div>
              <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>Have you taken deadline date from SPM for defining undefined parts? If yes please mention date in below remarks.</div>
              <Field label="Remarks" value={undefinedRemarks} onChange={setUndefinedRemarks} />
            </div>

            {/* Multi-Location */}
            <div style={{ background: '#F8FAFC', border: `1px solid ${NAVY_LIGHT}`, borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '12px', color: NAVY, marginBottom: '8px' }}>● MULTI-LOCATION PARTS</div>
              <div style={{ maxWidth: '320px' }}>
                <Field label="Multi Location Corrected Count" value={multiLocCount} onChange={setMultiLocCount} placeholder="Enter count" />
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '5px', fontStyle: 'italic' }}>Note: Multilocation corrected to the extent possible during the audit</div>
            </div>
          </div>
          <div style={S.card}>
            <div style={S.secHdr}>AUDIT SUPERVISOR & MANAGER SIGNATURES</div>
            <div style={S.row}>
              <Field label="Audit Supervisor Name & Sign" value={auditSupervisor} onChange={setAuditSupervisor} placeholder="Enter name" />
              <Field label="SPM Name & Sign" value={spmSig} onChange={setSpmSig} placeholder="Enter name" />
              <Field label="Owner/VP/GM/WM Name & Sign" value={ownerSig} onChange={setOwnerSig} placeholder="Enter name" />
            </div>
          </div>

          <div style={S.card}>
            <div style={S.secHdr}>ACKNOWLEDGEMENT LETTER</div>
            <div style={S.row}>
              <Field label="Dealership Name" value={dealerName} onChange={setDealerName} placeholder="Enter dealership name" />
              <Field label="SPM Name" value={spareMgrName} onChange={setSpareMgrName} placeholder="Enter SPM name" />
            </div>

            <div style={{ background: '#F8FAFC', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>Acknowledgement Points:</p>
              <ul style={{ fontSize: '11px', lineHeight: '1.6', color: '#334155', paddingLeft: '20px' }}>
                <li>All parts which store had given to workshop physically or to some other location is issued in system also.</li>
                <li>All Parts which are issued in system stock is issued physically also to the workshop.</li>
                <li>No inwarding was done in audit duration, if any inwarding done for emergency same is issued in system or it had been counted by Focus Engineering team.</li>
                <li>If any part physically given but not issued in system for some specific reason, In that case I had given pending for issue parts to auditor for adding in physical quantity.</li>
                <li>I (Dealership Team) hereby declared all area at our audit location is shown to the Focus Engineering Audit Team and those are Audited/Verified by the Focus Engineering Audit Team.</li>
              </ul>
            </div>

            <div style={S.row}>
              <Field label="Audit Supervisor Name & Sign" value={auditSupervisor} onChange={setAuditSupervisor} placeholder="Enter name" />
              <Field label="SPM Name & Sign" value={spmSig} onChange={setSpmSig} placeholder="Enter name" />
            </div>
          </div>

          {/* ③ WWSIA SUMMARY */}
          <div style={S.card}>
            <div style={S.secHdr}>③ WWSIA SUMMARY</div>
            <div style={S.row}>
              <Field label="Dealership Name" value={dealerName} onChange={setDealerName} />
              <Field label="Location" value={location} onChange={setLocation} />
              <Field label="Audit Start Date" value={auditStartDate} onChange={() => { }} placeholder="DD-MM-YYYY" />
              <Field label="Audit Closed Date" value={auditEndDate} onChange={() => { }} placeholder="DD-MM-YYYY" />
            </div>

            {summaryData.length > 0 ? (
              <>
                <div style={{ overflowX: 'auto', border: `1px solid ${BORDER_COLOR}`, borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ background: '#78350F', color: '#fff', padding: '8px 10px', border: '1px solid #5C2E0A', verticalAlign: 'middle' }}>Category</th>
                        <th colSpan={3} style={{ background: '#1D4ED8', color: '#fff', padding: '8px 10px', border: '1px solid #1E3A8A' }}>DMS Stock</th>
                        <th colSpan={3} style={{ background: '#166534', color: '#fff', padding: '8px 10px', border: '1px solid #14532D' }}>Physical Stock</th>
                        <th colSpan={2} style={{ background: '#15803D', color: '#fff', padding: '8px 10px', border: '1px solid #166534' }}>Excess</th>
                        <th colSpan={2} style={{ background: '#DC2626', color: '#fff', padding: '8px 10px', border: '1px solid #B91C1C' }}>Short</th>
                        <th colSpan={2} style={{ background: '#7C3AED', color: '#fff', padding: '8px 10px', border: '1px solid #6D28D9' }}>Net Diff</th>
                      </tr>
                      <tr>
                        {['Value', 'Lines', 'Qty', 'Value', 'Lines', 'Qty', 'Value', 'Lines', 'Value', 'Lines', 'Value', 'Diff %'].map(h => (
                          <th key={h} style={{ background: '#F97316', color: '#fff', padding: '6px 8px', border: '1px solid #EA580C', fontSize: '10px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.filter((r, i) => i === summaryData.length - 1 || r.dmsValue !== 0 || r.physicalValue !== 0 || r.excessValue !== 0 || r.shortValue !== 0).map((r, i) => (
                        <tr key={i} style={{ background: r.category === 'Total' ? '#FFF3E0' : i % 2 === 0 ? '#fff' : '#FEF9F3' }}>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, fontWeight: r.category === 'Total' ? 700 : 600, textAlign: 'left' }}>{r.category}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}` }}>{formatNumber(r.dmsValue)}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}` }}>{r.dmsPartLines}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}` }}>{r.dmsQuantity}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}` }}>{formatNumber(r.physicalValue)}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}` }}>{r.physicalPartLines}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}` }}>{r.physicalQuantity}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, color: '#16A34A', fontWeight: r.excessValue > 0 ? 700 : 400 }}>{formatNumber(r.excessValue)}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, color: '#16A34A' }}>{r.excessPartLines}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, color: '#DC2626', fontWeight: r.shortValue > 0 ? 700 : 400 }}>{formatNumber(r.shortValue)}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, color: '#DC2626' }}>{r.shortPartLines}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, color: r.netDifferenceValue >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>{formatNumber(Math.abs(r.netDifferenceValue))}</td>
                          <td style={{ padding: '6px 8px', border: `1px solid ${BORDER_COLOR}`, color: r.netDifferencePercent >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>{formatPercent(r.netDifferencePercent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={S.note}>(Value @ NDP in Rs. | Part Lines & Quantity in Nos.)</p>
              </>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: '8px' }}>Summary data will appear here after generating the compile report.</div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
              <SigPair title="Focus Auditor" name={focusName} setName={setFocusName} mob={focusMob} setMob={setFocusMob} />
              <SigPair title="SPM" name={spareMgrName} setName={setSpareMgrName} mob={spareMgrMob} setMob={setSpareMgrMob} />
              <SigPair title="WM/GM" name={wmGmName} setName={setWmGmName} mob={wmGmMob} setMob={setWmGmMob} />
            </div>
          </div>

          {/* ④ SHORTAGE PARTS */}
          <div style={S.card}>
            <div style={S.secHdr}>④ SHORTAGE PARTS</div>
            {shortageParts.length > 0 ? (
              <>
                <DataTable
                  heads={['Part No', 'Description', 'Category', 'Price', 'Stock', 'Phy', 'Dmg', 'P41', 'Final', 'Diff', 'Stock Val', 'Phy Val', 'Type', 'Remark', 'Location']}
                  rows={shortageParts.map(r => [
                    r.partNumber, r.partDesc, r.category, formatNumber(r.partPrice),
                    r.stockQty, r.phyQty, r.dmgQty || 0, r.p41 || 0, r.finalPhy, r.diff,
                    formatNumber(r.stockValue), formatNumber(r.phyValue), 'SHORT', r.spmRemark || '', r.location || ''
                  ])}
                  headerColor={HEADER_COLORS.danger} altBg='#FFEBEE'
                />
                <p style={S.note}>(Value @ NDP in Rs. | Part Lines & Quantity in Nos.)</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <SigPair title="Focus Auditor" name={focusName} setName={setFocusName} mob={focusMob} setMob={setFocusMob} />
                  <SigPair title="SPM" name={spareMgrName} setName={setSpareMgrName} mob={spareMgrMob} setMob={setSpareMgrMob} />
                  <SigPair title="WM/GM" name={wmGmName} setName={setWmGmName} mob={wmGmMob} setMob={setWmGmMob} />
                </div>
              </>
            ) : <div style={{ padding: '18px', textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: '8px' }}>No shortage parts in current report.</div>}
          </div>

          {/* ⑤ EXCESS PARTS */}
          <div style={S.card}>
            <div style={S.secHdr}>⑤ EXCESS PARTS</div>
            {excessParts.length > 0 ? (
              <>
                <DataTable
                  heads={['Part No', 'Description', 'Category', 'Price', 'Stock', 'Phy', 'Dmg', 'P41', 'Final', 'Diff', 'Stock Val', 'Phy Val', 'Type', 'Remark', 'Location']}
                  rows={excessParts.map(r => [
                    r.partNumber, r.partDesc, r.category, formatNumber(r.partPrice),
                    r.stockQty, r.phyQty, r.dmgQty || 0, r.p41 || 0, r.finalPhy, '+' + r.diff,
                    formatNumber(r.stockValue), formatNumber(r.phyValue), 'EXCESS', r.spmRemark || '', r.location || ''
                  ])}
                  headerColor={HEADER_COLORS.success} altBg='#E8F5E9'
                />
                <p style={S.note}>(Value @ NDP in Rs. | Part Lines & Quantity in Nos.)</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
                  <SigPair title="Focus Auditor" name={focusName} setName={setFocusName} mob={focusMob} setMob={setFocusMob} />
                  <SigPair title="SPM" name={spareMgrName} setName={setSpareMgrName} mob={spareMgrMob} setMob={setSpareMgrMob} />
                  <SigPair title="WM/GM" name={wmGmName} setName={setWmGmName} mob={wmGmMob} setMob={setWmGmMob} />
                </div>
              </>
            ) : <div style={{ padding: '18px', textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: '8px' }}>No excess parts in current report.</div>}
          </div>

          {/* ⑥ DEALER RE-AUDIT PARTS */}
          <div style={S.card}>
            <div style={S.secHdr}>⑥ DEALER RE-AUDIT PARTS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginBottom: '6px' }}>
                  Upload Excel with columns: <strong>Part Number, Location, Part Desc, Part Price, Final Count, Dealer Count, Remarks, Value</strong>
                </div>
                <label style={S.uploadBtn as React.CSSProperties}>
                  📂 Upload Dealer Re-Audit Excel
                  <input type="file" accept=".xlsx,.xls" hidden onChange={handleUpload} />
                </label>
              </div>
              {raFileName && (
                <div style={{ fontSize: '12px', color: '#2E7D32', fontWeight: 600 }}>
                  ✅ {raFileName} — {raRows.length} rows loaded
                </div>
              )}
            </div>

            {raRows.length > 0 ? (
              <DataTable
                heads={['Part No', 'Location', 'Description', 'Price', 'Final', 'Dealer', 'Remarks', 'Value']}
                rows={raRows.map(r => [
                  r.partNumber, r.location, r.partDesc, formatNumber(r.partPrice),
                  r.finalCount, r.dealerCount, r.remarks, formatNumber(r.value)
                ])}
                headerColor={HEADER_COLORS.warning} altBg='#FFF3E0'
              />
            ) : (
              <div style={{ padding: '28px', textAlign: 'center', color: '#9CA3AF', background: '#F9FAFB', borderRadius: '8px', border: `2px dashed ${BORDER_COLOR}` }}>
                Upload an Excel file to populate the dealer re-audit table
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
              <SigPair title="SCS Auditor" name={scsName} setName={setScsName} mob={scsMob} setMob={setScsMob} />
              <SigPair title="SPM" name={raSpmName} setName={setRaSpmName} mob={raSpmMob} setMob={setRaSpmMob} />
              <SigPair title="WM/GM" name={wmGmName} setName={setWmGmName} mob={raWmMob} setMob={setRaWmMob} />
            </div>
          </div>

          {/* ⑦ POST AUDIT SIGNATURES */}
          <div style={S.card}>
            <div style={S.secHdr}>⑦ POST AUDIT SIGNATURES</div>
            <div style={S.row}>
              <Field label="Audit Supervisor" value={auditSupervisor} onChange={setAuditSupervisor} placeholder="Name" />
              <Field label="SPM" value={spmSig} onChange={setSpmSig} placeholder="Name" />
              <Field label="Owner/GM/WM" value={ownerSig} onChange={setOwnerSig} placeholder="Name" />
            </div>
          </div>

          {/* FINAL CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '12px' }}>
            <button style={{ ...S.dlBtn, padding: '14px 40px', fontSize: '15px' }} onClick={downloadPDF} disabled={loading}>
              {loading ? '⏳ Generating PDF…' : '⬇ Download Post Audit Document PDF'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PostAuditDocument;