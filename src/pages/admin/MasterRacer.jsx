import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import DataTableFooter from '../../components/DataTableFooter';

export default function MasterRacer() {
  const [racers, setRacers] = useState([]);
  const [regions, setRegions] = useState([]); // Untuk dropdown
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    kis_number: '', full_name: '', gender: 'L', dob: '', 
    blood_type: 'O', region_id: '', is_driver: true, is_codriver: false
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  useEffect(() => {
    fetchRacers();
    fetchRegions();
  }, []);

  const fetchRacers = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/racers');
      setRacers(res.data.data || []);
    } catch (e) { alert('Gagal memuat data pembalap'); }
    finally { setIsLoading(false); }
  };

  const fetchRegions = async () => {
    try {
      const res = await api.get('/admin/regions');
      setRegions(res.data.data || []);
    } catch (e) { console.error('Gagal mengambil wilayah'); }
  };

  // Helper untuk mengubah string ISO timestamp menjadi YYYY-MM-DD
  const formatDate = (isoString) => isoString ? isoString.split('T')[0] : '';

  const filteredRacers = racers.filter(r => 
    r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.kis_number.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredRacers.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredRacers.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const openModal = (r = null) => {
    if (r) { 
      setEditingId(r.id); 
      setFormData({ 
        kis_number: r.kis_number, full_name: r.full_name, gender: r.gender, 
        dob: formatDate(r.dob), blood_type: r.blood_type, region_id: r.region_id, 
        is_driver: r.is_driver, is_codriver: r.is_codriver 
      }); 
    } else { 
      setEditingId(null); 
      setFormData({ 
        kis_number: '', full_name: '', gender: 'L', dob: '', 
        blood_type: 'O', region_id: regions[0]?.id || '', is_driver: true, is_codriver: false 
      }); 
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.is_driver && !formData.is_codriver) {
      alert("Peserta harus bertindak minimal sebagai Driver atau Navigator!");
      return;
    }

    try {
      if (editingId) await api.put(`/admin/racers/${editingId}`, formData);
      else await api.post('/admin/racers', formData);
      setIsModalOpen(false);
      fetchRacers();
    } catch (err) { alert('Gagal menyimpan: ' + (err.response?.data?.error || err.message)); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pembalap ini?')) return;
    try { await api.delete(`/admin/racers/${id}`); fetchRacers(); }
    catch (e) { alert('Gagal menghapus'); }
  };

  // Helper mendapatkan nama region dari ID
  const getRegionName = (id) => regions.find(reg => reg.id === id)?.name || 'Unknown';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Master Pembalap (Racer)</h2>
          <p className="text-sm text-gray-500 mt-1">Total {filteredRacers.length} pembalap terdaftar.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          <input type="text" placeholder="Cari no KIS atau nama..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
              <th className="p-4 font-semibold">No KIS</th>
              <th className="p-4 font-semibold">Nama Lengkap</th>
              <th className="p-4 font-semibold">Pengprov</th>
              <th className="p-4 font-semibold">Peran</th>
              <th className="p-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan="5" className="text-center p-8 text-gray-500">Memuat...</td></tr> : 
             currentItems.length === 0 ? <tr><td colSpan="5" className="text-center p-8 text-gray-500">Data tidak ditemukan.</td></tr> :
             currentItems.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                <td className="p-4 font-mono font-bold text-red-600">{r.kis_number}</td>
                <td className="p-4 font-medium text-gray-800">{r.full_name} <span className="text-xs text-gray-400">({r.blood_type})</span></td>
                <td className="p-4 text-gray-600">{getRegionName(r.region_id)}</td>
                <td className="p-4 text-xs font-bold">
                  {r.is_driver && <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded mr-1">D</span>}
                  {r.is_codriver && <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Navigator</span>}
                </td>
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
        <DataTableFooter totalItems={filteredRacers.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? 'Edit Pembalap' : 'Pendaftaran Pembalap'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">No KIS</label>
              <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500 uppercase" value={formData.kis_number} onChange={e => setFormData({...formData, kis_number: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Gol. Darah</label>
              <select className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.blood_type} onChange={e => setFormData({...formData, blood_type: e.target.value})}>
                <option value="A">A</option><option value="B">B</option><option value="AB">AB</option><option value="O">O</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Lengkap</label>
            <input type="text" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Jenis Kelamin</label>
              <select className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                <option value="L">Laki-laki</option><option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tanggal Lahir</label>
              <input type="date" required className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Pengprov / Wilayah</label>
            <select className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-red-500" value={formData.region_id} onChange={e => setFormData({...formData, region_id: e.target.value})}>
              <option value="" disabled>Pilih Wilayah...</option>
              {regions.map(reg => <option key={reg.id} value={reg.id}>{reg.name}</option>)}
            </select>
          </div>

          <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
            <p className="block text-sm font-semibold text-gray-700 mb-2">Peran Balap (Bisa dua-duanya)</p>
            <div className="flex space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 text-red-600 rounded" checked={formData.is_driver} onChange={e => setFormData({...formData, is_driver: e.target.checked})} />
                <span className="text-sm font-medium">Driver (Supir)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 text-red-600 rounded" checked={formData.is_codriver} onChange={e => setFormData({...formData, is_codriver: e.target.checked})} />
                <span className="text-sm font-medium">Navigator</span>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="admin-btn-muted">Batal</button>
            <button type="submit" className="admin-btn-primary font-medium">Simpan Data</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
