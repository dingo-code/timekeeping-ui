/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

const emptyForm = { name: '', practice_date: '', distance_km: '', max_runs: 3, is_open: true };
const newKey = () => `new-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function PracticeManagement({ eventId }) {
  const [practices, setPractices] = useState([]), [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState(''), [form, setForm] = useState(emptyForm), [editForm, setEditForm] = useState(emptyForm);
  const [entries, setEntries] = useState([]), [isSaving, setIsSaving] = useState(false), [isLoading, setIsLoading] = useState(false), [isImporting, setIsImporting] = useState(false);
  const [notice, setNotice] = useState({ type: '', text: '' });
  const timer = useRef(null);
  const selected = useMemo(() => practices.find((p) => p.id === selectedId), [practices, selectedId]);
  const sortedCandidates = useMemo(() => [...candidates].sort((a, b) => String(a.driver_name || '').localeCompare(String(b.driver_name || ''), 'id-ID', { sensitivity: 'base' }) || Number(a.race_start_number) - Number(b.race_start_number)), [candidates]);
  const candidateMap = useMemo(() => new Map(candidates.map((p) => [p.participant_id, p])), [candidates]);

  async function loadBase() {
    const [p, c] = await Promise.all([api.get(`/practices/events/${eventId}`), api.get(`/admin/events/${eventId}/practice-candidates`)]);
    const list = p.data.data || []; setPractices(list); setCandidates(c.data.data || []); setSelectedId((id) => id || list[0]?.id || '');
  }
  async function loadEntries(id) {
    if (!id) return setEntries([]); setIsLoading(true);
    try { const res = await api.get(`/admin/practices/${id}/entries`); setEntries((res.data.data || []).map((e) => ({ ...e, rowKey: e.id }))); }
    finally { setIsLoading(false); }
  }
  useEffect(() => { loadBase().catch((e) => alert(e.response?.data?.error || 'Gagal memuat Practice.')); }, [eventId]);
  useEffect(() => { loadEntries(selectedId).catch((e) => alert(e.response?.data?.error || 'Gagal memuat peserta Practice.')); }, [selectedId]);
  useEffect(() => { if (selected) setEditForm({ ...selected }); }, [selected]);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  function validation(rows) {
    if (rows.some((r) => !r.participant_id || Number(r.practice_start_number) < 1 || Number(r.start_order) < 1)) return 'Semua slot wajib memiliki nomor Practice dan urutan.';
    if (new Set(rows.map((r) => Number(r.practice_start_number))).size !== rows.length) return 'Nomor Practice tidak boleh duplikat.';
    if (new Set(rows.map((r) => Number(r.start_order))).size !== rows.length) return 'Urutan start tidak boleh duplikat.';
    return '';
  }
  async function persist(rows, silent = false) {
    const error = validation(rows); if (error) { if (!silent) alert(error); return false; }
    setNotice({ type: 'saving', text: 'Menyimpan perubahan...' });
    try {
      await api.put(`/admin/practices/${selectedId}/entries`, { entries: rows.map((r) => ({ id: r.id || '', participant_id: r.participant_id, practice_start_number: Number(r.practice_start_number), start_order: Number(r.start_order) })) });
      await loadEntries(selectedId); setNotice({ type: 'success', text: 'Semua slot Practice sudah tersimpan.' }); return true;
    } catch (e) { const text = e.response?.data?.error || 'Gagal menyimpan slot Practice.'; setNotice({ type: 'error', text }); if (!silent) alert(text); return false; }
  }
  function schedule(rows) { if (timer.current) clearTimeout(timer.current); if (!validation(rows)) timer.current = setTimeout(() => persist(rows, true), 800); }
  function updateRow(key, values) { setEntries((old) => { const next = old.map((r) => r.rowKey === key ? { ...r, ...values } : r); schedule(next); return next; }); }
  function addRow(participantId) { setEntries((old) => [...old, { rowKey: newKey(), participant_id: participantId, practice_start_number: '', start_order: old.length ? Math.max(...old.map((r) => Number(r.start_order) || 0)) + 1 : 1 }]); }
  function removeRow(key) { setEntries((old) => { const next = old.filter((r) => r.rowKey !== key); schedule(next); return next; }); }

  async function submitPractice(e) { e.preventDefault(); setIsSaving(true); try { const res = await api.post(`/admin/events/${eventId}/practices`, { ...form, distance_km: Number(form.distance_km || 0), max_runs: Number(form.max_runs) }); setForm(emptyForm); await loadBase(); setSelectedId(res.data.data.id); } catch (x) { alert(x.response?.data?.error || 'Gagal membuat Practice.'); } finally { setIsSaving(false); } }
  async function updateSelected(values) { try { await api.put(`/admin/practices/${selected.id}`, { ...selected, ...values }); await loadBase(); } catch (x) { alert(x.response?.data?.error || 'Gagal memperbarui Practice.'); } }
  async function saveConfig(e) { e.preventDefault(); setIsSaving(true); await updateSelected({ ...editForm, distance_km: Number(editForm.distance_km || 0), max_runs: Number(editForm.max_runs) }); setIsSaving(false); }
  async function removePractice() { if (!window.confirm(`Hapus ${selected.name} beserta seluruh run?`)) return; try { await api.delete(`/admin/practices/${selected.id}`); setSelectedId(''); await loadBase(); } catch (x) { alert(x.response?.data?.error || 'Gagal menghapus Practice.'); } }

  async function downloadTemplate() {
    try {
      const XLSX = await import('xlsx'), headers = ['SLOT ID', 'RACE NO', 'DRIVER', 'PRACTICE NO', 'START ORDER'];
      const saved = entries.map((e) => { const p = candidateMap.get(e.participant_id) || e; return [e.id || '', p.race_start_number, p.driver_name, e.practice_start_number, e.start_order]; });
      const unused = sortedCandidates.filter((p) => !entries.some((e) => e.participant_id === p.participant_id)).map((p) => ['', p.race_start_number, p.driver_name, '', '']);
      const help = [['PETUNJUK IMPORT'], ['1', 'Satu peserta boleh ditulis beberapa kali dengan nomor Practice berbeda.'], ['2', 'Pertahankan SLOT ID untuk mengubah slot lama; kosongkan untuk slot baru.'], ['3', 'PRACTICE NO dan START ORDER wajib unik.'], ['4', 'Pencocokan memakai RACE NO, lalu DRIVER.'], ['5', 'Baris tanpa PRACTICE NO diabaikan dan tidak menghapus slot lama.']];
      const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([headers, ...saved, ...unused]), hs = XLSX.utils.aoa_to_sheet(help);
      ws['!cols'] = [{ wch: 38 }, { wch: 12 }, { wch: 34 }, { wch: 18 }, { wch: 18 }]; hs['!cols'] = [{ wch: 5 }, { wch: 100 }]; XLSX.utils.book_append_sheet(wb, ws, 'PRACTICE PARTICIPANTS'); XLSX.utils.book_append_sheet(wb, hs, 'PETUNJUK');
      XLSX.writeFile(wb, `template-nomor-practice-${String(selected?.name || 'practice').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`);
    } catch (x) { alert(x.message || 'Gagal membuat template.'); }
  }
  async function importFile(e) {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; setIsImporting(true);
    try {
      const XLSX = await import('xlsx'), wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
      const byRace = new Map(sortedCandidates.map((p) => [String(p.race_start_number).trim(), p])), byDriver = new Map();
      sortedCandidates.forEach((p) => { const k = normalizeName(p.driver_name); byDriver.set(k, [...(byDriver.get(k) || []), p]); });
      const merged = entries.map((r) => ({ ...r })); let count = 0;
      rows.forEach((row, i) => {
        const number = Number(cell(row, ['PRACTICE NO', 'NO PRACTICE', 'PRACTICE NUMBER'])); if (!number) return;
        const race = cell(row, ['RACE NO', 'CAR NO', 'NO START']), driver = cell(row, ['DRIVER', 'DRIVER NAME', 'NAMA DRIVER']); let p = byRace.get(String(race).trim());
        if (!p && driver) { const found = byDriver.get(normalizeName(driver)) || []; if (found.length > 1) throw new Error(`Driver ${driver} ambigu pada baris ${i + 2}; isi RACE NO.`); [p] = found; }
        if (!p) throw new Error(`Peserta pada baris ${i + 2} tidak ditemukan.`);
        const order = Number(cell(row, ['START ORDER', 'START KE', 'ORDER'])) || i + 1, id = String(cell(row, ['SLOT ID', 'ENTRY ID'])).trim();
        if (!Number.isInteger(number) || number < 1 || !Number.isInteger(order) || order < 1) throw new Error(`Nomor/urutan baris ${i + 2} tidak valid.`);
        const at = id ? merged.findIndex((r) => r.id === id) : -1; if (id && at < 0) throw new Error(`SLOT ID baris ${i + 2} tidak ditemukan. Download template terbaru.`);
        const value = { ...(at >= 0 ? merged[at] : {}), rowKey: id || newKey(), id, participant_id: p.participant_id, practice_start_number: number, start_order: order };
        if (at >= 0) merged[at] = value; else merged.push(value); count++;
      });
      if (!count) throw new Error('Tidak ada data valid untuk diimport.'); const error = validation(merged); if (error) throw new Error(error);
      if (await persist(merged, true)) setNotice({ type: 'success', text: `${count} slot Practice berhasil diimport.` });
    } catch (x) { setNotice({ type: 'error', text: x.response?.data?.error || x.message || 'Gagal import.' }); } finally { setIsImporting(false); }
  }

  return <div className="space-y-6"><section className="grid gap-6 xl:grid-cols-[360px_1fr]">
    <aside className="space-y-4"><form onSubmit={submitPractice} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm"><h3 className="font-black uppercase">Buat Sesi Practice</h3><input required className="w-full rounded border p-2" placeholder="Nama Practice" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/><input type="date" className="w-full rounded border p-2" value={form.practice_date} onChange={(e) => setForm({ ...form, practice_date: e.target.value })}/><div className="grid grid-cols-2 gap-2"><input type="number" min="0" step=".01" className="rounded border p-2" placeholder="Jarak KM" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })}/><input type="number" min="1" className="rounded border p-2" value={form.max_runs} onChange={(e) => setForm({ ...form, max_runs: e.target.value })}/></div><button disabled={isSaving} className="admin-btn-primary w-full">Tambah Practice</button></form><div className="overflow-hidden rounded-xl border bg-white shadow-sm">{practices.map((p) => <button key={p.id} onClick={() => setSelectedId(p.id)} className={`block w-full border-b p-4 text-left ${selectedId === p.id ? 'bg-red-50 text-red-700' : 'hover:bg-gray-50'}`}><b className="block">{p.name}</b><span className="text-xs">{p.max_runs} run · {p.is_open ? 'OPEN' : 'CLOSE'}</span></button>)}{!practices.length && <p className="p-5 text-sm text-gray-500">Belum ada sesi Practice.</p>}</div></aside>
    <main className="space-y-4">{selected ? <><form onSubmit={saveConfig} className="rounded-xl border bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-black">Konfigurasi {selected.name}</h3><p className="text-sm text-gray-500">Nama, tanggal, jarak, jumlah run, dan status sesi.</p></div><div className="flex gap-2"><button type="button" className={selected.is_open ? 'admin-btn-orange' : 'admin-btn-blue'} onClick={() => updateSelected({ is_open: !selected.is_open })}>{selected.is_open ? 'Tutup Practice' : 'Buka Practice'}</button><button type="button" className="admin-btn-delete" onClick={removePractice}>Hapus</button></div></div><div className="grid gap-3 md:grid-cols-4"><input required className="rounded border p-2" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}/><input type="date" className="rounded border p-2" value={editForm.practice_date || ''} onChange={(e) => setEditForm({ ...editForm, practice_date: e.target.value })}/><input type="number" min="0" step=".01" className="rounded border p-2" value={editForm.distance_km ?? ''} onChange={(e) => setEditForm({ ...editForm, distance_km: e.target.value })}/><div className="flex gap-2"><input type="number" min="1" className="min-w-0 flex-1 rounded border p-2" value={editForm.max_runs || 1} onChange={(e) => setEditForm({ ...editForm, max_runs: e.target.value })}/><button className="admin-btn-primary">Simpan</button></div></div></form>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm"><header className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h3 className="font-black uppercase">Pendaftaran Practice</h3><p className="text-xs text-gray-500">Satu peserta dapat memiliki beberapa slot dengan nomor berbeda.</p>{notice.text && <p className={`mt-1 text-xs font-bold ${notice.type === 'error' ? 'text-red-600' : notice.type === 'success' ? 'text-green-600' : 'text-amber-600'}`}>{notice.text}</p>}</div><div className="flex flex-wrap gap-2"><button className="admin-btn-muted" onClick={downloadTemplate}>Download Template</button><label className={`admin-btn-muted cursor-pointer ${isImporting || isLoading ? 'pointer-events-none opacity-50' : ''}`}>{isImporting ? 'Import...' : 'Import Excel'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importFile}/></label><button disabled={isSaving || isLoading} className="admin-btn-primary" onClick={async () => { setIsSaving(true); await persist(entries); setIsSaving(false); }}>Simpan Semua Slot</button></div></header>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-900 text-xs uppercase text-white"><tr><th className="p-3">Race No</th><th className="p-3 text-left">Driver / Navigator</th><th className="p-3">Slot Practice</th><th className="p-3">Aksi</th></tr></thead><tbody>{sortedCandidates.map((p) => { const slots = entries.filter((e) => e.participant_id === p.participant_id); return <tr key={p.participant_id} className="border-b align-top"><td className="p-3 text-center font-black">#{p.race_start_number}</td><td className="p-3"><b>{p.driver_name}</b><small className="block text-gray-500">{p.codriver_name || '-'} · {p.vehicle_name} · {p.class_name}</small></td><td className="p-3"><div className="space-y-2">{slots.map((s, i) => <div key={s.rowKey} className="flex flex-wrap items-center gap-2 rounded-lg border bg-gray-50 p-2"><span className="text-[10px] font-black uppercase text-gray-400">Slot {i + 1}</span><label className="text-xs font-bold">No <input type="number" min="1" className="ml-1 w-20 rounded border bg-white p-2 text-center" value={s.practice_start_number} onChange={(e) => updateRow(s.rowKey, { practice_start_number: e.target.value })}/></label><label className="text-xs font-bold">Urutan <input type="number" min="1" className="ml-1 w-20 rounded border bg-white p-2 text-center" value={s.start_order} onChange={(e) => updateRow(s.rowKey, { start_order: e.target.value })}/></label><button className="rounded bg-red-100 px-2 py-2 text-xs font-black text-red-700" onClick={() => removeRow(s.rowKey)}>Hapus</button></div>)}{!slots.length && <span className="text-xs text-gray-400">Belum terdaftar</span>}</div></td><td className="p-3 text-center"><button className="admin-btn-muted whitespace-nowrap" onClick={() => addRow(p.participant_id)}>+ Tambah Slot</button></td></tr>; })}</tbody></table></div></div>
    </> : <div className="rounded-xl border bg-white p-10 text-center text-gray-500">Pilih atau buat sesi Practice.</div>}</main>
  </section></div>;
}

function cell(row, headers) { for (const [key, value] of Object.entries(row || {})) if (headers.some((h) => normalizeHeader(h) === normalizeHeader(key))) return value; return ''; }
function normalizeHeader(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function normalizeName(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' '); }
