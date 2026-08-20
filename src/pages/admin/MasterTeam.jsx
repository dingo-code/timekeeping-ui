import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

export default function MasterTeam() {
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', manager_name: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/teams');
      setTeams(res.data.data || []);
    } catch (e) { alert('Gagal memuat data'); }
    finally { setIsLoading(false); }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.manager_name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredTeams.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredTeams.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const openModal = (team = null) => {
    if (team) { setEditingId(team.id); setFormData({ name: team.name, manager_name: team.manager_name }); }
    else { setEditingId(null); setFormData({ name: '', manager_name: '' }); }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/teams/${editingId}`, formData);
      else await api.post('/admin/teams', formData);
      setIsModalOpen(false);
      fetchTeams();
    } catch (err) { alert('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus tim ini?')) return;
    try { await api.delete(`/admin/teams/${id}`); fetchTeams(); }
    catch (e) { alert('Gagal menghapus'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Tim (Team)</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredTeams.length} tim ditemukan.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          <input type="text" placeholder="Cari nama tim atau manajer..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
            <select className="p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-red-500" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <button onClick={() => openModal()} className="admin-btn-primary">+ Tambah</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
              <th className="p-4 font-semibold">Nama Tim</th>
              <th className="p-4 font-semibold">Nama Manajer</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan="3" className="text-center p-8 text-gray-500">Memuat...</td></tr> : 
             currentItems.length === 0 ? <tr><td colSpan="3" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr> :
             currentItems.map(t => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="p-4 font-bold text-gray-800">{t.name}</td>
                <td className="p-4 text-gray-600">{t.manager_name}</td>
                <td className="p-4 text-right space-x-3">
                  <button onClick={() => openModal(t)} className="admin-btn-edit">Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="admin-btn-delete">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100">
        <DataTableFooter totalItems={filteredTeams.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Tim' : 'Tambah Tim Baru'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Tim</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Manajer</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.manager_name} onChange={e => setFormData({...formData, manager_name: e.target.value})} />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="admin-btn-muted">Batal</button>
            <button type="submit" className="admin-btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
