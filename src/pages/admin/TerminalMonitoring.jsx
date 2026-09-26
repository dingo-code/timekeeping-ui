import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const CLOCK_WARNING_MS = 1000;
const RTT_WARNING_MS = 1200;

export default function TerminalMonitoring() {
  const [events, setEvents] = useState([]);
  const [terminals, setTerminals] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    api.get('/admin/events')
      .then((response) => { if (active) setEvents(response.data.data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function refresh(silent = false) {
      if (!silent) setLoading(true);
      try {
        const params = selectedEvent === 'all' ? {} : { event_id: selectedEvent };
        const response = await api.get('/admin/terminals', { params });
        if (!active) return;
        setTerminals(response.data.data || []);
        setLastRefresh(new Date());
        setError('');
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.error || 'Gagal memuat status terminal.');
      } finally {
        if (active && !silent) setLoading(false);
      }
    }
    refresh();
    const refreshTimer = window.setInterval(() => refresh(true), 5000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [selectedEvent]);

  const annotated = useMemo(() => terminals.map((terminal) => {
    const ageMs = Math.max(0, now - new Date(terminal.last_seen).getTime());
    const presence = ageMs <= 30000 ? 'online' : ageMs <= 90000 ? 'stale' : 'offline';
    const offsetMs = terminal.clock_offset_valid ? terminal.clock_offset_ms : terminal.raw_clock_delta_ms;
    const hasProblem = presence !== 'online'
      || Math.abs(offsetMs) >= CLOCK_WARNING_MS
      || Number(terminal.round_trip_ms) >= RTT_WARNING_MS
      || terminal.queue_pending > 0
      || terminal.queue_failed > 0;
    return { ...terminal, ageMs, presence, offsetMs, hasProblem };
  }), [terminals, now]);

  const filtered = useMemo(() => annotated.filter((terminal) => {
    if (statusFilter === 'problem' && !terminal.hasProblem) return false;
    if (statusFilter !== 'all' && statusFilter !== 'problem' && terminal.presence !== statusFilter) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [terminal.username, terminal.role, terminal.terminal_name, terminal.session_name, terminal.event_name, terminal.ip_address]
      .some((value) => String(value || '').toLowerCase().includes(needle));
  }), [annotated, search, statusFilter]);

  const stats = {
    total: annotated.length,
    online: annotated.filter((item) => item.presence === 'online').length,
    warning: annotated.filter((item) => item.hasProblem && item.presence === 'online').length,
    offline: annotated.filter((item) => item.presence !== 'online').length,
    queued: annotated.reduce((sum, item) => sum + Number(item.queue_pending || 0) + Number(item.queue_failed || 0), 0),
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-400">Race Control Health</p>
            <h1 className="mt-2 text-2xl font-black uppercase">Clock / Terminal Monitoring</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Heartbeat setiap 15 detik. Clock offset dihitung dengan midpoint request agar waktu capture tetap mengikuti server.</p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div className="font-bold text-emerald-400">AUTO REFRESH 5 DETIK</div>
            <div>{lastRefresh ? `Terakhir ${lastRefresh.toLocaleTimeString('id-ID', { hour12: false })}` : 'Menunggu data…'}</div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Terminal" value={stats.total} tone="slate" />
        <StatCard label="Online" value={stats.online} tone="green" />
        <StatCard label="Warning" value={stats.warning} tone="amber" />
        <StatCard label="Stale / Offline" value={stats.offline} tone="red" />
        <StatCard label="Queue Bermasalah" value={stats.queued} tone="blue" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Event</span>
            <select value={selectedEvent} onChange={(event) => setSelectedEvent(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-red-500">
              <option value="all">Semua Event</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold outline-none focus:border-red-500">
              <option value="all">Semua Status</option>
              <option value="problem">Hanya Bermasalah</option>
              <option value="online">Online</option>
              <option value="stale">Stale</option>
              <option value="offline">Offline</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Cari</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="User, role, sesi, IP…" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-red-500" />
          </label>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-sm">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-slate-300">
              <tr>
                <th className="p-3 text-left">Terminal / User</th>
                <th className="p-3 text-left">Event / Sesi</th>
                <th className="p-3 text-center">Presence</th>
                <th className="p-3 text-center">Clock Offset</th>
                <th className="p-3 text-center">Latency</th>
                <th className="p-3 text-center">Offline Queue</th>
                <th className="p-3 text-center">Battery / Network</th>
                <th className="p-3 text-left">Device</th>
                <th className="p-3 text-right">Last Seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="9" className="p-16 text-center text-slate-400">Memuat heartbeat terminal…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="9" className="p-16 text-center text-slate-400">Belum ada terminal yang cocok dengan filter.</td></tr>
              ) : filtered.map((terminal) => <TerminalRow key={terminal.terminal_id} terminal={terminal} />)}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
        <strong>Batas operasional:</strong> clock warning ≥ 1.000 ms, latency warning ≥ 1.200 ms, stale setelah 30 detik, dan offline setelah 90 detik. Offset positif berarti jam perangkat tertinggal dari server; offset negatif berarti jam perangkat lebih cepat.
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return <div className={`rounded-xl border p-4 ${tones[tone]}`}><div className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</div><div className="mt-1 text-3xl font-black">{value}</div></div>;
}

function TerminalRow({ terminal }) {
  const offsetProblem = Math.abs(terminal.offsetMs) >= CLOCK_WARNING_MS;
  const latencyProblem = terminal.round_trip_ms >= RTT_WARNING_MS;
  const queueProblem = terminal.queue_pending > 0 || terminal.queue_failed > 0;
  return (
    <tr className={terminal.hasProblem ? 'bg-amber-50/40' : 'bg-white'}>
      <td className="p-3 align-top">
        <div className="font-black text-slate-900">{terminal.username || '-'}</div>
        <div className="mt-0.5 text-[10px] font-bold uppercase text-red-600">{roleLabel(terminal.role)}</div>
        <div className="mt-1 max-w-64 truncate text-[10px] text-slate-400" title={terminal.terminal_name}>{terminal.terminal_name || terminal.terminal_id}</div>
      </td>
      <td className="p-3 align-top">
        <div className="font-bold text-slate-800">{terminal.event_name || '-'}</div>
        <div className="mt-1 text-xs text-slate-500">{terminal.session_name || terminal.page_path || '-'}</div>
        {terminal.session_type && <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">{terminal.session_type}</span>}
      </td>
      <td className="p-3 text-center align-top"><PresenceBadge presence={terminal.presence} ageMs={terminal.ageMs} visibility={terminal.visibility_state} /></td>
      <td className="p-3 text-center align-top">
        <div className={`font-mono text-base font-black ${offsetProblem ? 'text-red-600' : 'text-emerald-700'}`}>{signedMs(terminal.offsetMs)}</div>
        <div className="text-[9px] font-bold uppercase text-slate-400">{terminal.clock_offset_valid ? 'midpoint' : 'estimasi awal'}</div>
      </td>
      <td className="p-3 text-center align-top"><span className={`font-mono font-black ${latencyProblem ? 'text-red-600' : 'text-slate-700'}`}>{terminal.round_trip_ms} ms</span></td>
      <td className="p-3 text-center align-top">
        <div className={`font-black ${queueProblem ? 'text-red-600' : 'text-emerald-700'}`}>{terminal.queue_pending} pending · {terminal.queue_failed} gagal</div>
      </td>
      <td className="p-3 text-center align-top">
        <div className="font-bold text-slate-700">{terminal.battery_level >= 0 ? `${terminal.battery_level}%${terminal.battery_charging ? ' ⚡' : ''}` : '-'}</div>
        <div className="mt-1 text-[10px] font-black uppercase text-slate-400">{terminal.network_type || '-'}</div>
      </td>
      <td className="p-3 align-top text-xs text-slate-600">
        <div>{browserLabel(terminal.user_agent)}</div>
        <div className="mt-1 text-[10px] text-slate-400">{terminal.screen_size || '-'} · {terminal.timezone || '-'}</div>
        <div className="mt-1 font-mono text-[10px] text-slate-400">{terminal.ip_address || '-'}</div>
      </td>
      <td className="p-3 text-right align-top">
        <div className="font-bold text-slate-700">{ageLabel(terminal.ageMs)}</div>
        <div className="mt-1 text-[10px] text-slate-400">{new Date(terminal.last_seen).toLocaleString('id-ID', { hour12: false })}</div>
      </td>
    </tr>
  );
}

function PresenceBadge({ presence, ageMs, visibility }) {
  const styles = presence === 'online' ? 'bg-emerald-100 text-emerald-700' : presence === 'stale' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${styles}`}>{presence}</span><div className="mt-2 text-[10px] text-slate-400">{ageLabel(ageMs)} · {visibility || '-'}</div></div>;
}

function signedMs(value) { return `${value >= 0 ? '+' : ''}${Math.round(value)} ms`; }
function ageLabel(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds} detik`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam`;
  return `${Math.floor(hours / 24)} hari`;
}
function roleLabel(role) {
  return ({ petugas_start: 'Petugas Start', petugas_finish: 'Petugas Finish', flying_finish: 'Flying Finish', petugas_tc: 'Petugas TC', kamar_hitung: 'Kamar Hitung', admin: 'Admin' })[role] || role || '-';
}
function browserLabel(userAgent) {
  const ua = String(userAgent || '');
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('Chrome/')) return 'Google Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('Firefox/')) return 'Firefox';
  return ua ? 'Browser lainnya' : '-';
}
