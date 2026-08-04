import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';
import { tcStatusLabel } from '../../utils/tcDisplay';

const DEFAULT_IMPORT_RACER_DOB = '1900-01-01';

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
  const [regions, setRegions] = useState([]);
  const [groups, setGroups] = useState([]);

  // --- State Modal & Edit SS ---
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState(null);
  const [stageForm, setStageForm] = useState({ ss_name: '', ss_order: '', distance_km: '', is_shakedown: false, is_open: true, track_condition: 'DRY' });
  const [stageSearchTerm, setStageSearchTerm] = useState('');
  const [stageCurrentPage, setStageCurrentPage] = useState(1);
  const [stageItemsPerPage, setStageItemsPerPage] = useState(5);

  // --- State Modal & Edit Peserta ---
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [vehicleEntryMode, setVehicleEntryMode] = useState('own');
  const [joinCarParticipantId, setJoinCarParticipantId] = useState('');
  const [participantForm, setParticipantForm] = useState({
    start_number: '', entrant_name: '', driver_id: '', codriver_id: '', 
    team_id: '', vehicle_id: '', join_car_with_participant_id: '', class_id: '', category_id: ''
  });
  const [isImportingEntryList, setIsImportingEntryList] = useState(false);
  const [entryListImportSummary, setEntryListImportSummary] = useState('');

  // --- State Modal & Edit Penalti ---
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [editingPenaltyId, setEditingPenaltyId] = useState(null);
  const [penaltyForm, setPenaltyForm] = useState({ name: '', penalty_time_sec: '', description: '' });
  const [penaltySearchTerm, setPenaltySearchTerm] = useState('');
  const [penaltyCurrentPage, setPenaltyCurrentPage] = useState(1);
  const [penaltyItemsPerPage, setPenaltyItemsPerPage] = useState(5);

  // --- State Starting List & Jadwal TC ---
  const [selectedTCStageId, setSelectedTCStageId] = useState('');
  const [startingList, setStartingList] = useState([]);
  const [startOrderDrafts, setStartOrderDrafts] = useState({});
  const [tcGenerateForm, setTcGenerateForm] = useState({ first_target_tc_time: '', interval_minutes: 2 });
  const [tcTargetDrafts, setTcTargetDrafts] = useState({});
  const [tcSearchTerm, setTcSearchTerm] = useState('');
  const [tcCurrentPage, setTcCurrentPage] = useState(1);
  const [tcItemsPerPage, setTcItemsPerPage] = useState(10);
  const [savingTCParticipantId, setSavingTCParticipantId] = useState('');
  const [savingWithdrawParticipantId, setSavingWithdrawParticipantId] = useState('');
  const [isSavingStartingList, setIsSavingStartingList] = useState(false);
  const [isGeneratingTC, setIsGeneratingTC] = useState(false);
  const [startingListImportSummary, setStartingListImportSummary] = useState('');

  // --- State Search & Pagination (Peserta) ---
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([]);

  const getTimecardUrl = (participant) => `${window.location.origin}/timecard/${id}/${participant.id}`;
  const officialStages = stages.filter((stage) => !stage.is_shakedown);
  const selectedTCStage = officialStages.find((stage) => stage.id === selectedTCStageId);
  const shakedownCount = stages.length - officialStages.length;

  useEffect(() => {
    fetchEventData();
    fetchMasterData();
  }, [id]);

  useEffect(() => {
    if (activeTab !== 'tc') return;
    const selectableTCStages = stages.filter((stage) => !stage.is_shakedown);
    if (selectedTCStageId && !selectableTCStages.some((stage) => stage.id === selectedTCStageId)) {
      setSelectedTCStageId(selectableTCStages[0]?.id || '');
      return;
    }
    if (!selectedTCStageId && selectableTCStages.length > 0) {
      setSelectedTCStageId(selectableTCStages[0].id);
    }
  }, [activeTab, selectedTCStageId, stages]);

  useEffect(() => {
    if (activeTab === 'tc' && selectedTCStageId) {
      refreshTCSetup(selectedTCStageId);
    }
  }, [activeTab, selectedTCStageId]);

  const normalizedStageSearch = stageSearchTerm.trim().toLowerCase();
  const filteredStages = stages.filter((ss) => (
    [
      ss.ss_order,
      ss.ss_name,
      ss.distance_km,
      ss.is_shakedown ? 'shakedown' : 'ss',
      String(ss.track_condition || 'DRY').toUpperCase() === 'WET' ? 'wet hujan basah' : 'dry kering',
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
      const [resR, resT, resV, resC, resCat, resReg, resGroups] = await Promise.all([
        api.get('/admin/racers'), api.get('/admin/teams'),
        api.get('/admin/vehicles'), api.get('/admin/classes'), api.get('/admin/categories'),
        api.get('/admin/regions'), api.get('/admin/groups')
      ]);
      setRacers(resR.data.data || []);
      setTeams(resT.data.data || []);
      setVehicles(resV.data.data || []);
      setClasses(resC.data.data || []);
      setCategories(resCat.data.data || []);
      setRegions(resReg.data.data || []);
      setGroups(resGroups.data.data || []);
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

  const fetchStartingList = async (stageId) => {
    if (!stageId) return;
    try {
      const res = await api.get(`/admin/stages/${stageId}/starting-list`);
      const nextList = res.data.data || [];
      setStartingList(nextList);
      setStartOrderDrafts(Object.fromEntries(nextList.map((entry) => [entry.participant_id, entry.start_order || entry.start_number])));
    } catch (e) {
      console.error('Gagal memuat starting list');
      setStartingList([]);
      setStartOrderDrafts({});
    }
  };

  const refreshTCSetup = async (stageId) => {
    await Promise.all([
      fetchTCRecords(stageId),
      fetchStartingList(stageId),
    ]);
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

  const startingListPayload = () => {
    const rows = tcRows.map((row) => ({
      participant_id: row.id,
      start_order: Number(startOrderDrafts[row.id] ?? row.start_order ?? row.start_number),
    }));
    const invalidRow = rows.find((row) => !Number.isInteger(row.start_order) || row.start_order <= 0);
    if (invalidRow) {
      throw new Error('Semua Start Ke harus berupa angka lebih besar dari 0.');
    }
    const duplicateOrder = rows.find((row, index) => rows.some((other, otherIndex) => otherIndex !== index && other.start_order === row.start_order));
    if (duplicateOrder) {
      throw new Error(`Start Ke ${duplicateOrder.start_order} dipakai lebih dari satu peserta.`);
    }
    return rows;
  };

  const saveStartingList = async ({ silent = false } = {}) => {
    if (!selectedTCStageId) throw new Error('Pilih SS terlebih dahulu.');
    const entries = startingListPayload();
    setIsSavingStartingList(true);
    try {
      await api.put(`/admin/stages/${selectedTCStageId}/starting-list`, { entries });
      const targetEntries = Object.entries(tcTargetDrafts).filter(([, targetTime]) => targetTime);
      if (targetEntries.length > 0) {
        await Promise.all(targetEntries.map(([participantId, targetTime]) => (
          api.put(`/admin/stages/${selectedTCStageId}/participants/${participantId}/tc-target`, {
            target_tc_time: targetTime,
          })
        )));
      }
      await refreshTCSetup(selectedTCStageId);
      if (!silent) alert('Starting list berhasil disimpan.');
    } finally {
      setIsSavingStartingList(false);
    }
  };

  const handleSaveStartingList = async () => {
    try {
      await saveStartingList();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Gagal menyimpan starting list.');
    }
  };

  const handleGenerateTCTargets = async () => {
    if (!selectedTCStageId) return alert('Pilih SS terlebih dahulu.');
    if (!tcGenerateForm.first_target_tc_time) return alert('Jam TC peserta pertama wajib diisi.');
    if (!Number(tcGenerateForm.interval_minutes) || Number(tcGenerateForm.interval_minutes) <= 0) return alert('Interval harus lebih besar dari 0 menit.');
    if (!window.confirm('Generate jadwal TC akan menimpa target TC pada SS ini sesuai starting list. Lanjutkan?')) return;

    setIsGeneratingTC(true);
    try {
      await saveStartingList({ silent: true });
      await api.post(`/admin/stages/${selectedTCStageId}/tc-targets/generate`, {
        first_target_tc_time: tcGenerateForm.first_target_tc_time,
        interval_minutes: Number(tcGenerateForm.interval_minutes),
      });
      await refreshTCSetup(selectedTCStageId);
      alert('Jadwal TC berhasil digenerate.');
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Gagal generate jadwal TC.');
    } finally {
      setIsGeneratingTC(false);
    }
  };

  const handleImportStartingListExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (rows.length === 0) return alert('File Excel kosong.');

      const participantsByCarNo = new Map(participants.map((participant) => [String(participant.start_number).trim(), participant]));
      const nextStartOrderDrafts = { ...startOrderDrafts };
      const nextTCTargetDrafts = { ...tcTargetDrafts };
      const unmatched = [];
      const imported = [];

      rows.forEach((row, index) => {
        const carNo = readExcelValue(row, ['CAR NO', 'CARNO', 'NO START', 'START NO']);
        const participant = participantsByCarNo.get(String(carNo).trim());
        if (!participant) {
          if (carNo) unmatched.push(carNo);
          return;
        }

        const startOrder = Number(readExcelValue(row, ['*', 'START KE', 'START ORDER', 'ORDER']));
        if (!Number.isInteger(startOrder) || startOrder <= 0) {
          throw new Error(`Start Ke tidak valid pada baris Excel ${index + 2}.`);
        }

        nextStartOrderDrafts[participant.id] = startOrder;
        const targetTime = normalizeImportedClock(readExcelValue(row, ['TC TIME', 'TARGET TC', 'TARGET TC TIME']));
        if (targetTime) nextTCTargetDrafts[participant.id] = targetTime;
        imported.push(participant.start_number);
      });

      if (imported.length === 0) return alert('Tidak ada CAR NO yang cocok dengan Entry List event ini.');

      setStartOrderDrafts(nextStartOrderDrafts);
      setTcTargetDrafts(nextTCTargetDrafts);
      const summary = `${imported.length} peserta diimport dari ${file.name}${unmatched.length ? `, ${unmatched.length} CAR NO tidak cocok` : ''}.`;
      setStartingListImportSummary(summary);
      alert(summary);
    } catch (err) {
      alert(err.message || 'Gagal membaca file Excel starting list.');
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
  const startingListByParticipantId = new Map(startingList.map((entry) => [entry.participant_id, entry]));
  const tcRows = participants.map((participant) => {
    const record = tcRecordByParticipantId.get(participant.id);
    const listEntry = startingListByParticipantId.get(participant.id);
    return {
      ...participant,
      record,
      start_order: Number(startOrderDrafts[participant.id] ?? listEntry?.start_order ?? participant.start_number),
      target_tc_time: tcTargetDrafts[participant.id] ?? record?.target_tc_time ?? '',
      tc_time: record?.tc_time || '',
      tc_status: record?.tc_status || 'NOT_SCHEDULED',
      tc_delta_ms: record?.tc_delta_ms || 0,
    };
  }).sort((a, b) => (Number(a.start_order) || 0) - (Number(b.start_order) || 0) || (Number(a.start_number) || 0) - (Number(b.start_number) || 0));
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
      row.withdraw_from_stage_id ? 'withdraw wd mengundurkan diri' : '',
      row.withdraw_reason,
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
      setStageForm({ ss_name: ss.ss_name, ss_order: ss.ss_order, distance_km: ss.distance_km, is_shakedown: Boolean(ss.is_shakedown), is_open: ss.is_open ?? true, track_condition: (ss.track_condition || 'DRY').toUpperCase() });
    } else {
      setEditingStageId(null);
      setStageForm({ ss_name: '', ss_order: '', distance_km: '', is_shakedown: false, is_open: true, track_condition: 'DRY' });
    }
    setIsStageModalOpen(true);
  };

  const handleStageSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...stageForm,
        ss_order: parseInt(stageForm.ss_order),
        distance_km: parseFloat(stageForm.distance_km),
        is_shakedown: Boolean(stageForm.is_shakedown),
        is_open: stageForm.is_open ?? true,
        track_condition: stageForm.track_condition === 'WET' ? 'WET' : 'DRY',
      };
      
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

  const handleToggleStageOpen = async (stage) => {
    const nextIsOpen = !(stage.is_open ?? true);
    const actionLabel = nextIsOpen ? 'open' : 'close';
    if (!window.confirm(`${actionLabel === 'close' ? 'Close' : 'Open'} ${stage.ss_name}?`)) return;

    try {
      await api.put(`/admin/events/${id}/stages/${stage.id}`, {
        ss_name: stage.ss_name,
        ss_order: Number(stage.ss_order),
        distance_km: Number(stage.distance_km),
        is_shakedown: Boolean(stage.is_shakedown),
        is_open: nextIsOpen,
        track_condition: (stage.track_condition || 'DRY').toUpperCase() === 'WET' ? 'WET' : 'DRY',
      });
      fetchEventData();
    } catch (err) {
      alert(`Gagal mengubah status SS menjadi ${actionLabel}`);
    }
  };

  // ==========================================
  // HANDLER PESERTA (PARTICIPANTS)
  // ==========================================
  const openParticipantModal = (p = null) => {
    if (p) {
      setEditingParticipantId(p.id);
      setVehicleEntryMode(p.join_car_with_participant_id ? 'join' : 'own');
      setJoinCarParticipantId(p.join_car_with_participant_id || '');
      setParticipantForm({
        start_number: p.start_number, entrant_name: p.entrant_name, driver_id: p.driver_id, 
        codriver_id: p.codriver_id, team_id: p.team_id || '', vehicle_id: p.vehicle_id, 
        join_car_with_participant_id: p.join_car_with_participant_id || '', class_id: p.class_id, category_id: p.category_id
      });
    } else {
      setEditingParticipantId(null);
      setVehicleEntryMode('own');
      setJoinCarParticipantId('');
      setParticipantForm({
        start_number: '', entrant_name: '', driver_id: '', codriver_id: '', 
        team_id: '', vehicle_id: '', join_car_with_participant_id: '', class_id: '', category_id: ''
      });
    }
    setIsParticipantModalOpen(true);
  };

  const handleVehicleEntryModeChange = (mode) => {
    setVehicleEntryMode(mode);
    setJoinCarParticipantId('');
    if (mode === 'join') {
      setParticipantForm((current) => ({ ...current, vehicle_id: '', join_car_with_participant_id: '' }));
    } else {
      setParticipantForm((current) => ({ ...current, join_car_with_participant_id: '' }));
    }
  };

  const handleJoinCarParticipantChange = (participantId) => {
    const sourceParticipant = participants.find((participant) => participant.id === participantId);
    setJoinCarParticipantId(participantId);
    setParticipantForm((current) => ({
      ...current,
      vehicle_id: sourceParticipant?.vehicle_id || '',
      join_car_with_participant_id: participantId,
    }));
  };

  const handleParticipantSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = [
      ['driver_id', 'Driver'],
      ['codriver_id', 'Navigator'],
      ['vehicle_id', 'Kendaraan'],
      ['class_id', 'Kelas'],
      ['category_id', 'Kategori'],
    ];
    const missingField = requiredFields.find(([key]) => !participantForm[key]);
    if (missingField) return alert(`${missingField[1]} wajib dipilih.`);
    if (vehicleEntryMode === 'join' && !participantForm.join_car_with_participant_id) {
      return alert('Peserta sumber join car wajib dipilih.');
    }

    try {
      const payload = {
        ...participantForm,
        start_number: parseInt(participantForm.start_number),
        join_car_with_participant_id: vehicleEntryMode === 'join' ? participantForm.join_car_with_participant_id : '',
      };
      
      if (editingParticipantId) {
        await api.put(`/admin/events/${id}/participants/${editingParticipantId}`, payload);
      } else {
        await api.post(`/admin/events/${id}/participants`, payload);
      }

      setIsParticipantModalOpen(false);
      fetchEventData();
    } catch (err) { alert('Gagal menyimpan peserta'); }
  };

  const handleImportEntryListExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsImportingEntryList(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (rows.length === 0) return alert('File Excel kosong.');

      let nextRacers = [...racers];
      let nextTeams = [...teams];
      let nextVehicles = [...vehicles];
      let nextRegions = [...regions];
      const participantsByStartNumber = new Map(participants.map((participant) => [String(participant.start_number).trim(), participant]));
      const stats = {
        createdParticipants: 0,
        updatedParticipants: 0,
        createdRacers: 0,
        updatedRacers: 0,
        createdTeams: 0,
        createdVehicles: 0,
        createdRegions: 0,
        joinedParticipants: 0,
      };
      const errors = [];
      const joinUpdates = [];
      const importToken = Date.now();

      const findRacer = (name, kisNumber) => {
        const normalizedKIS = normalizeLookupText(kisNumber);
        const normalizedName = normalizeLookupText(name);
        return nextRacers.find((racer) => (
          (normalizedKIS && normalizeLookupText(racer.kis_number) === normalizedKIS) ||
          (normalizedName && normalizeLookupText(racer.full_name) === normalizedName)
        ));
      };

      const ensureRegion = async (name) => {
        const regionName = cleanExcelText(name);
        if (!regionName) return '';
        const existing = findMasterByText(nextRegions, regionName, (region) => [region.name]);
        if (existing) return existing.id;

        const response = await api.post('/admin/regions', { name: regionName });
        const created = response.data.data;
        nextRegions = [...nextRegions, created];
        stats.createdRegions += 1;
        return created.id;
      };

      const ensureRacer = async ({ name, kisNumber, gender, dob, bloodType, regionName, role, rowNumber }) => {
        const fullName = cleanExcelText(name);
        if (!fullName) throw new Error(`${role === 'driver' ? 'Driver' : 'Navigator'} wajib diisi.`);

        const existing = findRacer(fullName, kisNumber);
        const importedRegionName = cleanExcelText(regionName);
        const regionId = importedRegionName ? await ensureRegion(importedRegionName) : existing?.region_id || '';
        const rolePatch = {
          is_driver: role === 'driver' || Boolean(existing?.is_driver),
          is_codriver: role === 'navigator' || Boolean(existing?.is_codriver),
        };

        if (existing) {
          const payload = {
            kis_number: cleanExcelText(kisNumber) || existing.kis_number,
            full_name: fullName || existing.full_name,
            gender: normalizeRacerGender(gender) || existing.gender || 'L',
            dob: normalizeExcelDate(dob) || formatExistingRacerDate(existing.dob) || DEFAULT_IMPORT_RACER_DOB,
            blood_type: normalizeBloodType(bloodType) || existing.blood_type || 'O',
            region_id: regionId,
            ...rolePatch,
          };
          const needsUpdate = Object.keys(payload).some((key) => {
            const existingValue = key === 'dob' ? formatExistingRacerDate(existing[key]) : existing[key];
            return normalizePayloadValue(existingValue) !== normalizePayloadValue(payload[key]);
          });
          if (needsUpdate) {
            const response = await api.put(`/admin/racers/${existing.id}`, payload);
            const updated = response.data.data || { ...existing, ...payload };
            nextRacers = nextRacers.map((racer) => (racer.id === existing.id ? updated : racer));
            stats.updatedRacers += 1;
            return updated;
          }
          return existing;
        }

        const payload = {
          kis_number: cleanExcelText(kisNumber) || generateImportedKIS(fullName, role, rowNumber, importToken),
          full_name: fullName,
          gender: normalizeRacerGender(gender) || 'L',
          dob: normalizeExcelDate(dob) || DEFAULT_IMPORT_RACER_DOB,
          blood_type: normalizeBloodType(bloodType) || 'O',
          region_id: regionId,
          is_driver: role === 'driver',
          is_codriver: role === 'navigator',
        };
        const response = await api.post('/admin/racers', payload);
        const created = response.data.data;
        nextRacers = [...nextRacers, created];
        stats.createdRacers += 1;
        return created;
      };

      const ensureTeam = async (name) => {
        const teamName = cleanExcelText(name);
        if (!teamName) return '';
        const existing = findMasterByText(nextTeams, teamName, (team) => [team.name]);
        if (existing) return existing.id;

        const response = await api.post('/admin/teams', { name: teamName, manager_name: '' });
        const created = response.data.data;
        nextTeams = [...nextTeams, created];
        stats.createdTeams += 1;
        return created.id;
      };

      const ensureVehicle = async ({ brand, type, label, engineCapacity }) => {
        const vehicleBrand = cleanExcelText(brand);
        const vehicleType = cleanExcelText(type);
        const vehicleLabel = cleanExcelText(label) || [vehicleBrand, vehicleType].filter(Boolean).join(' ');
        if (!vehicleLabel && !vehicleBrand && !vehicleType) throw new Error('Kendaraan wajib diisi.');

        const existing = findMasterByText(nextVehicles, vehicleLabel || `${vehicleBrand} ${vehicleType}`, (vehicle) => [
          vehicle.brand,
          vehicle.type,
          `${vehicle.brand || ''} ${vehicle.type || ''}`,
          `${vehicle.brand || ''} - ${vehicle.type || ''}`,
        ]);
        if (existing) return existing.id;

        const response = await api.post('/admin/vehicles', {
          brand: vehicleBrand || vehicleLabel,
          type: vehicleType,
          engine_capacity: parseEngineCapacity(engineCapacity),
        });
        const created = response.data.data;
        nextVehicles = [...nextVehicles, created];
        stats.createdVehicles += 1;
        return created.id;
      };

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        try {
          const startNumber = parseStartNumber(readExcelValue(row, ['NO START', 'START NO', 'CAR NO', 'CARNO', 'NO', 'NOMOR START']));
          if (!startNumber) throw new Error('No Start wajib berupa angka.');

          const entrantName = cleanExcelText(readExcelValue(row, ['ENTRANT', 'ENTRANT NAME', 'NAMA ENTRANT', 'TEAM', 'TIM', 'NAMA TEAM']));
          const driver = await ensureRacer({
            name: readExcelValue(row, ['DRIVER', 'DIRVER', 'DRIVER NAME', 'NAMA DRIVER', 'PEMBALAP', 'RACER']),
            kisNumber: readExcelValue(row, ['KIS', 'DRIVER KIS', 'KIS DRIVER', 'NO KIS DRIVER', 'KIS PEMBALAP']),
            gender: readExcelValue(row, ['DRIVER GENDER', 'GENDER DRIVER', 'JK DRIVER']),
            dob: readExcelValue(row, ['DRIVER DOB', 'DOB DRIVER', 'TGL LAHIR DRIVER', 'TANGGAL LAHIR DRIVER']),
            bloodType: readExcelValue(row, ['DRIVER BLOOD', 'BLOOD DRIVER', 'GOL DARAH DRIVER']),
            regionName: readExcelValue(row, ['DRIVER REGION', 'DRIVER REGIONAL', 'REGION DRIVER', 'REGIONAL DRIVER', 'ASAL DRIVER', 'DAERAH DRIVER', 'KOTA DRIVER', 'PROVINSI DRIVER', 'REGION', 'REGIONAL']),
            role: 'driver',
            rowNumber,
          });
          const navigator = await ensureRacer({
            name: readExcelValue(row, ['NAVIGATOR', 'NAVIGATOR NAME', 'NAMA NAVIGATOR', 'CO DRIVER', 'CODRIVER', 'CO-DRIVER', 'NAMA CO DRIVER']),
            kisNumber: readExcelValue(row, ['NAVIGATOR KIS', 'KIS NAVIGATOR', 'NO KIS NAVIGATOR', 'CODRIVER KIS', 'KIS CODRIVER']),
            gender: readExcelValue(row, ['NAVIGATOR GENDER', 'GENDER NAVIGATOR', 'JK NAVIGATOR', 'CODRIVER GENDER']),
            dob: readExcelValue(row, ['NAVIGATOR DOB', 'DOB NAVIGATOR', 'TGL LAHIR NAVIGATOR', 'TANGGAL LAHIR NAVIGATOR', 'CODRIVER DOB']),
            bloodType: readExcelValue(row, ['NAVIGATOR BLOOD', 'BLOOD NAVIGATOR', 'GOL DARAH NAVIGATOR', 'CODRIVER BLOOD']),
            regionName: readExcelValue(row, ['NAVIGATOR REGION', 'NAVIGATOR REGIONAL', 'REGION NAVIGATOR', 'REGIONAL NAVIGATOR', 'ASAL NAVIGATOR', 'DAERAH NAVIGATOR', 'KOTA NAVIGATOR', 'PROVINSI NAVIGATOR', 'CODRIVER REGION', 'REGION', 'REGIONAL']),
            role: 'navigator',
            rowNumber,
          });

          const classValue = readExcelValue(row, ['CLASS', 'KELAS']);
          const classItem = findMasterByText(classes, classValue, (item) => [item.code, item.name, `${item.code} ${item.name}`, `${item.code} - ${item.name}`]);
          if (!classItem) throw new Error(`Class "${classValue || '-'}" tidak ditemukan di master class.`);

          const categoryValue = readExcelValue(row, ['CATEGORY', 'KATEGORI', 'SEED', 'SEEDED']);
          const categoryItem = findMasterByText(categories, categoryValue, (item) => [item.code, item.description, `${item.code} ${item.description || ''}`]);
          if (!categoryItem) throw new Error(`Kategori "${categoryValue || '-'}" tidak ditemukan di master category.`);

          const teamId = await ensureTeam(readExcelValue(row, ['TEAM', 'TIM', 'NAMA TEAM']) || entrantName);
          const vehicleId = await ensureVehicle({
            brand: readExcelValue(row, ['BRAND', 'MERK', 'MEREK']),
            type: readExcelValue(row, ['TYPE', 'TIPE', 'MODEL']),
            label: readExcelValue(row, ['VEHICLE', 'KENDARAAN', 'MOBIL', 'CAR']),
            engineCapacity: readExcelValue(row, ['CC', 'ENGINE', 'ENGINE CAPACITY', 'KAPASITAS MESIN']),
          });

          const payload = {
            start_number: startNumber,
            entrant_name: entrantName || cleanExcelText(readExcelValue(row, ['TEAM', 'TIM', 'NAMA TEAM'])) || driver.full_name,
            driver_id: driver.id,
            codriver_id: navigator.id,
            team_id: teamId,
            vehicle_id: vehicleId,
            join_car_with_participant_id: participantsByStartNumber.get(String(startNumber))?.join_car_with_participant_id || '',
            class_id: classItem.id,
            category_id: categoryItem.id,
          };
          const joinStartNumber = parseStartNumber(readExcelValue(row, ['JOIN', 'JOIN CAR', 'JOIN WITH', 'JOIN CAR WITH']));

          const existingParticipant = participantsByStartNumber.get(String(startNumber));
          if (existingParticipant) {
            await api.put(`/admin/events/${id}/participants/${existingParticipant.id}`, payload);
            participantsByStartNumber.set(String(startNumber), { ...existingParticipant, ...payload });
            stats.updatedParticipants += 1;
          } else {
            const response = await api.post(`/admin/events/${id}/participants`, payload);
            participantsByStartNumber.set(String(startNumber), response.data.data || payload);
            stats.createdParticipants += 1;
          }
          if (joinStartNumber) joinUpdates.push({ rowNumber, startNumber, joinStartNumber });
        } catch (err) {
          errors.push(`Baris ${rowNumber}: ${err.response?.data?.error || err.message}`);
        }
      }

      for (const joinUpdate of joinUpdates) {
        try {
          if (joinUpdate.startNumber === joinUpdate.joinStartNumber) {
            throw new Error('Join tidak boleh ke nomor start yang sama.');
          }
          const targetParticipant = participantsByStartNumber.get(String(joinUpdate.startNumber));
          const sourceParticipant = participantsByStartNumber.get(String(joinUpdate.joinStartNumber));
          if (!targetParticipant?.id) throw new Error(`No Start ${joinUpdate.startNumber} tidak ditemukan untuk join.`);
          if (!sourceParticipant?.id) throw new Error(`No Start sumber join ${joinUpdate.joinStartNumber} tidak ditemukan.`);

          const payload = {
            ...targetParticipant,
            join_car_with_participant_id: sourceParticipant.id,
            vehicle_id: sourceParticipant.vehicle_id || targetParticipant.vehicle_id,
          };
          await api.put(`/admin/events/${id}/participants/${targetParticipant.id}`, payload);
          participantsByStartNumber.set(String(joinUpdate.startNumber), payload);
          stats.joinedParticipants += 1;
        } catch (err) {
          errors.push(`Baris ${joinUpdate.rowNumber}: ${err.response?.data?.error || err.message}`);
        }
      }

      setRacers(nextRacers);
      setTeams(nextTeams);
      setVehicles(nextVehicles);
      setRegions(nextRegions);
      await Promise.all([fetchMasterData(), fetchEventData()]);

      const summary = [
        `${stats.createdParticipants} peserta baru`,
        `${stats.updatedParticipants} peserta diupdate`,
        `${stats.createdRacers} racer baru`,
        `${stats.updatedRacers} racer diupdate`,
        `${stats.createdRegions} regional baru`,
        `${stats.createdTeams} team baru`,
        `${stats.createdVehicles} kendaraan baru`,
        `${stats.joinedParticipants} join car`,
        errors.length ? `${errors.length} baris gagal` : '',
      ].filter(Boolean).join(', ');
      setEntryListImportSummary(`${file.name}: ${summary}.`);
      alert(errors.length ? `${summary}.\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...' : ''}` : `Import selesai: ${summary}.`);
    } catch (err) {
      alert(err.message || 'Gagal membaca file Excel entry list.');
    } finally {
      setIsImportingEntryList(false);
    }
  };

  const handleDeleteParticipant = async (participantId) => {
    if (!window.confirm('Cabut pendaftaran peserta ini dari event?')) return;
    try {
      await api.delete(`/admin/events/${id}/participants/${participantId}`);
      fetchEventData();
    } catch (err) { alert('Gagal menghapus peserta'); }
  };

  const handleDeleteAllParticipants = async () => {
    if (participants.length === 0) return alert('Entry list masih kosong.');
    const confirmed = window.confirm(
      `Hapus SEMUA ${participants.length} peserta dari entry list event ini?\n\nData catatan waktu, starting list, dan relasi peserta yang terkait bisa ikut terhapus. Aksi ini tidak bisa dibatalkan.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/admin/events/${id}/participants`);
      setEntryListImportSummary('');
      await fetchEventData();
      alert('Semua entry list berhasil dihapus.');
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus semua entry list.');
    }
  };

  const handleSetWithdraw = async (participant) => {
    if (!selectedTCStageId) return alert('Pilih SS terlebih dahulu.');
    const stageLabel = selectedTCStage ? `SS ${selectedTCStage.ss_order} - ${selectedTCStage.ss_name}` : 'SS ini';
    const reason = window.prompt(`Alasan withdraw untuk #${participant.start_number} mulai ${stageLabel}:`, participant.withdraw_reason || '');
    if (reason === null) return;
    if (!window.confirm(`Tandai #${participant.start_number} withdraw mulai ${stageLabel}?`)) return;

    setSavingWithdrawParticipantId(participant.id);
    try {
      await api.put(`/admin/events/${id}/participants/${participant.id}/withdraw`, {
        withdraw_from_stage_id: selectedTCStageId,
        withdraw_reason: reason.trim(),
      });
      await fetchEventData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menandai peserta withdraw.');
    } finally {
      setSavingWithdrawParticipantId('');
    }
  };

  const handleClearWithdraw = async (participant) => {
    if (!window.confirm(`Batalkan status withdraw untuk #${participant.start_number}?`)) return;

    setSavingWithdrawParticipantId(participant.id);
    try {
      await api.delete(`/admin/events/${id}/participants/${participant.id}/withdraw`);
      await fetchEventData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membatalkan status withdraw.');
    } finally {
      setSavingWithdrawParticipantId('');
    }
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

  function getJoinCarParticipants(participant) {
    if (!participant?.id) return [];
    return participants
      .filter((item) => item.join_car_with_participant_id === participant.id || participant.join_car_with_participant_id === item.id)
      .sort((a, b) => Number(a.start_number) - Number(b.start_number));
  }

  function getJoinCarSource(participant) {
    if (!participant?.join_car_with_participant_id) return null;
    return participants.find((item) => item.id === participant.join_car_with_participant_id) || null;
  }

  function getJoinCarOptions() {
    return participants
      .filter((participant) => participant.id !== editingParticipantId && participant.vehicle_id)
      .sort((a, b) => Number(a.start_number) - Number(b.start_number))
      .map((participant) => ({
        value: participant.id,
        label: `#${participant.start_number} - ${getRacerName(participant.driver_id)} (${getVehicleName(participant.vehicle_id)})`,
      }));
  }

  function getStageLabel(stageId) {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return 'SS';
    return `SS ${stage.ss_order}${stage.ss_name ? ` - ${stage.ss_name}` : ''}`;
  }

  function isWithdrawActiveOnSelectedStage(participant) {
    if (!participant?.withdraw_from_stage_id || !selectedTCStage) return false;
    const withdrawStage = stages.find((stage) => stage.id === participant.withdraw_from_stage_id);
    if (!withdrawStage) return true;
    return Number(selectedTCStage.ss_order) >= Number(withdrawStage.ss_order);
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
    return tcStatusLabel(status);
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
          <button onClick={() => navigate(-1)} className="admin-btn-muted">
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
            Starting List
          </button>
        </div>

        {/* --- TAB KONTEN: SPECIAL STAGES --- */}
        {activeTab === 'stages' && (
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Rute Balap & Shakedown</h3>
                <p className="text-xs text-gray-500">Total {officialStages.length} SS resmi dan {shakedownCount} shakedown terdaftar.</p>
              </div>
              <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Cari nama, urutan, jenis, atau jarak..."
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
              <button onClick={() => openStageModal()} className="admin-btn-primary">+ Tambah Stage</button>
            </div>
            
            <table className="w-full text-left border-collapse border border-gray-200 rounded overflow-hidden">
              <thead className="bg-gray-100 text-sm">
                <tr>
                  <th className="p-3">Urutan</th>
                  <th className="p-3">Jenis</th>
                  <th className="p-3">Nama Stage</th>
                  <th className="p-3">Jarak (KM)</th>
                  <th className="p-3">Kondisi</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan="7" className="text-center p-4 text-gray-500">Memuat...</td></tr> :
                  currentStages.length === 0 ? <tr><td colSpan="7" className="text-center p-4 text-gray-500">Data tidak ditemukan.</td></tr> :
                  currentStages.map(ss => (
                    <tr key={ss.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-bold text-red-600">{ss.is_shakedown ? '-' : `SS ${ss.ss_order}`}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${ss.is_shakedown ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {ss.is_shakedown ? 'Shakedown' : 'Special Stage'}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{ss.ss_name}</td>
                      <td className="p-3 text-gray-600">{ss.distance_km} km</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${String(ss.track_condition || 'DRY').toUpperCase() === 'WET' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                          {String(ss.track_condition || 'DRY').toUpperCase() === 'WET' ? 'Wet' : 'Dry'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${ss.is_open ?? true ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                          {ss.is_open ?? true ? 'Open' : 'Close'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-3">
                        <button onClick={() => handleToggleStageOpen(ss)} className={ss.is_open ?? true ? 'admin-btn-muted' : 'admin-btn-edit'}>
                          {ss.is_open ?? true ? 'Close' : 'Open'}
                        </button>
                        <button onClick={() => openStageModal(ss)} className="admin-btn-edit">Edit</button>
                        <button onClick={() => handleDeleteStage(ss.id)} className="admin-btn-delete">Hapus</button>
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
                  placeholder="Cari entrant, driver, navigator, mobil, atau no start..."
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
                <label className={`admin-btn-muted whitespace-nowrap cursor-pointer ${isImportingEntryList ? 'opacity-60 pointer-events-none' : ''}`}>
                  {isImportingEntryList ? 'Import...' : 'Import Excel'}
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    disabled={isImportingEntryList}
                    onChange={handleImportEntryListExcel}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDeleteAllParticipants}
                  disabled={participants.length === 0 || isImportingEntryList}
                  className="admin-btn-delete whitespace-nowrap px-4 py-2 uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Hapus Semua
                </button>
                <button onClick={() => openParticipantModal()} className="admin-btn-primary whitespace-nowrap">+ Peserta</button>
              </div>
            </div>
            {entryListImportSummary && (
              <div className="mb-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">
                {entryListImportSummary}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead className="bg-gray-100 text-sm">
                  <tr>
                    <th className="p-3 text-center">No Start</th>
                    <th className="p-3">Nama Entrant / Tim</th>
                    <th className="p-3">Driver / Navigator</th>
                    <th className="p-3">Mobil</th>
                    <th className="p-3 text-center">QR Timecard</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentParticipants.length === 0 ? <tr><td colSpan="6" className="text-center p-8 text-gray-500">Tidak ada peserta ditemukan.</td></tr> :
                    currentParticipants.map(p => {
                      const joinSource = getJoinCarSource(p);
                      const joinedBy = getJoinCarParticipants(p).filter((item) => item.join_car_with_participant_id === p.id);
                      return (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                        <td className="p-3 text-center">
                          <span className="bg-black text-white font-black text-xl px-3 py-1 rounded">{p.start_number}</span>
                        </td>
                        <td className="p-3 font-bold">{p.entrant_name}</td>
                        <td className="p-3 text-sm">
                          <div className="font-semibold text-gray-800">{getRacerName(p.driver_id)}</div>
                          <div className="text-gray-500">Navigator: {getRacerName(p.codriver_id)}</div>
                        </td>
                        <td className="p-3 text-sm font-medium text-gray-700">
                          <div>{getVehicleName(p.vehicle_id)}</div>
                          {joinSource && (
                            <div className="mt-1 inline-flex rounded bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800">
                              Join dengan #{joinSource.start_number}
                            </div>
                          )}
                          {joinedBy.length > 0 && (
                            <div className="mt-1 inline-flex rounded bg-blue-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-800">
                              Dipakai #{joinedBy.map((item) => item.start_number).join(', #')}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <TimecardQR value={getTimecardUrl(p)} />
                        </td>
                        <td className="p-3 text-right space-x-3">
                          <a href={getTimecardUrl(p)} target="_blank" rel="noreferrer" className="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700 transition hover:bg-green-200">Timecard</a>
                          <button onClick={() => openParticipantModal(p)} className="admin-btn-edit">Edit</button>
                          <button onClick={() => handleDeleteParticipant(p.id)} className="admin-btn-delete">Hapus</button>
                        </td>
                      </tr>
                    );
                    })
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
                <h3 className="text-lg font-bold text-gray-800">Starting List per SS</h3>
                <p className="text-xs text-gray-500">Atur starting list per SS lalu generate target TC otomatis berdasarkan interval.</p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto xl:grid-cols-[220px_260px_110px]">
                <select
                  className="w-full p-2 border border-gray-300 rounded text-sm outline-none bg-white focus:ring-1 focus:ring-red-500"
                  value={selectedTCStageId}
                  onChange={(e) => setSelectedTCStageId(e.target.value)}
                >
                  <option value="">-- Pilih SS --</option>
                  {officialStages.map((stage) => <option key={stage.id} value={stage.id}>SS {stage.ss_order} : {stage.ss_name}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Cari no start, entrant, driver, atau status..."
                  className="w-full p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-red-500"
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

            <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[1fr_auto_170px_130px_auto_auto] lg:items-end">
              <div>
                <p className="text-sm font-black text-gray-800 uppercase">Generate Jadwal TC</p>
                <p className="mt-1 text-xs text-gray-500">Simpan urutan start, isi jam TC peserta pertama, lalu generate sesuai interval.</p>
                {startingListImportSummary && <p className="mt-2 text-xs font-bold text-green-700">{startingListImportSummary}</p>}
              </div>
              <label className="admin-btn-muted cursor-pointer text-center">
                Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImportStartingListExcel}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-gray-500">TC peserta pertama</span>
                <input
                  type="time"
                  step="1"
                  className="w-full rounded border border-gray-300 bg-white p-2 font-mono text-sm outline-none focus:ring-1 focus:ring-red-500"
                  value={tcGenerateForm.first_target_tc_time}
                  onChange={(e) => setTcGenerateForm({ ...tcGenerateForm, first_target_tc_time: e.target.value })}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-gray-500">Interval menit</span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded border border-gray-300 bg-white p-2 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500"
                  value={tcGenerateForm.interval_minutes}
                  onChange={(e) => setTcGenerateForm({ ...tcGenerateForm, interval_minutes: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={handleSaveStartingList}
                disabled={!selectedTCStageId || isSavingStartingList || isGeneratingTC}
                className="admin-btn-dark"
              >
                {isSavingStartingList ? 'Menyimpan...' : 'Simpan Starting List'}
              </button>
              <button
                type="button"
                onClick={handleGenerateTCTargets}
                disabled={!selectedTCStageId || isGeneratingTC}
                className="admin-btn-primary"
              >
                {isGeneratingTC ? 'Generate...' : 'Generate TC'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-200">
                <thead className="bg-gray-100 text-sm">
                  <tr>
                    <th className="p-3 text-center">Start Ke</th>
                    <th className="p-3 text-center">No Start</th>
                    <th className="p-3">Peserta</th>
                    <th className="p-3 text-center">Target TC</th>
                    <th className="p-3 text-center">Aktual TC</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Withdraw</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedTCStageId ? (
                    <tr><td colSpan="8" className="text-center p-8 text-gray-500">Pilih SS untuk mengatur starting list.</td></tr>
                  ) : currentTCRows.length === 0 ? (
                    <tr><td colSpan="8" className="text-center p-8 text-gray-500">Tidak ada peserta ditemukan.</td></tr>
                  ) : currentTCRows.map((row) => {
                    const isWithdrawActive = isWithdrawActiveOnSelectedStage(row);
                    return (
                    <tr key={row.id} className={`border-b border-gray-100 transition ${isWithdrawActive ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'}`}>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="1"
                          className="w-20 rounded border border-gray-300 p-2 text-center text-sm font-black outline-none focus:ring-1 focus:ring-red-500"
                          value={startOrderDrafts[row.id] ?? row.start_order ?? ''}
                          onChange={(e) => setStartOrderDrafts({ ...startOrderDrafts, [row.id]: e.target.value })}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-black text-white font-black text-xl px-3 py-1 rounded">{row.start_number}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-gray-800">{getRacerName(row.driver_id)}</div>
                        <div className="text-xs text-gray-500">{row.entrant_name || '-'}</div>
                        {row.withdraw_from_stage_id && (
                          <div className="mt-1 text-[11px] font-bold text-red-600">
                            Withdraw mulai {getStageLabel(row.withdraw_from_stage_id)}
                            {row.withdraw_reason ? ` - ${row.withdraw_reason}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="time"
                          step="1"
                          className="w-36 p-2 border border-gray-300 rounded font-mono text-sm outline-none focus:ring-1 focus:ring-red-500"
                          value={(row.target_tc_time || '').slice(0, 8)}
                          onChange={(e) => setTcTargetDrafts({ ...tcTargetDrafts, [row.id]: e.target.value })}
                          disabled={isWithdrawActive}
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
                      <td className="p-3 text-center">
                        {row.withdraw_from_stage_id ? (
                          <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${isWithdrawActive ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isWithdrawActive ? 'WITHDRAW' : 'AKAN WD'}
                          </span>
                        ) : (
                          <span className="rounded bg-green-100 px-2 py-1 text-[10px] font-black uppercase text-green-700">Aktif</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSaveTCTarget(row.id)}
                            disabled={savingTCParticipantId === row.id || isWithdrawActive}
                            className="admin-btn-primary"
                          >
                            {savingTCParticipantId === row.id ? 'MENYIMPAN...' : 'TARGET'}
                          </button>
                          {row.withdraw_from_stage_id ? (
                            <button
                              onClick={() => handleClearWithdraw(row)}
                              disabled={savingWithdrawParticipantId === row.id}
                              className="admin-btn-muted"
                            >
                              {savingWithdrawParticipantId === row.id ? '...' : 'BATAL WD'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetWithdraw(row)}
                              disabled={savingWithdrawParticipantId === row.id}
                              className="admin-btn-dark"
                            >
                              {savingWithdrawParticipantId === row.id ? '...' : 'WD'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})}
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
                <button onClick={() => openPenaltyModal()} className="admin-btn-dark">
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
                          <button onClick={() => openPenaltyModal(p)} className="admin-btn-edit">Edit</button>
                          <button onClick={() => handleDeletePenalty(p.id)} className="admin-btn-delete">Hapus</button>
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
      <Modal isOpen={isStageModalOpen} onClose={() => setIsStageModalOpen(false)} title={editingStageId ? "Edit Stage" : "Tambah Stage"}>
        <form onSubmit={handleStageSubmit} className="p-6 space-y-4">
          <label className="flex items-center gap-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm font-bold text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(stageForm.is_shakedown)}
              onChange={(e) => setStageForm({ ...stageForm, is_shakedown: e.target.checked })}
              className="h-4 w-4 accent-red-600"
            />
            Shakedown
          </label>
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Urutan</label>
              <input type="number" required min="0" className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none" value={stageForm.ss_order} onChange={e => setStageForm({...stageForm, ss_order: e.target.value})} />
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-bold text-gray-700 mb-1">Jarak (KM)</label>
              <input type="number" required step="0.01" className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none" value={stageForm.distance_km} onChange={e => setStageForm({...stageForm, distance_km: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nama / Lokasi Stage</label>
            <input type="text" required placeholder={stageForm.is_shakedown ? 'Contoh: Shakedown Area' : 'Contoh: SS1 - Cikampek'} className="w-full p-2 border border-gray-300 rounded focus:ring-red-500 outline-none" value={stageForm.ss_name} onChange={e => setStageForm({...stageForm, ss_name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Kondisi Lintasan</label>
            <select
              className="w-full p-2 border border-gray-300 rounded bg-white focus:ring-red-500 outline-none"
              value={stageForm.track_condition}
              onChange={(e) => setStageForm({ ...stageForm, track_condition: e.target.value })}
            >
              <option value="DRY">Dry</option>
              <option value="WET">Wet</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">Kondisi ini menentukan BWTM Dry/Wet yang dipakai saat DNF, DNS, atau BWTM.</p>
          </div>
          <div className="pt-4 flex justify-end">
            <button type="submit" className="admin-btn-primary">
              {editingStageId ? 'Update Stage' : 'Simpan Stage'}
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
                label="Navigator"
                placeholder="Cari navigator..."
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
              <label className="block text-sm font-bold text-gray-700 mb-1">Kendaraan <span className="text-red-600">*</span></label>
              <div className="mb-2 grid grid-cols-2 gap-2 rounded border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => handleVehicleEntryModeChange('own')}
                  className={`rounded px-3 py-2 text-xs font-black uppercase ${vehicleEntryMode === 'own' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:bg-white'}`}
                >
                  Mobil Sendiri
                </button>
                <button
                  type="button"
                  onClick={() => handleVehicleEntryModeChange('join')}
                  className={`rounded px-3 py-2 text-xs font-black uppercase ${vehicleEntryMode === 'join' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:bg-white'}`}
                >
                  Join Car
                </button>
              </div>
              {vehicleEntryMode === 'join' ? (
                <div className="space-y-2">
                  <SearchableSelect
                    label="Pakai mobil peserta"
                    placeholder="Pilih no start sumber mobil..."
                    value={joinCarParticipantId}
                    options={getJoinCarOptions()}
                    onChange={handleJoinCarParticipantChange}
                    required
                  />
                  <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-800">
                    Mobil yang dipakai: <span className="font-black">{getVehicleName(participantForm.vehicle_id)}</span>
                    {joinCarParticipantId && (
                      <div className="mt-1">Relasi join car disimpan ke peserta #{participants.find((participant) => participant.id === joinCarParticipantId)?.start_number || '-'}</div>
                    )}
                  </div>
                </div>
              ) : (
                <SearchableSelect
                  label="Pilih kendaraan"
                  placeholder="Cari kendaraan..."
                  value={participantForm.vehicle_id}
                  options={vehicles.map(v => ({ value: v.id, label: `${v.brand} - ${v.type}` }))}
                  onChange={(value) => setParticipantForm({ ...participantForm, vehicle_id: value })}
                  required
                />
              )}
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
            <button type="submit" className="admin-btn-submit">
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
          <button type="submit" className="admin-btn-submit">
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

function readExcelValue(row, candidateHeaders) {
  const entries = Object.entries(row);
  for (const header of candidateHeaders) {
    const normalizedHeader = normalizeExcelHeader(header);
    const match = entries.find(([key]) => normalizeExcelHeader(key) === normalizedHeader);
    if (match) return match[1];
  }
  return '';
}

function normalizeExcelHeader(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === '*') return '*';
  return text.replace(/[^A-Z0-9]/g, '');
}

function normalizeImportedClock(value) {
  if (value === null || value === undefined) return '';
  let text = String(value).trim();
  if (!text) return '';

  text = text.replace(',', ':');
  if (/^\d{1,2}\.\d{2}(?:\.\d{2})?$/.test(text)) {
    text = text.replace(/\./g, ':');
  }
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hour, minute] = text.split(':');
    return `${hour.padStart(2, '0')}:${minute}:00`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) {
    const [hour, minute, second] = text.split(':');
    return `${hour.padStart(2, '0')}:${minute}:${second}`;
  }
  return text.slice(0, 8);
}

function cleanExcelText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeLookupText(value) {
  return cleanExcelText(value).toLowerCase();
}

function normalizePayloadValue(value) {
  if (typeof value === 'boolean') return value;
  return cleanExcelText(value);
}

function findMasterByText(items, value, getCandidates) {
  const normalizedValue = normalizeLookupText(value);
  if (!normalizedValue) return null;
  return items.find((item) => getCandidates(item).some((candidate) => normalizeLookupText(candidate) === normalizedValue)) || null;
}

function parseStartNumber(value) {
  const text = cleanExcelText(value);
  if (!text) return 0;
  const number = Number.parseInt(text.replace(/[^\d]/g, ''), 10);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function parseEngineCapacity(value) {
  const number = Number.parseInt(cleanExcelText(value).replace(/[^\d]/g, ''), 10);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function normalizeRacerGender(value) {
  const text = normalizeLookupText(value);
  if (!text) return '';
  if (['p', 'perempuan', 'f', 'female', 'wanita'].includes(text)) return 'P';
  return 'L';
}

function normalizeBloodType(value) {
  const text = cleanExcelText(value).toUpperCase().replace(/[^ABO]/g, '');
  return ['A', 'B', 'AB', 'O'].includes(text) ? text : '';
}

function normalizeExcelDate(value) {
  const text = cleanExcelText(value);
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) return formatDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);

  const localMatch = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (localMatch) {
    let [, first, second, year] = localMatch;
    if (year.length === 2) year = Number(year) > 40 ? `19${year}` : `20${year}`;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const day = firstNumber > 12 ? first : (secondNumber > 12 ? second : first);
    const month = firstNumber > 12 ? second : (secondNumber > 12 ? first : second);
    return formatDateParts(year, month, day);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function formatDateParts(year, month, day) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatExistingRacerDate(value) {
  if (!value) return '';
  return String(value).split('T')[0];
}

function generateImportedKIS(name, role, rowNumber, token) {
  const slug = cleanExcelText(name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'RACER';
  return `IMP-${String(token).slice(-6)}-${rowNumber}-${role === 'driver' ? 'D' : 'N'}-${slug}`.slice(0, 50);
}
