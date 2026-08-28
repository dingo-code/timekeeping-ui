import { useEffect, useMemo, useRef, useState } from 'react';
import api, { assetUrl } from '../../services/api';
import { formatClockCentiseconds, formatMs as formatDurationMs } from '../../utils/timeFormat';
import { compactTCPenaltyRemark } from '../../utils/tcDisplay';
import { UnofficialResultMark } from '../../components/UnofficialTimingNotice';
import { OrientationField, PaperSizeField, PrintLayoutStyle } from '../../components/PrintLayout';
import { normalizePaperSize } from '../../utils/printLayout';
import { generateReportPdfFromElement } from '../../utils/reportPdf';

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
  const [paperSize, setPaperSize] = useState(normalizePaperSize(localStorage.getItem('print_result_paper_size')));
  const [report, setReport] = useState(emptyReport());
  const [isLoading, setIsLoading] = useState(false);
  const reportElementRef = useRef(null);

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
  const timeDecimalPlaces = selectedEvent?.time_decimal_places ?? 2;

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
      setReport(normalizeRaceReport(res.data.data));
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memuat hasil balapan.');
      setReport(emptyReport());
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

  const handlePaperSizeChange = (value) => {
    const nextValue = normalizePaperSize(value);
    setPaperSize(nextValue);
    localStorage.setItem('print_result_paper_size', nextValue);
  };

  const handleResultFilterChange = (key, value) => {
    setResultFilters((current) => ({ ...current, [key]: value }));
  };

  const formatMs = (ms) => {
    return formatDurationMs(ms, timeDecimalPlaces);
  };

  const stageTimeFor = (entry, stageId) => entry.stage_times?.find((stageTime) => stageTime.ss_id === stageId);

  const finalRemark = (entry) => {
    const statusRemarks = (entry.stage_times || [])
      .filter((stageTime) => stageTime?.status && stageTime.status !== 'OK')
      .map((stageTime) => `${printableStatusLabel(stageTime.status).toUpperCase()}${stageTime.ss_order || ''}`);
    const penaltyRemarks = (entry.stage_times || [])
      .map((stageTime) => {
        if (!stageTime?.remark_penalty) return '';
        if (stageTime.status === 'BWTM' && stageTime.remark_penalty === 'BWTM') return '';
        return compactTCPenaltyRemark(stageTime.remark_penalty, stageTime.ss_order);
      })
      .filter(Boolean);
    const remarks = uniqueRemarks([...statusRemarks, ...penaltyRemarks]);
    if (remarks.length > 0) return `(${remarks.join(', ')})`;
    if (entry.status === 'DNS' || entry.status === 'DNF' || entry.status === 'BWTM' || entry.status === 'NOT_FINISHER' || entry.status === 'WITHDRAW') return '';
    if (!entry.status || entry.status === 'OK') return '';
    return printableStatusLabel(entry.status);
  };

  const stageRemark = (stageTime) => {
    if (!stageTime) return '';
    const status = stageTime.status && stageTime.status !== 'OK' ? printableStatusLabel(stageTime.status) : '';
    const remark = stageTime.status === 'BWTM' && stageTime.remark_penalty === 'BWTM' ? '' : compactTCPenaltyRemark(stageTime.remark_penalty, stageTime.ss_order);
    return [status, remark].filter(Boolean).join(' / ');
  };

  const stageResultTime = (stageTime) => {
    if (!stageTime) return '-';
    if (
      (stageTime.status === 'OK' && stageTime.finish_time) ||
      stageTime.status === 'BWTM' ||
      (stageTime.status === 'DNF' && Number(stageTime.total_time_ms) > 0) ||
      (stageTime.status === 'DNS' && Number(stageTime.total_time_ms) > 0)
    ) {
      return formatMs(stageTime.total_time_ms);
    }
    return '-';
  };

  const resultRowClass = (status) => {
    if (status && status !== 'OK') return 'text-gray-900';
    return '';
  };

  const excludedFinalStatuses = new Set(['NOT_FINISHER', 'WITHDRAW']);
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
        (stageTime?.status === 'DNF' && numericMs(stageTime.total_time_ms) > 0) ||
        (stageTime?.status === 'DNS' && numericMs(stageTime.total_time_ms) > 0)
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
      const aTotal = numericMs(a.stageTime.total_time_ms);
      const bTotal = numericMs(b.stageTime.total_time_ms);
      if (aOk && bOk && aTotal !== bTotal) {
        return aTotal - bTotal;
      }
      const aStatusWeight = stageStatusWeight(a.stageTime.status);
      const bStatusWeight = stageStatusWeight(b.stageTime.status);
      if (aStatusWeight !== bStatusWeight) return aStatusWeight - bStatusWeight;
      return numericMs(a.entry.start_number) - numericMs(b.entry.start_number);
    });

    const best = numericMs(rows.find((row) => hasStageResult(row.stageTime))?.stageTime.total_time_ms);
    let rank = 1;
    let previousRankedTotal = 0;
    return rows.map((row) => {
      const isOk = hasStageResult(row.stageTime);
      const total = numericMs(row.stageTime.total_time_ms);
      const result = {
        ...row,
        rank: isOk ? rank : 0,
        diffPrevMs: isOk && previousRankedTotal ? total - previousRankedTotal : 0,
        diffFirstMs: isOk && best ? total - best : 0,
      };
      if (isOk) {
        previousRankedTotal = total;
        rank += 1;
      }
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

  const handlePrint = async () => {
    await generateReportPdfFromElement({
      element: reportElementRef.current,
      paperSize,
      orientation: paperOrientation,
      fileName: `${selectedEvent?.name || 'result'}-${selectedStageLabel}`,
    });
  };

  return (
    <div className="min-h-full space-y-6">
      <PrintLayoutStyle paperSize={paperSize} orientation={paperOrientation}>{`
        th:nth-child(1), th:nth-child(2), th:nth-child(6), th:nth-child(7),
        td:nth-child(1), td:nth-child(2), td:nth-child(6), td:nth-child(7) { text-align: center !important; white-space: nowrap !important; }
      `}</PrintLayoutStyle>

      <div className="no-print bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Result</h2>
            <p className="text-sm text-gray-500 mt-1">Final result and stage result print format.</p>
          </div>
          <div className="grid min-w-0 w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 [&>*]:min-w-0 [&_select]:min-w-0 [&_select]:max-w-full">
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
            <PaperSizeField value={paperSize} onChange={handlePaperSizeChange} />
            <OrientationField value={paperOrientation} onChange={handlePaperOrientationChange} />
            <button onClick={handlePrint} disabled={!selectedEventId || isLoading} className="admin-btn-primary h-[42px] min-w-0 w-full self-end">
              BUAT PDF
            </button>
          </div>
        </div>
      </div>

      <div ref={reportElementRef} className="print-page bg-white border border-gray-200 rounded-xl p-6 shadow-sm" data-orientation={paperOrientation} data-paper-size={paperSize}>
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
            orientation={paperOrientation}
          />
        ) : (
          <StageResultReport
            stages={printableStages}
            groups={printableGroups}
            entriesForStage={entriesForStage}
            formatMs={formatMs}
            stageRemark={stageRemark}
            resultRowClass={resultRowClass}
            timeDecimalPlaces={timeDecimalPlaces}
            orientation={paperOrientation}
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
          <UnofficialResultMark />
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

function emptyReport() {
  return { stages: [], groups: [] };
}

function normalizeRaceReport(value) {
  if (!value || typeof value !== 'object') return emptyReport();
  return {
    stages: Array.isArray(value.stages) ? value.stages : [],
    groups: Array.isArray(value.groups)
      ? value.groups.map((group) => ({
          ...group,
          entries: Array.isArray(group?.entries) ? group.entries : [],
        }))
      : [],
  };
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

function finalResultColumnWidths(stageCount, orientation = 'landscape') {
  const safeStageCount = Math.max(stageCount, 1);
  const isPortrait = orientation === 'portrait';
  const fixed = {
    rank: isPortrait ? 4.5 : 4,
    noStart: isPortrait ? 5.5 : 5,
    regional: isPortrait ? 6 : 7,
    className: 4,
    category: 4,
    total: isPortrait ? 8 : 7,
    diffPrev: 6,
    diffFirst: 6,
    remark: 8,
  };
  const fixedTotal = Object.values(fixed).reduce((sum, value) => sum + value, 0);
  const nameBudget = isPortrait ? 30 : 27;
  const availableForStageTimes = 100 - fixedTotal - nameBudget;
  const stageTime = availableForStageTimes / safeStageCount;
  const remaining = 100 - fixedTotal - (stageTime * safeStageCount);
  const driver = remaining * 0.58;
  const entrant = remaining - driver;

  return {
    rank: `${fixed.rank}%`,
    noStart: `${fixed.noStart}%`,
    driver: `${(driver / 2).toFixed(1)}%`,
    navigator: `${(driver / 2).toFixed(1)}%`,
    entrant: `${entrant.toFixed(1)}%`,
    regional: `${fixed.regional}%`,
    className: `${fixed.className}%`,
    category: `${fixed.category}%`,
    stageTime: `${stageTime.toFixed(1)}%`,
    total: `${fixed.total}%`,
    diffPrev: `${fixed.diffPrev}%`,
    diffFirst: `${fixed.diffFirst}%`,
    remark: `${fixed.remark}%`,
  };
}

function stageResultColumnWidths(orientation = 'landscape') {
  if (orientation === 'portrait') {
    return {
      rank: '4%', noStart: '5%', entrant: '10%', driver: '8.5%', navigator: '8.5%',
      regional: '5%', className: '4%', category: '4%', start: '6%', finish: '6%',
      time: '7%', penalty: '6%', total: '7%', diffPrev: '5.5%', diffFirst: '5.5%', remark: '8%',
    };
  }
  return {
    rank: '4%',
    noStart: '5%',
    entrant: '11%',
    driver: '9%',
    navigator: '9%',
    regional: '6%',
    className: '4%',
    category: '4%',
    start: '5.5%',
    finish: '5.5%',
    time: '6%',
    penalty: '6%',
    total: '6%',
    diffPrev: '6%',
    diffFirst: '6%',
    remark: '7%',
  };
}

function formatDiffMs(value, formatMs) {
  const diff = Number(value || 0);
  if (!Number.isFinite(diff) || diff <= 0) return '-';
  return `+${formatMs(diff)}`;
}

function FinalResultReport({ groups, stages, formatMs, stageTimeFor, finalRemark, stageResultTime, resultRowClass, excludedStatuses, orientation }) {
  const columnWidths = finalResultColumnWidths(stages.length, orientation);
  const lastStage = stages.reduce((latest, stage) => {
    if (!latest) return stage;
    return Number(stage.ss_order) > Number(latest.ss_order) ? stage : latest;
  }, null);
  const printableGroups = groups
    .map((group) => {
      const sortedEntries = sortFinalResultEntries(group.entries
        .filter((entry) => !excludedStatuses.has(entry.status))
        .filter((entry) => !isLastStageNonFinisher(entry, lastStage)));
      const firstTotal = Number(sortedEntries.find((entry) => isRankableFinalEntry(entry))?.total_time_ms || 0);
      let previousRankedTotal = 0;
      let printRank = 1;

      return {
        ...group,
        entries: sortedEntries.map((entry) => {
          const isRankable = isRankableFinalEntry(entry);
          const total = Number(entry.total_time_ms || 0);
          const nextEntry = {
            ...entry,
            print_rank: isRankable ? printRank : 0,
            diff_prev_ms: isRankable && previousRankedTotal ? total - previousRankedTotal : 0,
            diff_first_ms: isRankable && firstTotal ? total - firstTotal : 0,
          };
          if (isRankable) {
            previousRankedTotal = total;
            printRank += 1;
          }
          return nextEntry;
        }),
      };
    })
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
      <div className="print-table-wrap overflow-x-auto">
        <table className="uniform-result-table w-full border-collapse text-[11px]">
          <colgroup>
            <col style={{ width: columnWidths.rank }} />
            <col style={{ width: columnWidths.noStart }} />
            <col style={{ width: columnWidths.entrant }} />
            <col style={{ width: columnWidths.driver }} />
            <col style={{ width: columnWidths.navigator }} />
            <col style={{ width: columnWidths.regional }} />
            <col style={{ width: columnWidths.className }} />
            <col style={{ width: columnWidths.category }} />
            {stages.map((stage) => (
              <col key={stage.id} style={{ width: columnWidths.stageTime }} />
            ))}
            <col style={{ width: columnWidths.total }} />
            <col style={{ width: columnWidths.diffPrev }} />
            <col style={{ width: columnWidths.diffFirst }} />
            <col style={{ width: columnWidths.remark }} />
          </colgroup>
          <thead>
            <tr className="bg-slate-300 text-center text-slate-900">
              <th className="border border-gray-300 p-2 text-center">Pos</th>
              <th className="border border-gray-300 p-2 text-center">Car No</th>
              <th className="border border-gray-300 p-2 text-center">Entrant</th>
              <th className="border border-gray-300 p-2 text-center">Driver</th>
              <th className="border border-gray-300 p-2 text-center">Navigator</th>
              <th className="border border-gray-300 p-2 text-center">Regional</th>
              <th className="border border-gray-300 p-2 text-center">CLS</th>
              <th className="border border-gray-300 p-2 text-center">CAT</th>
              {stages.map((stage) => (
                <th key={stage.id} className="border border-gray-300 p-2 text-center">SS{stage.ss_order}</th>
              ))}
              <th className="border border-gray-300 p-2 text-center">Total Time</th>
              <th className="border border-gray-300 p-2 text-center">Diff</th>
              <th className="border border-gray-300 p-2 text-center">Diff 1st</th>
              <th className="border border-gray-300 p-2 text-center">Remark</th>
            </tr>
          </thead>
          <tbody>
            {group.entries.map((entry) => (
              <tr key={entry.participant_id} className={resultRowClass(entry.status)}>
                <td className="border border-gray-300 p-2 text-center font-black">{entry.print_rank || '-'}</td>
                <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                <td className="border border-gray-300 p-2">{entry.entrant_name || entry.team_name || '-'}</td>
                <td className="print-driver-name border border-gray-300 p-2">{entry.driver_name}</td>
                <td className="print-codriver-name border border-gray-300 p-2">{entry.codriver_name || '-'}</td>
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
                <td className="border border-gray-300 p-2 text-right font-mono">{formatDiffMs(entry.diff_prev_ms, formatMs)}</td>
                <td className="border border-gray-300 p-2 text-right font-mono">{formatDiffMs(entry.diff_first_ms, formatMs)}</td>
                <td className="border border-gray-300 p-2">{finalRemark(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  ));
}

function isLastStageNonFinisher(entry, lastStage) {
  if (!lastStage) return false;
  const lastStageTime = entry.stage_times?.find((stageTime) => stageTime.ss_id === lastStage.id);
  return lastStageTime?.status === 'DNS' || lastStageTime?.status === 'DNF';
}

function isRankableFinalEntry(entry) {
  if (Number(entry.total_time_ms) <= 0) return false;
  return ['OK', 'BWTM', 'DNF', 'DNS'].includes(entry.status);
}

function sortFinalResultEntries(entries) {
  return [...entries].sort((a, b) => {
    const aRankable = isRankableFinalEntry(a);
    const bRankable = isRankableFinalEntry(b);
    if (aRankable !== bRankable) return aRankable ? -1 : 1;
    if (aRankable && Number(a.total_time_ms) !== Number(b.total_time_ms)) {
      return Number(a.total_time_ms) - Number(b.total_time_ms);
    }
    return Number(a.start_number) - Number(b.start_number);
  });
}

function uniqueRemarks(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function StageResultReport({ stages, groups, entriesForStage, formatMs, stageRemark, resultRowClass, timeDecimalPlaces = 2, orientation }) {
  const columnWidths = stageResultColumnWidths(orientation);
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
              <div className="print-table-wrap overflow-x-auto">
                <table className="uniform-result-table w-full border-collapse text-[11px]">
                  <colgroup>
                    <col style={{ width: columnWidths.rank }} />
                    <col style={{ width: columnWidths.noStart }} />
                    <col style={{ width: columnWidths.entrant }} />
                    <col style={{ width: columnWidths.driver }} />
                    <col style={{ width: columnWidths.navigator }} />
                    <col style={{ width: columnWidths.regional }} />
                    <col style={{ width: columnWidths.className }} />
                    <col style={{ width: columnWidths.category }} />
                    <col style={{ width: columnWidths.start }} />
                    <col style={{ width: columnWidths.finish }} />
                    <col style={{ width: columnWidths.time }} />
                    <col style={{ width: columnWidths.penalty }} />
                    <col style={{ width: columnWidths.total }} />
                    <col style={{ width: columnWidths.diffPrev }} />
                    <col style={{ width: columnWidths.diffFirst }} />
                    <col style={{ width: columnWidths.remark }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-300 text-center text-slate-900">
                      <th className="border border-gray-300 p-2 text-center">Pos</th>
                      <th className="border border-gray-300 p-2 text-center">Car No</th>
                      <th className="border border-gray-300 p-2 text-center">Entrant</th>
                      <th className="border border-gray-300 p-2 text-center">Driver</th>
                      <th className="border border-gray-300 p-2 text-center">Navigator</th>
                      <th className="border border-gray-300 p-2 text-center">Regional</th>
                      <th className="border border-gray-300 p-2 text-center">CLS</th>
                      <th className="border border-gray-300 p-2 text-center">CAT</th>
                      <th className="border border-gray-300 p-2 text-center">Start</th>
                      <th className="border border-gray-300 p-2 text-center">Finish</th>
                      <th className="border border-gray-300 p-2 text-center">Stage Time</th>
                      <th className="border border-gray-300 p-2 text-center">Penalties</th>
                      <th className="border border-gray-300 p-2 text-center">Total Time</th>
                      <th className="border border-gray-300 p-2 text-center">Diff</th>
                      <th className="border border-gray-300 p-2 text-center">Diff 1st</th>
                      <th className="border border-gray-300 p-2 text-center">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, stageTime, rank, diffPrevMs, diffFirstMs }) => (
                      <tr key={entry.participant_id} className={resultRowClass(stageTime.status)}>
                        <td className="border border-gray-300 p-2 text-center font-black">{rank || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                        <td className="border border-gray-300 p-2">{entry.entrant_name || entry.team_name || '-'}</td>
                        <td className="print-driver-name border border-gray-300 p-2">{entry.driver_name}</td>
                        <td className="print-codriver-name border border-gray-300 p-2">{entry.codriver_name || '-'}</td>
                        <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                        <td className="border border-gray-300 p-2">{classCode(entry.class_name)}</td>
                        <td className="border border-gray-300 p-2">{categoryCode(entry.category_name)}</td>
                        <td className="border border-gray-300 p-2 text-center font-mono">{stageTime.start_time || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-mono">{formatClockCentiseconds(stageTime.finish_time, timeDecimalPlaces)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatMs(stageTime.elapsed_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatMs(stageTime.penalty_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono font-black">{formatMs(stageTime.total_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatDiffMs(diffPrevMs, formatMs)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatDiffMs(diffFirstMs, formatMs)}</td>
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
