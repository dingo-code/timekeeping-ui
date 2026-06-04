import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import Modal from '../../components/Modal';

export default function KamarHitung() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuthStore((state) => state);

  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [penalties, setPenalties] = useState([]); 
  const [records, setRecords] = useState([]); 
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedSS, setSelectedSS] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // State Modal Penalti
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedPenaltyId, setSelectedPenaltyId] = useState('');

  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  // State Modal Edit Waktu
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ start_time: '', finish_time: '' });

  useEffect(() => {
    fetchEvents();
  }, []);

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
    
    if (eventId) {
      try {
        const [resStages, resPenalties] = await Promise.all([
          api.get(`/events/${eventId}/stages`),
          api.get(`/timekeeping/events/${eventId}/penalties`)
        ]);
        setStages(resStages.data.data || []);
        setPenalties(resPenalties.data.data || []);
      } catch (err) { alert('Gagal memuat SS dan Penalti.'); }
    }
  };

  const handleSSChange = (e) => {
    const ssId = e.target.value;
    setSelectedSS(ssId);
    if (ssId) fetchRecords(ssId);
  };

  const fetchRecords = async (ssId) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/timekeeping/stages/${ssId}/records`);
      setRecords(res.data.data || []);
    } catch (e) {
      console.error('Gagal memuat data record timekeeping');
    } finally {
      setIsLoading(false);
    }
  };

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
    } catch (err) {
      alert('Gagal membatalkan penalti');
    }
  };

  const handleSetStatus = async (recordId, newStatus) => {
    if (!window.confirm(`Ubah status peserta ini menjadi ${newStatus}?`)) return;
    try {
      await api.put(`/timekeeping/ss-records/${recordId}/status`, { status: newStatus });
      fetchRecords(selectedSS);
    } catch (e) {
      alert('Gagal merubah status');
    }
  };

  // ==========================================
  // HANDLER EDIT WAKTU
  // ==========================================
  const openEditModal = (record) => {
    setSelectedRecord(record);
    setEditForm({
      start_time: record.start_time || '',
      finish_time: record.finish_time || ''
    });
    setIsEditModalOpen(true);
  };

  const submitEditTime = async (e) => {
    e.preventDefault();
    try {
      // Kita manfaatkan endpoint POST pencatatan waktu yang otomatis melakukan UPDATE jika data sudah ada
      await api.post('/timekeeping/ss-records', {
        ss_id: selectedRecord.ss_id,
        participant_id: selectedRecord.participant_id,
        start_time: editForm.start_time,
        finish_time: editForm.finish_time
      });
      alert('Waktu berhasil dikoreksi!');
      setIsEditModalOpen(false);
      fetchRecords(selectedSS);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengedit waktu');
    }
  };

  // Helper Format Milidetik
  const formatTime = (ms) => {
    if (!ms || ms === 0) return "-";
    const minutes = Math.floor(ms / 60000).toString().padStart(2, '0');
    const seconds = ((ms % 60000) / 1000).toFixed(3).padStart(6, '0');
    return `${minutes}:${seconds}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight uppercase">🖥️ Kamar Hitung <span className="text-red-600">Control</span></h1>
          <p className="text-xs text-gray-500 font-bold uppercase mt-1">Petugas: {role?.replace('_', ' ')}</p>
        </div>
        <div className="flex gap-4 items-center">
          <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50" value={selectedEvent} onChange={handleEventChange}>
            <option value="">-- PILIH EVENT --</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50 disabled:opacity-50" value={selectedSS} onChange={handleSSChange} disabled={!selectedEvent}>
            <option value="">-- PILIH SS --</option>
            {stages.map(s => <option key={s.id} value={s.id}>SS {s.ss_order} : {s.ss_name}</option>)}
          </select>
          
          <button onClick={() => { logout(); navigate('/login'); }} className="text-xs font-bold text-gray-500 hover:text-red-600 transition">LOGOUT</button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {!selectedSS ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-20">
            <span className="text-6xl mb-4">⏱️</span>
            <h2 className="text-xl font-bold">Menunggu Pilihan SS</h2>
            <p className="text-sm">Pilih Event dan Special Stage di atas untuk melihat data masuk.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-700">Data Pencatatan Waktu (Live)</h2>
              <button onClick={() => fetchRecords(selectedSS)} className="text-xs px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded font-bold transition">🔄 Refresh</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-center border-b">No Pintu</th>
                    <th className="p-3 border-b">Peserta</th>
                    <th className="p-3 border-b text-center">Waktu Start</th>
                    <th className="p-3 border-b text-center">Waktu Finish</th>
                    <th className="p-3 border-b text-center text-blue-600">Elapsed</th>
                    <th className="p-3 border-b text-center text-red-600">Penalty</th>
                    <th className="p-3 border-b text-center text-green-700 font-black">Total Waktu</th>
                    <th className="p-3 border-b text-center">Status</th>
                    <th className="p-3 border-b text-right">Aksi Kamar Hitung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? <tr><td colSpan="9" className="p-10 text-center text-gray-500 font-bold animate-pulse">Memuat data...</td></tr> : 
                   records.length === 0 ? <tr><td colSpan="9" className="p-10 text-center text-gray-400 italic">Belum ada data masuk dari pos lapangan untuk SS ini.</td></tr> :
                   records.map((r) => (
                    // 👉 2. BUNGKUS DENGAN REACT FRAGMENT AGAR BISA ADA 2 TR (Baris Utama & Baris Dropdown)
                    <Fragment key={r.id}>
                    <tr key={r.id} className="hover:bg-gray-50 transition">
                      <td className="p-3 text-center">
                        <span className="bg-black text-white font-black px-2 py-1 rounded">{r.start_number}</span>
                      </td>
                      <td className="p-3 font-bold text-gray-800">
                        {r.driver_name} <br/> <span className="text-xs text-gray-500 font-normal">{r.team_name}</span>
                      </td>
                      <td className="p-3 text-center font-mono text-gray-600">{r.start_time || '-'}</td>
                      <td className="p-3 text-center font-mono text-gray-600">{r.finish_time || '-'}</td>
                      <td className="p-3 text-center font-mono text-blue-600 font-bold bg-blue-50/30">{formatTime(r.elapsed_time_ms)}</td>
                      <td className="p-3 text-center font-mono text-red-600 font-bold bg-red-50/30">
                          {r.penalty_time_ms > 0 ? (
                            <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => toggleRow(r.id)}>
                              <span>+{formatTime(r.penalty_time_ms)}</span>
                              <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded hover:bg-red-300">
                                {expandedRow === r.id ? '▲' : '▼'}
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                      <td className="p-3 text-center font-mono text-green-700 font-black bg-green-50/30 text-base">{formatTime(r.total_time_ms)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${r.status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      
                      {/* KOLOM AKSI DIPERBARUI */}
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {r.status === 'OK' && (
                          <>
                            <button onClick={() => openEditModal(r)} className="text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition">EDIT ✏️</button>
                            
                            {/* 1. TOMBOL + PENALTI SELALU MUNCUL AGAR BISA DITUMPUK */}
                            <button onClick={() => openPenaltyModal(r)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition">+ PENALTI</button>
                            
                            {/* 2. TOMBOL RESET HANYA MUNCUL JIKA SUDAH ADA PENALTI */}
                            {r.penalty_time_ms > 0 && (
                              <button onClick={() => handleClearPenalty(r.id)} className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition">RESET ❌</button>
                            )}
                            
                            <button onClick={() => handleSetStatus(r.id, 'DNF')} className="text-xs font-bold text-white bg-gray-800 hover:bg-black px-2 py-1 rounded transition">DNF</button>
                          </>
                        )}
                        {r.status !== 'OK' && (
                          <button onClick={() => handleSetStatus(r.id, 'OK')} className="text-xs font-bold text-gray-500 hover:text-green-600 border border-gray-300 px-2 py-1 rounded transition">BATAL DNF</button>
                        )}
                      </td>
                    </tr>
                    {expandedRow === r.id && r.penalty_details && r.penalty_details.length > 0 && (
                        <tr className="bg-red-50/50 border-b border-gray-200">
                          <td colSpan="9" className="px-6 py-3">
                            <div className="bg-white border border-red-200 rounded p-3 shadow-inner">
                              <p className="text-xs font-bold text-red-800 mb-2 border-b border-red-100 pb-1">📜 Rincian Penalti Mobil #{r.start_number}:</p>
                              <ul className="space-y-1">
                                {r.penalty_details.map((pd, idx) => (
                                  <li key={idx} className="text-xs flex justify-between text-gray-700">
                                    <span>• {pd.name}</span>
                                    <span className="font-mono text-red-600 font-bold">+{formatTime(pd.time_ms)}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
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

      {/* MODAL EDIT WAKTU (BARU) */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Koreksi Waktu Manual">
        <form onSubmit={submitEditTime} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-2">Koreksi waktu untuk Mobil <strong>#{selectedRecord?.start_number} ({selectedRecord?.driver_name})</strong></p>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">WAKTU START (Format: 08:15:30.000)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-600 font-mono"
              value={editForm.start_time}
              onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
              placeholder="00:00:00.000"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">WAKTU FINISH (Format: 08:15:30.000)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-600 font-mono"
              value={editForm.finish_time}
              onChange={(e) => setEditForm({...editForm, finish_time: e.target.value})}
              placeholder="00:00:00.000"
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
            <p className="text-xs text-yellow-800">⚠️ Sistem akan menghitung ulang <b>Elapsed Time</b> secara otomatis jika Anda menyimpan perubahan ini.</p>
          </div>

          <button type="submit" className="w-full py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition">Simpan Koreksi</button>
        </form>
      </Modal>

    </div>
  );
}