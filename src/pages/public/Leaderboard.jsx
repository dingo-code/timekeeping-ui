import { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_ORIGIN, assetUrl } from '../../services/api';

const reconnectDelayMs = 3000;

export default function Leaderboard() {
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [entries, setEntries] = useState([]);
  const [entriesByStage, setEntriesByStage] = useState({});
  const [overallEntries, setOverallEntries] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const selectedStageIdRef = useRef('');
  const wsRef = useRef(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId),
    [stages, selectedStageId]
  );

  const overallForStage = useMemo(
    () => buildOverallEntries(overallEntries, selectedStage),
    [overallEntries, selectedStage]
  );

  useEffect(() => {
    fetchEvents();

    return () => {
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
    setEntriesByStage({});
    setOverallEntries([]);
    setStages([]);
    setSelectedStageId('');

    if (!selectedEventId) {
      shouldReconnectRef.current = false;
      setConnectionState('idle');
      return undefined;
    }

    shouldReconnectRef.current = true;
    fetchStages(selectedEventId);
    fetchOverallResults(selectedEventId);
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
    if (entriesByStage[selectedStageId]) setEntries(entriesByStage[selectedStageId]);
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
      const normalizedEntries = normalizeStageEntries(res.data.data || []);
      setEntries(normalizedEntries);
      setEntriesByStage((current) => ({ ...current, [stageId]: normalizedEntries }));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat leaderboard.');
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const fetchOverallResults = async (eventId) => {
    setIsLoadingOverall(true);
    setError('');
    try {
      const res = await api.get(`/public/race-results/${eventId}?group_by=overall`);
      const groups = res.data.data?.groups || [];
      setOverallEntries(groups.flatMap((group) => group.entries || []));
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat overall.');
    } finally {
      setIsLoadingOverall(false);
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
      fetchOverallResults(eventId);
    };

    socket.onmessage = () => {
      if (selectedStageIdRef.current) fetchStageLeaderboard(selectedStageIdRef.current);
      fetchOverallResults(eventId);
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
      <div className="flex min-h-screen w-full flex-col px-3 py-4 sm:px-6 lg:px-8">
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

            <div className="grid gap-2 sm:grid-cols-[minmax(240px,360px)_auto] sm:items-end">
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
              <ConnectionBadge state={connectionState} />
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/60 p-4 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        <StageTabs
          stages={stages}
          selectedStageId={selectedStageId}
          selectedStage={selectedStage}
          isLoading={isLoadingStages}
          onSelect={setSelectedStageId}
        />

        <section className="mb-4 grid gap-3 sm:grid-cols-3">
          <Summary label={selectedStage ? `SS ${selectedStage.ss_order}` : 'SS'} value={selectedStage?.ss_name || '-'} />
          <Summary label="Stage Finish" value={entries.length} />
          <Summary label="Fastest" value={leaderName(entries[0])} />
        </section>

        <main className="min-h-0 flex-1 space-y-5">
          <ResultsSection
            title="Stage Times"
            subtitle="Waktu tercepat pada SS yang dipilih"
            entries={entries}
            isLoading={isLoadingStages || isLoadingEntries}
            emptyText={selectedStageId ? 'Belum ada data stage times untuk SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
            resultView="stage-times"
            selectedStage={selectedStage}
          />
          <ResultsSection
            title="Overall"
            subtitle="Akumulasi total sampai SS yang dipilih"
            entries={overallForStage}
            isLoading={isLoadingStages || isLoadingOverall}
            emptyText={selectedStageId ? 'Belum ada data overall untuk SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
            resultView="overall"
            selectedStage={selectedStage}
          />
        </main>
      </div>
    </div>
  );
}

function StageTabs({ stages, selectedStageId, selectedStage, isLoading, onSelect }) {
  if (isLoading) {
    return (
      <section className="mb-4 rounded-lg border border-white/10 bg-neutral-900 p-3">
        <div className="h-11 animate-pulse rounded bg-white/5" />
      </section>
    );
  }

  if (stages.length === 0) {
    return (
      <section className="mb-4 rounded-lg border border-white/10 bg-neutral-900 p-4">
        <p className="text-sm font-bold text-gray-500">Belum ada SS untuk event ini.</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">Stage Times</p>
          <h2 className="truncate text-sm font-black uppercase tracking-widest text-white">
            {selectedStage ? `SS ${selectedStage.ss_order} - ${selectedStage.ss_name}` : 'Pilih SS'}
          </h2>
        </div>
        <span className="shrink-0 text-xs font-black text-gray-500">{stages.length} SS</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-1 px-3 py-3">
          {stages.map((stage) => {
            const active = stage.id === selectedStageId;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelect(stage.id)}
                className={`relative min-w-20 border px-4 py-3 text-left transition ${
                  active
                    ? 'border-red-500 bg-white text-neutral-950'
                    : 'border-white/10 bg-black text-gray-300 hover:border-white/30 hover:bg-neutral-800'
                }`}
              >
                {active && <span className="absolute inset-x-0 top-0 h-1 bg-red-600" />}
                <span className="block text-xs font-black uppercase tracking-widest">SS {stage.ss_order}</span>
                <span className={`mt-1 block max-w-32 truncate text-[11px] font-bold ${active ? 'text-neutral-600' : 'text-gray-500'}`}>
                  {stage.ss_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ResultsSection({ title, subtitle, entries, isLoading, emptyText, resultView, selectedStage }) {
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase text-gray-500">{entries.length} peserta</span>
          {isLoading && <span className="text-xs font-black uppercase text-red-300">Memuat...</span>}
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className={`w-full border-collapse text-sm transition-opacity duration-200 ${isLoading ? 'opacity-70' : 'opacity-100'}`}>
          <thead>
            <tr className="bg-black text-left text-[11px] uppercase tracking-widest text-gray-500">
              <th className="p-4 text-center">Rank</th>
              <th className="p-4 text-center">No Start</th>
              <th className="p-4">Driver / Co-driver</th>
              {resultView === 'overall' ? (
                <>
                  <th className="p-4 text-center">SS Done</th>
                  <th className="p-4 text-right">Penalti</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Dif</th>
                </>
              ) : (
                <>
                  <th className="p-4 text-center">Start</th>
                  <th className="p-4 text-center">Finish</th>
                  <th className="p-4 text-right">Penalti</th>
                  <th className="p-4 text-right">Total</th>
                </>
              )}
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-10 text-center text-sm font-bold text-gray-500">{emptyText}</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.participant_id} className={`border-t border-white/10 ${rowClass(entry.status)}`}>
                  <td className="p-4 text-center text-2xl font-black">{entry.rank}</td>
                  <td className="p-4 text-center">
                    <span className="inline-flex min-w-12 justify-center rounded bg-black px-3 py-1 font-black text-white">{entry.start_number}</span>
                  </td>
                  <td className="p-4">
                    <div className="font-black text-white">{entry.driver_name}</div>
                    <div className="mt-0.5 text-xs font-bold text-gray-300">{entry.codriver_name || '-'}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{entry.team_name || '-'}</div>
                  </td>
                  {resultView === 'overall' ? (
                    <>
                      <td className="p-4 text-center font-mono font-bold text-gray-300">{entry.completed_count || 0}/{selectedStage?.ss_order || '-'}</td>
                      <td className="p-4 text-right font-mono font-black text-red-300">{entry.penalty_time_ms > 0 ? `+${formatMs(entry.penalty_time_ms)}` : '-'}</td>
                      <td className="p-4 text-right font-mono text-lg font-black text-yellow-300">{formatMs(entry.total_time_ms)}</td>
                      <td className="p-4 text-right font-mono font-black text-gray-300">{entry.diff_ms ? `+${formatMs(entry.diff_ms)}` : '-'}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-center font-mono font-bold text-gray-300">{entry.start_time || '-'}</td>
                      <td className="p-4 text-center font-mono font-bold text-gray-300">{entry.finish_time || '-'}</td>
                      <td className="p-4 text-right font-mono font-black text-red-300">{entry.penalty_time_ms > 0 ? `+${formatMs(entry.penalty_time_ms)}` : '-'}</td>
                      <td className="p-4 text-right font-mono text-lg font-black text-yellow-300">{formatMs(entry.total_time_ms)}</td>
                    </>
                  )}
                  <td className="p-4">
                    <StatusPill status={entry.status} />
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
          <div className="rounded-lg bg-black p-6 text-center text-sm font-bold text-gray-500">{emptyText}</div>
        ) : (
          entries.map((entry) => <LeaderboardCard key={entry.participant_id} entry={entry} resultView={resultView} selectedStage={selectedStage} />)
        )}
      </div>
    </section>
  );
}

function buildOverallEntries(entries, selectedStage) {
  if (!selectedStage) return [];

  const stageLimit = Number(selectedStage.ss_order);
  const numericMs = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };
  const hasCompleteTime = (stageTime) => Boolean(stageTime?.start_time) && Boolean(stageTime?.finish_time);
  const isCompletedStage = (stageTime) => (
    stageTime?.status === 'OK' &&
    hasCompleteTime(stageTime) &&
    numericMs(stageTime.total_time_ms) > 0
  );
  const terminalStatus = (stageTimes) => (
    stageTimes.find((stageTime) => ['DNF', 'DNS', 'DSQ'].includes(stageTime.status))?.status || ''
  );

  const rows = entries
    .map((entry) => {
      const stageTimes = entry.stage_times || [];
      const selectedStageTime = stageTimes.find((stageTime) => (
        stageTime.ss_id === selectedStage.id || Number(stageTime.ss_order) === stageLimit
      ));
      const upToSelectedStage = stageTimes.filter((stageTime) => Number(stageTime.ss_order) <= stageLimit);
      const completedTimes = upToSelectedStage.filter(isCompletedStage);
      const status = terminalStatus(upToSelectedStage);
      const hasSelectedResult = isCompletedStage(selectedStageTime);
      const hasTerminalStatus = ['DNF', 'DNS', 'DSQ'].includes(status);

      if (!hasSelectedResult && !hasTerminalStatus) return null;

      return {
        ...entry,
        rank: 0,
        completed_count: completedTimes.length,
        penalty_time_ms: completedTimes.reduce((total, stageTime) => total + numericMs(stageTime.penalty_time_ms), 0),
        total_time_ms: completedTimes.reduce((total, stageTime) => total + numericMs(stageTime.total_time_ms), 0),
        status: hasTerminalStatus ? status : 'OK',
        diff_ms: 0,
      };
    })
    .filter(Boolean);

  rows.sort((a, b) => {
    const aWeight = resultStatusWeight(a.status);
    const bWeight = resultStatusWeight(b.status);
    if (aWeight !== bWeight) return aWeight - bWeight;
    if (a.status === 'OK' && a.total_time_ms !== b.total_time_ms) return a.total_time_ms - b.total_time_ms;
    return numericMs(a.start_number) - numericMs(b.start_number);
  });

  const bestTime = rows.find((entry) => entry.status === 'OK')?.total_time_ms || 0;
  let rank = 1;
  return rows.map((entry) => {
    if (entry.status !== 'OK') return { ...entry, rank: '-' };

    const rankedEntry = {
      ...entry,
      rank,
      diff_ms: bestTime ? entry.total_time_ms - bestTime : 0,
    };
    rank += 1;
    return rankedEntry;
  });
}

function normalizeStageEntries(records) {
  const numericMs = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  };
  const hasCompleteTime = (record) => Boolean(record.start_time) && Boolean(record.finish_time);
  const hasDisplayStatus = (record) => record.status === 'DNF' || record.status === 'DNS';
  const activeRecords = records.filter((record) => (
    record.is_active !== false &&
    (hasCompleteTime(record) || hasDisplayStatus(record))
  ));
  const hasStageResult = (record) => (
    record.status === 'OK' &&
    hasCompleteTime(record) &&
    numericMs(record.total_time_ms) > 0
  );
  const stageRecordWeight = (record) => {
    if (hasStageResult(record)) return 0;
    return resultStatusWeight(record.status);
  };

  activeRecords.sort((a, b) => {
    const aWeight = stageRecordWeight(a);
    const bWeight = stageRecordWeight(b);
    if (aWeight !== bWeight) return aWeight - bWeight;

    const aTotal = numericMs(a.total_time_ms);
    const bTotal = numericMs(b.total_time_ms);
    if (hasStageResult(a) && aTotal !== bTotal) return aTotal - bTotal;
    return numericMs(a.start_number) - numericMs(b.start_number);
  });

  let rank = 1;
  return activeRecords.map((record) => {
    const ranked = hasStageResult(record);
    const entry = {
      ...record,
      rank: ranked ? rank : '-',
      penalty_desc: formatPenaltyDetails(record.penalty_details),
    };
    if (ranked) rank += 1;
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

function resultStatusWeight(status) {
  if (status === 'OK') return 1;
  if (status === 'INCOMPLETE' || !status) return 2;
  if (status === 'DSQ') return 3;
  if (status === 'DNF') return 4;
  if (status === 'DNS') return 5;
  return 3;
}

function LeaderboardCard({ entry, resultView, selectedStage }) {
  return (
    <article className={`rounded-lg border border-white/10 p-4 ${rowClass(entry.status) || 'bg-neutral-800'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-gray-400">Rank #{entry.rank}</div>
          <h2 className="mt-1 break-words text-xl font-black text-white">{entry.driver_name}</h2>
          <p className="text-xs font-bold text-gray-300">{entry.codriver_name || '-'}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{entry.team_name || '-'}</p>
        </div>
        <div className="rounded bg-black px-3 py-2 text-center">
          <div className="text-[9px] font-black uppercase text-gray-500">No</div>
          <div className="text-2xl font-black text-white">{entry.start_number}</div>
        </div>
      </div>
      {resultView === 'overall' ? (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-300">
          <MiniMetric label="SS Done" value={`${entry.completed_count || 0}/${selectedStage?.ss_order || '-'}`} />
          <MiniMetric label="Penalti" value={entry.penalty_time_ms > 0 ? `+${formatMs(entry.penalty_time_ms)}` : '-'} />
          <MiniMetric label="Total" value={formatMs(entry.total_time_ms)} highlight />
          <MiniMetric label="Dif" value={entry.diff_ms ? `+${formatMs(entry.diff_ms)}` : '-'} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-gray-300">
          <MiniMetric label="Start" value={entry.start_time || '-'} />
          <MiniMetric label="Finish" value={entry.finish_time || '-'} />
          <MiniMetric label="Penalti" value={entry.penalty_time_ms > 0 ? `+${formatMs(entry.penalty_time_ms)}` : '-'} />
          <MiniMetric label="Total" value={formatMs(entry.total_time_ms)} highlight />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusPill status={entry.status} />
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
  if (status === 'DNF') return 'bg-orange-950/60';
  if (status === 'DNS') return 'bg-yellow-950/60';
  if (status === 'DSQ') return 'bg-red-950/60';
  return '';
}

function statusClass(status) {
  if (status === 'DNF') return 'bg-orange-200 text-orange-950';
  if (status === 'DNS') return 'bg-yellow-200 text-yellow-950';
  if (status === 'DSQ') return 'bg-red-200 text-red-950';
  return 'bg-green-200 text-green-950';
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
