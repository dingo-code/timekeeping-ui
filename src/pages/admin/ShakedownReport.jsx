import { useEffect, useMemo, useRef, useState } from 'react';
import api, { assetUrl } from '../../services/api';
import { formatMs } from '../../utils/timeFormat';
import { UnofficialResultMark } from '../../components/UnofficialTimingNotice';
import { OrientationField, PaperSizeField, PrintLayoutStyle } from '../../components/PrintLayout';
import { normalizePaperSize } from '../../utils/printLayout';
import { generateReportPdfFromElement } from '../../utils/reportPdf';

const shakedownReportTypes = [
  { value: 'overall', label: 'Overall' },
  { value: 'group', label: 'Per Group' },
  { value: 'class', label: 'Per Class' },
  { value: 'category', label: 'Per Kategori' },
  { value: 'regional', label: 'Per Regional' },
  { value: 'gender', label: 'Berdasarkan Gender' },
  { value: 'age', label: 'Berdasarkan Usia' },
];

export default function ShakedownReport() {
  const [events, setEvents] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedStageId, setSelectedStageId] = useState('');
  const [reportType, setReportType] = useState('overall');
  const [selectedFilterKey, setSelectedFilterKey] = useState('all');
  const [paperOrientation, setPaperOrientation] = useState(localStorage.getItem('shakedown_result_orientation') || 'portrait');
  const [paperSize, setPaperSize] = useState(normalizePaperSize(localStorage.getItem('shakedown_result_paper_size')));
  const [report, setReport] = useState({ max_attempts: 0, entries: [] });
  const [isLoading, setIsLoading] = useState(false);
  const reportElementRef = useRef(null);

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

  useEffect(() => {
    setSelectedFilterKey('all');
  }, [reportType, selectedEventId, selectedStageId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );
  const timeDecimalPlaces = selectedEvent?.time_decimal_places ?? 2;

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.id === selectedStageId),
    [stages, selectedStageId]
  );

  const groupedEntries = useMemo(() => groupShakedownEntries(report.entries || [], reportType), [report.entries, reportType]);
  const filterOptions = groupedEntries.map((group) => ({ value: group.key, label: group.label }));
  const visibleGroups = selectedFilterKey === 'all'
    ? groupedEntries
    : groupedEntries.filter((group) => group.key === selectedFilterKey);

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
      alert('Gagal memuat result shakedown.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedEventDateText = formatEventDateRange(selectedEvent);
  const selectedEventLogo = assetUrl(selectedEvent?.logo_url);
  const selectedStageLabel = selectedStage?.ss_name || 'Semua Shakedown';
  const selectedFilterLabel = selectedFilterKey === 'all'
    ? ''
    : filterOptions.find((option) => option.value === selectedFilterKey)?.label || '';
  const printDateText = formatPrintDate(new Date());
  const tableColumnWidths = shakedownReferenceColumnWidths(paperOrientation);

  const handlePaperOrientationChange = (value) => {
    setPaperOrientation(value);
    localStorage.setItem('shakedown_result_orientation', value);
  };

  const handlePaperSizeChange = (value) => {
    const nextValue = normalizePaperSize(value);
    setPaperSize(nextValue);
    localStorage.setItem('shakedown_result_paper_size', nextValue);
  };

  const handlePrint = async () => {
    await generateReportPdfFromElement({
      element: reportElementRef.current,
      paperSize,
      orientation: paperOrientation,
      fileName: `${selectedEvent?.name || 'result'}-${selectedStageLabel}-shakedown`,
    });
  };

  return (
    <div className="min-h-full space-y-6">
      <PrintLayoutStyle paperSize={paperSize} orientation={paperOrientation} />

      <div className="no-print rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">Shakedown Result</h2>
            <p className="mt-1 text-sm text-gray-500">Rekap multi-run shakedown per peserta.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_150px_150px_140px_140px_auto] xl:w-auto">
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
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-500">Result Type</span>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {shakedownReportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-500">{shakedownFilterLabel(reportType)}</span>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50" value={selectedFilterKey} onChange={(e) => setSelectedFilterKey(e.target.value)} disabled={reportType === 'overall'}>
                <option value="all">{shakedownFilterAllLabel(reportType)}</option>
                {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <PaperSizeField value={paperSize} onChange={handlePaperSizeChange} />
            <OrientationField value={paperOrientation} onChange={handlePaperOrientationChange} />
            <button onClick={handlePrint} disabled={!selectedEventId || isLoading} className="admin-btn-primary self-end py-3">
              BUAT PDF
            </button>
          </div>
        </div>
      </div>

      <div ref={reportElementRef} className="print-panel rounded-xl border border-gray-200 bg-white p-6 shadow-sm" data-orientation={paperOrientation} data-paper-size={paperSize}>
        <PrintHeader
          eventName={selectedEvent?.name || 'Shakedown Result'}
          eventDateText={selectedEventDateText}
          eventLocation={selectedEvent?.location || '-'}
          logoUrl={selectedEventLogo}
          resultStatusLabel="SHAKEDOWN RESULT"
          printDateText={printDateText}
          lineFourLabel={selectedStageLabel}
          filterLabel={selectedFilterLabel}
        />

        {!selectedStageId ? (
          <div className="border border-gray-300 p-8 text-center text-gray-500">Pilih shakedown terlebih dahulu.</div>
        ) : isLoading ? (
          <div className="border border-gray-300 p-8 text-center text-gray-500">Memuat...</div>
        ) : visibleGroups.every((group) => group.entries.length === 0) ? (
          <div className="border border-gray-300 p-8 text-center text-gray-500">Belum ada data.</div>
        ) : visibleGroups.map((group) => (
          <section key={group.key} className="print-group mb-5">
            {(reportType !== 'overall' || selectedFilterKey !== 'all') && (
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase text-gray-800">{group.label}</h2>
                <span className="text-xs font-bold text-gray-500">{group.entries.length} peserta</span>
              </div>
            )}
            <div className="print-table-wrap overflow-x-auto">
              <table className="uniform-result-table w-full table-fixed border-collapse text-[11px] leading-tight">
                <colgroup>
                  <col style={{ width: tableColumnWidths.position }} />
                  <col style={{ width: tableColumnWidths.noStart }} />
                  <col style={{ width: tableColumnWidths.entrant }} />
                  <col style={{ width: tableColumnWidths.driver }} />
                  <col style={{ width: tableColumnWidths.navigator }} />
                  <col style={{ width: tableColumnWidths.className }} />
                  <col style={{ width: tableColumnWidths.category }} />
                  <col style={{ width: tableColumnWidths.car }} />
                  <col style={{ width: tableColumnWidths.type }} />
                  <col style={{ width: tableColumnWidths.time }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-300 text-center text-[10px] uppercase text-slate-900">
                    <th className="border border-gray-300 p-2 text-center">Pos</th>
                    <th className="border border-gray-300 p-2 text-center">Car No</th>
                    <th className="border border-gray-300 p-2 text-center">Entrant</th>
                    <th className="border border-gray-300 p-2 text-center">Driver</th>
                    <th className="border border-gray-300 p-2 text-center">Navigator</th>
                    <th className="border border-gray-300 p-2 text-center">Cls</th>
                    <th className="border border-gray-300 p-2 text-center">Cat</th>
                    <th className="border border-gray-300 p-2 text-center">Car</th>
                    <th className="border border-gray-300 p-2 text-center">Type</th>
                    <th className="border border-gray-300 p-2 text-center">Stage Time</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((entry) => (
                    <tr key={entry.participant_id}>
                      <td className="border border-gray-300 p-2 text-center">{entry.position || '-'}</td>
                      <td className="border border-gray-300 p-2 text-center">{entry.start_number}</td>
                      <td className="border border-gray-300 p-2">{entry.entrant_name || '-'}</td>
                      <td className="border border-gray-300 p-2">{entry.driver_name || '-'}</td>
                      <td className="border border-gray-300 p-2">{entry.codriver_name || '-'}</td>
                      <td className="border border-gray-300 p-2 text-center">{entry.class_name || '-'}</td>
                      <td className="border border-gray-300 p-2 text-center">{entry.category_name || '-'}</td>
                      <td className="border border-gray-300 p-2">{entry.car_brand || '-'}</td>
                      <td className="border border-gray-300 p-2">{entry.car_type || '-'}</td>
                      <td className="border border-gray-300 p-2 text-right font-mono">{entry.best_time_ms ? formatMs(entry.best_time_ms, timeDecimalPlaces) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PrintHeader({ eventName, eventDateText, eventLocation, logoUrl, resultStatusLabel, printDateText, lineFourLabel, filterLabel }) {
  return (
    <div className="print-header mb-5 border-b border-gray-300 pb-4">
      <div className="print-header-grid grid min-h-32 grid-cols-[150px_1fr_150px] items-center gap-3">
        <div className="print-logo-box flex h-28 items-center justify-center bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo event" className="print-logo-img max-h-28 w-auto max-w-full object-contain" />
          ) : (
            <span className="text-center text-[10px] font-black uppercase text-gray-400">Logo Event</span>
          )}
        </div>
        <div className="self-center text-center">
          <h1 className="print-title text-xl font-black uppercase tracking-wide text-gray-900">{eventName}</h1>
          <p className="print-subtitle text-sm font-bold capitalize text-gray-700">{eventDateText}</p>
          <p className="print-subtitle text-sm font-semibold text-gray-600">{eventLocation}</p>
          {filterLabel && <p className="print-subtitle mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{filterLabel}</p>}
          <p className="print-subtitle mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{lineFourLabel}</p>
        </div>
        <div className="print-meta-box flex h-28 flex-col items-center justify-center gap-2">
          <span className="print-status inline-block border-2 border-gray-900 px-3 py-2 text-center text-xs font-black uppercase leading-tight tracking-wide">
            {resultStatusLabel}
          </span>
          <UnofficialResultMark />
          <p className="print-date text-center text-[10px] font-bold text-gray-600">Tanggal Cetak: {printDateText}</p>
        </div>
      </div>
    </div>
  );
}

function groupShakedownEntries(entries, groupBy) {
  const map = new Map();
  for (const entry of entries) {
    const { key, label } = shakedownGroupKey(entry, groupBy);
    if (!map.has(key)) map.set(key, { key, label, entries: [] });
    map.get(key).entries.push(entry);
  }

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.entries.sort((a, b) => compareShakedownBestResult(a, b));
    let position = 0;
    group.entries = group.entries.map((entry) => {
      const result = shakedownBestResult(entry);
      if (result.time > 0) position += 1;
      return { ...entry, position: result.time > 0 ? position : 0, best_time_ms: result.time };
    });
  });
  groups.sort((a, b) => {
    if (a.key === 'overall') return -1;
    if (b.key === 'overall') return 1;
    return a.label.localeCompare(b.label, 'id-ID');
  });
  return groups;
}

function shakedownBestResult(entry) {
  return (entry.runs || []).reduce((best, run) => {
    const time = Number(run.total_time_ms || 0);
    if (run.status !== 'OK' || !run.finish_time || time <= 0) return best;
    const startTime = String(run.start_time || '');
    if (!best.time || time < best.time || (time === best.time && startTime < best.startTime)) return { time, startTime };
    return best;
  }, { time: 0, startTime: '' });
}

function compareShakedownBestResult(a, b) {
  const aBest = shakedownBestResult(a);
  const bBest = shakedownBestResult(b);
  if (!aBest.time && !bBest.time) return Number(a.start_number || 0) - Number(b.start_number || 0);
  if (!aBest.time) return 1;
  if (!bBest.time) return -1;
  if (aBest.time !== bBest.time) return aBest.time - bBest.time;
  if (aBest.startTime !== bBest.startTime) return aBest.startTime.localeCompare(bBest.startTime);
  return Number(a.start_number || 0) - Number(b.start_number || 0);
}

function shakedownGroupKey(entry, groupBy) {
  switch (groupBy) {
    case 'group':
      return keyedLabel(entry.group_name, 'group', 'Tanpa Group');
    case 'class':
      return keyedLabel(entry.class_name, 'class', 'Tanpa Class');
    case 'category':
      return keyedLabel(entry.category_name, 'category', 'Tanpa Kategori');
    case 'regional':
      return keyedLabel(entry.regional_name, 'regional', 'Tanpa Regional');
    case 'gender':
      return keyedLabel(genderLabel(entry.gender), 'gender', 'Gender Tidak Diketahui');
    case 'age':
      return keyedLabel(entry.age_group, 'age', 'Usia Tidak Diketahui');
    default:
      return { key: 'overall', label: 'Overall' };
  }
}

function keyedLabel(value, prefix, fallback) {
  const label = String(value || '').trim() || fallback;
  return { key: `${prefix}-${sanitizeKey(label)}`, label };
}

function sanitizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\\/.:<>]/g, '')
    .replace(/\s+/g, '-')
    || 'unknown';
}

function genderLabel(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'L' || normalized === 'LAKI-LAKI' || normalized === 'MALE') return 'Laki-laki';
  if (normalized === 'P' || normalized === 'PEREMPUAN' || normalized === 'FEMALE') return 'Perempuan';
  return 'Gender Tidak Diketahui';
}

function shakedownFilterLabel(type) {
  const labels = {
    group: 'Group',
    class: 'Class',
    category: 'Kategori',
    regional: 'Regional',
    gender: 'Gender',
    age: 'Usia',
  };
  return labels[type] || 'Filter';
}

function shakedownFilterAllLabel(type) {
  const labels = {
    group: 'Semua Group',
    class: 'Semua Class',
    category: 'Semua Kategori',
    regional: 'Semua Regional',
    gender: 'Semua Gender',
    age: 'Semua Usia',
  };
  return labels[type] || 'Semua';
}

function shakedownReferenceColumnWidths(orientation = 'landscape') {
  if (orientation === 'portrait') {
    return {
      position: '4%', noStart: '5%', entrant: '18%', driver: '15%', navigator: '15%',
      className: '6%', category: '5%', car: '8%', type: '14%', time: '10%',
    };
  }
  return {
    position: '4%',
    noStart: '5%',
    entrant: '20%',
    driver: '14%',
    navigator: '14%',
    className: '6%',
    category: '5%',
    car: '8%',
    type: '14%',
    time: '10%',
  };
}

function formatPrintDate(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatEventDateRange(event) {
  if (!event?.start_date) return '-';

  const formatDate = (value) => new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));

  if (!event.end_date || event.end_date === event.start_date) {
    return formatDate(event.start_date);
  }

  return `${formatDate(event.start_date)} - ${formatDate(event.end_date)}`;
}
