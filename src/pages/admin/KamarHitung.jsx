import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import Modal from '../../components/Modal';
import { formatClockCentiseconds, formatMs } from '../../utils/timeFormat';

export default function KamarHitung() {
  const navigate = useNavigate();
  const { user, role, logout } = useAuthStore((state) => state);

  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [penalties, setPenalties] = useState([]); 
  const [records, setRecords] = useState([]); 
  const [restartRequests, setRestartRequests] = useState([]);
  
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedSS, setSelectedSS] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
  const stageLabel = (stage) => stage?.is_shakedown ? `Shakedown : ${stage.ss_name}` : `SS ${stage.ss_order} : ${stage.ss_name}`;

  // State Modal Edit Waktu
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ start_time: '', finish_time: '' });

  useEffect(() => {
    fetchEvents();
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
    setRestartRequests([]);
    
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
  };

  const fetchRecords = async (ssId, silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await api.get(`/timekeeping/stages/${ssId}/records`);
      setRecords(res.data.data || []);
    } catch (e) {
      console.error('Gagal memuat data record timekeeping');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchRestartRequests = async (ssId) => {
    if (!ssId) return;
    try {
      const res = await api.get(`/timekeeping/stages/${ssId}/restart-requests`);
      setRestartRequests(res.data.data || []);
    } catch (e) {
      console.error('Gagal memuat permintaan restart');
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
      alert(e.response?.data?.error || 'Gagal merubah status');
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
        id: selectedRecord.id,
        ss_id: selectedRecord.ss_id,
        participant_id: selectedRecord.participant_id,
        start_time: editForm.start_time,
        finish_time: editForm.finish_time,
        force_update: true
      });
      alert('Waktu berhasil dikoreksi!');
      setIsEditModalOpen(false);
      fetchRecords(selectedSS);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengedit waktu');
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
          <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50" value={selectedEvent} onChange={handleEventChange}>
            <option value="">-- PILIH EVENT --</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          <select className="p-2 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 bg-gray-50 disabled:opacity-50" value={selectedSS} onChange={handleSSChange} disabled={!selectedEvent}>
            <option value="">-- PILIH STAGE --</option>
            {stages.map(s => <option key={s.id} value={s.id}>{stageLabel(s)}</option>)}
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
              <h2 className="font-bold text-gray-700">Data Pencatatan Waktu (Live) {selectedStage ? `- ${stageLabel(selectedStage)}` : ''}</h2>
              <span className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded font-black uppercase tracking-wide">Live auto-refresh</span>
            </div>
            
            <RestartRequestPanel
              requests={restartRequests}
              onApprove={approveRestartRequest}
              onReject={rejectRestartRequest}
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3 text-center border-b">No Start</th>
                    <th className="p-3 border-b text-center">Attempt</th>
                    <th className="p-3 border-b">Peserta</th>
                    <th className="p-3 border-b text-center">TC</th>
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
                  {isLoading ? <tr><td colSpan="11" className="p-10 text-center text-gray-500 font-bold animate-pulse">Memuat data...</td></tr> :
                   records.length === 0 ? <tr><td colSpan="11" className="p-10 text-center text-gray-400 italic">Belum ada data masuk dari pos lapangan untuk SS ini.</td></tr> :
                   records.map((r) => (
                    // 👉 2. BUNGKUS DENGAN REACT FRAGMENT AGAR BISA ADA 2 TR (Baris Utama & Baris Dropdown)
                    <Fragment key={r.id}>
                    <tr key={r.id} className={`hover:bg-gray-50 transition ${!r.is_active ? 'bg-gray-50 text-gray-500' : ''}`}>
                      <td className="p-3 text-center">
                        <span className="bg-black text-white font-black px-2 py-1 rounded">{r.start_number}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-black text-gray-800">#{r.attempt_no || 1}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                            {r.is_active ? 'Aktif' : 'Histori'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-gray-800">
                        {r.driver_name} <br/> <span className="text-xs text-gray-500 font-normal">{r.team_name}</span>
                        {!r.is_active && r.restart_reason && (
                          <div className="mt-1 text-[11px] font-semibold text-orange-700 bg-orange-50 inline-block px-2 py-1 rounded">
                            Restart: {r.restart_reason}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono text-gray-600">{r.tc_time || '-'}</td>
                      <td className="p-3 text-center font-mono text-gray-600">{r.start_time || '-'}</td>
                      <td className="p-3 text-center font-mono text-gray-600">{formatClockCentiseconds(r.finish_time)}</td>
                      <td className="p-3 text-center font-mono text-blue-600 font-bold bg-blue-50/30">{formatMs(r.elapsed_time_ms)}</td>
                      <td className="p-3 text-center font-mono text-red-600 font-bold bg-red-50/30">
                          {r.penalty_time_ms > 0 ? (
                            <div className="flex items-center justify-center gap-2 cursor-pointer" onClick={() => toggleRow(r.id)}>
                              <span>+{formatMs(r.penalty_time_ms)}</span>
                              <span className="text-[10px] bg-red-200 text-red-800 px-1 rounded hover:bg-red-300">
                                {expandedRow === r.id ? '▲' : '▼'}
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                      <td className="p-3 text-center font-mono text-green-700 font-black bg-green-50/30 text-base">
                        <div>{formatMs(r.total_time_ms)}</div>
                        {r.status === 'DNF' && Number(r.total_time_ms) > 0 && (
                          <div className="mt-1 text-[10px] font-black uppercase tracking-wide text-gray-500">BWTM</div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${r.status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      
                      {/* KOLOM AKSI DIPERBARUI */}
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {r.is_active && r.status === 'OK' && (
                          <>
                            <button onClick={() => openEditModal(r)} className="text-xs font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded transition">EDIT ✏️</button>
                            
                            {/* 1. TOMBOL + PENALTI SELALU MUNCUL AGAR BISA DITUMPUK */}
                            <button onClick={() => openPenaltyModal(r)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded transition">+ PENALTI</button>
                            
                            {/* 2. TOMBOL RESET HANYA MUNCUL JIKA SUDAH ADA PENALTI */}
                            {r.penalty_time_ms > 0 && (
                              <button onClick={() => handleClearPenalty(r.id)} className="text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition">RESET ❌</button>
                            )}
                            
                            <button onClick={() => handleSetStatus(r.id, 'DNF')} className="text-xs font-bold text-white bg-gray-800 hover:bg-black px-2 py-1 rounded transition">DNF</button>
                            <button onClick={() => handleSetStatus(r.id, 'DNS')} className="text-xs font-bold text-white bg-gray-600 hover:bg-gray-700 px-2 py-1 rounded transition">DNS</button>
                            {!r.is_shakedown && (
                              <button onClick={() => openRestartModal(r)} className="text-xs font-bold text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded transition">RESTART</button>
                            )}
                          </>
                        )}
                        {r.is_active && r.status !== 'OK' && (
                          <button onClick={() => handleSetStatus(r.id, 'OK')} className="text-xs font-bold text-gray-500 hover:text-green-600 border border-gray-300 px-2 py-1 rounded transition">BATAL STATUS</button>
                        )}
                        {!r.is_active && (
                          <span className="text-xs font-bold text-gray-400">Histori attempt</span>
                        )}
                      </td>
                    </tr>
                    {expandedRow === r.id && r.penalty_details && r.penalty_details.length > 0 && (
                        <tr className="bg-red-50/50 border-b border-gray-200">
                          <td colSpan="11" className="px-6 py-3">
                            <div className="bg-white border border-red-200 rounded p-3 shadow-inner">
                              <p className="text-xs font-bold text-red-800 mb-2 border-b border-red-100 pb-1">📜 Rincian Penalti Mobil #{r.start_number}:</p>
                              <ul className="space-y-1">
                                {r.penalty_details.map((pd, idx) => (
                                  <li key={idx} className="text-xs flex justify-between text-gray-700">
                                    <span>• {pd.name}</span>
                                    <span className="font-mono text-red-600 font-bold">+{formatMs(pd.time_ms)}</span>
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

      {/* MODAL EDIT WAKTU (BARU) */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Koreksi Waktu Manual">
        <form onSubmit={submitEditTime} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-2">Koreksi waktu untuk Mobil <strong>#{selectedRecord?.start_number} ({selectedRecord?.driver_name})</strong></p>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">WAKTU START (Format: 08:15:30.00)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-600 font-mono"
              value={editForm.start_time}
              onChange={(e) => setEditForm({...editForm, start_time: e.target.value})}
              placeholder="00:00:00.00"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">WAKTU FINISH (Format: 08:15:30.00)</label>
            <input 
              type="text" 
              className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-blue-600 font-mono"
              value={editForm.finish_time}
              onChange={(e) => setEditForm({...editForm, finish_time: e.target.value})}
              placeholder="00:00:00.00"
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

function RestartRequestPanel({ requests, onApprove, onReject }) {
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
                  <span>Finish {formatClockCentiseconds(request.finish_time)}</span>
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
