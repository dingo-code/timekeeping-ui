import { useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../services/api';
import { formatMs } from '../../utils/timeFormat';
import UnofficialTimingNotice from '../../components/UnofficialTimingNotice';

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
  const visibleMaxAttempts = Math.max(
    0,
    ...visibleGroups.flatMap((group) => group.entries.flatMap((entry) => entry.runs.map((run) => run.attempt_no || 0)))
  );
  const attemptColumns = Array.from({ length: visibleMaxAttempts || report.max_attempts || 0 }, (_, index) => index + 1);

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
  const tableColumnWidths = shakedownColumnWidths(attemptColumns.length);

  const handlePaperOrientationChange = (value) => {
    setPaperOrientation(value);
    localStorage.setItem('shakedown_result_orientation', value);
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
            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-800">Shakedown Result</h2>
            <p className="mt-1 text-sm text-gray-500">Rekap multi-run shakedown per peserta.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_150px_150px_150px_auto] xl:w-auto">
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
            <label>
              <span className="mb-1 block text-xs font-bold text-gray-500">Orientasi Kertas</span>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={paperOrientation} onChange={(e) => handlePaperOrientationChange(e.target.value)}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            <button onClick={handlePrint} disabled={!selectedEventId || isLoading} className="admin-btn-primary self-end py-3">
              CETAK
            </button>
          </div>
        </div>
      </div>

      <UnofficialTimingNotice />

      <div className="print-panel rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col style={{ width: tableColumnWidths.noStart }} />
                  <col style={{ width: tableColumnWidths.entrant }} />
                  <col style={{ width: tableColumnWidths.driver }} />
                  <col style={{ width: tableColumnWidths.className }} />
                  <col style={{ width: tableColumnWidths.regional }} />
                  {attemptColumns.map((attemptNo) => (
                    <col key={attemptNo} style={{ width: tableColumnWidths.time }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 text-left text-xs uppercase tracking-wide text-gray-600">
                    <th className="border border-gray-300 p-2 text-center">No</th>
                    <th className="border border-gray-300 p-2">Entrant</th>
                    <th className="border border-gray-300 p-2">Driver / Navigator</th>
                    <th className="border border-gray-300 p-2">Class</th>
                    <th className="border border-gray-300 p-2">Regional</th>
                    {attemptColumns.map((attemptNo) => (
                      <th key={attemptNo} className="print-time border border-gray-300 p-2 text-right">Time {attemptNo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((entry) => (
                    <tr key={entry.participant_id}>
                      <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                      <td className="border border-gray-300 p-2">{entry.entrant_name || '-'}</td>
                      <td className="border border-gray-300 p-2">
                        <div className="font-bold text-gray-900">{entry.driver_name}</div>
                        <div className="text-xs text-gray-500">{entry.codriver_name || '-'}</div>
                      </td>
                      <td className="border border-gray-300 p-2">{entry.class_name || '-'}</td>
                      <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                      {attemptColumns.map((attemptNo) => {
                        const run = entry.runs.find((item) => item.attempt_no === attemptNo);
                        return (
                          <td key={attemptNo} className="border border-gray-300 p-2 text-right font-mono font-bold">
                            {run ? formatMs(run.total_time_ms, timeDecimalPlaces) : '-'}
                          </td>
                        );
                      })}
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
      <div className="grid min-h-32 grid-cols-[150px_1fr_150px] items-center gap-3">
        <div className="flex h-28 items-center justify-center bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo event" className="max-h-28 w-auto max-w-full object-contain" />
          ) : (
            <span className="text-center text-[10px] font-black uppercase text-gray-400">Logo Event</span>
          )}
        </div>
        <div className="self-center text-center">
          <h1 className="text-xl font-black uppercase tracking-wide text-gray-900">{eventName}</h1>
          <p className="text-sm font-bold capitalize text-gray-700">{eventDateText}</p>
          <p className="text-sm font-semibold text-gray-600">{eventLocation}</p>
          {filterLabel && <p className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{filterLabel}</p>}
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-500">{lineFourLabel}</p>
        </div>
        <div className="flex h-28 flex-col items-center justify-center gap-2">
          <span className="inline-block border-2 border-gray-900 px-3 py-2 text-center text-xs font-black uppercase leading-tight tracking-wide">
            {resultStatusLabel}
          </span>
          <p className="text-center text-[10px] font-bold text-gray-600">Tanggal Cetak: {printDateText}</p>
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
  groups.sort((a, b) => {
    if (a.key === 'overall') return -1;
    if (b.key === 'overall') return 1;
    return a.label.localeCompare(b.label, 'id-ID');
  });
  return groups;
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

function shakedownColumnWidths(attemptCount) {
  const safeAttempts = Math.max(attemptCount, 1);
  const noStart = 6;
  const className = safeAttempts <= 2 ? 9 : 8;
  const regional = safeAttempts <= 2 ? 10 : 9;
  const time = safeAttempts <= 2 ? 9 : Math.max(6, Math.min(8, Math.floor(40 / safeAttempts)));
  const timeTotal = time * safeAttempts;
  const remaining = Math.max(30, 100 - noStart - className - regional - timeTotal);
  const driver = Math.round(remaining * (safeAttempts <= 2 ? 0.58 : 0.55));
  const entrant = remaining - driver;

  return {
    noStart: `${noStart}%`,
    driver: `${driver}%`,
    entrant: `${entrant}%`,
    className: `${className}%`,
    regional: `${regional}%`,
    time: `${time}%`,
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
