export function tcStatusLabel(status) {
  const labels = {
    NOT_SCHEDULED: 'Belum dijadwalkan',
    WAITING: 'Menunggu TC',
    UNSCHEDULED: 'Aktual tanpa target',
    ON_TIME: 'Sesuai waktu',
    EARLY: 'Early',
    LATE: 'Late',
    INVALID: 'Format invalid',
  };
  return labels[status] || status || '-';
}

export function compactTCPenaltyRemark(value, ssOrder) {
  const text = String(value || '').trim();
  if (!text) return '';

  return text
    .split(',')
    .map((part) => compactSingleTCRemark(part.trim(), ssOrder))
    .filter(Boolean)
    .join(', ');
}

function compactSingleTCRemark(value, ssOrder) {
  const normalized = value.toUpperCase();
  const stageCode = Number(ssOrder) > 0 ? `TC${Number(ssOrder)}` : 'TC';

  if (/^TC\d+$/.test(normalized)) return normalized;
  if (
    normalized.startsWith('TC TELAT') ||
    normalized.startsWith('TC CEPAT') ||
    normalized.startsWith('TC TERLAMBAT') ||
    normalized.startsWith('TC JOIN CAR')
  ) {
    return stageCode;
  }

  return value;
}
