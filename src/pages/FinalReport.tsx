// src/pages/admin/StockComparison.tsx
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
  LinearProgress,
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
  type AlertColor
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
  Groups,
  AccountCircle,
  Dashboard as DashboardIcon,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  TrendingUp,
  Description,
  Inventory,
  Assessment,
  CloudUpload,
  RestartAlt,
  SaveAlt
} from '@mui/icons-material';
import { DataGrid, type GridRowModel } from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '../components/common/LoadingOverlay';
import ProfessionalCard from '../components/common/ProfessionalCard';
import StatsCard from '../components/common/StatsCard';

// Type definitions
interface UploadedFileData {
  [key: string]: any;
}

interface UnmatchedEntry {
  partNo: string;
  quantity: number;
  rack?: string;
  wrongRack?: string;
  availableRacks?: string;
}

interface UnmatchedEntries {
  mismatchedRack: UnmatchedEntry[];
  emptyRack: UnmatchedEntry[];
  partNotFound: UnmatchedEntry[];
}

interface DupStats {
  dmsDupCount: number;
  physDupCount: number;
  physOnlyDupCount: number;
  physOnlyUniqueCount: number;
  physUniqueCount: number;
}

interface SummaryData {
  partBeforeDup: number;
  partAfterDup: number;
  shortageCount: number;
  excessCount: number;
  shortageValue: number;
  excessValue: number;
  ndpBefore: number;
  ndpAfter: number;
  mrpAfter: number;
  lineItemsDup: number;
  lineItemsUnique: number;
  extrasUnique: number;
}

interface DmsInfo {
  description: string;
  ndp: number;
  location: string;
}

interface PhysicalInfo {
  quantity: number;
  ndp: number;
  mrp: number;
  description: string;
  location: string;
  rack: string;
}

interface ProcessRowUpdateParams {
  newRow: GridRowModel;
  oldRow: GridRowModel;
}

interface ProcessRowUpdateErrorParams {
  error: Error;
}

// Helper function types
interface GridData {
  rows: any[];
  columns: any[];
}

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
    borderColor: '#004F98',
    backgroundColor: '#F8FAFC',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    '& .upload-icon': {
      transform: 'scale(1.1) rotate(5deg)',
      color: '#004F98'
    }
  }
}));

const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #004F98 0%, #002D5B 100%)',
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
    color: '#004F98',
  },
  '& .MuiStepIcon-root.Mui-completed': {
    color: '#10B981',
  },
  '& .MuiStepLabel-label': {
    fontWeight: 600,
  }
}));

// Helper function types
interface GridData {
  rows: any[];
  columns: any[];
}

const buildGridData = (data: any[][]): GridData => {
  if (!data || data.length < 2) return { rows: [], columns: [] };

  const headers = data[0];
  const rows = data.slice(1).map((row, index) => {
    let rowObj: any = { id: index + 1 };
    headers.forEach((header, colIndex) => {
      rowObj[header] = row[colIndex];
    });
    return rowObj;
  });

  const columns = headers.map((header) => ({
    field: header,
    headerName: header,
    flex: 1,
    editable: header === "Phy Stock",
  }));

  return { rows, columns };
};

const FilePreview = ({ title, fileName, onClear }: { title: string, fileName: string, onClear: (e: React.MouseEvent) => void }) => (
  <Paper sx={{ p: 2, borderRadius: '16px', bgcolor: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Description sx={{ color: '#004F98' }} />
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{title}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }} noWrap>{fileName}</Typography>
      </Box>
    </Box>
    <IconButton size="small" onClick={onClear} sx={{ color: '#EF4444' }}>
      <Delete fontSize="small" />
    </IconButton>
  </Paper>
);

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

