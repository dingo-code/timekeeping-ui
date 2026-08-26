/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
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

  const selected = useMemo(() => practices.find((item) => item.id === selectedId), [practices, selectedId]);

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
  };

  useEffect(() => { loadBase().catch((err) => alert(err.response?.data?.error || 'Gagal memuat Practice.')); }, [eventId]);
  useEffect(() => { loadEntries(selectedId).catch((err) => alert(err.response?.data?.error || 'Gagal memuat peserta Practice.')); }, [selectedId]);
  useEffect(() => { if (selected) setEditForm({ ...selected }); }, [selected]);

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

  const updateDraft = (participantId, values) => setDrafts((current) => ({
    ...current,
    [participantId]: { selected: false, practice_start_number: '', start_order: '', ...current[participantId], ...values },
  }));

  const saveEntries = async () => {
    const entries = candidates.filter((item) => drafts[item.participant_id]?.selected).map((item, index) => ({
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
              <div className="flex items-center justify-between border-b p-5"><div><h3 className="font-black uppercase">Peserta Practice</h3><p className="text-xs text-gray-500">Pilih dari Entry List dan berikan nomor Practice yang unik.</p></div><button disabled={isSaving} className="admin-btn-primary" onClick={saveEntries}>Simpan Peserta</button></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-900 text-xs uppercase text-white"><tr><th className="p-3">Ikut</th><th className="p-3">Race No</th><th className="p-3 text-left">Driver</th><th className="p-3">Practice No</th><th className="p-3">Urutan</th></tr></thead><tbody>
                {candidates.map((item, index) => { const draft = drafts[item.participant_id] || {}; return <tr key={item.participant_id} className="border-b"><td className="p-3 text-center"><input type="checkbox" checked={Boolean(draft.selected)} onChange={(e) => updateDraft(item.participant_id, { selected: e.target.checked, start_order: draft.start_order || index + 1 })} /></td><td className="p-3 text-center font-black">#{item.race_start_number}</td><td className="p-3"><span className="font-bold">{item.driver_name}</span><span className="block text-xs text-gray-500">{item.vehicle_name} · {item.class_name}</span></td><td className="p-3"><input disabled={!draft.selected} type="number" min="1" className="w-24 rounded border p-2 text-center" value={draft.practice_start_number || ''} onChange={(e) => updateDraft(item.participant_id, { practice_start_number: e.target.value })} /></td><td className="p-3"><input disabled={!draft.selected} type="number" min="1" className="w-20 rounded border p-2 text-center" value={draft.start_order || ''} onChange={(e) => updateDraft(item.participant_id, { start_order: e.target.value })} /></td></tr>; })}
              </tbody></table></div>
            </div>
          </> : <div className="rounded-xl border bg-white p-10 text-center text-gray-500">Pilih atau buat sesi Practice.</div>}
        </div>
      </section>
    </div>
  );
}
