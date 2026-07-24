import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

export default function ShakedownReport() {
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [report, setReport] = useState({ max_attempts: 0, entries: [] });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchStages(selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedEventId && selectedStageId) fetchReport();
    else setReport({ max_attempts: 0, entries: [] });
  }, [selectedEventId, selectedStageId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId),
    [stages, selectedStageId]
  );

  const attemptColumns = Array.from({ length: report.max_attempts || 0 }, (_, index) => index + 1);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      const nextEvents = res.data.data || [];
      setEvents(nextEvents);
      if (nextEvents.length > 0) setSelectedEventId(nextEvents[0].id);
    } catch {
      alert('Gagal memuat daftar event.');
    }
  };

  const fetchStages = async (eventId) => {
    try {
      const res = await api.get(`/events/${eventId}/stages`);
      const shakedownStages = (res.data.data || []).filter((stage) => stage.is_shakedown);
      setStages(shakedownStages);
      setSelectedStageId(shakedownStages[0]?.id || '');
    } catch {
      setStages([]);
      setSelectedStageId('');
      alert('Gagal memuat daftar shakedown.');
    }
  };

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const stageParam = selectedStageId ? `?stage_id=${selectedStageId}` : '';
      const res = await api.get(`/public/shakedown-report/${selectedEventId}${stageParam}`);
      setReport(res.data.data || { max_attempts: 0, entries: [] });
    } catch {
      alert('Gagal memuat report shakedown.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-full space-y-6">
      <style>{`
        @media print {
          @page { size: portrait; margin: 7mm; }
          aside, header, .no-print { display: none !important; }
          main, main > div { display: block !important; padding: 0 !important; background: #fff !important; }
          .print-panel { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
          table { font-size: 8px; table-layout: fixed; width: 100%; }
          th, td { padding: 3px !important; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          .print-driver { width: 22%; }
          .print-small { width: 10%; }
          .print-time { width: 8%; }
        }
      `}</style>

      <div className="no-print rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">Report Shakedown</h2>
            <p className="mt-1 text-sm text-gray-500">Rekap multi-run shakedown per peserta.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto] xl:w-auto">
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-500">Event</span>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">-- Pilih Event --</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-500">Shakedown</span>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={selectedStageId} onChange={(e) => setSelectedStageId(e.target.value)}>
                <option value="">-- Pilih Shakedown --</option>
                {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.ss_name}</option>)}
              </select>
            </label>
            <button onClick={handlePrint} disabled={!selectedEventId || isLoading} className="self-end rounded-lg bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">
              CETAK
            </button>
          </div>
        </div>
      </div>

      <div className="print-panel rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 border-b border-gray-200 pb-4 text-center">
          <h1 className="text-2xl font-black uppercase text-gray-900">{selectedEvent?.name || 'Report Shakedown'}</h1>
          <p className="mt-1 text-sm font-bold uppercase text-gray-500">{selectedStage?.ss_name || 'Semua Shakedown'}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="border border-gray-300 p-2 text-center">No Start</th>
                <th className="print-driver border border-gray-300 p-2">Driver / Co Driver</th>
                <th className="print-small border border-gray-300 p-2">Entrant</th>
                <th className="print-small border border-gray-300 p-2">Class</th>
                <th className="print-small border border-gray-300 p-2">Regional</th>
                {attemptColumns.map((attemptNo) => (
                  <th key={attemptNo} className="print-time border border-gray-300 p-2 text-right">Time {attemptNo}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!selectedStageId ? (
                <tr><td colSpan={5 + attemptColumns.length} className="border border-gray-300 p-8 text-center text-gray-500">Pilih shakedown terlebih dahulu.</td></tr>
              ) : isLoading ? (
                <tr><td colSpan={5 + attemptColumns.length} className="border border-gray-300 p-8 text-center text-gray-500">Memuat...</td></tr>
              ) : report.entries.length === 0 ? (
                <tr><td colSpan={5 + attemptColumns.length} className="border border-gray-300 p-8 text-center text-gray-500">Belum ada data.</td></tr>
              ) : report.entries.map((entry) => (
                <tr key={entry.participant_id}>
                  <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                  <td className="border border-gray-300 p-2">
                    <div className="font-bold text-gray-900">{entry.driver_name}</div>
                    <div className="text-xs text-gray-500">{entry.codriver_name || '-'}</div>
                  </td>
                  <td className="border border-gray-300 p-2">{entry.entrant_name || '-'}</td>
                  <td className="border border-gray-300 p-2">{entry.class_name || '-'}</td>
                  <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                  {attemptColumns.map((attemptNo) => {
                    const run = entry.runs.find((item) => item.attempt_no === attemptNo);
                    return (
                      <td key={attemptNo} className="border border-gray-300 p-2 text-right font-mono font-bold">
                        {run ? formatMs(run.total_time_ms) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatMs(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return '-';

  const totalCentiseconds = Math.round(value / 10);
  const centiseconds = (totalCentiseconds % 100).toString().padStart(2, '0');
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60);

  return hours > 0 ? `${hours}:${minutes}:${seconds},${centiseconds}` : `${minutes}:${seconds},${centiseconds}`;
}
