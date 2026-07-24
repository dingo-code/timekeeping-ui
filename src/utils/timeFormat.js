export function formatMs(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '-';

  const totalCentiseconds = Math.round(value / 10);
  const centiseconds = (totalCentiseconds % 100).toString().padStart(2, '0');
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60);

  return hours > 0 ? `${hours}:${minutes}:${seconds},${centiseconds}` : `${minutes}:${seconds},${centiseconds}`;
}

export function formatClockCentiseconds(value) {
  if (!value || typeof value !== 'string') return value || '-';
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})(?:[.,](\d+))?/);
  if (!match) return value;

  const [, hours, minutes, seconds, fraction = ''] = match;
  const milliseconds = Number((fraction || '0').padEnd(3, '0').slice(0, 3));
  let centiseconds = Math.round(milliseconds / 10);
  let nextSeconds = Number(seconds);
  let nextMinutes = Number(minutes);
  let nextHours = Number(hours);

  if (centiseconds >= 100) {
    centiseconds = 0;
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

  return `${nextHours.toString().padStart(2, '0')}:${nextMinutes.toString().padStart(2, '0')}:${nextSeconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}
