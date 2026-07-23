import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

export default function MasterClass() {
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ group_id: '', code: '', name: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    fetchClasses();
    fetchGroups();
  }, []);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/classes');
      setClasses(res.data.data || []);
    } catch (e) { alert('Gagal memuat data kelas'); }
    finally { setIsLoading(false); }
  };

  const fetchGroups = async () => {
    try {
      const res = await api.get('/admin/groups');
      setGroups(res.data.data || []);
    } catch (e) { console.error('Gagal mengambil rumpun grup'); }
  };

  const filteredClasses = classes.filter(c => 
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredClasses.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredClasses.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const openModal = (c = null) => {
    if (c) { setEditingId(c.id); setFormData({ group_id: c.group_id, code: c.code, name: c.name }); }
    else { setEditingId(null); setFormData({ group_id: groups[0]?.id || '', code: '', name: '' }); }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/classes/${editingId}`, formData);
      else await api.post('/admin/classes', formData);
      setIsModalOpen(false);
      fetchClasses();
    } catch (err) { alert('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus kelas spesifik ini?')) return;
    try { await api.delete(`/admin/classes/${id}`); fetchClasses(); }
    catch (e) { alert('Gagal menghapus'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Kelas / Class</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredClasses.length} kelas ditemukan.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          <input type="text" placeholder="Cari kode atau nama..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
            <select className="p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-red-500" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <button onClick={() => openModal()} className="whitespace-nowrap px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">+ Tambah</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
              <th className="p-4 font-semibold">Kode Kelas</th>
              <th className="p-4 font-semibold">Spesifikasi Detail Kelas</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan="3" className="text-center p-8 text-gray-500">Memuat...</td></tr> : 
             currentItems.length === 0 ? <tr><td colSpan="3" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr> :
             currentItems.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="p-4 font-mono font-bold text-blue-600">{c.code}</td>
                <td className="p-4 font-medium text-gray-800">{c.name}</td>
                <td className="p-4 text-right space-x-3">
                  <button onClick={() => openModal(c)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline text-sm font-medium">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100">
        <DataTableFooter totalItems={filteredClasses.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Spesifikasi Kelas' : 'Tambah Kelas Baru'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Pilih Rumpun Utama (Group)</label>
            <select className="w-full p-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-red-500" value={formData.group_id} onChange={e => setFormData({...formData, group_id: e.target.value})}>
              {groups.map(g => <option key={g.id} value={g.id}>{g.code} - {g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kode Kelas</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none uppercase focus:ring-red-500" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Spesifikasi Detail Kelas</label>
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
