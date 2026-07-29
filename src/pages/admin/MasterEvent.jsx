import { useState, useEffect } from 'react';
import api, { assetUrl } from '../../services/api';
import Modal from '../../components/Modal';
import { Link } from 'react-router-dom';
import DataTableFooter from '../../components/DataTableFooter';

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
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [logoFile, setLogoFile] = useState(null);

  const [formData, setFormData] = useState({
    series_id: '', point_system_id: '', name: '', 
    start_date: '', end_date: '', location: '', logo_url: '', bwtm_penalty_minutes: 3,
    dns_penalty_minutes: 5,
    tc_late_penalty_seconds_per_minute: 10,
    tc_early_penalty_seconds_per_minute: 60,
    tc_max_delta_minutes: 15,
    join_car_tc_tolerance_minutes: 22,
    time_decimal_places: 2,
    is_active: true
  });

  useEffect(() => {
    fetchEvents();
    fetchDependencies();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/admin/events');
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
    (e.location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const currentItems = filteredEvents.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, itemsPerPage]);

  const openModal = (event = null) => {
    if (event) {
      setEditingId(event.id);
      setFormData({
        series_id: event.series_id,
        point_system_id: event.point_system_id,
        name: event.name,
        start_date: event.start_date.split('T')[0],
        end_date: event.end_date.split('T')[0],
        location: event.location,
        logo_url: event.logo_url || '',
        bwtm_penalty_minutes: event.bwtm_penalty_minutes ?? 3,
        dns_penalty_minutes: event.dns_penalty_minutes ?? 5,
        tc_late_penalty_seconds_per_minute: event.tc_late_penalty_seconds_per_minute ?? 10,
        tc_early_penalty_seconds_per_minute: event.tc_early_penalty_seconds_per_minute ?? 60,
        tc_max_delta_minutes: event.tc_max_delta_minutes ?? 15,
        join_car_tc_tolerance_minutes: event.join_car_tc_tolerance_minutes ?? 22,
        time_decimal_places: event.time_decimal_places ?? 2,
        is_active: event.is_active ?? true
      });
    } else {
      setEditingId(null);
      setFormData({
        series_id: series[0]?.id || '',
        point_system_id: pointSystems[0]?.id || '',
        name: '',
        start_date: '',
        end_date: '',
        location: '',
        logo_url: '',
        bwtm_penalty_minutes: 3,
        dns_penalty_minutes: 5,
        tc_late_penalty_seconds_per_minute: 10,
        tc_early_penalty_seconds_per_minute: 60,
        tc_max_delta_minutes: 15,
        join_car_tc_tolerance_minutes: 22,
        time_decimal_places: 2,
        is_active: true
      });
    }
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = new FormData();
      Object.entries(formData).forEach(([key, value]) => payload.append(key, value ?? ''));
      if (logoFile) payload.append('logo', logoFile);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (editingId) await api.put(`/admin/events/${editingId}`, payload, config);
      else await api.post('/admin/events', payload, config);
      setIsModalOpen(false);
      fetchEvents();
    } catch (err) { alert('Gagal menyimpan event'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Daftar Event Balap</h2>
          <p className="text-sm text-gray-500 mt-1">Total {events.length} event terdaftar.</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-3">
          <input 
            type="text" placeholder="Cari event atau lokasi..." 
            className="w-full sm:w-64 p-2 text-sm border rounded-lg outline-none focus:ring-1 focus:ring-red-500"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 whitespace-nowrap">Tampilkan</label>
            <select className="p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-red-500" value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))}>
              {[6, 12, 24, 48, 96].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <button onClick={() => openModal()} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition whitespace-nowrap">+ Buat Event Baru</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
        {isLoading ? <p className="text-center col-span-full">Memuat...</p> : 
         currentItems.length === 0 ? <p className="text-center col-span-full">Tidak ada event ditemukan.</p> :
         currentItems.map(event => (
          <div key={event.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition bg-white">
            {event.logo_url && (
              <div className="h-16 mb-3 flex items-center">
                <img src={assetUrl(event.logo_url)} alt={`Logo ${event.name}`} className="max-h-16 max-w-28 object-contain" />
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold text-gray-900">{event.name}</h3>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ${event.is_active ?? true ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                {event.is_active ?? true ? 'Aktif' : 'Tidak aktif'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">📍 {event.location}</p>
            <div className="mt-4 pt-4 border-t text-xs font-bold text-gray-700">Jadwal: {event.start_date.split('T')[0]}</div>
            <div className="mt-1 text-xs font-bold text-gray-500">BWTM: +{event.bwtm_penalty_minutes ?? 3} menit</div>
            <div className="mt-1 text-xs font-bold text-gray-500">DNS 1 pos: +{event.dns_penalty_minutes ?? 5} menit</div>
            <div className="mt-1 text-xs font-bold text-gray-500">Decimal time: {event.time_decimal_places ?? 2} digit</div>
            <div className="mt-1 text-xs font-bold text-gray-500">TC: telat +{event.tc_late_penalty_seconds_per_minute ?? 10} dtk/m, cepat +{event.tc_early_penalty_seconds_per_minute ?? 60} dtk/m</div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => openModal(event)} className="flex-1 py-2 text-xs font-bold bg-gray-200 rounded hover:bg-gray-300">EDIT</button>
              <Link to={`/admin/event/${event.id}`} className="flex-[2] py-2 text-center text-xs font-bold bg-red-600 text-white rounded hover:bg-red-700">KELOLA</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-100">
        <DataTableFooter totalItems={filteredEvents.length} currentPage={safeCurrentPage} totalPages={totalPages} pageSize={itemsPerPage} searchTerm={searchTerm} onPageChange={setCurrentPage} />
      </div>

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
            <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3">
              <span>
                <span className="block text-sm font-bold text-gray-700">Status Event</span>
                <span className="block text-xs text-gray-500">Event aktif muncul di petugas pos, kamar hitung, leaderboard, dan result.</span>
              </span>
              <span className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_active)}
                  onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                Aktif
              </span>
            </label>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">BWTM tambahan menit</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="w-full p-2 border rounded"
                value={formData.bwtm_penalty_minutes}
                onChange={e => setFormData({...formData, bwtm_penalty_minutes: e.target.value})}
                placeholder="Default 3 menit, contoh 2.5"
              />
              <p className="mt-1 text-xs text-gray-500">DNF sebelum SS terakhir: waktu tercepat kelas di SS tersebut + nilai ini.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">DNS 1 pos menit</label>
              <input
                type="number"
                min="1"
                step="0.01"
                inputMode="decimal"
                className="w-full p-2 border rounded"
                value={formData.dns_penalty_minutes}
                onChange={e => setFormData({...formData, dns_penalty_minutes: e.target.value})}
                placeholder="Default 5 menit, contoh 2.5"
              />
              <p className="mt-1 text-xs text-gray-500">DNS: BWTM + nilai 1 pos ini. Default 1 pos = 5 menit.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3">
              <div className="sm:col-span-2">
                <h3 className="text-sm font-black text-gray-800">Aturan Penalti TC</h3>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">Telat: detik per menit</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full p-2 border rounded"
                  value={formData.tc_late_penalty_seconds_per_minute}
                  onChange={e => setFormData({...formData, tc_late_penalty_seconds_per_minute: e.target.value})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">Cepat: detik per menit</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full p-2 border rounded"
                  value={formData.tc_early_penalty_seconds_per_minute}
                  onChange={e => setFormData({...formData, tc_early_penalty_seconds_per_minute: e.target.value})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">Maks cepat/telat menit</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full p-2 border rounded"
                  value={formData.tc_max_delta_minutes}
                  onChange={e => setFormData({...formData, tc_max_delta_minutes: e.target.value})}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-600">Toleransi join car menit</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full p-2 border rounded"
                  value={formData.join_car_tc_tolerance_minutes}
                  onChange={e => setFormData({...formData, join_car_tc_tolerance_minutes: e.target.value})}
                />
              </div>
              <p className="sm:col-span-2 text-xs text-gray-500">Default: telat 10 detik/menit, cepat 60 detik/menit, maksimal cepat/telat 15 menit. Join car: peserta pertama tetap pakai target TC normal; peserta kedua diberi toleransi 22 menit dari start peserta pertama.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-gray-700">Decimal Time</label>
              <select
                className="w-full p-2 border rounded"
                value={formData.time_decimal_places}
                onChange={e => setFormData({...formData, time_decimal_places: Number(e.target.value)})}
              >
                <option value={1}>1 digit - contoh 05:12,3</option>
                <option value={2}>2 digit - contoh 05:12,34</option>
                <option value={3}>3 digit - contoh 05:12,345</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Mengatur tampilan result, leaderboard, monitoring, timecard, dan shakedown result untuk event ini.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Logo Event</label>
              {(formData.logo_url || logoFile) && (
                <div className="h-20 flex items-center border border-gray-200 rounded p-2 bg-gray-50">
                  <img
                    src={logoFile ? URL.createObjectURL(logoFile) : assetUrl(formData.logo_url)}
                    alt="Preview logo event"
                    className="max-h-16 max-w-32 object-contain"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="w-full p-2 border rounded text-sm"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
              {formData.logo_url && !logoFile && <p className="text-xs text-gray-500">Biarkan kosong jika tidak ingin mengganti logo.</p>}
            </div>
            <button type="submit" className="w-full py-2 bg-red-600 text-white rounded font-bold">Simpan</button>
        </form>
      </Modal>
    </div>
  );
}
