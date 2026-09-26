import api from './api';
import { useAuthStore } from '../store/useAuthStore';
import { getOfflineQueueSnapshot } from './offlineQueue';

const TERMINAL_ID_KEY = 'timekeeping_terminal_id_v1';
const CLOCK_STATE_KEY = 'timekeeping_server_clock_v1';
const CHANGE_EVENT = 'timekeeping:terminal-clock-change';
const HEARTBEAT_INTERVAL_MS = 15000;
const CLOCK_WARNING_MS = 1000;
const operationalRoles = new Set(['admin', 'kamar_hitung', 'petugas_start', 'petugas_finish', 'flying_finish', 'petugas_tc']);

let initialized = false;
let sending = false;
let intervalId = null;
let terminalContext = { eventId: '', sessionType: '', sessionId: '', sessionName: '' };
let snapshot = loadClockSnapshot();

function makeTerminalId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
}

function terminalId() {
  let value = localStorage.getItem(TERMINAL_ID_KEY);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) {
    value = makeTerminalId();
    localStorage.setItem(TERMINAL_ID_KEY, value);
  }
  return value;
}

function loadClockSnapshot() {
  try {
    const stored = JSON.parse(localStorage.getItem(CLOCK_STATE_KEY) || '{}');
    if (Number.isFinite(stored.offsetMs) && Date.now() - Number(stored.measuredAt || 0) < 5 * 60 * 1000) {
      return { ...stored, state: 'stale', online: navigator.onLine };
    }
  } catch {
    // Mulai dengan state kosong bila storage rusak.
  }
  return { state: 'idle', online: navigator.onLine, offsetMs: 0, offsetValid: false, roundTripMs: 0, measuredAt: 0, error: '' };
}

function publish(next) {
  snapshot = { ...snapshot, ...next };
  if (snapshot.offsetValid) {
    localStorage.setItem(CLOCK_STATE_KEY, JSON.stringify({
      offsetMs: snapshot.offsetMs,
      offsetValid: true,
      roundTripMs: snapshot.roundTripMs,
      measuredAt: snapshot.measuredAt,
    }));
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: snapshot }));
}

async function batteryState() {
  if (!navigator.getBattery) return { level: -1, charging: false };
  try {
    const battery = await navigator.getBattery();
    return { level: Math.round(battery.level * 100), charging: battery.charging };
  } catch {
    return { level: -1, charging: false };
  }
}

export async function sendTerminalHeartbeat() {
  const auth = useAuthStore.getState();
  if (!auth.token || !operationalRoles.has(auth.role)) return;
  if (sending) return;
  if (!navigator.onLine) {
    publish({ state: 'offline', online: false, error: 'Perangkat offline' });
    return;
  }

  sending = true;
  const startedAt = Date.now();
  try {
    const [battery, queue] = await Promise.all([batteryState(), Promise.resolve(getOfflineQueueSnapshot())]);
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const response = await api.post('/terminals/heartbeat', {
      terminal_id: terminalId(),
      terminal_name: `${navigator.platform || 'Terminal'} · ${window.screen.width}×${window.screen.height}`,
      event_id: terminalContext.eventId || auth.eventId || '',
      session_type: terminalContext.sessionType,
      session_id: terminalContext.sessionId,
      session_name: terminalContext.sessionName,
      page_path: window.location.pathname,
      client_sent_at: new Date(startedAt).toISOString(),
      clock_offset_ms: Math.round(snapshot.offsetMs || 0),
      clock_offset_valid: Boolean(snapshot.offsetValid),
      round_trip_ms: Math.max(0, Math.round(snapshot.roundTripMs || 0)),
      browser_online: navigator.onLine,
      visibility_state: document.visibilityState,
      queue_pending: queue.pending,
      queue_failed: queue.failed,
      battery_level: battery.level,
      battery_charging: battery.charging,
      network_type: connection?.effectiveType || connection?.type || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      screen_size: `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}`,
    }, { timeout: 8000 });

    const endedAt = Date.now();
    const serverTime = new Date(response.data.data.server_time).getTime();
    const roundTripMs = endedAt - startedAt;
    const offsetMs = serverTime - ((startedAt + endedAt) / 2);
    publish({
      state: Math.abs(offsetMs) >= CLOCK_WARNING_MS ? 'warning' : 'healthy',
      online: true,
      offsetMs,
      offsetValid: true,
      roundTripMs,
      measuredAt: endedAt,
      serverTime,
      error: '',
    });
  } catch (error) {
    publish({
      state: navigator.onLine ? 'disconnected' : 'offline',
      online: navigator.onLine,
      error: error.response?.data?.error || 'Heartbeat server gagal',
    });
  } finally {
    sending = false;
  }
}

export function setTerminalContext(nextContext = {}) {
  terminalContext = { ...terminalContext, ...nextContext };
  window.setTimeout(sendTerminalHeartbeat, 0);
}

export function getTerminalClockSnapshot() {
  const ageMs = snapshot.measuredAt ? Date.now() - snapshot.measuredAt : Number.POSITIVE_INFINITY;
  return { ...snapshot, ageMs, warningThresholdMs: CLOCK_WARNING_MS };
}

export function getSynchronizedNow() {
  const current = getTerminalClockSnapshot();
  const usable = current.offsetValid && current.ageMs < 5 * 60 * 1000;
  return new Date(Date.now() + (usable ? current.offsetMs : 0));
}

export function initTerminalMonitoring() {
  if (initialized) return;
  initialized = true;
  const trigger = () => sendTerminalHeartbeat();
  window.addEventListener('online', trigger);
  window.addEventListener('focus', trigger);
  document.addEventListener('visibilitychange', trigger);
  useAuthStore.subscribe((state, previous) => {
    if (state.token && state.token !== previous.token) trigger();
  });
  intervalId = window.setInterval(trigger, HEARTBEAT_INTERVAL_MS);
  window.setTimeout(trigger, 300);
}

export function stopTerminalMonitoring() {
  if (!initialized) return;
  window.clearInterval(intervalId);
  intervalId = null;
  initialized = false;
}

export { CHANGE_EVENT as TERMINAL_CLOCK_CHANGE_EVENT, CLOCK_WARNING_MS };
