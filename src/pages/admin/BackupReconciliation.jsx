import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
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
  const [rows, setRows] = useState([]), [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [isLoading, setIsLoading] = useState(false), [message, setMessage] = useState('');
  const event = events.find((item) => item.id === eventId), decimalPlaces = event?.time_decimal_places ?? 2;

  useEffect(() => { api.get('/public/events').then((res) => { const list = res.data.data || []; setEvents(list); setEventId(list[0]?.id || ''); }).catch(() => setMessage('Gagal memuat event.')); }, []);
  useEffect(() => {
    if (!eventId) return;
    const url = mode === 'practice' ? `/public/events/${eventId}/practices` : `/public/events/${eventId}/stages`;
    api.get(url).then((res) => { const list = res.data.data || []; setSessions(list); setSessionId(list[0]?.id || ''); setRows([]); }).catch(() => { setSessions([]); setSessionId(''); });
  }, [eventId, mode]);

  const summary = useMemo(() => rows.reduce((result, row) => { result[row.result] = (result[row.result] || 0) + 1; result.total += 1; return result; }, { total: 0 }), [rows]);
  const displayedRows = showOnlyIssues ? rows.filter((row) => row.result !== 'SAMA') : rows;

  async function loadFile(file) {
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      setWorkbook(wb); setSheetName(wb.SheetNames[0] || ''); setRows([]); setMessage(`${file.name} berhasil dibaca. Pilih sheet dan tekan Bandingkan.`);
    } catch (error) { setMessage(error.message || 'File spreadsheet tidak dapat dibaca.'); }
  }

  async function compare() {
    if (!workbook || !sheetName || !sessionId) return setMessage('Pilih event, sesi, dan file spreadsheet terlebih dahulu.');
    setIsLoading(true); setMessage('');
    try {
      const XLSX = await import('xlsx');
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const spreadsheetRows = mode === 'practice' ? parsePractice(matrix) : parseSS(matrix);
      if (!spreadsheetRows.length) throw new Error('Tidak ditemukan baris dengan nomor start valid pada kolom C.');
      const webRows = mode === 'practice' ? await fetchPractice(sessionId) : await fetchSS(sessionId);
      setRows(reconcile(spreadsheetRows, webRows, decimalPlaces, mode));
      setMessage(`${spreadsheetRows.length} data spreadsheet dibandingkan dengan ${webRows.length} data web.`);
    } catch (error) { setRows([]); setMessage(error.response?.data?.error || error.message || 'Gagal membandingkan data.'); }
    finally { setIsLoading(false); }
  }

  async function fetchSS(id) {
    const res = await api.get(`/public/stages/${id}/records`);
    return (res.data.data || []).filter((r) => r.is_active !== false).map((r) => ({ key: String(r.start_number), number: r.start_number, runNo: r.attempt_no || 1, driver: r.driver_name || '-', start: normalizeClock(r.start_time), finish: normalizeClock(r.finish_time), elapsedMs: Number(r.total_time_ms || 0), status: r.status || 'OK' }));
  }
  async function fetchPractice(id) {
    const res = await api.get(`/public/practice-results/${id}`), result = res.data.data || {};
    return (result.entries || []).flatMap((entry) => (entry.runs || []).map((r) => ({ key: `${entry.practice_start_number}:${r.run_no}`, number: entry.practice_start_number, raceNumber: entry.race_start_number, runNo: r.run_no, driver: entry.driver_name || '-', start: normalizeClock(r.start_time), finish: normalizeClock(r.finish_time), elapsedMs: Number(r.elapsed_time_ms || 0), status: r.status || 'OK' })));
  }

  async function exportReport() {
    if (!rows.length) return;
    const XLSX = await import('xlsx'), wb = XLSX.utils.book_new();
    const data = rows.map((r) => ({ HASIL: r.result, 'NO START': r.number, RUN: mode === 'practice' ? r.runNo : '', DRIVER: r.driver, 'START SPREADSHEET': r.sheetStart || '', 'START WEB': r.webStart || '', 'FINISH SPREADSHEET': r.sheetFinish || '', 'FINISH WEB': r.webFinish || '', 'ELAPSED SPREADSHEET': displayElapsed(r.sheetElapsedMs, decimalPlaces), 'ELAPSED WEB': displayElapsed(r.webElapsedMs, decimalPlaces), SELISIH: r.differenceMs == null ? '' : displayElapsed(Math.abs(r.differenceMs), decimalPlaces), CATATAN: r.note }));
    const ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, ...Array(7).fill({ wch: 22 }), { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws, 'REKONSILIASI'); XLSX.writeFile(wb, `rekonsiliasi-${mode}-${sheetName.replace(/[^a-z0-9]+/gi, '-')}.xlsx`);
  }

  return <div className="space-y-5">
    <section className="rounded-xl border bg-white p-5 shadow-sm"><div><p className="text-xs font-black uppercase tracking-[.25em] text-red-600">Data Reconciliation</p><h1 className="mt-1 text-2xl font-black uppercase text-gray-900">Verifikasi Backup Spreadsheet</h1><p className="mt-1 text-sm text-gray-500">Perbandingan bersifat read-only dan tidak mengubah data web.</p></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Jenis Data"><select value={mode} onChange={(e) => setMode(e.target.value)} className="field"><option value="ss">Special Stage</option><option value="practice">Practice</option></select></Field>
        <Field label="Event"><select value={eventId} onChange={(e) => setEventId(e.target.value)} className="field">{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label={modeMap[mode].label}><select value={sessionId} onChange={(e) => { setSessionId(e.target.value); setRows([]); }} className="field">{sessions.map((item) => <option key={item.id} value={item.id}>{sessionLabel(item, mode)}</option>)}</select></Field>
        <Field label="File Spreadsheet"><label className="flex h-11 cursor-pointer items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 px-3 text-xs font-black uppercase text-gray-600 hover:border-red-400">Pilih .xlsx / .xls / .csv<input className="hidden" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => loadFile(e.target.files?.[0])}/></label></Field>
        <Field label="Sheet"><select disabled={!workbook} value={sheetName} onChange={(e) => { setSheetName(e.target.value); setRows([]); }} className="field"><option value="">Pilih sheet</option>{workbook?.SheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={isLoading || !workbook || !sessionId} onClick={compare} className="admin-btn-primary">{isLoading ? 'Membandingkan...' : 'Bandingkan Data'}</button>{message && <p className="text-sm font-semibold text-gray-600">{message}</p>}</div>
    </section>

    {rows.length > 0 && <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Total" value={summary.total}/><Stat label="Sama" value={summary.SAMA || 0} tone="green"/><Stat label="Berbeda" value={summary.BERBEDA || 0} tone="red"/><Stat label="Hanya Spreadsheet" value={summary['HANYA SPREADSHEET'] || 0} tone="yellow"/><Stat label="Hanya Web" value={summary['HANYA WEB'] || 0} tone="blue"/></section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><header className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-black uppercase">Hasil Perbandingan</h2><p className="text-xs text-gray-500">Toleransi: {decimalPlaces === 1 ? '0,1' : '0,01'} detik mengikuti pengaturan event.</p></div><div className="flex items-center gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={showOnlyIssues} onChange={(e) => setShowOnlyIssues(e.target.checked)}/> Hanya bermasalah</label><button className="admin-btn-muted" onClick={exportReport}>Download Laporan</button></div></header>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-900 text-xs uppercase text-white"><tr><th className="p-3">Hasil</th><th className="p-3">No</th>{mode === 'practice' && <th className="p-3">Run</th>}<th className="p-3 text-left">Driver</th><th className="p-3">Start Spreadsheet / Web</th><th className="p-3">Finish Spreadsheet / Web</th><th className="p-3">Elapsed Spreadsheet / Web</th><th className="p-3 text-left">Catatan</th></tr></thead><tbody>{displayedRows.map((r) => <tr key={r.key} className="border-b align-top"><td className="p-3 text-center"><ResultBadge result={r.result}/></td><td className="p-3 text-center font-black">{r.number}</td>{mode === 'practice' && <td className="p-3 text-center font-black">{r.runNo}</td>}<td className="p-3 font-bold">{r.driver}</td><CompareCell sheet={r.sheetStart} web={r.webStart}/><CompareCell sheet={r.sheetFinish} web={r.webFinish}/><CompareCell sheet={displayElapsed(r.sheetElapsedMs, decimalPlaces)} web={displayElapsed(r.webElapsedMs, decimalPlaces)}/><td className="p-3 text-xs font-semibold text-gray-600">{r.note}</td></tr>)}</tbody></table>{!displayedRows.length && <p className="p-10 text-center text-sm font-bold text-gray-500">Tidak ada data bermasalah.</p>}</div>
      </section></>}
    <style>{`.field{height:2.75rem;width:100%;border-radius:.375rem;border:1px solid #d1d5db;background:white;padding:0 .75rem;font-size:.875rem;font-weight:700;outline:none}.field:focus{border-color:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.15)}`}</style>
  </div>;
}

