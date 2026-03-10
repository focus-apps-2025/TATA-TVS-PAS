// src/pages/TataFinalReport.tsx
import React, { useState, useCallback, useEffect, useRef, type ChangeEvent, type DragEvent } from 'react';
import ExcelJS from 'exceljs';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  IconButton,
  Chip,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Breadcrumbs,
  Link,
  Avatar,
  Divider,
  Stack,
  useTheme,
  useMediaQuery,
  alpha,
  Tooltip,
  Fade,
  Zoom,
  CircularProgress,
  LinearProgress,

} from '@mui/material';
import {
  UploadFile,
  Download,
  CompareArrows,
  Info,
  Delete,
  NavigateNext,
  Person,
  AdminPanelSettings,
  Dashboard as DashboardIcon,
  CheckCircle,
  Warning,
  Description,
  Inventory,
  Assessment,
  CloudUpload,
  RestartAlt,
  SaveAlt,
  DirectionsCar,
  TableChart,
  Summarize,
  ArrowBack,
  PictureAsPdf
} from '@mui/icons-material';
import { DataGrid, type GridRowModel } from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ProfessionalCard from '../components/common/ProfessionalCard';
import StatsCard from '../components/common/StatsCard';
import PostAuditDocument from './Postauditdocument';
import Logo from '../assets/images/Focus_logo.png';



// ============================================
// TATA-SPECIFIC TYPE DEFINITIONS
// ============================================
interface CountSheetRow {
  sNo: number;
  date: string;
  site: string;
  productCategory: string;
  location: string;
  partNo: string;
  qty: number;
  mrp: number;
  materialDescription: string;
  remark: string;
  scannedBy: string;
  timestamp: string;
  finalQty?: number;
}

interface AfterSheetRow {
  partnumber: string;
  location: string;
  partdesc: string;
  partPrice: number;
  count: number;
  category: string;
}

interface OnHandSheetRow {
  partNumber: string;
  description: string;
  qty: number;
  weightedAverage: number;
  totalPrice: number;
  inventoryLocation: string;
  status: string;
  location1: string;
  location2: string;
  location3: string;
  productCategory: string;
}

interface CompileReportRow {
  partNumber: string;
  oemPart: string;
  partDescription: string;
  category: string;
  partPrice: number;
  stockQty: number;
  phyQty: number;
  dmgQty: number;
  p4i: number;
  finalPhy: number;
  diff: number;
  stockValue: number;
  phyValue: number;
  shortExcess: number;
}

interface SummaryRow {
  category: string;
  // DMS Stock
  dmsValue: number;
  dmsPartLines: number;
  dmsQuantity: number;
  // Physical Stock as Counted
  physicalValue: number;
  physicalPartLines: number;
  physicalQuantity: number;
  // Excess Found
  excessValue: number;
  excessPartLines: number;
  // Short Found
  shortValue: number;
  shortPartLines: number;
  // Net Difference
  netDifferenceValue: number;
  netDifferencePercent: number;
}

// ============================================
// STYLED COMPONENTS (Same as TVS)
// ============================================
const UploadCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  background: '#ffffff',
  cursor: 'pointer',
  borderRadius: '24px',
  border: '2px dashed #CBD5E1',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  '&:hover': {
    transform: 'translateY(-5px)',
    borderColor: '#D35400',
    backgroundColor: '#FEF9F3',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    '& .upload-icon': {
      transform: 'scale(1.1) rotate(5deg)',
      color: '#D35400'
    }
  }
}));

const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #D35400 0%, #A04000 100%)',
  minHeight: '260px',
  padding: theme.spacing(10, 0),
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(6, 0),
    minHeight: '200px',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 40%)',
    pointerEvents: 'none',
  },
}));

const StyledStepper = styled(Stepper)(({ theme }) => ({
  background: 'white',
  padding: theme.spacing(3),
  borderRadius: '20px',
  boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
  '& .MuiStepIcon-root.Mui-active': {
    color: '#D35400',
  },
  '& .MuiStepIcon-root.Mui-completed': {
    color: '#10B981',
  },
  '& .MuiStepLabel-label': {
    fontWeight: 600,
  }
}));

const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: '#F8FAFC',
    borderBottom: '1px solid #E2E8F0',
    fontWeight: 700,
  },
  '& .MuiDataGrid-cell': {
    borderBottom: '1px solid #F1F5F9',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: '#F8FAFC',
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  textTransform: 'none',
  fontWeight: 600,
  padding: '8px 20px',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  '&.Mui-disabled': {
    backgroundColor: '#E2E8F0',
    color: '#94A3B8',
  }
}));

const FilePreview = ({ title, fileName, onClear }: { title: string, fileName: string, onClear: (e: React.MouseEvent) => void }) => (
  <Paper sx={{ p: 2, borderRadius: '16px', bgcolor: '#FEF9F3', border: '1px solid #F0CAA0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Description sx={{ color: '#D35400' }} />
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{title}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }} noWrap>{fileName}</Typography>
      </Box>
    </Box>
    <IconButton size="small" onClick={onClear} sx={{ color: '#EF4444' }}>
      <Delete fontSize="small" />
    </IconButton>
  </Paper>
);

