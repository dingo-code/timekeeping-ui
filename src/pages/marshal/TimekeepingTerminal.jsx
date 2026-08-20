import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { formatClockCentiseconds } from '../../utils/timeFormat';

export default function TimekeepingTerminal() {
  const navigate = useNavigate();
  
  // Mengambil role dari Global State (Zustand)
  const role = useAuthStore((state) => state.role); 
  const logout = useAuthStore((state) => state.logout);
  
  const isStarter = role === 'petugas_start';
  const isFinisher = role === 'petugas_finish';
  const isTCOfficer = role === 'petugas_tc';
  
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [participants, setParticipants] = useState([]); 
  const [records, setRecords] = useState([]);
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedSS, setSelectedSS] = useState('');
  const selectedEventData = events.find((event) => event.id === selectedEvent) || null;
  const timeDecimalPlaces = selectedEventData?.time_decimal_places ?? 2;
  
  // State Input Lapangan (Manual Input)
  const [startNumber, setStartNumber] = useState('');
  const [manualTime, setManualTime] = useState(''); // Menyimpan waktu yang diketik manual
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellingStart, setIsCancellingStart] = useState(false);
  const [isRequestingRestart, setIsRequestingRestart] = useState(false);
  const [restartReason, setRestartReason] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState('');

  useEffect(() => {
    if (role === 'admin' || role === 'kamar_hitung') {
      alert('Terminal Lapangan hanya untuk Petugas Start dan Finish.');
      navigate('/admin'); 
    } else {
      fetchEvents();
    }
  }, [role, navigate]);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      setEvents(res.data.data || []);
    } catch (e) { console.error('Gagal memuat event'); }
  };

  const handleEventChange = async (e) => {
    const eventId = e.target.value;
    setSelectedEvent(eventId);
    setSelectedSS('');
    setRecords([]);
    setStatusMessage('');
    setRestartReason('');
    
    if (eventId) {
      try {
        const [resStages, resParticipants] = await Promise.all([
          api.get(`/events/${eventId}/stages`),
          api.get(`/events/${eventId}/participants`)
        ]);
        setStages(resStages.data.data || []);
        setParticipants(resParticipants.data.data || []);
      } catch (err) { alert('Gagal memuat data pendukung event ini.'); }
    }
  };

  const fetchRecords = async (ssId) => {
    if (!ssId) return [];
    try {
      const res = await api.get(`/timekeeping/stages/${ssId}/records`);
      const nextRecords = res.data.data || [];
      setRecords(nextRecords);
      setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour12: false }));
      return nextRecords;
    } catch (e) {
      console.error('Gagal memuat status record SS');
      return records;
    }
  };

  useEffect(() => {
    if (!selectedSS) return;

    fetchRecords(selectedSS);
    const timer = setInterval(() => {
      fetchRecords(selectedSS);
    }, 3000);

    return () => clearInterval(timer);
  }, [selectedSS]);

  useEffect(() => {
    if (!selectedSS || !startNumber) return;
    fetchRecords(selectedSS);
  }, [selectedSS, startNumber]);

  const handleSSChange = async (e) => {
    const ssId = e.target.value;
    setSelectedSS(ssId);
    setStartNumber('');
    setManualTime('');
    setStatusMessage('');
    setRestartReason('');
    await fetchRecords(ssId);
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getParticipantIdByStartNumber = (number) => {
    const p = participants.find(p => p.start_number.toString() === number.toString());
    return p ? p.id : null;
  };

  const getParticipantByStartNumber = (number) => {
    return participants.find(p => p.start_number.toString() === number.toString()) || null;
  };

  const getRecordsByStartNumber = (number, sourceRecords = records) => {
    return sourceRecords
      .filter(r => r.start_number.toString() === number.toString() && r.is_active !== false)
      .sort((a, b) => (Number(b.attempt_no) || 0) - (Number(a.attempt_no) || 0));
  };

  const getActiveRecordByStartNumber = (number, sourceRecords = records) => {
    return getRecordsByStartNumber(number, sourceRecords)[0] || null;
  };

  const getOpenShakedownRecordByStartNumber = (number, sourceRecords = records) => {
    return getRecordsByStartNumber(number, sourceRecords).find(r => r.start_time && !r.finish_time) || null;
  };

  const selectedStage = stages.find(stage => stage.id === selectedSS) || null;
  const isShakedownStage = Boolean(selectedStage?.is_shakedown);
  const isStageClosed = selectedStage?.is_open === false;
  const stageLabel = (stage) => `${stage?.is_shakedown ? `Shakedown : ${stage.ss_name}` : `SS ${stage.ss_order} : ${stage.ss_name}`}${stage?.is_open === false ? ' (CLOSE)' : ''}`;
  const selectedParticipant = startNumber ? getParticipantByStartNumber(startNumber) : null;
  const activeRecord = startNumber ? getActiveRecordByStartNumber(startNumber) : null;
  const openShakedownRecord = startNumber ? getOpenShakedownRecordByStartNumber(startNumber) : null;
  const displayRecord = isShakedownStage ? (openShakedownRecord || activeRecord) : activeRecord;
  const hasKnownStartNumber = !startNumber || Boolean(selectedParticipant);
  const startAlreadyRecorded = Boolean(displayRecord?.start_time);
  const finishAlreadyRecorded = Boolean(displayRecord?.finish_time);
  const tcAlreadyRecorded = Boolean(activeRecord?.tc_time);
  const canCorrectStart = isStarter && !isShakedownStage && startAlreadyRecorded && !finishAlreadyRecorded && activeRecord?.id && activeRecord.status === 'OK';
  const canSubmitStart = isStarter && hasKnownStartNumber && (isShakedownStage || !activeRecord || !startAlreadyRecorded || canCorrectStart);
  const canSubmitFinish = isFinisher && hasKnownStartNumber && (isShakedownStage ? Boolean(openShakedownRecord) : !finishAlreadyRecorded);
  const canSubmitTC = isTCOfficer && !isShakedownStage && hasKnownStartNumber;
  const usesMinuteOnlyInput = isStarter || isTCOfficer;
  const timeDigits = manualTime.replace(/\D/g, '');
  const maxTimeDigits = usesMinuteOnlyInput ? 4 : 8;
  const expectedTimeDigits = usesMinuteOnlyInput ? '4 digit, contoh 0815' : '6 atau 8 digit, contoh 081530 atau 08153045';
  const timeInputLabel = isStarter ? 'Waktu Start' : isFinisher ? 'Waktu Finish' : 'Waktu TC';
  const quickExamples = usesMinuteOnlyInput
    ? ['0815 = 08:15', '1340 = 13:40', 'Kirim sebagai HH:mm']
    : ['081530 = 08:15:30', '08153045 = 08:15:30.45', 'Kirim sebagai HH:mm:ss.SS'];

  const formatQuickTimeInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, maxTimeDigits);
    if (usesMinuteOnlyInput) {
      if (digits.length <= 2) return digits;
      return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    }

    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
    if (digits.length <= 6) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
    return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}.${digits.slice(6)}`;
  };

  const isValidTimeParts = (hours, minutes, seconds = '00') => {
    const h = Number(hours);
    const m = Number(minutes);
    const s = Number(seconds);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
  };

  const getManualTimeValidation = () => {
    if (!manualTime) return { isValid: false, message: `Ketik ${expectedTimeDigits}.` };
    if (usesMinuteOnlyInput) {
      if (timeDigits.length !== 4) return { isValid: false, message: `Format belum lengkap. Ketik ${expectedTimeDigits}.` };
      if (!isValidTimeParts(timeDigits.slice(0, 2), timeDigits.slice(2, 4))) return { isValid: false, message: 'Jam atau menit tidak valid.' };
      return { isValid: true, message: 'Format siap dikirim sebagai HH:mm.' };
    }

    if (timeDigits.length < 6) return { isValid: false, message: `Format belum lengkap. Ketik ${expectedTimeDigits}.` };
    if (timeDigits.length === 7) return { isValid: false, message: 'Lengkapi centisecond jadi 8 digit, atau hapus satu digit agar memakai .00.' };
    if (!isValidTimeParts(timeDigits.slice(0, 2), timeDigits.slice(2, 4), timeDigits.slice(4, 6))) return { isValid: false, message: 'Jam, menit, atau detik tidak valid.' };
    return { isValid: true, message: timeDigits.length >= 8 ? 'Format siap dikirim sebagai HH:mm:ss.SS.' : 'Format siap dikirim sebagai HH:mm:ss.00.' };
  };

  const manualTimeValidation = getManualTimeValidation();
  const canSubmit = Boolean(!isStageClosed && startNumber && manualTimeValidation.isValid && (isStarter ? canSubmitStart : isFinisher ? canSubmitFinish : canSubmitTC));

  const normalizeManualTimeForSubmit = () => {
    if (usesMinuteOnlyInput) {
      return `${timeDigits.slice(0, 2)}:${timeDigits.slice(2, 4)}:00`;
    }
    const centiseconds = timeDigits.slice(6, 8).padEnd(2, '0') || '00';
    return `${timeDigits.slice(0, 2)}:${timeDigits.slice(2, 4)}:${timeDigits.slice(4, 6)}.${centiseconds}`;
  };

  const handleManualTimeChange = (e) => {
    setManualTime(formatQuickTimeInput(e.target.value));
  };

  const handleUseCurrentTime = () => {
    const now = new Date();
    const pad2 = (value) => String(value).padStart(2, '0');
    const centiseconds = pad2(Math.floor(now.getMilliseconds() / 10));
    const raw = usesMinuteOnlyInput
      ? `${pad2(now.getHours())}${pad2(now.getMinutes())}`
      : `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}${centiseconds}`;
    setManualTime(formatQuickTimeInput(raw));
  };

  const getInputStatus = () => {
    if (isStageClosed) return { tone: 'danger', text: 'SS sudah close. Petugas pos tidak bisa input atau edit data pada stage ini.' };
    if (!startNumber) return { tone: 'neutral', text: 'Masukkan No Start untuk melihat status attempt aktif.' };
    if (!selectedParticipant) return { tone: 'danger', text: `Mobil #${startNumber} tidak terdaftar di event ini.` };
    if (isStarter && isShakedownStage) return { tone: 'ready', text: `Siap input shakedown run #${(activeRecord?.attempt_no || 0) + 1}.` };
    if (isStarter && canCorrectStart) return { tone: 'warning', text: `Start mobil #${startNumber} sudah tercatat. Petugas start bisa ubah waktu atau cancel selama finish belum tercatat.` };
    if (isStarter && startAlreadyRecorded) return { tone: 'danger', text: `Start mobil #${startNumber} sudah terkunci karena finish/status sudah tercatat. Koreksi lewat Kamar Hitung.` };
    if (isStarter) return { tone: 'ready', text: `Siap input start untuk attempt #${activeRecord?.attempt_no || 1}.` };
    if (isFinisher && isShakedownStage && !openShakedownRecord) return { tone: 'warning', text: `Mobil #${startNumber} belum punya start shakedown yang menunggu finish.` };
    if (isFinisher && !displayRecord?.start_time) return { tone: 'warning', text: `Mobil #${startNumber} belum punya waktu start aktif.` };
    if (isFinisher && finishAlreadyRecorded) return { tone: 'danger', text: `Finish mobil #${startNumber} sudah tercatat. Koreksi hanya lewat Kamar Hitung.` };
    if (isFinisher) return { tone: 'ready', text: `Siap input finish untuk attempt #${displayRecord?.attempt_no || 1}.` };
    if (isTCOfficer && isShakedownStage) return { tone: 'warning', text: 'Shakedown tidak memakai input TC. Gunakan petugas start dan finish untuk mencatat waktu latihan.' };
    if (isTCOfficer && tcAlreadyRecorded) return { tone: 'warning', text: `TC mobil #${startNumber} sudah tercatat. Input ulang akan mengoreksi waktu TC berdasarkan No Start ini.` };
    if (isTCOfficer && !activeRecord?.target_tc_time) return { tone: 'warning', text: `Mobil #${startNumber} belum punya target TC pada SS ini. Input masih bisa dicatat sebagai aktual tanpa target.` };
    if (isTCOfficer) return { tone: 'ready', text: `Target TC mobil #${startNumber}: ${activeRecord.target_tc_time}.` };
    return { tone: 'neutral', text: 'Role terminal tidak dikenali.' };
  };

  const inputStatus = getInputStatus();

  // ==========================================
  // HANDLER SUBMIT (Digunakan oleh Start & Finish)
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isStageClosed) return alert('SS sudah close. Petugas pos tidak bisa input atau edit data pada stage ini.');
    if (!startNumber || !manualTime) return alert('Lengkapi No Start dan Waktu!');
    if (!manualTimeValidation.isValid) return alert(manualTimeValidation.message);
    
    const participantId = getParticipantIdByStartNumber(startNumber);
    if (!participantId) return alert(`Mobil dengan No Start #${startNumber} tidak terdaftar di event ini!`);

    const submittedTime = normalizeManualTimeForSubmit();

    const isStartCorrection = isStarter && !isShakedownStage && startAlreadyRecorded;
    const confirmMsg = isStarter 
      ? `${isStartCorrection ? 'Konfirmasi UBAH START' : 'Konfirmasi START'} Mobil #${startNumber} pada ${manualTime}?`
      : isFinisher
        ? `Konfirmasi FINISH Mobil #${startNumber} pada ${submittedTime}?`
        : `Konfirmasi TC Mobil #${startNumber} pada ${manualTime}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const latestRecords = await fetchRecords(selectedSS);
      const latestActiveRecord = getActiveRecordByStartNumber(startNumber, latestRecords);
      const latestOpenShakedownRecord = getOpenShakedownRecordByStartNumber(startNumber, latestRecords);
      const latestCanCorrectStart = isStarter
        && !isShakedownStage
        && Boolean(latestActiveRecord?.start_time)
        && !latestActiveRecord?.finish_time
        && latestActiveRecord?.status === 'OK';

      if (isStarter && !isShakedownStage && latestActiveRecord?.start_time && !latestCanCorrectStart) {
        return alert(`Start mobil #${startNumber} sudah terkunci karena finish/status sudah tercatat. Koreksi lewat Kamar Hitung.`);
      }
      if (isStarter && latestCanCorrectStart && !isStartCorrection) {
        return alert(`Start mobil #${startNumber} baru saja tercatat di server. Refresh status, lalu ubah/cancel jika memang perlu dikoreksi.`);
      }
      if (isFinisher && isShakedownStage && !latestOpenShakedownRecord) {
        return alert(`Mobil #${startNumber} belum punya start shakedown yang menunggu finish.`);
      }
      if (isFinisher && !isShakedownStage && !latestActiveRecord?.start_time) {
        return alert(`Mobil #${startNumber} belum punya waktu start aktif. Coba refresh status atau pastikan memilih SS yang sama dengan petugas start.`);
      }
      if (isFinisher && !isShakedownStage && latestActiveRecord?.finish_time) {
        return alert(`Finish mobil #${startNumber} sudah tercatat. Koreksi hanya lewat Kamar Hitung.`);
      }
      if (isTCOfficer && isShakedownStage) {
        return alert('Shakedown tidak memakai input TC.');
      }

      if (isTCOfficer) {
        const isCorrection = Boolean(latestActiveRecord?.tc_time);
        await api.post('/timekeeping/tc-records', {
          ss_id: selectedSS,
          participant_id: participantId,
          tc_time: submittedTime,
        });
        setStatusMessage(isCorrection ? `TC mobil #${startNumber} berhasil dikoreksi.` : `TC tersimpan untuk mobil #${startNumber}.`);
        await fetchRecords(selectedSS);
        setStartNumber('');
        setManualTime('');
        return;
      }

      if (latestCanCorrectStart && isStartCorrection) {
        await api.put(`/timekeeping/ss-records/${latestActiveRecord.id}/start-time`, {
          start_time: submittedTime,
        });
        setStatusMessage(`Start mobil #${startNumber} berhasil diubah ke ${submittedTime}.`);
        await fetchRecords(selectedSS);
        setStartNumber('');
        setManualTime('');
        return;
      }

      const payload = {
        ss_id: selectedSS,
        participant_id: participantId,
        status: "OK"
      };

      // Tentukan field mana yang diisi berdasarkan role
      if (isStarter) payload.start_time = submittedTime;
      if (isFinisher) payload.finish_time = submittedTime;
      
      await api.post('/timekeeping/ss-records', payload);
      setStatusMessage(`${isStarter ? 'START' : 'FINISH'} tersimpan untuk mobil #${startNumber}.`);
      await fetchRecords(selectedSS);
      
      // Kosongkan form untuk mobil selanjutnya
      setStartNumber(''); 
      setManualTime('');
    } catch (e) {
      const errorMessage = e.response?.data?.error || 'Gagal mengirim data ke server!';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelStart = async () => {
    if (isStageClosed) return alert('SS sudah close. Petugas pos tidak bisa input atau edit data pada stage ini.');
    if (!canCorrectStart || !activeRecord?.id) return alert('Start belum bisa dibatalkan.');
    if (!window.confirm(`Batalkan waktu START Mobil #${startNumber}? Peserta bisa diinput ulang saat benar-benar siap start.`)) return;

    setIsCancellingStart(true);
    try {
      await api.put(`/timekeeping/ss-records/${activeRecord.id}/start-time`, {
        start_time: '',
      });
      setStatusMessage(`Start mobil #${startNumber} berhasil dibatalkan. Peserta bisa diinput ulang saat siap.`);
      setManualTime('');
      await fetchRecords(selectedSS);
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal membatalkan start.');
    } finally {
      setIsCancellingStart(false);
    }
  };

  const handleRequestRestart = async () => {
    if (isStageClosed) return alert('SS sudah close. Petugas pos tidak bisa input atau edit data pada stage ini.');
    if (!activeRecord?.id) return alert('Data start aktif belum ditemukan.');
    if (!restartReason.trim()) return alert('Alasan permintaan restart wajib diisi.');
    if (!window.confirm(`Kirim permintaan restart untuk mobil #${startNumber} ke Kamar Hitung?`)) return;

    setIsRequestingRestart(true);
    try {
      await api.post(`/timekeeping/ss-records/${activeRecord.id}/restart-requests`, {
        reason: restartReason.trim(),
      });
      setStatusMessage(`Permintaan restart mobil #${startNumber} sudah dikirim ke Kamar Hitung.`);
      setRestartReason('');
      await fetchRecords(selectedSS);
    } catch (e) {
      alert(e.response?.data?.error || 'Gagal mengirim permintaan restart.');
    } finally {
      setIsRequestingRestart(false);
    }
  };

  const displayRole = role ? role.replace('_', ' ').toUpperCase() : 'UNKNOWN';
  const themeColor = isStarter ? 'text-green-500' : isFinisher ? 'text-red-500' : 'text-yellow-400';
  const roleBadgeClass = isStarter
    ? 'bg-green-100 text-green-700'
    : isFinisher
      ? 'bg-red-100 text-red-700'
      : 'bg-yellow-100 text-yellow-800';
  const buttonColor = isStarter
    ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
    : isFinisher
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      : 'bg-yellow-500 hover:bg-yellow-600 text-black focus:ring-yellow-400';
  const submitLabel = isSubmitting
    ? 'MENGIRIM...'
    : canCorrectStart
      ? 'UBAH START'
      : isTCOfficer
        ? (tcAlreadyRecorded ? 'UBAH TC' : 'KIRIM TC')
        : 'KIRIM DATA';

  // ==========================================
  // TAMPILAN SETUP
  // ==========================================
  if (!selectedEvent || !selectedSS) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-black text-center mb-2 text-gray-800 uppercase tracking-widest">SETUP TERMINAL</h1>
          
          <div className="text-center mb-6">
            <span className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${roleBadgeClass}`}>
              Role: {displayRole}
            </span>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Event</label>
              <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-lg font-bold outline-none focus:border-gray-800" value={selectedEvent} onChange={handleEventChange}>
                <option value="">-- Pilih Event --</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Stage</label>
              <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-lg font-bold disabled:opacity-50 outline-none focus:border-gray-800" value={selectedSS} onChange={handleSSChange} disabled={!selectedEvent}>
                <option value="">-- Pilih Stage --</option>
                {stages.map(s => <option key={s.id} value={s.id}>{stageLabel(s)}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-black uppercase tracking-widest text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // TAMPILAN INPUT MANUAL (START & FINISH)
  // ==========================================
  return (
    <div className="min-h-screen bg-black flex flex-col p-4 sm:p-8">
      <header className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-800 mb-8">
        <div>
          <div className={`${themeColor} font-black text-xl tracking-widest`}>
            {isStarter ? 'POS START' : isFinisher ? 'POS FINISH' : 'POS TC'}
          </div>
          <div className="text-gray-400 text-sm font-bold uppercase">{displayRole} {selectedStage ? `- ${stageLabel(selectedStage)}` : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fetchRecords(selectedSS)} className="bg-gray-800 text-white px-3 py-2 rounded font-bold text-xs hover:bg-gray-700 transition">
            REFRESH
          </button>
          <button type="button" onClick={() => setSelectedSS('')} className="bg-gray-800 text-white px-4 py-2 rounded font-bold text-sm hover:bg-gray-700 transition">
            GANTI STAGE
          </button>
          <button type="button" onClick={handleLogout} className="bg-red-700 text-white px-4 py-2 rounded font-bold text-sm hover:bg-red-600 transition">
            LOGOUT
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-2xl space-y-6">
          {isStageClosed && (
            <div className="rounded-xl border border-red-700 bg-red-950/50 p-4 text-center text-sm font-black uppercase tracking-widest text-red-100">
              SS CLOSE - INPUT PETUGAS POS TERKUNCI
            </div>
          )}
          
          <div className="text-center">
            <label className="block text-gray-400 font-bold mb-2 uppercase tracking-widest text-sm">No Start</label>
            <input 
              type="number" 
              required
              disabled={isStageClosed}
              value={startNumber} 
              onChange={e => {
                setStartNumber(e.target.value);
                setStatusMessage('');
              }}
              className="w-full bg-black border-2 border-gray-700 rounded-xl text-center text-6xl font-black text-white p-4 outline-none focus:border-white disabled:opacity-50 transition-colors"
              placeholder="00"
            />
          </div>

          <div className={`rounded-xl border p-4 text-sm ${
            inputStatus.tone === 'ready' ? 'bg-green-950/40 border-green-700 text-green-200' :
            inputStatus.tone === 'warning' ? 'bg-yellow-950/40 border-yellow-700 text-yellow-200' :
            inputStatus.tone === 'danger' ? 'bg-red-950/40 border-red-700 text-red-200' :
            'bg-gray-950 border-gray-700 text-gray-300'
          }`}>
            <div className="font-black uppercase tracking-widest text-xs mb-2">Status Attempt</div>
            <p className="font-semibold">{inputStatus.text}</p>
            {lastSyncedAt && <p className="mt-1 text-[11px] opacity-70">Sinkron terakhir: {lastSyncedAt}</p>}
            {selectedParticipant && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div>Attempt: <span className="font-bold text-white">#{displayRecord?.attempt_no || (isShakedownStage ? 0 : 1)}</span></div>
                <div>Target TC: <span className="font-mono text-white">{displayRecord?.target_tc_time || '-'}</span></div>
                <div>TC: <span className="font-mono text-white">{displayRecord?.tc_time || '-'}</span></div>
                <div>Start: <span className="font-mono text-white">{displayRecord?.start_time || '-'}</span></div>
                <div>Finish: <span className="font-mono text-white">{formatClockCentiseconds(displayRecord?.finish_time, timeDecimalPlaces)}</span></div>
                <div>Status: <span className="font-bold text-white">{displayRecord?.status || 'Belum ada record'}</span></div>
              </div>
            )}
          </div>

          {canCorrectStart && !isStageClosed && (
            <div className="rounded-xl border border-green-700 bg-green-950/40 p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-green-200">Koreksi Start</div>
              <p className="mb-3 text-xs font-semibold text-green-100">
                Jika mobil tertunda sebelum benar-benar start, isi waktu baru lalu kirim. Untuk mengosongkan start dan menunggu jadwal baru, gunakan cancel start.
              </p>
              <button
                type="button"
                onClick={handleCancelStart}
                disabled={isCancellingStart}
                className="w-full rounded-lg border border-green-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-green-100 hover:bg-green-900 disabled:opacity-50"
              >
                {isCancellingStart ? 'MEMBATALKAN...' : 'CANCEL START'}
              </button>
            </div>
          )}

          {isStarter && !isShakedownStage && startAlreadyRecorded && !canCorrectStart && activeRecord?.id && !isStageClosed && (
            <div className="rounded-xl border border-orange-700 bg-orange-950/40 p-4">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-orange-200">Permintaan Restart</div>
              <p className="mb-3 text-xs font-semibold text-orange-100">
                Start mobil ini sudah terkunci. Isi alasan lalu kirim ke Kamar Hitung untuk persetujuan restart.
              </p>
              <textarea
                rows="3"
                value={restartReason}
                onChange={(e) => setRestartReason(e.target.value)}
                className="w-full rounded-lg border border-orange-800 bg-black p-3 text-sm font-semibold text-white outline-none focus:border-orange-400"
                placeholder="Contoh: Terhalang kendaraan insiden di lintasan"
              />
              <button
                type="button"
                onClick={handleRequestRestart}
                disabled={isRequestingRestart}
                className="mt-3 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-black hover:bg-orange-400 disabled:opacity-50"
              >
                {isRequestingRestart ? 'MENGIRIM...' : 'KIRIM PERMINTAAN RESTART'}
              </button>
            </div>
          )}

          {statusMessage && (
            <div className="rounded-xl border border-blue-700 bg-blue-950/40 p-3 text-sm font-bold text-blue-200">
              {statusMessage}
            </div>
          )}

          <div className="text-center">
            <label className="block text-gray-400 font-bold mb-2 uppercase tracking-widest text-sm">
              {timeInputLabel}
            </label>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleUseCurrentTime}
                disabled={isStageClosed}
                className="rounded-lg bg-gray-800 px-3 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-gray-700 disabled:opacity-50"
              >
                JAM SEKARANG
              </button>
              <button
                type="button"
                onClick={() => setManualTime('')}
                disabled={isStageClosed || !manualTime}
                className="rounded-lg border border-gray-700 px-3 py-3 text-xs font-black uppercase tracking-widest text-gray-300 transition hover:bg-gray-800 disabled:opacity-50"
              >
                RESET WAKTU
              </button>
            </div>
            <input 
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              disabled={isStageClosed}
              maxLength={usesMinuteOnlyInput ? 5 : 11}
              value={manualTime} 
              onChange={handleManualTimeChange}
              className="w-full bg-black border-2 border-gray-700 rounded-xl text-center text-4xl font-mono font-bold text-white p-4 outline-none focus:border-white disabled:opacity-50 transition-colors"
              placeholder={usesMinuteOnlyInput ? '0815' : '08153045'}
            />
            <p className={`mt-2 text-xs font-bold ${manualTimeValidation.isValid ? 'text-green-400' : 'text-gray-500'}`}>
              {manualTime ? manualTimeValidation.message : `Ketik angka saja: ${expectedTimeDigits}.`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-black uppercase tracking-wide text-gray-500">
              {quickExamples.map((example) => (
                <span key={example} className="rounded bg-black px-2 py-2">{example}</span>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className={`w-full py-5 ${buttonColor} ${isTCOfficer ? 'text-black' : 'text-white'} font-black text-2xl rounded-xl uppercase tracking-widest shadow-lg disabled:opacity-50 transition-all transform active:scale-95`}
          >
            {submitLabel}
          </button>
          
        </form>
      </main>
    </div>
  );
}
