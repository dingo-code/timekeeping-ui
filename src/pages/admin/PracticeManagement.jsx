/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

const emptyForm = { name: '', practice_date: '', distance_km: '', max_runs: 3, is_open: true };

export default function PracticeManagement({ eventId }) {
  const [practices, setPractices] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [drafts, setDrafts] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState({ type: '', text: '' });
  const autoSaveTimers = useRef(new Map());

  const selected = useMemo(() => practices.find((item) => item.id === selectedId), [practices, selectedId]);
  const alphabeticalCandidates = useMemo(() => [...candidates].sort((a, b) => (
    String(a.driver_name || '').localeCompare(String(b.driver_name || ''), 'id-ID', { sensitivity: 'base' }) ||
    Number(a.race_start_number || 0) - Number(b.race_start_number || 0)
  )), [candidates]);

  const loadBase = async () => {
    const [practiceRes, candidateRes] = await Promise.all([
      api.get(`/practices/events/${eventId}`),
      api.get(`/admin/events/${eventId}/practice-candidates`),
    ]);
    const nextPractices = practiceRes.data.data || [];
    setPractices(nextPractices);
    setCandidates(candidateRes.data.data || []);
    setSelectedId((current) => current || nextPractices[0]?.id || '');
  };

  const loadEntries = async (practiceId) => {
    if (!practiceId) { setDrafts({}); return; }
    setIsLoadingEntries(true);
    try {
      const res = await api.get(`/admin/practices/${practiceId}/entries`);
      const mapped = {};
      for (const entry of res.data.data || []) {
        mapped[entry.participant_id] = {
          selected: true,
          practice_start_number: entry.practice_start_number,
          start_order: entry.start_order,
        };
      }
      setDrafts(mapped);
    } finally {
      setIsLoadingEntries(false);
    }
  };

  useEffect(() => { loadBase().catch((err) => alert(err.response?.data?.error || 'Gagal memuat Practice.')); }, [eventId]);
  useEffect(() => { loadEntries(selectedId).catch((err) => alert(err.response?.data?.error || 'Gagal memuat peserta Practice.')); }, [selectedId]);
  useEffect(() => { if (selected) setEditForm({ ...selected }); }, [selected]);
  useEffect(() => () => autoSaveTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const submitPractice = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = { ...form, distance_km: Number(form.distance_km || 0), max_runs: Number(form.max_runs) };
      const res = await api.post(`/admin/events/${eventId}/practices`, payload);
      setForm(emptyForm);
      await loadBase();
      setSelectedId(res.data.data.id);
    } catch (err) { alert(err.response?.data?.error || 'Gagal membuat Practice.'); }
    finally { setIsSaving(false); }
  };

  const updateSelected = async (updates) => {
    if (!selected) return;
    try {
      await api.put(`/admin/practices/${selected.id}`, { ...selected, ...updates });
      await loadBase();
    } catch (err) { alert(err.response?.data?.error || 'Gagal memperbarui Practice.'); }
  };

  const saveConfiguration = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    await updateSelected({ ...editForm, distance_km: Number(editForm.distance_km || 0), max_runs: Number(editForm.max_runs) });
    setIsSaving(false);
  };

  const deleteSelected = async () => {
    if (!selected || !window.confirm(`Hapus ${selected.name} beserta seluruh run?`)) return;
    try { await api.delete(`/admin/practices/${selected.id}`); setSelectedId(''); await loadBase(); }
    catch (err) { alert(err.response?.data?.error || 'Gagal menghapus Practice.'); }
  };

  const persistEntry = async (participantId, draft) => {
    if (!selectedId || !draft.selected || Number(draft.practice_start_number) < 1 || Number(draft.start_order) < 1) return;
    setAutoSaveState({ type: 'saving', text: 'Menyimpan perubahan...' });
    try {
      await api.put(`/admin/practices/${selectedId}/entries/${participantId}`, {
        practice_start_number: Number(draft.practice_start_number),
        start_order: Number(draft.start_order),
      });
      setAutoSaveState({ type: 'success', text: 'Nomor Practice tersimpan otomatis.' });
    } catch (err) {
      setAutoSaveState({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan otomatis. Periksa nomor atau urutan yang duplikat.' });
    }
  };

  const updateDraft = (participantId, values) => {
    const nextDraft = { selected: false, practice_start_number: '', start_order: '', ...drafts[participantId], ...values };
    setDrafts((current) => ({ ...current, [participantId]: nextDraft }));
    const currentTimer = autoSaveTimers.current.get(participantId);
    if (currentTimer) window.clearTimeout(currentTimer);
    if (nextDraft.selected && Number(nextDraft.practice_start_number) > 0 && Number(nextDraft.start_order) > 0) {
      const timer = window.setTimeout(() => {
        autoSaveTimers.current.delete(participantId);
        persistEntry(participantId, nextDraft);
      }, 700);
      autoSaveTimers.current.set(participantId, timer);
    }
  };

  const saveEntries = async () => {
    if (isLoadingEntries) return;
    const entries = alphabeticalCandidates.filter((item) => drafts[item.participant_id]?.selected).map((item, index) => ({
      participant_id: item.participant_id,
      practice_start_number: Number(drafts[item.participant_id]?.practice_start_number),
      start_order: Number(drafts[item.participant_id]?.start_order || index + 1),
    }));
    if (entries.some((entry) => !entry.practice_start_number)) return alert('Semua peserta terpilih wajib memiliki nomor Practice.');
    setIsSaving(true);
    try { await api.put(`/admin/practices/${selectedId}/entries`, { entries }); await loadEntries(selectedId); alert('Peserta Practice berhasil disimpan.'); }
    catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan peserta Practice.'); }
    finally { setIsSaving(false); }
  };

  const downloadPracticeTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const headers = ['RACE NO', 'DRIVER', 'PRACTICE NO', 'START ORDER'];
      const rows = alphabeticalCandidates.map((item, index) => {
        const draft = drafts[item.participant_id] || {};
        return [item.race_start_number, item.driver_name, draft.practice_start_number || '', draft.start_order || index + 1];
      });
      const instructions = [
        ['PETUNJUK IMPORT NOMOR PRACTICE'],
        ['1', 'Isi PRACTICE NO untuk peserta yang mengikuti Practice.'],
        ['2', 'PRACTICE NO dan START ORDER harus berupa angka bulat positif dan tidak boleh duplikat.'],
        ['3', 'RACE NO digunakan untuk mencocokkan peserta dengan Entry List dan tidak boleh diubah.'],
        ['4', 'Baris dengan PRACTICE NO kosong akan diabaikan dan tidak menghapus data yang sudah tersimpan.'],
        ['5', 'Import file pada sesi Practice yang benar.'],
      ];
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
      sheet['!cols'] = [{ wch: 14 }, { wch: 34 }, { wch: 18 }, { wch: 18 }];
      sheet['!autofilter'] = { ref: 'A1:D1' };
      instructionSheet['!cols'] = [{ wch: 5 }, { wch: 100 }];
      XLSX.utils.book_append_sheet(workbook, sheet, 'PRACTICE PARTICIPANTS');
      XLSX.utils.book_append_sheet(workbook, instructionSheet, 'PETUNJUK');
      const safeName = String(selected?.name || 'practice').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
      XLSX.writeFile(workbook, `template-nomor-practice-${safeName || 'practice'}.xlsx`);
    } catch (err) {
      alert(err.message || 'Gagal membuat template nomor Practice.');
    }
  };

  const importPracticeNumbers = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedId) return;
    setIsImporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!rows.length) throw new Error('File Excel kosong.');

      const byRaceNumber = new Map(alphabeticalCandidates.map((item) => [String(item.race_start_number).trim(), item]));
      const nextDrafts = { ...drafts };
      const unmatched = [];
      let importedCount = 0;
      rows.forEach((row, index) => {
        const raceNumber = practiceExcelValue(row, ['RACE NO', 'CAR NO', 'NO START', 'START NO']);
        const practiceNumber = Number(practiceExcelValue(row, ['PRACTICE NO', 'NO PRACTICE', 'PRACTICE NUMBER']));
        if (!practiceNumber) return;
        const candidate = byRaceNumber.get(String(raceNumber).trim());
        if (!candidate) {
          unmatched.push(raceNumber || `baris ${index + 2}`);
          return;
        }
        const startOrder = Number(practiceExcelValue(row, ['START ORDER', 'START KE', 'ORDER'])) || index + 1;
        if (!Number.isInteger(practiceNumber) || practiceNumber < 1 || !Number.isInteger(startOrder) || startOrder < 1) {
          throw new Error(`Nomor Practice atau Start Order tidak valid pada baris ${index + 2}.`);
        }
        nextDrafts[candidate.participant_id] = { selected: true, practice_start_number: practiceNumber, start_order: startOrder };
        importedCount += 1;
      });
      if (!importedCount) throw new Error('Tidak ada nomor Practice valid yang dapat diimport.');

      const entries = alphabeticalCandidates.filter((item) => nextDrafts[item.participant_id]?.selected).map((item, index) => ({
        participant_id: item.participant_id,
        practice_start_number: Number(nextDrafts[item.participant_id]?.practice_start_number),
        start_order: Number(nextDrafts[item.participant_id]?.start_order || index + 1),
      }));
      const practiceNumbers = entries.map((entry) => entry.practice_start_number);
      const startOrders = entries.map((entry) => entry.start_order);
      if (entries.some((entry) => !entry.practice_start_number || !entry.start_order)) throw new Error('Semua peserta terpilih wajib memiliki nomor Practice dan urutan.');
      if (new Set(practiceNumbers).size !== practiceNumbers.length) throw new Error('PRACTICE NO tidak boleh duplikat.');
      if (new Set(startOrders).size !== startOrders.length) throw new Error('START ORDER tidak boleh duplikat.');

      await api.put(`/admin/practices/${selectedId}/entries`, { entries });
      setDrafts(nextDrafts);
      await loadEntries(selectedId);
      setAutoSaveState({ type: 'success', text: `${importedCount} nomor Practice berhasil diimport${unmatched.length ? `; ${unmatched.length} Race No tidak ditemukan` : ''}.` });
    } catch (err) {
      setAutoSaveState({ type: 'error', text: err.response?.data?.error || err.message || 'Gagal mengimport nomor Practice.' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <form onSubmit={submitPractice} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm">
            <h3 className="font-black uppercase">Buat Sesi Practice</h3>
            <input required className="w-full rounded border p-2" placeholder="Nama Practice" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input type="date" className="w-full rounded border p-2" value={form.practice_date} onChange={(e) => setForm({ ...form, practice_date: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min="0" step="0.01" className="rounded border p-2" placeholder="Jarak KM" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} />
              <input required type="number" min="1" className="rounded border p-2" placeholder="Max run" value={form.max_runs} onChange={(e) => setForm({ ...form, max_runs: e.target.value })} />
            </div>
            <button disabled={isSaving} className="admin-btn-primary w-full">Tambah Practice</button>
          </form>
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            {practices.map((item) => <button key={item.id} onClick={() => setSelectedId(item.id)} className={`block w-full border-b p-4 text-left ${selectedId === item.id ? 'bg-red-50 text-red-700' : 'hover:bg-gray-50'}`}><span className="block font-black">{item.name}</span><span className="text-xs">{item.max_runs} run · {item.is_open ? 'OPEN' : 'CLOSE'}</span></button>)}
            {!practices.length && <p className="p-5 text-sm text-gray-500">Belum ada sesi Practice.</p>}
          </div>
        </div>

        <div className="space-y-4">
          {selected ? <>
            <form onSubmit={saveConfiguration} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black">Konfigurasi {selected.name}</h3><p className="text-sm text-gray-500">Ubah nama, tanggal, jarak, jumlah run, atau status sesi.</p></div><div className="flex gap-2"><button type="button" className={selected.is_open ? 'admin-btn-orange' : 'admin-btn-blue'} onClick={() => updateSelected({ is_open: !selected.is_open })}>{selected.is_open ? 'Tutup Practice' : 'Buka Practice'}</button><button type="button" className="admin-btn-delete" onClick={deleteSelected}>Hapus</button></div></div>
              <div className="grid gap-3 md:grid-cols-4"><input required className="rounded border p-2" value={editForm.name || ''} onChange={(e)=>setEditForm({...editForm,name:e.target.value})}/><input type="date" className="rounded border p-2" value={editForm.practice_date || ''} onChange={(e)=>setEditForm({...editForm,practice_date:e.target.value})}/><input type="number" min="0" step="0.01" className="rounded border p-2" value={editForm.distance_km ?? ''} onChange={(e)=>setEditForm({...editForm,distance_km:e.target.value})}/><div className="flex gap-2"><input type="number" min="1" className="min-w-0 flex-1 rounded border p-2" value={editForm.max_runs || 1} onChange={(e)=>setEditForm({...editForm,max_runs:e.target.value})}/><button disabled={isSaving} className="admin-btn-primary">Simpan</button></div></div>
            </form>
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h3 className="font-black uppercase">Peserta Practice</h3><p className="text-xs text-gray-500">Diurutkan alfabetis berdasarkan nama driver. Nomor dapat diisi otomatis atau melalui import Excel.</p>{autoSaveState.text && <p className={`mt-1 text-xs font-bold ${autoSaveState.type === 'error' ? 'text-red-600' : autoSaveState.type === 'success' ? 'text-green-600' : 'text-amber-600'}`}>{autoSaveState.text}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" disabled={isLoadingEntries || !selectedId} className="admin-btn-muted whitespace-nowrap" onClick={downloadPracticeTemplate}>Download Template</button><label className={`admin-btn-muted cursor-pointer whitespace-nowrap ${isImporting || isLoadingEntries ? 'pointer-events-none opacity-50' : ''}`}>{isImporting ? 'Import...' : 'Import Excel'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={isImporting || isLoadingEntries} onChange={importPracticeNumbers} /></label><button disabled={isSaving || isLoadingEntries || isImporting} className="admin-btn-primary whitespace-nowrap" onClick={saveEntries}>{isLoadingEntries ? 'Memuat...' : 'Simpan Keikutsertaan'}</button></div></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-900 text-xs uppercase text-white"><tr><th className="p-3">Ikut</th><th className="p-3">Race No</th><th className="p-3 text-left">Driver</th><th className="p-3">Practice No</th><th className="p-3">Urutan</th></tr></thead><tbody>
                {alphabeticalCandidates.map((item, index) => { const draft = drafts[item.participant_id] || {}; return <tr key={item.participant_id} className="border-b"><td className="p-3 text-center"><input disabled={isLoadingEntries} type="checkbox" checked={Boolean(draft.selected)} onChange={(e) => updateDraft(item.participant_id, { selected: e.target.checked, start_order: draft.start_order || index + 1 })} /></td><td className="p-3 text-center font-black">#{item.race_start_number}</td><td className="p-3"><span className="font-bold">{item.driver_name}</span><span className="block text-xs text-gray-500">{item.vehicle_name} · {item.class_name}</span></td><td className="p-3"><input disabled={isLoadingEntries || !draft.selected} type="number" min="1" className="w-24 rounded border p-2 text-center" value={draft.practice_start_number || ''} onChange={(e) => updateDraft(item.participant_id, { practice_start_number: e.target.value })} /></td><td className="p-3"><input disabled={isLoadingEntries || !draft.selected} type="number" min="1" className="w-20 rounded border p-2 text-center" value={draft.start_order || ''} onChange={(e) => updateDraft(item.participant_id, { start_order: e.target.value })} /></td></tr>; })}
              </tbody></table></div>
            </div>
          </> : <div className="rounded-xl border bg-white p-10 text-center text-gray-500">Pilih atau buat sesi Practice.</div>}
        </div>
      </section>
    </div>
  );
}

function practiceExcelValue(row, candidateHeaders) {
  const entries = Object.entries(row || {});
  for (const header of candidateHeaders) {
    const normalizedHeader = normalizePracticeExcelHeader(header);
    const match = entries.find(([key]) => normalizePracticeExcelHeader(key) === normalizedHeader);
    if (match) return match[1];
  }
  return '';
}

function normalizePracticeExcelHeader(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
