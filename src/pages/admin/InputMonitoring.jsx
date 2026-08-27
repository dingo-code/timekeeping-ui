import { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_ORIGIN } from '../../services/api';
import { formatClockCentiseconds, formatMs } from '../../utils/timeFormat';
import UnofficialTimingNotice from '../../components/UnofficialTimingNotice';

const reconnectDelayMs = 3000;

export default function InputMonitoring() {
  const [events, setEvents] = useState([]);
  const [monitorMode, setMonitorMode] = useState('ss');
  const [stages, setStages] = useState([]);
  const [practices, setPractices] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [selectedPracticeId, setSelectedPracticeId] = useState('all');
  const [records, setRecords] = useState([]);
  const [practiceRuns, setPracticeRuns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const stagesRef = useRef([]);
  const selectedStageIdRef = useRef('all');
  const practicesRef = useRef([]);
  const selectedPracticeIdRef = useRef('all');
  const monitorModeRef = useRef('ss');

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );
  const timeDecimalPlaces = selectedEvent?.time_decimal_places ?? 2;

  const visibleRecords = useMemo(() => {
    const activeRecords = records.filter((record) => record.is_active !== false);
    return activeRecords.sort((a, b) => inputTimestamp(b) - inputTimestamp(a));
  }, [records]);

  const visiblePracticeRuns = useMemo(
    () => [...practiceRuns].sort((a, b) => inputTimestamp(b) - inputTimestamp(a)),
    [practiceRuns]
  );

  const filteredRecords = useMemo(
    () => visibleRecords.filter((record) => matchesInputSearch(record, searchQuery, false)),
    [visibleRecords, searchQuery]
  );
  const filteredPracticeRuns = useMemo(
    () => visiblePracticeRuns.filter((run) => matchesInputSearch(run, searchQuery, true)),
    [visiblePracticeRuns, searchQuery]
  );
  const activeFeed = monitorMode === 'practice' ? filteredPracticeRuns : filteredRecords;
  const latestRecord = activeFeed[0];
  const startedOnlyCount = activeFeed.filter((record) => record.start_time && !record.finish_time).length;
  const finishedCount = activeFeed.filter((record) => record.finish_time).length;

  useEffect(() => {
    fetchEvents();
    return () => closeSocket();
  }, []);

  useEffect(() => {
    monitorModeRef.current = monitorMode;
    if (monitorMode === 'practice') fetchPracticeRuns(practicesRef.current, selectedPracticeIdRef.current);
    else fetchRecords(stagesRef.current, selectedStageIdRef.current);
  }, [monitorMode]);

  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  useEffect(() => {
    practicesRef.current = practices;
  }, [practices]);

  useEffect(() => {
    if (monitorMode !== 'practice' || !selectedEventId) return undefined;
    const timer = window.setInterval(() => fetchPracticeRuns(practicesRef.current, selectedPracticeIdRef.current, true), 4000);
    return () => window.clearInterval(timer);
  }, [monitorMode, selectedEventId]);

  useEffect(() => {
    closeSocket();

    if (!selectedEventId) {
      return undefined;
    }

    shouldReconnectRef.current = true;
    fetchEventSessions(selectedEventId);
    connectWebsocket(selectedEventId);

    return () => closeSocket();
    // Fungsi menggunakan refs terbaru; koneksi hanya boleh dibuat ulang ketika event berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  async function fetchEvents() {
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
  }

  async function fetchEventSessions(eventId) {
    setIsLoading(true);
    setError('');
    try {
      const [stageResponse, practiceResponse] = await Promise.all([
        api.get(`/public/events/${eventId}/stages`),
        api.get(`/public/events/${eventId}/practices`),
      ]);
      const nextStages = stageResponse.data.data || [];
      const nextPractices = practiceResponse.data.data || [];
      setStages(nextStages);
      setPractices(nextPractices);
      stagesRef.current = nextStages;
      practicesRef.current = nextPractices;
      if (monitorModeRef.current === 'practice') await fetchPracticeRuns(nextPractices, selectedPracticeIdRef.current);
      else await fetchRecords(nextStages, selectedStageIdRef.current);
    } catch (err) {
      setStages([]);
      setPractices([]);
      setRecords([]);
      setPracticeRuns([]);
      setError(err.response?.data?.error || 'Gagal memuat sesi event.');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchPracticeRuns(practiceList = practicesRef.current, practiceId = selectedPracticeIdRef.current, silent = false) {
    if (!practiceList.length) {
      setPracticeRuns([]);
      return;
    }
    if (!silent) {
      setIsLoading(true);
      setError('');
    }
    try {
      const targets = practiceId === 'all' ? practiceList : practiceList.filter((practice) => practice.id === practiceId);
      const responses = await Promise.all(targets.map((practice) => api.get(`/public/practice-results/${practice.id}`)));
      const merged = responses.flatMap((response, index) => {
        const result = response.data.data || {};
        const practice = result.practice || targets[index];
        return (result.entries || []).flatMap((entry) => (entry.runs || []).map((run) => ({
          ...run,
          practice_name: practice.name,
          practice_date: practice.practice_date,
          max_runs: practice.max_runs,
          race_start_number: run.race_start_number || entry.race_start_number,
          practice_start_number: run.practice_start_number || entry.practice_start_number,
          driver_name: run.driver_name || entry.driver_name,
          codriver_name: run.codriver_name || entry.codriver_name,
        })));
      });
      setPracticeRuns(merged);
    } catch (err) {
      if (!silent) setError(err.response?.data?.error || 'Gagal memuat input Practice.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function fetchRecords(stageList = stagesRef.current, stageId = selectedStageIdRef.current) {
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
  }

  function connectWebsocket(eventId) {
    setConnectionState('connecting');
    const socket = new WebSocket(`${websocketOrigin()}/ws/leaderboard/${eventId}`);
    wsRef.current = socket;

    socket.onopen = () => {
      setConnectionState('connected');
      if (monitorModeRef.current === 'practice') fetchPracticeRuns(practicesRef.current, selectedPracticeIdRef.current, true);
      else fetchRecords(stagesRef.current, selectedStageIdRef.current);
    };

    socket.onmessage = () => {
      if (monitorModeRef.current === 'practice') fetchPracticeRuns(practicesRef.current, selectedPracticeIdRef.current, true);
      else fetchRecords(stagesRef.current, selectedStageIdRef.current);
    };

    socket.onerror = () => {
      setConnectionState('disconnected');
    };

    socket.onclose = () => {
      if (!shouldReconnectRef.current || wsRef.current !== socket) return;
      setConnectionState('disconnected');
      reconnectTimerRef.current = window.setTimeout(() => connectWebsocket(eventId), reconnectDelayMs);
    };
  }

  function closeSocket() {
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
  }

  function changeEvent(nextEventId) {
    setStages([]);
    setPractices([]);
    setRecords([]);
    setPracticeRuns([]);
    setSelectedStageId('all');
    setSelectedPracticeId('all');
    selectedStageIdRef.current = 'all';
    selectedPracticeIdRef.current = 'all';
    setSelectedEventId(nextEventId);
  }

  function changeStage(nextStageId) {
    setSelectedStageId(nextStageId);
    selectedStageIdRef.current = nextStageId;
    fetchRecords(stagesRef.current, nextStageId);
  }

  function changePractice(nextPracticeId) {
    setSelectedPracticeId(nextPracticeId);
    selectedPracticeIdRef.current = nextPracticeId;
    fetchPracticeRuns(practicesRef.current, nextPracticeId);
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1920px] flex-col gap-4 p-4 lg:p-5">
        <header className="rounded-lg border border-white/10 bg-[#151515] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(300px,1fr)_minmax(680px,auto)] lg:items-end lg:p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-red-400">Live Field Input</p>
              <h1 className="mt-2 text-2xl font-black uppercase leading-none tracking-wide sm:text-3xl">Monitoring Input Lapangan</h1>
              <p className="mt-2 text-sm font-semibold text-gray-400">{selectedEvent?.name || '-'}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[160px_minmax(240px,1fr)_minmax(210px,0.82fr)_auto_auto] xl:items-end">
              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Mode</span>
                <select value={monitorMode} onChange={(event) => setMonitorMode(event.target.value)} className="h-11 w-full rounded border border-red-500/60 bg-black px-3 text-sm font-bold text-white outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20">
                  <option value="ss">Special Stage</option>
                  <option value="practice">Practice</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Event</span>
                <select
                  value={selectedEventId}
                  onChange={(event) => changeEvent(event.target.value)}
                  className="h-11 w-full rounded border border-red-500/60 bg-black px-3 text-sm font-bold text-white outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                >
                  {events.length === 0 ? (
                    <option value="">Belum ada event</option>
                  ) : (
                    events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)
                  )}
                </select>
              </label>

              <label>
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">{monitorMode === 'practice' ? 'Practice' : 'SS'}</span>
                {monitorMode === 'practice' ? (
                  <select value={selectedPracticeId} onChange={(event) => changePractice(event.target.value)} className="h-11 w-full rounded border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20">
                    <option value="all">Semua Practice</option>
                    {practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.name}</option>)}
                  </select>
                ) : (
                <select
                  value={selectedStageId}
                  onChange={(event) => changeStage(event.target.value)}
                  className="h-11 w-full rounded border border-white/10 bg-black px-3 text-sm font-bold text-white outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="all">Semua SS</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stageLabel(stage)}</option>
                  ))}
                </select>
                )}
              </label>

              <button
                type="button"
                onClick={() => monitorMode === 'practice' ? fetchPracticeRuns(practicesRef.current, selectedPracticeIdRef.current) : fetchRecords(stagesRef.current, selectedStageIdRef.current)}
                className="admin-btn-primary h-11 px-5 sm:col-span-1"
              >
                Refresh
              </button>

              <ConnectionBadge state={connectionState} />
            </div>
          </div>
        </header>

        <UnofficialTimingNotice />

        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-950/60 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Summary label={monitorMode === 'practice' ? 'Total Run' : 'Total Input'} value={activeFeed.length} accent="red" />
          <Summary label="Sedang Berjalan" value={startedOnlyCount} accent="blue" />
          <Summary label="Finish" value={finishedCount} accent="green" />
          <Summary label="Input Terbaru" value={latestRecord ? (monitorMode === 'practice' ? `P${latestRecord.practice_start_number} - ${practiceInputKind(latestRecord)}` : `${latestRecord.start_number} - ${inputKind(latestRecord)}`) : '-'} accent="yellow" />
        </section>

        <main className="flex flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#151515] shadow-[0_30px_100px_rgba(0,0,0,0.38)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Feed Input</h2>
              <p className="mt-1 text-xs font-bold text-gray-500">{monitorMode === 'practice' ? (selectedPracticeId === 'all' ? 'Semua Practice' : practices.find((practice) => practice.id === selectedPracticeId)?.name) : (selectedStageId === 'all' ? 'Semua SS' : stageLabel(stages.find((stage) => stage.id === selectedStageId)))}</p>
            </div>
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label className="w-full sm:w-80">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">Pencarian</span>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-500">⌕</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={monitorMode === 'practice' ? 'Race No, Practice No, atau nama' : 'Race No atau nama'}
                    className="h-10 w-full rounded border border-white/10 bg-black pl-9 pr-9 text-sm font-bold text-white outline-none placeholder:text-gray-600 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                  />
                  {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="Hapus pencarian" className="absolute inset-y-0 right-3 text-lg font-bold text-gray-500 hover:text-white">×</button>}
                </div>
              </label>
              {searchQuery && <span className="mb-2 text-xs font-bold text-gray-400">{activeFeed.length} ditemukan</span>}
              {isLoading && <span className="mb-1 rounded bg-red-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-red-300">Memuat...</span>}
            </div>
          </div>

          {monitorMode === 'practice' ? <PracticeFeed runs={filteredPracticeRuns} timeDecimalPlaces={timeDecimalPlaces} searchQuery={searchQuery} /> : <><div className="hidden min-h-[420px] flex-1 overflow-x-auto xl:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-black text-left text-[11px] uppercase tracking-widest text-gray-500">
                  <th className="p-3">Input</th>
                  <th className="p-3">SS</th>
                  <th className="p-3 text-center">No</th>
                  <th className="p-3">Entrant</th>
                  <th className="p-3">Driver / Navigator</th>
                  <th className="p-3 text-center">Class</th>
                  <th className="p-3 text-center">TC</th>
                  <th className="p-3 text-center">Start</th>
                  <th className="p-3 text-center">Finish</th>
                  <th className="p-3 text-right">Total</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="h-[360px] p-10 text-center">
                      <EmptyState searchQuery={searchQuery} />
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
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
                      <td className="p-3 text-xs font-bold uppercase tracking-wider text-gray-400">{record.team_name || '-'}</td>
                      <td className="p-3">
                        <div className="font-black text-white">{runDriverName(record)}</div>
                        <div className="mt-0.5 text-xs font-bold text-gray-300">{record.codriver_name || '-'}</div>
                      </td>
                      <td className="p-3 text-center text-xs font-black uppercase tracking-wider text-gray-300">{record.class_name || '-'}</td>
                      <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockSeconds(record.tc_time)}</td>
                      <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockSeconds(record.start_time)}</td>
                      <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockCentiseconds(record.finish_time, timeDecimalPlaces)}</td>
                      <td className="p-3 text-right font-mono text-base font-black text-yellow-300">{formatMs(record.total_time_ms, timeDecimalPlaces)}</td>
                      <td className="p-3"><StatusPill status={displayStatus(record)} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex-1 space-y-3 p-3 xl:hidden">
            {filteredRecords.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg bg-black">
                <EmptyState searchQuery={searchQuery} />
              </div>
            ) : (
              filteredRecords.map((record) => <RecordCard key={record.id} record={record} timeDecimalPlaces={timeDecimalPlaces} />)
            )}
          </div></>}
        </main>
      </div>
    </div>
  );
}

