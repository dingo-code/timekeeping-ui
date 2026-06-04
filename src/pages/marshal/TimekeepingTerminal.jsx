import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function TimekeepingTerminal() {
  const navigate = useNavigate();
  
  // Mengambil role dari Global State (Zustand)
  const role = useAuthStore((state) => state.role); 
  
  const isStarter = role === 'petugas_start';
  const isFinisher = role === 'petugas_finish';
  
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [participants, setParticipants] = useState([]); 
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedSS, setSelectedSS] = useState('');
  
  // State Input Lapangan (Manual Input)
  const [startNumber, setStartNumber] = useState('');
  const [manualTime, setManualTime] = useState(''); // Menyimpan waktu yang diketik manual
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const getParticipantIdByStartNumber = (number) => {
    const p = participants.find(p => p.start_number.toString() === number.toString());
    return p ? p.id : null;
  };

  // ==========================================
  // HANDLER SUBMIT (Digunakan oleh Start & Finish)
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!startNumber || !manualTime) return alert('Lengkapi Nomor Pintu dan Waktu!');
    
    const participantId = getParticipantIdByStartNumber(startNumber);
    if (!participantId) return alert(`Mobil dengan Nomor Pintu #${startNumber} tidak terdaftar di event ini!`);

    // Validasi format waktu sederhana (memastikan ada titik dua dan titik)
    if (!manualTime.includes(':')) {
        return alert('Format waktu tidak valid. Gunakan format HH:mm:ss.SSS (contoh: 08:15:30.000)');
    }

    const confirmMsg = isStarter 
      ? `Konfirmasi START Mobil #${startNumber} pada ${manualTime}?`
      : `Konfirmasi FINISH Mobil #${startNumber} pada ${manualTime}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ss_id: selectedSS,
        participant_id: participantId,
        status: "OK"
      };

      // Tentukan field mana yang diisi berdasarkan role
      if (isStarter) payload.start_time = manualTime;
      if (isFinisher) payload.finish_time = manualTime;
      
      await api.post('/timekeeping/ss-records', payload);
      alert(`Data waktu mobil #${startNumber} berhasil dikirim!`);
      
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

  const displayRole = role ? role.replace('_', ' ').toUpperCase() : 'UNKNOWN';
  const themeColor = isStarter ? 'text-green-500' : 'text-red-500';
  const buttonColor = isStarter ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' : 'bg-red-600 hover:bg-red-700 focus:ring-red-500';

  // ==========================================
  // TAMPILAN SETUP
  // ==========================================
  if (!selectedEvent || !selectedSS) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-black text-center mb-2 text-gray-800 uppercase tracking-widest">SETUP TERMINAL</h1>
          
          <div className="text-center mb-6">
            <span className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isStarter ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
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
              <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Special Stage (SS)</label>
              <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-lg font-bold disabled:opacity-50 outline-none focus:border-gray-800" value={selectedSS} onChange={e => setSelectedSS(e.target.value)} disabled={!selectedEvent}>
                <option value="">-- Pilih SS --</option>
                {stages.map(s => <option key={s.id} value={s.id}>SS {s.ss_order} : {s.ss_name}</option>)}
              </select>
            </div>
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
            {isStarter ? 'POS START' : 'POS FINISH'}
          </div>
          <div className="text-gray-400 text-sm font-bold uppercase">{displayRole}</div>
        </div>
        <button onClick={() => setSelectedSS('')} className="bg-gray-800 text-white px-4 py-2 rounded font-bold text-sm hover:bg-gray-700 transition">
          GANTI SS
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-sm bg-gray-900 p-8 rounded-3xl border border-gray-800 shadow-2xl space-y-6">
          
          <div className="text-center">
            <label className="block text-gray-400 font-bold mb-2 uppercase tracking-widest text-sm">Nomor Pintu Mobil</label>
            <input 
              type="number" 
              required
              value={startNumber} 
              onChange={e => setStartNumber(e.target.value)}
              className="w-full bg-black border-2 border-gray-700 rounded-xl text-center text-6xl font-black text-white p-4 outline-none focus:border-white transition-colors"
              placeholder="00"
            />
          </div>

          <div className="text-center">
            <label className="block text-gray-400 font-bold mb-2 uppercase tracking-widest text-sm">
              {isStarter ? 'Waktu Start' : 'Waktu Finish'}
            </label>
            <input 
              type="text" 
              required
              value={manualTime} 
              onChange={e => setManualTime(e.target.value)}
              className="w-full bg-black border-2 border-gray-700 rounded-xl text-center text-4xl font-mono font-bold text-white p-4 outline-none focus:border-white transition-colors"
              placeholder="08:15:30.000"
            />
            <p className="text-gray-500 text-xs mt-2 italic">Format: HH:mm:ss.SSS</p>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-5 ${buttonColor} text-white font-black text-2xl rounded-xl uppercase tracking-widest shadow-lg disabled:opacity-50 transition-all transform active:scale-95`}
          >
            {isSubmitting ? 'MENGIRIM...' : 'KIRIM DATA'}
          </button>
          
        </form>
      </main>
    </div>
  );
}