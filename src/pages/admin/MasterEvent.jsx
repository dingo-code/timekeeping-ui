import { useState, useEffect } from 'react';
import api from '../../services/api';
import Modal from '../../components/Modal';
import { Link } from 'react-router-dom';

export default function MasterEvent() {
  const [events, setEvents] = useState([]);
  const [series, setSeries] = useState([]);
  const [pointSystems, setPointSystems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State Edit & Pagination
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [formData, setFormData] = useState({
    series_id: '', point_system_id: '', name: '', 
    start_date: '', end_date: '', location: ''
  });

  useEffect(() => {
    fetchEvents();
    fetchDependencies();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/events');
      setEvents(res.data.data || []);
    } catch (e) { alert('Gagal memuat event'); }
    finally { setIsLoading(false); }
  };

  const fetchDependencies = async () => {
    try {
      const resSeries = await api.get('/admin/series');
      const resPS = await api.get('/admin/point-systems');
      setSeries(resSeries.data.data || []);
      setPointSystems(resPS.data.data || []);
    } catch (e) { console.error('Gagal memuat data pendukung'); }
  };

  // Logic Pencarian & Paginasi
  const filteredEvents = events.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.location.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const currentItems = filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openModal = (event = null) => {
    if (event) {
      setEditingId(event.id);
      setFormData({
        series_id: event.series_id,
        point_system_id: event.point_system_id,
        name: event.name,
        start_date: event.start_date.split('T')[0],
        end_date: event.end_date.split('T')[0],
        location: event.location
      });
    } else {
      setEditingId(null);
      setFormData({ series_id: series[0]?.id || '', point_system_id: pointSystems[0]?.id || '', name: '', start_date: '', end_date: '', location: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await api.put(`/admin/events/${editingId}`, formData);
      else await api.post('/admin/events', formData);
      setIsModalOpen(false);
      fetchEvents();
    } catch (err) { alert('Gagal menyimpan event'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Daftar Event Balap</h2>
          <input 
            type="text" placeholder="Cari event atau lokasi..." 
            className="mt-2 p-2 w-64 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-red-500"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button onClick={() => openModal()} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">+ Buat Event Baru</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {isLoading ? <p className="text-center col-span-full">Memuat...</p> : 
         currentItems.length === 0 ? <p className="text-center col-span-full">Tidak ada event ditemukan.</p> :
         currentItems.map(event => (
          <div key={event.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition bg-white">
            <h3 className="text-lg font-extrabold text-gray-900">{event.name}</h3>
            <p className="text-xs text-gray-500 mt-1">📍 {event.location}</p>
            <div className="mt-4 pt-4 border-t text-xs font-bold text-gray-700">Jadwal: {event.start_date.split('T')[0]}</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openModal(event)} className="flex-1 py-2 text-xs font-bold bg-gray-200 rounded hover:bg-gray-300">EDIT</button>
              <Link to={`/admin/event/${event.id}`} className="flex-[2] py-2 text-center text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700">KELOLA</Link>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="p-4 flex justify-center gap-2 border-t">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 border rounded text-sm">Prev</button>
          <span className="px-3 py-1 text-sm font-bold">{currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 border rounded text-sm">Next</button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Event" : "Konfigurasi Event Baru"}>
        {/* Form Modal tetap sama dengan input formData yang sudah di-bind */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* ... isi form sama seperti sebelumnya, pastikan field terikat dengan formData ... */}
             <div className="grid grid-cols-2 gap-4">
                <select className="p-2 border rounded" value={formData.series_id} onChange={e => setFormData({...formData, series_id: e.target.value})}>
                    {series.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="p-2 border rounded" value={formData.point_system_id} onChange={e => setFormData({...formData, point_system_id: e.target.value})}>
                    {pointSystems.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <input type="text" className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nama Event"/>
            <input type="date" className="w-full p-2 border rounded" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})}/>
            <input type="date" className="w-full p-2 border rounded" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})}/>
            <input type="text" className="w-full p-2 border rounded" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Lokasi"/>
            <button type="submit" className="w-full py-2 bg-red-600 text-white rounded font-bold">Simpan</button>
        </form>
      </Modal>
    </div>
  );
}