function PracticeFeed({ runs, timeDecimalPlaces, searchQuery }) {
  return <>
    <div className="hidden min-h-[420px] flex-1 overflow-x-auto xl:block">
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-black text-left text-[11px] uppercase tracking-widest text-gray-500"><th className="p-3">Input</th><th className="p-3">Practice</th><th className="p-3 text-center">Practice No</th><th className="p-3 text-center">Race No</th><th className="p-3">Driver</th><th className="p-3 text-center">Run</th><th className="p-3 text-center">Start</th><th className="p-3 text-center">Finish</th><th className="p-3 text-right">Elapsed</th><th className="p-3">Status</th></tr></thead>
        <tbody>{runs.length === 0 ? <tr><td colSpan="10" className="h-[360px] p-10 text-center"><EmptyState searchQuery={searchQuery} /></td></tr> : runs.map((run) => <tr key={run.id} className={`border-t border-white/10 ${rowClass(run)}`}>
          <td className="p-3"><div className="font-black text-white">{practiceInputKind(run)}</div><div className="mt-0.5 font-mono text-xs font-bold text-gray-400">{practiceInputTime(run, timeDecimalPlaces)}</div></td>
          <td className="p-3"><div className="font-black text-white">{run.practice_name || '-'}</div><div className="mt-0.5 text-xs font-bold text-gray-500">Maks. {run.max_runs || '-'} run</div></td>
          <td className="p-3 text-center"><span className="inline-flex min-w-12 justify-center rounded bg-red-600 px-3 py-1 font-black text-white">{run.practice_start_number}</span></td>
          <td className="p-3 text-center font-black text-gray-300">{run.race_start_number || '-'}</td>
          <td className="p-3"><div className="font-black text-white">{run.driver_name || '-'}</div><div className="mt-0.5 text-xs font-bold text-gray-400">{run.codriver_name || '-'}</div></td>
          <td className="p-3 text-center font-black text-yellow-300">Run {run.run_no}</td>
          <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockSeconds(run.start_time)}</td>
          <td className="p-3 text-center font-mono font-bold text-gray-300">{formatClockCentiseconds(run.finish_time, timeDecimalPlaces)}</td>
          <td className="p-3 text-right font-mono text-base font-black text-yellow-300">{formatMs(run.elapsed_time_ms, timeDecimalPlaces)}</td>
          <td className="p-3"><StatusPill status={practiceDisplayStatus(run)} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex-1 space-y-3 p-3 xl:hidden">{runs.length === 0 ? <div className="flex min-h-[320px] items-center justify-center rounded-lg bg-black"><EmptyState searchQuery={searchQuery} /></div> : runs.map((run) => <PracticeRunCard key={run.id} run={run} timeDecimalPlaces={timeDecimalPlaces} />)}</div>
  </>;
}

function PracticeRunCard({ run, timeDecimalPlaces }) {
  return <article className={`rounded-lg border border-white/10 p-4 ${rowClass(run) || 'bg-neutral-800'}`}>
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-widest text-red-300">{practiceInputKind(run)} · Run {run.run_no}</div><h2 className="mt-1 text-xl font-black text-white">{run.driver_name || '-'}</h2><p className="mt-1 text-xs font-bold text-gray-400">{run.practice_name || '-'}</p></div><div className="rounded bg-red-600 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-red-100">Practice No</div><div className="text-2xl font-black text-white">{run.practice_start_number}</div></div></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><MiniMetric label="Race No" value={run.race_start_number || '-'} /><MiniMetric label="Run" value={run.run_no || '-'} /><MiniMetric label="Start" value={formatClockSeconds(run.start_time)} /><MiniMetric label="Finish" value={formatClockCentiseconds(run.finish_time, timeDecimalPlaces)} /><MiniMetric label="Elapsed" value={formatMs(run.elapsed_time_ms, timeDecimalPlaces)} highlight /><MiniMetric label="Input" value={practiceInputTime(run, timeDecimalPlaces)} /></div>
    <div className="mt-3"><StatusPill status={practiceDisplayStatus(run)} /></div>
  </article>;
}

function RecordCard({ record, timeDecimalPlaces = 2 }) {
  return (
    <article className={`rounded-lg border border-white/10 p-4 ${rowClass(record) || 'bg-neutral-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-red-300">{inputKind(record)}</div>
          <h2 className="mt-1 break-words text-xl font-black text-white">{runDriverName(record)}</h2>
          <p className="text-xs font-bold text-gray-300">{record.codriver_name || '-'}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{record.team_name || '-'}</p>
          <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-gray-400">Class {record.class_name || '-'}</p>
        </div>
        <div className="rounded bg-black px-3 py-2 text-center">
          <div className="text-[9px] font-black uppercase text-gray-500">No</div>
          <div className="text-2xl font-black text-white">{record.start_number}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-300">
        <MiniMetric label="SS" value={`${stageShortLabel(record)} ${record.ss_name || ''}`.trim()} />
        <MiniMetric label="Entrant" value={record.team_name || '-'} />
        <MiniMetric label="Class" value={record.class_name || '-'} />
        <MiniMetric label="Waktu Input" value={inputTimeLabel(record)} />
        <MiniMetric label="TC" value={formatClockSeconds(record.tc_time)} />
        <MiniMetric label="Start" value={formatClockSeconds(record.start_time)} />
        <MiniMetric label="Finish" value={formatClockCentiseconds(record.finish_time, timeDecimalPlaces)} />
        <MiniMetric label="Total" value={formatMs(record.total_time_ms, timeDecimalPlaces)} highlight />
      </div>
      <div className="mt-3">
        <StatusPill status={displayStatus(record)} />
      </div>
    </article>
  );
}

function Summary({ label, value, accent = 'red' }) {
  const accentClass = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
  }[accent] || 'bg-red-500';

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-[#151515] p-4">
      <span className={`absolute left-0 top-0 h-full w-1 ${accentClass}`} />
      <p className="pl-2 text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</p>
      <p className="mt-2 truncate pl-2 text-3xl font-black leading-none text-white">{value}</p>
    </div>
  );
}

function EmptyState({ searchQuery = '' }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <span className="h-3 w-3 rounded-full bg-red-500 shadow-[0_0_28px_rgba(239,68,68,0.75)]" />
      </span>
      <p className="mt-4 text-lg font-black uppercase tracking-wide text-white">{searchQuery ? 'Data Tidak Ditemukan' : 'Menunggu Input'}</p>
      <p className="mt-1 text-sm font-bold text-gray-500">{searchQuery ? `Tidak ada hasil untuk “${searchQuery}”.` : 'Belum ada input pada pilihan ini.'}</p>
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

function matchesInputSearch(record, query, isPractice) {
  const keyword = normalizeSearchValue(query);
  if (!keyword) return true;
  const values = [
    record.start_number,
    record.race_start_number,
    record.driver_name,
    record.codriver_name,
    record.team_name,
    record.entrant_name,
  ];
  if (isPractice) values.push(record.practice_start_number);
  return values.some((value) => normalizeSearchValue(value).includes(keyword));
}

function normalizeSearchValue(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function inputKind(record) {
  if (record.status && record.status !== 'OK') return record.status;
  if (record.finish_time) return 'FINISH';
  if (record.start_time) return 'START';
  if (record.tc_time) return 'TC';
  if (record.target_tc_time) return 'TARGET TC';
  return 'INPUT';
}

function practiceInputKind(run) {
  if (run.status && run.status !== 'OK') return run.status;
  if (run.finish_time) return 'FINISH';
  if (run.start_time) return 'START';
  return 'INPUT';
}

function practiceDisplayStatus(run) {
  if (run.status && run.status !== 'OK') return run.status;
  return run.finish_time ? 'FINISH' : run.start_time ? 'STARTED' : 'OK';
}

function practiceInputTime(run, decimalPlaces = 2) {
  if (run.finish_time) return formatClockCentiseconds(run.finish_time, decimalPlaces);
  return formatClockSeconds(run.start_time);
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
