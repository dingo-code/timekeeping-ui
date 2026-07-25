import { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_ORIGIN } from '../../services/api';
import { formatClockCentiseconds } from '../../utils/timeFormat';

const reconnectDelayMs = 3000;

export default function InputMonitoring() {
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const stagesRef = useRef([]);
  const selectedStageIdRef = useRef('all');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );

  const visibleRecords = useMemo(() => {
    const activeRecords = records.filter((record) => record.is_active !== false);
    return activeRecords.sort((a, b) => inputTimestamp(b) - inputTimestamp(a));
  }, [records]);

  const latestRecord = visibleRecords[0];
  const startedOnlyCount = visibleRecords.filter((record) => record.start_time && !record.finish_time).length;
  const finishedCount = visibleRecords.filter((record) => record.finish_time).length;

  useEffect(() => {
    fetchEvents();
    return () => closeSocket();
  }, []);

  useEffect(() => {
    selectedStageIdRef.current = selectedStageId;
    if (stages.length > 0) fetchRecords(stages, selectedStageId);
  }, [selectedStageId]);

  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  useEffect(() => {
    closeSocket();
    setStages([]);
    setRecords([]);
    setSelectedStageId('all');

    if (!selectedEventId) {
      setConnectionState('idle');
      return undefined;
    }

    shouldReconnectRef.current = true;
    fetchStages(selectedEventId);
    connectWebsocket(selectedEventId);

    return () => closeSocket();
  }, [selectedEventId]);

  const fetchEvents = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/public/events');
      const nextEvents = res.data.data || [];
      setEvents(nextEvents);
      setSelectedEventId(nextEvents[0]?.id || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat daftar event.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStages = async (eventId) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(`/public/events/${eventId}/stages`);
      const nextStages = res.data.data || [];
      setStages(nextStages);
      stagesRef.current = nextStages;
      await fetchRecords(nextStages, selectedStageIdRef.current);
    } catch (err) {
      setStages([]);
      setRecords([]);
      setError(err.response?.data?.error || 'Gagal memuat daftar SS.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecords = async (stageList = stagesRef.current, stageId = selectedStageIdRef.current) => {
    if (!stageList.length) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const targets = stageId === 'all' ? stageList : stageList.filter((stage) => stage.id === stageId);
      const responses = await Promise.all(
        targets.map((stage) => api.get(`/public/stages/${stage.id}/records`).then((res) => ({
          stage,
          records: res.data.data || [],
        })))
      );

      const merged = responses.flatMap(({ stage, records: stageRecords }) => (
        stageRecords.map((record) => ({
          ...record,
          ss_name: stage.ss_name,
          ss_order: stage.ss_order,
          is_shakedown: Boolean(stage.is_shakedown || record.is_shakedown),
        }))
      ));
      setRecords(merged);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat monitoring input.');
    } finally {
      setIsLoading(false);
    }
  };

  const connectWebsocket = (eventId) => {
    setConnectionState('connecting');
    const socket = new WebSocket(`${websocketOrigin()}/ws/leaderboard/${eventId}`);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionState('connected');
      fetchRecords(stagesRef.current, selectedStageIdRef.current);
    };

    socket.onmessage = () => {
      fetchRecords(stagesRef.current, selectedStageIdRef.current);
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

  const closeSocket = () => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      socket.close();
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] rounded-lg bg-neutral-950 p-4 text-white shadow-xl">
      <header className="mb-4 rounded-lg border border-white/10 bg-neutral-900 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">Live Field Input</p>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-wide">Monitoring Input Lapangan</h1>
            <p className="mt-1 text-sm font-semibold text-gray-400">{selectedEvent?.name || '-'}</p>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(220px,320px)_minmax(190px,260px)_auto_auto] md:items-end">
            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Event</span>
              <select
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                className="h-11 w-full rounded border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-red-500"
              >
                {events.length === 0 ? (
                  <option value="">Belum ada event</option>
                ) : (
                  events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)
                )}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">SS</span>
              <select
                value={selectedStageId}
                onChange={(event) => setSelectedStageId(event.target.value)}
                className="h-11 w-full rounded border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none focus:border-red-500"
              >
                <option value="all">Semua SS</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stageLabel(stage)}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => fetchRecords(stagesRef.current, selectedStageIdRef.current)}
              className="h-11 rounded bg-red-600 px-4 text-sm font-black uppercase tracking-widest text-white hover:bg-red-700"
            >
              Refresh
            </button>

            <ConnectionBadge state={connectionState} />
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/60 p-4 text-sm font-bold text-red-100">
          {error}
        </div>
      )}

      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <Summary label="Total Input" value={visibleRecords.length} />
        <Summary label="Start Only" value={startedOnlyCount} />
        <Summary label="Finish" value={finishedCount} />
        <Summary label="Input Terbaru" value={latestRecord ? `${latestRecord.start_number} - ${inputKind(latestRecord)}` : '-'} />
      </section>

      <main className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Feed Input</h2>
          {isLoading && <span className="text-xs font-black uppercase text-red-300">Memuat...</span>}
        </div>

        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-black text-left text-[11px] uppercase tracking-widest text-gray-500">
                <th className="p-3">Input</th>
                <th className="p-3">SS</th>
                <th className="p-3 text-center">No</th>
                <th className="p-3">Driver / Co-driver</th>
                <th className="p-3">Entrant</th>
                <th className="p-3 text-center">TC</th>
                <th className="p-3 text-center">Start</th>
                <th className="p-3 text-center">Finish</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-10 text-center text-sm font-bold text-gray-500">
                    Belum ada input pada pilihan ini.
                  </td>
                </tr>
              ) : (
                visibleRecords.map((record) => (
                  <tr key={record.id} className={`border-t border-white/10 ${rowClass(record)}`}>
                    <td className="p-3">
                      <div className="font-black text-white">{inputKind(record)}</div>
                      <div className="mt-0.5 font-mono text-xs font-bold text-gray-400">{inputTimeLabel(record)}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-black text-white">{stageShortLabel(record)}</div>
                      <div className="mt-0.5 text-xs font-bold text-gray-500">{record.ss_name || '-'}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex min-w-12 justify-center rounded bg-black px-3 py-1 font-black text-white">{record.start_number}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-black text-white">{runDriverName(record)}</div>
                      <div className="mt-0.5 text-xs font-bold text-gray-300">{record.codriver_name || '-'}</div>
                    </td>
                    <td className="p-3 text-xs font-bold uppercase tracking-wider text-gray-400">{record.team_name || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockSeconds(record.tc_time)}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockSeconds(record.start_time)}</td>
                    <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockCentiseconds(record.finish_time)}</td>
                    <td className="p-3 text-right font-mono text-base font-black text-yellow-300">{formatMs(record.total_time_ms)}</td>
                    <td className="p-3"><StatusPill status={displayStatus(record)} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 xl:hidden">
          {visibleRecords.length === 0 ? (
            <div className="rounded-lg bg-black p-6 text-center text-sm font-bold text-gray-500">
              Belum ada input pada pilihan ini.
            </div>
          ) : (
            visibleRecords.map((record) => <RecordCard key={record.id} record={record} />)
          )}
        </div>
      </main>
    </div>
  );
}

