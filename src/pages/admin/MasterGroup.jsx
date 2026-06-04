import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';

export default function MasterGroup() {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ code: '', name: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/groups');
      setGroups(res.data.data || []);
    } catch (e) { alert('Gagal memuat data'); }
    finally { setIsLoading(false); }
  };

  const filteredGroups = groups.filter(g => 
    g.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const currentItems = filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const openModal = (g = null) => {
    if (g) { setEditingId(g.id); setFormData({ code: g.code, name: g.name }); }
    else { setEditingId(null); setFormData({ code: '', name: '' }); }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/groups/${editingId}`, formData);
      else await api.post('/admin/groups', formData);
      setIsModalOpen(false);
      fetchGroups();
    } catch (err) { alert('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus grup ini?')) return;
    try { await api.delete(`/admin/groups/${id}`); fetchGroups(); }
    catch (e) { alert('Gagal menghapus'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Group</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredGroups.length} grup ditemukan.</p>
        </div>
        <div className="flex w-full sm:w-auto items-center space-x-3">
          <input type="text" placeholder="Cari kode atau nama..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={() => openModal()} className="whitespace-nowrap px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">+ Tambah</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
              <th className="p-4 font-semibold">Kode Grup</th>
              <th className="p-4 font-semibold">Nama Grup</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan="3" className="text-center p-8 text-gray-500">Memuat...</td></tr> : 
             currentItems.length === 0 ? <tr><td colSpan="3" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr> :
             currentItems.map(g => (
              <tr key={g.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="p-4 font-mono font-bold text-red-600">{g.code}</td>
                <td className="p-4 font-medium text-gray-800">{g.name}</td>
                <td className="p-4 text-right space-x-3">
                  <button onClick={() => openModal(g)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(g.id)} className="text-red-600 hover:underline text-sm font-medium">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <span className="text-sm text-gray-600">Halaman <span className="font-bold">{currentPage}</span> dari <span className="font-bold">{totalPages}</span></span>
          <div className="space-x-2">
            <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium bg-white hover:bg-gray-100 disabled:opacity-50">Sebelumnya</button>
            <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="px-3 py-1.5 border border-gray-300 rounded text-sm font-medium bg-white hover:bg-gray-100 disabled:opacity-50">Selanjutnya</button>
          </div>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Group' : 'Tambah Group'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kode Group</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none uppercase focus:ring-red-500" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Rumpun / Group</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg">Batal</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}