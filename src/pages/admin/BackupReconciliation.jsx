import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { readBackupResultPdf } from '../../utils/backupResultPdf';
import { formatMs } from '../../utils/timeFormat';

const modeMap = {
  ss: { label: 'Special Stage', start: [4, 5], finish: [7, 8, 9, 10] },
  practice: {
    label: 'Practice',
    runs: [
      { runNo: 1, start: [4, 5], finish: [7, 8, 9, 10] },
      { runNo: 2, start: [16, 17], finish: [19, 20, 21, 22] },
      { runNo: 3, start: [28, 29], finish: [31, 32, 33, 34] },
    ],
  },
};

export default function BackupReconciliation() {
  const [events, setEvents] = useState([]), [eventId, setEventId] = useState('');
  const [mode, setMode] = useState('ss'), [sessions, setSessions] = useState([]), [sessionId, setSessionId] = useState('');
  const [workbook, setWorkbook] = useState(null), [sheetName, setSheetName] = useState('');
  const [pdfResult, setPdfResult] = useState(null), [sourceKind, setSourceKind] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const [rows, setRows] = useState([]), [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [isLoading, setIsLoading] = useState(false), [message, setMessage] = useState('');
  const event = events.find((item) => item.id === eventId), decimalPlaces = event?.time_decimal_places ?? 2;
  const selectedSession = sessions.find((item) => item.id === sessionId) || null;
  const sourceLabel = sourceKind === 'pdf' ? 'PDF' : 'Spreadsheet';

  useEffect(() => {
    api.get('/public/events').then((res) => {
      const list = res.data.data || [];
      setEvents(list);
      setEventId(list[0]?.id || '');
    }).catch(() => setMessage('Gagal memuat event.'));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    const url = mode === 'practice' ? `/public/events/${eventId}/practices` : `/public/events/${eventId}/stages`;
    api.get(url).then((res) => {
      const list = res.data.data || [];
      setSessions(list);
      setSessionId(list[0]?.id || '');
      setRows([]);
    }).catch(() => {
      setSessions([]);
      setSessionId('');
    });
  }, [eventId, mode]);

  const summary = useMemo(() => rows.reduce((result, row) => {
    result[row.result] = (result[row.result] || 0) + 1;
    result.total += 1;
    return result;
  }, { total: 0 }), [rows]);
  const displayedRows = showOnlyIssues ? rows.filter((row) => row.result !== 'SAMA') : rows;
  const sourceReady = sourceKind === 'pdf' ? Boolean(pdfResult?.rows?.length) : Boolean(workbook && sheetName);

  async function loadFile(file) {
    if (!file) return;
    setIsLoading(true);
    setRows([]);
    setMessage('Membaca file backup...');
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const result = await readBackupResultPdf(file);
        setPdfResult(result);
        setWorkbook(null);
        setSheetName('');
        setSourceKind('pdf');
        setSourceFileName(file.name);
        setMessage(`${result.rows.length} baris dari ${result.pages} halaman PDF terbaca. Periksa preview lalu tekan Bandingkan Data.`);
        return;
      }

      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      setWorkbook(wb);
      setSheetName(wb.SheetNames[0] || '');
      setPdfResult(null);
      setSourceKind('spreadsheet');
      setSourceFileName(file.name);
      setMessage(`${file.name} berhasil dibaca. Pilih sheet dan tekan Bandingkan Data.`);
    } catch (error) {
      setWorkbook(null);
      setPdfResult(null);
      setSourceKind('');
      setSourceFileName('');
      setMessage(error.message || 'File backup tidak dapat dibaca.');
    } finally {
      setIsLoading(false);
    }
  }

  async function compare() {
    if (!sourceReady || !sessionId) return setMessage('Pilih event, sesi, dan file backup terlebih dahulu.');
    setIsLoading(true);
    setMessage('');
    try {
      if (sourceKind === 'pdf' && mode !== 'ss') throw new Error('Profil PDF Result saat ini hanya dapat dibandingkan dengan Special Stage.');
      if (sourceKind === 'pdf' && pdfResult.stageOrder && Number(selectedSession?.ss_order) !== Number(pdfResult.stageOrder)) {
        throw new Error(`PDF terdeteksi sebagai SS${pdfResult.stageOrder}, tetapi sesi yang dipilih adalah SS${selectedSession?.ss_order || '-'}. Pilih SS yang sesuai.`);
      }

      let sourceRows;
      if (sourceKind === 'pdf') {
        sourceRows = pdfResult.rows;
      } else {
        const XLSX = await import('xlsx');
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
        sourceRows = mode === 'practice' ? parsePractice(matrix) : parseSS(matrix);
        if (!sourceRows.length) throw new Error('Tidak ditemukan baris dengan nomor start valid pada kolom C.');
      }

      const webRows = mode === 'practice' ? await fetchPractice(sessionId) : await fetchSS(sessionId);
      setRows(reconcile(sourceRows, webRows, decimalPlaces, mode, sourceKind));
      setMessage(`${sourceRows.length} data ${sourceLabel.toLowerCase()} dibandingkan dengan ${webRows.length} data web secara read-only.`);
    } catch (error) {
      setRows([]);
      setMessage(error.response?.data?.error || error.message || 'Gagal membandingkan data.');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSS(id) {
    const res = await api.get(`/public/stages/${id}/records`);
    return (res.data.data || []).filter((record) => record.is_active !== false).map((record) => ({
      key: String(record.start_number), number: record.start_number, runNo: record.attempt_no || 1,
      driver: record.driver_name || '-', tc: normalizeClock(record.tc_time), start: normalizeClock(record.start_time), finish: normalizeClock(record.finish_time),
      elapsedMs: Number(record.elapsed_time_ms || 0), penaltyMs: Number(record.penalty_time_ms || 0), totalTimeMs: Number(record.total_time_ms || 0), status: record.status || 'OK',
    }));
  }

  async function fetchPractice(id) {
    const res = await api.get(`/public/practice-results/${id}`), result = res.data.data || {};
    return (result.entries || []).flatMap((entry) => (entry.runs || []).map((run) => ({
      key: `${entry.practice_start_number}:${run.run_no}`, number: entry.practice_start_number, raceNumber: entry.race_start_number, runNo: run.run_no,
      driver: entry.driver_name || '-', tc: '', start: normalizeClock(run.start_time), finish: normalizeClock(run.finish_time),
      elapsedMs: Number(run.elapsed_time_ms || 0), penaltyMs: Number(run.penalty_time_ms || 0), totalTimeMs: Number(run.total_time_ms || 0), status: run.status || 'OK',
    })));
  }

  async function exportExcelReport() {
    const reportRows = filteredReportRows(rows, showOnlyIssues);
    if (!reportRows.length) return window.alert('Tidak ada data untuk didownload.');
    const XLSX = await import('xlsx'), wb = XLSX.utils.book_new();
    const data = reportRows.map((row) => reportExportRow(row, sourceLabel, decimalPlaces, mode));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, ...Array(15).fill({ wch: 20 }), { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws, 'REKONSILIASI');
    XLSX.writeFile(wb, `${reportFileBase(sourceFileName, mode, showOnlyIssues)}.xlsx`);
  }

  async function exportPdfReport() {
    const reportRows = filteredReportRows(rows, showOnlyIssues);
    if (!reportRows.length) return window.alert('Tidak ada data untuk didownload.');
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('LAPORAN REKONSILIASI BACKUP', 10, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`${event?.name || '-'} | ${sessionLabel(selectedSession, mode)} | Sumber: ${sourceFileName || sourceLabel}`, 10, 15);
    doc.text(`Total ${summary.total} | Sama ${summary.SAMA || 0} | Berbeda ${summary.BERBEDA || 0} | Dibuat ${new Date().toLocaleString('id-ID')}`, 10, 19);
    autoTable(doc, {
      startY: 23,
      head: [['Hasil', 'No', 'Driver', `Elapsed ${sourceLabel}`, 'Elapsed Web', `Penalty ${sourceLabel}`, 'Penalty Web', `Total ${sourceLabel}`, 'Total Web', 'Status', 'Sumber', 'Catatan']],
      body: reportRows.map((row) => [row.result, row.number, row.driver, displayElapsed(row.sourceElapsedMs, decimalPlaces), displayElapsed(row.webElapsedMs, decimalPlaces), displayElapsed(row.sourcePenaltyMs, decimalPlaces), displayElapsed(row.webPenaltyMs, decimalPlaces), displayElapsed(row.sourceTotalTimeMs, decimalPlaces), displayElapsed(row.webTotalTimeMs, decimalPlaces), `${row.sourceStatus || '-'} / ${row.webStatus || '-'}`, row.sourceReference || '-', row.note]),
      theme: 'grid', showHead: 'everyPage', rowPageBreak: 'avoid', margin: { left: 7, right: 7, bottom: 9 },
      styles: { fontSize: 5.5, cellPadding: 1, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 9, halign: 'center' }, 2: { cellWidth: 28 }, 10: { cellWidth: 20 }, 11: { cellWidth: 42 } },
    });
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(6);
      doc.setTextColor(107, 114, 128);
      doc.text(`Halaman ${page} / ${pageCount}`, 290, 205, { align: 'right' });
    }
    doc.save(`${reportFileBase(sourceFileName, mode, showOnlyIssues)}.pdf`);
  }

  return <div className="space-y-5">
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div><p className="text-xs font-black uppercase tracking-[.25em] text-red-600">Data Reconciliation</p><h1 className="mt-1 text-2xl font-black uppercase text-gray-900">Verifikasi Backup PDF / Spreadsheet</h1><p className="mt-1 text-sm text-gray-500">Perbandingan bersifat read-only. File backup tidak dapat mengubah data resmi di web.</p></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Jenis Data"><select value={mode} onChange={(e) => { setMode(e.target.value); setRows([]); }} className="field"><option value="ss">Special Stage</option><option value="practice">Practice</option></select></Field>
        <Field label="Event"><select value={eventId} onChange={(e) => setEventId(e.target.value)} className="field">{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label={modeMap[mode].label}><select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setRows([]); }} className="field">{sessions.map((item) => <option key={item.id} value={item.id}>{sessionLabel(item, mode)}</option>)}</select></Field>
        <Field label="File Backup"><label className="flex h-11 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 px-3 text-center text-xs font-black uppercase text-gray-600 hover:border-red-400">Pilih PDF / Excel / CSV<input className="hidden" type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }}/></label></Field>
        {sourceKind === 'pdf' ? <Field label="Profil Parser"><div className="flex h-11 items-center rounded border bg-blue-50 px-3 text-xs font-black text-blue-700">{pdfResult?.profile || 'PDF Result'}</div></Field> : <Field label="Sheet"><select disabled={!workbook} value={sheetName} onChange={(e) => { setSheetName(e.target.value); setRows([]); }} className="field"><option value="">Pilih sheet</option>{workbook?.SheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={isLoading || !sourceReady || !sessionId} onClick={compare} className="admin-btn-primary">{isLoading ? 'Memproses...' : 'Bandingkan Data'}</button>{sourceFileName && <span className="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{sourceFileName}</span>}{message && <p className="text-sm font-semibold text-gray-600">{message}</p>}</div>
    </section>

    {pdfResult && <PdfPreview result={pdfResult} decimalPlaces={decimalPlaces}/>}

    {rows.length > 0 && <>
      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6"><Stat label="Total" value={summary.total}/><Stat label="Sama" value={summary.SAMA || 0} tone="green"/><Stat label="Berbeda" value={summary.BERBEDA || 0} tone="red"/><Stat label={sourceKind === 'pdf' ? 'Hanya PDF' : 'Hanya Spreadsheet'} value={summary[sourceKind === 'pdf' ? 'HANYA DI PDF' : 'HANYA SPREADSHEET'] || 0} tone="yellow"/><Stat label="Hanya Web" value={summary['HANYA DI WEB'] || 0} tone="blue"/><Stat label="Tidak Terbaca" value={summary['TIDAK TERBACA'] || 0} tone="orange"/></section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-black uppercase">Hasil Perbandingan</h2><p className="text-xs text-gray-500">Toleransi: {(1 / (10 ** Math.max(0, Number(decimalPlaces) || 0))).toLocaleString('id-ID')} detik. Bidang yang tidak tersedia di PDF tidak dianggap berbeda.</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={showOnlyIssues} onChange={(e) => setShowOnlyIssues(e.target.checked)}/> Hanya bermasalah</label><button className="admin-btn-muted" onClick={exportExcelReport}>Download Excel</button><button className="admin-btn-muted" onClick={exportPdfReport}>Download PDF</button></div></header>
        <div className="overflow-x-auto"><table className="min-w-[1850px] w-full text-[11px]"><thead className="bg-gray-900 text-[10px] uppercase text-white"><tr><th className="p-2">Hasil</th><th className="p-2">No</th>{mode === 'practice' && <th className="p-2">Run</th>}<th className="p-2 text-left">Driver</th><th className="p-2">TC</th><th className="p-2">Start</th><th className="p-2">Finish</th><th className="p-2">Elapsed</th><th className="p-2">Penalty</th><th className="p-2">Total</th><th className="p-2">Status</th><th className="p-2 text-left">Bukti Sumber</th><th className="p-2 text-left">Catatan</th></tr></thead><tbody>{displayedRows.map((row) => <tr key={row.key} className="border-b align-top"><td className="p-2 text-center"><ResultBadge result={row.result}/></td><td className="p-2 text-center text-sm font-black">{row.number}</td>{mode === 'practice' && <td className="p-2 text-center font-black">{row.runNo}</td>}<td className="p-2 font-bold">{row.driver}</td><CompareCell label={sourceLabel} source={row.sourceTc} web={row.webTc} available={row.sourceAvailable?.tc}/><CompareCell label={sourceLabel} source={row.sourceStart} web={row.webStart} available={row.sourceAvailable?.start}/><CompareCell label={sourceLabel} source={row.sourceFinish} web={row.webFinish} available={row.sourceAvailable?.finish}/><CompareCell label={sourceLabel} source={displayElapsed(row.sourceElapsedMs, decimalPlaces)} web={displayElapsed(row.webElapsedMs, decimalPlaces)} available={row.sourceAvailable?.elapsed}/><CompareCell label={sourceLabel} source={displayElapsed(row.sourcePenaltyMs, decimalPlaces)} web={displayElapsed(row.webPenaltyMs, decimalPlaces)} available={row.sourceAvailable?.penalty}/><CompareCell label={sourceLabel} source={displayElapsed(row.sourceTotalTimeMs, decimalPlaces)} web={displayElapsed(row.webTotalTimeMs, decimalPlaces)} available={row.sourceAvailable?.total}/><CompareCell label={sourceLabel} source={row.sourceStatus} web={row.webStatus} available={row.sourceAvailable?.status}/><td className="p-2 font-semibold text-gray-600">{row.sourceReference || '-'}</td><td className="max-w-[320px] p-2 font-semibold text-gray-600">{row.note}</td></tr>)}</tbody></table>{!displayedRows.length && <p className="p-10 text-center text-sm font-bold text-gray-500">Tidak ada data bermasalah.</p>}</div>
      </section>
    </>}
    <style>{`.field{height:2.75rem;width:100%;border-radius:.375rem;border:1px solid #d1d5db;background:white;padding:0 .75rem;font-size:.875rem;font-weight:700;outline:none}.field:focus{border-color:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.15)}`}</style>
  </div>;
}

function PdfPreview({ result, decimalPlaces }) {
  return <section className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm"><header className="border-b border-blue-100 bg-blue-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Preview & Pemetaan Kolom</p><h2 className="font-black text-gray-900">{result.fileName}</h2><p className="text-xs font-semibold text-gray-600">{result.pages} halaman - {result.rows.length} peserta - SS terdeteksi: {result.stageOrder || '-'} - tidak terbaca: {result.unreadableCount}</p></div><div className="flex flex-wrap gap-2">{result.mapping.map((item) => <span key={item.field} className={`rounded border px-2 py-1 text-[10px] font-black ${item.required ? 'border-blue-300 bg-white text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>{item.field} &larr; {item.source}</span>)}</div></div></header><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-xs"><thead className="bg-gray-900 uppercase text-white"><tr><th className="p-2">Hal.</th><th className="p-2">Pos</th><th className="p-2">No</th><th className="p-2 text-left">Driver</th><th className="p-2">Class</th><th className="p-2">Stage Time</th><th className="p-2">Penalty</th><th className="p-2">Total</th><th className="p-2">Status</th></tr></thead><tbody>{result.rows.slice(0, 10).map((row) => <tr key={`${row.sourcePage}-${row.key}`} className="border-b"><td className="p-2 text-center">{row.sourcePage}</td><td className="p-2 text-center">{row.position || '-'}</td><td className="p-2 text-center font-black">{row.number}</td><td className="p-2 font-bold">{row.driver || '-'}</td><td className="p-2 text-center">{row.className || '-'}</td><td className="p-2 text-center font-mono">{displayElapsed(row.elapsedMs, decimalPlaces)}</td><td className="p-2 text-center font-mono">{displayElapsed(row.penaltyMs, decimalPlaces)}</td><td className="p-2 text-center font-mono">{displayElapsed(row.totalTimeMs, decimalPlaces)}</td><td className="p-2 text-center font-black">{row.status || 'Tidak tersedia'}</td></tr>)}</tbody></table></div><p className="border-t bg-gray-50 px-4 py-2 text-[11px] font-semibold text-gray-500">Menampilkan 10 baris pertama. TC, Start, dan Finish tidak tersedia pada format PDF contoh sehingga tidak dibandingkan.</p></section>;
}

function parseSS(matrix) {
  return matrix.flatMap((row, index) => {
    const number = positiveNumber(row[2]);
    if (!number) return [];
    const start = buildStart(row, modeMap.ss.start), finish = buildFinish(row, modeMap.ss.finish);
    if (!start && !finish) return [];
    return [{ key: String(number), number, runNo: 1, sourceRow: index + 1, start, finish, elapsedMs: elapsed(start, finish), readable: true, sourceKind: 'spreadsheet', available: { tc: false, start: Boolean(start), finish: Boolean(finish), elapsed: Boolean(start && finish), penalty: false, total: false, status: false } }];
  });
}

function parsePractice(matrix) {
  return matrix.flatMap((row, index) => {
    const number = positiveNumber(row[2]);
    if (!number) return [];
    return modeMap.practice.runs.flatMap((definition) => {
      const start = buildStart(row, definition.start), finish = buildFinish(row, definition.finish);
      if (!start && !finish) return [];
      return [{ key: `${number}:${definition.runNo}`, number, runNo: definition.runNo, sourceRow: index + 1, start, finish, elapsedMs: elapsed(start, finish), readable: true, sourceKind: 'spreadsheet', available: { tc: false, start: Boolean(start), finish: Boolean(finish), elapsed: Boolean(start && finish), penalty: false, total: false, status: false } }];
    });
  });
}

function reconcile(sourceRows, webRows, decimals, mode, sourceKind) {
  const sourceMap = new Map(sourceRows.map((row) => [row.key, row]));
  const webMap = new Map(webRows.map((row) => [mode === 'practice' ? row.key : String(row.number), row]));
  const sourceOnly = sourceKind === 'pdf' ? 'HANYA DI PDF' : 'HANYA SPREADSHEET';
  const sourceName = sourceKind === 'pdf' ? 'PDF' : 'spreadsheet';

  return [...new Set([...sourceMap.keys(), ...webMap.keys()])].map((key) => {
    const source = sourceMap.get(key), web = webMap.get(key);
    const number = source?.number ?? web?.number, runNo = source?.runNo ?? web?.runNo;
    if (!source) return webOnlyRow(key, web, sourceName);
    const sourceReference = source.sourceKind === 'pdf' ? `PDF hal. ${source.sourcePage}${source.sourceRow ? `, posisi ${source.sourceRow}` : ''}` : `Spreadsheet baris ${source.sourceRow}`;
    if (!source.readable) return combinedRow({ key, number, runNo, source, web, sourceReference, result: 'TIDAK TERBACA', note: source.parseIssue || `${sourceName} tidak dapat dibaca.` });
    if (!web) return combinedRow({ key, number, runNo, source, web: null, sourceReference, result: sourceOnly, note: `Data dari ${sourceName} belum ditemukan di web.` });

    const tolerance = 1000 / (10 ** Math.max(0, Number(decimals) || 0));
    const differences = [];
    const startDiff = source.available?.start ? clockDifference(source.start, web.start) : 0;
    const finishDiff = source.available?.finish ? clockDifference(source.finish, web.finish) : 0;
    const elapsedDiff = source.available?.elapsed ? durationDifference(source.elapsedMs, web.elapsedMs) : 0;
    const penaltyDiff = source.available?.penalty ? durationDifference(source.penaltyMs, web.penaltyMs) : 0;
    const totalDiff = source.available?.total ? durationDifference(source.totalTimeMs, web.totalTimeMs) : 0;
    if (source.available?.start && !sameWithin(startDiff, tolerance)) differences.push('Start berbeda');
    if (source.available?.finish && !sameWithin(finishDiff, tolerance)) differences.push('Finish berbeda');
    if (source.available?.elapsed && !sameWithin(elapsedDiff, tolerance)) differences.push(`Elapsed berbeda ${signedDuration(elapsedDiff, decimals)}`);
    if (source.available?.penalty && !sameWithin(penaltyDiff, tolerance)) differences.push(`Penalti berbeda ${signedDuration(penaltyDiff, decimals)}`);
    if (source.available?.total && !sameWithin(totalDiff, tolerance)) differences.push(`Total berbeda ${signedDuration(totalDiff, decimals)}`);
    if (source.available?.status && String(source.status || '').toUpperCase() !== String(web.status || '').toUpperCase()) differences.push(`Status ${source.status || '-'} vs ${web.status || '-'}`);

    return combinedRow({ key, number, runNo, source, web, sourceReference, differenceMs: source.available?.total ? totalDiff : elapsedDiff, result: differences.length ? 'BERBEDA' : 'SAMA', note: differences.length ? differences.join('; ') : `Semua bidang yang tersedia di ${sourceName} cocok.` });
  }).sort((a, b) => Number(a.number) - Number(b.number) || Number(a.runNo) - Number(b.runNo));
}

function combinedRow({ key, number, runNo, source, web, sourceReference, result, note, differenceMs = null }) {
  return {
    key, number, runNo, driver: web?.driver || source?.driver || '-',
    sourceTc: source?.tc || '', webTc: web?.tc || '', sourceStart: source?.start || '', webStart: web?.start || '', sourceFinish: source?.finish || '', webFinish: web?.finish || '',
    sourceElapsedMs: source?.elapsedMs ?? null, webElapsedMs: web?.elapsedMs ?? null, sourcePenaltyMs: source?.penaltyMs ?? null, webPenaltyMs: web?.penaltyMs ?? null,
    sourceTotalTimeMs: source?.totalTimeMs ?? null, webTotalTimeMs: web?.totalTimeMs ?? null, sourceStatus: source?.status || '', webStatus: web?.status || '',
    sourceAvailable: source?.available || {}, sourceReference, result, note, differenceMs,
  };
}

function webOnlyRow(key, web, sourceName) { return combinedRow({ key, number: web.number, runNo: web.runNo, source: null, web, sourceReference: '', result: 'HANYA DI WEB', note: `Data tidak ditemukan pada ${sourceName}.` }); }

function reportExportRow(row, sourceLabel, decimals, mode) {
  return {
    HASIL: row.result, 'NO START': row.number, RUN: mode === 'practice' ? row.runNo : '', DRIVER: row.driver,
    [`TC ${sourceLabel.toUpperCase()}`]: row.sourceTc || '', 'TC WEB': row.webTc || '', [`START ${sourceLabel.toUpperCase()}`]: row.sourceStart || '', 'START WEB': row.webStart || '',
    [`FINISH ${sourceLabel.toUpperCase()}`]: row.sourceFinish || '', 'FINISH WEB': row.webFinish || '', [`ELAPSED ${sourceLabel.toUpperCase()}`]: displayElapsed(row.sourceElapsedMs, decimals), 'ELAPSED WEB': displayElapsed(row.webElapsedMs, decimals),
    [`PENALTY ${sourceLabel.toUpperCase()}`]: displayElapsed(row.sourcePenaltyMs, decimals), 'PENALTY WEB': displayElapsed(row.webPenaltyMs, decimals), [`TOTAL ${sourceLabel.toUpperCase()}`]: displayElapsed(row.sourceTotalTimeMs, decimals), 'TOTAL WEB': displayElapsed(row.webTotalTimeMs, decimals),
    [`STATUS ${sourceLabel.toUpperCase()}`]: row.sourceStatus || '', 'STATUS WEB': row.webStatus || '', SELISIH: row.differenceMs == null ? '' : signedDuration(row.differenceMs, decimals), SUMBER: row.sourceReference || '', CATATAN: row.note,
  };
}

function filteredReportRows(data, onlyIssues) { return onlyIssues ? data.filter((row) => row.result !== 'SAMA') : data; }
function reportFileBase(fileName, mode, onlyIssues) { const safe = String(fileName || mode).replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, ''); return `rekonsiliasi-${onlyIssues ? 'bermasalah-' : ''}${safe || mode}`; }
function buildStart(row, [hour, minute]) { if (blank(row[hour]) && blank(row[minute])) return ''; if (!validPart(row[hour], 23) || !validPart(row[minute], 59)) return ''; return `${pad(row[hour])}:${pad(row[minute])}:00.000`; }
function buildFinish(row, [hour, minute, second, fraction]) { if ([hour, minute, second, fraction].every((index) => blank(row[index]))) return ''; if (!validPart(row[hour], 23) || !validPart(row[minute], 59) || !validPart(row[second], 59)) return ''; return `${pad(row[hour])}:${pad(row[minute])}:${pad(row[second])}.${fractionDigits(row[fraction])}`; }
function elapsed(start, finish) { if (!start || !finish) return null; let value = clockMs(finish) - clockMs(start); if (value < 0) value += 86400000; return value; }
function clockDifference(a, b) { if (!a && !b) return 0; if (!a || !b) return null; let value = clockMs(a) - clockMs(b); if (value > 43200000) value -= 86400000; if (value < -43200000) value += 86400000; return value; }
function durationDifference(a, b) { return a == null || b == null || !Number.isFinite(Number(a)) || !Number.isFinite(Number(b)) ? null : Number(a) - Number(b); }
function clockMs(value) { const match = String(value || '').match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?/); if (!match) return NaN; return Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + Number((match[4] || '').padEnd(3, '0')); }
function normalizeClock(value) { const match = String(value || '').match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?/); return match ? `${pad(match[1])}:${pad(match[2])}:${pad(match[3])}.${(match[4] || '').padEnd(3, '0')}` : ''; }
function sameWithin(diff, tolerance) { return diff != null && Number.isFinite(diff) && Math.abs(diff) <= tolerance; }
function signedDuration(value, decimals) { if (value == null || !Number.isFinite(value)) return 'tidak dapat dihitung'; return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatMs(Math.abs(value), decimals)}`; }
function positiveNumber(value) { const number = Number(String(value ?? '').trim()); return Number.isFinite(number) && number > 0 ? number : null; }
function validPart(value, max) { const number = Number(value); return !blank(value) && Number.isInteger(number) && number >= 0 && number <= max; }
function blank(value) { return value === '' || value == null; }
function pad(value) { return String(Number(value)).padStart(2, '0'); }
function fractionDigits(value) { const digits = String(value ?? '').replace(/\D/g, '').slice(0, 3); return digits.padEnd(3, '0'); }
function displayElapsed(value, decimals) { return value == null || !Number.isFinite(value) ? '-' : formatMs(value, decimals); }
function sessionLabel(item, mode) { if (!item) return '-'; return mode === 'practice' ? item.name : item.is_shakedown ? `Shakedown - ${item.ss_name}` : `SS ${item.ss_order} - ${item.ss_name}`; }
function Field({ label, children }) { return <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>{children}</label>; }
function Stat({ label, value, tone = 'gray' }) { const colors = { gray: 'border-gray-200', green: 'border-green-400', red: 'border-red-400', yellow: 'border-yellow-400', blue: 'border-blue-400', orange: 'border-orange-400' }; return <div className={`rounded-lg border-l-4 bg-white px-3 py-2 shadow-sm ${colors[tone]}`}><p className="text-[10px] font-black uppercase text-gray-500">{label}</p><p className="text-2xl font-black">{value}</p></div>; }
function ResultBadge({ result }) { const styles = { SAMA: 'bg-green-100 text-green-700', BERBEDA: 'bg-red-100 text-red-700', 'HANYA DI WEB': 'bg-blue-100 text-blue-700', 'TIDAK TERBACA': 'bg-orange-100 text-orange-700' }; return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[9px] font-black ${styles[result] || 'bg-yellow-100 text-yellow-800'}`}>{result}</span>; }
function CompareCell({ label, source, web, available }) { return <td className="p-2 text-center font-mono"><div className={`font-bold ${available ? 'text-gray-900' : 'text-gray-400'}`}>{label.slice(0, 1)}: {available ? source || '-' : 'N/A'}</div><div className="mt-1 text-gray-500">W: {web || '-'}</div></td>; }
