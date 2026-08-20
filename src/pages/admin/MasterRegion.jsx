import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

export default function MasterRegion() {
  const [regions, setRegions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');

  // Pagination & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => { fetchRegions(); }, []);

  const fetchRegions = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/regions');
      setRegions(res.data.data || []);
    } catch (e) { alert('Gagal memuat data'); }
    finally { setIsLoading(false); }
  };

  // Logic Pagination & Search
  const filteredRegions = regions.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredRegions.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredRegions.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const openModal = (reg = null) => {
    if (reg) { setEditingId(reg.id); setName(reg.name); }
    else { setEditingId(null); setName(''); }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/regions/${editingId}`, { name });
      else await api.post('/admin/regions', { name });
      setIsModalOpen(false);
      fetchRegions();
    } catch (err) { alert('Gagal menyimpan'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus wilayah ini?')) return;
    try { await api.delete(`/admin/regions/${id}`); fetchRegions(); }
    catch (e) { alert('Gagal menghapus'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Pengprov / Region</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredRegions.length} wilayah ditemukan.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          <input type="text" placeholder="Cari nama wilayah..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
              <th className="p-4 font-semibold">Nama Wilayah / IMI Pengprov</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan="2" className="text-center p-8 text-gray-500">Memuat...</td></tr> : 
             currentItems.length === 0 ? <tr><td colSpan="2" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr> :
             currentItems.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="p-4 font-medium text-gray-800">{r.name}</td>
                <td className="p-4 text-right space-x-3">
                  <button onClick={() => openModal(r)} className="admin-btn-edit">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="admin-btn-delete">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100">
        <DataTableFooter totalItems={filteredRegions.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Wilayah' : 'Tambah Wilayah'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Wilayah / Pengprov</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={name} onChange={e => setName(e.target.value)} />
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
