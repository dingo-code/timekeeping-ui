import { useState } from 'react';
import axios from 'axios';

export default function PetugasFinishPage() {
  const [formData, setFormData] = useState({
    participant_id: '',
    ss_id: '', // Diambil dari konteks event saat ini
    start_time: '', // Format: HH:mm:ss.mmm
    finish_time: '' // Format: HH:mm:ss.mmm
  });

  const [loading, setLoading] = useState(false);

  // Fungsi mengubah waktu "08:15:25.450" menjadi milidetik sejak tengah malam
  const timeToMs = (timeStr) => {
    if (!timeStr) return 0;
    const [time, ms] = timeStr.split('.');
    const [h, m, s] = time.split(':').map(Number);
    return (h * 3600000) + (m * 60000) + (s * 1000) + (ms ? Number(ms) : 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const startMs = timeToMs(formData.start_time);
    const finishMs = timeToMs(formData.finish_time);
    const elapsedMs = finishMs - startMs;

    const payload = {
      participant_id: formData.participant_id,
      ss_id: formData.ss_id,
      start_time: formData.start_time,
      finish_time: formData.finish_time,
      elapsed_time_ms: elapsedMs,
      status: 'OK'
    };

    try {
      await axios.post('http://localhost:6060/api/v1/timekeeping/ss-records', payload);
      alert('✅ Waktu berhasil dikirim ke Server (RabbitMQ)!');
      // Reset form
      setFormData({ ...formData, participant_id: '', start_time: '', finish_time: '' });
    } catch (error) {
      alert('❌ Gagal mengirim: ' + error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">🏁 Pos Finish SS</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700">ID Peserta (No. Pintu)</label>
            <input type="text" className="w-full p-2 border rounded" required
              value={formData.participant_id} onChange={e => setFormData({...formData, participant_id: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">Waktu Start Pembalap</label>
            <input type="text" placeholder="HH:mm:ss.mmm" className="w-full p-2 border rounded" required
              value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700">Waktu Finish Pembalap</label>
            <input type="text" placeholder="HH:mm:ss.mmm" className="w-full p-2 border rounded" required
              value={formData.finish_time} onChange={e => setFormData({...formData, finish_time: e.target.value})} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-red-600 text-white font-bold py-3 rounded hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Mengirim...' : 'KIRIM WAKTU'}
          </button>
        </form>
      </div>
    </div>
  );
}