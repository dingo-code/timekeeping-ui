export function normalizeTimeDecimalPlaces(value) {
  const places = Number(value);
  if (!Number.isInteger(places) || places < 1 || places > 3) return 2;
  return places;
}

export function formatMs(ms, decimalPlaces = 2) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '-';

  const places = normalizeTimeDecimalPlaces(decimalPlaces);
  const unitsPerSecond = 10 ** places;
  const msPerUnit = 1000 / unitsPerSecond;
  const totalUnits = Math.round(value / msPerUnit);
  const fraction = (totalUnits % unitsPerSecond).toString().padStart(places, '0');
  const totalSeconds = Math.floor(totalUnits / unitsPerSecond);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60);

  return hours > 0 ? `${hours}:${minutes}:${seconds},${fraction}` : `${minutes}:${seconds},${fraction}`;
}

export function formatClockCentiseconds(value, decimalPlaces = 2) {
  if (!value || typeof value !== 'string') return value || '-';
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?/);
  if (!match) return value;

  const [, hours, minutes, seconds, fraction = ''] = match;
  const milliseconds = Number((fraction || '0').padEnd(3, '0').slice(0, 3));
  const places = normalizeTimeDecimalPlaces(decimalPlaces);
  const unitsPerSecond = 10 ** places;
  const msPerUnit = 1000 / unitsPerSecond;
  let roundedFraction = Math.round(milliseconds / msPerUnit);
  let nextSeconds = Number(seconds);
  let nextMinutes = Number(minutes);
  let nextHours = Number(hours);

  if (roundedFraction >= unitsPerSecond) {
    roundedFraction = 0;
    nextSeconds += 1;
  }
  if (nextSeconds >= 60) {
    nextSeconds = 0;
    nextMinutes += 1;
  }
  if (nextMinutes >= 60) {
    nextMinutes = 0;
    nextHours = (nextHours + 1) % 24;
  }

  return `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}:${nextSeconds.toString().padStart(2, '0')}.${roundedFraction.toString().padStart(places, '0')}`;
}