function RecordCard({ record }) {
  return (
    <article className={`rounded-lg border border-white/10 p-4 ${rowClass(record) || 'bg-neutral-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-red-300">{inputKind(record)}</div>
          <h2 className="mt-1 break-words text-xl font-black text-white">{runDriverName(record)}</h2>
          <p className="text-xs font-bold text-gray-300">{record.codriver_name || '-'}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{record.team_name || '-'}</p>
        </div>
        <div className="rounded bg-black px-3 py-2 text-center">
          <div className="text-[9px] font-black uppercase text-gray-500">No</div>
          <div className="text-2xl font-black text-white">{record.start_number}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-300">
        <MiniMetric label="SS" value={`${stageShortLabel(record)} ${record.ss_name || ''}`.trim()} />
        <MiniMetric label="Waktu Input" value={inputTimeLabel(record)} />
        <MiniMetric label="TC" value={formatClockSeconds(record.tc_time)} />
        <MiniMetric label="Start" value={formatClockSeconds(record.start_time)} />
        <MiniMetric label="Finish" value={formatClockCentiseconds(record.finish_time)} />
        <MiniMetric label="Total" value={formatMs(record.total_time_ms)} highlight />
      </div>
      <div className="mt-3">
        <StatusPill status={displayStatus(record)} />
      </div>
    </article>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
    </div>
  );
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
    <div className="flex h-11 items-center justify-center gap-2 rounded border border-white/10 bg-black px-4">
      <span className={`h-2.5 w-2.5 rounded-full ${config[0]}`} />
      <span className="text-xs font-black uppercase tracking-widest text-white">{config[1]}</span>
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusClass(status)}`}>
      {status}
    </span>
  );
}

