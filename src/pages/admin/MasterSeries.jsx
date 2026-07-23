import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

export default function MasterSeries() {
  const [series, setSeries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', year: new Date().getFullYear() });

  // State baru untuk Pencarian & Paginasi
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => { fetchSeries(); }, []);

  const fetchSeries = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/series');
      setSeries(res.data.data || []);
    } catch (e) { alert('Gagal memuat series'); }
    finally { setIsLoading(false); }
  };

  // --- LOGIKA FILTER & PAGINASI ---
  const filteredSeries = series.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredSeries.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredSeries.slice(startIndex, startIndex + itemsPerPage);

  // Reset ke halaman 1 saat mengetik
  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const openModal = (s = null) => {
    if (s) { setEditingId(s.id); setFormData({ name: s.name, year: s.year }); }
    else { setEditingId(null); setFormData({ name: '', year: new Date().getFullYear() }); }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/series/${editingId}`, formData);
      else await api.post('/admin/series', formData);
      setIsModalOpen(false);
      fetchSeries();
    } catch (err) { alert('Gagal menyimpan'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header dengan Pencarian */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Series / Kejuaraan</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredSeries.length} series ditemukan.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          <input 
            type="text" 
            placeholder="Cari nama series..." 
            className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
            <select className="p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-red-500" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              {[5, 10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <button onClick={() => openModal()} className="whitespace-nowrap px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition">
            + Tambah Series
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
              <th className="p-4 font-semibold">Nama Kejuaraan / Series</th>
              <th className="p-4 font-semibold">Tahun</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="3" className="text-center p-8 text-gray-500">Memuat...</td></tr>
            ) : currentItems.length === 0 ? (
              <tr><td colSpan="3" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr>
            ) : (
              currentItems.map(s => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="p-4 font-bold text-gray-800">{s.name}</td>
                  <td className="p-4 text-gray-600">{s.year}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openModal(s)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100">
        <DataTableFooter totalItems={filteredSeries.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Series' : 'Tambah Series'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Series</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tahun Kejuaraan</label>
            <input type="number" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} />
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
