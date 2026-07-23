import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

export default function MasterVehicle() {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ brand: '', type: '', engine_capacity: '' });

  // State Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/vehicles');
      setVehicles(response.data.data || []);
    } catch (error) {
      alert('Gagal mengambil data kendaraan: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIKA SEARCH & PAGINATION ---
  // 1. Filter data berdasarkan pencarian (Mencari di Merk atau Tipe)
  const filteredVehicles = vehicles.filter((v) => 
    v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Hitung total halaman dan potong data untuk halaman saat ini
  const totalPages = Math.max(1, Math.ceil(filteredVehicles.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredVehicles.slice(startIndex, startIndex + itemsPerPage);

  // Reset ke halaman 1 jika user mulai mengetik pencarian baru
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);
  // ----------------------------------

  const openModal = (vehicle = null) => {
    if (vehicle) {
      setEditingId(vehicle.id);
      setFormData({ brand: vehicle.brand, type: vehicle.type, engine_capacity: vehicle.engine_capacity });
    } else {
      setEditingId(null);
      setFormData({ brand: '', type: '', engine_capacity: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, engine_capacity: parseInt(formData.engine_capacity, 10) };
    try {
      if (editingId) await api.put(`/admin/vehicles/${editingId}`, payload);
      else await api.post('/admin/vehicles', payload);
      closeModal();
      fetchVehicles();
    } catch (error) {
      alert('Gagal menyimpan: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus data ini?')) return;
    try {
      await api.delete(`/admin/vehicles/${id}`);
      fetchVehicles();
    } catch (error) {
      alert('Gagal menghapus: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header Tabel */}
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Kendaraan</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredVehicles.length} data ditemukan.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          {/* Kolom Pencarian */}
          <input 
            type="text" 
            placeholder="Cari merk atau tipe..." 
            className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
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
            + Tambah
          </button>
        </div>
      </div>

      {/* Tabel Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-200">
              <th className="p-4 font-semibold">Merk (Brand)</th>
              <th className="p-4 font-semibold">Tipe</th>
              <th className="p-4 font-semibold">Kapasitas (CC)</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan="4" className="text-center p-8 text-gray-500">Memuat data...</td></tr>
            ) : currentItems.length === 0 ? (
              <tr><td colSpan="4" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr>
            ) : (
              currentItems.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="p-4 font-medium text-gray-800">{v.brand}</td>
                  <td className="p-4 text-gray-600">{v.type}</td>
                  <td className="p-4 text-gray-600">{v.engine_capacity} cc</td>
                  <td className="p-4 text-right space-x-3">
                    <button onClick={() => openModal(v)} className="text-blue-600 hover:underline text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(v.id)} className="text-red-600 hover:underline text-sm font-medium">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-100">
        <DataTableFooter totalItems={filteredVehicles.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

      {/* Modal Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Edit Kendaraan' : 'Tambah Kendaraan'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Merk (Brand)</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Tipe Kendaraan</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Kapasitas (CC)</label>
            <input type="number" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.engine_capacity} onChange={e => setFormData({...formData, engine_capacity: e.target.value})} />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Simpan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
