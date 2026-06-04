import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Modal from '../../components/Modal';

export default function MasterEventDetail() {
  const { id } = useParams(); // Mengambil ID Event dari URL
  const navigate = useNavigate();
  
  // --- Tab State: 'stages' | 'participants' | 'penalties' ---
  const [activeTab, setActiveTab] = useState('stages'); 
  const [isLoading, setIsLoading] = useState(false);

  // --- State Data ---
  const [stages, setStages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [penalties, setPenalties] = useState([]); // State untuk Penalti
  
  // --- State Master Data (Untuk Dropdown) ---
  const [racers, setRacers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [categories, setCategories] = useState([]);

  // --- State Modal & Edit SS ---
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState(null);
  const [stageForm, setStageForm] = useState({ ss_name: '', ss_order: '', distance_km: '' });

  // --- State Modal & Edit Peserta ---
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [participantForm, setParticipantForm] = useState({
    start_number: '', entrant_name: '', driver_id: '', codriver_id: '', 
    team_id: '', vehicle_id: '', class_id: '', category_id: ''
  });

  // --- State Modal & Edit Penalti ---
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [editingPenaltyId, setEditingPenaltyId] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({ name: '', penalty_time_sec: '', description: '' });

  // --- State Search & Pagination (Peserta) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchEventData();
    fetchMasterData();
  }, [id]);

  const fetchEventData = async () => {
    setIsLoading(true);
    try {
      // Fetch ketiga data sekaligus: SS, Peserta, dan Penalti
      const [resStages, resParticipants, resPenalties] = await Promise.all([
        api.get(`/events/${id}/stages`),
        api.get(`/events/${id}/participants`),
        api.get(`/admin/events/${id}/penalties`) 
      ]);
      setStages(resStages.data.data || []);
      setParticipants(resParticipants.data.data || []);
      setPenalties(resPenalties.data.data || []);
    } catch (e) {
      alert('Gagal memuat data event.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [resR, resT, resV, resC, resCat] = await Promise.all([
        api.get('/admin/racers'), api.get('/admin/teams'),
        api.get('/admin/vehicles'), api.get('/admin/classes'), api.get('/admin/categories')
      ]);
      setRacers(resR.data.data || []);
      setTeams(resT.data.data || []);
      setVehicles(resV.data.data || []);
      setClasses(resC.data.data || []);
      setCategories(resCat.data.data || []);
    } catch (e) {
      console.error('Gagal memuat master data untuk form dropdown');
    }
  };

  // --- LOGIKA FILTER & PAGINASI PESERTA ---
  const filteredParticipants = participants.filter(p => 
    p.entrant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.start_number.toString().includes(searchTerm)
  );
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const currentParticipants = filteredParticipants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  // ==========================================
  // HANDLER SPECIAL STAGES (SS)
  // ==========================================
  const openStageModal = (ss = null) => {
    if (ss) {
      setEditingStageId(ss.id);
      setStageForm({ ss_name: ss.ss_name, ss_order: ss.ss_order, distance_km: ss.distance_km });
    } else {
      setEditingStageId(null);
      setStageForm({ ss_name: '', ss_order: '', distance_km: '' });
    }
    setIsStageModalOpen(true);
  };

  const handleStageSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...stageForm, ss_order: parseInt(stageForm.ss_order), distance_km: parseFloat(stageForm.distance_km) };
      
      if (editingStageId) {
        await api.put(`/admin/events/${id}/stages/${editingStageId}`, payload);
      } else {
        await api.post(`/admin/events/${id}/stages`, payload);
      }
      
      setIsStageModalOpen(false);
      fetchEventData();
    } catch (err) { alert('Gagal menyimpan SS'); }
  };

  const handleDeleteStage = async (stageId) => {
    if (!window.confirm('Hapus Special Stage ini?')) return;
    try {
      await api.delete(`/admin/events/${id}/stages/${stageId}`);
      fetchEventData();
    } catch (err) { alert('Gagal menghapus SS'); }
  };

  // ==========================================
  // HANDLER PESERTA (PARTICIPANTS)
  // ==========================================
  const openParticipantModal = (p = null) => {
    if (p) {
      setEditingParticipantId(p.id);
      setParticipantForm({
        start_number: p.start_number, entrant_name: p.entrant_name, driver_id: p.driver_id, 
        codriver_id: p.codriver_id, team_id: p.team_id || '', vehicle_id: p.vehicle_id, 
        class_id: p.class_id, category_id: p.category_id
      });
    } else {
      setEditingParticipantId(null);
      setParticipantForm({
        start_number: '', entrant_name: '', driver_id: '', codriver_id: '', 
        team_id: '', vehicle_id: '', class_id: '', category_id: ''
      });
    }
    setIsParticipantModalOpen(true);
  };

  const handleParticipantSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...participantForm, start_number: parseInt(participantForm.start_number) };
      
      if (editingParticipantId) {
        await api.put(`/admin/events/${id}/participants/${editingParticipantId}`, payload);
      } else {
        await api.post(`/admin/events/${id}/participants`, payload);
      }

      setIsParticipantModalOpen(false);
      fetchEventData();
    } catch (err) { alert('Gagal menyimpan peserta'); }
  };

  const handleDeleteParticipant = async (participantId) => {
    if (!window.confirm('Cabut pendaftaran peserta ini dari event?')) return;
    try {
      await api.delete(`/admin/events/${id}/participants/${participantId}`);
      fetchEventData();
    } catch (err) { alert('Gagal menghapus peserta'); }
  };

  // ==========================================
  // HANDLER REGULASI PENALTI
  // ==========================================
  const openPenaltyModal = (p = null) => {
    if (p) {
      setEditingPenaltyId(p.id);
      setPenaltyForm({ 
        name: p.name, 
        penalty_time_sec: p.penalty_time_ms / 1000, // Ms ke Detik
        description: p.description || ''
      });
    } else {
      setEditingPenaltyId(null);
      setPenaltyForm({ name: '', penalty_time_sec: '', description: '' });
    }
    setIsPenaltyModalOpen(true);
  };

  const handlePenaltySubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: penaltyForm.name,
        description: penaltyForm.description,
        penalty_time_ms: parseInt(penaltyForm.penalty_time_sec) * 1000 // Detik ke Ms
      };

      if (editingPenaltyId) {
        await api.put(`/admin/events/${id}/penalties/${editingPenaltyId}`, payload);
      } else {
        await api.post(`/admin/events/${id}/penalties`, payload);
      }

      setIsPenaltyModalOpen(false);
      fetchEventData();
    } catch (err) { alert('Gagal menyimpan regulasi penalti'); }
  };

  const handleDeletePenalty = async (pId) => {
    if (!window.confirm('Hapus aturan penalti ini?')) return;
    try {
      await api.delete(`/events/${id}/penalties/${pId}`);
      fetchEventData();
    } catch (err) { alert('Gagal menghapus penalti'); }
  };

  // --- Helpers ---
  const getRacerName = (rId) => racers.find(r => r.id === rId)?.full_name || '-';
  const getVehicleName = (vId) => vehicles.find(v => v.id === vId)?.type || '-';
  const formatMsToText = (ms) => {
    const sec = ms / 1000;
    return sec >= 60 ? `+${sec/60} Menit` : `+${sec} Detik`;
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Halaman */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-bold text-sm">
            ⬅️ KEMBALI
          </button>
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase italic tracking-tighter">Event Control Room</h2>
            <p className="text-sm text-gray-500 mt-1">Kelola rute, peserta, dan regulasi penalti untuk event ini.</p>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button 
            onClick={() => setActiveTab('stages')}
            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'stages' ? 'bg-white text-red-600 border-t-4 border-red-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            🚩 Special Stages (SS)
          </button>
          <button 
            onClick={() => setActiveTab('participants')}
            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'participants' ? 'bg-white text-red-600 border-t-4 border-red-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            🏎️ Entry List
          </button>
          <button 
            onClick={() => setActiveTab('penalties')}
            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'penalties' ? 'bg-white text-red-600 border-t-4 border-red-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            ⚠️ Regulasi Penalti
          </button>
        </div>

        {/* --- TAB KONTEN: SPECIAL STAGES --- */}
        {activeTab === 'stages' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Rute Balap (Special Stages)</h3>
              <button onClick={() => openStageModal()} className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700">+ Tambah SS</button>
            </div>
            
            <table className="w-full text-left border-collapse border border-gray-200 rounded overflow-hidden">
              <thead className="bg-gray-100 text-sm">
                <tr>
                  <th className="p-3">Urutan SS</th>
                  <th className="p-3">Nama SS</th>
                  <th className="p-3">Jarak (KM)</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {stages.length === 0 ? <tr><td colSpan="4" className="text-center p-4 text-gray-500">Belum ada rute SS.</td></tr> :
                  stages.map(ss => (
                    <tr key={ss.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-bold text-red-600">SS {ss.ss_order}</td>
                      <td className="p-3 font-medium">{ss.ss_name}</td>
                      <td className="p-3 text-gray-600">{ss.distance_km} km</td>
                      <td className="p-3 text-right space-x-3">
                        <button onClick={() => openStageModal(ss)} className="text-blue-600 hover:underline text-sm font-bold">Edit</button>
                        <button onClick={() => handleDeleteStage(ss.id)} className="text-red-600 hover:underline text-sm font-bold">Hapus</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* --- TAB KONTEN: PESERTA --- */}
        {activeTab === 'participants' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Entry List / Daftar Peserta</h3>
                <p className="text-xs text-gray-500">Total {filteredParticipants.length} peserta terdaftar.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Cari nama atau no pintu..." 
                  className="w-full sm:w-64 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-red-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button onClick={() => openParticipantModal()} className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 whitespace-nowrap">+ Peserta</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead className="bg-gray-100 text-sm">
                  <tr>
                    <th className="p-3 text-center">No Pintu</th>
                    <th className="p-3">Nama Entrant / Tim</th>
                    <th className="p-3">Driver / Co-Driver</th>
                    <th className="p-3">Mobil</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentParticipants.length === 0 ? <tr><td colSpan="5" className="text-center p-8 text-gray-500">Tidak ada peserta ditemukan.</td></tr> :
                    currentParticipants.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="p-3 text-center">
                          <span className="bg-black text-white font-black text-xl px-3 py-1 rounded">{p.start_number}</span>
                        </td>
                        <td className="p-3 font-bold">{p.entrant_name}</td>
                        <td className="p-3 text-sm">
                          <div className="font-semibold text-gray-800">{getRacerName(p.driver_id)}</div>
                          <div className="text-gray-500">Co: {getRacerName(p.codriver_id)}</div>
                        </td>
                        <td className="p-3 text-sm font-medium text-gray-700">{getVehicleName(p.vehicle_id)}</td>
                        <td className="p-3 text-right space-x-3">
                          <button onClick={() => openParticipantModal(p)} className="text-blue-600 hover:underline text-sm font-bold">Edit</button>
                          <button onClick={() => handleDeleteParticipant(p.id)} className="text-red-600 hover:underline text-sm font-bold">Hapus</button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-4 flex justify-between items-center bg-gray-50 p-3 rounded">
                <span className="text-xs text-gray-600">Halaman {currentPage} dari {totalPages}</span>
                <div className="space-x-2">
                  <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded text-xs font-bold bg-white disabled:opacity-50">Sebelumnya</button>
                  <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-xs font-bold bg-white disabled:opacity-50">Selanjutnya</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAB KONTEN: REGULASI PENALTI --- */}
        {activeTab === 'penalties' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Regulasi Penalti Event</h3>
                <p className="text-xs text-gray-500">Definisikan jenis pelanggaran dan beban waktu hukumannya.</p>
              </div>
              <button onClick={() => openPenaltyModal()} className="px-4 py-2 bg-black text-white font-bold rounded text-xs hover:bg-red-600 transition">
                + TAMBAH REGULASI
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs font-bold border-b border-gray-200">
                    <th className="p-3">Nama Pelanggaran</th>
                    <th className="p-3">Deskripsi</th>
                    <th className="p-3 text-center">Beban Waktu</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {penalties.length === 0 ? (
                    <tr><td colSpan="4" className="text-center p-10 text-gray-500 font-medium">Belum ada regulasi penalti untuk event ini.</td></tr>
                  ) : (
                    penalties.map(p => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="p-3 font-bold text-gray-800 text-sm">{p.name}</td>
                        <td className="p-3 text-xs text-gray-600">{p.description || '-'}</td>
                        <td className="p-3 text-center">
                          <span className="bg-red-100 text-red-700 font-bold px-3 py-1 rounded text-xs">
                            {formatMsToText(p.penalty_time_ms)}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-3">
                          <button onClick={() => openPenaltyModal(p)} className="text-blue-600 hover:underline text-xs font-bold">Edit</button>
                          <button onClick={() => handleDeletePenalty(p.id)} className="text-red-600 hover:underline text-xs font-bold">Hapus</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          MODALS SECTION
      ========================================== */}

      {/* --- MODAL FORM SS --- */}
      <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title={editingStageId ? "Edit Special Stage" : "Tambah Special Stage (SS)"}>
        <form onSubmit={handleStageSubmit} className="p-6 space-y-4">
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Urutan (SS Ke-)</label>
              <input type="number" required min="1" className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none" value={stageForm.ss_order} onChange={e => setStageForm({...stageForm, ss_order: e.target.value})} />
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Jarak (KM)</label>
              <input type="number" required step="0.01" className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none" value={stageForm.distance_km} onChange={e => setStageForm({...stageForm, distance_km: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nama / Lokasi SS</label>
            <input type="text" required placeholder="Contoh: SS1 - Cikampek" className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none" value={stageForm.ss_name} onChange={e => setStageForm({...stageForm, ss_name: e.target.value})} />
          </div>
          <div className="pt-4 flex justify-end">
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700">
              {editingStageId ? 'Update Rute' : 'Simpan Rute'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL FORM PESERTA --- */}
      <Modal isOpen={isParticipantModalOpen} onClose={() => setIsParticipantModalOpen(false)} title={editingParticipantId ? "Edit Peserta" : "Registrasi Peserta Baru"}>
        <form onSubmit={handleParticipantSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="block text-sm font-bold text-gray-700 mb-1 text-red-600">No. Pintu</label>
              <input type="number" required min="1" className="w-full p-2 border-2 border-red-300 font-bold text-xl rounded outline-none" value={participantForm.start_number} onChange={e => setParticipantForm({...participantForm, start_number: e.target.value})} />
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Entrant / Tim</label>
              <input type="text" required placeholder="Nama pendaftar..." className="w-full p-2 border border-gray-300 rounded outline-none" value={participantForm.entrant_name} onChange={e => setParticipantForm({...participantForm, entrant_name: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Driver</label>
              <select required className="w-full p-2 border border-gray-300 rounded outline-none bg-white" value={participantForm.driver_id} onChange={e => setParticipantForm({...participantForm, driver_id: e.target.value})}>
                <option value="" disabled>Pilih Driver</option>
                {racers.filter(r => r.is_driver).map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Co-Driver</label>
              <select required className="w-full p-2 border border-gray-300 rounded outline-none bg-white" value={participantForm.codriver_id} onChange={e => setParticipantForm({...participantForm, codriver_id: e.target.value})}>
                <option value="" disabled>Pilih Co-Driver</option>
                {racers.filter(r => r.is_codriver).map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Tim Resmi (Opsional)</label>
              <select className="w-full p-2 border border-gray-300 rounded outline-none bg-white" value={participantForm.team_id} onChange={e => setParticipantForm({...participantForm, team_id: e.target.value})}>
                <option value="">-- Privateer / Tidak Ada --</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Kendaraan</label>
              <select required className="w-full p-2 border border-gray-300 rounded outline-none bg-white" value={participantForm.vehicle_id} onChange={e => setParticipantForm({...participantForm, vehicle_id: e.target.value})}>
                <option value="" disabled>Pilih Kendaraan</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} - {v.type}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Kelas Bertanding</label>
              <select required className="w-full p-2 border border-gray-300 rounded outline-none bg-white" value={participantForm.class_id} onChange={e => setParticipantForm({...participantForm, class_id: e.target.value})}>
                <option value="" disabled>Pilih Kelas</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Kategori Seeded</label>
              <select required className="w-full p-2 border border-gray-300 rounded outline-none bg-white" value={participantForm.category_id} onChange={e => setParticipantForm({...participantForm, category_id: e.target.value})}>
                <option value="" disabled>Pilih Kategori</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button type="submit" className="px-4 py-3 bg-red-600 text-white rounded font-bold hover:bg-red-700 w-full">
              {editingParticipantId ? 'Update Data Peserta' : 'Daftarkan Peserta Ini'}
            </button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL FORM PENALTI --- */}
      <Modal isOpen={isPenaltyModalOpen} onClose={() => setIsPenaltyModalOpen(false)} title={editingPenaltyId ? "Edit Regulasi Penalti" : "Tambah Regulasi Penalti"}>
        <form onSubmit={handlePenaltySubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nama Pelanggaran</label>
            <input type="text" required placeholder="Contoh: Jump Start" className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-red-600" value={penaltyForm.name} onChange={e => setPenaltyForm({...penaltyForm, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Beban Hukuman (Detik)</label>
            <input type="number" required min="1" placeholder="Contoh: 10" className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-red-600" value={penaltyForm.penalty_time_sec} onChange={e => setPenaltyForm({...penaltyForm, penalty_time_sec: e.target.value})} />
            <p className="text-xs text-gray-500 mt-1 italic">* Masukkan dalam satuan detik. Sistem akan mengonversi ke milidetik.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Keterangan Tambahan</label>
            <textarea rows="3" className="w-full p-2 border border-gray-300 rounded outline-none focus:ring-1 focus:ring-red-600 text-sm" value={penaltyForm.description} onChange={e => setPenaltyForm({...penaltyForm, description: e.target.value})}></textarea>
          </div>
          <button type="submit" className="w-full py-3 bg-red-600 text-white font-bold text-sm hover:bg-black transition">
            {editingPenaltyId ? 'Update Regulasi' : 'Simpan Regulasi'}
          </button>
        </form>
      </Modal>

    </div>
  );
}