import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';

export default function MasterRegion() {
  const [regions, setRegions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');

  // Pagination & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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
  const totalPages = Math.ceil(filteredRegions.length / itemsPerPage);
  const currentItems = filteredRegions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

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
        <div className="flex w-full sm:w-auto items-center space-x-3">
          <input type="text" placeholder="Cari nama wilayah..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <button onClick={() => openModal()} className="whitespace-nowrap px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">+ Tambah</button>
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
                  <button onClick={() => openModal(r)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline text-sm font-medium">Hapus</button>
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Wilayah' : 'Tambah Wilayah'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Wilayah / Pengprov</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={name} onChange={e => setName(e.target.value)} />
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