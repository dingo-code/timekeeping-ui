import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { getTerminalClockSnapshot, sendTerminalHeartbeat, TERMINAL_CLOCK_CHANGE_EVENT } from '../services/terminalMonitoring';

const visibleRoles = new Set(['admin', 'kamar_hitung', 'petugas_start', 'petugas_finish', 'flying_finish', 'petugas_tc']);

export default function TerminalClockStatus({ variant = 'header' }) {
  const role = useAuthStore((state) => state.role);
  const token = useAuthStore((state) => state.token);
  const [clock, setClock] = useState(getTerminalClockSnapshot);

  useEffect(() => {
    const update = () => setClock(getTerminalClockSnapshot());
    window.addEventListener(TERMINAL_CLOCK_CHANGE_EVENT, update);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.removeEventListener(TERMINAL_CLOCK_CHANGE_EVENT, update);
      window.clearInterval(timer);
    };
  }, []);

  if (!token || !visibleRoles.has(role)) return null;

  const stale = clock.ageMs > 45000;
  const healthy = clock.state === 'healthy' && !stale;
  const warning = clock.state === 'warning' && !stale;
  const color = healthy ? 'bg-emerald-600' : warning ? 'bg-amber-500' : 'bg-red-600';
  const label = healthy ? 'CLOCK OK' : warning ? 'CLOCK WARNING' : clock.state === 'offline' ? 'OFFLINE CLOCK' : 'CLOCK DISCONNECTED';
  const offset = clock.offsetValid ? `${clock.offsetMs >= 0 ? '+' : ''}${Math.round(clock.offsetMs)} ms` : 'belum sinkron';
  const placement = variant === 'sidebar'
    ? 'mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-left'
    : 'shrink-0 rounded-lg px-3 py-2 text-left';

  return (
    <button
      type="button"
      onClick={sendTerminalHeartbeat}
      title="Klik untuk sinkronisasi ulang dengan jam server"
      className={`${placement} ${color} text-xs font-black text-white shadow-md transition hover:brightness-110 active:scale-[0.98]`}
    >
      <span className="block">{label}</span>
      <span className="block text-[10px] font-semibold text-white/80">{offset} · RTT {Math.round(clock.roundTripMs || 0)} ms</span>
    </button>
  );
}
