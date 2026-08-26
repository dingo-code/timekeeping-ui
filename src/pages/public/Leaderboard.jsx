import { useEffect, useMemo, useRef, useState } from 'react';
import api, { API_ORIGIN, assetUrl } from '../../services/api';

const reconnectDelayMs = 3000;
const FINAL_STAGE_ID = 'final';

export default function Leaderboard() {
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [practices, setPractices] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedPracticeId, setSelectedPracticeId] = useState('');
  const [practiceResult, setPracticeResult] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entriesByStage, setEntriesByStage] = useState({});
  const [stageRecordsById, setStageRecordsById] = useState({});
  const [overallEntries, setOverallEntries] = useState([]);
  const [resultCategory, setResultCategory] = useState('stage-times');
  const [startingListMode, setStartingListMode] = useState('entry-list');
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState(false);
  const [isLoadingAllStages, setIsLoadingAllStages] = useState(false);
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [error, setError] = useState('');
  const [connectionState, setConnectionState] = useState('idle');
  const reconnectTimerRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const selectedStageIdRef = useRef('');
  const stagesRef = useRef([]);
  const wsRef = useRef(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );

  const selectedStage = useMemo(() => {
    if (selectedStageId === FINAL_STAGE_ID) {
      return { id: FINAL_STAGE_ID, ss_order: 'Final', ss_name: 'Final' };
    }
    return stages.find((stage) => stage.id === selectedStageId);
  }, [stages, selectedStageId]);
  const selectedPractice = useMemo(
    () => practices.find((practice) => practice.id === selectedPracticeId),
    [practices, selectedPracticeId]
  );

  const overallForStage = useMemo(
    () => buildOverallEntries(overallEntries, selectedStage),
    [overallEntries, selectedStage]
  );
  const stageWinners = useMemo(
    () => buildStageWinners(stages, entriesByStage),
    [stages, entriesByStage]
  );
  const startingList = useMemo(
    () => buildStartingList(overallEntries),
    [overallEntries]
  );
  const selectedStageRecords = useMemo(
    () => (selectedStageId === FINAL_STAGE_ID ? [] : (stageRecordsById[selectedStageId] || [])),
    [stageRecordsById, selectedStageId]
  );
  const penalties = useMemo(
    () => buildPenaltyRows(stages, stageRecordsById),
    [stages, stageRecordsById]
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
    setStageRecordsById({});
    setOverallEntries([]);
    setStages([]);
    setPractices([]);
    setSelectedStageId('');
    setSelectedPracticeId('');
    setPracticeResult(null);
    setResultCategory('stage-times');

    if (!selectedEventId) {
      shouldReconnectRef.current = false;
      setConnectionState('idle');
      return undefined;
    }

    shouldReconnectRef.current = true;
    fetchStages(selectedEventId);
    fetchPractices(selectedEventId);
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
    if (selectedStageId === FINAL_STAGE_ID) {
      setEntries([]);
      return;
    }
    if (entriesByStage[selectedStageId]) setEntries(entriesByStage[selectedStageId]);
    if (selectedStageId) fetchStageLeaderboard(selectedStageId);
  }, [selectedStageId]);

  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  useEffect(() => {
    if (resultCategory !== 'practice' || !selectedPracticeId) return undefined;
    fetchPracticeResult(selectedPracticeId);
    const timer = window.setInterval(() => fetchPracticeResult(selectedPracticeId, true), 3000);
    return () => window.clearInterval(timer);
  }, [resultCategory, selectedPracticeId]);

  const fetchStages = async (eventId) => {
    setIsLoadingStages(true);
    setError('');
    try {
      const res = await api.get(`/public/events/${eventId}/stages`);
      const nextStages = res.data.data || [];
      setStages(nextStages);
      setSelectedStageId(nextStages[0]?.id || '');
      fetchAllStageRecords(nextStages);
    } catch (err) {
      setStages([]);
      setSelectedStageId('');
      setError(err.response?.data?.error || 'Gagal memuat daftar SS.');
    } finally {
      setIsLoadingStages(false);
    }
  };

  const fetchPractices = async (eventId) => {
    try {
      const res = await api.get(`/public/events/${eventId}/practices`);
      const nextPractices = res.data.data || [];
      setPractices(nextPractices);
      setSelectedPracticeId(nextPractices[0]?.id || '');
    } catch (err) {
      setPractices([]);
      setSelectedPracticeId('');
      setError(err.response?.data?.error || 'Gagal memuat daftar Practice.');
    }
  };

  const fetchPracticeResult = async (practiceId, silent = false) => {
    if (!silent) setIsLoadingPractice(true);
    try {
      const res = await api.get(`/public/practice-results/${practiceId}`);
      setPracticeResult(res.data.data || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat Practice Result.');
    } finally {
      if (!silent) setIsLoadingPractice(false);
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

  const fetchAllStageRecords = async (stageList) => {
    if (!stageList.length) {
      setStageRecordsById({});
      return;
    }

    setIsLoadingAllStages(true);
    try {
      const pairs = await Promise.all(stageList.map(async (stage) => {
        const res = await api.get(`/public/stages/${stage.id}/records`);
        const rawRecords = res.data.data || [];
        return [stage.id, rawRecords, normalizeStageEntries(rawRecords)];
      }));

      const nextRawRecords = {};
      const nextEntries = {};
      pairs.forEach(([stageId, rawRecords, normalizedEntries]) => {
        nextRawRecords[stageId] = rawRecords;
        nextEntries[stageId] = normalizedEntries;
      });
      setStageRecordsById(nextRawRecords);
      setEntriesByStage((current) => ({ ...current, ...nextEntries }));
      if (selectedStageIdRef.current && nextEntries[selectedStageIdRef.current]) {
        setEntries(nextEntries[selectedStageIdRef.current]);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memuat data semua SS.');
    } finally {
      setIsLoadingAllStages(false);
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
      if (selectedStageIdRef.current && selectedStageIdRef.current !== FINAL_STAGE_ID) fetchStageLeaderboard(selectedStageIdRef.current);
      fetchOverallResults(eventId);
      fetchAllStageRecords(stagesRef.current);
    };

    socket.onmessage = () => {
      if (selectedStageIdRef.current && selectedStageIdRef.current !== FINAL_STAGE_ID) fetchStageLeaderboard(selectedStageIdRef.current);
      fetchOverallResults(eventId);
      fetchAllStageRecords(stagesRef.current);
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
    <div className="min-h-screen bg-[#f4f4f4] text-neutral-950" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="flex min-h-screen w-full flex-col px-3 py-4 sm:px-6 lg:px-8">
        <header className="mb-4 border-b border-neutral-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {selectedEvent?.logo_url ? (
                <img src={assetUrl(selectedEvent.logo_url)} alt="Logo event" className="h-16 w-24 shrink-0 object-contain sm:h-20 sm:w-28" />
              ) : (
                <div className="flex h-16 w-24 shrink-0 items-center justify-center border border-neutral-200 bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-400 sm:h-20 sm:w-28">
                  Logo
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-600">Live Rally Timing</p>
                <h1 className="mt-1 break-words text-2xl font-black uppercase leading-tight text-neutral-950 sm:text-4xl">
                  {selectedEvent?.name || 'Leaderboard'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-neutral-500 sm:text-sm">
                  <span>{formatEventDate(selectedEvent)}</span>
                  <span>{selectedEvent?.location || '-'}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[minmax(240px,360px)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-neutral-500">Pilih Event</span>
                <select
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  disabled={isLoadingEvents || events.length === 0}
                  className="w-full border border-neutral-300 bg-white px-3 py-3 text-sm font-black text-neutral-950 outline-none focus:border-red-600 disabled:opacity-50"
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
          <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <ResultCategoryTabs value={resultCategory} onChange={setResultCategory} />

        {resultCategory === 'practice' ? (
          <PracticeTabs practices={practices} selectedPracticeId={selectedPracticeId} selectedPractice={selectedPractice} onSelect={setSelectedPracticeId} />
        ) : (
          <StageTabs
            stages={stages}
            selectedStageId={selectedStageId}
            selectedStage={selectedStage}
            isLoading={isLoadingStages}
            onSelect={setSelectedStageId}
          />
        )}

        <main className="min-h-0 flex-1">
          {resultCategory === 'stage-times' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <ResultsSection
                title="Stage Times"
                subtitle="Waktu tercepat pada SS yang dipilih"
                entries={entries}
                isLoading={isLoadingStages || isLoadingEntries}
                emptyText={selectedStageId ? 'Belum ada data stage times untuk SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
                resultView="stage-times"
              />
              <ResultsSection
                title="Overall"
                subtitle="Akumulasi total sampai SS yang dipilih"
                entries={overallForStage}
                isLoading={isLoadingStages || isLoadingOverall}
                emptyText={selectedStageId ? 'Belum ada data overall untuk SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
                resultView="overall"
              />
            </div>
          )}

          {resultCategory === 'overall' && (
            <ResultsSection
              title="Overall"
              subtitle={selectedStageId === FINAL_STAGE_ID ? 'Overall all time' : 'Akumulasi total sampai SS yang dipilih'}
              entries={overallForStage}
              isLoading={isLoadingStages || isLoadingOverall}
              emptyText={selectedStageId ? 'Belum ada data overall untuk SS ini.' : 'Pilih event dan SS untuk melihat leaderboard.'}
              resultView="overall"
            />
          )}

          {resultCategory === 'stage-winners' && (
            <StageWinnersSection entries={stageWinners} isLoading={isLoadingAllStages} />
          )}

          {resultCategory === 'starting-list' && (
            <StartingListSection
              entries={startingList}
              stageEntries={selectedStageRecords}
              selectedStage={selectedStage}
              mode={startingListMode}
              onModeChange={setStartingListMode}
              isLoading={isLoadingOverall || isLoadingEntries}
            />
          )}

          {resultCategory === 'penalties' && (
            <PenaltiesSection entries={penalties} isLoading={isLoadingAllStages} />
          )}

          {resultCategory === 'practice' && (
            <PracticeLeaderboardSection
              result={practiceResult}
              practice={selectedPractice}
              isLoading={isLoadingPractice}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function StageTabs({ stages, selectedStageId, selectedStage, isLoading, onSelect }) {
  if (isLoading) {
    return (
      <section className="mb-4 border border-neutral-200 bg-white p-3">
        <div className="h-11 animate-pulse bg-neutral-100" />
      </section>
    );
  }

  if (stages.length === 0) {
    return (
      <section className="mb-4 border border-neutral-200 bg-white p-4">
        <p className="text-sm font-bold text-neutral-500">Belum ada SS untuk event ini.</p>
      </section>
    );
  }

  return (
    <section className="mb-4 overflow-hidden border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-600">Select Stage</p>
          <h2 className="truncate text-sm font-black uppercase tracking-widest text-neutral-950">
            {selectedStageId === FINAL_STAGE_ID ? 'Final - Overall All Time' : selectedStage ? `SS ${selectedStage.ss_order} - ${selectedStage.ss_name}` : 'Pilih SS'}
          </h2>
        </div>
        <span className="shrink-0 text-xs font-black text-neutral-500">{stages.length} SS + Final</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-0 px-3 py-3">
          {[...stages, { id: FINAL_STAGE_ID, ss_order: 'Final', ss_name: 'Overall' }].map((stage) => {
            const isFinal = stage.id === FINAL_STAGE_ID;
            const active = stage.id === selectedStageId;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelect(stage.id)}
                className={`relative min-w-20 border px-4 py-3 text-left transition ${
                  active
                    ? 'border-neutral-200 bg-white text-neutral-950'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-950 hover:text-neutral-950'
                }`}
              >
                {active && <span className="absolute inset-x-0 bottom-0 h-1 bg-red-600" />}
                <span className="block text-xs font-black uppercase tracking-widest">{isFinal ? 'Final' : `SS ${stage.ss_order}`}</span>
                <span className={`mt-1 block max-w-32 truncate text-[11px] font-bold ${active ? 'text-neutral-700' : 'text-neutral-500'}`}>
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

function PracticeTabs({ practices, selectedPracticeId, selectedPractice, onSelect }) {
  if (practices.length === 0) {
    return <section className="mb-4 border border-neutral-200 bg-white p-4"><p className="text-sm font-bold text-neutral-500">Belum ada sesi Practice untuk event ini.</p></section>;
  }
  return (
    <section className="mb-4 overflow-hidden border border-neutral-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
        <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-600">Select Practice</p><h2 className="truncate text-sm font-black uppercase tracking-widest text-neutral-950">{selectedPractice?.name || 'Pilih Practice'}</h2></div>
        <span className="shrink-0 text-xs font-black text-neutral-500">{practices.length} sesi</span>
      </div>
      <div className="overflow-x-auto"><div className="flex min-w-max px-3 py-3">
        {practices.map((practice) => {
          const active = practice.id === selectedPracticeId;
          return <button key={practice.id} type="button" onClick={() => onSelect(practice.id)} className={`relative min-w-36 border px-4 py-3 text-left transition ${active ? 'border-neutral-200 text-neutral-950' : 'border-neutral-200 text-neutral-500 hover:border-neutral-950 hover:text-neutral-950'}`}>{active && <span className="absolute inset-x-0 bottom-0 h-1 bg-red-600" />}<span className="block text-xs font-black uppercase tracking-widest">{practice.name}</span><span className="mt-1 block text-[11px] font-bold text-neutral-500">Best of {practice.max_runs} run</span></button>;
        })}
      </div></div>
    </section>
  );
}

function ResultCategoryTabs({ value, onChange }) {
  const tabs = [
    { value: 'overall', label: 'Overall' },
    { value: 'stage-times', label: 'Stage Times' },
    { value: 'stage-winners', label: 'Stage Winners' },
    { value: 'starting-list', label: 'Starting List' },
    { value: 'penalties', label: 'Penaltie' },
    { value: 'practice', label: 'Practice' },
  ];

  return (
    <section className="mb-4 overflow-hidden border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <div className="flex min-w-max">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={`relative border-r border-neutral-200 px-5 py-4 text-sm font-black uppercase tracking-widest transition ${
                active ? 'bg-white text-neutral-950' : 'bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950'
              }`}
            >
              {tab.label}
              {active && <span className="absolute inset-x-0 bottom-0 h-1 bg-red-600" />}
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}

function ResultsSection({ title, subtitle, entries, isLoading, emptyText, resultView }) {
  const isOverall = resultView === 'overall';
  const colSpan = isOverall ? 9 : 5;

  return (
    <section className="overflow-hidden border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-neutral-950">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-neutral-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase text-neutral-500">{entries.length}</span>
          {isLoading && <span className="text-xs font-black uppercase text-red-600">Memuat...</span>}
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className={`w-full border-collapse text-sm transition-opacity duration-200 ${isLoading ? 'opacity-70' : 'opacity-100'}`}>
          <thead>
            <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-widest text-neutral-500">
              {isOverall ? (
                <>
                  <th className="p-4 text-center">Pos</th>
                  <th className="p-4 text-center">Car No</th>
                  <th className="p-4">Driver/Reg</th>
                  <th className="p-4">Navigator/Reg</th>
                  <th className="p-4">Car</th>
                  <th className="p-4 text-right">Penalties</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-right">Diff</th>
                  <th className="p-4 text-right">Diff 1st</th>
                </>
              ) : (
                <>
                  <th className="p-4 text-center">Pos</th>
                  <th className="p-4 text-center">No</th>
                  <th className="p-4">Crew</th>
                  <th className="p-4 text-right">Time</th>
                  <th className="p-4 text-right">Dif</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-10 text-center text-sm font-bold text-neutral-500">{emptyText}</td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.participant_id} className={`border-t border-neutral-200 ${rowClass(entry.status)}`}>
                  {isOverall ? (
                    <>
                      <td className="p-4 text-center text-2xl font-black text-neutral-950">{entry.rank}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex min-w-12 justify-center border border-neutral-300 bg-white px-3 py-1 font-black text-neutral-950">{entry.start_number}</span>
                      </td>
                      <td className="p-4">{renderPerson(entry.driver_name, entry.regional_name || entry.driver_regional_name)}</td>
                      <td className="p-4">{renderPerson(entry.codriver_name || '-', entry.codriver_regional_name)}</td>
                      <td className="p-4 font-bold text-neutral-700">{carName(entry)}</td>
                      <td className="p-4 text-right font-mono font-black text-red-600">{entry.penalty_time_ms ? `+${formatMs(entry.penalty_time_ms)}` : '-'}</td>
                      <td className="p-4 text-right font-mono text-lg font-black text-neutral-950">{formatMs(entry.total_time_ms)}</td>
                      <td className="p-4 text-right font-mono font-black text-neutral-500">{entry.gap_ms ? `+${formatMs(entry.gap_ms)}` : '-'}</td>
                      <td className="p-4 text-right font-mono font-black text-neutral-500">{entry.diff_first_ms ? `+${formatMs(entry.diff_first_ms)}` : '-'}</td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-center text-2xl font-black text-neutral-950">{entry.rank}</td>
                      <td className="p-4 text-center">
                        <span className="inline-flex min-w-12 justify-center border border-neutral-300 bg-white px-3 py-1 font-black text-neutral-950">{entry.start_number}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-black text-neutral-950">{entry.driver_name}</div>
                        <div className="mt-0.5 text-xs font-bold text-neutral-600">{entry.codriver_name || '-'}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">{entry.team_name || '-'}</div>
                      </td>
                      <td className="p-4 text-right font-mono text-lg font-black text-neutral-950">{formatMs(entry.total_time_ms)}</td>
                      <td className="p-4 text-right font-mono font-black text-neutral-500">{entry.diff_ms ? `+${formatMs(entry.diff_ms)}` : '-'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 p-3 lg:hidden">
        {entries.length === 0 ? (
          <div className="border border-neutral-200 bg-neutral-50 p-6 text-center text-sm font-bold text-neutral-500">{emptyText}</div>
        ) : (
          entries.map((entry) => <LeaderboardCard key={entry.participant_id} entry={entry} resultView={resultView} />)
        )}
      </div>
    </section>
  );
}

function PracticeLeaderboardSection({ result, practice, isLoading }) {
  const entries = result?.entries || [];
  const bestTime = entries.find((entry) => Number(entry.best_time_ms) > 0)?.best_time_ms || 0;
  return (
    <section className="overflow-hidden border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div><h2 className="text-sm font-black uppercase tracking-widest text-neutral-950">Practice Result</h2><p className="mt-0.5 text-xs font-semibold text-neutral-500">{practice?.name || 'Practice'} · Ranking berdasarkan best run</p></div>
        <div className="flex items-center gap-3"><span className="text-xs font-black uppercase text-neutral-500">{entries.length}</span>{isLoading && <span className="text-xs font-black uppercase text-red-600">Memuat...</span>}</div>
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className={`w-full border-collapse text-sm ${isLoading ? 'opacity-70' : ''}`}>
          <thead><tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-widest text-neutral-500"><th className="p-4 text-center">Pos</th><th className="p-4 text-center">Practice No</th><th className="p-4 text-center">Race No</th><th className="p-4">Crew</th><th className="p-4">Car / Class</th><th className="p-4 text-center">Best Run</th><th className="p-4 text-right">Best Time</th><th className="p-4 text-right">Diff 1st</th></tr></thead>
          <tbody>{entries.length === 0 ? <tr><td colSpan="8" className="p-10 text-center font-bold text-neutral-500">Belum ada hasil Practice.</td></tr> : entries.map((entry) => {
            const diff = bestTime && entry.best_time_ms ? Number(entry.best_time_ms) - Number(bestTime) : 0;
            return <tr key={entry.id} className="border-t border-neutral-200"><td className="p-4 text-center text-2xl font-black">{entry.rank || '-'}</td><td className="p-4 text-center"><span className="inline-flex min-w-12 justify-center border border-neutral-300 px-3 py-1 font-black">{entry.practice_start_number}</span></td><td className="p-4 text-center font-bold text-neutral-600">{entry.race_start_number}</td><td className="p-4"><div className="font-black">{entry.driver_name || '-'}</div><div className="mt-0.5 text-xs font-bold text-neutral-600">{entry.codriver_name || '-'}</div><div className="mt-1 text-[11px] font-bold uppercase text-neutral-400">{entry.entrant_name || '-'}</div></td><td className="p-4"><div className="font-bold text-neutral-700">{entry.vehicle_name || '-'}</div><div className="text-xs font-bold text-neutral-500">{entry.class_name || '-'}</div></td><td className="p-4 text-center font-black">{entry.best_run_no ? `Run ${entry.best_run_no}` : '-'}</td><td className="p-4 text-right font-mono text-lg font-black">{formatMs(entry.best_time_ms)}</td><td className="p-4 text-right font-mono font-black text-neutral-500">{diff > 0 ? `+${formatMs(diff)}` : '-'}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 lg:hidden">{entries.length === 0 ? <div className="border border-neutral-200 bg-neutral-50 p-6 text-center text-sm font-bold text-neutral-500">Belum ada hasil Practice.</div> : entries.map((entry) => {
        const diff = bestTime && entry.best_time_ms ? Number(entry.best_time_ms) - Number(bestTime) : 0;
        return <article key={entry.id} className="border border-neutral-200 bg-white p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-widest text-neutral-500">Rank #{entry.rank || '-'}</div><h2 className="mt-1 text-xl font-black">{entry.driver_name || '-'}</h2><p className="text-xs font-bold text-neutral-600">{entry.codriver_name || '-'}</p><p className="mt-1 text-[11px] font-bold uppercase text-neutral-500">{entry.vehicle_name || '-'}</p></div><div className="border border-neutral-300 px-3 py-2 text-center"><div className="text-[9px] font-black uppercase text-neutral-500">Practice</div><div className="text-2xl font-black">{entry.practice_start_number}</div></div></div><div className="grid grid-cols-3 gap-2"><MiniMetric label="Best Run" value={entry.best_run_no ? `Run ${entry.best_run_no}` : '-'} /><MiniMetric label="Best Time" value={formatMs(entry.best_time_ms)} highlight /><MiniMetric label="Diff 1st" value={diff > 0 ? `+${formatMs(diff)}` : '-'} /></div></article>;
      })}</div>
    </section>
  );
}

function StageWinnersSection({ entries, isLoading }) {
  return (
    <SimpleSection title="Stage Winners" subtitle="Pemenang tercepat dari setiap SS" count={entries.length} isLoading={isLoading} emptyText="Belum ada stage winner.">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-widest text-neutral-500">
            <th className="p-4">Stage</th>
            <th className="p-4">Stage Name</th>
            <th className="p-4">Driver</th>
            <th className="p-4">Navigator</th>
            <th className="p-4">Car</th>
            <th className="p-4 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.stage_id} className="border-t border-neutral-200">
              <td className="p-4 font-black text-neutral-950">SS {entry.ss_order}</td>
              <td className="p-4 font-bold text-neutral-700">{entry.ss_name}</td>
              <td className="p-4">{renderPerson(entry.driver_name, entry.regional_name || entry.driver_regional_name)}</td>
              <td className="p-4">{renderPerson(entry.codriver_name || '-', entry.codriver_regional_name)}</td>
              <td className="p-4 font-bold text-neutral-700">{carName(entry)}</td>
              <td className="p-4 text-right font-mono text-lg font-black text-neutral-950">{formatMs(entry.total_time_ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SimpleSection>
  );
}

function StartingListSection({ entries, stageEntries, selectedStage, mode, onModeChange, isLoading }) {
  const isStageMode = mode === 'stage-list';
  const displayEntries = isStageMode ? buildStageStartingList(stageEntries) : entries;
  const emptyText = isStageMode && selectedStage?.id === FINAL_STAGE_ID
    ? 'Starting list per SS tidak tersedia untuk Final.'
    : 'Belum ada starting list.';

  return (
    <SimpleSection title="Starting List" subtitle="Entry list dan urutan start per SS" count={displayEntries.length} isLoading={isLoading} emptyText={emptyText} showChildrenWhenEmpty>
      <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'entry-list', label: 'Entry List' },
            { value: 'stage-list', label: selectedStage?.id === FINAL_STAGE_ID ? 'Starting List per SS' : `Starting List SS ${selectedStage?.ss_order || ''}` },
          ].map((tab) => {
            const active = mode === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onModeChange(tab.value)}
                className={`relative border px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                  active ? 'border-neutral-300 bg-white text-neutral-950' : 'border-neutral-300 bg-white text-neutral-500 hover:border-neutral-950 hover:text-neutral-950'
                }`}
              >
                {tab.label}
                {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-red-600" />}
              </button>
            );
          })}
        </div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-widest text-neutral-500">
            <th className="p-4 text-center">{isStageMode ? 'Start' : 'No'}</th>
            <th className="p-4 text-center">Car No.</th>
            <th className="p-4">Driver / Reg</th>
            <th className="p-4">Navigator / Reg</th>
            <th className="p-4">Car</th>
            <th className="p-4">Class</th>
            <th className="p-4">Category</th>
            {isStageMode && <th className="p-4 text-right">Start Time</th>}
          </tr>
        </thead>
        <tbody>
          {displayEntries.length === 0 && (
            <tr>
              <td colSpan={isStageMode ? 8 : 7} className="p-10 text-center text-sm font-bold text-neutral-500">{emptyText}</td>
            </tr>
          )}
          {displayEntries.map((entry, index) => (
            <tr key={`${entry.participant_id}-${entry.id || 'entry'}`} className="border-t border-neutral-200">
              <td className="p-4 text-center text-lg font-black text-neutral-950">{isStageMode ? (entry.start_order || index + 1) : index + 1}</td>
              <td className="p-4 text-center">
                <span className="inline-flex min-w-12 justify-center border border-neutral-300 bg-white px-3 py-1 font-black text-neutral-950">{entry.start_number}</span>
              </td>
              <td className="p-4">{renderPerson(entry.driver_name, entry.regional_name || entry.driver_regional_name)}</td>
              <td className="p-4">{renderPerson(entry.codriver_name || '-', entry.codriver_regional_name)}</td>
              <td className="p-4 font-bold text-neutral-700">{carName(entry)}</td>
              <td className="p-4 font-bold text-neutral-700">{entry.class_name || '-'}</td>
              <td className="p-4 font-bold text-neutral-700">{entry.category_name || '-'}</td>
              {isStageMode && <td className="p-4 text-right font-mono font-black text-neutral-950">{formatClock(entry.start_time)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </SimpleSection>
  );
}

function PenaltiesSection({ entries, isLoading }) {
  return (
    <SimpleSection title="Penalties" subtitle="Daftar penalti yang tercatat pada semua SS" count={entries.length} isLoading={isLoading} emptyText="Belum ada penalti.">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-widest text-neutral-500">
            <th className="p-4 text-center">Car No.</th>
            <th className="p-4">Driver / Reg</th>
            <th className="p-4">Navigator / Reg</th>
            <th className="p-4">Car</th>
            <th className="p-4">Class</th>
            <th className="p-4">Category</th>
            <th className="p-4">Reason</th>
            <th className="p-4 text-right">Penalties</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.key} className="border-t border-neutral-200">
              <td className="p-4 text-center">
                <span className="inline-flex min-w-12 justify-center border border-neutral-300 bg-white px-3 py-1 font-black text-neutral-950">{entry.start_number}</span>
              </td>
              <td className="p-4">{renderPerson(entry.driver_name, entry.regional_name || entry.driver_regional_name)}</td>
              <td className="p-4">{renderPerson(entry.codriver_name || '-', entry.codriver_regional_name)}</td>
              <td className="p-4 font-bold text-neutral-700">{carName(entry)}</td>
              <td className="p-4 font-bold text-neutral-700">{entry.class_name || '-'}</td>
              <td className="p-4 font-bold text-neutral-700">{entry.category_name || '-'}</td>
              <td className="p-4 font-bold text-neutral-700">{entry.penalty_name}</td>
              <td className="p-4 text-right font-mono font-black text-red-600">+{formatMs(entry.penalty_time_ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SimpleSection>
  );
}

function SimpleSection({ title, subtitle, count, isLoading, emptyText, children, showChildrenWhenEmpty = false }) {
  return (
    <section className="overflow-hidden border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-neutral-950">{title}</h2>
          <p className="mt-0.5 text-xs font-semibold text-neutral-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-black uppercase text-neutral-500">{count}</span>
          {isLoading && <span className="text-xs font-black uppercase text-red-600">Memuat...</span>}
        </div>
      </div>
      <div className={`overflow-x-auto transition-opacity duration-200 ${isLoading ? 'opacity-70' : 'opacity-100'}`}>
        {count === 0 && !showChildrenWhenEmpty ? (
          <div className="p-10 text-center text-sm font-bold text-neutral-500">{emptyText}</div>
        ) : children}
      </div>
    </section>
  );
}

function buildStageWinners(stages, entriesByStage) {
  return stages
    .map((stage) => {
      const winner = (entriesByStage[stage.id] || []).find((entry) => entry.rank === 1);
      if (!winner) return null;
      return {
        ...winner,
        stage_id: stage.id,
        ss_order: stage.ss_order,
        ss_name: stage.ss_name,
      };
    })
    .filter(Boolean);
}

function buildStartingList(entries) {
  return [...entries].sort((a, b) => Number(a.start_number || 0) - Number(b.start_number || 0));
}

function buildStageStartingList(entries) {
  return [...entries]
    .filter((entry) => entry.is_active !== false)
    .sort((a, b) => Number(a.start_order || a.start_number || 0) - Number(b.start_order || b.start_number || 0));
}

function buildPenaltyRows(stages, stageRecordsById) {
  const rows = [];
  stages.forEach((stage) => {
    const records = stageRecordsById[stage.id] || [];
    records
      .filter((record) => record.is_active !== false)
      .forEach((record) => {
        const penalties = normalizePenaltyDetails(record.penalty_details);
        penalties.forEach((penalty, index) => {
          rows.push({
            key: `${stage.id}-${record.id}-${index}`,
            ss_order: stage.ss_order,
            ss_name: stage.ss_name,
            start_number: record.start_number,
            driver_name: record.driver_name,
            driver_regional_name: record.driver_regional_name,
            regional_name: record.regional_name,
            codriver_name: record.codriver_name,
            codriver_regional_name: record.codriver_regional_name,
            vehicle_name: record.vehicle_name,
            team_name: record.team_name,
            class_name: record.class_name,
            category_name: record.category_name,
            penalty_name: penalty.name || 'Penalty',
            penalty_time_ms: Number(penalty.time_ms || 0),
          });
        });
      });
  });
  return rows.sort((a, b) => {
    if (Number(a.ss_order) !== Number(b.ss_order)) return Number(a.ss_order) - Number(b.ss_order);
    return Number(a.start_number || 0) - Number(b.start_number || 0);
  });
}

function normalizePenaltyDetails(details) {
  const parsed = typeof details === 'string' ? parsePenaltyDetails(details) : details;
  return Array.isArray(parsed) ? parsed : [];
}

function buildOverallEntries(entries, selectedStage) {
  if (!selectedStage) return [];

  const isFinal = selectedStage.id === FINAL_STAGE_ID;
  const stageLimit = isFinal ? Infinity : Number(selectedStage.ss_order);
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
      const selectedStageTime = isFinal
        ? null
        : stageTimes.find((stageTime) => (
          stageTime.ss_id === selectedStage.id || Number(stageTime.ss_order) === stageLimit
        ));
      const upToSelectedStage = stageTimes.filter((stageTime) => Number(stageTime.ss_order) <= stageLimit);
      const completedTimes = upToSelectedStage.filter(isCompletedStage);
      const status = terminalStatus(upToSelectedStage);
      const hasSelectedResult = isFinal ? completedTimes.length > 0 : isCompletedStage(selectedStageTime);
      const hasTerminalStatus = ['DNF', 'DNS', 'DSQ'].includes(status);

      if (!hasSelectedResult && !hasTerminalStatus) return null;

      return {
        ...entry,
        rank: 0,
        completed_count: completedTimes.length,
        penalty_time_ms: completedTimes.reduce((total, stageTime) => total + numericMs(stageTime.penalty_time_ms), 0),
        total_time_ms: completedTimes.reduce((total, stageTime) => total + numericMs(stageTime.total_time_ms), 0),
        status: hasTerminalStatus ? status : 'OK',
        gap_ms: 0,
        diff_ms: 0,
        diff_first_ms: 0,
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
  let previousTime = 0;
  return rows.map((entry) => {
    if (entry.status !== 'OK') return { ...entry, rank: '-', gap_ms: 0, diff_ms: 0, diff_first_ms: 0 };

    const rankedEntry = {
      ...entry,
      rank,
      gap_ms: previousTime ? entry.total_time_ms - previousTime : 0,
      diff_ms: bestTime ? entry.total_time_ms - bestTime : 0,
      diff_first_ms: bestTime ? entry.total_time_ms - bestTime : 0,
    };
    previousTime = entry.total_time_ms;
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
  const bestTime = activeRecords.find(hasStageResult)?.total_time_ms || 0;
  return activeRecords.map((record) => {
    const ranked = hasStageResult(record);
    const entry = {
      ...record,
      rank: ranked ? rank : '-',
      diff_ms: ranked && bestTime ? numericMs(record.total_time_ms) - numericMs(bestTime) : 0,
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

function renderPerson(name, regional) {
  return (
    <div>
      <div className="font-black text-neutral-950">{name || '-'}</div>
      <div className="mt-0.5 text-xs font-bold uppercase tracking-wider text-neutral-500">{regional || '-'}</div>
    </div>
  );
}

function carName(entry) {
  return entry.vehicle_name || entry.car || entry.team_name || entry.entrant_name || '-';
}

function formatClock(value) {
  if (!value) return '-';
  return String(value).slice(0, 8);
}

function LeaderboardCard({ entry, resultView }) {
  const isOverall = resultView === 'overall';

  return (
    <article className={`border border-neutral-200 p-4 ${rowClass(entry.status) || 'bg-white'}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-widest text-neutral-500">Rank #{entry.rank}</div>
          <h2 className="mt-1 break-words text-xl font-black text-neutral-950">{entry.driver_name}</h2>
          <p className="text-xs font-bold text-neutral-600">{entry.codriver_name || '-'}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{carName(entry)}</p>
        </div>
        <div className="border border-neutral-300 bg-white px-3 py-2 text-center">
          <div className="text-[9px] font-black uppercase text-neutral-500">No</div>
          <div className="text-2xl font-black text-neutral-950">{entry.start_number}</div>
        </div>
      </div>
      {isOverall ? (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-neutral-600">
          <MiniMetric label="Total" value={formatMs(entry.total_time_ms)} highlight />
          <MiniMetric label="Diff 1st" value={entry.diff_first_ms ? `+${formatMs(entry.diff_first_ms)}` : '-'} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs font-bold text-neutral-600">
          <MiniMetric label="Time" value={formatMs(entry.total_time_ms)} highlight />
          <MiniMetric label="Dif" value={entry.diff_ms ? `+${formatMs(entry.diff_ms)}` : '-'} />
        </div>
      )}
    </article>
  );
}

function MiniMetric({ label, value, highlight = false }) {
  return (
    <div className="bg-neutral-100 p-3">
      <p className="text-[9px] uppercase tracking-widest text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black ${highlight ? 'text-neutral-950' : 'text-neutral-600'}`}>{value}</p>
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
    <div className="flex h-12 items-center justify-center gap-2 border border-neutral-300 bg-white px-4">
      <span className={`h-2.5 w-2.5 rounded-full ${config[0]}`} />
      <span className="text-xs font-black uppercase tracking-widest text-neutral-950">{config[1]}</span>
    </div>
  );
}

function rowClass(status) {
  if (status === 'DNF') return 'bg-orange-50';
  if (status === 'DNS') return 'bg-yellow-50';
  if (status === 'DSQ') return 'bg-red-50';
  return '';
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
