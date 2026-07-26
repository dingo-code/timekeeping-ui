import { useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../services/api';
import { formatClockCentiseconds } from '../../utils/timeFormat';

const reportTypes = [
  { value: 'overall', label: 'Overall' },
  { value: 'group', label: 'Per Group' },
  { value: 'class', label: 'Per Class' },
  { value: 'category', label: 'Per Kategori' },
  { value: 'gender', label: 'Berdasarkan Gender' },
  { value: 'age', label: 'Berdasarkan Usia' },
];

export default function PrintResults() {
  const [events, setEvents] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [reportScope, setReportScope] = useState('final');
  const [reportType, setReportType] = useState('overall');
  const [resultFilters, setResultFilters] = useState({
    group: 'all',
    class: 'all',
    category: 'all',
    gender: 'all',
    age: 'all',
  });
  const [selectedRegionalId, setSelectedRegionalId] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [resultStatus, setResultStatus] = useState(localStorage.getItem('print_result_status') || 'unofficial');
  const [paperOrientation, setPaperOrientation] = useState(localStorage.getItem('print_result_orientation') || 'landscape');
  const [report, setReport] = useState({ stages: [], groups: [] });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchResults();
  }, [selectedEventId, reportScope, reportType, selectedRegionalId]);

  useEffect(() => {
    setResultFilters({ group: 'all', class: 'all', category: 'all', gender: 'all', age: 'all' });
  }, [selectedEventId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );

  const printableStages = useMemo(() => {
    if (selectedStageId === 'all') return report.stages;
    return report.stages.filter((stage) => stage.id === selectedStageId);
  }, [report.stages, selectedStageId]);

  const allEntries = useMemo(() => report.groups.flatMap((group) => group.entries || []), [report.groups]);

  const filterOptions = useMemo(() => ({
    group: uniqueEntryOptions(allEntries, 'group_name'),
    class: uniqueEntryOptions(allEntries, 'class_name'),
    category: uniqueEntryOptions(allEntries, 'category_name'),
    gender: uniqueGenderOptions(allEntries),
    age: uniqueAgeOptions(allEntries),
  }), [allEntries]);

  const printableGroups = useMemo(() => report.groups
    .map((group) => ({
      ...group,
      entries: (group.entries || []).filter((entry) => matchesResultFilters(entry, resultFilters)),
    }))
    .filter((group) => group.entries.length > 0), [report.groups, resultFilters]);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      const nextEvents = res.data.data || [];
      setEvents(nextEvents);
      if (nextEvents.length > 0) setSelectedEventId(nextEvents[0].id);
    } catch (err) {
      alert('Gagal memuat daftar event.');
    }
  };

  const fetchRegions = async () => {
    try {
      const res = await api.get('/admin/regions');
      setRegions(res.data.data || []);
    } catch (err) {
      console.error('Gagal memuat regional');
    }
  };

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const regionalParam = selectedRegionalId === 'all' ? '' : `&regional_id=${selectedRegionalId}`;
      const res = await api.get(`/public/race-results/${selectedEventId}?group_by=${reportType}${regionalParam}`);
      setReport(res.data.data || { stages: [], groups: [] });
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memuat hasil balapan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultStatusChange = (value) => {
    setResultStatus(value);
    localStorage.setItem('print_result_status', value);
  };

  const handlePaperOrientationChange = (value) => {
    setPaperOrientation(value);
    localStorage.setItem('print_result_orientation', value);
  };

  const handleResultFilterChange = (key, value) => {
    setResultFilters((current) => ({ ...current, [key]: value }));
  };

  const formatMs = (ms) => {
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
  };

  const stageTimeFor = (entry, stageId) => entry.stage_times?.find((stageTime) => stageTime.ss_id === stageId);

  const finalRemark = (entry) => {
    if (!entry.status || entry.status === 'OK') return '';
    return printableStatusLabel(entry.status);
  };

  const stageRemark = (stageTime) => {
    if (!stageTime) return '';
    const status = stageTime.status && stageTime.status !== 'OK' ? printableStatusLabel(stageTime.status) : '';
    const remark = stageTime.status === 'BWTM' && stageTime.remark_penalty === 'BWTM' ? '' : stageTime.remark_penalty;
    return [status, remark].filter(Boolean).join(' / ');
  };

  const stageResultTime = (stageTime) => {
    if (!stageTime) return '-';
    if (
      (stageTime.status === 'OK' && stageTime.finish_time) ||
      stageTime.status === 'BWTM' ||
      (stageTime.status === 'DNF' && Number(stageTime.total_time_ms) > 0)
    ) {
      return formatMs(stageTime.total_time_ms);
    }
    return '-';
  };

  const resultRowClass = (status) => {
    if (status && status !== 'OK') return 'text-gray-900';
    return '';
  };

  const excludedFinalStatuses = new Set();
  const stageStatusWeight = (status) => {
    if (status === 'OK') return 0;
    if (status === 'BWTM') return 0;
    if (status === 'INCOMPLETE' || !status) return 1;
    if (status === 'DSQ') return 2;
    if (status === 'DNF') return 3;
    if (status === 'DNS') return 4;
    if (status === 'NOT_FINISHER') return 5;
    return 2;
  };

  const entriesForStage = (stage, sourceEntries) => {
    const numericMs = (value) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    };
    const hasStageResult = (stageTime) => (
      (
        (stageTime?.status === 'OK' && Boolean(stageTime.finish_time)) ||
        stageTime?.status === 'BWTM' ||
        (stageTime?.status === 'DNF' && numericMs(stageTime.total_time_ms) > 0)
      ) &&
      numericMs(stageTime.total_time_ms) > 0
    );

    const rows = sourceEntries
      .map((entry) => ({ entry, stageTime: stageTimeFor(entry, stage.id) }))
      .filter((row) => row.stageTime);

    rows.sort((a, b) => {
      const aOk = hasStageResult(a.stageTime);
      const bOk = hasStageResult(b.stageTime);
      if (aOk !== bOk) return aOk ? -1 : 1;
      const aStatusWeight = stageStatusWeight(a.stageTime.status);
      const bStatusWeight = stageStatusWeight(b.stageTime.status);
      if (aStatusWeight !== bStatusWeight) return aStatusWeight - bStatusWeight;
      const aTotal = numericMs(a.stageTime.total_time_ms);
      const bTotal = numericMs(b.stageTime.total_time_ms);
      if (aOk && aTotal !== bTotal) {
        return aTotal - bTotal;
      }
      return numericMs(a.entry.start_number) - numericMs(b.entry.start_number);
    });

    const best = numericMs(rows.find((row) => hasStageResult(row.stageTime))?.stageTime.total_time_ms);
    let rank = 1;
    return rows.map((row) => {
      const isOk = hasStageResult(row.stageTime);
      const total = numericMs(row.stageTime.total_time_ms);
      const result = {
        ...row,
        rank: isOk ? rank : 0,
        diffMs: isOk && best ? total - best : 0,
      };
      if (isOk) rank += 1;
      return result;
    });
  };

  const selectedRegionalLabel = selectedRegionalId === 'all'
    ? 'Semua Regional'
    : regions.find((region) => region.id === selectedRegionalId)?.name || 'Regional';
  const activeFilterLabels = resultActiveFilterLabels(resultFilters, filterOptions);
  const resultStatusLabel = resultStatus === 'official' ? 'OFFICIAL RESULT' : 'UNOFFICIAL RESULT';
  const selectedEventDateText = formatEventDateRange(selectedEvent);
  const selectedEventLogo = assetUrl(selectedEvent?.logo_url);
  const printDateText = formatPrintDate(new Date());
  const selectedStageLabel = reportScope === 'final'
    ? 'Final Result'
    : selectedStageId === 'all'
      ? 'Semua SS'
      : (() => {
          const stage = report.stages.find((item) => item.id === selectedStageId);
          return stage ? `SS ${stage.ss_order} - ${stage.ss_name}` : 'Semua SS';
        })();

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
          @page { size: ${paperOrientation}; margin: 5mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff !important; margin: 0 !important; }
          aside, header, .no-print { display: none !important; }
          main, main > div { display: block !important; padding: 0 !important; background: #fff !important; }
          .print-page { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
          .print-header { break-after: avoid; page-break-after: avoid; margin-bottom: 4px !important; padding-bottom: 4px !important; }
          .print-header-grid { grid-template-columns: 120px 1fr 132px !important; min-height: 72px !important; gap: 6px !important; }
          .print-logo-box, .print-meta-box { height: 72px !important; }
          .print-logo-img { max-height: 72px !important; }
          .print-title { font-size: 16px !important; line-height: 1.05 !important; }
          .print-subtitle { font-size: 9px !important; line-height: 1.12 !important; }
          .print-status { border-width: 1px !important; padding: 3px 8px !important; font-size: 9px !important; line-height: 1.1 !important; }
          .print-date { font-size: 8px !important; line-height: 1.1 !important; }
          .print-group { page-break-inside: auto; break-inside: auto; margin-bottom: 7px !important; }
          .print-group-title { break-after: avoid; page-break-after: avoid; margin-bottom: 2px !important; }
          .print-group-title h2 { font-size: 12px !important; line-height: 1.1 !important; }
          .print-group-title span { font-size: 8px !important; }
          table { page-break-inside: auto; font-size: 8.5px !important; line-height: 1.12 !important; table-layout: fixed; width: 100%; }
          th, td { padding: 2px 3px !important; vertical-align: top !important; }
          tbody td { background: #fff !important; }
          thead th { background: #f3f4f6 !important; }
          th { font-weight: 900 !important; }
          th:nth-child(1), th:nth-child(2), th:nth-child(6), th:nth-child(7),
          td:nth-child(1), td:nth-child(2), td:nth-child(6), td:nth-child(7) {
            text-align: center !important;
            white-space: nowrap !important;
          }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          .print-driver-name { font-size: 8.5px !important; line-height: 1.1 !important; }
          .print-codriver-name { font-size: 7.5px !important; line-height: 1.1 !important; }
        }
      `}</style>

      <div className="no-print bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Result</h2>
            <p className="text-sm text-gray-500 mt-1">Final result and stage result print format.</p>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Event</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">-- Pilih Event --</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Bentuk</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={reportScope} onChange={(e) => setReportScope(e.target.value)}>
                <option value="final">Final Result</option>
                <option value="stage">Setiap SS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Result Type</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Group</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={resultFilters.group} onChange={(e) => handleResultFilterChange('group', e.target.value)}>
                <option value="all">Semua Group</option>
                {filterOptions.group.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Class</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={resultFilters.class} onChange={(e) => handleResultFilterChange('class', e.target.value)}>
                <option value="all">Semua Class</option>
                {filterOptions.class.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Kategori</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={resultFilters.category} onChange={(e) => handleResultFilterChange('category', e.target.value)}>
                <option value="all">Semua Kategori</option>
                {filterOptions.category.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Gender</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={resultFilters.gender} onChange={(e) => handleResultFilterChange('gender', e.target.value)}>
                <option value="all">Semua Gender</option>
                {filterOptions.gender.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Usia</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={resultFilters.age} onChange={(e) => handleResultFilterChange('age', e.target.value)}>
                <option value="all">Semua Usia</option>
                {filterOptions.age.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Regional</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={selectedRegionalId} onChange={(e) => setSelectedRegionalId(e.target.value)}>
                <option value="all">Semua Regional</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">SS</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50" value={selectedStageId} onChange={(e) => setSelectedStageId(e.target.value)} disabled={reportScope === 'final'}>
                <option value="all">Semua SS</option>
                {report.stages.map((stage) => <option key={stage.id} value={stage.id}>SS {stage.ss_order}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Result Status</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={resultStatus} onChange={(e) => handleResultStatusChange(e.target.value)}>
                <option value="unofficial">Unofficial Result</option>
                <option value="official">Official Result</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Orientasi Kertas</label>
              <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold outline-none focus:ring-1 focus:ring-red-500" value={paperOrientation} onChange={(e) => handlePaperOrientationChange(e.target.value)}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <button onClick={handlePrint} disabled={!selectedEventId || isLoading} className="h-[42px] w-full self-end rounded-lg bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50">
              CETAK
            </button>
          </div>
        </div>
      </div>

      <div className="print-page bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <PrintHeader
          eventName={selectedEvent?.name || '-'}
          eventDateText={selectedEventDateText}
          eventLocation={selectedEvent?.location || '-'}
          logoUrl={selectedEventLogo}
          resultStatusLabel={resultStatusLabel}
          printDateText={printDateText}
          lineFourLabel={selectedStageLabel}
          regionalLabel={selectedRegionalId === 'all' ? '' : selectedRegionalLabel}
          filterLabel={activeFilterLabels.join(' | ')}
        />

        {isLoading ? (
          <div className="p-10 text-center text-gray-500 font-bold">Memuat hasil...</div>
        ) : reportScope === 'final' ? (
          <FinalResultReport
            groups={printableGroups}
            stages={report.stages}
            formatMs={formatMs}
            stageTimeFor={stageTimeFor}
            finalRemark={finalRemark}
            stageResultTime={stageResultTime}
            resultRowClass={resultRowClass}
            excludedStatuses={excludedFinalStatuses}
          />
        ) : (
          <StageResultReport
            stages={printableStages}
            groups={printableGroups}
            entriesForStage={entriesForStage}
            formatMs={formatMs}
            stageRemark={stageRemark}
            resultRowClass={resultRowClass}
          />
        )}
      </div>
    </div>
  );
}

function PrintHeader({ eventName, eventDateText, eventLocation, logoUrl, resultStatusLabel, printDateText, lineFourLabel, regionalLabel, filterLabel }) {
  return (
    <div className="print-header border-b border-gray-300 pb-4 mb-5">
      <div className="print-header-grid grid grid-cols-[230px_1fr_230px] items-center gap-4 min-h-32">
        <div className="print-logo-box h-32 flex items-center justify-center bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo event" className="print-logo-img max-h-32 w-auto max-w-full object-contain" />
          ) : (
            <span className="text-[10px] font-black text-gray-400 text-center uppercase">Logo Event</span>
          )}
        </div>
        <div className="text-center self-center">
          <h1 className="print-title text-2xl font-black uppercase tracking-wide text-gray-900">{eventName}</h1>
          <p className="print-subtitle text-sm font-bold text-gray-700 capitalize">{eventDateText}</p>
          <p className="print-subtitle text-sm font-semibold text-gray-600">{eventLocation}</p>
          {regionalLabel && <p className="print-subtitle mt-2 text-xs font-bold text-gray-500 uppercase tracking-wide">{regionalLabel}</p>}
          {filterLabel && <p className="print-subtitle mt-1 text-xs font-bold text-gray-500 uppercase tracking-wide">{filterLabel}</p>}
          <p className={`print-subtitle ${regionalLabel ? '' : 'mt-2'} text-xs font-bold text-gray-500 uppercase tracking-wide`}>{lineFourLabel}</p>
        </div>
        <div className="print-meta-box h-32 flex flex-col items-center justify-center gap-2">
          <span className="print-status inline-block border-2 border-gray-900 px-4 py-2 text-sm font-black uppercase tracking-wide text-center leading-tight">
            {resultStatusLabel}
          </span>
          <p className="print-date text-[10px] font-bold uppercase tracking-wide text-gray-600">Tanggal Cetak: {printDateText}</p>
        </div>
      </div>
    </div>
  );
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

function classCode(value) {
  if (!value) return '-';
  return String(value).split(' - ')[0] || '-';
}

function categoryCode(value) {
  if (!value) return '-';
  return String(value).split(' - ')[0] || '-';
}

function printableStatusLabel(status) {
  if (status === 'NOT_FINISHER') return 'Not Finisher';
  return status;
}

function uniqueEntryOptions(entries, field) {
  const seen = new Set();
  return entries
    .map((entry) => String(entry[field] || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'id-ID', { numeric: true }))
    .map((value) => ({ value, label: value }));
}

function uniqueGenderOptions(entries) {
  const options = new Map();
  for (const entry of entries) {
    const label = genderLabel(entry.gender);
    const key = label.toLowerCase();
    if (!options.has(key)) options.set(key, { value: label, label });
  }
  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, 'id-ID'));
}

function uniqueAgeOptions(entries) {
  const groupMap = new Map();
  const exactMap = new Map();
  for (const entry of entries) {
    const ageGroup = String(entry.age_group || '').trim();
    const age = Number(entry.age);
    if (ageGroup) groupMap.set(ageGroup.toLowerCase(), ageGroup);
    if (Number.isFinite(age) && age > 0) exactMap.set(age, age);
  }

  const groupOptions = Array.from(groupMap.values())
    .sort((a, b) => a.localeCompare(b, 'id-ID', { numeric: true }))
    .map((value) => ({ value: `group:${value}`, label: value }));
  const exactOptions = Array.from(exactMap.values())
    .sort((a, b) => a - b)
    .map((value) => ({ value: `age:${value}`, label: `${value} tahun` }));
  return [...groupOptions, ...exactOptions];
}

function matchesResultFilters(entry, filters) {
  if (filters.group !== 'all' && String(entry.group_name || '').trim() !== filters.group) return false;
  if (filters.class !== 'all' && String(entry.class_name || '').trim() !== filters.class) return false;
  if (filters.category !== 'all' && String(entry.category_name || '').trim() !== filters.category) return false;
  if (filters.gender !== 'all' && genderLabel(entry.gender) !== filters.gender) return false;
  if (filters.age !== 'all') {
    if (filters.age.startsWith('group:')) {
      const ageGroup = filters.age.slice('group:'.length);
      if (String(entry.age_group || '').trim() !== ageGroup) return false;
    } else if (filters.age.startsWith('age:')) {
      const age = Number(filters.age.slice('age:'.length));
      if (Number(entry.age) !== age) return false;
    }
  }
  return true;
}

function resultActiveFilterLabels(filters, options) {
  return [
    activeFilterLabel('Group', filters.group, options.group),
    activeFilterLabel('Class', filters.class, options.class),
    activeFilterLabel('Kategori', filters.category, options.category),
    activeFilterLabel('Gender', filters.gender, options.gender),
    activeFilterLabel('Usia', filters.age, options.age),
  ].filter(Boolean);
}

function activeFilterLabel(label, value, options) {
  if (!value || value === 'all') return '';
  const optionLabel = options.find((option) => option.value === value)?.label || value;
  return `${label}: ${optionLabel}`;
}

function genderLabel(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'L' || normalized === 'LAKI-LAKI' || normalized === 'MALE') return 'Laki-laki';
  if (normalized === 'P' || normalized === 'PEREMPUAN' || normalized === 'FEMALE') return 'Perempuan';
  return 'Gender Tidak Diketahui';
}

function finalResultColumnWidths(stageCount) {
  const safeStageCount = Math.max(stageCount, 1);
  const fixed = {
    rank: 4,
    noStart: 5,
    regional: 7,
    className: 4,
    category: 4,
    total: 7,
    remark: 8,
  };
  const fixedTotal = Object.values(fixed).reduce((sum, value) => sum + value, 0);
  const availableForStageTimes = 100 - fixedTotal - 27;
  const stageTime = Math.max(3.4, Math.min(6, availableForStageTimes / safeStageCount));
  const remaining = Math.max(22, 100 - fixedTotal - (stageTime * safeStageCount));
  const driver = remaining * 0.58;
  const entrant = remaining - driver;

  return {
    rank: `${fixed.rank}%`,
    noStart: `${fixed.noStart}%`,
    driver: `${driver.toFixed(1)}%`,
    entrant: `${entrant.toFixed(1)}%`,
    regional: `${fixed.regional}%`,
    className: `${fixed.className}%`,
    category: `${fixed.category}%`,
    stageTime: `${stageTime.toFixed(1)}%`,
    total: `${fixed.total}%`,
    remark: `${fixed.remark}%`,
  };
}

function stageResultColumnWidths() {
  return {
    rank: '4%',
    noStart: '5%',
    driver: '20%',
    entrant: '14%',
    regional: '7%',
    className: '4%',
    category: '4%',
    start: '6%',
    finish: '6%',
    time: '6%',
    penalty: '6%',
    total: '6%',
    diff: '5%',
    remark: '7%',
  };
}

function FinalResultReport({ groups, stages, formatMs, stageTimeFor, finalRemark, stageResultTime, resultRowClass, excludedStatuses }) {
  const columnWidths = finalResultColumnWidths(stages.length);
  const printableGroups = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => !excludedStatuses.has(entry.status)),
    }))
    .filter((group) => group.entries.length > 0);

  if (printableGroups.length === 0) {
    return <div className="p-10 text-center text-gray-500">Belum ada data hasil untuk dicetak.</div>;
  }

  return printableGroups.map((group) => (
    <section key={group.key} className="print-group mb-8">
      <div className="print-group-title flex items-center justify-between mb-2">
        <h2 className="text-lg font-black uppercase text-gray-800">{group.label}</h2>
        <span className="text-xs font-bold text-gray-500">{group.entries.length} peserta</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <colgroup>
            <col style={{ width: columnWidths.rank }} />
            <col style={{ width: columnWidths.noStart }} />
            <col style={{ width: columnWidths.driver }} />
            <col style={{ width: columnWidths.entrant }} />
            <col style={{ width: columnWidths.regional }} />
            <col style={{ width: columnWidths.className }} />
            <col style={{ width: columnWidths.category }} />
            {stages.map((stage) => (
              <col key={stage.id} style={{ width: columnWidths.stageTime }} />
            ))}
            <col style={{ width: columnWidths.total }} />
            <col style={{ width: columnWidths.remark }} />
          </colgroup>
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="border border-gray-300 p-2 text-center">Rank</th>
              <th className="border border-gray-300 p-2 text-center">No Start</th>
              <th className="border border-gray-300 p-2 text-left">Driver/Co driver</th>
              <th className="border border-gray-300 p-2 text-left">Entrant</th>
              <th className="border border-gray-300 p-2 text-left">Regional</th>
              <th className="border border-gray-300 p-2 text-left">Class</th>
              <th className="border border-gray-300 p-2 text-left">Cat</th>
              {stages.map((stage) => (
                <th key={stage.id} className="border border-gray-300 p-2 text-right">Time SS{stage.ss_order}</th>
              ))}
              <th className="border border-gray-300 p-2 text-right">Total</th>
              <th className="border border-gray-300 p-2 text-left">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {group.entries.map((entry) => (
              <tr key={entry.participant_id} className={resultRowClass(entry.status)}>
                <td className="border border-gray-300 p-2 text-center font-black">{entry.rank || '-'}</td>
                <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                <td className="border border-gray-300 p-2">
                  <div className="print-driver-name font-bold text-gray-800">{entry.driver_name}</div>
                  <div className="print-codriver-name text-[10px] text-gray-500">{entry.codriver_name || '-'}</div>
                </td>
                <td className="border border-gray-300 p-2">{entry.entrant_name || entry.team_name || '-'}</td>
                <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                <td className="border border-gray-300 p-2">{classCode(entry.class_name)}</td>
                <td className="border border-gray-300 p-2">{categoryCode(entry.category_name)}</td>
                  {stages.map((stage) => {
                    const stageTime = stageTimeFor(entry, stage.id);
                    return (
                      <td key={stage.id} className="border border-gray-300 p-2 text-right font-mono">
                        {stageResultTime(stageTime)}
                      </td>
                    );
                  })}
                <td className="border border-gray-300 p-2 text-right font-mono font-black">{formatMs(entry.total_time_ms)}</td>
                <td className="border border-gray-300 p-2">{finalRemark(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  ));
}

function StageResultReport({ stages, groups, entriesForStage, formatMs, stageRemark, resultRowClass }) {
  const columnWidths = stageResultColumnWidths();
  if (stages.length === 0) {
    return <div className="p-10 text-center text-gray-500">Belum ada SS untuk dicetak.</div>;
  }

  return stages.map((stage) => {
    return (
      <section key={stage.id} className="print-group mb-8">
        <div className="print-group-title flex items-center justify-between mb-2">
          <h2 className="text-lg font-black uppercase text-gray-800">SS {stage.ss_order} - {stage.ss_name}</h2>
          <span className="text-xs font-bold text-gray-500">{groups.reduce((total, group) => total + entriesForStage(stage, group.entries).length, 0)} peserta</span>
        </div>
        {groups.map((group) => {
          const rows = entriesForStage(stage, group.entries);
          if (rows.length === 0) return null;

          return (
            <div key={`${stage.id}-${group.key}`} className="mb-5">
              <div className="mb-1 text-sm font-black uppercase text-gray-700">{group.label}</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <colgroup>
                    <col style={{ width: columnWidths.rank }} />
                    <col style={{ width: columnWidths.noStart }} />
                    <col style={{ width: columnWidths.driver }} />
                    <col style={{ width: columnWidths.entrant }} />
                    <col style={{ width: columnWidths.regional }} />
                    <col style={{ width: columnWidths.className }} />
                    <col style={{ width: columnWidths.category }} />
                    <col style={{ width: columnWidths.start }} />
                    <col style={{ width: columnWidths.finish }} />
                    <col style={{ width: columnWidths.time }} />
                    <col style={{ width: columnWidths.penalty }} />
                    <col style={{ width: columnWidths.total }} />
                    <col style={{ width: columnWidths.diff }} />
                    <col style={{ width: columnWidths.remark }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border border-gray-300 p-2 text-center">Rank</th>
                      <th className="border border-gray-300 p-2 text-center">No Start</th>
                      <th className="border border-gray-300 p-2 text-left">Driver/Co driver</th>
                      <th className="border border-gray-300 p-2 text-left">Entrant</th>
                      <th className="border border-gray-300 p-2 text-left">Regional</th>
                      <th className="border border-gray-300 p-2 text-left">Class</th>
                      <th className="border border-gray-300 p-2 text-left">Cat</th>
                      <th className="border border-gray-300 p-2 text-center">Start</th>
                      <th className="border border-gray-300 p-2 text-center">Finish</th>
                      <th className="border border-gray-300 p-2 text-right">Time</th>
                      <th className="border border-gray-300 p-2 text-right">time Penalty</th>
                      <th className="border border-gray-300 p-2 text-right">Total</th>
                      <th className="border border-gray-300 p-2 text-right">Dif</th>
                      <th className="border border-gray-300 p-2 text-left">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, stageTime, rank, diffMs }) => (
                      <tr key={entry.participant_id} className={resultRowClass(stageTime.status)}>
                        <td className="border border-gray-300 p-2 text-center font-black">{rank || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                        <td className="border border-gray-300 p-2">
                          <div className="print-driver-name font-bold text-gray-800">{entry.driver_name}</div>
                          <div className="print-codriver-name text-[10px] text-gray-500">{entry.codriver_name || '-'}</div>
                        </td>
                        <td className="border border-gray-300 p-2">{entry.entrant_name || entry.team_name || '-'}</td>
                        <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                        <td className="border border-gray-300 p-2">{classCode(entry.class_name)}</td>
                        <td className="border border-gray-300 p-2">{categoryCode(entry.category_name)}</td>
                        <td className="border border-gray-300 p-2 text-center font-mono">{stageTime.start_time || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-mono">{formatClockCentiseconds(stageTime.finish_time)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatMs(stageTime.elapsed_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatMs(stageTime.penalty_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono font-black">{formatMs(stageTime.total_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{diffMs ? `+${formatMs(diffMs)}` : '-'}</td>
                        <td className="border border-gray-300 p-2">{stageRemark(stageTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </section>
    );
  });
}
