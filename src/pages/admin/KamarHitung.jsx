import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import Modal from '../../components/Modal';
import { formatClockCentiseconds, formatMs } from '../../utils/timeFormat';
import { compactTCPenaltyRemark } from '../../utils/tcDisplay';

export default function KamarHitung() {
  const navigate = useNavigate();
  const { role, logout, eventId: assignedEventId, eventName: assignedEventName } = useAuthStore((state) => state);

  const [events, setEvents] = useState([]);
  const [controlMode, setControlMode] = useState('ss');
  const [stages, setStages] = useState([]);
  const [practices, setPractices] = useState([]);
  const [practiceRuns, setPracticeRuns] = useState([]);
  const [penalties, setPenalties] = useState([]); 
  const [records, setRecords] = useState([]); 
  const [restartRequests, setRestartRequests] = useState([]);
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedSS, setSelectedSS] = useState('');
  const [selectedPractice, setSelectedPractice] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');

  // State Modal Penalti
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedPenaltyId, setSelectedPenaltyId] = useState('');
  const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
  const [restartReason, setRestartReason] = useState('');

  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  const selectedStage = stages.find((stage) => stage.id === selectedSS) || null;
  const selectedEventData = events.find((event) => event.id === selectedEvent) || null;
  const timeDecimalPlaces = selectedEventData?.time_decimal_places ?? 2;
  const stageLabel = (stage) => `${stage?.is_shakedown ? `Shakedown : ${stage.ss_name}` : `SS ${stage.ss_order} : ${stage.ss_name}`}${stage?.is_open === false ? ' (CLOSE)' : ''}`;

  const [timeDrafts, setTimeDrafts] = useState({});
  const [savingTimeCell, setSavingTimeCell] = useState('');
  const [practiceDrafts, setPracticeDrafts] = useState({});
  const [savingPracticeRun, setSavingPracticeRun] = useState('');

  useEffect(() => {
    fetchEvents();
    // Data awal hanya dimuat satu kali; event petugas berasal dari sesi login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSS) return;
    fetchRecords(selectedSS);
    fetchRestartRequests(selectedSS);
    const timer = setInterval(() => {
      fetchRecords(selectedSS, true);
      fetchRestartRequests(selectedSS);
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedSS]);

  useEffect(() => {
    if (!selectedPractice) return;
    fetchPracticeRuns(selectedPractice);
    const timer = setInterval(() => fetchPracticeRuns(selectedPractice, true), 3000);
    return () => clearInterval(timer);
  }, [selectedPractice]);

  async function fetchEvents() {
    try {
      const res = await api.get('/events');
      const nextEvents = res.data.data || [];
      setEvents(nextEvents);
      if (role !== 'admin' && assignedEventId) await loadEvent(assignedEventId);
    } catch { console.error('Gagal memuat event'); }
  }

  async function loadEvent(eventId) {
    setSelectedEvent(eventId);
    setSelectedSS('');
    setSelectedPractice('');
    setRecordSearch('');
    setRecords([]);
    setRestartRequests([]);
    setPractices([]);
    setPracticeRuns([]);
    setPracticeDrafts({});
    
    if (eventId) {
      try {
        const [resStages, resPenalties, resPractices] = await Promise.all([
          api.get(`/events/${eventId}/stages`),
          api.get(`/timekeeping/events/${eventId}/penalties`),
          api.get(`/practices/events/${eventId}`)
        ]);
        setStages(resStages.data.data || []);
        setPenalties(resPenalties.data.data || []);
        setPractices(resPractices.data.data || []);
      } catch { alert('Gagal memuat SS, Practice, dan Penalti.'); }
    }
  }

  const handleEventChange = (e) => loadEvent(e.target.value);

  const handleSSChange = (e) => {
    const ssId = e.target.value;
    setRecordSearch('');
    setSelectedSS(ssId);
  };

  const handlePracticeChange = (e) => {
    setRecordSearch('');
    setPracticeDrafts({});
    setSelectedPractice(e.target.value);
  };

  async function fetchPracticeRuns(practiceId, silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.get(`/practices/${practiceId}/runs`);
      setPracticeRuns(res.data.data || []);
    } catch (err) {
      if (!silent) alert(err.response?.data?.error || 'Gagal memuat run Practice.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function fetchRecords(ssId, silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.get(`/timekeeping/stages/${ssId}/records`);
      setRecords(res.data.data || []);
    } catch {
      console.error('Gagal memuat data record timekeeping');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function fetchRestartRequests(ssId) {
    if (!ssId) return;
    try {
      const res = await api.get(`/timekeeping/stages/${ssId}/restart-requests`);
      setRestartRequests(res.data.data || []);
    } catch {
      console.error('Gagal memuat permintaan restart');
    }
  }

  // ==========================================
  // HANDLER PENALTI & STATUS
  // ==========================================
  const openPenaltyModal = (record) => {
    setSelectedRecord(record);
    setSelectedPenaltyId('');
    setIsPenaltyModalOpen(true);
  };

  const submitPenalty = async (e) => {
    e.preventDefault();
    if (!selectedPenaltyId) return alert('Pilih jenis penalti!');

    try {
      await api.post(`/timekeeping/ss-records/${selectedRecord.id}/penalties`, {
        penalty_id: selectedPenaltyId
      });
      alert('Penalti berhasil ditambahkan!');
      setIsPenaltyModalOpen(false);
      fetchRecords(selectedSS); 
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menambahkan penalti');
    }
  };

  const handleClearPenalty = async (recordId) => {
    if (!window.confirm('Batalkan dan Hapus semua penalti untuk catatan waktu ini?')) return;
    try {
      await api.delete(`/timekeeping/ss-records/${recordId}/penalties`);
      alert('Penalti berhasil dibatalkan!');
      fetchRecords(selectedSS);
    } catch {
      alert('Gagal membatalkan penalti');
    }
  };

  const parseManualPenaltyTimeMs = (value) => {
    const normalized = String(value || '').trim().replace(',', '.');
    if (!normalized) return 0;

    const parts = normalized.split(':');
    const parsePart = (part) => Number(part);
    let totalSeconds;

    if (parts.length === 1) {
      const seconds = parsePart(parts[0]);
      if (!Number.isFinite(seconds) || seconds <= 0) return 0;
      totalSeconds = seconds;
    } else if (parts.length === 2) {
      const minutes = parsePart(parts[0]);
      const seconds = parsePart(parts[1]);
      if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes < 0 || seconds < 0 || seconds >= 60) return 0;
      totalSeconds = minutes * 60 + seconds;
    } else if (parts.length === 3) {
      const hours = parsePart(parts[0]);
      const minutes = parsePart(parts[1]);
      const seconds = parsePart(parts[2]);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds) || hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return 0;
      totalSeconds = hours * 3600 + minutes * 60 + seconds;
    } else {
      return 0;
    }

    return Math.round(totalSeconds * 1000);
  };

  const requestManualBWTMTime = (status) => {
    const dnsNote = status === 'DNS' ? '\nUntuk DNS, sistem tetap menambahkan penalti DNS 1 pos otomatis setelah waktu ini.' : '';
    const value = window.prompt(
      `BWTM otomatis tidak bisa dihitung karena tidak ada pembanding waktu tercepat di class ini.\n\nMasukkan waktu BWTM manual.\nContoh: 05:30.00 atau 1:05:30.00.${dnsNote}`
    );
    if (value === null) return 0;

    const manualMs = parseManualPenaltyTimeMs(value);
    if (manualMs <= 0) {
      alert('Format waktu manual tidak valid. Gunakan contoh 05:30.00 atau 1:05:30.00');
      return 0;
    }
    return manualMs;
  };

  const handleSetStatus = async (recordId, newStatus, manualElapsedTimeMs = 0) => {
    if (!manualElapsedTimeMs && !window.confirm(`Ubah status peserta ini menjadi ${newStatus}?`)) return;
    try {
      await api.put(`/timekeeping/ss-records/${recordId}/status`, {
        status: newStatus,
        manual_elapsed_time_ms: manualElapsedTimeMs,
      });
      fetchRecords(selectedSS);
    } catch (e) {
      const errorMessage = e.response?.data?.error || 'Gagal merubah status';
      const needsManualBWTM = ['DNF', 'BWTM', 'DNS'].includes(newStatus) && errorMessage.toLowerCase().includes('belum ada waktu tercepat');
      if (!manualElapsedTimeMs && needsManualBWTM) {
        const manualMs = requestManualBWTMTime(newStatus);
        if (manualMs > 0) {
          await handleSetStatus(recordId, newStatus, manualMs);
        }
        return;
      }
      alert(errorMessage);
    }
  };

  const openRestartModal = (record) => {
    setSelectedRecord(record);
    setRestartReason('');
    setIsRestartModalOpen(true);
  };

  const submitRestart = async (e) => {
    e.preventDefault();
    if (!restartReason.trim()) return alert('Alasan restart wajib diisi.');
    if (!window.confirm(`Berikan restart untuk mobil #${selectedRecord?.start_number}? Attempt lama akan menjadi histori.`)) return;

    try {
      await api.post(`/timekeeping/ss-records/${selectedRecord.id}/restart`, {
        reason: restartReason.trim()
      });
      alert('Restart diberikan. Petugas start/finish bisa input ulang mobil ini.');
      setIsRestartModalOpen(false);
      fetchRecords(selectedSS);
      fetchRestartRequests(selectedSS);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memberikan restart');
    }
  };

  const approveRestartRequest = async (request) => {
    if (!window.confirm(`Setujui permintaan restart mobil #${request.start_number}?`)) return;
    try {
      await api.post(`/timekeeping/restart-requests/${request.id}/approve`);
      alert('Permintaan restart disetujui. Attempt baru sudah dibuat.');
      setRestartRequests((prev) => prev.filter((item) => item.id !== request.id));
      fetchRecords(selectedSS);
      fetchRestartRequests(selectedSS);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyetujui permintaan restart');
    }
  };

  const rejectRestartRequest = async (request) => {
    if (!window.confirm(`Tolak permintaan restart mobil #${request.start_number}?`)) return;
    try {
      await api.post(`/timekeeping/restart-requests/${request.id}/reject`);
      alert('Permintaan restart ditolak.');
      setRestartRequests((prev) => prev.filter((item) => item.id !== request.id));
      fetchRestartRequests(selectedSS);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menolak permintaan restart');
    }
  };

  const getJoinedByStartNumbers = (record) => records
    .filter((item) => Number(item.join_car_with_start_number) === Number(record.start_number))
    .map((item) => item.start_number)
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b));

  const getTimeDraftValue = (record, field) => timeDrafts[record.id]?.[field] ?? record[field] ?? '';

  const updateTimeDraft = (recordId, field, value) => {
    setTimeDrafts((current) => ({
      ...current,
      [recordId]: {
        ...(current[recordId] || {}),
        [field]: value,
      },
    }));
  };

  const clearTimeDraft = (recordId) => {
    setTimeDrafts((current) => {
      const next = { ...current };
      delete next[recordId];
      return next;
    });
  };

  const saveInlineTime = async (record, field) => {
    const cellKey = `${record.id}:${field}`;
    if (savingTimeCell === cellKey) return;

    const draft = timeDrafts[record.id] || {};
    const payload = {
      id: record.id,
      ss_id: record.ss_id,
      participant_id: record.participant_id,
      tc_time: draft.tc_time ?? record.tc_time ?? '',
      start_time: draft.start_time ?? record.start_time ?? '',
      finish_time: draft.finish_time ?? record.finish_time ?? '',
      force_update: true,
    };
    if (String(payload[field] || '').trim() === String(record[field] || '').trim()) {
      clearTimeDraft(record.id);
      return;
    }

    setSavingTimeCell(cellKey);
    try {
      await api.post('/timekeeping/ss-records', payload);
      clearTimeDraft(record.id);
      fetchRecords(selectedSS, true);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengedit waktu');
    } finally {
      setSavingTimeCell('');
    }
  };

  const handleTimeInputKeyDown = (event, record, field) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      updateTimeDraft(record.id, field, record[field] || '');
      event.currentTarget.blur();
    }
  };

  const renderEditableTimeCell = (record, field, displayValue, placeholder) => {
    const cellKey = `${record.id}:${field}`;
    const canEdit = record.is_active && record.status === 'OK';
    return (
      <input
        type="text"
        disabled={!canEdit || savingTimeCell === cellKey}
        className={`w-28 rounded border px-2 py-1 text-center font-mono text-xs font-semibold outline-none transition ${
          canEdit
            ? 'border-transparent bg-transparent hover:border-blue-200 hover:bg-blue-50 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-200'
            : 'border-transparent bg-transparent text-gray-400'
        } ${savingTimeCell === cellKey ? 'border-amber-300 bg-amber-50 text-amber-700' : ''}`}
        value={getTimeDraftValue(record, field)}
        onChange={(event) => updateTimeDraft(record.id, field, event.target.value)}
        onBlur={() => saveInlineTime(record, field)}
        onKeyDown={(event) => handleTimeInputKeyDown(event, record, field)}
        placeholder={displayValue || placeholder}
        title={canEdit ? 'Klik untuk koreksi waktu' : 'Hanya record aktif OK yang bisa diedit inline'}
      />
    );
  };

  const normalizedRecordSearch = recordSearch.trim().toLowerCase();
  const filteredRecords = normalizedRecordSearch
    ? records.filter((record) => [
        record.start_number,
        record.driver_name,
        record.codriver_name,
        record.team_name,
        record.class_name,
        record.status,
        record.attempt_no ? `attempt ${record.attempt_no}` : '',
        record.attempt_no ? `#${record.attempt_no}` : '',
        record.join_car_with_start_number ? `join car with ${record.join_car_with_start_number}` : '',
        getJoinedByStartNumbers(record).length ? `joined by ${getJoinedByStartNumbers(record).join(' ')}` : '',
      ].join(' ').toLowerCase().includes(normalizedRecordSearch))
    : records;

  const filteredPracticeRuns = normalizedRecordSearch
    ? practiceRuns.filter((run) => [run.practice_start_number, run.race_start_number, run.driver_name, run.run_no, run.status].join(' ').toLowerCase().includes(normalizedRecordSearch))
    : practiceRuns;

  const practiceDraftValue = (run, field) => practiceDrafts[run.id]?.[field] ?? run[field] ?? '';

  const updatePracticeDraft = (runId, field, value) => {
    setPracticeDrafts((current) => ({ ...current, [runId]: { ...(current[runId] || {}), [field]: value } }));
  };

  const savePracticeRun = async (run) => {
    if (savingPracticeRun) return;
    const draft = practiceDrafts[run.id] || {};
    setSavingPracticeRun(run.id);
    try {
      await api.put(`/practices/${selectedPractice}/runs/${run.id}`, {
        start_time: draft.start_time ?? run.start_time ?? '',
        finish_time: draft.finish_time ?? run.finish_time ?? '',
        status: draft.status ?? run.status ?? 'OK',
        notes: draft.notes ?? run.notes ?? '',
      });
      setPracticeDrafts((current) => { const next = { ...current }; delete next[run.id]; return next; });
      await fetchPracticeRuns(selectedPractice, true);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memperbarui run Practice.');
    } finally {
      setSavingPracticeRun('');
    }
  };

  const deletePracticeRun = async (run) => {
    if (!window.confirm(`Hapus Practice No ${run.practice_start_number}, Run ${run.run_no} milik ${run.driver_name}? Data ini tidak dapat dikembalikan.`)) return;
    try {
      await api.delete(`/practices/${selectedPractice}/runs/${run.id}`);
      await fetchPracticeRuns(selectedPractice, true);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus run Practice.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight uppercase">🖥️ Kamar Hitung <span className="text-red-600">Control</span></h1>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">Petugas: {role?.replace('_', ' ')}</p>
        </div>
        <div className="flex gap-4 items-center">
          <select className="p-2 border border-red-300 rounded-lg text-sm font-black outline-none focus:ring-1 focus:ring-red-500 bg-red-50 text-red-700" value={controlMode} onChange={(event) => { setControlMode(event.target.value); setRecordSearch(''); }}>
            <option value="ss">SPECIAL STAGE</option>
            <option value="practice">PRACTICE</option>
          </select>
          {role === 'admin' ? (
            <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50" value={selectedEvent} onChange={handleEventChange}>
              <option value="">-- PILIH EVENT --</option>
              {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          ) : (
            <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${assignedEventId ? 'border-gray-300 bg-gray-50 text-gray-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {assignedEventName || selectedEventData?.name || 'EVENT BELUM DITETAPKAN'}
            </div>
          )}

          {controlMode === 'practice' ? <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50 disabled:opacity-50" value={selectedPractice} onChange={handlePracticeChange} disabled={!selectedEvent}>
            <option value="">-- PILIH PRACTICE --</option>
            {practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.name}{practice.is_open ? ' (OPEN)' : ' (CLOSE)'}</option>)}
          </select> : <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50 disabled:opacity-50" value={selectedSS} onChange={handleSSChange} disabled={!selectedEvent}>
            <option value="">-- PILIH STAGE --</option>
            {stages.map(s => <option key={s.id} value={s.id}>{stageLabel(s)}</option>)}
          </select>}
          
          <button onClick={() => { logout(); navigate('/login'); }} className="text-xs font-bold text-gray-500 hover:text-red-600 transition">LOGOUT</button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {controlMode === 'practice' ? (
          !selectedPractice ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-20"><span className="text-6xl mb-4">🏁</span><h2 className="text-xl font-bold">Menunggu Pilihan Practice</h2><p className="text-sm">Pilih Event dan sesi Practice untuk mengolah waktu peserta.</p></div>
          ) : (
            <PracticeRunManager
              runs={filteredPracticeRuns}
              totalRuns={practiceRuns.length}
              search={recordSearch}
              onSearch={setRecordSearch}
              isLoading={isLoading}
              draftValue={practiceDraftValue}
              onDraftChange={updatePracticeDraft}
              onSave={savePracticeRun}
              onDelete={deletePracticeRun}
              savingRun={savingPracticeRun}
              timeDecimalPlaces={timeDecimalPlaces}
            />
          )
        ) : !selectedSS ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-20">
            <span className="text-6xl mb-4">⏱️</span>
            <h2 className="text-xl font-bold">Menunggu Pilihan SS</h2>
            <p className="text-sm">Pilih Event dan Special Stage di atas untuk melihat data masuk.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-bold text-gray-700">Data Pencatatan Waktu (Live) {selectedStage ? `- ${stageLabel(selectedStage)}` : ''}</h2>
                <p className="mt-1 text-xs font-semibold text-gray-500">{filteredRecords.length} dari {records.length} record tampil.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                <input
                  type="search"
                  value={recordSearch}
                  onChange={(event) => setRecordSearch(event.target.value)}
                  placeholder="Cari no start, entrant, driver, class, status..."
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500 sm:w-80"
                />
                <span className="whitespace-nowrap rounded bg-green-100 px-3 py-2 text-xs font-black uppercase tracking-wide text-green-700">Live auto-refresh</span>
              </div>
            </div>
            
            <RestartRequestPanel
              requests={restartRequests}
              onApprove={approveRestartRequest}
              onReject={rejectRestartRequest}
              timeDecimalPlaces={timeDecimalPlaces}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-left border-collapse text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-center border-b">No Start</th>
                    <th className="p-3 border-b text-center">Attempt</th>
                    <th className="p-3 border-b">Entrant</th>
                    <th className="p-3 border-b">Driver / Navigator</th>
                    <th className="p-3 border-b text-center">Class</th>
                    <th className="p-3 border-b text-center">TC</th>
                    <th className="p-3 border-b text-center">Waktu Start</th>
                    <th className="p-3 border-b text-center">Waktu Finish</th>
                    <th className="p-3 border-b text-center text-blue-600">Elapsed</th>
                    <th className="p-3 border-b text-center text-red-600">Penalty</th>
                    <th className="p-3 border-b text-center text-green-700 font-black">Total Waktu</th>
                    <th className="p-3 border-b text-center">Status</th>
                    <th className="w-44 p-3 border-b text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? <tr><td colSpan="13" className="p-10 text-center text-gray-500 font-bold animate-pulse">Memuat data...</td></tr> :
                   filteredRecords.length === 0 ? <tr><td colSpan="13" className="p-10 text-center text-gray-400 italic">{records.length === 0 ? 'Belum ada data masuk dari pos lapangan untuk SS ini.' : 'Tidak ada record yang cocok dengan pencarian.'}</td></tr> :
                   filteredRecords.map((r, rowIndex) => {
                    const joinedByStartNumbers = getJoinedByStartNumbers(r);
                    return (
                    // 👉 2. BUNGKUS DENGAN REACT FRAGMENT AGAR BISA ADA 2 TR (Baris Utama & Baris Dropdown)
                    <Fragment key={r.id}>
                    <tr key={r.id} className={`${rowIndex % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-100 hover:bg-gray-200'} transition-colors ${!r.is_active ? 'text-gray-500' : ''}`}>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="bg-black text-white font-black px-2 py-1 rounded">{r.start_number}</span>
                          {Number(r.join_car_with_start_number) > 0 && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Join car with #{r.join_car_with_start_number}
                            </span>
                          )}
                          {joinedByStartNumbers.length > 0 && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              Joined by #{joinedByStartNumbers.join(', #')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-black text-gray-800">#{r.attempt_no || 1}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                            {r.is_active ? 'Aktif' : 'Histori'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-xs font-bold uppercase tracking-wider text-gray-500">{r.team_name || '-'}</td>
                      <td className="p-3 font-bold text-gray-800">
                        {r.driver_name}
                        <br />
                        <span className="text-xs text-gray-500 font-normal">{r.codriver_name || '-'}</span>
                        {!r.is_active && r.restart_reason && (
                          <div className="mt-1 text-[11px] font-semibold text-orange-700 bg-orange-50 inline-block px-2 py-1 rounded">
                            Restart: {r.restart_reason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center text-xs font-black uppercase text-gray-700">{r.class_name || '-'}</td>
                      <td className="p-3 text-center font-mono text-gray-600">
                        {renderEditableTimeCell(r, 'tc_time', formatClockHourMinute(r.tc_time), 'HH:MM:SS')}
                      </td>
                      <td className="p-3 text-center font-mono text-gray-600">
                        {renderEditableTimeCell(r, 'start_time', formatClockHourMinute(r.start_time), 'HH:MM:SS.00')}
                      </td>
                      <td className="p-3 text-center font-mono text-gray-600">
                        {renderEditableTimeCell(r, 'finish_time', formatClockCentiseconds(r.finish_time, timeDecimalPlaces), 'HH:MM:SS.00')}
                      </td>
                      <td className="p-3 text-center font-mono text-blue-600 font-bold bg-blue-50/30">{formatMs(r.elapsed_time_ms, timeDecimalPlaces)}</td>
                      <td className="p-3 text-center font-mono text-red-600 font-bold bg-red-50/30">
                          {r.penalty_time_ms > 0 ? (
                            <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => toggleRow(r.id)}>
                              <span>+{formatMs(r.penalty_time_ms, timeDecimalPlaces)}</span>
                              <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded hover:bg-red-300">
                                {expandedRow === r.id ? '▲' : '▼'}
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                      <td className="p-3 text-center font-mono text-green-700 font-black bg-green-50/30 text-base">
                        <div>{formatMs(r.total_time_ms, timeDecimalPlaces)}</div>
                        {(r.status === 'BWTM' || r.status === 'DNS') && Number(r.total_time_ms) > 0 && (
                          <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-500">{r.status === 'DNS' ? 'BWTM + 1 POS' : 'BWTM'}</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${r.status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      
                      {/* KOLOM AKSI DIPERBARUI */}
                      <td className="w-44 p-2 align-top">
                        {r.is_active && r.status === 'OK' && (
                          <div className="ml-auto grid w-40 grid-cols-2 gap-1 [&_button]:min-h-8 [&_button]:whitespace-normal [&_button]:px-1.5 [&_button]:py-1 [&_button]:text-[10px] [&_button]:font-black [&_button]:leading-tight">
                            {/* 1. TOMBOL + PENALTI SELALU MUNCUL AGAR BISA DITUMPUK */}
                            <button onClick={() => openPenaltyModal(r)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition">+ PENALTI</button>
                            
                            {/* 2. TOMBOL RESET HANYA MUNCUL JIKA SUDAH ADA PENALTI */}
                            {r.penalty_time_ms > 0 && (
                              <button onClick={() => handleClearPenalty(r.id)} className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition">RESET ❌</button>
                            )}
                            
                            <button onClick={() => handleSetStatus(r.id, 'DNF')} className="text-xs font-bold text-white bg-gray-800 hover:bg-black px-2 py-1 rounded transition">DNF</button>
                            <button onClick={() => handleSetStatus(r.id, 'BWTM')} className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 px-2 py-1 rounded transition">BWTM</button>
                            <button onClick={() => handleSetStatus(r.id, 'DNS')} className="text-xs font-bold text-white bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded transition">DNS</button>
                            {!r.is_shakedown && (
                              <button onClick={() => openRestartModal(r)} className="text-xs font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded transition">RESTART</button>
                            )}
                          </div>
                        )}
                        {r.is_active && r.status !== 'OK' && (
                          <button onClick={() => handleSetStatus(r.id, 'OK')} className="ml-auto block w-40 rounded border border-gray-300 px-2 py-1.5 text-[10px] font-black uppercase text-gray-500 transition hover:text-green-600">Batal Status</button>
                        )}
                        {!r.is_active && (
                          <span className="block text-center text-xs font-bold text-gray-400">Histori attempt</span>
                        )}
                      </td>
                    </tr>
                    {expandedRow === r.id && r.penalty_details && r.penalty_details.length > 0 && (
                        <tr className="bg-red-50/50 border-b border-gray-200">
                          <td colSpan="13" className="px-6 py-3">
                            <div className="bg-white border border-red-200 rounded p-3 shadow-inner">
                              <p className="text-xs font-bold text-red-800 mb-2 border-b border-red-100 pb-1">📜 Rincian Penalti Mobil #{r.start_number}:</p>
                              <ul className="space-y-1">
                                {r.penalty_details.map((pd, idx) => (
                                  <li key={idx} className="text-xs flex justify-between text-gray-700">
                                    <span>• {compactTCPenaltyRemark(pd.name, selectedStage?.ss_order)}</span>
                                    <span className="font-mono text-red-600 font-bold">+{formatMs(pd.time_ms, timeDecimalPlaces)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL TAMBAH PENALTI */}
      <Modal isOpen={isPenaltyModalOpen} onClose={() => setIsPenaltyModalOpen(false)} title="Berikan Penalti">
        <form onSubmit={submitPenalty} className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-4">Berikan penalti untuk Mobil <strong>#{selectedRecord?.start_number} ({selectedRecord?.driver_name})</strong></p>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Pilih Pelanggaran</label>
            <select required className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-red-600" value={selectedPenaltyId} onChange={e => setSelectedPenaltyId(e.target.value)}>
              <option value="" disabled>-- Pilih Regulasi Penalti --</option>
              {penalties.map(p => (
                <option key={p.id} value={p.id}>{p.name} (+{p.penalty_time_ms / 1000} Detik)</option>
              ))}
            </select>
          </div>
          <button type="submit" className="w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest text-xs hover:bg-black transition">Terapkan Penalti</button>
        </form>
      </Modal>

      {/* MODAL RESTART */}
      <Modal isOpen={isRestartModalOpen} onClose={() => setIsRestartModalOpen(false)} title="Berikan Restart">
        <form onSubmit={submitRestart} className="p-6 space-y-4">
          <div className="bg-orange-50 border border-orange-200 p-3 rounded">
            <p className="text-sm text-orange-800">
              Mobil <strong>#{selectedRecord?.start_number} ({selectedRecord?.driver_name})</strong> akan dibuatkan attempt baru.
              Attempt lama tetap tersimpan sebagai histori dan tidak dipakai untuk leaderboard.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Alasan Restart</label>
            <textarea
              required
              rows="3"
              className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-orange-600 text-sm"
              value={restartReason}
              onChange={(e) => setRestartReason(e.target.value)}
              placeholder="Contoh: Terhalang kendaraan yang mengalami insiden di km 4.2"
            />
          </div>
          <button type="submit" className="w-full py-3 bg-orange-600 text-white font-black uppercase tracking-widest text-xs hover:bg-black transition">Setujui Restart</button>
        </form>
      </Modal>

    </div>
  );
}

function PracticeRunManager({ runs, totalRuns, search, onSearch, isLoading, draftValue, onDraftChange, onSave, onDelete, savingRun, timeDecimalPlaces }) {
  return <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b bg-gray-50 p-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-black text-gray-800">Pengolahan Waktu Practice</h2><p className="mt-1 text-xs font-semibold text-gray-500">{runs.length} dari {totalRuns} run tampil. Elapsed dihitung ulang otomatis saat disimpan.</p></div><div className="flex items-center gap-2"><input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Cari nomor, driver, run, status..." className="h-9 w-72 rounded-lg border border-gray-300 px-3 text-sm font-semibold outline-none focus:border-red-500"/><span className="rounded bg-green-100 px-3 py-2 text-xs font-black uppercase text-green-700">Live auto-refresh</span></div></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] border-collapse text-sm"><thead className="bg-gray-100 text-xs uppercase tracking-wider text-gray-600"><tr><th className="p-3 text-center">Practice No</th><th className="p-3 text-center">Race No</th><th className="p-3 text-left">Driver</th><th className="p-3 text-center">Run</th><th className="p-3 text-center">Waktu Start</th><th className="p-3 text-center">Waktu Finish</th><th className="p-3 text-center text-blue-600">Elapsed</th><th className="p-3 text-center">Status</th><th className="p-3">Catatan</th><th className="p-3 text-center">Aksi</th></tr></thead>
      <tbody className="divide-y divide-gray-100">{isLoading ? <tr><td colSpan="10" className="p-10 text-center font-bold text-gray-500">Memuat data...</td></tr> : runs.length === 0 ? <tr><td colSpan="10" className="p-10 text-center italic text-gray-400">Belum ada run Practice pada sesi ini.</td></tr> : runs.map((run, index) => <tr key={run.id} className={index % 2 ? 'bg-gray-50' : 'bg-white'}>
        <td className="p-3 text-center"><span className="rounded bg-red-600 px-3 py-1 font-black text-white">{run.practice_start_number}</span></td><td className="p-3 text-center font-black text-gray-700">{run.race_start_number}</td><td className="p-3 font-bold text-gray-800">{run.driver_name || '-'}</td><td className="p-3 text-center font-black">Run {run.run_no}</td>
        <td className="p-3 text-center"><input value={draftValue(run, 'start_time')} onChange={(event) => onDraftChange(run.id, 'start_time', event.target.value)} placeholder="HH:MM:SS.00" className="w-32 rounded border border-gray-300 px-2 py-1.5 text-center font-mono text-xs outline-none focus:border-blue-500" /></td>
        <td className="p-3 text-center"><input value={draftValue(run, 'finish_time')} onChange={(event) => onDraftChange(run.id, 'finish_time', event.target.value)} placeholder="HH:MM:SS.00" className="w-32 rounded border border-gray-300 px-2 py-1.5 text-center font-mono text-xs outline-none focus:border-blue-500" /></td>
        <td className="bg-blue-50/40 p-3 text-center font-mono font-bold text-blue-700">{formatMs(run.elapsed_time_ms, timeDecimalPlaces)}</td>
        <td className="p-3 text-center"><select value={draftValue(run, 'status') || 'OK'} onChange={(event) => onDraftChange(run.id, 'status', event.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-xs font-black"><option value="OK">OK</option><option value="DNF">DNF</option><option value="DNS">DNS</option><option value="DSQ">DSQ</option></select></td>
        <td className="p-3"><input value={draftValue(run, 'notes')} onChange={(event) => onDraftChange(run.id, 'notes', event.target.value)} placeholder="Catatan opsional" className="w-44 rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" /></td>
        <td className="p-3"><div className="flex justify-center gap-1"><button type="button" disabled={savingRun === run.id} onClick={() => onSave(run)} className="rounded bg-blue-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-blue-700 disabled:opacity-50">{savingRun === run.id ? 'Menyimpan' : 'Update'}</button><button type="button" disabled={Boolean(savingRun)} onClick={() => onDelete(run)} className="rounded bg-red-100 px-3 py-2 text-[10px] font-black uppercase text-red-700 hover:bg-red-200 disabled:opacity-50">Hapus</button></div></td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}

function formatClockHourMinute(value) {
  if (!value) return '-';
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  return `${match[1]}:${match[2]}`;
}

function RestartRequestPanel({ requests, onApprove, onReject, timeDecimalPlaces = 2 }) {
  const pendingRequests = (requests || []).filter((request) => request.status === 'PENDING');
  if (pendingRequests.length === 0) return null;

  const pendingCount = pendingRequests.length;

  return (
    <div className="border-b border-orange-100 bg-orange-50/70 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-orange-900">Laporan Permintaan Restart</h3>
          <p className="text-xs font-semibold text-orange-700">{pendingCount} permintaan menunggu persetujuan Kamar Hitung.</p>
        </div>
      </div>
      <div className="space-y-2">
        {pendingRequests.map((request) => (
          <div key={request.id} className="rounded-lg border border-orange-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-black px-2 py-1 text-xs font-black text-white">#{request.start_number}</span>
                  <span className="font-black text-gray-800">{request.driver_name}</span>
                  <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${restartRequestStatusClass(request.status)}`}>
                    {request.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-700">{request.reason}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-gray-500">
                  <span>Attempt #{request.attempt_no || 1}</span>
                  <span>Start {request.start_time || '-'}</span>
                  <span>Finish {formatClockCentiseconds(request.finish_time, timeDecimalPlaces)}</span>
                  <span>Pengaju: {request.requested_by || '-'}</span>
                </div>
              </div>
              {request.status === 'PENDING' && (
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => onApprove(request)} className="rounded bg-orange-600 px-3 py-2 text-xs font-black uppercase text-white hover:bg-orange-700">
                    Setujui
                  </button>
                  <button onClick={() => onReject(request)} className="rounded bg-gray-200 px-3 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-300">
                    Tolak
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function restartRequestStatusClass(status) {
  if (status === 'PENDING') return 'bg-yellow-100 text-yellow-800';
  if (status === 'APPROVED') return 'bg-green-100 text-green-700';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
}