function parseSS(matrix) { return matrix.flatMap((row, index) => { const number = positiveNumber(row[2]); if (!number) return []; const start = buildStart(row, modeMap.ss.start), finish = buildFinish(row, modeMap.ss.finish); if (!start && !finish) return []; return [{ key: String(number), number, runNo: 1, sourceRow: index + 1, start, finish, elapsedMs: elapsed(start, finish) }]; }); }
function parsePractice(matrix) { return matrix.flatMap((row, index) => { const number = positiveNumber(row[2]); if (!number) return []; return modeMap.practice.runs.flatMap((definition) => { const start = buildStart(row, definition.start), finish = buildFinish(row, definition.finish); if (!start && !finish) return []; return [{ key: `${number}:${definition.runNo}`, number, runNo: definition.runNo, sourceRow: index + 1, start, finish, elapsedMs: elapsed(start, finish) }]; }); }); }
function reconcile(sheetRows, webRows, decimals, mode) {
  const sheetMap = new Map(sheetRows.map((r) => [r.key, r])), webMap = new Map(webRows.map((r) => [mode === 'practice' ? r.key : String(r.number), r]));
  return [...new Set([...sheetMap.keys(), ...webMap.keys()])].map((key) => {
    const sheet = sheetMap.get(key), web = webMap.get(key), number = sheet?.number ?? web?.number, runNo = sheet?.runNo ?? web?.runNo;
    if (!sheet) return { key, number, runNo, driver: web.driver, webStart: web.start, webFinish: web.finish, webElapsedMs: web.elapsedMs, result: 'HANYA WEB', note: 'Data tidak ditemukan pada spreadsheet.' };
    if (!web) return { key, number, runNo, driver: '-', sheetStart: sheet.start, sheetFinish: sheet.finish, sheetElapsedMs: sheet.elapsedMs, result: 'HANYA SPREADSHEET', note: `Belum ditemukan di web; baris ${sheet.sourceRow}.` };
    const tolerance = decimals === 1 ? 100 : 10, startDiff = clockDifference(sheet.start, web.start), finishDiff = clockDifference(sheet.finish, web.finish), elapsedDiff = !sheet.finish && !web.finish ? 0 : sheet.elapsedMs != null && web.finish ? sheet.elapsedMs - web.elapsedMs : null;
    const differences = []; if (!sameWithin(startDiff, tolerance)) differences.push('Start berbeda'); if (!sameWithin(finishDiff, tolerance)) differences.push('Finish berbeda'); if (!sameWithin(elapsedDiff, tolerance)) differences.push('Elapsed berbeda');
    return { key, number, runNo, driver: web.driver, sheetStart: sheet.start, webStart: web.start, sheetFinish: sheet.finish, webFinish: web.finish, sheetElapsedMs: sheet.elapsedMs, webElapsedMs: web.elapsedMs, differenceMs: elapsedDiff, result: differences.length ? 'BERBEDA' : 'SAMA', note: differences.length ? `${differences.join(', ')}; spreadsheet baris ${sheet.sourceRow}.` : `Cocok; spreadsheet baris ${sheet.sourceRow}.` };
  }).sort((a, b) => Number(a.number) - Number(b.number) || Number(a.runNo) - Number(b.runNo));
}
function buildStart(row, [hour, minute]) { if (blank(row[hour]) && blank(row[minute])) return ''; if (!validPart(row[hour], 23) || !validPart(row[minute], 59)) return ''; return `${pad(row[hour])}:${pad(row[minute])}:00.000`; }
function buildFinish(row, [hour, minute, second, fraction]) { if ([hour, minute, second, fraction].every((i) => blank(row[i]))) return ''; if (!validPart(row[hour], 23) || !validPart(row[minute], 59) || !validPart(row[second], 59)) return ''; return `${pad(row[hour])}:${pad(row[minute])}:${pad(row[second])}.${fractionDigits(row[fraction])}`; }
function elapsed(start, finish) { if (!start || !finish) return null; let value = clockMs(finish) - clockMs(start); if (value < 0) value += 86400000; return value; }
function clockDifference(a, b) { if (!a && !b) return 0; if (!a || !b) return null; let value = clockMs(a) - clockMs(b); if (value > 43200000) value -= 86400000; if (value < -43200000) value += 86400000; return value; }
function clockMs(value) { const match = String(value || '').match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?/); if (!match) return NaN; return Number(match[1]) * 3600000 + Number(match[2]) * 60000 + Number(match[3]) * 1000 + Number((match[4] || '').padEnd(3, '0')); }
function normalizeClock(value) { const match = String(value || '').match(/(\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?/); return match ? `${pad(match[1])}:${pad(match[2])}:${pad(match[3])}.${(match[4] || '').padEnd(3, '0')}` : ''; }
function sameWithin(diff, tolerance) { return diff != null && Number.isFinite(diff) && Math.abs(diff) < tolerance; }
function positiveNumber(value) { const number = Number(String(value ?? '').trim()); return Number.isFinite(number) && number > 0 ? number : null; }
function validPart(value, max) { const number = Number(value); return !blank(value) && Number.isInteger(number) && number >= 0 && number <= max; }
function blank(value) { return value === '' || value == null; }
function pad(value) { return String(Number(value)).padStart(2, '0'); }
function fractionDigits(value) { const digits = String(value ?? '').replace(/\D/g, '').slice(0, 3); return digits.padEnd(3, '0'); }
function displayElapsed(value, decimals) { return value == null || !Number.isFinite(value) ? '-' : formatMs(value, decimals); }
function sessionLabel(item, mode) { return mode === 'practice' ? item.name : item.is_shakedown ? `Shakedown - ${item.ss_name}` : `SS ${item.ss_order} - ${item.ss_name}`; }
function Field({ label, children }) { return <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>{children}</label>; }
function Stat({ label, value, tone = 'gray' }) { const colors = { gray: 'border-gray-200', green: 'border-green-400', red: 'border-red-400', yellow: 'border-yellow-400', blue: 'border-blue-400' }; return <div className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${colors[tone]}`}><p className="text-xs font-black uppercase text-gray-500">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>; }
function ResultBadge({ result }) { const style = result === 'SAMA' ? 'bg-green-100 text-green-700' : result === 'BERBEDA' ? 'bg-red-100 text-red-700' : result === 'HANYA WEB' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-800'; return <span className={`inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-black ${style}`}>{result}</span>; }
function CompareCell({ sheet, web }) { return <td className="p-3 text-center font-mono text-xs"><div className="font-bold text-gray-900">S: {sheet || '-'}</div><div className="mt-1 text-gray-500">W: {web || '-'}</div></td>; }
