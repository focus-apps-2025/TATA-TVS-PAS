import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Container,
  Divider,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Download as DownloadIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import api, { type Rack as ApiRack } from '../services/api';
import authManager from '../services/authSession';

interface ApiComparisonRow {
  id: string;
  partNo: string;
  description: string;
  dmsQty: number;
  physicalQty: number;
  short: number;
  excess: number;
  ndp?: number;
  mrp?: number;
}

interface ReportRow {
  id: string;
  slNo: number | string;
  partNo: string;
  description: string;
  dmsQty: number;
  physicalQty: number;
  short: number;
  excess: number;
  ndp: number;
  mrp: number;
  shortageValue: number;
  excessValue: number;
  totalNdpValue: number;
  totalMrpValue: number;
  beforeNdp: number;
  isTotal?: boolean;
}

type AuditType = 'before' | 'after';
type TeamAuditType = 'TVS' | 'TATA';
type ComparisonFilter = 'all' | 'shortage' | 'excess' | 'matched' | 'dmsOnly' | 'physicalOnly';

interface SummaryStats {
  countPartNoBefore: number;       // DMS line count (unique part numbers in DMS)
  countPartNoAfter: number;        // DMS count + unique physical-only extras
  countShortage: number;           // rows where short > 0
  countExcess: number;             // rows where excess > 0
  totalNdpBefore: number;          // sum of beforeNdp
  totalNdpAfter: number;           // sum of totalNdpValue
  noLineItemsDup: number;          // physical counted lines including duplicates (beforeAudit lines)
  noLineItemsUnique: number;       // unique physical part numbers (afterAudit unique parts)
  valueShortage: number;           // sum of shortageValue
  valueExcess: number;             // sum of excessValue
  extrasUnique: number;            // count of unique physical parts NOT in DMS
  totalMrpAfter: number;           // sum of totalMrpValue
}

interface AuditRow {
  id: string;
  sNo: number;
  pageNo: number;
  location: string;
  rack: string;
  partNo: string;
  phyQty: number;
  partDescription: string;
  ndp: number;
  mrp: number;
}

type NewAuditRow = Omit<AuditRow, 'id'>;

interface ApiAuditItem {
  _id?: string;
  sNo?: unknown;
  pageNo?: unknown;
  location?: string;
  rack?: string;
  partNo?: string;
  phyQty?: unknown;
  partDescription?: string;
  ndp?: unknown;
  mrp?: unknown;
}

interface ApiAuditResponse {
  auditType: AuditType;
  fileName?: string;
  items?: ApiAuditItem[];
}

interface MasterPriceInfo {
  ndp: number;
  mrp: number;
}

interface SummaryMetric {
  label: string;
  value: string;
  isNumeric: boolean;
  color?: string;
}

const primaryColor = '#004F98';
const TVS_LOCATION_OPTIONS = [
  'LUBRICANTS',
  'PARTS',
  'KIT',
  'CONSUMER PRODUCTS',
  'LOCAL ITEMS',
  'SPARES',
  'ACCESSORIES',
  '3W',
  '2W'
];

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: number) =>
  value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const normalizePartNo = (value: unknown): string => String(value || '').trim().toUpperCase();

const stripAuditRowId = <T extends { id?: string }>(row: T) => {
  const nextRow = { ...row };
  delete nextRow.id;
  return nextRow;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message?: string }).message || fallback;
  }
  return fallback;
};

const buildAdjustmentMap = (auditRows: AuditRow[]): Map<string, number> => {
  const adjustmentMap = new Map<string, number>();

  auditRows.forEach((row) => {
    const partNo = normalizePartNo(row.partNo);
    const quantity = toNumber(row.phyQty);

    if (!partNo || quantity <= 0) return;

    adjustmentMap.set(partNo, (adjustmentMap.get(partNo) || 0) + quantity);
  });

  return adjustmentMap;
};

const makeReportRow = (row: ApiComparisonRow, index: number): ReportRow => {
  const dmsQty = toNumber(row.dmsQty);
  const physicalQty = toNumber(row.physicalQty);
  const ndp = toNumber(row.ndp);
  const mrp = toNumber(row.mrp);
  const short = Math.max(0, dmsQty - physicalQty);
  const excess = Math.max(0, physicalQty - dmsQty);

  return {
    id: row.id || row.partNo,
    slNo: index + 1,
    partNo: row.partNo,
    description: row.description || '',
    dmsQty,
    physicalQty,
    short,
    excess,
    ndp,
    mrp,
    shortageValue: short * ndp,
    excessValue: excess * ndp,
    totalNdpValue: physicalQty * ndp,
    totalMrpValue: physicalQty * mrp,
    beforeNdp: dmsQty * ndp
  };
};

