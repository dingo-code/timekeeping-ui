const RAW_SS_INPUT_PROFILE = {
  id: 'raw-ss-input',
  label: 'INPUT SS (CAR NO / TC / START / FINISH)',
};

const LEGACY_SS_PROFILE = {
  id: 'legacy-ss',
  label: 'Spreadsheet SS Legacy',
};

export function detectSSSpreadsheetProfile(matrix) {
  const hasRawInputHeader = matrix.slice(0, 8).some((row) => (
    normalizedHeader(row?.[0]).includes('CAR NO')
    && normalizedHeader(row?.[2]).startsWith('TC')
    && normalizedHeader(row?.[5]).includes('START')
    && normalizedHeader(row?.[8]).includes('FINISH')
  ));
  return hasRawInputHeader ? RAW_SS_INPUT_PROFILE : LEGACY_SS_PROFILE;
}

export function parseSSSpreadsheet(matrix, { isShakedown = false } = {}) {
  const profile = detectSSSpreadsheetProfile(matrix);
  if (profile.id === RAW_SS_INPUT_PROFILE.id) {
    if (isShakedown) {
      throw new Error('Format Excel INPUT ini khusus Special Stage non-shakedown. Untuk Shakedown gunakan file/result Shakedown.');
    }
    return { profile, rows: parseRawSSInput(matrix) };
  }
  return { profile, rows: parseLegacySS(matrix) };
}

function parseRawSSInput(matrix) {
  return matrix.flatMap((row, index) => {
    const number = positiveNumber(row?.[0]);
    if (!number) return [];

    const tc = buildHourMinute(row, [2, 3]);
    const start = buildHourMinute(row, [5, 6]);
    const finish = buildFinish(row, [8, 9, 10, 11]);
    const status = normalizeSourceStatus([row?.[12], row?.[13]].filter(Boolean).join(' '));
    if (!tc && !start && !finish && !status) return [];

    return [{
      key: String(number),
      number,
      runNo: 1,
      sourceRow: index + 1,
      tc,
      start,
      finish,
      elapsedMs: elapsed(start, finish),
      status,
      readable: true,
      sourceKind: 'spreadsheet',
      available: {
        tc: Boolean(tc),
        start: Boolean(start),
        finish: Boolean(finish),
        elapsed: Boolean(start && finish),
        penalty: false,
        total: false,
        status: Boolean(status),
      },
    }];
  });
}

function parseLegacySS(matrix) {
  return matrix.flatMap((row, index) => {
    const number = positiveNumber(row?.[2]);
    if (!number) return [];
    const start = buildHourMinute(row, [4, 5]);
    const finish = buildFinish(row, [7, 8, 9, 10]);
    if (!start && !finish) return [];
    return [{
      key: String(number),
      number,
      runNo: 1,
      sourceRow: index + 1,
      start,
      finish,
      elapsedMs: elapsed(start, finish),
      readable: true,
      sourceKind: 'spreadsheet',
      available: {
        tc: false,
        start: Boolean(start),
        finish: Boolean(finish),
        elapsed: Boolean(start && finish),
        penalty: false,
        total: false,
        status: false,
      },
    }];
  });
}

function normalizeSourceStatus(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.includes('BWTM')) return 'BWTM';
  if (normalized.includes('DSQ')) return 'DSQ';
  if (normalized.includes('DNS')) return 'DNS';
  if (normalized.includes('DNF') || normalized === 'X') return 'DNF';
  return '';
}

function buildHourMinute(row, [hour, minute]) {
  if (blank(row?.[hour]) && blank(row?.[minute])) return '';
  if (!validPart(row?.[hour], 23) || !validPart(row?.[minute], 59)) return '';
  return `${pad(row[hour])}:${pad(row[minute])}:00.000`;
}

function buildFinish(row, [hour, minute, second, fraction]) {
  if ([hour, minute, second, fraction].every((column) => blank(row?.[column]))) return '';
  if (!validPart(row?.[hour], 23) || !validPart(row?.[minute], 59) || !validPart(row?.[second], 59)) return '';
  return `${pad(row[hour])}:${pad(row[minute])}:${pad(row[second])}.${fractionDigits(row?.[fraction])}`;
}

function elapsed(start, finish) {
  if (!start || !finish) return null;
  let value = clockMs(finish) - clockMs(start);
  if (value < 0) value += 86400000;
  return value;
}

function clockMs(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?/);
  if (!match) return NaN;
  return Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + Number((match[4] || '').padEnd(3, '0'));
}

function normalizedHeader(value) { return String(value || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function positiveNumber(value) { const number = Number(String(value ?? '').trim()); return Number.isFinite(number) && number > 0 ? number : null; }
function validPart(value, max) { const number = Number(value); return !blank(value) && Number.isInteger(number) && number >= 0 && number <= max; }
function blank(value) { return value === '' || value == null; }
function pad(value) { return String(Number(value)).padStart(2, '0'); }
function fractionDigits(value) { const digits = String(value ?? '').replace(/\D/g, '').slice(0, 3); return digits.padEnd(3, '0'); }
