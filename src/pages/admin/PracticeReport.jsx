import { useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../services/api';
import { formatMs } from '../../utils/timeFormat';
import { UnofficialResultMark } from '../../components/UnofficialTimingNotice';
import { OrientationField, PaperSizeField, PrintLayoutStyle } from '../../components/PrintLayout';
import { normalizePaperSize } from '../../utils/printLayout';

export default function PracticeReport() {
  const [events, setEvents] = useState([]);
  const [practices, setPractices] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedPracticeId, setSelectedPracticeId] = useState('');
  const [paperOrientation, setPaperOrientation] = useState(localStorage.getItem('practice_result_orientation') || 'landscape');
  const [paperSize, setPaperSize] = useState(normalizePaperSize(localStorage.getItem('practice_result_paper_size')));
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
  const columnWidths = practiceColumnWidths(runColumns.length, paperOrientation);

  const changeOrientation = (value) => {
    setPaperOrientation(value);
    localStorage.setItem('practice_result_orientation', value);
  };

  const changePaperSize = (value) => {
    const nextValue = normalizePaperSize(value);
    setPaperSize(nextValue);
    localStorage.setItem('practice_result_paper_size', nextValue);
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
      <PrintLayoutStyle paperSize={paperSize} orientation={paperOrientation} />

      <div className="no-print rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">Practice Result</h2>
            <p className="mt-1 text-sm text-gray-500">Rekap multi-run Practice dengan ranking berdasarkan best run.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_140px_140px_auto] xl:w-auto">
            <SelectField label="Event" value={selectedEventId} onChange={changeEvent} placeholder="-- Pilih Event --" options={events} />
            <SelectField label="Practice" value={selectedPracticeId} onChange={changePractice} placeholder="-- Pilih Practice --" options={practices} />
            <PaperSizeField value={paperSize} onChange={changePaperSize} />
            <OrientationField value={paperOrientation} onChange={changeOrientation} />
            <button onClick={handlePrint} disabled={!selectedPracticeId || isLoading} className="admin-btn-primary self-end py-3">CETAK</button>
          </div>
        </div>
      </div>

      <div className="print-panel rounded-xl border border-gray-200 bg-white p-6 shadow-sm" data-orientation={paperOrientation} data-paper-size={paperSize}>
        <PrintHeader event={selectedEvent} logoUrl={assetUrl(selectedEvent?.logo_url)} practice={result?.practice || selectedPractice} maxRuns={maxRuns} />
        {!selectedPracticeId ? (
          <EmptyState text="Pilih Practice terlebih dahulu." />
        ) : isLoading ? (
          <EmptyState text="Memuat..." />
        ) : !result?.entries?.length ? (
          <EmptyState text="Belum ada data." />
        ) : (
          <div className="print-table-wrap overflow-x-auto">
            <table className="uniform-result-table w-full border-collapse text-[11px] leading-tight">
              <colgroup>
                <col style={{ width: columnWidths.rank }} /><col style={{ width: columnWidths.number }} /><col style={{ width: columnWidths.number }} />
                <col style={{ width: columnWidths.entrant }} /><col style={{ width: columnWidths.driver }} /><col style={{ width: columnWidths.navigator }} /><col style={{ width: columnWidths.className }} />
                {runColumns.map((runNo) => <col key={runNo} style={{ width: columnWidths.time }} />)}<col style={{ width: columnWidths.best }} />
              </colgroup>
              <thead><tr className="bg-slate-300 text-center text-[10px] uppercase text-slate-900">
                <th className="border border-gray-300 p-2 text-center">Pos</th><th className="border border-gray-300 p-2 text-center">Practice No</th><th className="border border-gray-300 p-2 text-center">Car No</th>
                <th className="border border-gray-300 p-2 text-center">Entrant</th><th className="border border-gray-300 p-2 text-center">Driver</th><th className="border border-gray-300 p-2 text-center">Navigator</th><th className="border border-gray-300 p-2 text-center">CLS</th>
                {runColumns.map((runNo) => <th key={runNo} className="border border-gray-300 p-2 text-center">Run {runNo}</th>)}
                <th className="border border-gray-300 p-2 text-center">Best Time</th>
              </tr></thead>
              <tbody>{result.entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="border border-gray-300 p-2 text-center font-black">{entry.rank || '-'}</td><td className="border border-gray-300 p-2 text-center font-black">{entry.practice_start_number}</td><td className="border border-gray-300 p-2 text-center">{entry.race_start_number}</td>
                  <td className="border border-gray-300 p-2">{entry.entrant_name || '-'}</td>
                  <td className="border border-gray-300 p-2">{entry.driver_name || '-'}</td>
                  <td className="border border-gray-300 p-2">{entry.codriver_name || '-'}</td>
                  <td className="border border-gray-300 p-2">{entry.class_name || '-'}</td>
                  {runColumns.map((runNo) => {
                    const run = (entry.runs || []).find((item) => item.run_no === runNo);
                    return <td key={runNo} className={`border border-gray-300 p-2 text-right font-mono font-bold ${entry.best_run_no === runNo ? 'bg-green-50 text-green-800' : ''}`}>{run?.finish_time ? formatMs(run.elapsed_time_ms, timeDecimalPlaces) : run?.start_time ? 'OPEN' : '-'}</td>;
                  })}
                  <td className="border border-gray-300 p-2 text-right font-mono">{entry.best_time_ms ? formatMs(entry.best_time_ms, timeDecimalPlaces) : 'NO TIME'}</td>
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
  return <div className="print-header mb-5 border-b border-gray-300 pb-4"><div className="print-header-grid grid min-h-32 grid-cols-[150px_1fr_150px] items-center gap-3">
    <div className="print-logo-box flex h-28 items-center justify-center bg-white">{logoUrl ? <img src={logoUrl} alt="Logo event" className="print-logo-img max-h-28 w-auto max-w-full object-contain" /> : <span className="text-center text-[10px] font-black uppercase text-gray-400">Logo Event</span>}</div>
    <div className="self-center text-center"><h1 className="print-title text-xl font-black uppercase tracking-wide text-gray-900">{event?.name || 'Practice Result'}</h1><p className="print-subtitle text-sm font-bold capitalize text-gray-700">{formatEventDateRange(event)}</p><p className="print-subtitle text-sm font-semibold text-gray-600">{event?.location || '-'}</p><p className="print-subtitle mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{practice?.name || 'Practice'} · Best Run · Maksimal {maxRuns} Run</p></div>
    <div className="print-meta-box flex h-28 flex-col items-center justify-center gap-1"><span className="print-status inline-block border-2 border-gray-900 px-3 py-1.5 text-center text-xs font-black uppercase leading-tight tracking-wide">Practice Result</span><UnofficialResultMark /><p className="print-date text-center text-[9px] font-bold text-gray-600">Tanggal Cetak: {formatPrintDate(new Date())}</p></div>
  </div></div>;
}

function practiceColumnWidths(runCount, orientation = 'landscape') {
  const safeRuns = Math.max(runCount, 1);
  const fixed = { rank: 5, number: 7, className: 9, best: orientation === 'portrait' ? 11 : 10 };
  const fixedTotal = fixed.rank + (fixed.number * 2) + fixed.className + fixed.best;
  const peopleTotal = orientation === 'portrait' ? 29 : 31;
  const time = (100 - fixedTotal - peopleTotal) / safeRuns;
  return {
    rank: `${fixed.rank}%`,
    number: `${fixed.number}%`,
    entrant: `${peopleTotal * 0.4}%`,
    driver: `${peopleTotal * 0.3}%`,
    navigator: `${peopleTotal * 0.3}%`,
    className: `${fixed.className}%`,
    time: `${time}%`,
    best: `${fixed.best}%`,
  };
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
