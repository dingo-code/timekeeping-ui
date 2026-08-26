/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const emptySystem = { name: '', description: '' };
const emptyRule = { rank: '', point_value: '' };

export default function MasterPointSystem() {
  const [systems, setSystems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [rules, setRules] = useState([]);
  const [systemForm, setSystemForm] = useState(emptySystem);
  const [editingSystemId, setEditingSystemId] = useState('');
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [editingRuleId, setEditingRuleId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selected = useMemo(() => systems.find((item) => item.id === selectedId), [systems, selectedId]);

  const loadSystems = async () => {
    const res = await api.get('/admin/point-systems');
    const data = res.data.data || [];
    setSystems(data);
    setSelectedId((current) => data.some((item) => item.id === current) ? current : data[0]?.id || '');
  };

  const loadRules = async (id) => {
    if (!id) { setRules([]); return; }
    const res = await api.get(`/admin/point-systems/${id}/rules`);
    setRules(res.data.data || []);
  };

  useEffect(() => { loadSystems().catch(() => alert('Gagal memuat Point System.')); }, []);
  useEffect(() => { loadRules(selectedId).catch(() => alert('Gagal memuat aturan poin.')); }, [selectedId]);

  const saveSystem = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingSystemId) await api.put(`/admin/point-systems/${editingSystemId}`, systemForm);
      else await api.post('/admin/point-systems', systemForm);
      setSystemForm(emptySystem); setEditingSystemId(''); await loadSystems();
    } catch (err) { alert(err.response?.data?.error || 'Gagal menyimpan Point System.'); }
    finally { setIsSaving(false); }
  };

  const editSystem = (item) => { setEditingSystemId(item.id); setSystemForm({ name: item.name, description: item.description || '' }); };
  const deleteSystem = async (item) => {
    if (!window.confirm(`Hapus Point System "${item.name}" beserta seluruh aturan poin?`)) return;
    try { await api.delete(`/admin/point-systems/${item.id}`); setSelectedId(''); await loadSystems(); }
    catch (err) { alert(err.response?.data?.error || 'Point System masih digunakan oleh event atau gagal dihapus.'); }
  };

  const saveRule = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const payload = { rank: Number(ruleForm.rank), point_value: Number(ruleForm.point_value) };
    setIsSaving(true);
    try {
      if (editingRuleId) await api.put(`/admin/point-rules/${editingRuleId}`, payload);
      else await api.post(`/admin/point-systems/${selectedId}/rules`, payload);
      setRuleForm(emptyRule); setEditingRuleId(''); await loadRules(selectedId);
    } catch (err) { alert(err.response?.data?.error || 'Peringkat tersebut sudah ada atau aturan gagal disimpan.'); }
    finally { setIsSaving(false); }
  };

  const editRule = (item) => { setEditingRuleId(item.id); setRuleForm({ rank: item.rank, point_value: item.point_value }); };
  const deleteRule = async (item) => { if (!window.confirm(`Hapus aturan peringkat ${item.rank}?`)) return; await api.delete(`/admin/point-rules/${item.id}`); await loadRules(selectedId); };

  return <div className="space-y-6">
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"><h2 className="text-2xl font-black uppercase italic">Point System Management</h2><p className="mt-1 text-sm text-gray-500">Atur konversi peringkat hasil event menjadi poin kejuaraan.</p></section>
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <form onSubmit={saveSystem} className="space-y-3 rounded-xl border bg-white p-5 shadow-sm"><h3 className="font-black uppercase">{editingSystemId ? 'Edit Point System' : 'Point System Baru'}</h3><div><label className="mb-1 block text-xs font-bold uppercase text-gray-500">Nama *</label><input required className="w-full rounded border p-2" placeholder="Contoh: FIA 25 Points" value={systemForm.name} onChange={(e)=>setSystemForm({...systemForm,name:e.target.value})}/></div><div><label className="mb-1 block text-xs font-bold uppercase text-gray-500">Deskripsi</label><textarea className="w-full rounded border p-2" rows="3" placeholder="Digunakan untuk kejuaraan..." value={systemForm.description} onChange={(e)=>setSystemForm({...systemForm,description:e.target.value})}/></div><div className="flex gap-2"><button disabled={isSaving} className="admin-btn-primary">{editingSystemId?'Simpan Perubahan':'Tambah Sistem'}</button>{editingSystemId&&<button type="button" className="admin-btn-muted" onClick={()=>{setEditingSystemId('');setSystemForm(emptySystem);}}>Batal</button>}</div></form>
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">{systems.map((item)=><button key={item.id} onClick={()=>setSelectedId(item.id)} className={`block w-full border-b p-4 text-left ${selectedId===item.id?'bg-red-50 text-red-700':'hover:bg-gray-50'}`}><span className="font-black">{item.name}</span><span className="mt-1 block text-xs text-gray-500">{item.description||'Tanpa deskripsi'}</span></button>)}{!systems.length&&<p className="p-5 text-sm text-gray-500">Belum ada Point System.</p>}</div>
      </div>
      {selected?<section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-5"><div><h3 className="text-xl font-black">{selected.name}</h3><p className="text-sm text-gray-500">{selected.description||'Tanpa deskripsi'}</p></div><div className="flex gap-2"><button className="admin-btn-edit" onClick={()=>editSystem(selected)}>Edit</button><button className="admin-btn-delete" onClick={()=>deleteSystem(selected)}>Hapus</button></div></div>
        <form onSubmit={saveRule} className="grid gap-3 border-b bg-gray-50 p-5 sm:grid-cols-[1fr_1fr_auto]"><div><label className="mb-1 block text-xs font-bold uppercase text-gray-500">Peringkat</label><input required type="number" min="1" className="w-full rounded border p-2" value={ruleForm.rank} onChange={(e)=>setRuleForm({...ruleForm,rank:e.target.value})}/></div><div><label className="mb-1 block text-xs font-bold uppercase text-gray-500">Nilai Poin</label><input required type="number" min="0" className="w-full rounded border p-2" value={ruleForm.point_value} onChange={(e)=>setRuleForm({...ruleForm,point_value:e.target.value})}/></div><div className="flex items-end gap-2"><button disabled={isSaving} className="admin-btn-primary">{editingRuleId?'Update':'Tambah'}</button>{editingRuleId&&<button type="button" className="admin-btn-muted" onClick={()=>{setEditingRuleId('');setRuleForm(emptyRule);}}>Batal</button>}</div></form>
        <table className="w-full text-sm"><thead className="bg-gray-900 text-white"><tr><th className="p-3 text-center">Peringkat</th><th className="p-3 text-center">Poin</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody>{rules.map((item)=><tr key={item.id} className="border-b"><td className="p-3 text-center text-lg font-black">{item.rank}</td><td className="p-3 text-center text-lg font-black text-red-600">{item.point_value}</td><td className="p-3 text-right"><button className="admin-btn-edit mr-2" onClick={()=>editRule(item)}>Edit</button><button className="admin-btn-delete" onClick={()=>deleteRule(item)}>Hapus</button></td></tr>)}{!rules.length&&<tr><td colSpan="3" className="p-8 text-center text-gray-500">Belum ada aturan peringkat.</td></tr>}</tbody></table>
      </section>:<div className="rounded-xl border bg-white p-10 text-center text-gray-500">Buat Point System untuk mulai mengatur poin.</div>}
    </div>
  </div>;
}
