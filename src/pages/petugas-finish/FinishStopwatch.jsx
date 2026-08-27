import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { formatClockCentiseconds, formatMs } from '../../utils/timeFormat';

export default function FinishStopwatch() {
  const navigate = useNavigate();
  const { eventId, eventName, logout } = useAuthStore((state) => state);
  const [sessionMode, setSessionMode] = useState('ss');
  const [event, setEvent] = useState(null);
  const [stages, setStages] = useState([]);
  const [practices, setPractices] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [participants, setParticipants] = useState([]);
  const [records, setRecords] = useState([]);
  const [practiceEntries, setPracticeEntries] = useState([]);
  const [practiceRuns, setPracticeRuns] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [savingId, setSavingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const selectedStage = stages.find((stage) => stage.id === selectedStageId);
  const selectedPractice = practices.find((practice) => practice.id === selectedStageId);
  const selectedSession = sessionMode === 'practice' ? selectedPractice : selectedStage;
  const decimalPlaces = event?.time_decimal_places ?? 2;

  useEffect(() => {
    if (!eventId) return;
    Promise.all([api.get('/events'), api.get(`/events/${eventId}/stages`), api.get(`/events/${eventId}/participants`), api.get(`/practices/events/${eventId}`)])
      .then(([eventResponse, stageResponse, participantResponse, practiceResponse]) => {
        setEvent((eventResponse.data.data || []).find((item) => item.id === eventId) || null);
        setStages(stageResponse.data.data || []);
        setParticipants(participantResponse.data.data || []);
        setPractices(practiceResponse.data.data || []);
      })
      .catch((error) => setMessage(error.response?.data?.error || 'Gagal memuat data event.'));
  }, [eventId]);

  useEffect(() => {
    if (!selectedStageId) return;
    localStorage.setItem(captureStorageKey(selectedStageId), JSON.stringify(captures));
  }, [captures, selectedStageId]);

  useEffect(() => {
    const handleShortcut = (keyboardEvent) => {
      if (!selectedStageId || selectedSession?.is_open === false || keyboardEvent.repeat || isEditableTarget(keyboardEvent.target)) return;
      if (keyboardEvent.code !== 'Space' && keyboardEvent.code !== 'F8') return;
      keyboardEvent.preventDefault();
      captureFinish();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });

  async function fetchRecords(stageId = selectedStageId) {
    if (!stageId) return;
    setLoading(true);
    try {
      const response = await api.get(`/timekeeping/stages/${stageId}/records`);
      setRecords(response.data.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Gagal memuat data SS.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPracticeData(practiceId = selectedStageId) {
    if (!practiceId) return;
    setLoading(true);
    try {
      const [entryResponse, runResponse] = await Promise.all([
        api.get(`/practices/${practiceId}/entries`),
        api.get(`/practices/${practiceId}/runs`),
      ]);
      setPracticeEntries(entryResponse.data.data || []);
      setPracticeRuns(runResponse.data.data || []);
    } catch (error) {
      setMessage(error.response?.data?.error || 'Gagal memuat data Practice.');
    } finally {
      setLoading(false);
    }
  }

  function changeStage(stageId) {
    setMessage('');
    setSelectedStageId(stageId);
    setCaptures(stageId ? readCapturedRows(stageId) : []);
    setRecords([]);
    setPracticeEntries([]);
    setPracticeRuns([]);
    if (stageId) {
      if (sessionMode === 'practice') fetchPracticeData(stageId);
      else fetchRecords(stageId);
    }
  }

  function changeMode(mode) {
    setSessionMode(mode);
    setSelectedStageId('');
    setCaptures([]);
    setRecords([]);
    setPracticeEntries([]);
    setPracticeRuns([]);
    setMessage('');
  }

  function captureFinish() {
    const finishTime = currentFinishClock();
    setCaptures((current) => [{ id: crypto.randomUUID(), finish_time: finishTime, start_number: '', status: 'pending' }, ...current]);
    setMessage(`Finish ${finishTime} tertangkap. Masukkan nomor start pada baris teratas.`);
  }

  function updateStartNumber(id, value) {
    setCaptures((current) => current.map((row) => row.id === id ? { ...row, start_number: value, error: '' } : row));
  }

  async function assignParticipant(row) {
    const startNumber = Number(row.start_number);
    if (!Number.isInteger(startNumber) || startNumber < 1) return markRowError(row.id, 'Nomor start tidak valid.');

    if (sessionMode === 'practice') {
      return assignPracticeParticipant(row, startNumber);
    }

    const participant = participants.find((item) => Number(item.start_number) === startNumber);
    if (!participant) return markRowError(row.id, `Nomor start #${startNumber} tidak ditemukan di Entry List.`);
    const activeRecord = sessionMode === 'shakedown' ? findOpenRecord(records, startNumber) : findActiveRecord(records, startNumber);
    if (!activeRecord?.start_time) return markRowError(row.id, `Start #${startNumber} belum tercatat. Refresh atau periksa ke Pos Start.`);
    if (sessionMode !== 'shakedown' && activeRecord.finish_time) return markRowError(row.id, `Finish #${startNumber} sudah tercatat. Koreksi melalui Kamar Hitung.`);
    if (sessionMode === 'ss' && captures.some((item) => item.id !== row.id && item.status === 'saved' && Number(item.start_number) === startNumber)) return markRowError(row.id, `Nomor #${startNumber} sudah dipakai pada capture lain.`);

    setSavingId(row.id);
    try {
      await api.post('/timekeeping/ss-records', { ss_id: selectedStageId, participant_id: participant.id, finish_time: row.finish_time });
      const response = await api.get(`/timekeeping/stages/${selectedStageId}/records`);
      const nextRecords = response.data.data || [];
      setRecords(nextRecords);
      const savedRecord = sessionMode === 'shakedown'
        ? findLatestFinishedRecord(nextRecords, startNumber)
        : findActiveRecord(nextRecords, startNumber);
      setCaptures((current) => current.map((item) => item.id === row.id ? { ...item, status: 'saved', record_id: savedRecord?.id || '', error: '' } : item));
      setMessage(`Finish mobil #${startNumber} berhasil disimpan.`);
    } catch (error) {
      markRowError(row.id, error.response?.data?.error || 'Gagal menyimpan waktu Finish.');
    } finally {
      setSavingId('');
    }
  }

  async function assignPracticeParticipant(row, practiceNumber) {
    const entry = practiceEntries.find((item) => Number(item.practice_start_number) === practiceNumber && item.is_active !== false);
    if (!entry) return markRowError(row.id, `Nomor Practice #${practiceNumber} tidak ditemukan pada sesi ini.`);
    const openRun = findOpenPracticeRun(practiceRuns, practiceNumber);
    if (!openRun) return markRowError(row.id, `Nomor Practice #${practiceNumber} belum memiliki Start yang menunggu Finish.`);
    setSavingId(row.id);
    try {
      await api.post('/timekeeping/practice-runs/finish', { practice_id: selectedStageId, practice_start_number: practiceNumber, time: row.finish_time });
      const runResponse = await api.get(`/practices/${selectedStageId}/runs`);
      const nextRuns = runResponse.data.data || [];
      setPracticeRuns(nextRuns);
      const savedRun = findLatestFinishedPracticeRun(nextRuns, practiceNumber);
      setCaptures((current) => current.map((item) => item.id === row.id ? { ...item, status: 'saved', record_id: savedRun?.id || '', error: '' } : item));
      setMessage(`Finish Practice #${practiceNumber}, Run ${savedRun?.run_no || '-'} berhasil disimpan.`);
    } catch (error) {
      markRowError(row.id, error.response?.data?.error || 'Gagal menyimpan Finish Practice.');
    } finally {
      setSavingId('');
    }
  }

  function markRowError(id, error) {
    setCaptures((current) => current.map((row) => row.id === id ? { ...row, error } : row));
  }

  function removePending(id) {
    setCaptures((current) => current.filter((row) => row.id !== id || row.status === 'saved'));
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const rows = useMemo(() => captures.map((capture) => ({
    ...capture,
    record: capture.status === 'saved'
      ? (sessionMode === 'practice'
          ? findPracticeRun(practiceRuns, capture.record_id, capture.start_number)
          : findCapturedStageRecord(records, capture.record_id, capture.start_number, sessionMode))
      : null,
    entry: sessionMode === 'practice' && capture.status === 'saved' ? practiceEntries.find((item) => Number(item.practice_start_number) === Number(capture.start_number)) : null,
  })), [captures, records, practiceEntries, practiceRuns, sessionMode]);
  const sessionOptions = sessionMode === 'practice'
    ? practices
    : stages.filter((stage) => sessionMode === 'shakedown' ? stage.is_shakedown : !stage.is_shakedown);
  const sessionTitle = sessionMode === 'practice'
    ? selectedPractice?.name
    : selectedStage ? `${selectedStage.is_shakedown ? 'Shakedown' : `SS ${selectedStage.ss_order}`} · ${selectedStage.ss_name}` : '';

  if (!eventId) return <MissingAssignment onLogout={handleLogout} />;

  return <div className="flex min-h-screen flex-col bg-gray-100">
    <header className="border-b border-gray-200 bg-white px-5 py-4 shadow-sm"><div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-600">Compactindo Race Control</p><h1 className="mt-1 text-xl font-black uppercase text-gray-900">Finish Stopwatch</h1><p className="mt-1 text-xs font-bold text-gray-500">{eventName || event?.name || 'Event'}</p></div><div className="flex flex-wrap items-center gap-2"><select value={sessionMode} onChange={(changeEvent) => changeMode(changeEvent.target.value)} className="h-10 rounded-lg border border-red-300 bg-red-50 px-3 text-sm font-black text-red-700 outline-none"><option value="ss">SPECIAL STAGE</option><option value="shakedown">SHAKEDOWN</option><option value="practice">PRACTICE</option></select><select value={selectedStageId} onChange={(changeEvent) => changeStage(changeEvent.target.value)} className="h-10 min-w-64 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm font-black outline-none focus:border-red-500"><option value="">-- PILIH SESI --</option>{sessionOptions.map((session) => <option key={session.id} value={session.id}>{sessionMode === 'practice' ? session.name : sessionMode === 'shakedown' ? `Shakedown · ${session.ss_name}` : `SS ${session.ss_order} · ${session.ss_name}`}{session.is_open ? ' (OPEN)' : ' (CLOSE)'}</option>)}</select><button type="button" onClick={() => sessionMode === 'practice' ? fetchPracticeData() : fetchRecords()} disabled={!selectedStageId || loading} className="h-10 rounded-lg border border-gray-300 px-4 text-xs font-black uppercase text-gray-700 hover:bg-gray-50 disabled:opacity-40">Refresh</button><button type="button" onClick={handleLogout} className="h-10 rounded-lg bg-gray-900 px-4 text-xs font-black uppercase text-white hover:bg-red-700">Logout</button></div></div></header>

    <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 p-4 lg:p-6">
      <section className="grid gap-3 lg:grid-cols-[1fr_auto]"><div className={`rounded-xl border p-4 ${selectedSession?.is_open === false ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}><p className="text-xs font-black uppercase tracking-widest text-gray-500">Sesi Aktif · {sessionMode}</p><p className="mt-1 text-xl font-black text-gray-900">{sessionTitle || 'Pilih sesi untuk mulai'}</p>{selectedSession?.is_open === false && <p className="mt-1 text-xs font-black text-red-600">SESI CLOSE — CAPTURE DIKUNCI</p>}</div><button type="button" onClick={captureFinish} disabled={!selectedStageId || selectedSession?.is_open === false} className="min-h-20 rounded-xl bg-red-600 px-10 text-lg font-black uppercase tracking-wider text-white shadow-lg shadow-red-200 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"><span className="block">Capture Finish</span><span className="mt-1 block text-[10px] tracking-widest text-red-100">SPACE / F8</span></button></section>

      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{message}</div>}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-4 py-3"><div><h2 className="font-black text-gray-800">Capture Finish · {sessionMode === 'practice' ? 'Practice' : sessionMode === 'shakedown' ? 'Shakedown' : 'Special Stage'}</h2><p className="mt-1 text-xs text-gray-500">Tidak live · data sesi diperbarui hanya saat Refresh atau setelah nomor disimpan.</p></div><div className="flex gap-2 text-[10px] font-black uppercase"><span className="rounded bg-amber-100 px-3 py-1.5 text-amber-700">{rows.filter((row) => row.status !== 'saved').length} belum diberi nomor</span><span className="rounded bg-green-100 px-3 py-1.5 text-green-700">{rows.filter((row) => row.status === 'saved').length} tersimpan</span></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1250px] border-collapse text-sm"><thead className="bg-gray-900 text-xs uppercase tracking-wider text-gray-300"><tr><th className="p-3 text-center">{sessionMode === 'practice' ? 'Practice No' : 'No Start'}</th><th className="p-3 text-left">Driver / Navigator</th><th className="p-3 text-left">Entrant</th><th className="p-3 text-center">Class</th><th className="p-3 text-center">TC</th><th className="p-3 text-center">Start</th><th className="p-3 text-center text-red-300">Finish Capture</th><th className="p-3 text-center text-green-300">Total Time</th><th className="p-3 text-center">Status</th><th className="p-3 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-gray-100">{!selectedStageId ? <tr><td colSpan="10" className="p-16 text-center text-gray-400">Pilih sesi untuk mulai menangkap waktu Finish.</td></tr> : rows.length === 0 ? <tr><td colSpan="10" className="p-16 text-center text-gray-400">Tekan SPACE atau F8 saat kendaraan melewati garis Finish.</td></tr> : rows.map((row, index) => <FinishCaptureRow key={row.id} row={row} mode={sessionMode} index={index} decimalPlaces={decimalPlaces} saving={savingId === row.id} onNumberChange={updateStartNumber} onAssign={assignParticipant} onRemove={removePending} />)}</tbody></table></div>
      </section>
    </main>
  </div>;
}

function FinishCaptureRow({ row, mode, index, decimalPlaces, saving, onNumberChange, onAssign, onRemove }) {
  const record = row.record;
  const detail = mode === 'practice' ? row.entry : record;
  const saved = row.status === 'saved';
  const totalTime = mode === 'practice' ? record?.elapsed_time_ms : record?.total_time_ms;
  return <tr className={`${index % 2 ? 'bg-gray-50' : 'bg-white'} ${row.error ? 'bg-red-50' : ''}`}><td className="p-3 text-center align-top"><input autoFocus={index === 0 && !saved} type="number" min="1" disabled={saved || saving} value={row.start_number} onChange={(event) => onNumberChange(row.id, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onAssign(row); } }} placeholder="NO" className={`w-24 rounded-lg border-2 px-2 py-2 text-center text-xl font-black outline-none ${saved ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-300 bg-white focus:border-red-600'}`} />{row.error && <p className="mt-2 max-w-44 text-left text-[10px] font-bold leading-tight text-red-600">{row.error}</p>}</td><td className="p-3 align-top"><p className="font-black text-gray-900">{detail?.driver_name || '-'}</p><p className="mt-0.5 text-xs font-semibold text-gray-500">{detail?.codriver_name || '-'}</p>{mode === 'practice' && record?.run_no && <p className="mt-1 text-[10px] font-black uppercase text-red-600">Run {record.run_no}</p>}</td><td className="p-3 text-xs font-bold uppercase text-gray-500">{mode === 'practice' ? detail?.entrant_name || '-' : detail?.team_name || '-'}</td><td className="p-3 text-center text-xs font-black text-gray-600">{detail?.class_name || '-'}</td><td className="p-3 text-center font-mono font-semibold text-gray-600">{mode === 'ss' ? record?.tc_time || '-' : '-'}</td><td className="p-3 text-center font-mono font-semibold text-gray-600">{record?.start_time || '-'}</td><td className="bg-red-50/60 p-3 text-center font-mono text-base font-black text-red-700">{formatClockCentiseconds(row.finish_time, decimalPlaces)}</td><td className="bg-green-50/60 p-3 text-center font-mono text-base font-black text-green-700">{record ? formatMs(totalTime, decimalPlaces) : '-'}</td><td className="p-3 text-center"><span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${saved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{saved ? record?.status || 'Tersimpan' : 'Menunggu No'}</span></td><td className="p-3 text-center">{saved ? <span className="text-[10px] font-black uppercase text-gray-400">Terkunci</span> : <div className="flex justify-center gap-1"><button type="button" disabled={saving || !row.start_number} onClick={() => onAssign(row)} className="rounded bg-green-600 px-3 py-2 text-[10px] font-black uppercase text-white hover:bg-green-700 disabled:opacity-40">{saving ? 'Menyimpan' : 'Simpan'}</button><button type="button" disabled={saving} onClick={() => onRemove(row.id)} className="rounded bg-gray-200 px-3 py-2 text-[10px] font-black uppercase text-gray-600 hover:bg-red-100 hover:text-red-700">Hapus</button></div>}</td></tr>;
}

function currentFinishClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const cc = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');
  return `${hh}:${mm}:${ss}.${cc}`;
}

function findActiveRecord(records, startNumber) {
  return records
    .filter((record) => Number(record.start_number) === Number(startNumber) && record.is_active !== false)
    .sort((a, b) => Number(b.attempt_no || 0) - Number(a.attempt_no || 0))[0] || null;
}

function findOpenRecord(records, startNumber) {
  return records
    .filter((record) => Number(record.start_number) === Number(startNumber) && record.is_active !== false && record.start_time && !record.finish_time)
    .sort((a, b) => Number(b.attempt_no || 0) - Number(a.attempt_no || 0))[0] || null;
}

function findLatestFinishedRecord(records, startNumber) {
  return records
    .filter((record) => Number(record.start_number) === Number(startNumber) && record.is_active !== false && record.finish_time)
    .sort((a, b) => Number(b.attempt_no || 0) - Number(a.attempt_no || 0))[0] || null;
}

function findCapturedStageRecord(records, recordId, startNumber, mode) {
  return records.find((record) => record.id === recordId)
    || (mode === 'shakedown' ? findLatestFinishedRecord(records, startNumber) : findActiveRecord(records, startNumber));
}

function findOpenPracticeRun(runs, practiceNumber) {
  return runs
    .filter((run) => Number(run.practice_start_number) === Number(practiceNumber) && run.start_time && !run.finish_time && run.status === 'OK')
    .sort((a, b) => Number(b.run_no || 0) - Number(a.run_no || 0))[0] || null;
}

function findLatestFinishedPracticeRun(runs, practiceNumber) {
  return runs
    .filter((run) => Number(run.practice_start_number) === Number(practiceNumber) && run.finish_time)
    .sort((a, b) => Number(b.run_no || 0) - Number(a.run_no || 0))[0] || null;
}

function findPracticeRun(runs, recordId, practiceNumber) {
  return runs.find((run) => run.id === recordId) || findLatestFinishedPracticeRun(runs, practiceNumber);
}

function captureStorageKey(stageId) { return `compactindo:finish-stopwatch:${stageId}`; }
function readCapturedRows(stageId) {
  try { const value = JSON.parse(localStorage.getItem(captureStorageKey(stageId)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
}
function isEditableTarget(target) { return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target?.tagName) || target?.isContentEditable; }

function MissingAssignment({ onLogout }) {
  return <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6 text-center"><div className="max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-sm"><h1 className="text-xl font-black text-gray-900">Event belum ditetapkan</h1><p className="mt-2 text-sm text-gray-500">Hubungi admin untuk menghubungkan user Petugas Finish ke event.</p><button type="button" onClick={onLogout} className="mt-5 rounded bg-gray-900 px-5 py-2 text-xs font-black uppercase text-white">Logout</button></div></div>;
}