const StockComparison: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const primaryColor = '#004F98';
  const secondaryColor = '#0066CC';

  // State variables with types
  const [dmsData, setDmsData] = useState<any[][] | null>(null);
  const [physicalData, setPhysicalData] = useState<any[][] | null>(null);
  const [beforeData, setBeforeData] = useState<any[][] | null>(null);
  const [afterData, setAfterData] = useState<any[][] | null>(null);
  const [reportData, setReportData] = useState<any[][] | null>(null);
  const [dmsFileName, setDmsFileName] = useState<string>('');
  const [physicalFileName, setPhysicalFileName] = useState<string>('');
  const [beforeFileName, setBeforeFileName] = useState<string>('');
  const [afterFileName, setAfterFileName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [originalReportData, setOriginalReportData] = useState<any[][] | null>(null);
  const [processedDmsMap, setProcessedDmsMap] = useState<Map<string, number> | null>(null);
  const [processedPhysicalMap, setProcessedPhysicalMap] = useState<Map<string, PhysicalInfo> | null>(null);
  const [dmsInfoMap, setDmsInfoMap] = useState<Map<string, DmsInfo> | null>(null);
  const [initialDmsMapForReport, setInitialDmsMapForReport] = useState<Map<string, number> | null>(null);
  const [tvsTemplateData, setTvsTemplateData] = useState<any[][] | null>(null);
  const [dealerId, setDealerId] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [manufacturerId, setManufacturerId] = useState<string>('');
  const [taxable, setTaxableId] = useState<string>('');
  const [mismatchedEntries, setMismatchedEntries] = useState<any[]>([]);
  const [unmatchedEntries, setUnmatchedEntries] = useState<UnmatchedEntries>({
    mismatchedRack: [],
    emptyRack: [],
    partNotFound: []
  });
  const [incompleteParts, setIncompleteParts] = useState<any[]>([]);
  const [tvsAfterFileName, setTvsAfterFileName] = useState<string>('');
  const [tvsAfterData, setTvsAfterData] = useState<any[][] | null>(null);
  const [forceUpdate, setForceUpdate] = useState<number>(0);
  const steps = ['Initial Report', 'Before Adjustment', 'After Adjustment'];
  const [dupStats, setDupStats] = useState<DupStats | null>(null);
  const tvsAfterInputRef = useRef<HTMLInputElement>(null);
  const [summaryHeader, setSummaryHeader] = useState<string>('');
  const [tvsStockTotal, setTvsStockTotal] = useState<number>(0);
  const [highestQtySubtractions, setHighestQtySubtractions] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const handleRefreshEvent = () => {
      resetAll();
    };
    window.addEventListener('admin-refresh', handleRefreshEvent);
    return () => {
      window.removeEventListener('admin-refresh', handleRefreshEvent);
    };
  }, []);

  const findColumnIndex = (headers: any[], possibleNames: string[]): number => {
    if (!headers || headers.length === 0) return -1;
    for (let name of possibleNames) {
      const index = headers.findIndex(header =>
        header !== null && header !== undefined && String(header).toLowerCase().includes(name.toLowerCase())
      );
      if (index !== -1) return index;
    }
    return -1;
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>, fileType: string): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');

    if (fileType === 'dms') {
      setDmsFileName(file.name);
    } else if (fileType === 'physical') {
      setPhysicalFileName(file.name);
    } else if (fileType === 'before') {
      setBeforeFileName(file.name);
    } else if (fileType === 'after') {
      setAfterFileName(file.name);
    } else if (fileType === 'tvsAfter') {
      setTvsAfterFileName(file.name);
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      let jsonData: any[][];
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (fileType === 'dms') {
          setDmsData(jsonData);
        } else if (fileType === 'physical') {
          setPhysicalData(jsonData);
        } else if (fileType === 'before') {
          setBeforeData(jsonData);
        } else if (fileType === 'after') {
          setAfterData(jsonData);
        } else if (fileType === 'tvsAfter') {
          setTvsAfterData(jsonData);
        }
      } catch (err: any) {
        setError(`Error reading ${fileType} file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const clearFile = (fileType: string): void => {
    if (fileType === 'dms') {
      setDmsData(null);
      setDmsFileName('');
      resetAll();
    } else if (fileType === 'physical') {
      setPhysicalData(null);
      setPhysicalFileName('');
      resetAll();
    } else if (fileType === 'before') {
      setBeforeData(null);
      setBeforeFileName('');
      if (currentStep === 1) {
        generateInitialReport();
      }
    } else if (fileType === 'after') {
      setAfterData(null);
      setAfterFileName('');
      if (currentStep === 2) {
        if (beforeData) {
          applyBeforeFileAdjustment();
        } else {
          generateInitialReport();
        }
      }
    } else if (fileType === 'tvsAfter') {
      setTvsAfterData(null);
      setTvsAfterFileName('');
      setTvsTemplateData(null);
      setUnmatchedEntries({ mismatchedRack: [], emptyRack: [], partNotFound: [] });
      setHighestQtySubtractions(new Map());
      if (tvsAfterInputRef?.current) tvsAfterInputRef.current.value = '';
    }
  };

  const generateInitialReport = (): void => {
    if (!dmsData || !physicalData) {
      setError('Please upload both DMS and Physical files first.');
      return;
    }

    setLoading(true);
    setError('');
    setBeforeData(null);
    setBeforeFileName('');
    setAfterData(null);
    setAfterFileName('');
    setCurrentStep(0);
    setTvsTemplateData(null);
    setUnmatchedEntries({ mismatchedRack: [], emptyRack: [], partNotFound: [] });
    setHighestQtySubtractions(new Map());

    setTimeout(() => {
      try {
        const dmsHeaders = dmsData[0] || [];
        const physicalHeaders = physicalData[0] || [];

        const findColumn = (headers: any[], names: string[]): number => {
          const index = findColumnIndex(headers, names);
          if (index === -1) {
            console.warn(`Could not find a column with names like: ${names.join(', ')}`);
          }
          return index;
        };

        const partNoDmsIndex = findColumn(dmsHeaders, ['part no', 'partno', 'part number', 'part code', 'item']);
        const qtyDmsIndex = findColumn(dmsHeaders, ['free qty', 'qty', 'quantity', 'balance']);
        const descDmsIndex = findColumn(dmsHeaders, ['description', 'material description', 'item description']);
        const ndpDmsIndex = findColumn(dmsHeaders, ['ndp', 'net dealer price', 'unit price']);
        const locationDmsIndex = findColumn(dmsHeaders, ['location name', 'location']);

        const partNoPhysicalIndex = findColumn(physicalHeaders, ['part no', 'partno', 'part number', 'part code', 'item']);
        const qtyPhysicalIndex = findColumn(physicalHeaders, ['qty', 'quantity', 'stock', 'phy qty', 'count']);
        const ndpIndex = findColumn(physicalHeaders, ['ndp', 'net dealer price', 'unit price']);
        const mrpIndex = findColumn(physicalHeaders, ['mrp', 'max retail price', 'retail price']);
        const descIndex = findColumn(physicalHeaders, ['description', 'material description', 'item description']);
        const locationPhysicalIndex = findColumn(physicalHeaders, ['location', 'bin', 'storage']);
        const rackIndex = findColumn(physicalHeaders, ['rack', 'shelf', 'row']);

        if (partNoDmsIndex === -1 || qtyDmsIndex === -1) {
          throw new Error('DMS file must contain Part Number and Stock/Quantity columns.');
        }
        if (partNoPhysicalIndex === -1 || qtyPhysicalIndex === -1) {
          throw new Error('Physical file must contain Part Number and Quantity columns.');
        }

        const dmsMap = new Map<string, number>();
        const dmsInfo = new Map<string, DmsInfo>();
        const physicalMap = new Map<string, PhysicalInfo>();

        // Process DMS data
        for (let i = 1; i < dmsData.length; i++) {
          const row = dmsData[i];
          if (!row || row[partNoDmsIndex] === undefined || row[partNoDmsIndex] === null) continue;
          const partNo = String(row[partNoDmsIndex]).trim().toUpperCase();
          const quantity = parseFloat(row[qtyDmsIndex]) || 0;
          if (partNo) {
            dmsMap.set(partNo, (dmsMap.get(partNo) || 0) + quantity);
            if (!dmsInfo.has(partNo)) {
              dmsInfo.set(partNo, {
                description: descDmsIndex !== -1 ? String(row[descDmsIndex] || '').trim() : '',
                ndp: ndpDmsIndex !== -1 ? parseFloat(row[ndpDmsIndex]) || 0 : 0,
                location: locationDmsIndex !== -1 ? String(row[locationDmsIndex] || '').trim() : ''
              });
            }
          }
        }

        // Process Physical data
        for (let i = 1; i < physicalData.length; i++) {
          const row = physicalData[i];
          if (!row || row[partNoPhysicalIndex] === undefined || row[partNoPhysicalIndex] === null) continue;
          const partNo = String(row[partNoPhysicalIndex]).trim().toUpperCase();
          const quantity = parseFloat(row[qtyPhysicalIndex]) || 0;
          if (partNo) {
            const existing = physicalMap.get(partNo);
            if (existing) {
              existing.quantity += quantity;
            } else {
              physicalMap.set(partNo, {
                quantity: quantity,
                ndp: ndpIndex !== -1 ? parseFloat(row[ndpIndex]) || 0 : 0,
                mrp: mrpIndex !== -1 ? parseFloat(row[mrpIndex]) || 0 : 0,
                description: descIndex !== -1 ? String(row[descIndex] || '').trim() : '',
                location: locationPhysicalIndex !== -1 ? String(row[locationPhysicalIndex] || '').trim() : '',
                rack: rackIndex !== -1 ? String(row[rackIndex] || '').trim() : ''
              });
            }
          }
        }

        setProcessedDmsMap(new Map(dmsMap));
        setProcessedPhysicalMap(new Map(physicalMap));
        setDmsInfoMap(new Map(dmsInfo));
        setInitialDmsMapForReport(new Map(dmsMap));

        const report = generateReportFromMaps(dmsMap, physicalMap, dmsInfo);
        setReportData(report);

        const dmsPartNosRaw = dmsData.slice(1)
          .map(r => r[partNoDmsIndex])
          .filter(p => p !== undefined && p !== null && String(p).trim() !== '')
          .map(p => String(p).trim().toUpperCase());

        const physPartNosRaw = physicalData.slice(1)
          .map(r => r[partNoPhysicalIndex])
          .filter(p => p !== undefined && p !== null && String(p).trim() !== '')
          .map(p => String(p).trim().toUpperCase());

        const dmsDupCount = dmsPartNosRaw.length;
        const physDupCount = physPartNosRaw.length;

        const dmsSet = new Set(dmsPartNosRaw);
        const physSet = new Set(physPartNosRaw);

        const physOnlyDupCount = physPartNosRaw.filter(p => !dmsSet.has(p)).length;
        const physOnlyUniqueCount = [...physSet].filter(p => !dmsSet.has(p)).length;
        const physUniqueCount = physSet.size;

        setDupStats({
          dmsDupCount,
          physDupCount,
          physOnlyDupCount,
          physOnlyUniqueCount,
          physUniqueCount
        });

      } catch (err: any) {
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 100);
  };


  const generateReportFromMaps = (
    currentDmsMap: Map<string, number>,
    currentPhysicalMap: Map<string, PhysicalInfo>,
    dmsInfoMap: Map<string, DmsInfo>
  ): any[][] => {
    const report: any[][] = [];
    const headers = [
      'SI no', 'PartNo', 'Location', 'Part Description',
      'DMS Stk', 'Phy Stock', 'Short', 'Excess',
      'NDP', 'MRP',
      'Shortage Value', 'Excess Value',
      'Total NDP Value', 'Total MRP Value',
      'Before NDP'
    ];
    report.push(headers);

    const detailedRows: any[][] = [];
    const allPartNumbers = new Set([...currentPhysicalMap.keys(), ...currentDmsMap.keys(), ...dmsInfoMap.keys()]);

    let totalDms = 0, totalPhysical = 0, totalShort = 0, totalExcess = 0,
      totalShortageValue = 0, totalExcessValue = 0,
      totalPhysicalNdpValue = 0, totalPhysicalMrpValue = 0,
      totalOriginalDmsValue = 0;

    for (const partNo of allPartNumbers) {
      const physicalInfo = currentPhysicalMap.get(partNo);
      const dmsPartInfo = dmsInfoMap.get(partNo);

      const dmsQty = currentDmsMap.get(partNo) || 0;
      const physicalQty = physicalInfo ? physicalInfo.quantity : 0;

      const description = (physicalInfo ? physicalInfo.description : '') || (dmsPartInfo ? dmsPartInfo.description : '');
      const ndp = (physicalInfo ? physicalInfo.ndp : 0) || (dmsPartInfo ? dmsPartInfo.ndp : 0);
      const mrp = physicalInfo ? physicalInfo.mrp : 0;

      const short = Math.max(0, dmsQty - physicalQty);
      const excess = Math.max(0, physicalQty - dmsQty);

      const shortageValue = short * ndp;
      const excessValue = excess * ndp;

      const totalPhysicalNdp = physicalQty * ndp;
      const totalPhysicalMrp = physicalQty * mrp;

      const originalDmsValue = dmsQty * ndp;

      let location = '';
      if (physicalInfo && physicalInfo.location) {
        location = physicalInfo.location;
      } else if (dmsPartInfo && dmsPartInfo.location) {
        location = dmsPartInfo.location;
      }

      totalDms += dmsQty;
      totalPhysical += physicalQty;
      totalShort += short;
      totalExcess += excess;
      totalShortageValue += shortageValue;
      totalExcessValue += excessValue;
      totalPhysicalNdpValue += totalPhysicalNdp;
      totalPhysicalMrpValue += totalPhysicalMrp;
      totalOriginalDmsValue += originalDmsValue;

      detailedRows.push([
        0, partNo, location, description,
        dmsQty, physicalQty, short, excess,
        ndp, mrp,
        shortageValue, excessValue,
        totalPhysicalNdp, totalPhysicalMrp,
        originalDmsValue
      ]);
    }

    detailedRows.forEach((row, i) => row[0] = i + 1);

    report.push([
      '', '', '', 'TOTAL',
      totalDms, totalPhysical, totalShort, totalExcess,
      '', '',
      totalShortageValue, totalExcessValue,
      totalPhysicalNdpValue, totalPhysicalMrpValue,
      totalOriginalDmsValue
    ]);
    report.push(...detailedRows);

    return report;
  };

  const applyBeforeFileAdjustment = (): void => {
    if (!beforeData || !processedDmsMap || !processedPhysicalMap || !dmsInfoMap || !initialDmsMapForReport) {
      setError('Please upload a Before file or generate an initial report first.');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      try {
        const beforeHeaders = beforeData[0] || [];
        const partNoBeforeIndex = findColumnIndex(beforeHeaders, ['part no', 'partno', 'part number', 'part code', 'item']);
        const qtyBeforeIndex = findColumnIndex(beforeHeaders, ['qty', 'quantity', 'stock', 'phy qty', 'count']);

        if (partNoBeforeIndex === -1 || qtyBeforeIndex === -1) {
          throw new Error('Before file must contain Part Number and Quantity columns.');
        }

        const beforeMap = new Map<string, number>();
        let totalBeforeFileQty = 0;

        for (let i = 1; i < beforeData.length; i++) {
          const row = beforeData[i];
          if (!row || row.length <= Math.max(partNoBeforeIndex, qtyBeforeIndex)) {
            continue;
          }

          const partNoValue = row[partNoBeforeIndex];
          const qtyValue = row[qtyBeforeIndex];

          if (partNoValue === undefined || partNoValue === null) continue;

          const partNo = String(partNoValue).trim().toUpperCase();
          let quantity = 0;

          if (qtyValue !== undefined && qtyValue !== null) {
            if (typeof qtyValue === 'number') quantity = qtyValue;
            else if (typeof qtyValue === 'string') {
              const trimmedValue = qtyValue.trim();
              const directParse = parseFloat(trimmedValue);
              if (!isNaN(directParse)) quantity = directParse;
              else {
                const matches = trimmedValue.match(/(\d+\.?\d*)/);
                if (matches && matches[1]) quantity = parseFloat(matches[1]);
              }
            }
          }

          if (qtyValue === true) quantity = 1;

          if (partNo && quantity > 0) {
            beforeMap.set(partNo, (beforeMap.get(partNo) || 0) + quantity);
            totalBeforeFileQty += quantity;
          }
        }

        /*if (beforeMap.size === 0 && totalBeforeFileQty === 0) {
          throw new Error('No valid data found in the Before file. Please check that the file contains part numbers and positive quantities.');
        }*/

        const adjustedDmsMap = new Map(processedDmsMap);
        let matchedPartCount = 0;
        let totalSubtractedQty = 0;

        for (const [partNo, beforeQty] of beforeMap) {
          const existsInInitialDms = initialDmsMapForReport.has(partNo);
          if (!existsInInitialDms) continue;

          const dmsBefore = adjustedDmsMap.get(partNo) || 0;
          const dmsAfter = Math.max(0, dmsBefore - beforeQty);

          if (dmsBefore > 0) {
            matchedPartCount++;
            totalSubtractedQty += (dmsBefore - dmsAfter);
            adjustedDmsMap.set(partNo, dmsAfter);
          }
        }

        setProcessedDmsMap(adjustedDmsMap);

        const report = generateReportFromMaps(adjustedDmsMap, processedPhysicalMap, dmsInfoMap);
        setReportData(report);
        setCurrentStep(1);

        setError(`Before File applied: ${matchedPartCount} part numbers matched, total ${totalSubtractedQty.toLocaleString('en-IN')} qty subtracted from DMS stock.`);
      } catch (err: any) {
        setError(`Error applying Before file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const applyAfterFileAdjustment = (): void => {
    if (!afterData || !processedDmsMap || !physicalData || !dmsInfoMap || !initialDmsMapForReport) {
      setError('Please upload an After file and ensure an initial report is generated.');
      return;
    }

    setLoading(true);
    setError('');

    setTimeout(() => {
      try {
        const afterHeaders = afterData[0] || [];
        const partNoAfterIndex = findColumnIndex(afterHeaders, ['PartNo', 'part no', 'part', 'code', 'item']);
        const qtyAfterIndex = findColumnIndex(afterHeaders, ['qty', 'quantity', 'phy qty', 'stock', 'count']);

        if (partNoAfterIndex === -1 || qtyAfterIndex === -1) {
          throw new Error('After file must contain Part Number and Quantity columns.');
        }

        const afterSubtractionsMap = new Map<string, number>();
        for (let i = 1; i < afterData.length; i++) {
          const row = afterData[i];
          if (!row || row[partNoAfterIndex] === undefined) continue;
          const partNo = String(row[partNoAfterIndex]).trim().toUpperCase();
          const quantity = parseFloat(row[qtyAfterIndex]) || 0;
          if (partNo && quantity > 0) {
            afterSubtractionsMap.set(partNo, (afterSubtractionsMap.get(partNo) || 0) + quantity);
          }
        }

        const adjustedDmsMap = new Map(processedDmsMap);
        for (const [partNo, quantity] of afterSubtractionsMap.entries()) {
          if (adjustedDmsMap.has(partNo)) {
            const dmsBefore = adjustedDmsMap.get(partNo) || 0;
            adjustedDmsMap.set(partNo, Math.max(0, dmsBefore - quantity));
          }
        }

        const adjustedPhysicalMap = new Map(processedPhysicalMap);
        const unmatchedAfterRows: any[] = [];
        for (const [partNo, quantity] of afterSubtractionsMap.entries()) {
          if (adjustedPhysicalMap.has(partNo)) {
            const physicalInfo = adjustedPhysicalMap.get(partNo)!;
            physicalInfo.quantity = Math.max(0, physicalInfo.quantity - quantity);
          } else {
            unmatchedAfterRows.push({ partNo: partNo, rack: '', quantity: quantity });
          }
        }

        setProcessedDmsMap(adjustedDmsMap);
        setProcessedPhysicalMap(adjustedPhysicalMap);

        const report = generateReportFromMaps(adjustedDmsMap, adjustedPhysicalMap, dmsInfoMap);
        setReportData(report);
        setCurrentStep(2);

        const matchedCount = afterSubtractionsMap.size - unmatchedAfterRows.length;
        let successMessage = `After File applied: ${matchedCount} part numbers matched and updated.`;
        if (unmatchedAfterRows.length > 0) {
          successMessage += ` ${unmatchedAfterRows.length} part numbers from the After file did not match any physical stock.`;
        }
        setError(successMessage);

      } catch (err: any) {
        setError(`Error applying After file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const applyReportStyling = (worksheet: ExcelJS.Worksheet, reportData: any[][], reportHeadersStartRow: number = 1) => {
    /*console.log('=== DEBUGGING REPORT STYLING ===');
    console.log('reportHeadersStartRow:', reportHeadersStartRow);
    console.log('worksheet.rowCount:', worksheet.rowCount);*/

    // Calculate actual row positions
    const actualHeaderRow = reportHeadersStartRow;
    const actualTotalRow = reportHeadersStartRow + 1;
    const actualDataStartRow = reportHeadersStartRow + 2;

    // console.log(`Header row: ${actualHeaderRow}, Total row: ${actualTotalRow}, Data starts: ${actualDataStartRow}`);

    // First, let's see what's actually in the worksheet
    //console.log('=== WORKSHEET CONTENT DEBUG ===');
    for (let r = 1; r <= Math.min(worksheet.rowCount, 5); r++) {
      const row = worksheet.getRow(r);
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colNumber: number) => {
        rowValues.push(`Col${colNumber}: "${cell.value}"`);
      });
      //console.log(`Row ${r}:`, rowValues);
    }

    // Debug the header row specifically
    //console.log('=== HEADER ROW DEBUG ===');
    const headerRow = worksheet.getRow(actualHeaderRow);
    const headers = [];
    headerRow.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colNumber: number) => {
      headers.push({ col: colNumber, value: cell.value, type: typeof cell.value });
    });
    //console.log('Headers found:', headers);

    // Now apply styling
    headerRow.height = 30;

    headerRow.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, colNumber: number) => {
      const headerValue = cell.value ? String(cell.value).trim() : '';
      //nsole.log(`Styling header column ${colNumber}: "${headerValue}"`);

      // Base header style
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF004F98' }
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
        size: 12
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
      };

      // Apply specific colors - more flexible matching
      if (headerValue.toLowerCase().includes('short')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
        //console.log(`✓ Applied RED to column ${colNumber} (${headerValue})`);
      } else if (headerValue.toLowerCase().includes('excess')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
        //console.log(`✓ Applied ORANGE to column ${colNumber} (${headerValue})`);
      } else if (headerValue.toLowerCase().includes('phy') && headerValue.toLowerCase().includes('stock')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
        //console.log(`✓ Applied GREEN to column ${colNumber} (${headerValue})`);
      } else if (headerValue.toLowerCase().includes('value') ||
        headerValue.toLowerCase().includes('ndp') ||
        headerValue.toLowerCase().includes('mrp')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
        // console.log(`✓ Applied PURPLE to column ${colNumber} (${headerValue})`);
      } else {
        //console.log(`○ No special color for column ${colNumber} (${headerValue})`);
      }
    });

    // Style the TOTAL row
    const totalRow = worksheet.getRow(actualTotalRow);
    totalRow.height = 25;
    totalRow.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, colNumber: number) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
      cell.font = { bold: true, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
      };
      if (typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
        cell.alignment.horizontal = 'right';
      }
    });

    // Style data rows
    for (let i = actualDataStartRow; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;

      // Alternating row colors
      const isEvenRow = (i - actualDataStartRow) % 2 === 0;

      row.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, colNumber: number) => {
        // Alternating background
        if (isEvenRow) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        }

        // Borders
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        // Default font and alignment
        cell.font = { size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Get corresponding header
        const headerCell = worksheet.getRow(actualHeaderRow).getCell(colNumber);
        const header = headerCell.value ? String(headerCell.value).trim() : '';

        // Special formatting based on column
        if (header.toLowerCase().includes('phy') && header.toLowerCase().includes('stock')) {
          if (!isEvenRow) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
          }
          cell.font = { bold: true, size: 11 };
        }

        // Color text for Short/Excess values > 0
        if (typeof cell.value === 'number' && cell.value > 0) {
          if (header.toLowerCase().includes('short')) {
            cell.font = { color: { argb: 'FFDC2626' }, bold: true, size: 11 };
          } else if (header.toLowerCase().includes('excess')) {
            cell.font = { color: { argb: 'FFF59E0B' }, bold: true, size: 11 };
          }
        }

        // Number formatting
        if (typeof cell.value === 'number') {
          if (header.toLowerCase().includes('si no') || header.toLowerCase().includes('sl no')) {
            cell.numFmt = '0';
            cell.alignment.horizontal = 'center';
          } else if (header.toLowerCase().includes('value') ||
            header.toLowerCase().includes('ndp') ||
            header.toLowerCase().includes('mrp') ||
            header.toLowerCase().includes('stock') ||
            header.toLowerCase().includes('short') ||
            header.toLowerCase().includes('excess')) {
            cell.numFmt = '#,##0.00';
            cell.alignment.horizontal = 'right';
          }
        }
      });
    }

    // Apply column widths
    const columnWidths = [8, 15, 20, 30, 12, 12, 10, 10, 12, 12, 15, 15, 18, 18, 15];

    /*console.log('=== APPLYING COLUMN WIDTHS ===');*/
    columnWidths.forEach((width, index) => {
      const colNumber = index + 1;
      const column = worksheet.getColumn(colNumber);
      if (column) {
        column.width = width;
        /*console.log(`Set column ${colNumber} width to ${width}`);*/
      }
    });

    /*console.log('=== END DEBUGGING ===');*/
  };

  const applySummaryStyling = (worksheet: ExcelJS.Worksheet, summaryHeaderTitle: string) => {
    // Main header (e.g., "Summary" or custom header)
    const mainHeaderRow = worksheet.getRow(1);
    mainHeaderRow.height = 30;
    mainHeaderRow.getCell(1).value = summaryHeaderTitle || 'Summary Report';
    mainHeaderRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF004F98' } };
    mainHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.mergeCells('A1:D1'); // Assuming 4 columns for summary as per buildSummaryAoA

    // Empty row for spacing
    worksheet.getRow(2).height = 10;

    // Data rows from row 3 onwards
    for (let i = 3; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 25; // Standard height for summary rows

      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        cell.font = { size: 11 };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        // Style for descriptive text (column A and C)
        if (colNumber === 1 || colNumber === 3) {
          cell.font.bold = true;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4F7' } }; // Light greyish background
          cell.alignment.horizontal = 'left';
        }
        // Style for values (column B and D)
        else if (colNumber === 2 || colNumber === 4) {
          cell.alignment.horizontal = 'right';
          if (typeof cell.value === 'number') {
            // Apply Rupee format for Value/NDP/MRP
            const associatedHeader = worksheet.getRow(i).getCell(colNumber === 2 ? 1 : 3).value;
            if (associatedHeader && /Value|NDP|MRP/i.test(String(associatedHeader))) {
              cell.numFmt = '₹ #,##0.00'; // Rupee format
            } else {
              cell.numFmt = '#,##0'; // Integer format for counts
            }
            cell.font.bold = true;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // Light blue background
          }
        }
      });
    }

    // Column widths (as defined in buildSummaryAoA)
    worksheet.columns = [
      { width: 36 }, // Col 1: Description
      { width: 18 }, // Col 2: Value/Count
      { width: 36 }, // Col 3: Description
      { width: 22 }  // Col 4: Value/Count
    ];
  };

  const applyTvsTemplateStyling = (worksheet: ExcelJS.Worksheet) => {
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell: ExcelJS.Cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Yellow background
      cell.font = { color: { argb: 'FFFF0000' }, bold: true, size: 12 }; // Red text
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Data rows
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;
      // Alternating row colors
      if ((i - 2) % 2 === 0) {
        row.eachCell((cell: ExcelJS.Cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }
      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        // Apply number format to STOCK (column I or index 8) and COST (column G or index 6), MRP (column J or index 9)
        if (colNumber === 7 || colNumber === 9 || colNumber === 10) { // COST, STOCK, MRP
          cell.numFmt = '#,##0.00';
          cell.alignment.horizontal = 'right';
        }
      });
    }

    // Set column widths for TVS Template
    worksheet.columns = [
      { width: 15 }, // DEALER_ID
      { width: 15 }, // BRANCH_ID
      { width: 20 }, // SPARE_PART_NO
      { width: 20 }, // MANUFACTURER_ID
      { width: 15 }, // LOCATION_ID
      { width: 15 }, // RACK
      { width: 12 }, // COST
      { width: 10 }, // TAXABLE
      { width: 12 }, // STOCK
      { width: 12 }  // MRP
    ];
  };

  const applyRawDataStyling = (worksheet: ExcelJS.Worksheet, headerColor: string = 'FF004F98') => {
    const headerRow = worksheet.getRow(1);
    if (headerRow.values.length > 0) { // Only apply if there's a header
      headerRow.height = 25;
      headerRow.eachCell((cell: ExcelJS.Cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
        };
      });
    }

    // Data rows
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      // Alternating row colors
      if ((i - 2) % 2 === 0) {
        row.eachCell((cell: ExcelJS.Cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }
      row.eachCell((cell: ExcelJS.Cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        // Auto-detect number formatting (simple attempt)
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00'; // Default to 2 decimal places for numbers
          cell.alignment.horizontal = 'right';
        }
      });
    }

    // Auto-fit columns based on content
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 0;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2; // Min width 10, plus some padding
    });
  };

  const downloadExcel = async (): Promise<void> => {
    if (!reportData) return;

    try {
      console.log('=== DOWNLOAD EXCEL DEBUG ===');
      console.log('reportData length:', reportData.length);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Stock Comparison Report');

      reportData.forEach((row) => {
        worksheet.addRow(row);
      });

      applyReportStyling(worksheet, reportData, 1);

      const date = new Date();
      const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;

      let fileName = 'Stock_Comparison_Report';
      if (currentStep === 1) fileName += '_with_Before_Adjustment';
      if (currentStep === 2) fileName += '_with_Before_and_After_Adjustments';

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}_${timestamp}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

      console.log('Excel file downloaded successfully');

    } catch (err: any) {
      console.error('Error in downloadExcel:', err);
      setError(`Error downloading report: ${err.message}`);
    }
  };

  const formatNumber = (num: number): string => {
    if (typeof num !== 'number' || isNaN(num)) return String(num);
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const resetAll = (): void => {
    setDmsData(null);
    setPhysicalData(null);
    setBeforeData(null);
    setAfterData(null);
    setReportData(null);
    setOriginalReportData(null);
    setDmsFileName('');
    setPhysicalFileName('');
    setBeforeFileName('');
    setAfterFileName('');
    setCurrentStep(0);
    setProcessedDmsMap(null);
    setProcessedPhysicalMap(null);
    setDmsInfoMap(null);
    setInitialDmsMapForReport(null);
    setTvsTemplateData(null);
    setDealerId('');
    setBranchId('');
    setManufacturerId('');
    setTaxableId('');
    setError('');
    setUnmatchedEntries({ mismatchedRack: [], emptyRack: [], partNotFound: [] });
    setHighestQtySubtractions(new Map());
  };

  const handleTvsStockEdit = (partNo: string, rack: string, newQuantity: number, rowIndex: number): void => {
    if (tvsTemplateData && rowIndex >= 1 && rowIndex < tvsTemplateData.length) {
      const updatedTvsData = [...tvsTemplateData];
      updatedTvsData[rowIndex][8] = Math.max(0, newQuantity);

      let newTotalStock = 0;
      for (let i = 1; i < updatedTvsData.length; i++) {
        newTotalStock += parseFloat(updatedTvsData[i][8]) || 0;
      }

      setTvsTemplateData(updatedTvsData);
      setTvsStockTotal(newTotalStock);

      const updatedPhysicalMap = new Map(processedPhysicalMap);
      if (updatedPhysicalMap.has(partNo)) {
        const data = updatedPhysicalMap.get(partNo)!;

        let totalForPart = 0;
        for (let i = 1; i < updatedTvsData.length; i++) {
          if (updatedTvsData[i][2] === partNo) {
            totalForPart += parseFloat(updatedTvsData[i][8]) || 0;
          }
        }

        data.quantity = totalForPart;
        updatedPhysicalMap.set(partNo, data);
        setProcessedPhysicalMap(updatedPhysicalMap);

        const freshReport = generateReportFromMaps(
          processedDmsMap!,
          updatedPhysicalMap,
          dmsInfoMap!
        );
        setReportData(freshReport);
      }
    }
  };

  const generateTvsTemplate = useCallback((): void => {
    if (!physicalData) {
      setError('Please upload the physical stock file first.');
      return;
    }

    try {
      const physicalHeaders = physicalData[0] || [];
      const findColumn = (headers: any[], names: string[]) => findColumnIndex(headers, names);

      const partNoIndex = findColumn(physicalHeaders, ['part no', 'partno']);
      const qtyIndex = findColumn(physicalHeaders, ['qty', 'quantity']);
      const ndpIndex = findColumn(physicalHeaders, ['ndp']);
      const mrpIndex = findColumn(physicalHeaders, ['mrp']);
      const locationIndex = findColumn(physicalHeaders, ['location']);
      const rackIndex = findColumn(physicalHeaders, ['rack']);

      if (partNoIndex === -1 || qtyIndex === -1) {
        throw new Error('Physical file must contain Part Number and Quantity columns.');
      }

      const physicalDataMap = new Map<string, boolean>();
      const physicalPartMap = new Map<string, string[]>();

      const aggregatedPhysicalStock = new Map<string, any>();

      for (let i = 1; i < physicalData.length; i++) {
        const row = physicalData[i];
        if (!row || !row[partNoIndex]) continue;

        const partNo = String(row[partNoIndex]).trim().toUpperCase();
        const rack = rackIndex !== -1 ? String(row[rackIndex] || '').trim() : '';
        const currentQty = parseInt(row[qtyIndex]) || 0;
        const ndp = ndpIndex !== -1 ? parseFloat(row[ndpIndex]) || 0 : 0;
        const mrp = mrpIndex !== -1 ? parseFloat(row[mrpIndex]) || 0 : 0;
        const location = locationIndex !== -1 ? String(row[locationIndex] || '').trim() : '';

        const key = `${partNo}|${rack}`;

        if (partNo && rack) {
          physicalDataMap.set(key, true);
        }
        if (!physicalPartMap.has(partNo)) {
          physicalPartMap.set(partNo, []);
        }
        if (!physicalPartMap.get(partNo)!.includes(rack)) {
          physicalPartMap.get(partNo)!.push(rack);
        }

        if (aggregatedPhysicalStock.has(key)) {
          const existingEntry = aggregatedPhysicalStock.get(key)!;
          existingEntry.quantity += currentQty;
          aggregatedPhysicalStock.set(key, existingEntry);
        } else {
          aggregatedPhysicalStock.set(key, {
            partNo: partNo,
            rack: rack,
            quantity: currentQty,
            ndp: ndp,
            mrp: mrp,
            location: location,
          });
        }
      }

      const perfectMatchSubtractions = new Map<string, number>();
      const currentUnmatched: UnmatchedEntries = { mismatchedRack: [], emptyRack: [], partNotFound: [] };

      if (tvsAfterData) {
        const afterHeaders = tvsAfterData[0] || [];
        const partNoAfterIndex = findColumn(afterHeaders, ['PartNo', 'part no']);
        const qtyAfterIndex = findColumn(afterHeaders, ['qty', 'quantity']);
        const rackAfterIndex = findColumn(afterHeaders, ['rack']);

        if (partNoAfterIndex !== -1 && qtyAfterIndex !== -1) {
          for (let i = 1; i < tvsAfterData.length; i++) {
            const afterRow = tvsAfterData[i];
            if (!afterRow || !afterRow[partNoAfterIndex]) continue;

            const afterPartNo = String(afterRow[partNoAfterIndex]).trim().toUpperCase();
            const afterQty = parseFloat(afterRow[qtyAfterIndex]) || 0;
            const afterRack = rackAfterIndex !== -1 ? String(afterRow[rackAfterIndex] || '').trim() : '';
            const perfectMatchKey = `${afterPartNo}|${afterRack}`;

            if (afterRack && physicalDataMap.has(perfectMatchKey)) {
              perfectMatchSubtractions.set(perfectMatchKey, (perfectMatchSubtractions.get(perfectMatchKey) || 0) + afterQty);
            } else {
              if (!afterRack) {
                currentUnmatched.emptyRack.push({ partNo: afterPartNo, quantity: afterQty });
              } else if (physicalPartMap.has(afterPartNo)) {
                currentUnmatched.mismatchedRack.push({
                  partNo: afterPartNo,
                  wrongRack: afterRack,
                  quantity: afterQty,
                  availableRacks: physicalPartMap.get(afterPartNo)!.join(', ')
                });
              } else {
                currentUnmatched.partNotFound.push({ partNo: afterPartNo, rack: afterRack, quantity: afterQty });
              }
            }
          }
        }
      }

      const combinedSubtractions = new Map(perfectMatchSubtractions);

      for (const [key, qty] of highestQtySubtractions.entries()) {
        combinedSubtractions.set(key, (combinedSubtractions.get(key) || 0) + qty);
      }

      setUnmatchedEntries(currentUnmatched);

      aggregatedPhysicalStock.forEach((entry, key) => {
        if (combinedSubtractions.has(key)) {
          entry.quantity = Math.max(0, entry.quantity - combinedSubtractions.get(key)!);
        }
      });

      const tvsHeaders = ['DEALER_ID', 'BRANCH_ID', 'SPARE_PART_NO', 'MANUFACTURER_ID', 'LOCATION_ID', 'RACK', 'COST', 'TAXABLE', 'STOCK', 'MRP'];
      const tvsRows: any[][] = [tvsHeaders];
      let totalStock = 0;

      aggregatedPhysicalStock.forEach(entry => {
        if (entry.quantity > 0) {
          tvsRows.push([
            dealerId || '',
            branchId || '',
            entry.partNo,
            manufacturerId || '',
            entry.location,
            entry.rack,
            entry.ndp,
            taxable || 'Y',
            entry.quantity,
            entry.mrp
          ]);
          totalStock += entry.quantity;
        }
      });

      setTvsTemplateData(tvsRows);
      setTvsStockTotal(totalStock);

      let successMessage = 'TVS template generated.';
      if (perfectMatchSubtractions.size > 0) {
        successMessage += ' Subtractions from perfect Part No and Rack matches applied.';
      }
      if (highestQtySubtractions.size > 0) {
        successMessage += ' Additional subtractions for previously unmatched entries applied to highest stock racks.';
        setHighestQtySubtractions(new Map());
      }
      if (currentUnmatched.mismatchedRack.length > 0 || currentUnmatched.emptyRack.length > 0 || currentUnmatched.partNotFound.length > 0) {
        successMessage += ' Please review the remaining unmatched entries below.';
      }
      setError(successMessage);

    } catch (err: any) {
      setError(`Error generating TVS template: ${err.message}`);
      setUnmatchedEntries({ mismatchedRack: [], emptyRack: [], partNotFound: [] });
      setHighestQtySubtractions(new Map());
    }
  }, [physicalData, tvsAfterData, dealerId, branchId, manufacturerId, taxable, findColumnIndex, setError, setTvsTemplateData, setTvsStockTotal, setUnmatchedEntries, highestQtySubtractions, setHighestQtySubtractions]);

  const applyUnmatchedQuantities = useCallback((currentUnmatchedEntries: UnmatchedEntries): void => {
    console.log('\n🔍 DEBUG: Input unmatched entries:');
    console.log('emptyRack entries:', currentUnmatchedEntries.emptyRack);
    console.log('mismatchedRack entries:', currentUnmatchedEntries.mismatchedRack);

    if (currentUnmatchedEntries.mismatchedRack.length === 0 && currentUnmatchedEntries.emptyRack.length === 0) {
      setError("No unmatched entries (mismatched rack or empty rack) to apply.");
      return;
    }

    if (!window.confirm("Do you want to apply these unmatched quantities to the highest stock racks for each part number? This will recalculate the TVS template.")) {
      return;
    }

    try {
      const newHighestQtySubtractions = new Map<string, number>();
      const problemParts: any[] = [];
      const physicalHeaders = physicalData![0] || [];
      const partNoIndex = findColumnIndex(physicalHeaders, ['part no', 'partno']);
      const qtyIndex = findColumnIndex(physicalHeaders, ['qty', 'quantity']);
      const rackIndex = findColumnIndex(physicalHeaders, ['rack']);

      if (partNoIndex === -1 || qtyIndex === -1) {
        throw new Error('Physical file must contain Part Number and Quantity columns to apply unmatched quantities.');
      }

      const initialAggregatedPhysicalStock = new Map<string, any>();
      for (let i = 1; i < physicalData!.length; i++) {
        const row = physicalData![i];
        if (!row || !row[partNoIndex]) continue;

        const partNo = String(row[partNoIndex]).trim().toUpperCase();
        const rack = rackIndex !== -1 ? String(row[rackIndex] || '').trim() : '';
        const currentQty = parseFloat(row[qtyIndex]) || 0;
        const key = `${partNo}|${rack}`;

        if (initialAggregatedPhysicalStock.has(key)) {
          initialAggregatedPhysicalStock.get(key)!.quantity += currentQty;
        } else {
          initialAggregatedPhysicalStock.set(key, { partNo, rack, quantity: currentQty });
        }
      }

      const runningSubtractions = new Map<string, number>();
      console.log('\n🏃‍♂️ Initializing running subtractions tracker...');

      const findOptimalSubtraction = (targetPartNo: string, requestedQty: number, entryIndex: number) => {
        console.log(`\n=== Processing ${targetPartNo}, requested: ${requestedQty} (Entry #${entryIndex + 1}) ===`);

        const partRacks = Array.from(initialAggregatedPhysicalStock.values())
          .filter(entry => entry.partNo === targetPartNo);

        console.log('Original part racks found:', partRacks);

        if (partRacks.length === 0) {
          console.log(`❌ No racks found for ${targetPartNo}`);
          return {
            subtractions: new Map<string, number>(),
            totalAvailable: 0,
            remainingQty: requestedQty,
            problem: `Part ${targetPartNo} not found in physical stock`,
            actualSubtracted: 0
          };
        }

        const partRacksWithRunningSubtractions = partRacks.map(rack => {
          const key = `${targetPartNo}|${rack.rack}`;
          const alreadyPlannedSubtraction = runningSubtractions.get(key) || 0;
          const availableAfterPlanned = Math.max(0, rack.quantity - alreadyPlannedSubtraction);

          console.log(`  Rack ${rack.rack}: original=${rack.quantity}, already_planned=${alreadyPlannedSubtraction}, available=${availableAfterPlanned}`);

          return {
            ...rack,
            availableQuantity: availableAfterPlanned,
            originalQuantity: rack.quantity
          };
        }).sort((a, b) => b.availableQuantity - a.availableQuantity);

        const totalAvailable = partRacksWithRunningSubtractions.reduce((sum, rack) => sum + rack.availableQuantity, 0);
        const totalOriginal = partRacksWithRunningSubtractions.reduce((sum, rack) => sum + rack.originalQuantity, 0);

        console.log(`  Total original stock: ${totalOriginal}`);
        console.log(`  Total available (after planned subtractions): ${totalAvailable}`);

        if (totalAvailable === 0) {
          console.log(`❌ No stock available for ${targetPartNo} after considering planned subtractions`);
          return {
            subtractions: new Map<string, number>(),
            totalAvailable: totalOriginal,
            remainingQty: requestedQty,
            problem: `Part ${targetPartNo} - no stock available after considering previous subtractions in this batch`,
            actualSubtracted: 0
          };
        }

        const highestAvailableRack = partRacksWithRunningSubtractions[0];
        const subtractions = new Map<string, number>();

        console.log(`  Highest available rack: ${highestAvailableRack.rack} with ${highestAvailableRack.availableQuantity} available`);

        if (requestedQty <= highestAvailableRack.availableQuantity) {
          console.log(`  ✅ Can fully subtract ${requestedQty} from ${highestAvailableRack.rack}`);
          subtractions.set(`${targetPartNo}|${highestAvailableRack.rack}`, requestedQty);

          const key = `${targetPartNo}|${highestAvailableRack.rack}`;
          const newRunningTotal = (runningSubtractions.get(key) || 0) + requestedQty;
          runningSubtractions.set(key, newRunningTotal);
          console.log(`  📝 Updated running subtraction for ${key}: ${newRunningTotal}`);

          return {
            subtractions,
            totalAvailable: totalOriginal,
            remainingQty: 0,
            problem: null,
            actualSubtracted: requestedQty
          };
        } else {
          console.log(`  ⚠️ Cannot fully subtract ${requestedQty} from ${highestAvailableRack.rack} (only ${highestAvailableRack.availableQuantity} available)`);

          const actualSubtractedFromHighest = highestAvailableRack.availableQuantity;
          const remainingAfterHighest = requestedQty - actualSubtractedFromHighest;

          console.log(`  📊 Will subtract ${actualSubtractedFromHighest} from ${highestAvailableRack.rack}, remaining needed: ${remainingAfterHighest}`);

          if (actualSubtractedFromHighest > 0) {
            subtractions.set(`${targetPartNo}|${highestAvailableRack.rack}`, actualSubtractedFromHighest);

            const key = `${targetPartNo}|${highestAvailableRack.rack}`;
            const newRunningTotal = (runningSubtractions.get(key) || 0) + actualSubtractedFromHighest;
            runningSubtractions.set(key, newRunningTotal);
            console.log(`  📝 Updated running subtraction for ${key}: ${newRunningTotal}`);
          }

          const remainingRacks = partRacksWithRunningSubtractions.slice(1).filter(r => r.availableQuantity > 0);
          console.log(`  📋 Remaining racks with availability:`, remainingRacks.map(r => `${r.rack}(${r.availableQuantity})`));

          if (remainingRacks.length === 0) {
            console.log(`  ❌ No other racks available for remaining ${remainingAfterHighest}`);
            return {
              subtractions,
              totalAvailable: totalOriginal,
              remainingQty: remainingAfterHighest,
              problem: `After subtracting ${actualSubtractedFromHighest} from ${highestAvailableRack.rack}, remaining ${remainingAfterHighest} units cannot be allocated. No other racks available.`,
              actualSubtracted: actualSubtractedFromHighest
            };
          }

          const highestRemainingQty = remainingRacks[0].availableQuantity;
          const racksWithHighestRemainingQty = remainingRacks.filter(r => r.availableQuantity === highestRemainingQty);

          console.log(`  📊 Highest remaining available quantity: ${highestRemainingQty}`);
          console.log(`  📊 Racks with highest remaining quantity:`, racksWithHighestRemainingQty.map(r => `${r.rack}(${r.availableQuantity})`));

          const totalRemainingAvailable = remainingRacks.reduce((sum, r) => sum + r.availableQuantity, 0);

          if (remainingAfterHighest > totalRemainingAvailable) {
            console.log(`  ❌ Insufficient total remaining stock: need ${remainingAfterHighest}, have ${totalRemainingAvailable}`);
            return {
              subtractions,
              totalAvailable: totalOriginal,
              remainingQty: remainingAfterHighest - totalRemainingAvailable,
              problem: `After subtracting ${actualSubtractedFromHighest} from ${highestAvailableRack.rack}, insufficient stock for remaining ${remainingAfterHighest} units. Only ${totalRemainingAvailable} available in other racks.`,
              actualSubtracted: actualSubtractedFromHighest
            };
          } else if (racksWithHighestRemainingQty.length > 1 && remainingAfterHighest <= highestRemainingQty) {
            console.log(`  ⚠️ AMBIGUOUS: Multiple racks with same available quantity can handle remaining ${remainingAfterHighest}`);
            const rackOptions = racksWithHighestRemainingQty.map(r => `${r.rack}(${r.availableQuantity})`).join(', ');
            return {
              subtractions,
              totalAvailable: totalOriginal,
              remainingQty: remainingAfterHighest,
              problem: `After subtracting ${actualSubtractedFromHighest} from ${highestAvailableRack.rack}, remaining ${remainingAfterHighest} units cannot be allocated. Multiple racks have same available quantity: ${rackOptions}`,
              actualSubtracted: actualSubtractedFromHighest
            };
          } else {
            console.log(`  ⚠️ Could be allocated to ${remainingRacks[0].rack} but current logic doesn't auto-distribute`);
            return {
              subtractions,
              totalAvailable: totalOriginal,
              remainingQty: remainingAfterHighest,
              problem: `After subtracting ${actualSubtractedFromHighest} from ${highestAvailableRack.rack}, remaining ${remainingAfterHighest} units could go to ${remainingRacks[0].rack}(${remainingRacks[0].availableQuantity}) but current logic doesn't auto-distribute`,
              actualSubtracted: actualSubtractedFromHighest
            };
          }
        }
      };

      console.log('\n🔄 Processing emptyRack entries with running subtraction awareness...');
      currentUnmatchedEntries.emptyRack.forEach((entry, index) => {
        console.log(`\n🔄 Processing emptyRack entry ${index + 1}: ${entry.partNo}, qty: ${entry.quantity}`);
        const result = findOptimalSubtraction(entry.partNo, entry.quantity, index);

        result.subtractions.forEach((qty, key) => {
          newHighestQtySubtractions.set(key, (newHighestQtySubtractions.get(key) || 0) + qty);
          console.log(`  ✅ Added subtraction to final map: ${key} -> +${qty} (total: ${newHighestQtySubtractions.get(key)})`);
        });

        if (result.problem || result.remainingQty > 0) {
          console.log(`  ❌ Problem detected for ${entry.partNo}:`, result.problem);
          problemParts.push({
            partNo: entry.partNo,
            requestedQty: entry.quantity,
            actualSubtracted: result.actualSubtracted || 0,
            remainingQty: result.remainingQty || 0,
            totalAvailable: result.totalAvailable,
            issue: result.problem || `Could not subtract remaining ${result.remainingQty} units`,
            type: 'emptyRack',
            entryNumber: index + 1
          });
        }
      });

      console.log('\n🔄 Processing mismatchedRack entries with running subtraction awareness...');
      currentUnmatchedEntries.mismatchedRack.forEach((entry, index) => {
        console.log(`\n🔄 Processing mismatchedRack entry ${index + 1}: ${entry.partNo}, qty: ${entry.quantity}`);
        const result = findOptimalSubtraction(entry.partNo, entry.quantity, index + currentUnmatchedEntries.emptyRack.length);

        result.subtractions.forEach((qty, key) => {
          newHighestQtySubtractions.set(key, (newHighestQtySubtractions.get(key) || 0) + qty);
          console.log(`  ✅ Added subtraction to final map: ${key} -> +${qty} (total: ${newHighestQtySubtractions.get(key)})`);
        });

        if (result.problem || result.remainingQty > 0) {
          console.log(`  ❌ Problem detected for ${entry.partNo}:`, result.problem);
          problemParts.push({
            partNo: entry.partNo,
            requestedQty: entry.quantity,
            actualSubtracted: result.actualSubtracted || 0,
            remainingQty: result.remainingQty || 0,
            totalAvailable: result.totalAvailable,
            issue: result.problem || `Could not subtract remaining ${result.remainingQty} units`,
            type: 'mismatchedRack',
            originalRack: entry.wrongRack,
            entryNumber: index + 1
          });
        }
      });

      console.log('\n📊 Final running subtractions map:', Array.from(runningSubtractions.entries()));
      console.log('📊 Final newHighestQtySubtractions map:', Array.from(newHighestQtySubtractions.entries()));
      console.log('📊 Final problem parts:', problemParts);

      setHighestQtySubtractions(newHighestQtySubtractions);
      setUnmatchedEntries(prev => ({
        ...prev,
        mismatchedRack: [],
        emptyRack: []
      }));

      if (problemParts.length > 0) {
        setIncompleteParts(problemParts);
      }

      generateTvsTemplate();

      let successMessage = "Unmatched quantities processed and TVS template re-generated.";
      if (problemParts.length > 0) {
        successMessage += ` WARNING: ${problemParts.length} entries had incomplete or ambiguous subtractions. Please review below.`;
      }
      setError(successMessage);

    } catch (err: any) {
      setError(`Error applying unmatched quantities: ${err.message}`);
      setHighestQtySubtractions(new Map());
    }
  }, [physicalData, findColumnIndex, setHighestQtySubtractions, setUnmatchedEntries, generateTvsTemplate, setError]);

  const clearTvsTemplate = (): void => {
    setDealerId('');
    setBranchId('');
    setManufacturerId('');
    setTaxableId('');
    clearFile('tvsAfter');
    setTvsStockTotal(0);
    setUnmatchedEntries({ mismatchedRack: [], emptyRack: [], partNotFound: [] });
    setHighestQtySubtractions(new Map());
    setError('');
    if (tvsAfterInputRef.current) tvsAfterInputRef.current.value = '';
  };

  const downloadTvsTemplate = (): void => {
    if (!tvsTemplateData) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('TVS Template');
      worksheet.addRows(tvsTemplateData);
      applyTvsTemplateStyling(worksheet);

      const date = new Date();
      const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;

      workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `TVS_Template_${timestamp}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
      });

    } catch (err: any) {
      setError(`Error downloading TVS template: ${err.message}`);
    }
  };

  const buildSummary = (reportData: any[][] | null, dupStats: DupStats | null): SummaryData | null => {
    if (!reportData || !dupStats) return null;

    const tot = reportData[1];

    const summary: SummaryData = {
      partBeforeDup: dupStats.dmsDupCount,
      partAfterDup: dupStats.dmsDupCount + dupStats.physOnlyUniqueCount,
      shortageCount: reportData.slice(2).filter(r => r[6] > 0).length,
      excessCount: reportData.slice(2).filter(r => r[7] > 0).length,
      shortageValue: tot[10],
      excessValue: tot[11],
      ndpBefore: tot[14],
      ndpAfter: tot[12],
      mrpAfter: tot[13],
      lineItemsDup: dupStats.physDupCount,
      lineItemsUnique: dupStats.physUniqueCount,
      extrasUnique: dupStats.physOnlyUniqueCount
    };

    return summary;
  };

  const summary = React.useMemo(
    () => buildSummary(reportData, dupStats),
    [reportData, dupStats, forceUpdate]
  );

  const buildSummaryAoA = (s: SummaryData | null, title: string, reportData: any[][] | null): any[][] | null => {
    if (!s) return null;
    const tot = reportData?.[1] || [];
    const mrpAfter = Number(tot[13] || 0);

    const rows = [
      [title || 'Summary', '', '', ''],
      [],
      ['Count of Part No. before audit', s.partBeforeDup, 'Count of Part No. after audit', s.partAfterDup],
      ['Count of Shortage Parts', s.shortageCount, 'Value of Shortage Parts', Number(s.shortageValue || 0)],
      ['Count of Excess Parts', s.excessCount, 'Value of Excess Parts', Number(s.excessValue || 0)],
      ['Total NDP Value before audit', Number(s.ndpBefore || 0), 'Total NDP Value after audit', Number(s.ndpAfter || 0)],
      ['No of Line item counted', s.lineItemsDup, 'Count of Extras found during audit', s.extrasUnique],
      ['No of Line item counted - Unique', s.lineItemsUnique, 'Total MRP Value after audit', mrpAfter]
    ];
    return rows;
  };

  const downloadSummaryExcel = (): void => {
    if (!summary) {
      setError('No summary to download.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Summary');

      const rows = buildSummaryAoA(summary, summaryHeader || 'Summary', reportData);
      worksheet.addRows(rows!);

      applySummaryStyling(worksheet, summaryHeader);

      const dt = new Date();
      const ts = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`;
      workbook.xlsx.writeBuffer().then(buffer => {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Summary_${ts}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
      });
    } catch (err: any) {
      setError(`Error downloading summary: ${err.message}`);
    }
  };

  const downloadAllExcel = async (): Promise<void> => {
    if (!reportData) {
      setError('Please generate the report first.');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const date = new Date();
      const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}`;
      const toSafeFileName = (s: string) =>
        (s && s.trim() ? s.trim() : 'Summary')
          .replace(/[\\/:*?"<>|]/g, '_')
          .replace(/\s+/g, ' ')
          .slice(0, 150);
      const baseFileName = toSafeFileName(summaryHeader || 'Audit_Report');

      let reportDataForSheet = reportData;
      if (summaryHeader?.trim()) {
        reportDataForSheet = [[summaryHeader.trim()], [], ...reportData];
      }
      const wsReport = workbook.addWorksheet('Stock Comparison');
      wsReport.addRows(reportDataForSheet);

      if (summaryHeader?.trim()) {
        const lastCol = (reportData[0]?.length || 1) - 1;
        wsReport.mergeCells(1, 1, 1, lastCol + 1);
        wsReport.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF004F98' } };
        wsReport.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
        wsReport.getRow(1).height = 30;
        wsReport.getRow(2).height = 10;
        applyReportStyling(wsReport, reportData, 3);
      } else {
        applyReportStyling(wsReport, reportData);
      }

      if (summary) {
        const wsSum = workbook.addWorksheet('Summary');
        const summaryRows = buildSummaryAoA(summary, summaryHeader || 'Summary', reportData);
        wsSum.addRows(summaryRows!);
        applySummaryStyling(wsSum, summaryHeader);
      }

      if (tvsTemplateData && tvsTemplateData.length > 0) {
        const wsTvs = workbook.addWorksheet('TVS Template');
        wsTvs.addRows(tvsTemplateData);
        applyTvsTemplateStyling(wsTvs);
      }

      const addRawExcelSheet = (data: any[][] | null, name: string, headerColor: string = 'FF004F98'): void => {
        if (!data || !data.length) return;
        const ws = workbook.addWorksheet(name.slice(0, 31));
        ws.addRows(data);
        applyRawDataStyling(ws, headerColor);
      };

      addRawExcelSheet(dmsData, 'Raw DMS', 'FF004F98');
      addRawExcelSheet(physicalData, 'Raw Physical', 'FF10B981');
      addRawExcelSheet(beforeData, 'Raw Before', 'FFF59E0B');
      addRawExcelSheet(afterData, 'Raw After', 'FFDC2626');

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseFileName}_${timestamp}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);

    } catch (err: any) {
      setError(`Error building and downloading all files: ${err.message}`);
    }
  };

  // The rest of the component JSX remains the same as your original
  // Only type annotations and interfaces were added
  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#F8FAFC', minHeight: '100vh' }}>
      <HeroSection>
        <Container maxWidth="xl">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, letterSpacing: '-0.02em' }}>
              Stock Comparison
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, fontWeight: 400, maxWidth: 600, mx: 'auto', mb: 4 }}>
              Professional audit tool for comparing DMS records with physical stock counts
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
              <Typography sx={{ fontWeight: 600 }}>Final Report</Typography>
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

        {/* Action Controls */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {!reportData ? (
            <>
              <Grid size={{ xs: 12, md: 6 }}>
                <UploadCard onClick={() => document.getElementById('dms-upload')?.click()}>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Box sx={{ mb: 2 }}>
                      <Inventory className="upload-icon" sx={{ fontSize: 48, color: '#64748B', transition: 'all 0.3s' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>DMS Data</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Upload the current stock records from your DMS system
                    </Typography>
                    {dmsFileName ? (
                      <FilePreview
                        title="DMS File"
                        fileName={dmsFileName}
                        onClear={(e: any) => { e.stopPropagation(); clearFile('dms'); }}
                      />
                    ) : (
                      <ActionButton variant="contained" fullWidth sx={{ bgcolor: '#004F98' }}>
                        Select DMS File
                      </ActionButton>
                    )}
                    <input id="dms-upload" type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'dms')} />
                  </CardContent>
                </UploadCard>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <UploadCard onClick={() => document.getElementById('physical-upload')?.click()}>
                  <CardContent sx={{ p: 4, textAlign: 'center' }}>
                    <Box sx={{ mb: 2 }}>
                      <Assessment className="upload-icon" sx={{ fontSize: 48, color: '#64748B', transition: 'all 0.3s' }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Physical Stock</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Upload the verified physical count from the audit
                    </Typography>
                    {physicalFileName ? (
                      <FilePreview
                        title="Physical File"
                        fileName={physicalFileName}
                        onClear={(e: any) => { e.stopPropagation(); clearFile('physical'); }}
                      />
                    ) : (
                      <ActionButton variant="contained" fullWidth sx={{ bgcolor: '#10B981' }}>
                        Select Physical File
                      </ActionButton>
                    )}
                    <input id="physical-upload" type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'physical')} />
                  </CardContent>
                </UploadCard>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <ActionButton
                    variant="contained"
                    size="large"
                    disabled={!dmsData || !physicalData || loading}
                    onClick={generateInitialReport}
                    startIcon={loading ? null : <CompareArrows />}
                    sx={{
                      px: 8,
                      py: 2,
                      bgcolor: '#F59E0B',
                      fontSize: '1.1rem',
                      '&:hover': { bgcolor: '#D97706' }
                    }}
                  >
                    {loading ? 'Processing Data...' : 'Generate Comparison Report'}
                  </ActionButton>
                </Box>
              </Grid>
            </>
          ) : (
            <Grid size={{ xs: 12 }}>
              <ProfessionalCard>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: alpha(primaryColor, 0.1), color: primaryColor }}>
                        <Description />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>Comparison Results</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Generated {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
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
                        Reset Audit
                      </ActionButton>
                      <ActionButton
                        variant="contained"
                        onClick={downloadAllExcel}
                        startIcon={<Download />}
                        sx={{ bgcolor: '#8B5CF6', '&:hover': { bgcolor: '#7C3AED' } }}
                      >
                        Download Full Report
                      </ActionButton>
                    </Stack>
                  </Box>
                </CardContent>
              </ProfessionalCard>
            </Grid>
          )}
        </Grid>

        {/* Loading Progress */}
        {/* Adjustments Section (Step 1 & 2) */}
        {reportData && currentStep < 2 && (
          <Fade in timeout={500}>
            <div>
              <ProfessionalCard sx={{ mb: 4, borderLeft: `6px solid ${primaryColor}` }}>
                <CardContent sx={{ p: 4 }}>
                  <Grid container spacing={4} alignItems="center">
                    <Grid size={{ xs: 12, md: 7 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        {currentStep === 0 ? 'Step 2: Apply Before-Adjustment' : 'Step 3: Apply After-Adjustment'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        {currentStep === 0
                          ? 'Upload a file containing stock reductions to be applied before the final comparison.'
                          : 'Upload a file containing stock adjustments to be applied after the initial audit.'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<CloudUpload />}
                          sx={{
                            borderRadius: '12px',
                            textTransform: 'none',
                            fontWeight: 600,
                            padding: '8px 20px',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            },
                            borderColor: primaryColor,
                            color: primaryColor
                          }}
                        >
                          {currentStep === 0 ? 'Select Before File' : 'Select After File'}
                          <input
                            type="file"
                            hidden
                            accept=".xlsx,.xls"
                            onChange={(e) => handleFileUpload(e, currentStep === 0 ? 'before' : 'after')}
                          />
                        </Button>
                        {(currentStep === 0 ? beforeFileName : afterFileName) && (
                          <Chip
                            label={currentStep === 0 ? beforeFileName : afterFileName}
                            onDelete={() => clearFile(currentStep === 0 ? 'before' : 'after')}
                            color="primary"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }} sx={{ textAlign: { md: 'right' } }}>
                      <ActionButton
                        variant="contained"
                        size="large"
                        disabled={loading || (currentStep === 0 ? !beforeData : !afterData)}
                        onClick={currentStep === 0 ? applyBeforeFileAdjustment : applyAfterFileAdjustment}
                        sx={{ bgcolor: primaryColor, px: 4 }}
                      >
                        {loading ? 'Processing...' : `Apply ${currentStep === 0 ? 'Before' : 'After'} Adjustment`}
                      </ActionButton>
                    </Grid>
                  </Grid>
                </CardContent>
              </ProfessionalCard>
            </div>
          </Fade>
        )}

        {/* Data Grid Section */}
        {reportData && (
          <>
            <Fade in timeout={800}>
              <Box sx={{ mb: 6 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, px: 1 }}>Detailed Comparison Data</Typography>
                <Paper elevation={0} sx={{ height: 600, borderRadius: '24px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                  <StyledDataGrid
                    {...buildGridData(reportData)}
                    density="compact"
                    disableRowSelectionOnClick
                  />
                </Paper>
              </Box>
            </Fade>

            {/* Summary Statistics */}
            {/* Loading Overlay */}
            {loading && <LoadingOverlay open={loading} message="Processing Excel files..." />}

            {/* Error/Success Alerts */}
            {error && (
              <Fade in>
                <Alert
                  severity={error.includes('Error') ? 'error' : 'success'}
                  sx={{ mt: 4, borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  onClose={() => setError('')}
                >
                  {error}
                </Alert>
              </Fade>
            )}

            {/* Total Summary Bar */}
            <Paper elevation={0} sx={{
              mb: 4,
              overflow: 'hidden',
              borderRadius: 2,
              border: `2px solid ${primaryColor}`
            }}>
              <Box sx={{ display: 'flex', backgroundColor: primaryColor, color: 'white', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Report Totals
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                {reportData[1].map((cell, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      flex: '1 1 auto',
                      minWidth: 120,
                      p: 2,
                      backgroundColor: idx % 2 === 0 ? '#F8FAFC' : 'white',
                      borderRight: '1px solid #E5E7EB',
                      textAlign: typeof cell === 'number' ? 'right' : 'left',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" display="block">
                      {reportData[0][idx]}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {typeof cell === 'number' ? formatNumber(cell) : cell}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>

            {/* Enhanced Summary Section */}
            {summary && (
              <Box>
                {/* Summary Header and Controls */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12, md: 8 }}>
                      <TextField
                        fullWidth
                        label="Summary Heading (Dealer/Showroom Name)"
                        placeholder="e.g., 11030-TRIJAL MOTORS - RAMAGONDANAHALLI"
                        value={summaryHeader}
                        onChange={(e) => setSummaryHeader(e.target.value)}
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
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Stack direction="row" spacing={2} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                        <ActionButton
                          variant="contained"
                          startIcon={<SaveAlt />}
                          onClick={downloadSummaryExcel}
                          disabled={!summary}
                          sx={{ backgroundColor: '#10B981', '&:hover': { backgroundColor: '#059669' } }}
                        >
                          Download Summary
                        </ActionButton>
                        <ActionButton
                          variant="contained"
                          color="secondary"
                          startIcon={<Download />}
                          onClick={downloadAllExcel}
                          disabled={!reportData}
                        >
                          Download All
                        </ActionButton>
                      </Stack>
                    </Grid>
                  </Grid>

                  {summaryHeader && (
                    <Paper
                      elevation={0}
                      sx={{
                        mt: 2,
                        backgroundColor: primaryColor,
                        color: '#fff',
                        p: 2,
                        textAlign: 'center',
                        fontWeight: 'bold',
                        borderRadius: 2
                      }}
                    >
                      {summaryHeader}
                    </Paper>
                  )}
                </Paper>

                {/* Summary Statistics Grid */}
                <Grid container spacing={3}>
                  {/* Part Count Statistics */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <StatsCard sx={{ '--accent-color': primaryColor }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              Part Numbers Before Audit
                            </Typography>
                            <Typography variant="h3" sx={{ color: primaryColor, fontWeight: 700 }}>
                              {summary?.partBeforeDup?.toLocaleString() || '0'}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: alpha(primaryColor, 0.1), color: primaryColor }}>
                            <Inventory />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </StatsCard>
                  </Grid>

                  <Grid size={{ xs: 12, md: 6 }}>
                    <StatsCard sx={{ '--accent-color': '#10B981' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              Part Numbers After Audit
                            </Typography>
                            <Typography variant="h3" sx={{ color: '#10B981', fontWeight: 700 }}>
                              {summary?.partAfterDup?.toLocaleString() || '0'}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }}>
                            <CheckCircle />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </StatsCard>
                  </Grid>

                  {/* Shortage Statistics */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <StatsCard sx={{ '--accent-color': '#EF4444' }}>
                      <CardContent>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Shortage Parts
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Count</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                              {summary?.shortageCount?.toLocaleString() || '0'}
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Value</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#EF4444' }}>
                              ₹ {summary?.shortageValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </StatsCard>
                  </Grid>

                  {/* Excess Statistics */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <StatsCard sx={{ '--accent-color': '#F59E0B' }}>
                      <CardContent>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          Excess Parts
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">Count</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                              {summary?.excessCount?.toLocaleString() || '0'}
                            </Typography>
                          </Box>
                          <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />
                          <Box>
                            <Typography variant="body2" color="text.secondary">Value</Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#F59E0B' }}>
                              ₹ {summary?.excessValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </StatsCard>
                  </Grid>

                  {/* Value Statistics */}
                  <Grid size={{ xs: 12 }}>
                    <ProfessionalCard>
                      <CardContent>
                        <Typography variant="h6" sx={{ mb: 3, color: primaryColor, fontWeight: 700 }}>
                          Valuation Summary
                        </Typography>
                        <Grid container spacing={3}>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Box sx={{ textAlign: 'center', p: 2, borderRight: { md: '1px solid #E5E7EB' } }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                NDP Before Audit
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: primaryColor }}>
                                ₹ {summary?.ndpBefore?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Box sx={{ textAlign: 'center', p: 2, borderRight: { md: '1px solid #E5E7EB' } }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                NDP After Audit
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: '#10B981' }}>
                                ₹ {summary?.ndpAfter?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Box sx={{ textAlign: 'center', p: 2, borderRight: { md: '1px solid #E5E7EB' } }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                MRP After Audit
                              </Typography>
                              <Typography variant="h5" sx={{ fontWeight: 700, color: '#8B5CF6' }}>
                                ₹ {summary?.mrpAfter?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Box sx={{ textAlign: 'center', p: 2 }}>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Value Difference
                              </Typography>
                              <Typography variant="h5" sx={{
                                fontWeight: 700,
                                color: ((summary?.ndpAfter || 0) - (summary?.ndpBefore || 0)) >= 0 ? '#10B981' : '#EF4444'
                              }}>
                                {((summary?.ndpAfter || 0) - (summary?.ndpBefore || 0)) >= 0 ? '+' : ''}
                                ₹ {Math.abs((summary?.ndpAfter || 0) - (summary?.ndpBefore || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </ProfessionalCard>
                  </Grid>

                  {/* Line Items Statistics */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <ProfessionalCard>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar sx={{ bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6', mr: 2 }}>
                            <TrendingUp />
                          </Avatar>
                          <Typography variant="h6">Audit Statistics</Typography>
                        </Box>
                        <Stack spacing={2}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">Line Items Counted</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {summary?.lineItemsDup?.toLocaleString() || '0'}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">Unique Line Items</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {summary?.lineItemsUnique?.toLocaleString() || '0'}
                            </Typography>
                          </Box>
                          <Divider />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">Extras Found</Typography>
                            <Chip
                              label={summary?.extrasUnique?.toLocaleString() || '0'}
                              color="warning"
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          </Box>
                        </Stack>
                      </CardContent>
                    </ProfessionalCard>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* TVS Template Section */}
            <Box sx={{ mt: 6 }}>
              <Divider sx={{ mb: 4 }}>
                <Chip label="TVS Template Generator" sx={{ px: 3, py: 1 }} />
              </Divider>

              <ProfessionalCard>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar sx={{
                      bgcolor: alpha('#F59E0B', 0.1),
                      color: '#F59E0B',
                      mr: 2,
                      width: 56,
                      height: 56
                    }}>
                      <Description sx={{ fontSize: 28 }} />
                    </Avatar>
                    <Box>
                      <Typography variant="h5" gutterBottom sx={{ color: primaryColor, fontWeight: 700 }}>
                        TVS Template Generator
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Generate a formatted template for TVS system integration
                      </Typography>
                    </Box>
                  </Box>

                  <Grid container spacing={3}>
                    {/* Step 1: Upload After File */}
                    <Grid size={{ xs: 12 }}>
                      <Paper elevation={0} sx={{ p: 3, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: primaryColor }}>
                          Step 1: Upload After File for TVS Template (Optional)
                        </Typography>
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          p: 3,
                          border: '2px dashed',
                          borderColor: '#E5E7EB',
                          borderRadius: 2,
                          mt: 2,
                          '&:hover': { borderColor: primaryColor }
                        }}>
                          <Button
                            variant="outlined"
                            component="label"
                            startIcon={<CloudUpload />}
                            sx={{
                              borderRadius: '12px',
                              textTransform: 'none',
                              fontWeight: 600,
                              padding: '8px 20px',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              },
                              borderColor: primaryColor,
                              color: primaryColor
                            }}
                          >
                            Select TVS After File
                            <input
                              ref={tvsAfterInputRef}
                              type="file"
                              hidden
                              accept=".xlsx, .xls"
                              onClick={e => { e.currentTarget.value = ''; }}
                              onChange={(e) => handleFileUpload(e, 'tvsAfter')}
                            />
                          </Button>
                          {tvsAfterFileName && (
                            <Chip
                              label={tvsAfterFileName}
                              color="primary"
                              variant="outlined"
                              onDelete={() => clearFile('tvsAfter')}
                              sx={{ maxWidth: 400 }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Upload the post-adjustment file (same format as Physical) to subtract quantities from the TVS template.
                        </Typography>
                      </Paper>
                    </Grid>

                    {/* Step 2: Enter IDs */}
                    <Grid size={{ xs: 12 }}>
                      <Paper elevation={0} sx={{ p: 3, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: primaryColor }}>
                          Step 2: Enter Configuration IDs
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                              fullWidth
                              label="DEALER_ID"
                              value={dealerId}
                              onChange={(e) => setDealerId(e.target.value)}
                              variant="outlined"
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                              fullWidth
                              label="BRANCH_ID"
                              value={branchId}
                              onChange={(e) => setBranchId(e.target.value)}
                              variant="outlined"
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                              fullWidth
                              label="MANUFACTURER_ID"
                              value={manufacturerId}
                              onChange={(e) => setManufacturerId(e.target.value)}
                              variant="outlined"
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                              fullWidth
                              label="TAXABLE"
                              value={taxable}
                              onChange={(e) => setTaxableId(e.target.value)}
                              variant="outlined"
                              placeholder="Y"
                            />
                          </Grid>
                        </Grid>
                      </Paper>
                    </Grid>

                    {/* Step 3: Generate */}
                    <Grid size={{ xs: 12 }}>
                      <Paper elevation={0} sx={{ p: 3, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: primaryColor, textAlign: 'center' }}>
                          Step 3: Generate Template
                        </Typography>
                        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                          <ActionButton
                            variant="contained"
                            size="large"
                            onClick={generateTvsTemplate}
                            disabled={!physicalData}
                            startIcon={<Assessment />}
                            sx={{
                              backgroundColor: '#F59E0B',
                              '&:hover': { backgroundColor: '#D97706' }
                            }}
                          >
                            Generate TVS Template
                          </ActionButton>
                          <ActionButton
                            variant="outlined"
                            onClick={downloadTvsTemplate}
                            disabled={!tvsTemplateData}
                            startIcon={<Download />}
                            sx={{ borderColor: '#10B981', color: '#10B981' }}
                          >
                            Download TVS Template
                          </ActionButton>
                          <ActionButton
                            variant="outlined"
                            color="error"
                            onClick={clearTvsTemplate}
                            startIcon={<Delete />}
                          >
                            Clear TVS Inputs
                          </ActionButton>
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>
                </CardContent>
              </ProfessionalCard>

              {/* TVS Template Data Grid */}
              {tvsTemplateData && (
                <Box sx={{ mt: 4 }}>
                  <Paper elevation={0} sx={{ height: 400, mb: 3, borderRadius: 2 }}>
                    <StyledDataGrid
                      rows={tvsTemplateData.slice(1).map((row, index) => {
                        const rowObj: any = { id: index + 1 };
                        tvsTemplateData[0].forEach((header, i) => {
                          rowObj[header] = row[i];
                        });
                        return rowObj;
                      })}
                      columns={tvsTemplateData[0].map(header => ({
                        field: header,
                        headerName: header,
                        flex: 1,
                        editable: header === 'STOCK' || header === 'TAXABLE',
                      }))}
                      density="compact"
                      processRowUpdate={(newRow: GridRowModel, oldRow: GridRowModel) => {
                        const partNo = newRow.SPARE_PART_NO;
                        const rack = newRow.RACK;
                        const newQuantity = parseFloat(newRow.STOCK) || 0;

                        const rowIndex = tvsTemplateData.findIndex(
                          (row, idx) => idx > 0 && row[2] === partNo && row[5] === rack
                        );

                        if (rowIndex > 0) {
                          handleTvsStockEdit(partNo, rack, newQuantity, rowIndex);
                        }
                        return newRow;
                      }}
                      onProcessRowUpdateError={(err: any) => console.error(err)}
                    />
                  </Paper>

                  {/* TVS Template Total */}
                  <ProfessionalCard sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ bgcolor: alpha(primaryColor, 0.1), color: primaryColor, mr: 2 }}>
                            <Inventory />
                          </Avatar>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Total Stock in TVS Template
                          </Typography>
                        </Box>
                        <Typography variant="h4" sx={{ color: primaryColor, fontWeight: 700 }}>
                          {formatNumber(tvsStockTotal)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </ProfessionalCard>

                  {/* Stock Comparison Check */}
                  {reportData && reportData.length > 1 && (
                    <Alert
                      severity={Math.abs(reportData[1][4] - tvsStockTotal) <= 0.01 ? "success" : "warning"}
                      sx={{ mb: 3 }}
                      icon={Math.abs(reportData[1][4] - tvsStockTotal) <= 0.01 ? <CheckCircle /> : <Warning />}
                    >
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          Stock Total Comparison
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 4, mt: 1 }}>
                          <Typography variant="body2">
                            Report Physical Total: <Box component="span" sx={{ fontWeight: 'bold' }}>{formatNumber(reportData[1][5])}</Box>
                          </Typography>
                          <Typography variant="body2">
                            TVS Template Total: <Box component="span" sx={{ fontWeight: 'bold' }}>{formatNumber(tvsStockTotal)}</Box>
                          </Typography>
                          <Chip
                            label={Math.abs(reportData[1][5] - tvsStockTotal) <= 0.01 ? "Totals Match" : "Totals Don't Match"}
                            color={Math.abs(reportData[1][5] - tvsStockTotal) <= 0.01 ? "success" : "error"}
                            size="small"
                          />
                        </Box>
                      </Box>
                    </Alert>
                  )}

                  {/* Unmatched Entries Alerts */}
                  {(unmatchedEntries.mismatchedRack.length > 0 || unmatchedEntries.emptyRack.length > 0 || unmatchedEntries.partNotFound.length > 0) && (
                    <Box sx={{ mt: 4 }}>
                      {unmatchedEntries.mismatchedRack.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            Mismatched Rack Locations (No Subtraction Applied)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#FEF3C7' }}>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Part No</Box></TableCell>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Wrong Rack</Box></TableCell>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Quantity</Box></TableCell>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Available Racks</Box></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {unmatchedEntries.mismatchedRack.map((row, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{row.partNo}</TableCell>
                                    <TableCell sx={{ color: '#EF4444' }}>{row.wrongRack}</TableCell>
                                    <TableCell>{row.quantity}</TableCell>
                                    <TableCell sx={{ color: '#10B981' }}>{row.availableRacks}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Alert>
                      )}

                      {unmatchedEntries.emptyRack.length > 0 && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            Empty Rack in After File (No Subtraction Applied)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#DBEAFE' }}>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Part No</Box></TableCell>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Quantity</Box></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {unmatchedEntries.emptyRack.map((row, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{row.partNo}</TableCell>
                                    <TableCell>{row.quantity}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Alert>
                      )}

                      {(unmatchedEntries.mismatchedRack.length > 0 || unmatchedEntries.emptyRack.length > 0) && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, mb: 3 }}>
                          <ActionButton
                            variant="contained"
                            onClick={() => applyUnmatchedQuantities(unmatchedEntries)}
                            startIcon={<CompareArrows />}
                            sx={{
                              backgroundColor: '#FF5722',
                              '&:hover': { backgroundColor: '#E64A19' },
                              color: 'white',
                              px: 3,
                              py: 1.5,
                              fontSize: '0.95rem',
                              fontWeight: 600
                            }}
                          >
                            Apply Mismatched/Empty to Highest Stock Rack
                          </ActionButton>
                        </Box>
                      )}
                      {unmatchedEntries.partNotFound.length > 0 && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            Part Not Found in Physical Stock (No Subtraction Applied)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow sx={{ bgcolor: '#FEE2E2' }}>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Part No</Box></TableCell>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Rack</Box></TableCell>
                                  <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Quantity</Box></TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {unmatchedEntries.partNotFound.map((row, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell sx={{ color: '#EF4444' }}>{row.partNo}</TableCell>
                                    <TableCell>{row.rack}</TableCell>
                                    <TableCell>{row.quantity}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Alert>
                      )}
                    </Box>
                  )}
                  {incompleteParts.length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        Parts with Incomplete or Ambiguous Subtractions
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        These parts could not be fully processed due to insufficient stock in highest rack or ambiguous rack selection:
                      </Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#FEE2E2' }}>
                              <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Part No</Box></TableCell>
                              <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Requested Qty</Box></TableCell>
                              <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Actually Subtracted</Box></TableCell>
                              <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Remaining</Box></TableCell>
                              <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Available Stock</Box></TableCell>
                              <TableCell><Box component="span" sx={{ fontWeight: 'bold' }}>Issue</Box></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {incompleteParts.map((part, idx) => (
                              <TableRow key={idx}>
                                <TableCell sx={{ fontWeight: 'bold', color: '#EF4444' }}>
                                  {part.partNo}
                                </TableCell>
                                <TableCell>{part.requestedQty}</TableCell>
                                <TableCell sx={{ color: '#10B981' }}>{part.actualSubtracted}</TableCell>
                                <TableCell sx={{
                                  color: part.remainingQty > 0 ? '#EF4444' : '#6B7280',
                                  fontWeight: part.remainingQty > 0 ? 'bold' : 'normal'
                                }}>
                                  {part.remainingQty}
                                </TableCell>
                                <TableCell>{part.totalAvailable}</TableCell>
                                <TableCell sx={{ fontSize: '0.875rem' }}>
                                  {part.issue}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <ActionButton
                          variant="outlined"
                          size="small"
                          onClick={() => setIncompleteParts([])}
                          startIcon={<Delete />}
                        >
                          Clear Alerts
                        </ActionButton>
                      </Box>
                    </Alert>
                  )}

                </Box>
              )}
            </Box>

            {/* Final Download All Button */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 6,
              pb: 4
            }}>
              <Zoom in={!!reportData}>
                <ActionButton
                  variant="contained"
                  size="large"
                  startIcon={<Download />}
                  onClick={downloadAllExcel}
                  disabled={!reportData}
                  sx={{
                    px: 6,
                    py: 2,
                    fontSize: '1.1rem',
                    backgroundColor: '#8B5CF6',
                    '&:hover': { backgroundColor: '#7C3AED' },
                    boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.4)',
                  }}
                >
                  DOWNLOAD ALL FILES
                </ActionButton>
              </Zoom>
            </Box>
          </>
        )}
      </Container>
    </Box>
  );
};

export default StockComparison;