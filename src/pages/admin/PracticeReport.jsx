import { useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../services/api';
import { formatMs } from '../../utils/timeFormat';

export default function PracticeReport() {
  const [events, setEvents] = useState([]);
  const [practices, setPractices] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedPracticeId, setSelectedPracticeId] = useState('');
  const [paperOrientation, setPaperOrientation] = useState(localStorage.getItem('practice_result_orientation') || 'landscape');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get('/events').then((res) => {
      const data = res.data.data || [];
      setEvents(data);
      setSelectedEventId(data[0]?.id || '');
    }).catch(() => alert('Gagal memuat daftar event.'));
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    api.get(`/practices/events/${selectedEventId}`).then((res) => {
      const data = res.data.data || [];
      setPractices(data);
      setSelectedPracticeId(data[0]?.id || '');
      setIsLoading(data.length > 0);
    }).catch(() => {
      setPractices([]);
      setSelectedPracticeId('');
      alert('Gagal memuat daftar Practice.');
    });
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedPracticeId) return;
    api.get(`/public/practice-results/${selectedPracticeId}`)
      .then((res) => setResult(res.data.data || null))
      .catch(() => alert('Gagal memuat Practice Result.'))
      .finally(() => setIsLoading(false));
  }, [selectedPracticeId]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);
  const selectedPractice = useMemo(() => practices.find((practice) => practice.id === selectedPracticeId), [practices, selectedPracticeId]);
  const maxRuns = result?.practice?.max_runs || selectedPractice?.max_runs || 0;
  const runColumns = Array.from({ length: maxRuns }, (_, index) => index + 1);
  const timeDecimalPlaces = selectedEvent?.time_decimal_places ?? 2;
  const columnWidths = practiceColumnWidths(runColumns.length);

  const changeOrientation = (value) => {
    setPaperOrientation(value);
    localStorage.setItem('practice_result_orientation', value);
  };

  const changeEvent = (eventId) => {
    setSelectedEventId(eventId);
    setPractices([]);
    setSelectedPracticeId('');
    setResult(null);
    setIsLoading(false);
  };

  const changePractice = (practiceId) => {
    setSelectedPracticeId(practiceId);
    setResult(null);
    setIsLoading(Boolean(practiceId));
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    let restored = false;
    const restoreTitle = () => {
      if (restored) return;
      restored = true;
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    document.title = ' ';
    window.print();
    window.setTimeout(restoreTitle, 3000);
  };

  return (
    <div className="min-h-full space-y-6">
      <style>{`
        @media print {
          @page { size: ${paperOrientation}; margin: 7mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff !important; margin: 0 !important; }
          aside, header, .no-print { display: none !important; }
          main, main > div { display: block !important; padding: 0 !important; background: #fff !important; }
          .print-panel { border: 0 !important; box-shadow: none !important; padding: 0 !important; }
          .print-header { break-after: avoid; page-break-after: avoid; margin-bottom: 8px !important; padding-bottom: 8px !important; }
          table { font-size: 8px; table-layout: fixed; width: 100%; }
          th, td { padding: 3px !important; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">Practice Result</h2>
            <p className="mt-1 text-sm text-gray-500">Rekap multi-run Practice dengan ranking berdasarkan best run.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_150px_auto] xl:w-auto">
            <SelectField label="Event" value={selectedEventId} onChange={changeEvent} placeholder="-- Pilih Event --" options={events} />
            <SelectField label="Practice" value={selectedPracticeId} onChange={changePractice} placeholder="-- Pilih Practice --" options={practices} />
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-500">Orientasi Kertas</span>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={paperOrientation} onChange={(event) => changeOrientation(event.target.value)}>
                <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select>
            </label>
            <button onClick={handlePrint} disabled={!selectedPracticeId || isLoading} className="admin-btn-primary self-end py-3">CETAK</button>
          </div>
        </div>
      </div>

      <div className="print-panel rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <PrintHeader event={selectedEvent} logoUrl={assetUrl(selectedEvent?.logo_url)} practice={result?.practice || selectedPractice} maxRuns={maxRuns} />
        {!selectedPracticeId ? (
          <EmptyState text="Pilih Practice terlebih dahulu." />
        ) : isLoading ? (
          <EmptyState text="Memuat..." />
        ) : !result?.entries?.length ? (
          <EmptyState text="Belum ada data." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <colgroup>
                <col style={{ width: columnWidths.rank }} /><col style={{ width: columnWidths.number }} /><col style={{ width: columnWidths.number }} />
                <col style={{ width: columnWidths.entrant }} /><col style={{ width: columnWidths.driver }} /><col style={{ width: columnWidths.className }} />
                {runColumns.map((runNo) => <col key={runNo} style={{ width: columnWidths.time }} />)}<col style={{ width: columnWidths.best }} />
              </colgroup>
              <thead><tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                <th className="border border-gray-300 p-2 text-center">Rank</th><th className="border border-gray-300 p-2 text-center">Practice No</th><th className="border border-gray-300 p-2 text-center">Race No</th>
                <th className="border border-gray-300 p-2">Entrant</th><th className="border border-gray-300 p-2">Driver / Navigator</th><th className="border border-gray-300 p-2">Class</th>
                {runColumns.map((runNo) => <th key={runNo} className="border border-gray-300 p-2 text-right">Run {runNo}</th>)}
                <th className="border border-gray-300 bg-green-50 p-2 text-right text-green-800">Best Time</th>
              </tr></thead>
              <tbody>{result.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="border border-gray-300 p-2 text-center font-black">{entry.rank || '-'}</td><td className="border border-gray-300 p-2 text-center font-black">{entry.practice_start_number}</td><td className="border border-gray-300 p-2 text-center">{entry.race_start_number}</td>
                  <td className="border border-gray-300 p-2">{entry.entrant_name || '-'}</td>
                  <td className="border border-gray-300 p-2"><div className="font-bold text-gray-900">{entry.driver_name || '-'}</div><div className="text-xs text-gray-500">{entry.codriver_name || '-'}</div><div className="text-[11px] text-gray-400">{entry.vehicle_name || '-'}</div></td>
                  <td className="border border-gray-300 p-2">{entry.class_name || '-'}</td>
                  {runColumns.map((runNo) => {
                    const run = (entry.runs || []).find((item) => item.run_no === runNo);
                    return <td key={runNo} className={`border border-gray-300 p-2 text-right font-mono font-bold ${entry.best_run_no === runNo ? 'bg-green-50 text-green-800' : ''}`}>{run?.finish_time ? formatMs(run.elapsed_time_ms, timeDecimalPlaces) : run?.start_time ? 'OPEN' : '-'}</td>;
                  })}
                  <td className="border border-gray-300 bg-green-50 p-2 text-right font-mono text-base font-black text-green-800">{entry.best_time_ms ? formatMs(entry.best_time_ms, timeDecimalPlaces) : 'NO TIME'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, placeholder, options }) {
  return <label><span className="mb-1 block text-xs font-bold text-gray-500">{label}</span><select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}

function EmptyState({ text }) {
  return <div className="border border-gray-300 p-8 text-center text-gray-500">{text}</div>;
}

function PrintHeader({ event, logoUrl, practice, maxRuns }) {
  return <div className="print-header mb-5 border-b border-gray-300 pb-4"><div className="grid min-h-32 grid-cols-[150px_1fr_150px] items-center gap-3">
    <div className="flex h-28 items-center justify-center bg-white">{logoUrl ? <img src={logoUrl} alt="Logo event" className="max-h-28 w-auto max-w-full object-contain" /> : <span className="text-center text-[10px] font-black uppercase text-gray-400">Logo Event</span>}</div>
    <div className="self-center text-center"><h1 className="text-xl font-black uppercase tracking-wide text-gray-900">{event?.name || 'Practice Result'}</h1><p className="text-sm font-bold capitalize text-gray-700">{formatEventDateRange(event)}</p><p className="text-sm font-semibold text-gray-600">{event?.location || '-'}</p><p className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{practice?.name || 'Practice'} · Best Run · Maksimal {maxRuns} Run</p></div>
    <div className="flex h-28 flex-col items-center justify-center gap-2"><span className="inline-block border-2 border-gray-900 px-3 py-2 text-center text-xs font-black uppercase leading-tight tracking-wide">Practice Result</span><p className="text-center text-[10px] font-bold text-gray-600">Tanggal Cetak: {formatPrintDate(new Date())}</p></div>
  </div></div>;
}

function practiceColumnWidths(runCount) {
  const safeRuns = Math.max(runCount, 1);
  const time = Math.max(6, Math.min(9, Math.floor(38 / safeRuns)));
  const remaining = Math.max(24, 100 - 38 - (time * safeRuns));
  return { rank: '5%', number: '7%', entrant: `${Math.round(remaining * 0.4)}%`, driver: `${Math.round(remaining * 0.6)}%`, className: '9%', time: `${time}%`, best: '10%' };
}

function formatPrintDate(date) {
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatEventDateRange(event) {
  if (!event?.start_date) return '-';
  const formatDate = (value) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value));
  if (!event.end_date || event.end_date === event.start_date) return formatDate(event.start_date);
  return `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`;
}
