import { buildOverallEntries } from './overallResults.js';

export function buildFinalBackupWebRows(report, stageOrders) {
  const entries = (report?.groups || []).flatMap((group) => group.entries || []);
  return buildOverallEntries(entries, { id: 'final' }).map((entry) => ({
    key: String(entry.start_number), number: entry.start_number, runNo: 1,
    position: Number.isFinite(Number(entry.rank)) ? Number(entry.rank) : null,
    driver: entry.driver_name || '-', className: entry.class_name || '', groupName: entry.group_name || '',
    stageTimesMs: Object.fromEntries(stageOrders.map((order) => {
      const stage = (entry.stage_times || []).find((item) => !item.is_shakedown && Number(item.ss_order) === Number(order));
      const elapsed = Number(stage?.elapsed_time_ms);
      return [order, elapsed > 0 ? elapsed : null];
    })),
    elapsedMs: null, penaltyMs: entry.penalty_time_ms,
    totalTimeMs: entry.total_time_ms, status: entry.status,
    diffPrevMs: entry.gap_ms, diffFirstMs: entry.diff_first_ms,
  }));
}

export function backupDurationDifference(source, web, decimalPlaces = null) {
  if (source == null || web == null || !Number.isFinite(Number(source)) || !Number.isFinite(Number(web))) return null;
  if (!Number.isInteger(decimalPlaces)) return Number(source) - Number(web);
  const unit = 1000 / (10 ** decimalPlaces);
  return (Math.round(Number(source) / unit) - Math.round(Number(web) / unit)) * unit;
}
