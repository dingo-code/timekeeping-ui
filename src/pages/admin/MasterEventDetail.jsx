import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

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
  const [tcRecords, setTcRecords] = useState([]);
  
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
  const [stageSearchTerm, setStageSearchTerm] = useState('');
  const [stageCurrentPage, setStageCurrentPage] = useState(1);
  const [stageItemsPerPage, setStageItemsPerPage] = useState(5);

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
  const [penaltySearchTerm, setPenaltySearchTerm] = useState('');
  const [penaltyCurrentPage, setPenaltyCurrentPage] = useState(1);
  const [penaltyItemsPerPage, setPenaltyItemsPerPage] = useState(5);

  // --- State Jadwal TC ---
  const [selectedTCStageId, setSelectedTCStageId] = useState('');
  const [tcTargetDrafts, setTcTargetDrafts] = useState({});
  const [tcSearchTerm, setTcSearchTerm] = useState('');
  const [tcCurrentPage, setTcCurrentPage] = useState(1);
  const [tcItemsPerPage, setTcItemsPerPage] = useState(10);
  const [savingTCParticipantId, setSavingTCParticipantId] = useState('');

  // --- State Search & Pagination (Peserta) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const getTimecardUrl = (participant) => `${window.location.origin}/timecard/${id}/${participant.id}`;

  useEffect(() => {
    fetchEventData();
    fetchMasterData();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'tc' && !selectedTCStageId && stages.length > 0) {
      setSelectedTCStageId(stages[0].id);
    }
  }, [activeTab, selectedTCStageId, stages]);

  useEffect(() => {
    if (activeTab === 'tc' && selectedTCStageId) {
      fetchTCRecords(selectedTCStageId);
    }
  }, [activeTab, selectedTCStageId]);

  const normalizedStageSearch = stageSearchTerm.trim().toLowerCase();
  const filteredStages = stages.filter((ss) => (
    [
      ss.ss_order,
      ss.ss_name,
      ss.distance_km,
    ].join(' ').toLowerCase().includes(normalizedStageSearch)
  ));
  const stageTotalPages = Math.max(1, Math.ceil(filteredStages.length / stageItemsPerPage));
  const safeStageCurrentPage = Math.min(stageCurrentPage, stageTotalPages);
  const stageStartIndex = (safeStageCurrentPage - 1) * stageItemsPerPage;
  const currentStages = filteredStages.slice(stageStartIndex, stageStartIndex + stageItemsPerPage);
  useEffect(() => { setStageCurrentPage(1); }, [stageSearchTerm, stageItemsPerPage]);

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

  const fetchTCRecords = async (stageId) => {
    if (!stageId) return;
    try {
      const res = await api.get(`/timekeeping/stages/${stageId}/records`);
      setTcRecords(res.data.data || []);
      setTcTargetDrafts({});
    } catch (e) {
      console.error('Gagal memuat jadwal TC');
    }
  };

  const handleSaveTCTarget = async (participantId) => {
    const targetTime = tcTargetDrafts[participantId] ?? tcRecordByParticipantId.get(participantId)?.target_tc_time ?? '';
    if (!selectedTCStageId) return alert('Pilih SS terlebih dahulu.');
    if (!targetTime) return alert('Target waktu TC wajib diisi.');

    setSavingTCParticipantId(participantId);
    try {
      await api.put(`/admin/stages/${selectedTCStageId}/participants/${participantId}/tc-target`, {
        target_tc_time: targetTime,
      });
      await fetchTCRecords(selectedTCStageId);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan target TC');
    } finally {
      setSavingTCParticipantId('');
    }
  };

  // --- LOGIKA FILTER & PAGINASI PESERTA ---
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredParticipants = participants.filter((p) => {
    const searchableText = [
      p.start_number,
      p.entrant_name,
      getRacerName(p.driver_id),
      getRacerName(p.codriver_id),
      getVehicleName(p.vehicle_id),
    ].join(' ').toLowerCase();

    return searchableText.includes(normalizedSearch);
  });
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentParticipants = filteredParticipants.slice(startIndex, startIndex + itemsPerPage);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const normalizedPenaltySearch = penaltySearchTerm.trim().toLowerCase();
  const filteredPenalties = penalties.filter((p) => (
    [
      p.name,
      p.description,
      p.penalty_time_ms,
    ].join(' ').toLowerCase().includes(normalizedPenaltySearch)
  ));
  const penaltyTotalPages = Math.max(1, Math.ceil(filteredPenalties.length / penaltyItemsPerPage));
  const safePenaltyCurrentPage = Math.min(penaltyCurrentPage, penaltyTotalPages);
  const penaltyStartIndex = (safePenaltyCurrentPage - 1) * penaltyItemsPerPage;
  const currentPenalties = filteredPenalties.slice(penaltyStartIndex, penaltyStartIndex + penaltyItemsPerPage);
  useEffect(() => { setPenaltyCurrentPage(1); }, [penaltySearchTerm, penaltyItemsPerPage]);

  const tcRecordByParticipantId = new Map(tcRecords.map((record) => [record.participant_id, record]));
  const tcRows = participants.map((participant) => {
    const record = tcRecordByParticipantId.get(participant.id);
    return {
      ...participant,
      record,
      target_tc_time: tcTargetDrafts[participant.id] ?? record?.target_tc_time ?? '',
      tc_time: record?.tc_time || '',
      tc_status: record?.tc_status || 'NOT_SCHEDULED',
      tc_delta_ms: record?.tc_delta_ms || 0,
    };
  });
  const normalizedTCSearch = tcSearchTerm.trim().toLowerCase();
  const filteredTCRows = tcRows.filter((row) => (
    [
      row.start_number,
      row.entrant_name,
      getRacerName(row.driver_id),
      getRacerName(row.codriver_id),
      row.target_tc_time,
      row.tc_time,
      row.tc_status,
    ].join(' ').toLowerCase().includes(normalizedTCSearch)
  ));
  const tcTotalPages = Math.max(1, Math.ceil(filteredTCRows.length / tcItemsPerPage));
  const safeTCCurrentPage = Math.min(tcCurrentPage, tcTotalPages);
  const tcStartIndex = (safeTCCurrentPage - 1) * tcItemsPerPage;
  const currentTCRows = filteredTCRows.slice(tcStartIndex, tcStartIndex + tcItemsPerPage);
  useEffect(() => { setTcCurrentPage(1); }, [tcSearchTerm, tcItemsPerPage, selectedTCStageId]);

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
    const requiredFields = [
      ['driver_id', 'Driver'],
      ['codriver_id', 'Co-Driver'],
      ['vehicle_id', 'Kendaraan'],
      ['class_id', 'Kelas'],
      ['category_id', 'Kategori'],
    ];
    const missingField = requiredFields.find(([key]) => !participantForm[key]);
    if (missingField) return alert(`${missingField[1]} wajib dipilih.`);

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
  function getRacerName(rId) {
    return racers.find(r => r.id === rId)?.full_name || '-';
  }

  function getVehicleName(vId) {
    const vehicle = vehicles.find(v => v.id === vId);
    return vehicle ? `${vehicle.brand || ''} ${vehicle.type || ''}`.trim() || '-' : '-';
  }

  const formatMsToText = (ms) => {
    const sec = ms / 1000;
    return sec >= 60 ? `+${sec/60} Menit` : `+${sec} Detik`;
  };

  const formatTCDelta = (ms) => {
    if (!ms) return '0 detik';
    const sign = ms > 0 ? '+' : '-';
    const absMs = Math.abs(ms);
    const minutes = Math.floor(absMs / 60000);
    const seconds = Math.floor((absMs % 60000) / 1000);
    return minutes > 0 ? `${sign}${minutes}m ${seconds}s` : `${sign}${seconds}s`;
  };

  const getTCStatusLabel = (status) => {
    const labels = {
      NOT_SCHEDULED: 'Belum dijadwalkan',
      WAITING: 'Menunggu TC',
      UNSCHEDULED: 'Aktual tanpa target',
      ON_TIME: 'Sesuai waktu',
      EARLY: 'Terlalu cepat',
      LATE: 'Terlambat',
      INVALID: 'Format invalid',
    };
    return labels[status] || status || '-';
  };

  const getTCStatusClass = (status) => {
    if (status === 'ON_TIME') return 'bg-green-100 text-green-700';
    if (status === 'EARLY' || status === 'LATE') return 'bg-red-100 text-red-700';
    if (status === 'WAITING') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="flex flex-col min-h-full space-y-6">
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
          <button
            onClick={() => setActiveTab('tc')}
            className={`flex-1 py-4 text-center font-bold text-sm transition ${activeTab === 'tc' ? 'bg-white text-red-600 border-t-4 border-red-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Jadwal TC
          </button>
        </div>

        {/* --- TAB KONTEN: SPECIAL STAGES --- */}
        {activeTab === 'stages' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Rute Balap (Special Stages)</h3>
                <p className="text-xs text-gray-500">Total {stages.length} rute terdaftar.</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Cari nama, urutan, atau jarak SS..."
                  className="w-full sm:w-64 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-red-500"
                  value={stageSearchTerm}
                  onChange={(e) => setStageSearchTerm(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
                  <select
                    className="p-2 border border-gray-300 rounded text-sm outline-none bg-white focus:ring-1 focus:ring-red-500"
                    value={stageItemsPerPage}
                    onChange={(e) => setStageItemsPerPage(Number(e.target.value))}
                  >
                    {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
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
                {isLoading ? <tr><td colSpan="4" className="text-center p-4 text-gray-500">Memuat...</td></tr> :
                  currentStages.length === 0 ? <tr><td colSpan="4" className="text-center p-4 text-gray-500">Data tidak ditemukan.</td></tr> :
                  currentStages.map(ss => (
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
            <DataTableFooter totalItems={filteredStages.length} currentPage={safeStageCurrentPage} totalPages={stageTotalPages} pageSize={stageItemsPerPage} searchTerm={stageSearchTerm} onPageChange={setStageCurrentPage} />
          </div>
        )}

        {/* --- TAB KONTEN: PESERTA --- */}
        {activeTab === 'participants' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Entry List / Daftar Peserta</h3>
                <p className="text-xs text-gray-500">Total {participants.length} peserta terdaftar.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                <input 
                  type="text" 
                  placeholder="Cari entrant, driver, co-driver, mobil, atau no start..."
                  className="w-full sm:w-64 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-red-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
                  <select
                    className="p-2 border border-gray-300 rounded text-sm outline-none bg-white focus:ring-1 focus:ring-red-500"
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  >
                    {[5, 10, 25, 50, 100].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => openParticipantModal()} className="px-4 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 whitespace-nowrap">+ Peserta</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead className="bg-gray-100 text-sm">
                  <tr>
                    <th className="p-3 text-center">No Start</th>
                    <th className="p-3">Nama Entrant / Tim</th>
                    <th className="p-3">Driver / Co-Driver</th>
                    <th className="p-3">Mobil</th>
                    <th className="p-3 text-center">QR Timecard</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentParticipants.length === 0 ? <tr><td colSpan="6" className="text-center p-8 text-gray-500">Tidak ada peserta ditemukan.</td></tr> :
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
                        <td className="p-3 text-center">
                          <TimecardQR value={getTimecardUrl(p)} />
                        </td>
                        <td className="p-3 text-right space-x-3">
                          <a href={getTimecardUrl(p)} target="_blank" rel="noreferrer" className="text-green-700 hover:underline text-sm font-bold">Timecard</a>
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
            <DataTableFooter totalItems={filteredParticipants.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
          </div>
        )}

        {/* --- TAB KONTEN: JADWAL TC --- */}
        {activeTab === 'tc' && (
          <div className="p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Jadwal Time Control per SS</h3>
                <p className="text-xs text-gray-500">Atur jam wajib TC peserta untuk SS yang dipilih.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                <select
                  className="w-full sm:w-56 p-2 border border-gray-300 rounded text-sm outline-none bg-white focus:ring-1 focus:ring-red-500"
                  value={selectedTCStageId}
                  onChange={(e) => setSelectedTCStageId(e.target.value)}
                >
                  <option value="">-- Pilih SS --</option>
                  {stages.map((stage) => <option key={stage.id} value={stage.id}>SS {stage.ss_order} : {stage.ss_name}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Cari no start, entrant, driver, atau status..."
                  className="w-full sm:w-72 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-red-500"
                  value={tcSearchTerm}
                  onChange={(e) => setTcSearchTerm(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
                  <select
                    className="p-2 border border-gray-300 rounded text-sm outline-none bg-white focus:ring-1 focus:ring-red-500"
                    value={tcItemsPerPage}
                    onChange={(e) => setTcItemsPerPage(Number(e.target.value))}
                  >
                    {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead className="bg-gray-100 text-sm">
                  <tr>
                    <th className="p-3 text-center">No Start</th>
                    <th className="p-3">Peserta</th>
                    <th className="p-3 text-center">Target TC</th>
                    <th className="p-3 text-center">Aktual TC</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedTCStageId ? (
                    <tr><td colSpan="6" className="text-center p-8 text-gray-500">Pilih SS untuk mengatur jadwal TC.</td></tr>
                  ) : currentTCRows.length === 0 ? (
                    <tr><td colSpan="6" className="text-center p-8 text-gray-500">Tidak ada peserta ditemukan.</td></tr>
                  ) : currentTCRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="p-3 text-center">
                        <span className="bg-black text-white font-black text-xl px-3 py-1 rounded">{row.start_number}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-800">{getRacerName(row.driver_id)}</div>
                        <div className="text-xs text-gray-500">{row.entrant_name || '-'}</div>
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="time"
                          step="1"
                          className="w-36 p-2 border border-gray-300 rounded font-mono text-sm outline-none focus:ring-1 focus:ring-red-500"
                          value={(row.target_tc_time || '').slice(0, 8)}
                          onChange={(e) => setTcTargetDrafts({ ...tcTargetDrafts, [row.id]: e.target.value })}
                        />
                      </td>
                      <td className="p-3 text-center font-mono text-gray-700">{row.tc_time || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${getTCStatusClass(row.tc_status)}`}>
                          {getTCStatusLabel(row.tc_status)}
                        </span>
                        {(row.tc_status === 'EARLY' || row.tc_status === 'LATE') && (
                          <div className="mt-1 text-[11px] font-bold text-gray-500">{formatTCDelta(row.tc_delta_ms)}</div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleSaveTCTarget(row.id)}
                          disabled={savingTCParticipantId === row.id}
                          className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-2 rounded transition disabled:opacity-50"
                        >
                          {savingTCParticipantId === row.id ? 'MENYIMPAN...' : 'SIMPAN TARGET'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DataTableFooter totalItems={filteredTCRows.length} currentPage={safeTCCurrentPage} totalPages={tcTotalPages} pageSize={tcItemsPerPage} searchTerm={tcSearchTerm} onPageChange={setTcCurrentPage} />
          </div>
        )}

        {/* --- TAB KONTEN: REGULASI PENALTI --- */}
        {activeTab === 'penalties' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Regulasi Penalti Event</h3>
                <p className="text-xs text-gray-500">Total {penalties.length} regulasi penalti terdaftar.</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Cari pelanggaran atau deskripsi..."
                  className="w-full sm:w-64 p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-red-500"
                  value={penaltySearchTerm}
                  onChange={(e) => setPenaltySearchTerm(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
                  <select
                    className="p-2 border border-gray-300 rounded text-sm outline-none bg-white focus:ring-1 focus:ring-red-500"
                    value={penaltyItemsPerPage}
                    onChange={(e) => setPenaltyItemsPerPage(Number(e.target.value))}
                  >
                    {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
                <button onClick={() => openPenaltyModal()} className="px-4 py-2 bg-black text-white font-bold rounded text-xs hover:bg-red-600 transition whitespace-nowrap">
                  + TAMBAH REGULASI
                </button>
              </div>
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
                  {isLoading ? (
                    <tr><td colSpan="4" className="text-center p-10 text-gray-500 font-medium">Memuat...</td></tr>
                  ) : currentPenalties.length === 0 ? (
                    <tr><td colSpan="4" className="text-center p-10 text-gray-500 font-medium">Data tidak ditemukan.</td></tr>
                  ) : (
                    currentPenalties.map(p => (
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
            <DataTableFooter totalItems={filteredPenalties.length} currentPage={safePenaltyCurrentPage} totalPages={penaltyTotalPages} pageSize={penaltyItemsPerPage} searchTerm={penaltySearchTerm} onPageChange={setPenaltyCurrentPage} />
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
              <label className="block text-sm font-bold text-gray-700 mb-1 text-red-600">No. Start</label>
              <input type="number" required min="1" className="w-full p-2 border-2 border-red-300 font-bold text-xl rounded outline-none" value={participantForm.start_number} onChange={e => setParticipantForm({...participantForm, start_number: e.target.value})} />
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Nama Entrant / Tim</label>
              <input type="text" required placeholder="Nama pendaftar..." className="w-full p-2 border border-gray-300 rounded outline-none" value={participantForm.entrant_name} onChange={e => setParticipantForm({...participantForm, entrant_name: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <SearchableSelect
                label="Driver"
                placeholder="Cari driver..."
                value={participantForm.driver_id}
                options={racers.filter(r => r.is_driver).map(r => ({ value: r.id, label: r.full_name }))}
                onChange={(value) => setParticipantForm({ ...participantForm, driver_id: value })}
                required
              />
            </div>
            <div>
              <SearchableSelect
                label="Co-Driver"
                placeholder="Cari co-driver..."
                value={participantForm.codriver_id}
                options={racers.filter(r => r.is_codriver).map(r => ({ value: r.id, label: r.full_name }))}
                onChange={(value) => setParticipantForm({ ...participantForm, codriver_id: value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <SearchableSelect
                label="Tim Resmi (Opsional)"
                placeholder="Cari tim..."
                emptyLabel="-- Privateer / Tidak Ada --"
                value={participantForm.team_id}
                options={teams.map(t => ({ value: t.id, label: t.name }))}
                onChange={(value) => setParticipantForm({ ...participantForm, team_id: value })}
              />
            </div>
            <div>
              <SearchableSelect
                label="Kendaraan"
                placeholder="Cari kendaraan..."
                value={participantForm.vehicle_id}
                options={vehicles.map(v => ({ value: v.id, label: `${v.brand} - ${v.type}` }))}
                onChange={(value) => setParticipantForm({ ...participantForm, vehicle_id: value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-gray-200 pt-3">
            <div>
              <SearchableSelect
                label="Kelas Bertanding"
                placeholder="Cari kelas..."
                value={participantForm.class_id}
                options={classes.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                onChange={(value) => setParticipantForm({ ...participantForm, class_id: value })}
                required
              />
            </div>
            <div>
              <SearchableSelect
                label="Kategori Seeded"
                placeholder="Cari kategori..."
                value={participantForm.category_id}
                options={categories.map(c => ({ value: c.id, label: c.code }))}
                onChange={(value) => setParticipantForm({ ...participantForm, category_id: value })}
                required
              />
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

function TimecardQR({ value }) {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: 88,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrUrl(url);
      })
      .catch(() => {
        if (isMounted) setQrUrl('');
      });

    return () => {
      isMounted = false;
    };
  }, [value]);

  if (!qrUrl) {
    return <div className="mx-auto h-16 w-16 rounded bg-gray-100" />;
  }

  return (
    <a href={value} target="_blank" rel="noreferrer" title="Buka timecard peserta">
      <img src={qrUrl} alt="QR Timecard" className="mx-auto h-16 w-16 rounded border border-gray-200 bg-white p-1" />
    </a>
  );
}

function SearchableSelect({ label, value, options, onChange, placeholder, emptyLabel, required = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  const displayValue = isOpen ? query : selectedOption?.label || '';

  const handleFocus = () => {
    setQuery('');
    setIsOpen(true);
  };

  const handleBlur = () => {
    window.setTimeout(() => setIsOpen(false), 120);
  };

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-bold text-gray-700 mb-1">
        {label}{required && <span className="text-red-600"> *</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className="w-full p-2 pr-9 border border-gray-300 rounded outline-none bg-white focus:ring-1 focus:ring-red-500 text-sm"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery('');
            setIsOpen(!isOpen);
          }}
          className="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700"
          aria-label={`Buka pilihan ${label}`}
        >
          v
        </button>
      </div>

      {isOpen && (
        <div className="mt-1 max-h-52 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
          {emptyLabel && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect('')}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-red-50 ${value === '' ? 'bg-red-50 font-bold text-red-700' : 'text-gray-700'}`}
            >
              {emptyLabel}
            </button>
          )}
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400">Tidak ada data cocok.</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(option.value)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-red-50 ${option.value === value ? 'bg-red-50 font-bold text-red-700' : 'text-gray-700'}`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
