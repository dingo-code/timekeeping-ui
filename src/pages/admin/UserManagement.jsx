import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'kamar_hitung', label: 'Kamar Hitung' },
  { value: 'petugas_start', label: 'Petugas Start' },
  { value: 'petugas_finish', label: 'Petugas Finish' },
  { value: 'petugas_tc', label: 'Petugas TC' },
];

const emptyForm = { username: '', password: '', role: 'petugas_start', event_id: '' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [userRes, eventRes] = await Promise.all([api.get('/admin/users'), api.get('/admin/events')]);
      setUsers(userRes.data.data || []);
      setEvents(eventRes.data.data || []);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memuat data user.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load mengikuti pola halaman master lain; pembaruan state terjadi setelah request selesai.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => [user.username, user.role, user.event_name].join(' ').toLowerCase().includes(keyword));
  }, [search, users]);

  const openForm = (user = null) => {
    setEditingId(user?.id || '');
    setForm(user ? { username: user.username, password: '', role: user.role, event_id: user.event_id || '' } : emptyForm);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const submitUser = async (event) => {
    event.preventDefault();
    try {
      const payload = { username: form.username, role: form.role, event_id: form.role === 'admin' ? '' : form.event_id };
      if (editingId) await api.put(`/admin/users/${editingId}`, payload);
      else await api.post('/admin/users', { ...payload, password: form.password });
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan user.');
    }
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    try {
      await api.put(`/admin/users/${passwordUser.id}/password`, { password: newPassword });
      setPasswordUser(null);
      setNewPassword('');
      alert('Password berhasil diganti.');
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengganti password.');
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Hapus user ${user.username}?`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus user.');
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-xl font-bold text-gray-800">Manajemen User</h2><p className="mt-1 text-sm text-gray-500">Kelola akun dan penugasan event petugas.</p></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <input className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm sm:w-64" placeholder="Cari user, role, atau event..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="admin-btn-primary whitespace-nowrap" onClick={() => openForm()}>+ Tambah User</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b bg-gray-50 text-sm text-gray-600"><tr><th className="p-4">Username</th><th className="p-4">Role</th><th className="p-4">Event Penugasan</th><th className="p-4 text-right">Aksi</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan="4" className="p-8 text-center text-gray-500">Memuat...</td></tr> : filteredUsers.length === 0 ? <tr><td colSpan="4" className="p-8 text-center text-gray-500">User tidak ditemukan.</td></tr> : filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-4 font-bold text-gray-800">{user.username}</td>
                <td className="p-4"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{ROLES.find((role) => role.value === user.role)?.label || user.role}</span></td>
                <td className="p-4 text-gray-600">{user.role === 'admin' ? 'Semua event' : user.event_name || <span className="font-bold text-red-600">Belum diatur</span>}</td>
                <td className="p-4"><div className="flex flex-wrap justify-end gap-2"><button className="admin-btn-edit" onClick={() => openForm(user)}>Edit</button><button className="admin-btn-muted" onClick={() => { setPasswordUser(user); setNewPassword(''); setShowPassword(false); }}>Ganti Password</button><button className="admin-btn-delete" onClick={() => deleteUser(user)}>Hapus</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit User' : 'Tambah User'}>
        <form className="space-y-4 p-6" onSubmit={submitUser}>
          <Field label="Username"><input required minLength="3" className="w-full rounded-lg border p-2" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          {!editingId && <Field label="Password"><div className="flex gap-2"><input required minLength="8" type={showPassword ? 'text' : 'password'} className="min-w-0 flex-1 rounded-lg border p-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><button type="button" className="admin-btn-muted" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Tutup' : 'Lihat'}</button></div><p className="mt-1 text-xs text-gray-500">Minimal 8 karakter.</p></Field>}
          <Field label="Role"><select className="w-full rounded-lg border bg-white p-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, event_id: e.target.value === 'admin' ? '' : form.event_id })}>{ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></Field>
          {form.role !== 'admin' && <Field label="Event Penugasan"><select required className="w-full rounded-lg border bg-white p-2" value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })}><option value="">-- Pilih Event --</option>{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-1 text-xs text-gray-500">Petugas langsung diarahkan ke event ini setelah login.</p></Field>}
          <div className="flex justify-end gap-2 pt-3"><button type="button" className="admin-btn-muted" onClick={() => setIsModalOpen(false)}>Batal</button><button className="admin-btn-primary">Simpan</button></div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(passwordUser)} onClose={() => setPasswordUser(null)} title={`Ganti Password ${passwordUser?.username || ''}`}>
        <form className="space-y-4 p-6" onSubmit={submitPassword}><Field label="Password Baru"><div className="flex gap-2"><input required minLength="8" type={showPassword ? 'text' : 'password'} className="min-w-0 flex-1 rounded-lg border p-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button type="button" className="admin-btn-muted" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Tutup' : 'Lihat'}</button></div></Field><div className="flex justify-end gap-2"><button type="button" className="admin-btn-muted" onClick={() => setPasswordUser(null)}>Batal</button><button className="admin-btn-primary">Ganti Password</button></div></form>
      </Modal>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>{children}</label>;
}
