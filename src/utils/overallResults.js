import { resultSortWeight } from './resultOrder.js';

const FINAL_STAGE_ID = 'final';

export function buildOverallEntries(entries, selectedStage) {
  if (!selectedStage) return [];

  const isFinal = selectedStage.id === FINAL_STAGE_ID;
  const stageLimit = isFinal ? Infinity : Number(selectedStage.ss_order);
  const numericMs = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };
  const hasCompleteTime = (stageTime) => Boolean(stageTime?.start_time) && Boolean(stageTime?.finish_time);
  const isCompletedStage = (stageTime) => {
    const totalTimeMs = numericMs(stageTime?.total_time_ms);
    if (totalTimeMs <= 0) return false;
    if (['BWTM', 'DNF', 'DNS'].includes(stageTime?.status)) return true;
    return stageTime?.status === 'OK' && (hasCompleteTime(stageTime) || stageTime.is_given_time);
  };
  const terminalStatus = (stageTimes) => (
    stageTimes.find((stageTime) => ['DNF', 'DNS', 'DSQ'].includes(stageTime.status))?.status || ''
  );
  const ss1Time = (stageTimes) => {
    const stageTime = stageTimes.find((item) => (
      Number(item.ss_order) === 1 && !item.is_shakedown && item.status !== 'DNS' && numericMs(item.total_time_ms) > 0
    ));
    return stageTime ? numericMs(stageTime.total_time_ms) : null;
  };
  const isRankableOverall = (entry) => (
    numericMs(entry.total_time_ms) > 0 && ['OK', 'BWTM', 'DNF', 'DNS'].includes(entry.status)
  );
  const finalStageOrder = isFinal
    ? Math.max(0, ...entries.flatMap((entry) => (
      entry.stage_times || []
    )).map((stageTime) => numericMs(stageTime.ss_order)))
    : 0;

  const rows = entries
    .filter((entry) => !isFinal || entry.parc_ferme_confirmed === true)
    .map((entry) => {
      const stageTimes = entry.stage_times || [];
      const selectedStageTime = isFinal
        ? null
        : stageTimes.find((stageTime) => (
          stageTime.ss_id === selectedStage.id || Number(stageTime.ss_order) === stageLimit
        ));
      const upToSelectedStage = stageTimes.filter((stageTime) => Number(stageTime.ss_order) <= stageLimit);
      const completedTimes = upToSelectedStage.filter(isCompletedStage);
      const stageStatus = terminalStatus(upToSelectedStage);
      const hasSelectedResult = isFinal ? completedTimes.length > 0 : isCompletedStage(selectedStageTime);
      const finalStageTime = isFinal
        ? stageTimes.find((stageTime) => numericMs(stageTime.ss_order) === finalStageOrder)
        : null;
      const tieBreakStageTime = isFinal
        ? completedTimes.reduce((latest, stageTime) => {
          if (!stageTime.start_time) return latest;
          return !latest || numericMs(stageTime.ss_order) > numericMs(latest.ss_order) ? stageTime : latest;
        }, null)
        : selectedStageTime;
      const ss1TieBreakTimeMs = isFinal ? ss1Time(stageTimes) : null;
      const resolvedFinalStatus = entry.parc_ferme_closed
        ? (entry.parc_ferme_confirmed ? 'OK' : 'NOT_FINISHER')
        : finalStageTime?.status === 'DNS'
          ? 'NOT_FINISHER'
          : finalStageTime?.status === 'DNF'
            ? numericMs(finalStageTime.total_time_ms) > 0 ? 'DNF' : 'NOT_FINISHER'
            : entry.status;
      const status = isFinal
        ? (resolvedFinalStatus || stageStatus || 'OK')
        : hasSelectedResult
          ? (stageStatus || 'OK')
          : stageStatus === 'DSQ' ? 'DSQ' : 'INCOMPLETE';
      const hasTerminalStatus = ['DNF', 'DNS', 'DSQ', 'NOT_FINISHER', 'WITHDRAW'].includes(status);

      if (!hasSelectedResult && !hasTerminalStatus) return null;

      return {
        ...entry,
        rank: 0,
        completed_count: completedTimes.length,
        penalty_time_ms: completedTimes.reduce((total, stageTime) => total + numericMs(stageTime.penalty_time_ms), 0),
        total_time_ms: completedTimes.reduce((total, stageTime) => total + numericMs(stageTime.total_time_ms), 0),
        status,
        tie_break_start_time: tieBreakStageTime?.start_time || '',
        tie_break_ss1_time_ms: ss1TieBreakTimeMs,
        gap_ms: 0,
        diff_ms: 0,
        diff_first_ms: 0,
      };
    })
    .filter(Boolean);

  rows.sort((a, b) => {
    const aRankable = isRankableOverall(a);
    const bRankable = isRankableOverall(b);
    const statusDelta = resultSortWeight(a.status, aRankable) - resultSortWeight(b.status, bRankable);
    if (statusDelta !== 0) return statusDelta;
    if (aRankable !== bRankable) return aRankable ? -1 : 1;
    if (aRankable && a.total_time_ms !== b.total_time_ms) return a.total_time_ms - b.total_time_ms;
    if (aRankable && bRankable) {
      if (isFinal) {
        const aHasSS1 = a.tie_break_ss1_time_ms !== null;
        const bHasSS1 = b.tie_break_ss1_time_ms !== null;
        if (aHasSS1 !== bHasSS1) return aHasSS1 ? -1 : 1;
        if (aHasSS1 && a.tie_break_ss1_time_ms !== b.tie_break_ss1_time_ms) {
          return a.tie_break_ss1_time_ms - b.tie_break_ss1_time_ms;
        }
      }
      const startTimeDelta = compareStartTimes(a.tie_break_start_time, b.tie_break_start_time);
      if (startTimeDelta !== 0) return startTimeDelta;
    }

    return numericMs(a.start_number) - numericMs(b.start_number);
  });

  const bestTime = rows.find(isRankableOverall)?.total_time_ms || 0;
  let rank = 1;
  let previousTime = 0;
  return rows.map((entry) => {
    if (!isRankableOverall(entry)) return { ...entry, rank: '-', gap_ms: 0, diff_ms: 0, diff_first_ms: 0 };

    const rankedEntry = {
      ...entry,
      rank,
      gap_ms: previousTime ? entry.total_time_ms - previousTime : 0,
      diff_ms: bestTime ? entry.total_time_ms - bestTime : 0,
      diff_first_ms: bestTime ? entry.total_time_ms - bestTime : 0,
    };
    previousTime = entry.total_time_ms;
    rank += 1;
    return rankedEntry;
  });
}

function clockTimeMs(value) {
  const match = String(value || '').match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?/);
  if (!match) return Number.POSITIVE_INFINITY;
  const fraction = String(match[4] || '').padEnd(3, '0').slice(0, 3);
  return ((Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] || 0)) * 1000) + Number(fraction || 0);
}

function compareStartTimes(a, b) {
  const aStart = clockTimeMs(a);
  const bStart = clockTimeMs(b);
  if (aStart === bStart) return 0;
  if (!Number.isFinite(aStart)) return 1;
  if (!Number.isFinite(bStart)) return -1;
  return aStart - bStart;
}