function stageLabel(stage) {
  return stage?.is_shakedown ? `Shakedown : ${stage.ss_name}` : `SS ${stage.ss_order} : ${stage.ss_name}`;
}

function stageShortLabel(record) {
  if (record.is_shakedown) return `SHD ${record.attempt_no || 1}`;
  return `SS ${record.ss_order || '-'}`;
}

function runDriverName(record) {
  if (record.is_shakedown && record.attempt_no) return `${record.driver_name} (Run ${record.attempt_no})`;
  return record.driver_name || '-';
}

function inputKind(record) {
  if (record.status && record.status !== 'OK') return record.status;
  if (record.finish_time) return 'FINISH';
  if (record.start_time) return 'START';
  if (record.tc_time) return 'TC';
  if (record.target_tc_time) return 'TARGET TC';
  return 'INPUT';
}

function displayStatus(record) {
  if (record.status && record.status !== 'OK') return record.status;
  if (record.finish_time) return 'FINISH';
  if (record.start_time) return 'STARTED';
  if (record.tc_time) return 'TC';
  return record.status || 'OK';
}

function inputTimeLabel(record) {
  if (inputKind(record) === 'TARGET TC' && record.target_tc_time) {
    return formatDateWithClock(record.created_at || record.updated_at, record.target_tc_time);
  }
  return formatDateTime(record.updated_at || record.created_at);
}

function inputTimestamp(record) {
  const candidates = [
    record.updated_at,
    record.created_at,
    record.finish_time,
    record.start_time,
    record.tc_time,
    record.target_tc_time,
  ];
  for (const value of candidates) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
    const clockValue = parseClock(value);
    if (clockValue > 0) return clockValue;
  }
  return 0;
}

function parseClock(value) {
  if (!value || typeof value !== 'string') return 0;
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (!match) return 0;
  const [, hh, mm, ss, ms = '0'] = match;
  return (
    Number(hh) * 60 * 60 * 1000 +
    Number(mm) * 60 * 1000 +
    Number(ss) * 1000 +
    Number(ms.padEnd(3, '0'))
  );
}

function formatClockSeconds(value) {
  if (!value || typeof value !== 'string') return '-';
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return value;
  return `${match[1]}:${match[2]}:${match[3]}`;
}

function formatClockDots(value) {
  const clock = formatClockSeconds(value);
  return clock === '-' ? '-' : clock.replaceAll(':', '.');
}

function rowClass(record) {
  const status = displayStatus(record);
  if (status === 'STARTED') return 'bg-blue-950/50';
  if (status === 'TC' || status === 'TARGET TC') return 'bg-cyan-950/50';
  if (status === 'FINISH') return 'bg-green-950/40';
  if (status === 'DNF') return 'bg-orange-950/60';
  if (status === 'DNS') return 'bg-yellow-950/60';
  if (status === 'DSQ') return 'bg-red-950/60';
  return '';
}

function statusClass(status) {
  if (status === 'STARTED') return 'bg-blue-200 text-blue-950';
  if (status === 'FINISH') return 'bg-green-200 text-green-950';
  if (status === 'TC' || status === 'TARGET TC') return 'bg-cyan-200 text-cyan-950';
  if (status === 'DNF') return 'bg-orange-200 text-orange-950';
  if (status === 'DNS') return 'bg-yellow-200 text-yellow-950';
  if (status === 'DSQ') return 'bg-red-200 text-red-950';
  return 'bg-gray-200 text-gray-950';
}

function formatMs(ms) {
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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatDateWithClock(dateValue, clockValue) {
  const clock = formatClockDots(clockValue);
  if (!dateValue) return clock;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return clock;

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}, ${clock}`;
}

function websocketOrigin() {
  const url = new URL(API_ORIGIN);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.origin;
}
