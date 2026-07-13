import api from '../services/api';

export interface SummaryStats {
  countPartNoBefore: number;
  countPartNoAfter: number;
  countShortage: number;
  countExcess: number;
  totalNdpBefore: number;
  totalNdpAfter: number;
  noLineItemsDup: number;
  noLineItemsUnique: number;
  valueShortage: number;
  valueExcess: number;
  extrasUnique: number;
  totalMrpAfter: number;
}

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const fetchAndComputeSummaryStats = async (teamId: string): Promise<SummaryStats | null> => {
  try {
    const [dmsResponse, auditsResponse] = await Promise.all([
      api.getDMSComparison(teamId),
      api.getBeforeAfterAudits(teamId)
    ]);

    const dmsData = dmsResponse.data || [];
    const beforeRows: any[] = [];
    const afterRows: any[] = [];

    (auditsResponse.data || []).forEach((audit: any) => {
      if (audit.auditType === 'before') {
        beforeRows.push(...(audit.items || []));
      } else if (audit.auditType === 'after') {
        afterRows.push(...(audit.items || []));
      }
    });

    if (dmsData.length === 0 && beforeRows.length === 0 && afterRows.length === 0) {
      return null;
    }

    let dmsQtyTotal = 0;
    let physicalQtyTotal = 0;
    let shortTotal = 0;
    let excessTotal = 0;
    let shortageValueTotal = 0;
    let excessValueTotal = 0;
    let totalNdpValueTotal = 0;
    let totalMrpValueTotal = 0;
    let beforeNdpTotal = 0;

    dmsData.forEach((row: any) => {
      const dmsQty = toNumber(row.dmsQty);
      const physicalQty = toNumber(row.physicalQty);
      const ndp = toNumber(row.ndp);
      const mrp = toNumber(row.mrp);
      
      const short = Math.max(0, dmsQty - physicalQty);
      const excess = Math.max(0, physicalQty - dmsQty);

      dmsQtyTotal += dmsQty;
      physicalQtyTotal += physicalQty;
      shortTotal += short;
      excessTotal += excess;
      shortageValueTotal += short * ndp;
      excessValueTotal += excess * ndp;
      totalNdpValueTotal += physicalQty * ndp;
      totalMrpValueTotal += physicalQty * mrp;
      beforeNdpTotal += dmsQty * ndp;
    });

    const dmsUniqueCount = dmsData.length;
    const dmsPartNoSet = new Set(dmsData.map((r: any) => (r.partNo || '').toUpperCase()));

    const physOnlyUniqueSet = new Set(
      afterRows
        .map(r => (r.partNo || '').trim().toUpperCase())
        .filter(p => p && !dmsPartNoSet.has(p))
    );
    const extrasUnique = physOnlyUniqueSet.size;

    const countPartNoAfter = dmsUniqueCount + extrasUnique;
    const noLineItemsDup = beforeRows.length;

    const beforePartNoSet = new Set(
      beforeRows.map(r => (r.partNo || '').trim().toUpperCase()).filter(p => !!p)
    );
    const noLineItemsUnique = beforePartNoSet.size;

    return {
      countPartNoBefore: dmsUniqueCount,
      countPartNoAfter,
      countShortage: dmsData.filter((r: any) => Math.max(0, toNumber(r.dmsQty) - toNumber(r.physicalQty)) > 0).length,
      countExcess: dmsData.filter((r: any) => Math.max(0, toNumber(r.physicalQty) - toNumber(r.dmsQty)) > 0).length,
      totalNdpBefore: beforeNdpTotal,
      totalNdpAfter: totalNdpValueTotal,
      noLineItemsDup,
      noLineItemsUnique,
      valueShortage: shortageValueTotal,
      valueExcess: excessValueTotal,
      extrasUnique,
      totalMrpAfter: totalMrpValueTotal
    };

  } catch (error) {
    console.error('Failed to fetch and compute summary stats:', error);
    return null;
  }
};