const TeamReport: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string>('Team Report');
  const [teamAuditType, setTeamAuditType] = useState<TeamAuditType>('TVS');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [dmsPartNoBeforeCount, setDmsPartNoBeforeCount] = useState<number>(0);
  const [uploadDate, setUploadDate] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingPhysicalQtyEdits, setPendingPhysicalQtyEdits] = useState<Record<string, number>>({});
  const [savingPhysicalQty, setSavingPhysicalQty] = useState(false);
  const [activeAuditView, setActiveAuditView] = useState<AuditType | null>(null);
  const [auditRows, setAuditRows] = useState<Record<AuditType, AuditRow[]>>({ before: [], after: [] });
  const [auditFileNames, setAuditFileNames] = useState<Record<AuditType, string>>({ before: '', after: '' });
  const [pendingAuditEdits, setPendingAuditEdits] = useState<Record<AuditType, boolean>>({ before: false, after: false });
  const [savingAudit, setSavingAudit] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [addRowModalOpen, setAddRowModalOpen] = useState(false);
  const [comparisonSearch, setComparisonSearch] = useState<string>('');
  const [comparisonFilter, setComparisonFilter] = useState<ComparisonFilter>('all');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [newAuditRow, setNewAuditRow] = useState<NewAuditRow>({
    sNo: 1,
    pageNo: 1,
    location: '',
    rack: '',
    partNo: '',
    phyQty: 0,
    partDescription: '',
    ndp: 0,
    mrp: 0
  });

  useEffect(() => {
    authManager.getCurrentUser().then((user) => setCurrentUserRole(user?.role || ''));
  }, []);

  useEffect(() => {
    if (currentUserRole === 'site_manager' && activeAuditView === null) {
      setActiveAuditView('before');
    }
  }, [currentUserRole, activeAuditView]);

  useEffect(() => {
    const fetchReportData = async () => {
      if (!teamId) return;
      setLoading(true);
      setError(null);

      try {
        // Fetch team details to get site name
        try {
          const team = await api.getTeamById(teamId);
          if (team && team.siteName) {
            setSiteName(team.siteName);
          }
          setTeamAuditType(team.auditType || 'TVS');
        } catch (e) {
          console.error("Failed to fetch team details", e);
        }

        const response = await api.getDMSComparison(teamId);
        const calculatedRows = (response.data || []).map((row: ApiComparisonRow, index: number) =>
          makeReportRow(row, index)
        );
        setRows(calculatedRows);
        setDmsPartNoBeforeCount(calculatedRows.filter((row: ReportRow) => toNumber(row.dmsQty) > 0).length);
        setPendingPhysicalQtyEdits({});
        setUploadDate(response.uploadDate || null);
        setFileName(response.fileName || null);

        const auditsResponse = await api.getBeforeAfterAudits(teamId);
        const nextAuditRows: Record<AuditType, AuditRow[]> = { before: [], after: [] };
        const nextAuditFileNames: Record<AuditType, string> = { before: '', after: '' };
        const audits = Array.isArray(auditsResponse.data) ? auditsResponse.data as ApiAuditResponse[] : [];
        audits.forEach((audit) => {
          if (!['before', 'after'].includes(audit.auditType)) return;
          const auditType = audit.auditType as AuditType;
          nextAuditFileNames[auditType] = audit.fileName || '';
          nextAuditRows[auditType] = (audit.items || []).map((item, index: number) => ({
            id: item._id || `${auditType}-${index}`,
            sNo: toNumber(item.sNo) || index + 1,
            pageNo: toNumber(item.pageNo),
            location: item.location || '',
            rack: item.rack || '',
            partNo: item.partNo || '',
            phyQty: toNumber(item.phyQty),
            partDescription: item.partDescription || '',
            ndp: toNumber(item.ndp),
            mrp: toNumber(item.mrp)
          }));
        });
        setAuditRows(nextAuditRows);
        setAuditFileNames(nextAuditFileNames);
        setPendingAuditEdits({ before: false, after: false });
      } catch (error: unknown) {
        setError(getErrorMessage(error, 'Failed to load report data'));
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [teamId]);

  const adjustedRows = useMemo(() => {
    const beforeAdjustmentMap = buildAdjustmentMap(auditRows.before);
    const afterAdjustmentMap = buildAdjustmentMap(auditRows.after);

    return rows.map((row) => {
      const partNoKey = normalizePartNo(row.partNo);
      const adjustedDmsQty = Math.max(0, row.dmsQty - (beforeAdjustmentMap.get(partNoKey) || 0));
      const adjustedPhysicalQty = Math.max(0, row.physicalQty - (afterAdjustmentMap.get(partNoKey) || 0));
      const short = Math.max(0, adjustedDmsQty - adjustedPhysicalQty);
      const excess = Math.max(0, adjustedPhysicalQty - adjustedDmsQty);

      return {
        ...row,
        dmsQty: adjustedDmsQty,
        physicalQty: adjustedPhysicalQty,
        short,
        excess,
        shortageValue: short * row.ndp,
        excessValue: excess * row.ndp,
        totalNdpValue: adjustedPhysicalQty * row.ndp,
        totalMrpValue: adjustedPhysicalQty * row.mrp,
        beforeNdp: adjustedDmsQty * row.ndp
      };
    });
  }, [rows, auditRows.before, auditRows.after]);

  const totalRow = useMemo<ReportRow>(() => {
    const totals = adjustedRows.reduce((acc, row) => ({
      dmsQty: acc.dmsQty + row.dmsQty,
      physicalQty: acc.physicalQty + row.physicalQty,
      short: acc.short + row.short,
      excess: acc.excess + row.excess,
      shortageValue: acc.shortageValue + row.shortageValue,
      excessValue: acc.excessValue + row.excessValue,
      totalNdpValue: acc.totalNdpValue + row.totalNdpValue,
      totalMrpValue: acc.totalMrpValue + row.totalMrpValue,
      beforeNdp: acc.beforeNdp + row.beforeNdp
    }), {
      dmsQty: 0,
      physicalQty: 0,
      short: 0,
      excess: 0,
      shortageValue: 0,
      excessValue: 0,
      totalNdpValue: 0,
      totalMrpValue: 0,
      beforeNdp: 0
    });

    return {
      id: 'total',
      slNo: '',
      partNo: '',
      description: 'TOTAL',
      dmsQty: totals.dmsQty,
      physicalQty: totals.physicalQty,
      short: totals.short,
      excess: totals.excess,
      ndp: 0,
      mrp: 0,
      shortageValue: totals.shortageValue,
      excessValue: totals.excessValue,
      totalNdpValue: totals.totalNdpValue,
      totalMrpValue: totals.totalMrpValue,
      beforeNdp: totals.beforeNdp,
      isTotal: true
    };
  }, [adjustedRows]);

  const displayRows = useMemo(() => adjustedRows.length ? [totalRow, ...adjustedRows] : [], [adjustedRows, totalRow]);

  const filteredAdjustedRows = useMemo(() => {
    const searchText = comparisonSearch.trim().toLowerCase();

    return adjustedRows.filter((row) => {
      const matchesSearch = !searchText || [
        row.partNo,
        row.description,
        String(row.dmsQty),
        String(row.physicalQty),
        String(row.short),
        String(row.excess)
      ].some((value) => value.toLowerCase().includes(searchText));

      if (!matchesSearch) return false;

      if (comparisonFilter === 'shortage') return row.short > 0;
      if (comparisonFilter === 'excess') return row.excess > 0;
      if (comparisonFilter === 'matched') return row.short === 0 && row.excess === 0;
      if (comparisonFilter === 'dmsOnly') return row.dmsQty > 0 && row.physicalQty === 0;
      if (comparisonFilter === 'physicalOnly') return row.dmsQty === 0 && row.physicalQty > 0;

      return true;
    });
  }, [adjustedRows, comparisonFilter, comparisonSearch]);

  const filteredTotalRow = useMemo<ReportRow>(() => {
    const totals = filteredAdjustedRows.reduce((acc, row) => ({
      dmsQty: acc.dmsQty + row.dmsQty,
      physicalQty: acc.physicalQty + row.physicalQty,
      short: acc.short + row.short,
      excess: acc.excess + row.excess,
      shortageValue: acc.shortageValue + row.shortageValue,
      excessValue: acc.excessValue + row.excessValue,
      totalNdpValue: acc.totalNdpValue + row.totalNdpValue,
      totalMrpValue: acc.totalMrpValue + row.totalMrpValue,
      beforeNdp: acc.beforeNdp + row.beforeNdp
    }), {
      dmsQty: 0,
      physicalQty: 0,
      short: 0,
      excess: 0,
      shortageValue: 0,
      excessValue: 0,
      totalNdpValue: 0,
      totalMrpValue: 0,
      beforeNdp: 0
    });

    return {
      ...totalRow,
      dmsQty: totals.dmsQty,
      physicalQty: totals.physicalQty,
      short: totals.short,
      excess: totals.excess,
      shortageValue: totals.shortageValue,
      excessValue: totals.excessValue,
      totalNdpValue: totals.totalNdpValue,
      totalMrpValue: totals.totalMrpValue,
      beforeNdp: totals.beforeNdp
    };
  }, [filteredAdjustedRows, totalRow]);

  const filteredDisplayRows = useMemo(() => (
    filteredAdjustedRows.length ? [filteredTotalRow, ...filteredAdjustedRows] : []
  ), [filteredAdjustedRows, filteredTotalRow]);

  const filteredAuditRows = useMemo(() => {
    if (!activeAuditView) return [];
    const searchText = auditSearch.trim().toLowerCase();
    if (!searchText) return auditRows[activeAuditView];

    return auditRows[activeAuditView].filter((row) => [
      row.location,
      row.rack,
      row.partNo,
      row.partDescription,
      String(row.phyQty),
      String(row.ndp),
      String(row.mrp)
    ].some((value) => value.toLowerCase().includes(searchText)));
  }, [activeAuditView, auditRows, auditSearch]);

  // â”€â”€â”€ Summary Stats (mirrors FinalReport buildSummary logic) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const summaryStats = useMemo<SummaryStats | null>(() => {
    if (!adjustedRows.length) return null;

    // Comparison rows can include physical-only parts; the before-audit count should stay DMS-only.
    const comparisonPartCount = adjustedRows.length;

    // Physical-only extras: unique partNos in afterAudit rows that are NOT present in DMS rows
    const dmsPartNoSet = new Set(adjustedRows.map(r => r.partNo.toUpperCase()));
    const afterRows = auditRows.after;
    const beforeRows = auditRows.before;

    const physOnlyUniqueSet = new Set(
      afterRows
        .map(r => r.partNo.trim().toUpperCase())
        .filter(p => p && !dmsPartNoSet.has(p))
    );
    const extrasUnique = physOnlyUniqueSet.size;

    // Count of Part No. after audit = DMS unique + unique physical-only extras
    const countPartNoAfter = comparisonPartCount + extrasUnique;

    // No of Line item counted (with duplicates) = total before-audit rows
    const noLineItemsDup = beforeRows.length;

    // No of Line item counted - Unique = unique partNos in before-audit
    const beforePartNoSet = new Set(
      beforeRows.map(r => r.partNo.trim().toUpperCase()).filter(p => !!p)
    );
    const noLineItemsUnique = beforePartNoSet.size;

    return {
      countPartNoBefore: dmsPartNoBeforeCount,
      countPartNoAfter,
      countShortage: adjustedRows.filter(r => r.short > 0).length,
      countExcess: adjustedRows.filter(r => r.excess > 0).length,
      totalNdpBefore: totalRow.beforeNdp,
      totalNdpAfter: totalRow.totalNdpValue,
      noLineItemsDup,
      noLineItemsUnique,
      valueShortage: totalRow.shortageValue,
      valueExcess: totalRow.excessValue,
      extrasUnique,
      totalMrpAfter: totalRow.totalMrpValue
    };
  }, [adjustedRows, auditRows, dmsPartNoBeforeCount, totalRow]);

  const updatePhysicalQty = (rowId: string, value: string) => {
    const physicalQty = toNumber(value);
    const editedPartNo = rows.find((row) => row.id === rowId)?.partNo || '';
    setRows((previousRows) => previousRows.map((row) => {
      if (row.id !== rowId) return row;
      const short = Math.max(0, row.dmsQty - physicalQty);
      const excess = Math.max(0, physicalQty - row.dmsQty);
      return {
        ...row,
        physicalQty,
        short,
        excess,
        shortageValue: short * row.ndp,
        excessValue: excess * row.ndp,
        totalNdpValue: physicalQty * row.ndp,
        totalMrpValue: physicalQty * row.mrp
      };
    }));
    if (editedPartNo) {
      setPendingPhysicalQtyEdits((previousEdits) => ({
        ...previousEdits,
        [editedPartNo]: physicalQty
      }));
    }
  };

  const handleSavePhysicalQty = async () => {
    if (!teamId || currentUserRole === 'site_manager') return;

    const updates = Object.entries(pendingPhysicalQtyEdits).map(([partNo, physicalQty]) => ({
      partNo,
      physicalQty
    }));

    if (!updates.length) return;

    setSavingPhysicalQty(true);
    setError(null);

    try {
      await api.updateDMSPhysicalQty({ teamId, updates });
      setPendingPhysicalQtyEdits({});
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to save physical quantity edits'));
    } finally {
      setSavingPhysicalQty(false);
    }
  };

  const updateAuditCell = (auditType: AuditType, rowId: string, field: keyof AuditRow, value: string) => {
    setAuditRows((previousRows) => ({
      ...previousRows,
      [auditType]: previousRows[auditType].map((row) => {
        if (row.id !== rowId) return row;
        const nextValue = ['sNo', 'pageNo', 'phyQty', 'ndp', 'mrp'].includes(field)
          ? toNumber(value)
          : value;
        return { ...row, [field]: nextValue };
      })
    }));
    setPendingAuditEdits((previousEdits) => ({ ...previousEdits, [auditType]: true }));
  };

  const handleSaveAuditRows = async () => {
    if (!teamId || !activeAuditView) return;

    setSavingAudit(true);
    setError(null);

    try {
      await api.saveBeforeAfterAudit({
        teamId,
        auditType: activeAuditView,
        fileName: auditFileNames[activeAuditView],
        items: auditRows[activeAuditView].map(stripAuditRowId)
      });
      setPendingAuditEdits((previousEdits) => ({ ...previousEdits, [activeAuditView]: false }));
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to save audit rows'));
    } finally {
      setSavingAudit(false);
    }
  };

  const resetNewAuditRow = () => {
    setNewAuditRow({
      sNo: 1,
      pageNo: 1,
      location: '',
      rack: '',
      partNo: '',
      phyQty: 0,
      partDescription: '',
      ndp: 0,
      mrp: 0
    });
  };

  const handleCloseAddRow = () => {
    if (savingAudit) return;
    setAddRowModalOpen(false);
    resetNewAuditRow();
  };

  const handleNewRowPartNoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;

    setNewAuditRow((previousRow) => ({ ...previousRow, partNo: value }));

    if (!value.trim()) {
      return;
    }

    const normalizedPartNo = value.trim().toLowerCase();
    const currentRows = activeAuditView ? auditRows[activeAuditView] : [];
    const existingMatch = currentRows.find((row) => row.partNo.trim().toLowerCase() === normalizedPartNo);

    if (existingMatch) {
      setNewAuditRow((previousRow) => ({
        ...previousRow,
        partNo: value,
        partDescription: existingMatch.partDescription || previousRow.partDescription,
        ndp: existingMatch.ndp ?? previousRow.ndp,
        mrp: existingMatch.mrp ?? previousRow.mrp
      }));
      return;
    }

    try {
      const response = await api.checkPartNoInMaster(value, siteName);
      if (response.success && response.exists) {
        const { description, ndp, mrp } = response.data || {};
        setNewAuditRow((previousRow) => ({
          ...previousRow,
          partNo: value,
          partDescription: description || previousRow.partDescription,
          ndp: Number.isFinite(Number(ndp)) ? Number(ndp) : previousRow.ndp,
          mrp: Number.isFinite(Number(mrp)) ? Number(mrp) : previousRow.mrp
        }));
      }
    } catch (lookupError) {
      console.error('Error fetching part details:', lookupError);
    }
  };

  const handleSaveNewRow = async () => {
    if (!teamId || !activeAuditView) return;

    const formattedRow: AuditRow = {
      id: `manual-${Date.now()}`,
      sNo: auditRows[activeAuditView].length + 1,
      pageNo: 1,
      location: newAuditRow.location || '',
      rack: newAuditRow.rack || '',
      partNo: newAuditRow.partNo || '',
      phyQty: Number(newAuditRow.phyQty) || 0,
      partDescription: newAuditRow.partDescription || '',
      ndp: Number(newAuditRow.ndp) || 0,
      mrp: Number(newAuditRow.mrp) || 0,
    };

    const nextRows = [...auditRows[activeAuditView], formattedRow];

    setSavingAudit(true);
    setError(null);

    try {
      await api.saveBeforeAfterAudit({
        teamId,
        auditType: activeAuditView,
        fileName: auditFileNames[activeAuditView] || 'manual_entry',
        items: nextRows.map(stripAuditRowId)
      });
      setAuditRows((prev) => ({ ...prev, [activeAuditView]: nextRows }));
      setAddRowModalOpen(false);
      resetNewAuditRow();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to save new row'));
    } finally {
      setSavingAudit(false);
    }
  };

  const numberCell = (params: GridRenderCellParams<ReportRow, number>) => (
    <Box sx={{
      width: '100%',
      textAlign: 'right',
      fontWeight: params.row.isTotal || params.field === 'physicalQty' ? 800 : 500,
      color: params.field === 'short' && (params.value || 0) > 0
        ? '#EF4444'
        : params.field === 'excess' && (params.value || 0) > 0
          ? '#F59E0B'
          : 'inherit'
    }}>
      {formatNumber(toNumber(params.value))}
    </Box>
  );

  const columns: GridColDef<ReportRow>[] = [
    { field: 'slNo', headerName: 'Sl no', width: 80, minWidth: 80, align: 'center', headerAlign: 'center' },
    { field: 'partNo', headerName: 'PartNo', width: 150, minWidth: 150 },
    { field: 'description', headerName: 'Part Description', width: 260, minWidth: 260 },
    { field: 'dmsQty', headerName: 'DMS Stk', width: 125, minWidth: 125, align: 'right', headerAlign: 'right', renderCell: numberCell },
    {
      field: 'physicalQty',
      headerName: 'Phy Stock',
      width: 130,
      minWidth: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params: GridRenderCellParams<ReportRow, number>) => {
        if (params.row.isTotal) return numberCell(params);
        if (currentUserRole === 'site_manager') return numberCell(params);
        return (
          <input
            type="text"
            inputMode="decimal"
            value={params.value ?? 0}
            onChange={(event) => updatePhysicalQty(
              params.row.id,
              event.target.value.replace(/[^0-9.]/g, '')
            )}
            style={{
              width: '100%',
              border: '1px solid #CBD5E1',
              borderRadius: 4,
              padding: '4px 6px',
              textAlign: 'right',
              font: 'inherit',
              fontWeight: 800
            }}
          />
        );
      }
    },
    { field: 'short', headerName: 'Short', width: 110, minWidth: 110, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'excess', headerName: 'Excess', width: 110, minWidth: 110, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'ndp', headerName: 'NDP', width: 110, minWidth: 110, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'mrp', headerName: 'MRP', width: 110, minWidth: 110, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'shortageValue', headerName: 'Shortage Value', width: 155, minWidth: 155, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'excessValue', headerName: 'Excess Value', width: 145, minWidth: 145, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'totalNdpValue', headerName: 'Total NDP Value', width: 170, minWidth: 170, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'totalMrpValue', headerName: 'Total MRP Value', width: 170, minWidth: 170, align: 'right', headerAlign: 'right', renderCell: numberCell },
    { field: 'beforeNdp', headerName: 'Before NDP', width: 150, minWidth: 150, align: 'right', headerAlign: 'right', renderCell: numberCell }
  ];

  const editableAuditCell = (
    params: GridRenderCellParams<AuditRow, string | number>,
    field: keyof AuditRow,
    align: 'left' | 'right' = 'left'
  ) => (
    <input
      type="text"
      value={params.value ?? ''}
      onChange={(event) => activeAuditView && updateAuditCell(activeAuditView, params.row.id, field, event.target.value)}
      style={{
        width: '100%',
        border: '1px solid #CBD5E1',
        borderRadius: 4,
        padding: '4px 6px',
        textAlign: align,
        font: 'inherit'
      }}
    />
  );

  const auditColumns: GridColDef<AuditRow>[] = [
    { field: 'sNo', headerName: 'S.No', width: 90, align: 'right', headerAlign: 'right', renderCell: (params) => editableAuditCell(params, 'sNo', 'right') },
    { field: 'pageNo', headerName: 'Page No', width: 110, align: 'right', headerAlign: 'right', renderCell: (params) => editableAuditCell(params, 'pageNo', 'right') },
    { field: 'location', headerName: 'Location', width: 160, renderCell: (params) => editableAuditCell(params, 'location') },
    { field: 'rack', headerName: 'Rack', width: 120, renderCell: (params) => editableAuditCell(params, 'rack') },
    { field: 'partNo', headerName: 'PartNo', width: 150, renderCell: (params) => editableAuditCell(params, 'partNo') },
    { field: 'phyQty', headerName: 'Phy Qty', width: 120, align: 'right', headerAlign: 'right', renderCell: (params) => editableAuditCell(params, 'phyQty', 'right') },
    { field: 'partDescription', headerName: 'Part Description', width: 320, renderCell: (params) => editableAuditCell(params, 'partDescription') },
    { field: 'ndp', headerName: 'NDP', width: 120, align: 'right', headerAlign: 'right', renderCell: (params) => editableAuditCell(params, 'ndp', 'right') },
    { field: 'mrp', headerName: 'MRP', width: 120, align: 'right', headerAlign: 'right', renderCell: (params) => editableAuditCell(params, 'mrp', 'right') },
  ];

  const applySheetTitle = (worksheet: ExcelJS.Worksheet, title: string, lastColumn: number, color = 'FF004F98') => {
    if (lastColumn < 1) return;
    worksheet.mergeCells(1, 1, 1, lastColumn);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: color } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.border = {
      top: { style: 'medium', color: { argb: color } },
      left: { style: 'medium', color: { argb: color } },
      bottom: { style: 'medium', color: { argb: color } },
      right: { style: 'medium', color: { argb: color } }
    };
    worksheet.getRow(1).height = 28;
  };

  const styleDataWorksheet = (
    worksheet: ExcelJS.Worksheet,
      options: {
        headerRow: number;
        headerFill: string;
        headerFontColor?: string;
        columnWidths: number[];
      rightAlignColumns?: number[];
      centerAlignColumns?: number[];
      numberColumns?: number[];
      integerColumns?: number[];
      highlightColumns?: number[];
      totalRow?: number | null;
      totalFill?: string;
    }
  ) => {
    const {
      headerRow,
      headerFill,
      headerFontColor = 'FFFFFFFF',
      columnWidths,
      rightAlignColumns = [],
      centerAlignColumns = [],
      numberColumns = [],
      integerColumns = [],
      highlightColumns = [],
      totalRow = null,
      totalFill = 'FFEAEAEA'
    } = options;

    const header = worksheet.getRow(headerRow);
    header.height = 24;
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill } };
      cell.font = { bold: true, color: { argb: headerFontColor }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
      };
    });

    for (let i = headerRow + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const isTotal = totalRow !== null && i === totalRow;
      if (isTotal) {
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: totalFill } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
          };
        });
      } else if ((i - headerRow) % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FBFF' } };
        });
      }

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        if (rightAlignColumns.includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
        if (centerAlignColumns.includes(colNumber)) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
        if (numberColumns.includes(colNumber) && typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
        if (integerColumns.includes(colNumber) && typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
        if (highlightColumns.includes(colNumber) && Number(cell.value) > 0) {
          const isExcess = colNumber === 7 || colNumber === 11;
          cell.font = { ...(cell.font || {}), color: { argb: isExcess ? 'FFFFA500' : 'FFFF0000' } };
        }
      });

      row.height = 20;
    }

    worksheet.columns = columnWidths.map((width) => ({ width }));
  };

  const styleComparisonSheet = (worksheet: ExcelJS.Worksheet) => {
    worksheet.columns = [
      { width: 8 },
      { width: 15 },
      { width: 35 },
      { width: 12 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 15 }
    ];

    const headerRow = worksheet.getRow(3);
    headerRow.height = 24;
    const headerColors: Record<number, string> = {
      1: 'FF00529B',
      2: 'FF00529B',
      3: 'FF00529B',
      4: 'FF00529B',
      5: 'FF00B050',
      6: 'FFFF0000',
      7: 'FFFFC000',
      8: 'FF5A4BFF',
      9: 'FF5A4BFF',
      10: 'FFFF0000',
      11: 'FFFFC000',
      12: 'FF5A4BFF',
      13: 'FF5A4BFF',
      14: 'FF5A4BFF'
    };

    headerRow.eachCell((cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColors[colNumber] || 'FF00529B' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
      };
    });

    const totalRow = worksheet.getRow(4);
    totalRow.height = 24;
    totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
      cell.font = { bold: true, color: { argb: 'FF000000' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 3 ? 'center' : 'right' };
      if ([4, 5, 6, 7, 10, 11, 12, 13, 14].includes(colNumber) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });

    for (let i = 5; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };

        if (colNumber === 5) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFDCEBFF' }
          };
          cell.font = { bold: true, color: { argb: 'FF000000' } };
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          }
        }

        if ([4, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(colNumber) && typeof cell.value === 'number') {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        }

        if (colNumber === 6 && Number(cell.value) > 0) {
          cell.font = { ...(cell.font || {}), color: { argb: 'FFFF0000' } };
        }
        if (colNumber === 7 && Number(cell.value) > 0) {
          cell.font = { ...(cell.font || {}), color: { argb: 'FFFFA500' } };
        }
        if (colNumber === 10 && Number(cell.value) > 0) {
          cell.font = { ...(cell.font || {}), color: { argb: 'FFFF0000' } };
        }
        if (colNumber === 11 && Number(cell.value) > 0) {
          cell.font = { ...(cell.font || {}), color: { argb: 'FFFFA500' } };
        }
      });
    }
  };

  const buildSummaryRows = () => {
    if (!summaryStats) return null;
    return [
      ['Count of Part No. before audit', summaryStats.countPartNoBefore, 'Count of Part No. after audit', summaryStats.countPartNoAfter],
      ['Count of Shortage Parts', summaryStats.countShortage, 'Value of Shortage Parts', summaryStats.valueShortage],
      ['Count of Excess Parts', summaryStats.countExcess, 'Value of Excess Parts', summaryStats.valueExcess],
      ['Total NDP Value before audit', summaryStats.totalNdpBefore, 'Total NDP Value after audit', summaryStats.totalNdpAfter],
      ['No of Line item counted', summaryStats.noLineItemsDup, 'Count of Extras found during audit', summaryStats.extrasUnique],
      ['No of Line item counted - Unique', summaryStats.noLineItemsUnique, 'Total MRP Value after audit', summaryStats.totalMrpAfter]
    ];
  };

  const styleSummarySheet = (worksheet: ExcelJS.Worksheet) => {
    applySheetTitle(worksheet, siteName, 4);
    worksheet.getRow(2).height = 10;

    for (let i = 3; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        if (colNumber === 1 || colNumber === 3) {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6F9' } };
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        } else if (colNumber === 2 || colNumber === 4) {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCEBFF' } };
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (typeof cell.value === 'number') {
            const label = String(worksheet.getRow(i).getCell(colNumber === 2 ? 1 : 3).value || '');
            cell.numFmt = /Value|NDP|MRP/i.test(label) ? '₹ #,##0.00' : '#,##0';
          }
        }
      });
      row.height = 25;
    }

    worksheet.columns = [
      { width: 38 },
      { width: 18 },
      { width: 38 },
      { width: 20 }
    ];
  };

  const buildComparisonSheet = () => {
    const comparisonRows: Array<(string | number)[]> = [
      ['Sl no', 'PartNo', 'Part Description', 'DMS Stk', 'Phy Stock', 'Short', 'Excess', 'NDP', 'MRP', 'Shortage Value', 'Excess Value', 'Total NDP Value', 'Total MRP Value', 'Before NDP']
    ];

    displayRows.forEach((row) => {
      if (row.isTotal) {
        comparisonRows.push([
          '', '', 'TOTAL',
          row.dmsQty, row.physicalQty, row.short, row.excess, '', '',
          row.shortageValue, row.excessValue, row.totalNdpValue, row.totalMrpValue, row.beforeNdp
        ]);
      } else {
        comparisonRows.push([
          row.slNo, row.partNo, row.description, row.dmsQty, row.physicalQty, row.short, row.excess,
          row.ndp, row.mrp, row.shortageValue, row.excessValue, row.totalNdpValue, row.totalMrpValue, row.beforeNdp
        ]);
      }
    });

    return comparisonRows;
  };

  const buildRawDmsRows = () => {
    const rowsData: Array<(string | number)[]> = [
      ['Sl.No', 'PartNo', 'Part Description', 'DMS Qty', 'NDP', 'MRP', 'Before NDP']
    ];

    adjustedRows.forEach((row, index) => {
      rowsData.push([
        index + 1,
        row.partNo,
        row.description,
        row.dmsQty,
        row.ndp,
        row.mrp,
        row.beforeNdp
      ]);
    });

    return rowsData;
  };

  const buildRawPhysicalRows = () => {
    const rowsData: Array<(string | number)[]> = [
      ['Sl.No', 'PartNo', 'Part Description', 'Physical Qty', 'NDP', 'MRP', 'Total NDP Value', 'Total MRP Value']
    ];

    adjustedRows.forEach((row, index) => {
      rowsData.push([
        index + 1,
        row.partNo,
        row.description,
        row.physicalQty,
        row.ndp,
        row.mrp,
        row.totalNdpValue,
        row.totalMrpValue
      ]);
    });

    return rowsData;
  };

  const buildAuditRows = (auditType: AuditType) => {
    const title = auditType === 'before' ? 'Raw Before' : 'Raw After';
    const locationValue = auditType === 'before' ? 'BEFORE ISSUED' : 'AFTER ISSUED';
    const rowsData: Array<(string | number)[]> = [
      ['S.No', 'Page No', 'Location', 'Rack', 'PartNo', 'Phy Qty', 'Part Description', 'NDP', 'MRP']
    ];

    auditRows[auditType].forEach((row, index) => {
      rowsData.push([
        row.sNo || index + 1,
        row.pageNo || 1,
        row.location || locationValue,
        row.rack || '',
        row.partNo,
        row.phyQty,
        row.partDescription,
        row.ndp,
        row.mrp
      ]);
    });

    return { title, rowsData };
  };

  const buildTvsTemplateRows = async (racks: ApiRack[]) => {
    const physicalDataMap = new Map<string, boolean>();
    const aggregatedPhysicalStock = new Map<string, {
      partNo: string;
      rack: string;
      quantity: number;
      location: string;
    }>();

    racks.forEach((rack) => {
      const partNo = normalizePartNo(rack.partNo);
      const rackNo = String(rack.rackNo || '').trim();
      const quantity = toNumber(rack.nextQty);
      const location = String(rack.location || '').trim();

      if (!partNo) return;

      const key = `${partNo}|${rackNo}`;
      if (rackNo) {
        physicalDataMap.set(key, true);
      }

      if (aggregatedPhysicalStock.has(key)) {
        aggregatedPhysicalStock.get(key)!.quantity += quantity;
      } else {
        aggregatedPhysicalStock.set(key, {
          partNo,
          rack: rackNo,
          quantity,
          location
        });
      }
    });

    const uniquePartNos = [...new Set([...aggregatedPhysicalStock.values()].map((entry) => entry.partNo))];
    const masterPriceEntries = await Promise.all(
      uniquePartNos.map(async (partNo): Promise<[string, MasterPriceInfo | null]> => {
        try {
          const response = await api.checkPartNoInMaster(partNo, siteName);
          if (response.success && response.exists) {
            return [partNo, {
              ndp: toNumber(response.data?.ndp),
              mrp: toNumber(response.data?.mrp)
            }];
          }
        } catch (lookupError) {
          console.error(`Master data lookup failed for ${partNo}:`, lookupError);
        }
        return [partNo, null];
      })
    );
    const masterPriceMap = new Map(masterPriceEntries.filter((entry): entry is [string, MasterPriceInfo] => entry[1] !== null));

    const perfectMatchSubtractions = new Map<string, number>();
    auditRows.after.forEach((row) => {
      const partNo = normalizePartNo(row.partNo);
      const rackNo = String(row.rack || '').trim();
      const quantity = toNumber(row.phyQty);
      const key = `${partNo}|${rackNo}`;

      if (partNo && rackNo && quantity > 0 && physicalDataMap.has(key)) {
        perfectMatchSubtractions.set(key, (perfectMatchSubtractions.get(key) || 0) + quantity);
      }
    });

    aggregatedPhysicalStock.forEach((entry, key) => {
      if (perfectMatchSubtractions.has(key)) {
        entry.quantity = Math.max(0, entry.quantity - perfectMatchSubtractions.get(key)!);
      }
    });

    const tvsRows: Array<(string | number)[]> = [[
      'DEALER_ID',
      'BRANCH_ID',
      'SPARE_PART_NO',
      'MANUFACTURER_ID',
      'LOCATION_ID',
      'RACK',
      'COST',
      'TAXABLE',
      'STOCK',
      'MRP'
    ]];

    aggregatedPhysicalStock.forEach((entry) => {
      if (entry.quantity > 0) {
        const masterPrice = masterPriceMap.get(entry.partNo);
        tvsRows.push([
          '',
          '',
          entry.partNo,
          '',
          entry.location,
          entry.rack,
          masterPrice?.ndp || 0,
          'Y',
          entry.quantity,
          masterPrice?.mrp || 0
        ]);
      }
    });

    return tvsRows;
  };

  const styleTvsTemplateSheet = (worksheet: ExcelJS.Worksheet) => {
    const headerRow = worksheet.getRow(3);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      cell.font = { color: { argb: 'FFFF0000' }, bold: true, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    for (let i = 4; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;

      if ((i - 4) % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }

      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        if (colNumber === 7 || colNumber === 9 || colNumber === 10) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    }

    worksheet.columns = [
      { width: 15 },
      { width: 15 },
      { width: 20 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 10 },
      { width: 12 },
      { width: 12 }
    ];
  };

  const handleExport = async () => {
    if (!rows.length) return;

    const workbook = new ExcelJS.Workbook();
    const comparisonSheet = workbook.addWorksheet('Stock Comparison');
    const comparisonRows = buildComparisonSheet();
    comparisonSheet.addRows(comparisonRows);
    comparisonSheet.spliceRows(1, 0, [siteName], []);
    applySheetTitle(comparisonSheet, siteName, 14);
    styleComparisonSheet(comparisonSheet);
    comparisonSheet.getRow(2).height = 10;

    if (summaryStats) {
      const summarySheet = workbook.addWorksheet('Summary');
      const summaryRows = buildSummaryRows();
      if (summaryRows) {
        summarySheet.addRows(summaryRows);
        summarySheet.spliceRows(1, 0, [siteName], []);
        styleSummarySheet(summarySheet);
      }
    }

    if (teamAuditType === 'TVS' && teamId) {
      const rackExport = await api.exportAllRacks({ teamId });
      const tvsTemplateSheet = workbook.addWorksheet('TVS Template');
      const tvsTemplateRows = await buildTvsTemplateRows(rackExport as ApiRack[]);
      tvsTemplateSheet.addRows(tvsTemplateRows);
      tvsTemplateSheet.spliceRows(1, 0, [siteName], []);
      applySheetTitle(tvsTemplateSheet, siteName, 10, 'FF004F98');
      tvsTemplateSheet.getRow(2).height = 10;
      styleTvsTemplateSheet(tvsTemplateSheet);
    }

    const rawDmsSheet = workbook.addWorksheet('Raw DMS');
    const rawDmsRows = buildRawDmsRows();
    rawDmsSheet.addRows(rawDmsRows);
    rawDmsSheet.spliceRows(1, 0, [siteName], []);
    applySheetTitle(rawDmsSheet, siteName, 7, 'FF004F98');
    styleDataWorksheet(rawDmsSheet, {
      headerRow: 3,
      headerFill: 'FF00529B',
      columnWidths: [8, 15, 34, 12, 12, 12, 15],
      rightAlignColumns: [4, 5, 6, 7],
      centerAlignColumns: [1],
      numberColumns: [4, 5, 6, 7]
    });
    rawDmsSheet.getRow(2).height = 10;

    const rawPhysicalSheet = workbook.addWorksheet('Raw Physical');
    const rawPhysicalRows = buildRawPhysicalRows();
    rawPhysicalSheet.addRows(rawPhysicalRows);
    rawPhysicalSheet.spliceRows(1, 0, [siteName], []);
    applySheetTitle(rawPhysicalSheet, siteName, 8, 'FF004F98');
    styleDataWorksheet(rawPhysicalSheet, {
      headerRow: 3,
      headerFill: 'FF00B050',
      columnWidths: [8, 15, 34, 12, 12, 12, 18, 18],
      rightAlignColumns: [4, 5, 6, 7, 8],
      centerAlignColumns: [1],
      numberColumns: [4, 5, 6, 7, 8]
    });
    rawPhysicalSheet.getRow(2).height = 10;

    const beforeAudit = buildAuditRows('before');
    const rawBeforeSheet = workbook.addWorksheet(beforeAudit.title);
    rawBeforeSheet.addRows(beforeAudit.rowsData);
    rawBeforeSheet.spliceRows(1, 0, [siteName], []);
    applySheetTitle(rawBeforeSheet, siteName, 9, 'FF004F98');
    styleDataWorksheet(rawBeforeSheet, {
      headerRow: 3,
      headerFill: 'FFF59E0B',
      columnWidths: [8, 10, 18, 10, 16, 12, 35, 12, 12],
      rightAlignColumns: [1, 2, 6, 8, 9],
      centerAlignColumns: [3, 4, 5],
      numberColumns: [1, 2, 6, 8, 9]
    });
    rawBeforeSheet.getRow(2).height = 10;

    const afterAudit = buildAuditRows('after');
    const rawAfterSheet = workbook.addWorksheet(afterAudit.title);
    rawAfterSheet.addRows(afterAudit.rowsData);
    rawAfterSheet.spliceRows(1, 0, [siteName], []);
    applySheetTitle(rawAfterSheet, siteName, 9, 'FF004F98');
    styleDataWorksheet(rawAfterSheet, {
      headerRow: 3,
      headerFill: 'FFDC2626',
      columnWidths: [8, 10, 18, 10, 16, 12, 35, 12, 12],
      rightAlignColumns: [1, 2, 6, 8, 9],
      centerAlignColumns: [3, 4, 5],
      numberColumns: [1, 2, 6, 8, 9]
    });
    rawAfterSheet.getRow(2).height = 10;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Team_Report_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
          <Link color="inherit" href="/admin/teams" sx={{ display: 'flex', alignItems: 'center' }}>
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Teams
          </Link>
          <Link
            color="inherit"
            href={`/admin/teams/${teamId}`}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            Racks
          </Link>
          <Typography color="text.primary">Report</Typography>
        </Breadcrumbs>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          Report
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(`/admin/teams/${teamId}`)}>
            Back
          </Button>
          {currentUserRole !== 'site_manager' && (
            <Button
              variant={activeAuditView === null ? 'contained' : 'outlined'}
              onClick={() => setActiveAuditView(null)}
            >
              Comparison
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => navigate(`/admin/teams/${teamId}/dms-comparison`)}
          >
            DMS Comparison
          </Button>
          <Button
            variant={activeAuditView === 'before' ? 'contained' : 'outlined'}
            onClick={() => setActiveAuditView('before')}
          >
            Before Audit View
          </Button>
          <Button
            variant={activeAuditView === 'after' ? 'contained' : 'outlined'}
            onClick={() => setActiveAuditView('after')}
          >
            After Audit View
          </Button>
          {(activeAuditView || currentUserRole !== 'site_manager') && (
            <Button
              variant="outlined"
              onClick={activeAuditView ? handleSaveAuditRows : handleSavePhysicalQty}
              disabled={activeAuditView
                ? !pendingAuditEdits[activeAuditView] || savingAudit
                : !Object.keys(pendingPhysicalQtyEdits).length || savingPhysicalQty}
            >
              {savingPhysicalQty || savingAudit
                ? 'Saving...'
                : activeAuditView
                  ? `Save ${activeAuditView === 'before' ? 'Before' : 'After'} Audit`
                  : `Save Edits${Object.keys(pendingPhysicalQtyEdits).length ? ` (${Object.keys(pendingPhysicalQtyEdits).length})` : ''}`}
            </Button>
          )}
          {currentUserRole !== 'site_manager' && (
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExport} disabled={!rows.length || Boolean(activeAuditView)}>
              Export Excel
            </Button>
          )}
          {activeAuditView && (
            <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setAddRowModalOpen(true)}>
              Add Row
            </Button>
          )}
        </Box>
      </Box>

      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ width: '100%' }}>
          {activeAuditView ? (
            <>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                {activeAuditView === 'before' ? 'Before Audit' : 'After Audit'}
                {auditFileNames[activeAuditView] ? ` | File: ${auditFileNames[activeAuditView]}` : ' | No upload found yet'}
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Search ${activeAuditView === 'before' ? 'Before' : 'After'} Audit`}
                  value={auditSearch}
                  onChange={(event) => setAuditSearch(event.target.value)}
                  placeholder="Search location, rack, part no, description, quantity, NDP, MRP"
                />
              </Paper>
              {!auditRows[activeAuditView].length ? (
                <Alert severity="info">
                  No {activeAuditView === 'before' ? 'Before' : 'After'} Audit rows found. Upload from Team card three-dot menu.
                </Alert>
              ) : (
                <Box sx={{ width: '100%' }}>
                  <DataGrid
                    autoHeight
                    rows={filteredAuditRows}
                    columns={auditColumns}
                    disableRowSelectionOnClick
                    columnHeaderHeight={52}
                    pageSizeOptions={[15, 25, 50, 100]}
                    initialState={{
                      pagination: {
                        paginationModel: { page: 0, pageSize: 15 }
                      }
                    }}
                    sx={{
                      border: 'none',
                      bgcolor: 'transparent',
                      '& .MuiDataGrid-main': {
                        border: '1px solid #E5E7EB',
                        borderRadius: 1,
                        overflow: 'hidden'
                      },
                      '& .MuiDataGrid-columnHeader': {
                        bgcolor: activeAuditView === 'before' ? '#F59E0B' : '#DC2626',
                        color: '#fff',
                        fontWeight: 800
                      },
                      '& .MuiDataGrid-columnHeaderTitle': {
                        color: '#fff',
                        fontWeight: 800
                      },
                      '& .MuiDataGrid-cell': {
                        borderColor: '#E5E7EB'
                      }
                    }}
                  />
                </Box>
              )}
            </>
          ) : currentUserRole === 'site_manager' ? null : (
            <>
              {uploadDate && (
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                  Latest DMS Upload: {fileName} | Date: {format(new Date(uploadDate), 'dd MMM yyyy, HH:mm')}
                </Typography>
              )}
              <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 1 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Report"
                    value={comparisonSearch}
                    onChange={(event) => setComparisonSearch(event.target.value)}
                    placeholder="Search part no, description, stock, shortage, excess"
                  />
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Filter"
                    value={comparisonFilter}
                    onChange={(event) => setComparisonFilter(event.target.value as ComparisonFilter)}
                  >
                    <MenuItem value="all">All Rows</MenuItem>
                    <MenuItem value="shortage">Shortage Only</MenuItem>
                    <MenuItem value="excess">Excess Only</MenuItem>
                    <MenuItem value="matched">Matched Only</MenuItem>
                    <MenuItem value="dmsOnly">DMS Only</MenuItem>
                    <MenuItem value="physicalOnly">Physical Only</MenuItem>
                  </TextField>
                </Stack>
              </Paper>
              <Box sx={{ width: '100%' }}>
                <DataGrid
                  autoHeight
                  rows={filteredDisplayRows}
                  columns={columns}
                  disableRowSelectionOnClick
                  columnHeaderHeight={52}
                  pageSizeOptions={[15, 25, 50, 100]}
                  initialState={{
                    pagination: {
                      paginationModel: { page: 0, pageSize: 15 }
                    }
                  }}
                  getRowClassName={(params) => params.row.isTotal ? 'row-total' : ''}
                  sx={{
                    border: 'none',
                    bgcolor: 'transparent',
                    '& .MuiDataGrid-main': {
                      border: '1px solid #E5E7EB',
                      borderRadius: 1,
                      overflow: 'hidden'
                    },
                    '& .MuiDataGrid-columnHeader': {
                      bgcolor: primaryColor,
                      color: '#fff',
                      fontWeight: 800
                    },
                    '& .MuiDataGrid-columnHeaderTitle': {
                      color: '#fff',
                      fontWeight: 800,
                      whiteSpace: 'normal',
                      lineHeight: 1.15,
                      overflow: 'visible'
                    },
                    '& .MuiDataGrid-columnSeparator': {
                      color: 'rgba(255,255,255,0.35)'
                    },
                    '& .row-total': {
                      bgcolor: '#E5E7EB',
                      fontWeight: 800
                    },
                    '& .MuiDataGrid-cell': {
                      borderColor: '#E5E7EB'
                    },
                    '& .MuiDataGrid-footerContainer': {
                      borderTop: '1px solid #E5E7EB'
                    }
                  }}
                />
              </Box>

              {/* â”€â”€ Audit Summary Table â”€â”€ */}
              {summaryStats && (
                <Paper
                  variant="outlined"
                  sx={{
                    mt: 4,
                    mb: 2,
                    borderRadius: 2,
                    overflow: 'hidden',
                    borderColor: primaryColor
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: primaryColor,
                      color: '#fff',
                      px: 3,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={700} letterSpacing={0.5}>
                      Audit Summary
                    </Typography>
                  </Box>

                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F1F5F9' }}>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              color: primaryColor,
                              borderRight: '2px solid #E5E7EB',
                              width: '30%'
                            }}
                          >
                            Label
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              color: primaryColor,
                              borderRight: '2px solid #CBD5E1',
                              width: '20%',
                              textAlign: 'right'
                            }}
                          >
                            Value
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              color: primaryColor,
                              borderRight: '2px solid #E5E7EB',
                              width: '30%',
                              pl: 3
                            }}
                          >
                            Label
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              color: primaryColor,
                              width: '20%',
                              textAlign: 'right'
                            }}
                          >
                            Value
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          [
                            {
                              label: 'Count of Part No. before audit',
                              value: summaryStats.countPartNoBefore.toLocaleString('en-IN'),
                              isNumeric: false
                            },
                            {
                              label: 'Count of Part No. after audit',
                              value: summaryStats.countPartNoAfter.toLocaleString('en-IN'),
                              isNumeric: false
                            }
                          ],
                          [
                            {
                              label: 'Count of Shortage Parts',
                              value: summaryStats.countShortage.toLocaleString('en-IN'),
                              isNumeric: false,
                              color: summaryStats.countShortage > 0 ? '#EF4444' : undefined
                            },
                            {
                              label: 'Value of Shortage Parts',
                              value: `₹ ${formatNumber(summaryStats.valueShortage)}`,
                              isNumeric: true,
                              color: summaryStats.valueShortage > 0 ? '#EF4444' : undefined
                            }
                          ],
                          [
                            {
                              label: 'Count of Excess Parts',
                              value: summaryStats.countExcess.toLocaleString('en-IN'),
                              isNumeric: false,
                              color: summaryStats.countExcess > 0 ? '#F59E0B' : undefined
                            },
                            {
                              label: 'Value of Excess Parts',
                              value: `₹ ${formatNumber(summaryStats.valueExcess)}`,
                              isNumeric: true,
                              color: summaryStats.valueExcess > 0 ? '#F59E0B' : undefined
                            }
                          ],
                          [
                            {
                              label: 'Total NDP Value before audit',
                              value: `₹ ${formatNumber(summaryStats.totalNdpBefore)}`,
                              isNumeric: true
                            },
                            {
                              label: 'Total NDP Value after audit',
                              value: `₹ ${formatNumber(summaryStats.totalNdpAfter)}`,
                              isNumeric: true,
                              color: '#10B981'
                            }
                          ],
                          [
                            {
                              label: 'No of Line item counted',
                              value: summaryStats.noLineItemsDup.toLocaleString('en-IN'),
                              isNumeric: false
                            },
                            {
                              label: 'Count of Extras found during audit',
                              value: summaryStats.extrasUnique.toLocaleString('en-IN'),
                              isNumeric: false
                            }
                          ],
                          [
                            {
                              label: 'No of Line item counted - Unique',
                              value: summaryStats.noLineItemsUnique.toLocaleString('en-IN'),
                              isNumeric: false
                            },
                            {
                              label: 'Total MRP Value after audit',
                              value: `₹ ${formatNumber(summaryStats.totalMrpAfter)}`,
                              isNumeric: true,
                              color: '#8B5CF6'
                            }
                          ]
                        ].map((pair: SummaryMetric[], rowIdx) => (
                          <TableRow
                            key={rowIdx}
                            sx={{
                              bgcolor: rowIdx % 2 === 0 ? '#FAFAFA' : '#fff',
                              '&:hover': { bgcolor: '#F0F4FF' }
                            }}
                          >
                            <TableCell
                              sx={{
                                fontWeight: 500,
                                color: '#374151',
                                borderRight: '2px solid #E5E7EB',
                                py: 1.2
                              }}
                            >
                              {pair[0].label}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontWeight: 700,
                                color: pair[0].color || '#1F2937',
                                textAlign: 'right',
                                borderRight: '2px solid #CBD5E1',
                                fontVariantNumeric: 'tabular-nums',
                                py: 1.2
                              }}
                            >
                              {pair[0].value}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontWeight: 500,
                                color: '#374151',
                                borderRight: '2px solid #E5E7EB',
                                pl: 3,
                                py: 1.2
                              }}
                            >
                              {pair[1].label}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontWeight: 700,
                                color: pair[1].color || '#1F2937',
                                textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums',
                                py: 1.2
                              }}
                            >
                              {pair[1].value}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Divider />
                  <Box sx={{ px: 3, py: 1, bgcolor: '#F8FAFC' }}>
                    <Typography variant="caption" color="text.secondary">
                      * Summary recalculates live when Phy Stock values or Before/After audit data are edited.
                      &nbsp;Before audit line counts are read from saved Before Audit data for this team.
                    </Typography>
                  </Box>
                </Paper>
              )}
            </>
          )}
        </Box>
      )}

      {/* Add Row Modal */}
      <Dialog open={addRowModalOpen} onClose={() => handleCloseAddRow()} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: primaryColor, color: 'white' }}>
          Add {activeAuditView === 'before' ? 'Before' : 'After'} Audit Row
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {teamAuditType === 'TVS' ? (
                <TextField
                  select
                  label="Location"
                  fullWidth
                  size="small"
                  value={newAuditRow.location}
                  onChange={(e) => setNewAuditRow((prev) => ({ ...prev, location: e.target.value }))}
                >
                  {TVS_LOCATION_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  label="Location"
                  fullWidth
                  size="small"
                  value={newAuditRow.location}
                  onChange={(e) => setNewAuditRow((prev) => ({ ...prev, location: e.target.value }))}
                />
              )}
              <TextField
                label="Rack"
                fullWidth
                size="small"
                value={newAuditRow.rack}
                onChange={(e) => setNewAuditRow((prev) => ({ ...prev, rack: e.target.value }))}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Part No"
                fullWidth
                size="small"
                value={newAuditRow.partNo}
                onChange={handleNewRowPartNoChange}
              />
              <TextField
                label="Phy Qty"
                fullWidth
                size="small"
                type="number"
                value={newAuditRow.phyQty}
                onChange={(e) => setNewAuditRow((prev) => ({ ...prev, phyQty: Number(e.target.value) || 0 }))}
              />
            </Stack>
            <TextField
              label="Part Description"
              fullWidth
              size="small"
              value={newAuditRow.partDescription}
              InputProps={{ readOnly: true }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="NEW NDP"
                fullWidth
                size="small"
                type="number"
                value={newAuditRow.ndp}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="NEW MRP"
                fullWidth
                size="small"
                type="number"
                value={newAuditRow.mrp}
                InputProps={{ readOnly: true }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
          <Button onClick={() => handleCloseAddRow()} disabled={savingAudit}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveNewRow}
            disabled={savingAudit || !newAuditRow.partNo}
            sx={{ bgcolor: primaryColor, '&:hover': { bgcolor: '#003F7A' } }}
          >
            {savingAudit ? <CircularProgress size={24} /> : 'Save Row'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default TeamReport;



