export function resultStatusWeight(status) {
  if (status === 'OK' || status === 'BWTM') return 0;
  if (status === 'INCOMPLETE' || !status) return 1;
  if (status === 'DNF') return 2;
  if (status === 'DNS') return 3;
  if (status === 'NOT_FINISHER') return 4;
  if (status === 'WITHDRAW') return 5;
  if (status === 'DSQ') return 6;
  return 7;
}

// Status takes precedence over time; a timed DNS must still follow an untimed DNF.
export function resultSortWeight(status, hasResult) {
  const weight = resultStatusWeight(status);
  return !hasResult && weight === 0 ? 1 : weight;
}

export function formatResultDiff(value, formatMs) {
  const diff = Number(value || 0);
  if (!Number.isFinite(diff) || diff === 0) return '-';
  return `${diff < 0 ? '-' : '+'}${formatMs(Math.abs(diff))}`;
}