// ============================================
// MAIN COMPONENT
// ============================================
const TataFinalReport: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const tataPrimaryColor = '#D35400';
  const tataSecondaryColor = '#E67E22';

  // File upload states
  const [countSheetData, setCountSheetData] = useState<any[][] | null>(null);
  const [afterSheetData, setAfterSheetData] = useState<any[][] | null>(null);
  const [onHandSheetData, setOnHandSheetData] = useState<any[][] | null>(null);
  const [countFileName, setCountFileName] = useState<string>('');
  const [afterFileName, setAfterFileName] = useState<string>('');
  const [onHandFileName, setOnHandFileName] = useState<string>('');

  // Processed data
  const [consolidatedCountSheet, setConsolidatedCountSheet] = useState<CountSheetRow[]>([]);
  const [compileReport, setCompileReport] = useState<CompileReportRow[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
  const [damageParts, setDamageParts] = useState<any[]>([]);
  const [excessParts, setExcessParts] = useState<CompileReportRow[]>([]);
  const [shortageParts, setShortageParts] = useState<CompileReportRow[]>([]);

  // UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Form fields
  const [dealerName, setDealerName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');
  const [reportTitle, setReportTitle] = useState<string>('');

  const steps = ['Upload Files', 'Consolidate Count Sheet', 'Generate Final Report'];

  const [showPostAudit, setShowPostAudit] = useState<boolean>(false);




  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const findColumnIndex = (headers: any[], possibleNames: string[]): number => {
    if (!headers || headers.length === 0) return -1;

    const headerStrings = headers.map(h =>
      String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    for (let name of possibleNames) {
      const searchName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (let i = 0; i < headerStrings.length; i++) {
        const header = headerStrings[i];
        if (header.includes(searchName) || searchName.includes(header)) {
          console.log(`Found "${name}" at index ${i} (header: "${headers[i]}")`);
          return i;
        }
      }
    }

    // If still not found, try a more aggressive search
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '').toLowerCase();
      for (let name of possibleNames) {
        const searchName = name.toLowerCase();
        if (header.includes(searchName) || searchName.includes(header)) {
          console.log(`Found "${name}" at index ${i} (header: "${headers[i]}")`);
          return i;
        }
      }
    }

    return -1;
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>, fileType: string): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    if (fileType === 'count') {
      setCountFileName(file.name);
    } else if (fileType === 'after') {
      setAfterFileName(file.name);
    } else if (fileType === 'onhand') {
      setOnHandFileName(file.name);
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        console.log(`=== ${fileType.toUpperCase()} FILE STRUCTURE ===`);
        console.log('Rows:', jsonData.length);
        if (jsonData.length > 0) {
          console.log('Headers:', jsonData[0]);
          console.log('First data row:', jsonData[1]);
        }

        if (fileType === 'count') {
          setCountSheetData(jsonData as any[][]);
          setSuccess(`Count Sheet uploaded: ${jsonData.length} rows`);
        } else if (fileType === 'after') {
          setAfterSheetData(jsonData as any[][]);
          setSuccess(`After Sheet uploaded: ${jsonData.length} rows`);
        } else if (fileType === 'onhand') {
          setOnHandSheetData(jsonData as any[][]);
          setSuccess(`OnHand Sheet uploaded: ${jsonData.length} rows`);
        }

      } catch (err: any) {
        setError(`Error reading ${fileType} file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearFile = (fileType: string): void => {
    if (fileType === 'count') {
      setCountSheetData(null);
      setCountFileName('');
    } else if (fileType === 'after') {
      setAfterSheetData(null);
      setAfterFileName('');
    } else if (fileType === 'onhand') {
      setOnHandSheetData(null);
      setOnHandFileName('');
    }
    setError('');
    setSuccess('');
  };

  const resetAll = (): void => {
    setCountSheetData(null);
    setAfterSheetData(null);
    setOnHandSheetData(null);
    setCountFileName('');
    setAfterFileName('');
    setOnHandFileName('');
    setConsolidatedCountSheet([]);
    setCompileReport([]);
    setSummaryData([]);
    setDamageParts([]);
    setExcessParts([]);
    setShortageParts([]);
    setCurrentStep(0);
    setError('');
    setSuccess('');
    setDealerName('');
    setLocation('');
    setAuditStartDate('');
    setAuditEndDate('');
    setReportTitle('');
  };

  const cleanPartNumber = (raw: any): string => {
    if (raw === null || raw === undefined) return '';

    // Convert to string and trim
    let str = String(raw).trim();

    // Remove any non-alphanumeric characters except dots, dashes, and forward slashes
    str = str.replace(/[^\w\s./-]/g, '');

    // Replace multiple spaces with single space
    str = str.replace(/\s+/g, ' ');

    // Convert to uppercase
    return str.toUpperCase();
  };

  // ============================================
  // STEP 1: CONSOLIDATE COUNT SHEET (FIXED)
  // ============================================
  const consolidateCountSheet = (): void => {
    if (!countSheetData || !afterSheetData) {
      setError('Please upload both Count Sheet and After Sheet.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    setTimeout(() => {
      try {
        console.log('=== STARTING COUNT SHEET CONSOLIDATION ===');

        // Filter out completely empty rows
        const cleanCountData = countSheetData.filter(row =>
          row && row.length > 0 && row.some(cell =>
            cell !== null && cell !== undefined && String(cell).trim() !== ''
          )
        );

        const cleanAfterData = afterSheetData.filter(row =>
          row && row.length > 0 && row.some(cell =>
            cell !== null && cell !== undefined && String(cell).trim() !== ''
          )
        );

        // Find header row for Count Sheet
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(10, cleanCountData.length); i++) {
          const row = cleanCountData[i];
          const nonEmptyCells = row.filter(cell =>
            cell !== null && cell !== undefined && String(cell).trim() !== ''
          ).length;
          if (nonEmptyCells >= 3) {
            headerRowIndex = i;
            break;
          }
        }

        const countHeaders = cleanCountData[headerRowIndex] || [];
        const afterHeaders = cleanAfterData[0] || [];

        // Find Count Sheet columns
        const countPartNoIndex = findColumnIndex(countHeaders, [
          'partno', 'part no', 'part number', 'part #', 'item code',
          'code', 'item no', 'partcode', 'material no'
        ]);

        const countQtyIndex = findColumnIndex(countHeaders, [
          'qty', 'quantity', 'count', 'stock', 'phyqty', 'physical qty'
        ]);

        const countLocationIndex = findColumnIndex(countHeaders, [
          'location', 'bin', 'storage', 'rack', 'shelf'
        ]);

        // 🔴 IMPORTANT: Get MRP/Price from COUNT SHEET, not After Sheet!
        const countPriceIndex = findColumnIndex(countHeaders, [
          'mrp', 'price', 'cost', 'rate', 'unit price',
          'net price', 'dealer price', 'amount', 'value', 'NDP'
        ]);

        const countDescIndex = findColumnIndex(countHeaders, [
          'description', 'material description', 'part description'
        ]);

        const countCategoryIndex = findColumnIndex(countHeaders, [
          'category', 'product category', 'item category'
        ]);

        const countRemarkIndex = findColumnIndex(countHeaders, [
          'remark', 'remarks', 'notes', 'comment'
        ]);

        console.log('=== COUNT SHEET INDICES ===');
        console.log('Part Number Index:', countPartNoIndex);
        console.log('Quantity Index:', countQtyIndex);
        console.log('Location Index:', countLocationIndex);
        console.log('🔴 PRICE/MRP Index:', countPriceIndex, '-> Header:', countPriceIndex !== -1 ? countHeaders[countPriceIndex] : 'NOT FOUND');
        console.log('Description Index:', countDescIndex);
        console.log('Category Index:', countCategoryIndex);
        console.log('Remark Index:', countRemarkIndex);

        if (countPartNoIndex === -1 || countQtyIndex === -1 || countLocationIndex === -1) {
          throw new Error('Could not find required columns (Part No, Qty, Location) in Count Sheet');
        }

        // Find After Sheet columns - ONLY for subtraction!
        const afterPartNoIndex = findColumnIndex(afterHeaders, [
          'partnumber', 'part no', 'part number', 'part #',
          'item code', 'code', 'material no'
        ]);

        const afterLocationIndex = findColumnIndex(afterHeaders, [
          'location', 'bin', 'storage', 'rack', 'shelf'
        ]);

        // After Sheet "Final Qty" is the QUANTITY TO SUBTRACT
        const afterFinalQtyIndex = findColumnIndex(afterHeaders, [
          'final qty', 'finalqty', 'qty to subtract', 'subtract qty',
          'adjustment', 'deduction', 'remove qty', 'sold qty'
        ]);

        console.log('=== AFTER SHEET INDICES ===');
        console.log('After Part Number Index:', afterPartNoIndex);
        console.log('After Location Index:', afterLocationIndex);
        console.log('After Final Qty Index (QTY TO SUBTRACT):', afterFinalQtyIndex);

        // 🔴 Create After Map ONLY for quantity subtraction
        const afterSubtractionMap = new Map<string, number>(); // key: "partNo|location", value: qtyToSubtract

        if (afterPartNoIndex !== -1 && afterLocationIndex !== -1 && afterFinalQtyIndex !== -1) {
          for (let i = 1; i < cleanAfterData.length; i++) {
            const row = cleanAfterData[i];
            if (!row || row[afterPartNoIndex] === undefined ||
              row[afterLocationIndex] === undefined || row[afterFinalQtyIndex] === undefined) continue;

            const rawPartNo = row[afterPartNoIndex];
            const rawLocation = row[afterLocationIndex];

            if (!rawPartNo || String(rawPartNo).trim() === '' ||
              !rawLocation || String(rawLocation).trim() === '') {
              continue;
            }

            const partNo = cleanPartNumber(rawPartNo);
            const location = String(rawLocation).trim().toUpperCase();

            if (!partNo) continue;

            // Create composite key
            const mapKey = `${partNo}|${location}`;

            // Get quantity to subtract
            const qtyToSubtract = parseFloat(row[afterFinalQtyIndex]) || 0;

            if (qtyToSubtract > 0) {
              afterSubtractionMap.set(mapKey, qtyToSubtract);
            }
          }
        }

        console.log(`After Subtraction Map created with ${afterSubtractionMap.size} entries`);

        // Process Count Sheet
        const consolidatedRows: CountSheetRow[] = [];
        let rowNumber = 1;
        let totalOriginalQty = 0;
        let totalFinalQty = 0;
        let totalSubtracted = 0;
        let matchesFound = 0;

        for (let i = headerRowIndex + 1; i < cleanCountData.length; i++) {
          const row = cleanCountData[i];
          if (!row || row.length <= Math.max(countPartNoIndex, countQtyIndex, countLocationIndex)) continue;

          const rawPartNo = row[countPartNoIndex];
          const rawQty = row[countQtyIndex];
          const rawLocation = row[countLocationIndex];

          if (!rawPartNo || String(rawPartNo).trim() === '' ||
            !rawLocation || String(rawLocation).trim() === '') {
            continue;
          }

          const partNo = cleanPartNumber(rawPartNo);
          const location = String(rawLocation).trim().toUpperCase();
          const countSheetQty = parseFloat(rawQty) || 0;
          totalOriginalQty += countSheetQty;

          //  Get PRICE from COUNT SHEET (MRP column)
          let price = 0;
          if (countPriceIndex !== -1 && row[countPriceIndex] !== undefined) {
            const priceValue = row[countPriceIndex];
            if (typeof priceValue === 'number') {
              price = priceValue;
            } else if (typeof priceValue === 'string') {
              const cleanedPrice = priceValue.replace(/[₹$€£,]/g, '').trim();
              price = parseFloat(cleanedPrice) || 0;
            }
          }

          // Create composite key for matching
          const mapKey = `${partNo}|${location}`;

          // Check if we need to subtract quantity
          let finalQty = countSheetQty;
          let subtractedQty = afterSubtractionMap.get(mapKey) || 0;

          if (subtractedQty > 0) {
            matchesFound++;
            finalQty = Math.max(0, countSheetQty - subtractedQty);
            totalSubtracted += subtractedQty;

            console.log(`[SUBTRACT] "${partNo}" at "${location}": ${countSheetQty} - ${subtractedQty} = ${finalQty}`);
          }

          totalFinalQty += finalQty;

          // Get other data from Count Sheet
          const description = countDescIndex !== -1 ? String(row[countDescIndex] || '').trim() : '';
          const category = countCategoryIndex !== -1 ? String(row[countCategoryIndex] || '').trim() : '';
          const remark = countRemarkIndex !== -1 ? String(row[countRemarkIndex] || '').trim() : '';

          // Add subtraction info to remark if applicable
          let finalRemark = remark;
          if (subtractedQty > 0) {
            finalRemark = `${remark ? remark + ' | ' : ''}Subtracted ${subtractedQty} based on After Sheet`;
          }

          consolidatedRows.push({
            sNo: rowNumber++,
            date: '',
            site: '',
            productCategory: category,
            location: location,
            partNo: partNo,
            qty: countSheetQty,
            mrp: price,  //  Price from Count Sheet MRP column
            materialDescription: description,
            remark: finalRemark,
            scannedBy: '',
            timestamp: '',
            finalQty: finalQty
          });
        }

        // Sort by Part Number
        consolidatedRows.sort((a, b) => a.partNo.localeCompare(b.partNo));

        // Reassign serial numbers
        consolidatedRows.forEach((row, index) => {
          row.sNo = index + 1;
        });

        console.log(`\n=== CONSOLIDATION SUMMARY ===`);
        console.log(`Total parts processed: ${consolidatedRows.length}`);
        console.log(`Total Original Quantity: ${totalOriginalQty}`);
        console.log(`Total Final Quantity: ${totalFinalQty}`);
        console.log(`Total Subtracted from After Sheet: ${totalSubtracted}`);
        console.log(`Part+Location matches found: ${matchesFound}`);
        console.log(`Parts with price > 0: ${consolidatedRows.filter(row => row.mrp > 0).length}`);

        setConsolidatedCountSheet(consolidatedRows);
        setCurrentStep(1);

        const successMsg = `✅ Count Sheet Consolidated Successfully!
      
📊 Quantity Analysis:
• Total Parts: ${consolidatedRows.length}
• Total Original Quantity: ${totalOriginalQty}
• Total Final Quantity: ${totalFinalQty}
• Total Quantity Subtracted: ${totalSubtracted}
• Matches Found: ${matchesFound}
• Parts with prices: ${consolidatedRows.filter(row => row.mrp > 0).length}

ℹ️ Note: Prices taken from Count Sheet MRP column, NOT from After Sheet.`;

        setSuccess(successMsg);
        setError('');

      } catch (err: any) {
        console.error('❌ Consolidation error:', err);
        setError(`Error consolidating Count Sheet: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 100);
  };
  // ============================================
  // STEP 2: GENERATE COMPILE REPORT
  // ============================================

  const generateCompileReport = (): void => {
    if (!onHandSheetData || consolidatedCountSheet.length === 0) {
      setError('Please upload OnHand Sheet and consolidate Count Sheet first.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    setTimeout(() => {
      try {
        console.log('\n🔍 === FINAL FIXED COMPILE REPORT WITH DUPLICATE HANDLING ===');

        const cleanOnHandData = onHandSheetData.filter(row =>
          row && row.length > 0
        );

        if (cleanOnHandData.length < 2) {
          throw new Error('OnHand Sheet must have at least one data row after headers');
        }

        const onHandHeaders = cleanOnHandData[0] || [];

        // Find OnHand columns
        const onHandPartNoIndex = findColumnIndex(onHandHeaders, [
          'part', 'partno', 'part no', 'part number', 'part #'
        ]);

        const onHandQtyIndex = findColumnIndex(onHandHeaders, [
          'qty', 'quantity', 'stock'
        ]);

        const onHandPriceIndex = findColumnIndex(onHandHeaders, [
          'weighted average', 'weightedaverage', 'avg price', 'average price'
        ]);

        const onHandDescIndex = findColumnIndex(onHandHeaders, [
          'description', 'desc'
        ]);

        const onHandCategoryIndex = findColumnIndex(onHandHeaders, [
          'category', 'product category'
        ]);

        // ============================================
        // STEP 1: Get Physical Data (with duplicate handling)
        // ============================================
        console.log('\n=== PHYSICAL DATA (From Count Sheet) - SUMMING DUPLICATES ===');
        const physicalMap = new Map<string, {
          qty: number,
          dmgQty: number,
          desc: string,
          category: string,
          price: number,
          locations: string[]  // Track locations for duplicates
        }>();

        consolidatedCountSheet.forEach(row => {
          const partNo = cleanPartNumber(row.partNo);
          if (!partNo) return;

          // Get price
          let price = 0;
          const mrpVal: any = row.mrp;
          if (mrpVal) {
            if (typeof mrpVal === 'string') {
              price = parseFloat((mrpVal as string).replace(/[₹$,]/g, '').trim()) || 0;
            } else if (typeof mrpVal === 'number') {
              price = mrpVal as number;
            }
          }

          // Get quantity
          const qty = row.finalQty || row.qty || 0;

          // Check damage
          const isDamaged = row.remark && row.remark.toLowerCase().includes('damaged');
          const dmgQty = isDamaged ? qty : 0;

          // 🔴 FIXED: Handle duplicates by SUMMING quantities
          if (physicalMap.has(partNo)) {
            // Part already exists - ADD to existing quantities
            const existing = physicalMap.get(partNo)!;
            physicalMap.set(partNo, {
              qty: existing.qty + qty,  // SUM the quantities
              dmgQty: existing.dmgQty + dmgQty,  // SUM damaged quantities
              desc: existing.desc || row.materialDescription || '',  // Keep first description
              category: existing.category || row.productCategory || '',  // Keep first category
              price: existing.price || price,  // Keep first price (or use max?)
              locations: [...existing.locations, row.location]  // Track all locations
            });
            console.log(`[DUPLICATE] "${partNo}" - Added qty ${qty}, Total now: ${existing.qty + qty}`);
          } else {
            // First occurrence of this part
            physicalMap.set(partNo, {
              qty: qty,
              dmgQty: dmgQty,
              desc: row.materialDescription || '',
              category: row.productCategory || '',
              price: price,
              locations: row.location ? [row.location] : []
            });
          }
        });

        console.log(`Physical parts after summing duplicates: ${physicalMap.size}`);

        // ============================================
        // STEP 2: Get DMS Data (with duplicate handling)
        // ============================================
        console.log('\n=== DMS DATA (From OnHand Sheet) - SUMMING DUPLICATES ===');
        const dmsMap = new Map<string, {
          qty: number,
          price: number,
          desc: string,
          category: string
        }>();

        for (let i = 1; i < cleanOnHandData.length; i++) {
          const row = cleanOnHandData[i];
          if (!row || row[onHandPartNoIndex] === undefined) continue;

          const rawPartNo = row[onHandPartNoIndex];
          if (!rawPartNo || String(rawPartNo).trim() === '') continue;

          const partNo = cleanPartNumber(rawPartNo);
          if (!partNo) continue;

          // Get DMS quantity
          const dmsQty = onHandQtyIndex !== -1 ? (parseFloat(row[onHandQtyIndex]) || 0) : 0;

          // Get DMS price
          let dmsPrice = 0;
          if (onHandPriceIndex !== -1 && row[onHandPriceIndex] !== undefined) {
            const priceValue = row[onHandPriceIndex];
            if (typeof priceValue === 'number') {
              dmsPrice = priceValue;
            } else if (typeof priceValue === 'string') {
              dmsPrice = parseFloat(priceValue.replace(/[₹$,]/g, '').trim()) || 0;
            }
          }

          const dmsDesc = onHandDescIndex !== -1 ? String(row[onHandDescIndex] || '').trim() : '';
          const dmsCategory = onHandCategoryIndex !== -1 ? String(row[onHandCategoryIndex] || '').trim() : '';

          // 🔴 FIXED: Handle duplicates in DMS data by SUMMING
          if (dmsMap.has(partNo)) {
            const existing = dmsMap.get(partNo)!;
            dmsMap.set(partNo, {
              qty: existing.qty + dmsQty,  // SUM the quantities
              price: existing.price || dmsPrice,  // Keep first price
              desc: existing.desc || dmsDesc,  // Keep first description
              category: existing.category || dmsCategory  // Keep first category
            });
            console.log(`[DMS DUPLICATE] "${partNo}" - Added qty ${dmsQty}, Total now: ${existing.qty + dmsQty}`);
          } else {
            dmsMap.set(partNo, {
              qty: dmsQty,
              price: dmsPrice,
              desc: dmsDesc,
              category: dmsCategory
            });
          }
        }

        console.log(`DMS parts after summing duplicates: ${dmsMap.size}`);

        // ============================================
        // STEP 3: CREATE COMPILE REPORT WITH CORRECT CALCULATIONS
        // ============================================
        console.log('\n=== CREATING FINAL REPORT ===');
        const compileReportRows: CompileReportRow[] = [];

        // Get ALL unique parts (using Map keys which are now unique after summing)
        const allParts = new Set<string>();
        physicalMap.forEach((_, partNo) => allParts.add(partNo));
        dmsMap.forEach((_, partNo) => allParts.add(partNo));

        console.log(`Total unique parts after duplicate summing: ${allParts.size}`);

        let matchedBoth = 0;
        let physicalOnly = 0;
        let dmsOnly = 0;

        // Process each part
        Array.from(allParts).sort().forEach((partNo, idx) => {
          const physical = physicalMap.get(partNo);
          const dms = dmsMap.get(partNo);

          // ============================================
          // CASE 1: PART IN BOTH PHYSICAL AND DMS (MATCHED)
          // ============================================
          if (physical && dms) {
            matchedBoth++;

            // Use Physical description and price for matched parts
            const partDescription = physical.desc || dms.desc || '';
            const category = physical.category || dms.category || '';
            const partPrice = physical.price || dms.price || 0;
            const stockQty = dms.qty || 0;      // From DMS (already summed)
            const phyQty = physical.qty || 0;   // From Physical (already summed)
            const dmgQty = physical.dmgQty || 0;

            const finalPhy = phyQty;
            const diff = finalPhy - stockQty;
            const stockValue = stockQty * partPrice;
            const phyValue = finalPhy * partPrice;
            const shortExcess = diff * partPrice;

            compileReportRows.push({
              partNumber: partNo,
              oemPart: partNo,
              partDescription: partDescription,
              category: category,
              partPrice: partPrice,
              stockQty: stockQty,
              phyQty: phyQty,
              dmgQty: dmgQty,
              p4i: 0,
              finalPhy: finalPhy,
              diff: diff,
              stockValue: stockValue,
              phyValue: phyValue,
              shortExcess: shortExcess
            });

            // Debug first 3 matched parts
            if (matchedBoth <= 3) {
              console.log(`[MATCHED] "${partNo}": Stock=${stockQty}, Phy=${phyQty}, FinalPhy=${finalPhy}, Diff=${diff}`);
            }
          }
          // ============================================
          // CASE 2: PART ONLY IN PHYSICAL (NOT IN DMS)
          // ============================================
          else if (physical && !dms) {
            physicalOnly++;

            const partDescription = physical.desc || '';
            const category = physical.category || '';
            const partPrice = physical.price || 0;
            const stockQty = 0;  // No DMS record
            const phyQty = physical.qty || 0;
            const dmgQty = physical.dmgQty || 0;

            const finalPhy = phyQty;
            const diff = finalPhy - stockQty;  // Should be positive (EXCESS)
            const stockValue = stockQty * partPrice;
            const phyValue = finalPhy * partPrice;
            const shortExcess = diff * partPrice;

            compileReportRows.push({
              partNumber: partNo,
              oemPart: partNo,
              partDescription: partDescription,
              category: category,
              partPrice: partPrice,
              stockQty: stockQty,
              phyQty: phyQty,
              dmgQty: dmgQty,
              p4i: 0,
              finalPhy: finalPhy,
              diff: diff,
              stockValue: stockValue,
              phyValue: phyValue,
              shortExcess: shortExcess
            });
          }
          // ============================================
          // CASE 3: PART ONLY IN DMS (NOT IN PHYSICAL)
          // ============================================
          else if (!physical && dms) {
            dmsOnly++;

            const partDescription = dms.desc || '';
            const category = dms.category || '';
            const partPrice = dms.price || 0;
            const stockQty = dms.qty || 0;  // From DMS (already summed)
            const phyQty = 0;
            const dmgQty = 0;

            const finalPhy = 0;
            const diff = finalPhy - stockQty;  // Should be negative (SHORTAGE)
            const stockValue = stockQty * partPrice;
            const phyValue = finalPhy * partPrice;
            const shortExcess = diff * partPrice;

            compileReportRows.push({
              partNumber: partNo,
              oemPart: partNo,
              partDescription: partDescription,
              category: category,
              partPrice: partPrice,
              stockQty: stockQty,
              phyQty: phyQty,
              dmgQty: dmgQty,
              p4i: 0,
              finalPhy: finalPhy,
              diff: diff,
              stockValue: stockValue,
              phyValue: phyValue,
              shortExcess: shortExcess
            });

            // Debug first 3 DMS-only parts
            if (dmsOnly <= 3) {
              console.log(`[DMS-ONLY] "${partNo}": Stock=${stockQty}, Phy=${phyQty}, FinalPhy=${finalPhy}, Diff=${diff} (SHORTAGE!)`);
            }
          }
        });

        // ============================================
        // STEP 4: VERIFY
        // ============================================
        console.log(`\n=== VERIFICATION AFTER DUPLICATE SUMMING ===`);
        console.log(`Total rows: ${compileReportRows.length}`);
        console.log(`Matched: ${matchedBoth}, Physical-only: ${physicalOnly}, DMS-only: ${dmsOnly}`);

        // Check for duplicate part numbers in the final report (should be none)
        const duplicateCheck = new Map<string, number>();
        compileReportRows.forEach(row => {
          const count = duplicateCheck.get(row.partNumber) || 0;
          duplicateCheck.set(row.partNumber, count + 1);
        });

        const duplicates = Array.from(duplicateCheck.entries()).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
          console.warn('⚠️ WARNING: Duplicate part numbers still exist in final report:', duplicates);
        } else {
          console.log('✅ No duplicate part numbers in final report - all quantities summed correctly');
        }

        // ============================================
        // STEP 5: FINALIZE
        // ============================================
        const totalStockValue = compileReportRows.reduce((sum, r) => sum + r.stockValue, 0);
        const totalPhyValue = compileReportRows.reduce((sum, r) => sum + r.phyValue, 0);
        const totalShortExcess = compileReportRows.reduce((sum, r) => sum + r.shortExcess, 0);

        const excessParts = compileReportRows.filter(r => r.diff > 0);
        const shortageParts = compileReportRows.filter(r => r.diff < 0);
        const damageParts = compileReportRows.filter(r => r.dmgQty > 0);

        // Generate summary
        generateSummaryData(compileReportRows);

        // Set state
        setExcessParts(excessParts);
        setShortageParts(shortageParts);
        setDamageParts(damageParts);
        setCompileReport(compileReportRows);
        setCurrentStep(2);

        // Success message
        const summaryMsg = `✅ FINAL FIXED Compile Report Generated with Duplicate Handling!
      
📊 DUPLICATE HANDLING:
• All duplicate part numbers have been SUMMED
• Physical duplicates: ${consolidatedCountSheet.length - physicalMap.size} duplicates combined
• DMS duplicates: ${cleanOnHandData.length - 1 - dmsMap.size} duplicates combined

📈 STATISTICS:
• Total Unique Parts: ${compileReportRows.length}
• Matched (both): ${matchedBoth}
• Physical-only (Excess): ${physicalOnly}
• DMS-only (Shortage): ${dmsOnly}

💰 FINANCIAL:
• Total Stock Value: ₹${totalStockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• Total Physical Value: ₹${totalPhyValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
• Net Difference: ₹${totalShortExcess.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        setSuccess(summaryMsg);
        setError('');

      } catch (err: any) {
        console.error('❌ Final fixed report error:', err);
        setError(`Error generating report: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 100);
  };



  // ============================================
  // GENERATE SUMMARY DATA - FIXED VERSION WITH PROPER CATEGORIZATION
  // ============================================
  const generateSummaryData = (compileRows: CompileReportRow[]): void => {
    console.log('=== GENERATING DETAILED SUMMARY ===');
    console.log(`Total compile rows: ${compileRows.length}`);

    // Define categories exactly as in demo
    const categories = ['Spares', 'Accessories', 'Battery', 'Fiat Spares', 'Lubricant', 'Nano Spares', 'Tyre', 'Oils'];

    // First, let's log all unique categories found in the data
    const uniqueCategories = new Set(compileRows.map(row => row.category).filter(Boolean));
    console.log('Unique categories found in data:', Array.from(uniqueCategories));

    const summaryRows: SummaryRow[] = categories.map(category => {
      // More inclusive category matching
      const categoryRows = compileRows.filter(row => {
        if (!row.category) return false;

        const rowCategory = row.category.toString().toUpperCase().trim();
        const searchCategory = category.toUpperCase();

        // Handle different category variations
        if (searchCategory === 'SPARES') {
          return rowCategory.includes('SPARE') &&
            !rowCategory.includes('FIAT') &&
            !rowCategory.includes('NANO');
        }
        if (searchCategory === 'FIAT SPARES') {
          return rowCategory.includes('FIAT');
        }
        if (searchCategory === 'NANO SPARES') {
          return rowCategory.includes('NANO');
        }
        if (searchCategory === 'BATTERY') {
          return rowCategory.includes('BATT');
        }
        if (searchCategory === 'LUBRICANT') {
          return rowCategory.includes('LUBE') || rowCategory.includes('LUBRICANT');
        }
        if (searchCategory === 'TYRE') {
          return rowCategory.includes('TYRE') || rowCategory.includes('TIRE');
        }
        if (searchCategory === 'ACCESSORIES') {
          return rowCategory.includes('ACCESS');
        }
        if (searchCategory === 'Oils') {
          return rowCategory.includes('Oils')
        }

        return rowCategory === searchCategory;
      });

      console.log(`${category}: ${categoryRows.length} rows found`);

      // DMS Stock Stats (from OnHand/DMS system)
      const dmsValue = categoryRows.reduce((sum, row) => sum + (row.stockValue || 0), 0);
      const dmsPartLines = categoryRows.filter(row => row.stockQty > 0).length;
      const dmsQuantity = categoryRows.reduce((sum, row) => sum + (row.stockQty || 0), 0);

      // Physical Stock Stats (as counted)
      const physicalValue = categoryRows.reduce((sum, row) => sum + (row.phyValue || 0), 0);
      const physicalPartLines = categoryRows.filter(row => row.phyQty > 0).length;
      const physicalQuantity = categoryRows.reduce((sum, row) => sum + (row.finalPhy || row.phyQty || 0), 0);

      // Excess Found (Physical > DMS)
      const excessRows = categoryRows.filter(row => row.diff > 0);
      const excessValue = excessRows.reduce((sum, row) => sum + row.shortExcess, 0);
      const excessPartLines = excessRows.length;

      // Short Found (Physical < DMS)
      const shortRows = categoryRows.filter(row => row.diff < 0);
      const shortValue = Math.abs(shortRows.reduce((sum, row) => sum + row.shortExcess, 0));
      const shortPartLines = shortRows.length;

      // Net Difference
      const netDifferenceValue = physicalValue - dmsValue;
      const netDifferencePercent = dmsValue > 0 ? (netDifferenceValue / dmsValue) * 100 :
        physicalValue > 0 ? 100 : 0;

      return {
        category: category,
        // DMS Stock
        dmsValue,
        dmsPartLines,
        dmsQuantity,
        // Physical Stock as Counted
        physicalValue,
        physicalPartLines,
        physicalQuantity,
        // Excess Found
        excessValue,
        excessPartLines,
        // Short Found
        shortValue,
        shortPartLines,
        // Net Difference
        netDifferenceValue,
        netDifferencePercent
      };
    });

    // Calculate Totals
    const totalRow: SummaryRow = {
      category: 'Total',
      dmsValue: summaryRows.reduce((sum, row) => sum + row.dmsValue, 0),
      dmsPartLines: summaryRows.reduce((sum, row) => sum + row.dmsPartLines, 0),
      dmsQuantity: summaryRows.reduce((sum, row) => sum + row.dmsQuantity, 0),
      physicalValue: summaryRows.reduce((sum, row) => sum + row.physicalValue, 0),
      physicalPartLines: summaryRows.reduce((sum, row) => sum + row.physicalPartLines, 0),
      physicalQuantity: summaryRows.reduce((sum, row) => sum + row.physicalQuantity, 0),
      excessValue: summaryRows.reduce((sum, row) => sum + row.excessValue, 0),
      excessPartLines: summaryRows.reduce((sum, row) => sum + row.excessPartLines, 0),
      shortValue: summaryRows.reduce((sum, row) => sum + row.shortValue, 0),
      shortPartLines: summaryRows.reduce((sum, row) => sum + row.shortPartLines, 0),
      netDifferenceValue: summaryRows.reduce((sum, row) => sum + row.netDifferenceValue, 0),
      netDifferencePercent: summaryRows.reduce((sum, row) => sum + row.dmsValue, 0) > 0 ?
        (summaryRows.reduce((sum, row) => sum + row.netDifferenceValue, 0) /
          summaryRows.reduce((sum, row) => sum + row.dmsValue, 0)) * 100 : 0
    };

    // Log detailed summary
    console.log('\n=== DETAILED SUMMARY ===');
    console.log('Category\tDMS Value\tDMS Lines\tDMS Qty\tPhy Value\tPhy Lines\tPhy Qty\tExcess Value\tExcess Lines\tShort Value\tShort Lines\tNet Diff\tDiff %');
    summaryRows.forEach(row => {
      console.log(`${row.category}\t₹${row.dmsValue.toFixed(2)}\t${row.dmsPartLines}\t${row.dmsQuantity}\t₹${row.physicalValue.toFixed(2)}\t${row.physicalPartLines}\t${row.physicalQuantity}\t₹${row.excessValue.toFixed(2)}\t${row.excessPartLines}\t₹${row.shortValue.toFixed(2)}\t${row.shortPartLines}\t₹${row.netDifferenceValue.toFixed(2)}\t${row.netDifferencePercent.toFixed(1)}%`);
    });
    console.log(`Total\t₹${totalRow.dmsValue.toFixed(2)}\t${totalRow.dmsPartLines}\t${totalRow.dmsQuantity}\t₹${totalRow.physicalValue.toFixed(2)}\t${totalRow.physicalPartLines}\t${totalRow.physicalQuantity}\t₹${totalRow.excessValue.toFixed(2)}\t${totalRow.excessPartLines}\t₹${totalRow.shortValue.toFixed(2)}\t${totalRow.shortPartLines}\t₹${totalRow.netDifferenceValue.toFixed(2)}\t${totalRow.netDifferencePercent.toFixed(1)}%`);

    setSummaryData([...summaryRows, totalRow]);
  };

  // ============================================
  // DOWNLOAD EXCEL
  // ============================================
  const downloadExcel = async (): Promise<void> => {
    if (compileReport.length === 0) {
      setError('Please generate compile report first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const workbook = new ExcelJS.Workbook();
      const date = new Date();
      const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;

      // ============================================
      // SHEET 1: COMPILE REPORT
      // ============================================
      const compileSheet = workbook.addWorksheet('Compile Report');
      compileSheet.addRow(['TATA FINAL AUDIT REPORT']);
      compileSheet.addRow([reportTitle || '']);
      compileSheet.addRow([]);

      const compileHeaders = ['Part Number', 'OEM Part', 'Part Description', 'Category', 'Part Price', 'Stock Qty', 'Phy Qty', 'Dmg Qty', 'P4I', 'Final Phy', 'Diff', 'Stock Value', 'Phy Value', 'Short/Excess'];
      compileSheet.addRow(compileHeaders);

      compileReport.forEach(row => {
        compileSheet.addRow([
          row.partNumber,
          row.oemPart,
          row.partDescription,
          row.category,
          row.partPrice,
          row.stockQty,
          row.phyQty,
          row.dmgQty,
          row.p4i,
          row.finalPhy,
          row.diff,
          row.stockValue,
          row.phyValue,
          row.shortExcess
        ]);
      });



      // ============================================
      // COMPLETE SOLUTION WITH PROPER WIDTHS
      // ============================================
      // Assume 'workbook', 'summaryData', 'dealerName', 'location', 'auditStartDate', 'auditEndDate'
      // are available in this scope from your ExcelJS context.

      if (summaryData.length > 0) {
        const summarySheet = workbook.addWorksheet('Summary');

        // ============================================
        // COMPACT COLUMN WIDTHS - EXACTLY LIKE UI TABLE
        // ============================================
        summarySheet.columns = [
          { width: 14 }, // Category
          { width: 10 }, // DMS Value
          { width: 8 },  // DMS Part Lines
          { width: 8 },  // DMS Quantity
          { width: 10 }, // Physical Value
          { width: 8 },  // Physical Part Lines
          { width: 8 },  // Physical Quantity
          { width: 10 }, // Excess Value
          { width: 8 },  // Excess Part Lines
          { width: 10 }, // Short Value
          { width: 8 },  // Short Part Lines
          { width: 10 }, // Net Difference Value
          { width: 7 }   // Diff %
        ];

        // ============================================
        // ROW 1: TITLE
        // ============================================
        const titleRow = summarySheet.getRow(1);
        const titleCell = titleRow.getCell(1);
        titleCell.value = 'Wall-to-Wall Smart Inventory Audit Summary (WWSIA)';
        summarySheet.mergeCells(`A1:M1`);

        titleCell.font = {
          name: 'Calibri',
          size: 16,
          bold: true,
          color: { argb: 'FF000000' }
        };
        titleCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF92D050' } // Green
        };
        titleCell.alignment = {
          horizontal: 'center',
          vertical: 'middle'
        };
        titleRow.height = 30;

        // ============================================
        // ROW 2: DEALERSHIP NAME & LOCATION
        // ============================================
        const row2 = summarySheet.getRow(2);
        row2.height = 20;

        // Dealership Name
        summarySheet.getCell('A2').value = 'Dealership Name:';
        summarySheet.getCell('A2').font = { bold: true };
        summarySheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('A2').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        summarySheet.mergeCells('B2:C2');
        summarySheet.getCell('B2').value = dealerName || '';
        summarySheet.getCell('B2').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('B2').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        // Location
        summarySheet.getCell('E2').value = 'Location:';
        summarySheet.getCell('E2').font = { bold: true };
        summarySheet.getCell('E2').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('E2').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        summarySheet.mergeCells('F2:G2');
        summarySheet.getCell('F2').value = location || '';
        summarySheet.getCell('F2').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('F2').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        // Clear remaining cells in row 2
        for (let col = 8; col <= 13; col++) {
          summarySheet.getCell(2, col).value = '';
          summarySheet.getCell(2, col).border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        }

        // ============================================
        // ROW 3: AUDIT DATES
        // ============================================
        const row3 = summarySheet.getRow(3);
        row3.height = 20;

        // Audit Start Date
        summarySheet.getCell('A3').value = 'Audit Start Date:';
        summarySheet.getCell('A3').font = { bold: true };
        summarySheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('A3').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        summarySheet.mergeCells('B3:C3');
        summarySheet.getCell('B3').value = auditStartDate || '';
        summarySheet.getCell('B3').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('B3').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        // Audit Closed Date
        summarySheet.getCell('E3').value = 'Audit Closed Date:';
        summarySheet.getCell('E3').font = { bold: true };
        summarySheet.getCell('E3').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('E3').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        summarySheet.mergeCells('F3:G3');
        summarySheet.getCell('F3').value = auditEndDate || '';
        summarySheet.getCell('F3').alignment = { horizontal: 'left', vertical: 'middle' };
        summarySheet.getCell('F3').border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
        };

        // Clear remaining cells in row 3
        for (let col = 8; col <= 13; col++) {
          summarySheet.getCell(3, col).value = '';
          summarySheet.getCell(3, col).border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        }



        // Style chip labels
        const chipStyle = (cell: ExcelJS.Cell, color: string) => {
          cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: color }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
        };

        chipStyle(summarySheet.getCell('A5'), 'FFE3F2FD'); // DMS Stock - Light blue
        chipStyle(summarySheet.getCell('B5'), 'FFE8F5E9'); // Physical - Light green
        chipStyle(summarySheet.getCell('D5'), 'FFFFF3E0'); // Excess - Light orange
        chipStyle(summarySheet.getCell('F5'), 'FFFFEBEE'); // Short - Light red

        // Clear remaining cells in row 5
        for (let col = 1; col <= 13; col++) {
          if (![1, 2, 4, 6].includes(col)) {
            summarySheet.getCell(5, col).value = '';
            summarySheet.getCell(5, col).border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
          }
        }

        // ============================================
        // HEADER SECTION - ROWS 6-7
        // ============================================
        const headerRow1 = 6;
        const headerRow2 = 7;

        // Row 6: Main headers
        summarySheet.getCell(`A${headerRow1}`).value = 'Category';
        summarySheet.mergeCells(`A${headerRow1}:A${headerRow2}`);

        summarySheet.getCell(`B${headerRow1}`).value = 'DMS Stock';
        summarySheet.mergeCells(`B${headerRow1}:D${headerRow1}`);

        summarySheet.getCell(`E${headerRow1}`).value = 'Physical Stock as Counted';
        summarySheet.mergeCells(`E${headerRow1}:G${headerRow1}`);

        summarySheet.getCell(`H${headerRow1}`).value = 'Excess Found';
        summarySheet.mergeCells(`H${headerRow1}:I${headerRow1}`);

        summarySheet.getCell(`J${headerRow1}`).value = 'Short Found';
        summarySheet.mergeCells(`J${headerRow1}:K${headerRow1}`);

        summarySheet.getCell(`L${headerRow1}`).value = 'Net Difference';
        summarySheet.mergeCells(`L${headerRow1}:M${headerRow1}`);

        // Row 7: Sub headers
        summarySheet.getCell(`B${headerRow2}`).value = 'Value';
        summarySheet.getCell(`C${headerRow2}`).value = 'Part Lines';
        summarySheet.getCell(`D${headerRow2}`).value = 'Quantity';
        summarySheet.getCell(`E${headerRow2}`).value = 'Value';
        summarySheet.getCell(`F${headerRow2}`).value = 'Part Lines';
        summarySheet.getCell(`G${headerRow2}`).value = 'Quantity';
        summarySheet.getCell(`H${headerRow2}`).value = 'Value';
        summarySheet.getCell(`I${headerRow2}`).value = 'Part Lines';
        summarySheet.getCell(`J${headerRow2}`).value = 'Value';
        summarySheet.getCell(`K${headerRow2}`).value = 'Part Lines';
        summarySheet.getCell(`L${headerRow2}`).value = 'Value';
        summarySheet.getCell(`M${headerRow2}`).value = 'Diff %';

        // Style headers
        for (let row = headerRow1; row <= headerRow2; row++) {
          for (let col = 1; col <= 13; col++) {
            const cell = summarySheet.getCell(row, col);
            cell.font = { bold: true, size: 11 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };

            // Background colors for main headers
            if (row === headerRow1) {
              if (col === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
              if (col >= 2 && col <= 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
              if (col >= 5 && col <= 7) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
              if (col >= 8 && col <= 9) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
              if (col >= 10 && col <= 11) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
              if (col >= 12 && col <= 13) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
            }

            // Background colors for sub headers
            if (row === headerRow2) {
              if (col === 2 || col === 3 || col === 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
              if (col === 5 || col === 6 || col === 7) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
              if (col === 8 || col === 9) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
              if (col === 10 || col === 11) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
              if (col === 12 || col === 13) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
            }
          }
        }

        // Special border for Category column
        summarySheet.getCell(`A${headerRow1}`).border = {
          top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          right: { style: 'medium', color: { argb: 'FFE0E0E0' } }
        };

        // ============================================
        // DATA ROWS
        // ============================================
        const dataStartRow = headerRow2 + 1;
        let currentRow = dataStartRow;

        summaryData.forEach((row, index) => {
          const isTotal = row.category === 'Total';
          const excelRow = summarySheet.getRow(currentRow);
          excelRow.height = 16;

          // Category
          const categoryCell = excelRow.getCell(1);
          categoryCell.value = row.category;
          categoryCell.font = { bold: isTotal, size: 11 };
          categoryCell.alignment = { horizontal: 'left', vertical: 'middle' };
          categoryCell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'medium', color: { argb: 'FFE0E0E0' } }
          };
          if (!isTotal && index % 2 === 0) {
            categoryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          }

          // Values
          excelRow.getCell(2).value = row.dmsValue;
          excelRow.getCell(3).value = row.dmsPartLines;
          excelRow.getCell(4).value = row.dmsQuantity;
          excelRow.getCell(5).value = row.physicalValue;
          excelRow.getCell(6).value = row.physicalPartLines;
          excelRow.getCell(7).value = row.physicalQuantity;
          excelRow.getCell(8).value = row.excessValue;
          excelRow.getCell(9).value = row.excessPartLines;
          excelRow.getCell(10).value = row.shortValue;
          excelRow.getCell(11).value = row.shortPartLines;
          excelRow.getCell(12).value = row.netDifferenceValue;

          // Net Difference %
          if (row.physicalValue === 0) {
            excelRow.getCell(13).value = '#DIV/0!';
          } else {
            excelRow.getCell(13).value = row.netDifferencePercent / 100;
          }

          // Apply styling to all data cells
          for (let col = 2; col <= 13; col++) {
            const cell = excelRow.getCell(col);

            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };

            if (!isTotal && index % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            }

            if (isTotal) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
              cell.font = { bold: true };
            }

            cell.alignment = { horizontal: 'right', vertical: 'middle' };

            // Number formatting
            if ([2, 5, 8, 10, 12].includes(col)) {
              cell.numFmt = '₹ #,##0';
            } else if ([3, 4, 6, 7, 9, 11].includes(col)) {
              cell.numFmt = '#,##0';
            } else if (col === 13 && row.physicalValue !== 0) {
              cell.numFmt = '0.0%';
            }

            // Color coding
            if (col === 8 || col === 9) {
              cell.font = { color: { argb: row.excessValue > 0 ? 'FF10B981' : 'FF000000' } };
              if (row.excessValue > 0) cell.font.bold = true;
            }
            if (col === 10 || col === 11) {
              cell.font = { color: { argb: row.shortValue > 0 ? 'FFEF4444' : 'FF000000' } };
              if (row.shortValue > 0) cell.font.bold = true;
            }
            if (col === 12 || col === 13) {
              if (row.netDifferenceValue > 0) {
                cell.font = { color: { argb: 'FF10B981' }, bold: true };
              } else if (row.netDifferenceValue < 0) {
                cell.font = { color: { argb: 'FFEF4444' }, bold: true };
              }
            }
          }

          currentRow++;
        });

        // ============================================
        // FOOTNOTE - LEGEND
        // ============================================
        const footnoteRow = currentRow + 2;

        summarySheet.getCell(`A${footnoteRow}`).value = '●';
        summarySheet.getCell(`A${footnoteRow}`).font = { color: { argb: 'FFE3F2FD' }, size: 12 };
        summarySheet.getCell(`B${footnoteRow}`).value = 'DMS Stock (System)';
        summarySheet.getCell(`B${footnoteRow}`).font = { size: 9 };

        summarySheet.getCell(`D${footnoteRow}`).value = '●';
        summarySheet.getCell(`D${footnoteRow}`).font = { color: { argb: 'FFE8F5E9' }, size: 12 };
        summarySheet.getCell(`E${footnoteRow}`).value = 'Physical Counted';
        summarySheet.getCell(`E${footnoteRow}`).font = { size: 9 };

        summarySheet.getCell(`G${footnoteRow}`).value = '●';
        summarySheet.getCell(`G${footnoteRow}`).font = { color: { argb: 'FFFFF3E0' }, size: 12 };
        summarySheet.getCell(`H${footnoteRow}`).value = 'Excess Found';
        summarySheet.getCell(`H${footnoteRow}`).font = { size: 9 };

        summarySheet.getCell(`J${footnoteRow}`).value = '●';
        summarySheet.getCell(`J${footnoteRow}`).font = { color: { argb: 'FFFFEBEE' }, size: 12 };
        summarySheet.getCell(`K${footnoteRow}`).value = 'Short Found';
        summarySheet.getCell(`K${footnoteRow}`).font = { size: 9 };

        // Add footnote text
        const footnoteTextRow = footnoteRow + 1;
        summarySheet.mergeCells(`A${footnoteTextRow}:M${footnoteTextRow}`);
        const footnoteTextCell = summarySheet.getCell(`A${footnoteTextRow}`);
        footnoteTextCell.value = '(Value @ NDP in Rs.; Parts Lines & Quantity in Nos.)';
        footnoteTextCell.alignment = { horizontal: 'right', vertical: 'middle' };
        footnoteTextCell.font = { italic: true, size: 9 };

        // ============================================
        // FREEZE PANES
        // ============================================
        summarySheet.views = [
          { state: 'frozen', xSplit: 1, ySplit: headerRow2 }
        ];

        // ============================================
        // HIDE GRIDLINES
        // ============================================
        summarySheet.properties.showGridLines = false;
      }



      // ============================================
      // SHEET 3: DAMAGE PARTS & SUMMARY
      // ============================================
      // First, process damage parts from consolidated count sheet
      const damageParts = consolidatedCountSheet.filter(row =>
        row.remark && row.remark.toLowerCase().includes('damaged')
      );

      if (damageParts.length > 0) {
        const damageSheet = workbook.addWorksheet('Damage Parts');
        damageSheet.addRow(['DAMAGE PARTS & SUMMARY']);
        damageSheet.addRow([]);

        const damageHeaders = [
          'Part Number', 'Location', 'Part Description', 'Part Price',
          'Phy Qty', 'Category', 'Remark', 'Considered Qty',
          'Considered Value', 'Not Considered Qty', 'Not Considered Value',
          'Total Damage Qty', 'Total Damage Value', 'Diff. Qty'
        ];
        damageSheet.addRow(damageHeaders);

        // Create a map for part prices from compile report
        const priceMap = new Map<string, number>();
        compileReport.forEach(row => {
          if (row.partPrice > 0) {
            priceMap.set(row.partNumber.toUpperCase(), row.partPrice);
          }
        });

        let totalDamageValue = 0;
        let totalDamageQty = 0;

        damageParts.forEach(row => {
          const partPrice = priceMap.get(row.partNo.toUpperCase()) || 0;
          const phyQty = row.finalQty || row.qty || 0;
          const damageValue = phyQty * partPrice;

          totalDamageValue += damageValue;
          totalDamageQty += phyQty;

          damageSheet.addRow([
            row.partNo,
            row.location,
            row.materialDescription,
            partPrice,
            phyQty,
            row.productCategory,
            row.remark,
            0, // Considered Qty - would need business rules
            0, // Considered Value
            phyQty, // Not Considered Qty
            damageValue, // Not Considered Value
            phyQty,
            damageValue,
            0 // Diff. Qty - would need business rules
          ]);
        });

        // Add summary rows
        damageSheet.addRow([]);
        damageSheet.addRow(['SUMMARY']);
        damageSheet.addRow(['Total Damage Parts:', damageParts.length]);
        damageSheet.addRow(['Total Damage Quantity:', totalDamageQty]);
        damageSheet.addRow(['Total Damage Value:', totalDamageValue]);
      }

      // ============================================
      // SHEET 4: BASE LOCATION
      // ============================================
      // Find base location (location with highest Final Qty for each part)
      const baseLocationMap = new Map<string, { location: string, qty: number, description: string }>();

      consolidatedCountSheet.forEach(row => {
        const partNo = row.partNo.toUpperCase();
        const qty = row.finalQty || row.qty || 0;

        if (!baseLocationMap.has(partNo) || baseLocationMap.get(partNo)!.qty < qty) {
          baseLocationMap.set(partNo, {
            location: row.location || '',
            qty: qty,
            description: row.materialDescription || ''
          });
        }
      });

      if (baseLocationMap.size > 0) {
        const baseLocationSheet = workbook.addWorksheet('Base Location');
        baseLocationSheet.addRow(['BASE LOCATION']);
        baseLocationSheet.addRow(['(Location with highest Final Qty for each part)']);
        baseLocationSheet.addRow([]);

        baseLocationSheet.addRow(['Part No.', 'Base Location']);

        const baseLocations = Array.from(baseLocationMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]));

        baseLocations.forEach(([partNo, data]) => {
          baseLocationSheet.addRow([partNo, data.location]);
        });
      }

      // ============================================
      // SHEET 5: MULTI LOCATION
      // ============================================
      // Find parts that appear in multiple locations
      const partLocations = new Map<string, Array<{ location: string, qty: number, description: string }>>();

      consolidatedCountSheet.forEach(row => {
        const partNo = row.partNo.toUpperCase();
        const qty = row.finalQty || row.qty || 0;

        if (!partLocations.has(partNo)) {
          partLocations.set(partNo, []);
        }

        partLocations.get(partNo)!.push({
          location: row.location || '',
          qty: qty,
          description: row.materialDescription || ''
        });
      });

      // Filter parts that appear in multiple locations
      const multiLocationParts = Array.from(partLocations.entries())
        .filter(([_, locations]) => locations.length > 1);

      if (multiLocationParts.length > 0) {
        const multiLocationSheet = workbook.addWorksheet('Multi Location');
        multiLocationSheet.addRow(['MULTI LOCATION']);
        multiLocationSheet.addRow(['(Parts appearing in multiple locations)']);
        multiLocationSheet.addRow([]);

        multiLocationSheet.addRow(['Part No.', 'Location', 'Part Description', 'Part Price', 'Final Qty', 'Base Location']);

        // Create price map for part prices
        const priceMap = new Map<string, number>();
        compileReport.forEach(row => {
          priceMap.set(row.partNumber.toUpperCase(), row.partPrice);
        });

        multiLocationParts.forEach(([partNo, locations]) => {
          const baseLocation = baseLocationMap.get(partNo)?.location || '';
          const partPrice = priceMap.get(partNo) || 0;

          locations.forEach((loc, index) => {
            multiLocationSheet.addRow([
              index === 0 ? partNo : '', // Show part number only on first row
              loc.location,
              loc.description,
              partPrice,
              loc.qty,
              baseLocation
            ]);
          });

          // Add empty row between parts for readability
          multiLocationSheet.addRow([]);
        });
      }

      // ============================================
      // SHEET 6: ACTIONABLE PARTS
      // ============================================
      // Filter actionable parts (specific remarks)
      const actionableParts = consolidatedCountSheet.filter(row => {
        if (!row.remark) return false;
        const remark = row.remark.toLowerCase();
        return remark.includes('without packing/label') ||
          remark.includes('part number doubtful') ||
          remark.includes('without packing') ||
          remark.includes('without label') ||
          remark.includes('doubtful');
      });

      if (actionableParts.length > 0) {
        const actionableSheet = workbook.addWorksheet('Actionable Parts');
        actionableSheet.addRow(['ACTIONABLE PARTS & SUMMARY']);
        actionableSheet.addRow(['(Parts requiring attention)']);
        actionableSheet.addRow([]);

        actionableSheet.addRow(['Part No.', 'Location', 'Part Description', 'Part Price', 'Remark', 'Final Qty', 'Value (Final Qty × Part Price)']);

        const priceMap = new Map<string, number>();
        compileReport.forEach(row => {
          priceMap.set(row.partNumber.toUpperCase(), row.partPrice);
        });

        let totalActionableValue = 0;
        let totalActionableQty = 0;

        actionableParts.forEach(row => {
          const partPrice = priceMap.get(row.partNo.toUpperCase()) || 0;
          const finalQty = row.finalQty || row.qty || 0;
          const value = finalQty * partPrice;

          totalActionableValue += value;
          totalActionableQty += finalQty;

          actionableSheet.addRow([
            row.partNo,
            row.location,
            row.materialDescription,
            partPrice,
            row.remark,
            finalQty,
            value
          ]);
        });

        // Add summary rows
        actionableSheet.addRow([]);
        actionableSheet.addRow(['SUMMARY']);
        actionableSheet.addRow(['Total Actionable Parts:', actionableParts.length]);
        actionableSheet.addRow(['Total Actionable Quantity:', totalActionableQty]);
        actionableSheet.addRow(['Total Actionable Value:', totalActionableValue]);
      }

      // ============================================
      // SHEET 7: EXCESS PARTS
      // ============================================
      // Filter excess parts (Short/Excess > 0)
      const excessParts = compileReport.filter(row => row.shortExcess > 0);

      if (excessParts.length > 0) {
        const excessSheet = workbook.addWorksheet('Excess Parts');
        excessSheet.addRow(['EXCESS PARTS']);
        excessSheet.addRow(['(Parts with Physical > DMS Stock)']);
        excessSheet.addRow([]);

        const excessHeaders = ['Part Number', 'Description', 'Category', 'Price', 'Stock Qty', 'Physical Qty', 'Difference', 'Excess Value'];
        excessSheet.addRow(excessHeaders);

        let totalExcessValue = 0;

        excessParts.forEach(row => {
          excessSheet.addRow([
            row.partNumber,
            row.partDescription,
            row.category,
            row.partPrice,
            row.stockQty,
            row.finalPhy,
            row.diff,
            row.shortExcess
          ]);

          totalExcessValue += row.shortExcess;
        });

        // Add summary rows
        excessSheet.addRow([]);
        excessSheet.addRow(['SUMMARY']);
        excessSheet.addRow(['Total Excess Parts:', excessParts.length]);
        excessSheet.addRow(['Total Excess Value:', totalExcessValue]);
      }

      // ============================================
      // SHEET 8: SHORTAGE PARTS
      // ============================================
      // Filter shortage parts (Short/Excess < 0)
      const shortageParts = compileReport.filter(row => row.shortExcess < 0);

      if (shortageParts.length > 0) {
        const shortageSheet = workbook.addWorksheet('Shortage Parts');
        shortageSheet.addRow(['SHORTAGE PARTS']);
        shortageSheet.addRow(['(Parts with Physical < DMS Stock)']);
        shortageSheet.addRow([]);

        const shortageHeaders = ['Part Number', 'Description', 'Category', 'Price', 'Stock Qty', 'Physical Qty', 'Difference', 'Shortage Value'];
        shortageSheet.addRow(shortageHeaders);

        let totalShortageValue = 0;

        shortageParts.forEach(row => {
          const shortageValue = Math.abs(row.shortExcess);
          shortageSheet.addRow([
            row.partNumber,
            row.partDescription,
            row.category,
            row.partPrice,
            row.stockQty,
            row.finalPhy,
            row.diff,
            shortageValue
          ]);

          totalShortageValue += shortageValue;
        });

        // Add summary rows
        shortageSheet.addRow([]);
        shortageSheet.addRow(['SUMMARY']);
        shortageSheet.addRow(['Total Shortage Parts:', shortageParts.length]);
        shortageSheet.addRow(['Total Shortage Value:', totalShortageValue]);
      }

      // ============================================
      // ADDITIONAL SHEET: ON-HAND STOCK
      // ============================================
      if (onHandSheetData && onHandSheetData.length > 0) {
        const onHandSheet = workbook.addWorksheet('On-Hand Stock (DMS)');
        onHandSheet.addRow(['ON-HAND STOCK - DMS RECORDS']);
        onHandSheet.addRow([]);

        // Add headers from OnHand sheet
        const onHandHeaders = onHandSheetData[0] || [];
        onHandSheet.addRow(onHandHeaders);

        // Add data rows
        for (let i = 1; i < Math.min(onHandSheetData.length, 1000); i++) {
          onHandSheet.addRow(onHandSheetData[i]);
        }

        // Add note if rows were truncated
        if (onHandSheetData.length > 1000) {
          onHandSheet.addRow([]);
          onHandSheet.addRow([`Note: Showing first 1000 rows of ${onHandSheetData.length} total rows`]);
        }
      }

      // ============================================
      // ADDITIONAL SHEET: CONSOLIDATED COUNT SHEET
      // ============================================
      if (consolidatedCountSheet.length > 0) {
        const consolidatedSheet = workbook.addWorksheet('Consolidated Count Sheet');
        consolidatedSheet.addRow(['CONSOLIDATED COUNT SHEET']);
        consolidatedSheet.addRow(['(Physical Count Data)']);
        consolidatedSheet.addRow([]);

        const consolidatedHeaders = [
          'S.No', 'Date', 'Site', 'Product Category', 'Location', 'Part No.',
          'Qty', 'MRP', 'Material Description', 'Remark', 'Scanned By',
          'Timestamp', 'Final Qty'
        ];
        consolidatedSheet.addRow(consolidatedHeaders);

        consolidatedCountSheet.forEach(row => {
          consolidatedSheet.addRow([
            row.sNo,
            row.date,
            row.site,
            row.productCategory,
            row.location,
            row.partNo,
            row.qty,
            row.mrp,
            row.materialDescription,
            row.remark,
            row.scannedBy,
            row.timestamp,
            row.finalQty
          ]);
        });
      }

      // ============================================
      // APPLY STYLING
      // ============================================
      workbook.eachSheet((worksheet) => {
        // Auto-size columns
        worksheet.columns.forEach((column, index) => {
          let maxLength = 0;
          column.eachCell?.({ includeEmpty: true }, cell => {
            const cellValue = cell.value ? cell.value.toString() : '';
            if (cellValue.length > maxLength) maxLength = cellValue.length;
          });
          column.width = Math.min(maxLength + 2, 50);
        });

        // Style header row (row 4 for most sheets, adjust as needed)
        const headerRow = worksheet.getRow(4);
        if (headerRow && headerRow.values && (headerRow.values as any[]).length > 0) {
          headerRow.font = { bold: true };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE67E22' } // TATA orange
          };
          headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        }

        // Style first title row
        const titleRow = worksheet.getRow(1);
        if (titleRow) {
          titleRow.font = { size: 16, bold: true, color: { argb: 'FFD35400' } };
        }
      });

      // ============================================
      // DOWNLOAD FILE
      // ============================================
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TATA_Audit_Report_${timestamp}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      // Update state with damage and actionable parts
      setDamageParts(damageParts);

      setSuccess(`TATA Audit Report with ${workbook.worksheets.length} sheets downloaded successfully!`);

    } catch (err: any) {
      console.error('Download error:', err);
      setError(`Error downloading report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <HeroSection>
        <Container maxWidth="xl">
          <Box sx={{ textAlign: 'center' }}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => navigate('/admin')}
              sx={{
                color: 'white',
                mb: 2,
                position: 'absolute',
                left: 20,
                top: 20
              }}
            >
              Back
            </Button>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}>
              TATA Final Report
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400, maxWidth: 600, mx: 'auto', mb: 4 }}>
              Professional audit tool for TATA dealership stock verification
            </Typography>

            <Breadcrumbs
              separator={<NavigateNext fontSize="small" />}
              sx={{ justifyContent: 'center', display: 'flex', color: 'white' }}
            >
              <Link
                underline="hover"
                color="inherit"
                href="/"
                onClick={(e) => { e.preventDefault(); navigate('/admin'); }}
                sx={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}
              >
                <DashboardIcon sx={{ mr: 0.5 }} fontSize="inherit" />
                Dashboard
              </Link>
              <Typography sx={{ fontWeight: 600 }}>TATA Final Report</Typography>
            </Breadcrumbs>
          </Box>
        </Container>
      </HeroSection>

      <Container maxWidth="xl" sx={{ mt: -5, pb: 8, position: 'relative', zIndex: 2 }}>
        {/* Step Indicator */}
        <Box sx={{ mb: 4 }}>
          <StyledStepper activeStep={currentStep} alternativeLabel={!isMobile}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </StyledStepper>
        </Box>

        {/* Loading Overlay */}
        {loading && <LoadingOverlay open={loading} message="Processing files..." />}

        {/* Error/Success Alerts */}
        {error && (
          <Fade in>
            <Alert
              severity="error"
              sx={{ mt: 4, borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          </Fade>
        )}
        {success && (
          <Fade in>
            <Alert
              severity="success"
              sx={{ mt: 4, borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              onClose={() => setSuccess('')}
            >
              {success}
            </Alert>
          </Fade>
        )}

        {/* STEP 1: COUNT SHEET CONSOLIDATION */}
        {currentStep === 0 && (
          <Box>
            <ProfessionalCard sx={{ mb: 4 }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: tataPrimaryColor }}>
                  Step 1: Consolidate Count Sheet
                </Typography>
                <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                  Upload Count Sheet and After Sheet to consolidate physical count data
                </Typography>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <UploadCard onClick={() => document.getElementById('count-upload')?.click()}>
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Box sx={{ mb: 2 }}>
                          <Description className="upload-icon" sx={{ fontSize: 48, color: '#64748B', transition: 'all 0.3s' }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Count Sheet</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Upload the physical count sheet from audit
                        </Typography>
                        {countFileName ? (
                          <FilePreview
                            title="Count Sheet"
                            fileName={countFileName}
                            onClear={(e: any) => { e.stopPropagation(); clearFile('count'); }}
                          />
                        ) : (
                          <ActionButton variant="contained" fullWidth sx={{ bgcolor: tataPrimaryColor }}>
                            Select Count Sheet
                          </ActionButton>
                        )}
                        <input id="count-upload" type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'count')} />
                      </CardContent>
                    </UploadCard>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <UploadCard onClick={() => document.getElementById('after-upload')?.click()}>
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Box sx={{ mb: 2 }}>
                          <Assessment className="upload-icon" sx={{ fontSize: 48, color: '#64748B', transition: 'all 0.3s' }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>After Sheet</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Upload the reference after sheet with part details
                        </Typography>
                        {afterFileName ? (
                          <FilePreview
                            title="After Sheet"
                            fileName={afterFileName}
                            onClear={(e: any) => { e.stopPropagation(); clearFile('after'); }}
                          />
                        ) : (
                          <ActionButton variant="contained" fullWidth sx={{ bgcolor: '#10B981' }}>
                            Select After Sheet
                          </ActionButton>
                        )}
                        <input id="after-upload" type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'after')} />
                      </CardContent>
                    </UploadCard>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <ActionButton
                    variant="contained"
                    size="large"
                    disabled={!countSheetData || !afterSheetData || loading}
                    onClick={consolidateCountSheet}
                    startIcon={loading ? <CircularProgress size={20} /> : <CompareArrows />}
                    sx={{
                      px: 8,
                      py: 2,
                      bgcolor: tataPrimaryColor,
                      fontSize: '1.1rem',
                      '&:hover': { bgcolor: '#A04000' }
                    }}
                  >
                    {loading ? 'Consolidating...' : 'Consolidate Count Sheet'}
                  </ActionButton>
                </Box>

                {consolidatedCountSheet.length > 0 && (
                  <Alert severity="success" sx={{ mt: 3 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      ✓ Count Sheet Consolidated Successfully
                    </Typography>
                    <Typography variant="body2">
                      {consolidatedCountSheet.length} parts consolidated. Proceed to Step 2.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </ProfessionalCard>
          </Box>
        )}

        {/* STEP 2: GENERATE COMPILE REPORT */}
        {currentStep === 1 && consolidatedCountSheet.length > 0 && (
          <Box>
            <ProfessionalCard sx={{ mb: 4, borderLeft: `6px solid ${tataPrimaryColor}` }}>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, color: tataPrimaryColor }}>
                  Step 2: Generate Compile Report
                </Typography>
                <Typography variant="body1" sx={{ mb: 4, color: 'text.secondary' }}>
                  Upload OnHand DMS sheet to generate the final compile report
                </Typography>

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12 }}>
                    <UploadCard onClick={() => document.getElementById('onhand-upload')?.click()}>
                      <CardContent sx={{ p: 3, textAlign: 'center' }}>
                        <Box sx={{ mb: 2 }}>
                          <Inventory className="upload-icon" sx={{ fontSize: 48, color: '#64748B', transition: 'all 0.3s' }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>OnHand Sheet (DMS)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Upload DMS OnHand stock report for comparison
                        </Typography>
                        {onHandFileName ? (
                          <FilePreview
                            title="OnHand Sheet"
                            fileName={onHandFileName}
                            onClear={(e: any) => { e.stopPropagation(); clearFile('onhand'); }}
                          />
                        ) : (
                          <ActionButton variant="contained" fullWidth sx={{ bgcolor: '#8B5CF6' }}>
                            Select OnHand Sheet
                          </ActionButton>
                        )}
                        <input id="onhand-upload" type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'onhand')} />
                      </CardContent>
                    </UploadCard>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <ActionButton
                    variant="contained"
                    size="large"
                    disabled={!onHandSheetData || loading}
                    onClick={generateCompileReport}
                    startIcon={loading ? <CircularProgress size={20} /> : <TableChart />}
                    sx={{
                      px: 8,
                      py: 2,
                      bgcolor: tataPrimaryColor,
                      fontSize: '1.1rem',
                      '&:hover': { bgcolor: '#A04000' }
                    }}
                  >
                    {loading ? 'Generating...' : 'Generate Compile Report'}
                  </ActionButton>
                </Box>

                {/* Show success message after generation but before moving to step 3 */}
                {compileReport.length > 0 && currentStep === 1 && (
                  <Alert severity="success" sx={{ mt: 3 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      ✓ Compile Report Generated Successfully
                    </Typography>
                    <Typography variant="body2">
                      {compileReport.length} parts processed. Please proceed to Step 3 to view and download the full report.
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </ProfessionalCard>
          </Box>
        )}

        {/* STEP 3: REPORT VIEW AND DOWNLOAD (ONLY FULL COLUMNS HERE) */}
        {currentStep === 2 && compileReport.length > 0 && (
          <Box>
            <ProfessionalCard sx={{ mb: 4, borderLeft: `6px solid #10B981` }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }}>
                      <CheckCircle />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: tataPrimaryColor }}>
                        Report Ready for Download
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {compileReport.length} parts | {excessParts.length} excess | {shortageParts.length} shortage
                      </Typography>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={2}>
                    <ActionButton
                      variant="outlined"
                      onClick={resetAll}
                      startIcon={<RestartAlt />}
                      sx={{ color: '#EF4444', borderColor: '#EF4444' }}
                    >
                      Start New Audit
                    </ActionButton>
                    <ActionButton
                      variant="contained"
                      onClick={downloadExcel}
                      startIcon={<Download />}
                      sx={{ bgcolor: tataPrimaryColor, '&:hover': { bgcolor: '#A04000' } }}
                    >
                      Download Report
                    </ActionButton>
                  </Stack>
                </Box>
              </CardContent>
            </ProfessionalCard>

            {/* Report Configuration */}
            <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: tataPrimaryColor }}>
                Report Configuration
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Report Title / Dealership Name"
                    placeholder="e.g., TATA MOTORS - DELHI BRANCH"
                    value={reportTitle}
                    onChange={(e) => setReportTitle(e.target.value)}
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ mr: 1 }}>
                          <Description color="action" />
                        </Box>
                      ),
                    }}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Dealer Name"
                    value={dealerName}
                    onChange={(e) => setDealerName(e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    size="small"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Audit Start Date"
                    value={auditStartDate}
                    onChange={(e) => setAuditStartDate(e.target.value)}
                    size="small"
                    placeholder="DD-MM-YYYY"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <TextField
                    fullWidth
                    label="Audit End Date"
                    value={auditEndDate}
                    onChange={(e) => setAuditEndDate(e.target.value)}
                    size="small"
                    placeholder="DD-MM-YYYY"
                  />
                </Grid>
              </Grid>
            </Paper>

            <Fade in timeout={800}>
              <Box sx={{ mb: 6 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Compile Report Data (All {compileReport.length} Parts)
                  </Typography>
                  <Chip
                    label={`${compileReport.length} rows`}
                    color="primary"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                {/* SIMPLE TABLE THAT ACTUALLY WORKS */}
                <Paper elevation={0} sx={{
                  maxHeight: 500,
                  overflow: 'auto',
                  borderRadius: '24px',
                  border: '1px solid #E2E8F0'
                }}>
                  <TableContainer>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                          <TableCell><strong>Part Number</strong></TableCell>
                          <TableCell><strong>OEM Part</strong></TableCell>
                          <TableCell><strong>Description</strong></TableCell>
                          <TableCell><strong>Category</strong></TableCell>
                          <TableCell align="right"><strong>Part Price</strong></TableCell>
                          <TableCell align="right"><strong>Stock Qty</strong></TableCell>
                          <TableCell align="right"><strong>Phy Qty</strong></TableCell>
                          <TableCell align="right"><strong>Dmg Qty</strong></TableCell>
                          <TableCell align="right"><strong>P4I</strong></TableCell>
                          <TableCell align="right"><strong>Final Phy</strong></TableCell>
                          <TableCell align="right"><strong>Diff</strong></TableCell>
                          <TableCell align="right"><strong>Stock Value</strong></TableCell>
                          <TableCell align="right"><strong>Phy Value</strong></TableCell>
                          <TableCell align="right"><strong>Short/Excess</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {compileReport.slice(0, 100).map((row, index) => (
                          <TableRow
                            key={`${row.partNumber}_${index}`}
                            hover
                            sx={{
                              '&:nth-of-type(odd)': { backgroundColor: '#fafafa' },
                              '&:hover': { backgroundColor: '#f0f9ff' }
                            }}
                          >
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                {row.partNumber}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                {row.oemPart}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <Typography variant="body2">
                                {row.partDescription}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={row.category}
                                size="small"
                                sx={{
                                  bgcolor: row.category === 'SPARES' ? '#e3f2fd' :
                                    row.category === 'ACCESSORIES' ? '#f3e5f5' :
                                      row.category === 'BATTERY' ? '#e8f5e9' : '#f5f5f5',
                                  fontWeight: 600,
                                  fontSize: '0.75rem'
                                }}
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a237e' }}>
                                ₹ {row.partPrice.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{
                                fontWeight: 600,
                                color: row.stockQty === 0 ? '#9e9e9e' : '#1976d2'
                              }}>
                                {row.stockQty}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{
                                fontWeight: 600,
                                color: row.phyQty === 0 ? '#9e9e9e' : '#388e3c'
                              }}>
                                {row.phyQty}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{
                                fontWeight: row.dmgQty > 0 ? 700 : 400,
                                color: row.dmgQty > 0 ? '#d32f2f' : 'inherit'
                              }}>
                                {row.dmgQty}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                0
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {row.finalPhy}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{
                                fontWeight: 700,
                                color: row.diff > 0 ? '#2e7d32' : row.diff < 0 ? '#c62828' : 'inherit'
                              }}>
                                {row.diff > 0 ? `+${row.diff}` : row.diff}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0d47a1' }}>
                                ₹ {row.stockValue.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1b5e20' }}>
                                ₹ {row.phyValue.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{
                                fontWeight: 700,
                                color: row.shortExcess > 0 ? '#2e7d32' : row.shortExcess < 0 ? '#c62828' : 'inherit'
                              }}>
                                {row.shortExcess > 0 ? '+' : ''}₹ {Math.abs(row.shortExcess).toFixed(2)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {compileReport.length > 100 && (
                    <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid #E2E8F0', bgcolor: '#f8f9fa' }}>
                      <Typography variant="body2" color="text.secondary">
                        Showing first 100 of {compileReport.length} rows. Download full report for complete data.
                      </Typography>
                    </Box>
                  )}
                </Paper>

                {/* Quick Stats */}
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#e3f2fd', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Rows with Price</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2' }}>
                        {compileReport.filter(r => r.partPrice > 0).length}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#e8f5e9', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Excess Parts</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                        {compileReport.filter(r => r.diff > 0).length}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fff3e0', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Avg Price</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef6c00' }}>
                        ₹ {compileReport.length > 0 ?
                          (compileReport.reduce((sum, r) => sum + r.partPrice, 0) / compileReport.length).toFixed(2) :
                          '0.00'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', bgcolor: '#fce4ec', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total Value Diff</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#ad1457' }}>
                        ₹ {Math.abs(compileReport.reduce((sum, r) => sum + r.shortExcess, 0)).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Legend */}
                <Box sx={{ display: 'flex', gap: 2, mt: 3, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#2e7d32' }} />
                    <Typography variant="caption">Excess (Physical &gt; DMS)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#c62828' }} />
                    <Typography variant="caption">Shortage (Physical &lt; DMS)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#d32f2f' }} />
                    <Typography variant="caption">Damaged Parts</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#9e9e9e' }} />
                    <Typography variant="caption">Zero Quantity</Typography>
                  </Box>
                </Box>
              </Box>
            </Fade>
            {/* Summary Statistics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <StatsCard sx={{ '--accent-color': tataPrimaryColor }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Total Parts
                        </Typography>
                        <Typography variant="h3" sx={{ color: tataPrimaryColor, fontWeight: 700 }}>
                          {compileReport.length.toLocaleString()}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha(tataPrimaryColor, 0.1), color: tataPrimaryColor }}>
                        <Inventory />
                      </Avatar>
                    </Box>
                  </CardContent>
                </StatsCard>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <StatsCard sx={{ '--accent-color': '#10B981' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Excess Parts
                        </Typography>
                        <Typography variant="h3" sx={{ color: '#10B981', fontWeight: 700 }}>
                          {excessParts.length.toLocaleString()}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }}>
                        <CheckCircle />
                      </Avatar>
                    </Box>
                  </CardContent>
                </StatsCard>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <StatsCard sx={{ '--accent-color': '#EF4444' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Shortage Parts
                        </Typography>
                        <Typography variant="h3" sx={{ color: '#EF4444', fontWeight: 700 }}>
                          {shortageParts.length.toLocaleString()}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha('#EF4444', 0.1), color: '#EF4444' }}>
                        <Warning />
                      </Avatar>
                    </Box>
                  </CardContent>
                </StatsCard>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <StatsCard sx={{ '--accent-color': '#8B5CF6' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Value Difference
                        </Typography>
                        <Typography variant="h5" sx={{ color: '#8B5CF6', fontWeight: 700 }}>
                          ₹ {summaryData.length > 0
                            ? Math.abs(summaryData[summaryData.length - 1]?.netDifferenceValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha('#8B5CF6', 0.1), color: '#8B5CF6' }}>
                        <TableChart />
                      </Avatar>
                    </Box>
                  </CardContent>
                </StatsCard>
              </Grid>
            </Grid>

            {/* Category Summary Table - DETAILED VERSION */}
            {summaryData.length > 0 && (
              <ProfessionalCard sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, color: tataPrimaryColor, fontWeight: 700 }}>
                    Category Summary
                  </Typography>

                  {/* Demo format header */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <Chip label="DMS Stock" size="small" sx={{ bgcolor: '#e3f2fd' }} />
                    <Chip label="Physical Stock as Counted" size="small" sx={{ bgcolor: '#e8f5e9' }} />
                    <Chip label="Excess Found" size="small" sx={{ bgcolor: '#fff3e0' }} />
                    <Chip label="Short Found" size="small" sx={{ bgcolor: '#ffebee' }} />
                  </Box>

                  <TableContainer component={Paper} variant="outlined" sx={{
                    maxHeight: 500,
                    overflow: 'auto',
                    '& .MuiTableCell-root': {
                      borderRight: '1px solid #e0e0e0',
                      '&:last-child': { borderRight: 'none' }
                    }
                  }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        {/* Main Category Header */}
                        <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                          <TableCell rowSpan={2} sx={{ fontWeight: 700, borderRight: '2px solid #e0e0e0', backgroundColor: '#e98330ff' }}>Category</TableCell>
                          <TableCell colSpan={3} align="center" sx={{ fontWeight: 700, bgcolor: '#e3f2fd', borderRight: '2px solid #e0e0e0' }}>DMS Stock</TableCell>
                          <TableCell colSpan={3} align="center" sx={{ fontWeight: 700, bgcolor: '#e8f5e9', borderRight: '2px solid #e0e0e0' }}>Physical Stock as Counted</TableCell>
                          <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: '#64d178ff', borderRight: '2px solid #e0e0e0' }}>Excess Found</TableCell>
                          <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: '#fc3a57ff', borderRight: '2px solid #e0e0e0' }}>Short Found</TableCell>
                          <TableCell colSpan={2} align="center" sx={{ fontWeight: 700, bgcolor: '#e6cf6bff' }}>Net Difference</TableCell>
                        </TableRow>

                        {/* Sub Headers */}
                        <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                          {/* DMS Stock */}
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Part Lines</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '2px solid #e0e0e0' }}>Quantity</TableCell>

                          {/* Physical Stock */}
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Part Lines</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '2px solid #e0e0e0' }}>Quantity</TableCell>

                          {/* Excess Found */}
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '2px solid #e0e0e0' }}>Part Lines</TableCell>

                          {/* Short Found */}
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '2px solid #e0e0e0' }}>Part Lines</TableCell>

                          {/* Net Difference */}
                          <TableCell align="right" sx={{ fontWeight: 600, borderRight: '1px solid #e0e0e0' }}>Value</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Diff %</TableCell>
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {/* 🔴 FILTER: Only show rows that have non-zero values, but ALWAYS show Total row */}
                        {summaryData
                          .filter((row, index) => {
                            // Always show the last row (Total)
                            if (index === summaryData.length - 1) return true;

                            // For other rows, check if ANY value is non-zero
                            return (
                              row.dmsValue !== 0 ||
                              row.dmsPartLines !== 0 ||
                              row.dmsQuantity !== 0 ||
                              row.physicalValue !== 0 ||
                              row.physicalPartLines !== 0 ||
                              row.physicalQuantity !== 0 ||
                              row.excessValue !== 0 ||
                              row.excessPartLines !== 0 ||
                              row.shortValue !== 0 ||
                              row.shortPartLines !== 0 ||
                              row.netDifferenceValue !== 0 ||
                              row.netDifferencePercent !== 0
                            );
                          })
                          .map((row, index, filteredArray) => {
                            // Check if this is the last item in the FILTERED array (for Total row styling)
                            const isLastRow = index === filteredArray.length - 1;

                            return (
                              <TableRow
                                key={index}
                                hover
                                sx={{
                                  '&:last-child': {
                                    bgcolor: isLastRow ? '#f8f9fa' : 'inherit',
                                    fontWeight: isLastRow ? 700 : 400,
                                    '& td': { fontWeight: isLastRow ? 700 : 400 }
                                  }
                                }}
                              >
                                <TableCell sx={{
                                  fontWeight: row.category === 'Total' ? 700 : 600,
                                  borderRight: '2px solid #e0e0e0',
                                  position: 'sticky',
                                  left: 0,
                                  bgcolor: row.category === 'Total' ? '#517ce0ff' : 'white',
                                  zIndex: 1
                                }}>
                                  {row.category}
                                </TableCell>

                                {/* DMS Stock */}
                                <TableCell align="right" sx={{ borderRight: '1px solid #e0e0e0' }}>
                                  ₹ {row.dmsValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{ borderRight: '1px solid #e0e0e0' }}>
                                  {row.dmsPartLines.toLocaleString()}
                                </TableCell>
                                <TableCell align="right" sx={{ borderRight: '2px solid #e0e0e0' }}>
                                  {row.dmsQuantity.toLocaleString()}
                                </TableCell>

                                {/* Physical Stock */}
                                <TableCell align="right" sx={{ borderRight: '1px solid #e0e0e0' }}>
                                  ₹ {row.physicalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{ borderRight: '1px solid #e0e0e0' }}>
                                  {row.physicalPartLines.toLocaleString()}
                                </TableCell>
                                <TableCell align="right" sx={{ borderRight: '2px solid #e0e0e0' }}>
                                  {row.physicalQuantity.toLocaleString()}
                                </TableCell>

                                {/* Excess Found */}
                                <TableCell align="right" sx={{
                                  borderRight: '1px solid #e0e0e0',
                                  color: '#10B981',
                                  fontWeight: row.excessValue > 0 ? 600 : 400
                                }}>
                                  ₹ {row.excessValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{
                                  borderRight: '2px solid #e0e0e0',
                                  color: '#10B981',
                                  fontWeight: row.excessPartLines > 0 ? 600 : 400
                                }}>
                                  {row.excessPartLines.toLocaleString()}
                                </TableCell>

                                {/* Short Found */}
                                <TableCell align="right" sx={{
                                  borderRight: '1px solid #e0e0e0',
                                  color: '#EF4444',
                                  fontWeight: row.shortValue > 0 ? 600 : 400
                                }}>
                                  ₹ {row.shortValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{
                                  borderRight: '2px solid #e0e0e0',
                                  color: '#EF4444',
                                  fontWeight: row.shortPartLines > 0 ? 600 : 400
                                }}>
                                  {row.shortPartLines.toLocaleString()}
                                </TableCell>

                                {/* Net Difference */}
                                <TableCell align="right" sx={{
                                  borderRight: '1px solid #e0e0e0',
                                  color: row.netDifferenceValue >= 0 ? '#10B981' : '#EF4444',
                                  fontWeight: 600
                                }}>
                                  ₹ {Math.abs(row.netDifferenceValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell align="right" sx={{
                                  color: row.netDifferencePercent >= 0 ? '#10B981' : '#EF4444',
                                  fontWeight: 600
                                }}>
                                  {row.netDifferencePercent > 0 ? '+' : ''}{row.netDifferencePercent.toFixed(1)}%
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Legend */}
                  <Box sx={{ display: 'flex', gap: 3, mt: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#e3f2fd' }} />
                      <Typography variant="caption">DMS Stock (System)</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#e8f5e9' }} />
                      <Typography variant="caption">Physical Counted</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#fff3e0' }} />
                      <Typography variant="caption">Excess Found</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: '#ffebee' }} />
                      <Typography variant="caption">Short Found</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </ProfessionalCard>
            )}

            {/* Final Download Button */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 6,
              pb: 4
            }}>
              <Zoom in={!!compileReport}>
                <div>
                  <Box>
                    <ActionButton
                      variant="contained"
                      size="large"
                      startIcon={<Download />}
                      onClick={downloadExcel}
                      disabled={!compileReport}
                      sx={{
                        px: 6,
                        py: 2,
                        fontSize: '1.1rem',
                        backgroundColor: tataPrimaryColor,
                        '&:hover': { backgroundColor: '#A04000' },
                        boxShadow: '0 4px 14px 0 rgba(211, 84, 0, 0.4)',
                      }}
                    >
                      DOWNLOAD TATA AUDIT REPORT
                    </ActionButton>
                    <ActionButton
                      variant="outlined"
                      onClick={() => setShowPostAudit(true)}
                      startIcon={<Description />}
                      sx={{ color: tataPrimaryColor, borderColor: tataPrimaryColor, marginLeft: 5 }}
                    >
                      Post Document
                    </ActionButton>




                  </Box>
                  {showPostAudit && (
                    <PostAuditDocument
                      logoBase64={Logo}
                      summaryData={summaryData}
                      shortageParts={shortageParts.map(r => ({
                        partNumber: r.partNumber, partDesc: r.partDescription,
                        category: r.category, partPrice: r.partPrice,
                        stockQty: r.stockQty, phyQty: r.phyQty, dmgQty: r.dmgQty,
                        p41: r.p4i, finalPhy: r.finalPhy, diff: r.diff,
                        stockValue: r.stockValue, phyValue: r.phyValue,
                        shortExcess: r.shortExcess, spmRemark: '', location: '',
                      }))}
                      excessParts={excessParts.map(r => ({
                        partNumber: r.partNumber, partDesc: r.partDescription,
                        category: r.category, partPrice: r.partPrice,
                        stockQty: r.stockQty, phyQty: r.phyQty, dmgQty: r.dmgQty,
                        p41: r.p4i, finalPhy: r.finalPhy, diff: r.diff,
                        stockValue: r.stockValue, phyValue: r.phyValue,
                        shortExcess: r.shortExcess, spmRemark: '', location: '',
                      }))}
                      dealerName={dealerName}
                      location={location}
                      auditStartDate={auditStartDate}
                      auditEndDate={auditEndDate}
                      onClose={() => setShowPostAudit(false)}
                    />
                  )}
                </div>
              </Zoom>
            </Box>
          </Box>
        )}
      </Container>
    </Box>

  );
};

export default TataFinalReport;