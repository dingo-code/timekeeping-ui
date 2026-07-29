import { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_ORIGIN, assetUrl } from '../../services/api';
import { formatClockCentiseconds, formatMs } from '../../utils/timeFormat';

const reconnectDelayMs = 3000;

export default function Leaderboard() {
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [entries, setEntries] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const [nowMs, setNowMs] = useState(Date.now());
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const selectedStageIdRef = useRef('');
  const wsRef = useRef(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );
  const timeDecimalPlaces = selectedEvent?.time_decimal_places ?? 2;

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId),
    [stages, selectedStageId]
  );
  const selectedStageLabel = selectedStage?.is_shakedown ? 'Shakedown' : selectedStage ? `SS ${selectedStage.ss_order}` : 'SS';

  useEffect(() => {
    fetchEvents();
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1000);

    return () => {
      window.clearInterval(clockTimer);
      shouldReconnectRef.current = false;
      clearReconnect();
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    clearReconnect();
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      socket.close();
    }
    setEntries([]);
    setStages([]);
    setSelectedStageId('');

    if (!selectedEventId) {
      shouldReconnectRef.current = false;
      setConnectionState('idle');
      return undefined;
    }

    shouldReconnectRef.current = true;
    fetchStages(selectedEventId);
    connectWebsocket(selectedEventId);

    return () => {
      shouldReconnectRef.current = false;
      clearReconnect();
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.close();
      }
    };
  }, [selectedEventId]);

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    setError('');
    try {
      const res = await api.get('/public/events');
      const nextEvents = res.data.data || [];
      setEvents(nextEvents);
      if (nextEvents.length > 0) setSelectedEventId(nextEvents[0].id);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat daftar event.');
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    selectedStageIdRef.current = selectedStageId;
    setEntries([]);
    if (selectedStageId) fetchStageLeaderboard(selectedStageId);
  }, [selectedStageId]);

  const fetchStages = async (eventId) => {
    setIsLoadingStages(true);
    setError('');
    try {
      const res = await api.get(`/public/events/${eventId}/stages`);
      const nextStages = res.data.data || [];
      setStages(nextStages);
      setSelectedStageId(nextStages[0]?.id || '');
    } catch (err) {
      setStages([]);
      setSelectedStageId('');
      setError(err.response?.data?.error || 'Gagal memuat daftar SS.');
    } finally {
      setIsLoadingStages(false);
    }
  };

  const fetchStageLeaderboard = async (stageId) => {
    setIsLoadingEntries(true);
    setError('');
    try {
      const res = await api.get(`/public/stages/${stageId}/records`);
      const stage = stages.find((item) => item.id === stageId);
      setEntries(normalizeStageEntries(res.data.data || [], Boolean(stage?.is_shakedown)));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat leaderboard.');
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const clearReconnect = () => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connectWebsocket = (eventId) => {
    setConnectionState('connecting');
    const socket = new WebSocket(`${websocketOrigin()}/ws/leaderboard/${eventId}`);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionState('connected');
      if (selectedStageIdRef.current) fetchStageLeaderboard(selectedStageIdRef.current);
    };

    socket.onmessage = () => {
      if (selectedStageIdRef.current) fetchStageLeaderboard(selectedStageIdRef.current);
    };

    socket.onerror = () => {
      setConnectionState('disconnected');
    };

    socket.onclose = () => {
      if (!shouldReconnectRef.current || wsRef.current !== socket) return;
      setConnectionState('disconnected');
      reconnectTimerRef.current = window.setTimeout(() => connectWebsocket(eventId), reconnectDelayMs);
    };
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-3 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 rounded-lg border border-white/10 bg-neutral-900 p-4 shadow-2xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {selectedEvent?.logo_url ? (
                <img src={assetUrl(selectedEvent.logo_url)} alt="Logo event" className="h-16 w-24 shrink-0 object-contain sm:h-20 sm:w-28" />
              ) : (
                <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded border border-white/10 bg-black text-[10px] font-black uppercase tracking-widest text-gray-500 sm:h-20 sm:w-28">
                  Logo
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">Live Rally Timing</p>
                <h1 className="mt-1 break-words text-2xl font-black uppercase leading-tight tracking-wide sm:text-4xl">
                  {selectedEvent?.name || 'Leaderboard'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-gray-400 sm:text-sm">
                  <span>{formatEventDate(selectedEvent)}</span>
                  <span>{selectedEvent?.location || '-'}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(220px,320px)_minmax(160px,220px)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Pilih Event</span>
                <select
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  disabled={isLoadingEvents || events.length === 0}
                  className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm font-black text-white outline-none focus:border-red-500 disabled:opacity-50"
                >
                  {events.length === 0 ? (
                    <option value="">Belum ada event</option>
                  ) : (
                    events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)
                  )}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Pilih SS</span>
                <select
                  value={selectedStageId}
                  onChange={(event) => setSelectedStageId(event.target.value)}
                  disabled={isLoadingStages || stages.length === 0}
                  className="w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm font-black text-white outline-none focus:border-red-500 disabled:opacity-50"
                >
                  {stages.length === 0 ? (
                    <option value="">Belum ada SS</option>
                  ) : (
                    stages.map((stage) => <option key={stage.id} value={stage.id}>{stageLabel(stage)}</option>)
                  )}
                </select>
              </label>
              <ConnectionBadge state={connectionState} />
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/60 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Summary label={selectedStageLabel} value={selectedStage?.ss_name || '-'} />
          <Summary label="Peserta Live" value={entries.length} />
          <Summary label="Fastest" value={leaderName(entries[0])} />
        </section>

        <main className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Leaderboard</h2>
              <p className="mt-0.5 text-xs font-semibold text-gray-500">Update otomatis saat data waktu berubah</p>
            </div>
            {(isLoadingStages || isLoadingEntries) && <span className="text-xs font-black uppercase text-red-300">Memuat...</span>}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-black text-left text-[11px] uppercase tracking-widest text-gray-500">
                  <th className="p-4 text-center">Pos</th>
                  <th className="p-4 text-center">No Start</th>
                  <th className="p-4">Entrant</th>
                  <th className="p-4">Driver / Navigator</th>
                  <th className="p-4 text-center">Class</th>
                  <th className="p-4 text-center">Start</th>
                  <th className="p-4 text-center">Finish</th>
                  <th className="p-4 text-right">Penalti</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Diff Prev</th>
                  <th className="p-4 text-right">Diff First</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="p-10 text-center text-sm font-bold text-gray-500">
                      {selectedStageId ? 'Belum ada peserta start, finish, DNF, atau DNS pada SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id || entry.participant_id} className={`border-t border-white/10 ${rowClass(displayStatus(entry))}`}>
                      <td className="p-4 text-center text-2xl font-black">{entry.rank}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex min-w-12 justify-center rounded bg-black px-3 py-1 font-black text-white">{entry.start_number}</span>
                      </td>
                      <td className="p-4 text-xs font-bold uppercase tracking-wider text-gray-400">{entry.team_name || '-'}</td>
                      <td className="p-4">
                        <div className="font-black text-white">{entry.driver_name}</div>
                        <div className="mt-0.5 text-xs font-bold text-gray-300">{entry.codriver_name || '-'}</div>
                      </td>
                      <td className="p-4 text-center text-xs font-black uppercase tracking-wider text-gray-300">{entry.class_name || '-'}</td>
                      <td className="p-4 text-center font-mono font-bold text-gray-300">{entry.start_time || '-'}</td>
                      <td className="p-4 text-center font-mono font-bold text-gray-300">{formatClockCentiseconds(entry.finish_time, timeDecimalPlaces)}</td>
                      <td className="p-4 text-right font-mono font-black text-red-300">{entry.penalty_time_ms > 0 ? `+${formatMs(entry.penalty_time_ms, timeDecimalPlaces)}` : '-'}</td>
                      <td className={`p-4 text-right font-mono text-lg font-black ${entry.is_live_running ? 'text-cyan-300' : 'text-yellow-300'}`}>{formatMs(displayTotalMs(entry, nowMs), timeDecimalPlaces)}</td>
                      <td className="p-4 text-right font-mono font-black text-gray-300">{formatDiffMs(entry.diff_prev_ms, timeDecimalPlaces)}</td>
                      <td className="p-4 text-right font-mono font-black text-gray-300">{formatDiffMs(entry.diff_first_ms, timeDecimalPlaces)}</td>
                      <td className="p-4">
                        <StatusPill status={displayStatus(entry)} />
                        {entry.is_live_running && <div className="mt-1 text-xs font-black uppercase tracking-widest text-cyan-200">Live</div>}
                        {entry.penalty_desc && <div className="mt-1 text-xs font-bold text-yellow-200">{entry.penalty_desc}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 p-3 lg:hidden">
            {entries.length === 0 ? (
              <div className="rounded-lg bg-black p-6 text-center text-sm font-bold text-gray-500">
                {selectedStageId ? 'Belum ada peserta start, finish, DNF, atau DNS pada SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
              </div>
            ) : (
              entries.map((entry) => <LeaderboardCard key={entry.id || entry.participant_id} entry={entry} nowMs={nowMs} timeDecimalPlaces={timeDecimalPlaces} />)
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function stageLabel(stage) {
  return stage?.is_shakedown ? `Shakedown : ${stage.ss_name}` : `SS ${stage.ss_order}`;
}

function normalizeStageEntries(records, isShakedown = false) {
  const numericMs = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };
  const isOkStatus = (record) => !record.status || record.status === 'OK';
  const hasCompleteTime = (record) => Boolean(record.start_time) && Boolean(record.finish_time);
  const hasLiveStart = (record) => isOkStatus(record) && Boolean(record.start_time) && !record.finish_time;
  const hasDisplayStatus = (record) => record.status === 'BWTM' || record.status === 'DNF' || record.status === 'DNS' || record.status === 'DSQ';
  const activeRecords = records.filter((record) => (
    record.is_active !== false &&
    (hasCompleteTime(record) || hasLiveStart(record) || hasDisplayStatus(record))
  ));
  const hasStageResult = (record) => (
    (
      (record.status === 'OK' && hasCompleteTime(record)) ||
      record.status === 'BWTM' ||
      record.status === 'DNF' ||
      record.status === 'DNS'
    ) &&
    numericMs(record.total_time_ms) > 0
  );
  const statusWeight = (record) => {
    if (hasStageResult(record)) return 0;
    if (hasLiveStart(record)) return 1;
    if (record.status === 'OK' || record.status === 'INCOMPLETE' || !record.status) return 2;
    if (record.status === 'BWTM') return 2;
    if (record.status === 'DSQ') return 3;
    if (record.status === 'DNF') return 3;
    if (record.status === 'DNS') return 3;
    return 2;
  };

  activeRecords.sort((a, b) => {
    const aWeight = statusWeight(a);
    const bWeight = statusWeight(b);
    if (aWeight !== bWeight) return aWeight - bWeight;

    const aTotal = numericMs(a.total_time_ms);
    const bTotal = numericMs(b.total_time_ms);
    if (hasStageResult(a) && aTotal !== bTotal) return aTotal - bTotal;
    if (hasLiveStart(a) || hasLiveStart(b)) return numericMs(a.start_number) - numericMs(b.start_number);
    return numericMs(a.start_number) - numericMs(b.start_number);
  });

  let rank = 1;
  const firstTotal = numericMs(activeRecords.find((record) => hasStageResult(record))?.total_time_ms);
  let previousRankedTotal = 0;
  return activeRecords.map((record) => {
    const ranked = hasStageResult(record);
    const total = numericMs(record.total_time_ms);
    const entry = {
      ...record,
      rank: ranked ? rank : '-',
      diff_prev_ms: ranked && previousRankedTotal ? total - previousRankedTotal : 0,
      diff_first_ms: ranked && firstTotal ? total - firstTotal : 0,
      is_live_running: hasLiveStart(record),
      driver_name: isShakedown && record.attempt_no ? `${record.driver_name} (Run ${record.attempt_no})` : record.driver_name,
      penalty_desc: formatPenaltyDetails(record.penalty_details),
    };
    if (ranked) {
      previousRankedTotal = total;
      rank += 1;
    }
    return entry;
  });
}

function formatPenaltyDetails(details) {
  const parsed = typeof details === 'string' ? parsePenaltyDetails(details) : details;
  if (!Array.isArray(parsed) || parsed.length === 0) return '';
  return parsed.map((item) => item.name).filter(Boolean).join(', ');
}

function parsePenaltyDetails(value) {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function LeaderboardCard({ entry, nowMs, timeDecimalPlaces = 2 }) {
  return (
    <article className={`rounded-lg border border-white/10 p-4 ${rowClass(displayStatus(entry)) || 'bg-neutral-800'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Pos #{entry.rank}</div>
          <h2 className="mt-1 break-words text-xl font-black text-white">{entry.driver_name}</h2>
          <p className="text-xs font-bold text-gray-300">{entry.codriver_name || '-'}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{entry.team_name || '-'}</p>
          <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-gray-400">Class {entry.class_name || '-'}</p>
        </div>
        <div className="rounded bg-black px-3 py-2 text-center">
          <div className="text-[9px] font-black uppercase text-gray-500">No</div>
          <div className="text-2xl font-black text-white">{entry.start_number}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-300">
        <MiniMetric label="Start" value={entry.start_time || '-'} />
        <MiniMetric label="Entrant" value={entry.team_name || '-'} />
        <MiniMetric label="Class" value={entry.class_name || '-'} />
        <MiniMetric label="Finish" value={formatClockCentiseconds(entry.finish_time, timeDecimalPlaces)} />
        <MiniMetric label="Penalti" value={entry.penalty_time_ms > 0 ? `+${formatMs(entry.penalty_time_ms, timeDecimalPlaces)}` : '-'} />
        <MiniMetric label="Total" value={formatMs(displayTotalMs(entry, nowMs), timeDecimalPlaces)} highlight />
        <MiniMetric label="Diff Prev" value={formatDiffMs(entry.diff_prev_ms, timeDecimalPlaces)} />
        <MiniMetric label="Diff First" value={formatDiffMs(entry.diff_first_ms, timeDecimalPlaces)} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusPill status={displayStatus(entry)} />
        {entry.penalty_desc && <span className="text-right text-xs font-bold text-yellow-200">{entry.penalty_desc}</span>}
      </div>
    </article>
  );
}

function Summary({ label, value, highlight = false }) {
  return (
    <div className={`rounded-lg border border-white/10 p-4 ${highlight ? 'bg-red-950/70' : 'bg-neutral-900'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function leaderName(entry) {
  if (!entry) return '-';
  return entry.codriver_name ? `${entry.driver_name} / ${entry.codriver_name}` : entry.driver_name;
}

function MiniMetric({ label, value, highlight = false }) {
  return (
    <div className="rounded bg-black/40 p-3">
      <p className="text-[9px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black ${highlight ? 'text-yellow-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ConnectionBadge({ state }) {
  const config = {
    connected: ['bg-green-500', 'LIVE'],
    connecting: ['bg-yellow-400', 'CONNECTING'],
    disconnected: ['bg-red-500', 'RECONNECTING'],
    idle: ['bg-gray-500', 'IDLE'],
  }[state] || ['bg-gray-500', 'IDLE'];

  return (
    <div className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-black px-4">
      <span className={`h-2.5 w-2.5 rounded-full ${config[0]}`} />
      <span className="text-xs font-black uppercase tracking-widest text-white">{config[1]}</span>
    </div>
  );
}

function StatusPill({ status }) {
  const label = status || 'OK';
  return (
    <span className={`inline-flex rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(label)}`}>
      {label}
    </span>
  );
}

function rowClass(status) {
  if (status === 'LIVE') return 'bg-cyan-950/50';
  if (status === 'BWTM') return 'bg-purple-950/60';
  if (status === 'DNF') return 'bg-orange-950/60';
  if (status === 'DNS') return 'bg-yellow-950/60';
  if (status === 'DSQ') return 'bg-red-950/60';
  return '';
}

function statusClass(status) {
  if (status === 'LIVE') return 'bg-cyan-200 text-cyan-950';
  if (status === 'BWTM') return 'bg-purple-200 text-purple-950';
  if (status === 'DNF') return 'bg-orange-200 text-orange-950';
  if (status === 'DNS') return 'bg-yellow-200 text-yellow-950';
  if (status === 'DSQ') return 'bg-red-200 text-red-950';
  return 'bg-green-200 text-green-950';
}

function displayStatus(entry) {
  if (entry?.is_live_running) return 'LIVE';
  return entry?.status || 'OK';
}

function displayTotalMs(entry, nowMs) {
  if (!entry?.is_live_running) return entry?.total_time_ms;
  return liveElapsedMs(entry.start_time, nowMs) + Number(entry.penalty_time_ms || 0);
}

function formatDiffMs(value, timeDecimalPlaces = 2) {
  const diff = Number(value || 0);
  if (!Number.isFinite(diff) || diff <= 0) return '-';
  return `+${formatMs(diff, timeDecimalPlaces)}`;
}

function liveElapsedMs(startTime, nowMs) {
  const startClockMs = parseClockMilliseconds(startTime);
  if (startClockMs <= 0) return 0;
  const now = new Date(nowMs);
  const nowClockMs = (
    now.getHours() * 60 * 60 * 1000 +
    now.getMinutes() * 60 * 1000 +
    now.getSeconds() * 1000 +
    now.getMilliseconds()
  );
  let elapsed = nowClockMs - startClockMs;
  if (elapsed < 0) elapsed += 24 * 60 * 60 * 1000;
  return elapsed;
}

function parseClockMilliseconds(value) {
  if (!value || typeof value !== 'string') return 0;
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/);
  if (!match) return 0;
  const [, hh, mm, ss, fraction = '0'] = match;
  return (
    Number(hh) * 60 * 60 * 1000 +
    Number(mm) * 60 * 1000 +
    Number(ss) * 1000 +
    Number(fraction.padEnd(3, '0'))
  );
}

function formatEventDate(event) {
  if (!event?.start_date) return '-';

  const formatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const start = formatter.format(new Date(event.start_date));
  if (!event.end_date || event.end_date === event.start_date) return start;
  return `${start} - ${formatter.format(new Date(event.end_date))}`;
}

function websocketOrigin() {
  const url = new URL(API_ORIGIN);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}
