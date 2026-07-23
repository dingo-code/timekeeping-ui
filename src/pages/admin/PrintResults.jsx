import { useEffect, useMemo, useState } from 'react';
import api, { assetUrl } from '../../services/api';

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
  const [selectedRegionalId, setSelectedRegionalId] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState('all');
  const [resultStatus, setResultStatus] = useState(localStorage.getItem('print_result_status') || 'unofficial');
  const [report, setReport] = useState({ stages: [], groups: [] });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchRegions();
  }, []);

  useEffect(() => {
    if (selectedEventId) fetchResults();
  }, [selectedEventId, reportScope, reportType, selectedRegionalId]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId),
    [events, selectedEventId]
  );

  const printableStages = useMemo(() => {
    if (selectedStageId === 'all') return report.stages;
    return report.stages.filter((stage) => stage.id === selectedStageId);
  }, [report.stages, selectedStageId]);

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
    if (entry.status !== 'OK') return entry.status;
    return '';
  };

  const stageRemark = (stageTime) => {
    if (!stageTime) return '';
    const status = stageTime.status && stageTime.status !== 'OK' ? stageTime.status : '';
    if (status && stageTime.remark_penalty) return `${status} - ${stageTime.remark_penalty}`;
    return status || stageTime.remark_penalty || '';
  };

  const resultRowClass = (status) => {
    if (status === 'DNF') return 'bg-orange-100 text-orange-950';
    if (status === 'DNS') return 'bg-yellow-100 text-yellow-950';
    if (status === 'DSQ') return 'bg-red-100 text-red-950';
    if (status && status !== 'OK') return 'bg-gray-100 text-gray-700';
    return '';
  };

  const excludedFinalStatuses = new Set(['DNF', 'DNS']);
  const stageStatusWeight = (status) => {
    if (status === 'OK') return 0;
    if (status === 'INCOMPLETE' || !status) return 1;
    if (status === 'DSQ') return 2;
    if (status === 'DNF') return 3;
    if (status === 'DNS') return 4;
    return 2;
  };

  const entriesForStage = (stage, sourceEntries) => {
    const numericMs = (value) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    };
    const hasStageResult = (stageTime) => (
      stageTime?.status === 'OK' &&
      Boolean(stageTime.finish_time) &&
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
  const resultStatusLabel = resultStatus === 'official' ? 'OFFICIAL RESULT' : 'UNOFFICIAL RESULT';
  const selectedEventDateText = formatEventDateRange(selectedEvent);
  const selectedEventLogo = assetUrl(selectedEvent?.logo_url);
  const printDateText = formatPrintDate(new Date());
  const selectedStageLabel = reportScope === 'final'
    ? 'Hasil Akhir'
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
          @page { size: landscape; margin: 0; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff !important; margin: 0 !important; }
          aside, header, .no-print { display: none !important; }
          main, main > div { display: block !important; padding: 0 !important; background: #fff !important; }
          .print-page { box-shadow: none !important; border: 0 !important; padding: 8mm !important; }
          .print-header { break-after: avoid; page-break-after: avoid; margin-bottom: 8px !important; padding-bottom: 8px !important; }
          .print-group { page-break-inside: auto; break-inside: auto; margin-bottom: 14px !important; }
          .print-group-title { break-after: avoid; page-break-after: avoid; }
          table { page-break-inside: auto; font-size: 10px; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>

      <div className="no-print bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Cetak Hasil Balapan</h2>
            <p className="text-sm text-gray-500 mt-1">Format hasil akhir dan hasil setiap SS.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_190px_190px_150px_190px_auto] gap-3 w-full xl:w-auto">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Event</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-red-500" value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                <option value="">-- Pilih Event --</option>
                {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Bentuk</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-red-500" value={reportScope} onChange={(e) => setReportScope(e.target.value)}>
                <option value="final">Hasil Akhir</option>
                <option value="stage">Setiap SS</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Jenis Hasil</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-red-500" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Regional</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-red-500" value={selectedRegionalId} onChange={(e) => setSelectedRegionalId(e.target.value)}>
                <option value="all">Semua Regional</option>
                {regions.map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">SS</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50" value={selectedStageId} onChange={(e) => setSelectedStageId(e.target.value)} disabled={reportScope === 'final'}>
                <option value="all">Semua SS</option>
                {report.stages.map((stage) => <option key={stage.id} value={stage.id}>SS {stage.ss_order}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Status Hasil</label>
              <select className="w-full p-3 border border-gray-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-red-500" value={resultStatus} onChange={(e) => handleResultStatusChange(e.target.value)}>
                <option value="unofficial">Unofficial Result</option>
                <option value="official">Official Result</option>
              </select>
            </div>
            <button onClick={handlePrint} disabled={!selectedEventId || isLoading} className="self-end px-5 py-3 bg-red-600 text-white rounded-lg font-black text-sm hover:bg-red-700 disabled:opacity-50">
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
        />

        {isLoading ? (
          <div className="p-10 text-center text-gray-500 font-bold">Memuat hasil...</div>
        ) : reportScope === 'final' ? (
          <FinalResultReport
            groups={report.groups}
            stages={report.stages}
            formatMs={formatMs}
            stageTimeFor={stageTimeFor}
            finalRemark={finalRemark}
            resultRowClass={resultRowClass}
            excludedStatuses={excludedFinalStatuses}
          />
        ) : (
          <StageResultReport
            stages={printableStages}
            groups={report.groups}
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

function PrintHeader({ eventName, eventDateText, eventLocation, logoUrl, resultStatusLabel, printDateText, lineFourLabel, regionalLabel }) {
  return (
    <div className="print-header border-b border-gray-300 pb-4 mb-5">
      <div className="grid grid-cols-[230px_1fr_230px] items-center gap-4 min-h-32">
        <div className="h-32 flex items-center justify-center bg-white">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo event" className="max-h-32 w-auto max-w-full object-contain" />
          ) : (
            <span className="text-[10px] font-black text-gray-400 text-center uppercase">Logo Event</span>
          )}
        </div>
        <div className="text-center self-center">
          <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900">{eventName}</h1>
          <p className="text-sm font-bold text-gray-700 capitalize">{eventDateText}</p>
          <p className="text-sm font-semibold text-gray-600">{eventLocation}</p>
          {regionalLabel && <p className="mt-2 text-xs font-bold text-gray-500 uppercase tracking-wide">{regionalLabel}</p>}
          <p className={`${regionalLabel ? '' : 'mt-2'} text-xs font-bold text-gray-500 uppercase tracking-wide`}>{lineFourLabel}</p>
        </div>
        <div className="h-32 flex flex-col items-center justify-center gap-2">
          <span className="inline-block border-2 border-gray-900 px-4 py-2 text-sm font-black uppercase tracking-wide text-center leading-tight">
            {resultStatusLabel}
          </span>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Tanggal Cetak: {printDateText}</p>
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

function FinalResultReport({ groups, stages, formatMs, stageTimeFor, finalRemark, resultRowClass, excludedStatuses }) {
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
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="border border-gray-300 p-2 text-center">Rank</th>
              <th className="border border-gray-300 p-2 text-center">No Start</th>
              <th className="border border-gray-300 p-2 text-left">Driver/Co driver</th>
              <th className="border border-gray-300 p-2 text-left">Entrant</th>
              <th className="border border-gray-300 p-2 text-left">Class</th>
              <th className="border border-gray-300 p-2 text-left">Regional</th>
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
                  <div className="font-bold text-gray-800">{entry.driver_name}</div>
                  <div className="text-[10px] text-gray-500">{entry.codriver_name || '-'}</div>
                </td>
                <td className="border border-gray-300 p-2">{entry.entrant_name || entry.team_name || '-'}</td>
                <td className="border border-gray-300 p-2">{entry.class_name}</td>
                <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                {stages.map((stage) => {
                  const stageTime = stageTimeFor(entry, stage.id);
                  return (
                    <td key={stage.id} className="border border-gray-300 p-2 text-right font-mono">
                      {stageTime?.finish_time ? formatMs(stageTime.total_time_ms) : '-'}
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
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border border-gray-300 p-2 text-center">Rank</th>
                      <th className="border border-gray-300 p-2 text-center">No Start</th>
                      <th className="border border-gray-300 p-2 text-left">Driver/Co driver</th>
                      <th className="border border-gray-300 p-2 text-left">Entrant</th>
                      <th className="border border-gray-300 p-2 text-left">Class</th>
                      <th className="border border-gray-300 p-2 text-left">Regional</th>
                      <th className="border border-gray-300 p-2 text-center">Start</th>
                      <th className="border border-gray-300 p-2 text-center">Finish</th>
                      <th className="border border-gray-300 p-2 text-right">Time</th>
                      <th className="border border-gray-300 p-2 text-right">time Penalty</th>
                      <th className="border border-gray-300 p-2 text-right">Total</th>
                      <th className="border border-gray-300 p-2 text-right">Dif</th>
                      <th className="border border-gray-300 p-2 text-left">Remark Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ entry, stageTime, rank, diffMs }) => (
                      <tr key={entry.participant_id} className={resultRowClass(stageTime.status)}>
                        <td className="border border-gray-300 p-2 text-center font-black">{rank || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-black">{entry.start_number}</td>
                        <td className="border border-gray-300 p-2">
                          <div className="font-bold text-gray-800">{entry.driver_name}</div>
                          <div className="text-[10px] text-gray-500">{entry.codriver_name || '-'}</div>
                        </td>
                        <td className="border border-gray-300 p-2">{entry.entrant_name || entry.team_name || '-'}</td>
                        <td className="border border-gray-300 p-2">{entry.class_name}</td>
                        <td className="border border-gray-300 p-2">{entry.regional_name || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-mono">{stageTime.start_time || '-'}</td>
                        <td className="border border-gray-300 p-2 text-center font-mono">{stageTime.finish_time || '-'}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatMs(stageTime.elapsed_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{formatMs(stageTime.penalty_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono font-black">{formatMs(stageTime.total_time_ms)}</td>
                        <td className="border border-gray-300 p-2 text-right font-mono">{diffMs ? `+${formatMs(diffMs)}` : '-'}</td>
                        <td className="border border-gray-300 p-2">{stageRemark(stageTime) || '-'}</td>
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
