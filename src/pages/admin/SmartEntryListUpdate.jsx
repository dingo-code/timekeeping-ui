import { useMemo, useState } from 'react';
import api from '../../services/api';
import { parseEntryListPDF } from '../../utils/entryListPdf';
import { analyzeRows, findImportedRacer, getReviewIssues, validateReview } from '../../utils/entryListMatching';

const DEFAULT_DOB = '1900-01-01';

export default function SmartEntryListUpdate({ eventId, participants, racers, teams, vehicles, classes, categories, regions, onApplied }) {
  const [sourceRows, setSourceRows] = useState([]), [matches, setMatches] = useState([]);
  const [fileName, setFileName] = useState(''), [step, setStep] = useState('upload'), [busy, setBusy] = useState(false), [filter, setFilter] = useState('all');
  const participantDetails = useMemo(() => participants.map((p) => ({ ...p, driver: racers.find((r) => r.id === p.driver_id), navigator: racers.find((r) => r.id === p.codriver_id), vehicle: vehicles.find((v) => v.id === p.vehicle_id) })), [participants, racers, vehicles]);
  const reviewed = useMemo(() => analyzeRows(sourceRows, participantDetails), [sourceRows, participantDetails]);
  const activeMatches = matches.length ? matches : reviewed;
  const issues = getReviewIssues(activeMatches, participantDetails);
  const conflicts = [...new Set(issues.map((issue) => issue.message))];
  const issueRowKeys = new Set(issues.map((issue) => issue.rowKey));
  const mappedParticipantIds = new Set(activeMatches.map((row) => row.participantId).filter(Boolean));
  const unmappedParticipants = participantDetails.filter((participant) => !mappedParticipantIds.has(participant.id));
  const stats = activeMatches.reduce((s, row) => { const key = row.kind === 'confirmed-new' ? 'new' : row.kind; s[key] = (s[key] || 0) + 1; return s; }, {});
  const visible = filter === 'all' ? activeMatches : activeMatches.filter((row) => row.kind === filter || (filter === 'new' && row.kind === 'confirmed-new') || (filter === 'issue' && issueRowKeys.has(row.key)));

  async function readFile(file) {
    if (!file) return;
    setBusy(true);
    try {
      const rows = file.name.toLowerCase().endsWith('.pdf') ? await parseEntryListPDF(file) : await parseWorkbook(file);
      if (!rows.length) throw new Error('Tidak ditemukan baris Entry List yang dapat dibaca.');
      setFileName(file.name); setSourceRows(rows); setMatches([]); setStep('review');
    } catch (error) { alert(error.message || 'File tidak dapat dibaca.'); }
    finally { setBusy(false); }
  }

  function changeMatch(rowKey, participantId) {
    const base = matches.length ? matches : reviewed;
    setMatches(base.map((row) => row.key === rowKey ? { ...row, participantId, kind: participantId ? 'matched' : 'new', confidence: participantId ? 'manual' : 'new' } : row));
  }
  function confirmNew(rowKey) {
    const base = matches.length ? matches : reviewed;
    setMatches(base.map((row) => row.key === rowKey ? { ...row, participantId: '', kind: 'confirmed-new', confidence: 'Dikonfirmasi Baru' } : row));
  }

  async function applyUpdate() {
    const current = matches.length ? matches : reviewed, errors = validateReview(current, participantDetails);
    if (errors.length) return alert(`Selesaikan konflik terlebih dahulu:\n${errors.slice(0, 8).join('\n')}`);
    if (!window.confirm(`Terapkan ${current.length} baris dari ${fileName}?\n\nPeserta lama dipertahankan berdasarkan ID. Peserta yang tidak ada di file tidak akan dihapus.`)) return;
    setBusy(true);
    try {
      const cache = { racers: [...racers], teams: [...teams], vehicles: [...vehicles], regions: [...regions] };
      let updated = 0, created = 0;
      for (const [index, item] of current.entries()) {
        const oldParticipant = participants.find((p) => p.id === item.participantId);
        const driver = await ensureRacer(item.data.driver, item.data.driverRegion, oldParticipant?.driver_id, true, cache);
        const navigator = await ensureRacer(item.data.navigator, item.data.navigatorRegion, oldParticipant?.codriver_id, false, cache);
        const teamId = await ensureTeam(item.data.entrant, cache);
        const vehicleId = await ensureVehicle(item.data.car, item.data.type, cache);
        const classItem = classes.find((c) => norm(c.code) === norm(item.data.classCode) || norm(c.name) === norm(item.data.classCode));
        const categoryItem = categories.find((c) => norm(c.code) === norm(item.data.categoryCode) || norm(c.description) === norm(item.data.categoryCode));
        if (!classItem) throw new Error(`Class ${item.data.classCode} untuk No ${item.data.startNumber} belum ada di master.`);
        if (!categoryItem) throw new Error(`Category ${item.data.categoryCode} untuk No ${item.data.startNumber} belum ada di master.`);
        const payload = { entry_order: item.data.entryOrder || index + 1, start_number: item.data.startNumber, entrant_name: item.data.entrant === '-' || item.data.entrant === '–' ? '' : item.data.entrant, driver_id: driver.id, codriver_id: navigator.id, team_id: teamId, vehicle_id: vehicleId, join_car_with_participant_id: oldParticipant?.join_car_with_participant_id || '', class_id: classItem.id, category_id: categoryItem.id };
        if (oldParticipant) { await api.put(`/admin/events/${eventId}/participants/${oldParticipant.id}`, payload); updated++; }
        else { await api.post(`/admin/events/${eventId}/participants`, payload); created++; }
      }
      await onApplied?.(); setStep('done'); alert(`Update selesai: ${updated} peserta diperbarui, ${created} peserta baru. Data Practice peserta lama tetap terhubung.`);
    } catch (error) { alert(error.response?.data?.error || error.message || 'Gagal menerapkan update.'); }
    finally { setBusy(false); }
  }

  async function ensureRegion(name, cache) {
    if (!name || name === '-') return '';
    let found = cache.regions.find((r) => norm(r.name) === norm(name) || norm(r.code) === norm(name));
    if (found) return found.id;
    const res = await api.post('/admin/regions', { name }); found = res.data.data; cache.regions.push(found); return found.id;
  }
  async function ensureRacer(name, regionName, existingId, isDriver, cache) {
    const existing = findImportedRacer(cache.racers, name, existingId);
    const regionId = await ensureRegion(regionName, cache);
    if (existing) {
      const payload = { kis_number: existing.kis_number, full_name: name || existing.full_name, gender: existing.gender || 'L', dob: dateOnly(existing.dob) || DEFAULT_DOB, blood_type: existing.blood_type || 'O', region_id: regionId || existing.region_id || '', is_driver: isDriver || Boolean(existing.is_driver), is_codriver: !isDriver || Boolean(existing.is_codriver) };
      const changed = norm(existing.full_name) !== norm(payload.full_name) || (regionId && regionId !== existing.region_id) || (isDriver && !existing.is_driver) || (!isDriver && !existing.is_codriver);
      if (changed) await api.put(`/admin/racers/${existing.id}`, payload);
      Object.assign(existing, payload); return existing;
    }
    const payload = { kis_number: `AUTO-${isDriver ? 'D' : 'N'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, full_name: name, gender: 'L', dob: DEFAULT_DOB, blood_type: 'O', region_id: regionId, is_driver: isDriver, is_codriver: !isDriver };
    const res = await api.post('/admin/racers', payload), created = res.data.data; cache.racers.push(created); return created;
  }
  async function ensureTeam(name, cache) {
    if (!name || name === '-' || name === '–') return '';
    let found = cache.teams.find((t) => norm(t.name) === norm(name)); if (found) return found.id;
    const res = await api.post('/admin/teams', { name, manager_name: '' }); found = res.data.data; cache.teams.push(found); return found.id;
  }
  async function ensureVehicle(brand, type, cache) {
    const label = `${brand || ''} ${type || ''}`.trim();
    let found = cache.vehicles.find((v) => norm(`${v.brand || ''} ${v.type || ''}`) === norm(label)); if (found) return found.id;
    const res = await api.post('/admin/vehicles', { brand: brand || label, type: type || '', engine_capacity: 0 }); found = res.data.data; cache.vehicles.push(found); return found.id;
  }

  if (step === 'upload') return <UploadPanel busy={busy} onFile={readFile}/>;
  if (step === 'done') return <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center"><h3 className="text-xl font-black text-green-800">Update Entry List Selesai</h3><p className="mt-2 text-sm text-green-700">Data peserta telah dimuat ulang. Relasi peserta lama tetap menggunakan Participant ID yang sama.</p><button className="admin-btn-primary mt-5" onClick={() => { setStep('upload'); setSourceRows([]); setMatches([]); }}>Upload File Lain</button></div>;
  return <div className="space-y-4">
    <div className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-red-600">Review & Matching</p><h3 className="text-xl font-black">{fileName}</h3><p className="text-xs text-gray-500">Periksa baris ambigu sebelum menerapkan. Peserta lama yang dipilih akan mempertahankan data Practice.</p></div><div className="flex gap-2"><button className="admin-btn-muted" onClick={() => { setStep('upload'); setSourceRows([]); setMatches([]); }}>Ganti File</button><button disabled={busy || conflicts.length > 0} className="admin-btn-primary" onClick={applyUpdate}>{busy ? 'Menerapkan...' : 'Terapkan Update'}</button></div></div>
      {conflicts.length > 0 && (
        <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <p>{conflicts.length} konflik harus diselesaikan sebelum update diterapkan.</p>
          <p className="mt-1 font-normal">Buka filter Bermasalah untuk memeriksa peserta berikut.</p>
          <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
            {conflicts.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}
    </div>
    <div className="grid gap-3 sm:grid-cols-4"><Stat label="Total" value={activeMatches.length}/><Stat label="Cocok" value={stats.matched || 0} tone="green"/><Stat label="Peserta Baru" value={stats.new || 0} tone="blue"/><Stat label="Perlu Review" value={issueRowKeys.size} tone="red"/></div>
    {unmappedParticipants.length > 0 && (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-black">Peserta lama belum dipetakan ({unmappedParticipants.length})</p>
        <p className="mt-1 text-xs">Jika ada penggantian peserta pada entri yang sama, pilih entri lama tersebut pada dropdown peserta penggantinya. Participant ID dan relasi Practice akan dipertahankan. Entri yang tidak dipetakan tetap disimpan.</p>
        <ul className="mt-2 list-disc pl-5 text-xs font-bold">
          {unmappedParticipants.map((participant) => <li key={participant.id}>#{participant.start_number} — {participant.driver?.full_name || '-'} / {participant.navigator?.full_name || '-'}</li>)}
        </ul>
      </div>
    )}
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap gap-2 border-b p-3">{[['all','Semua'],['matched','Cocok'],['new','Baru'],['issue','Bermasalah']].map(([value,label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded px-3 py-2 text-xs font-black uppercase ${filter === value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>)}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-xs uppercase text-white">
            <tr><th className="p-3">No Urut</th><th className="p-3">No Baru</th><th className="p-3 text-left">Data File</th><th className="p-3 text-left">Dipetakan ke Peserta Lama</th><th className="p-3">Keyakinan</th></tr>
          </thead>
          <tbody>{visible.map((row) => (
            <tr key={row.key} className={`border-b ${issueRowKeys.has(row.key) ? 'bg-red-50' : ''}`}>
              <td className="p-3 text-center font-bold text-gray-500">{row.data.entryOrder || activeMatches.indexOf(row) + 1}</td>
              <td className="p-3 text-center text-xl font-black">{row.data.startNumber}</td>
              <td className="p-3">
                <b>{row.data.driver}</b>
                <span className="block text-xs text-gray-500">{row.data.navigator} · {row.data.entrant || 'Tanpa team'}</span>
                <span className="block text-xs text-gray-400">{row.data.classCode}/{row.data.categoryCode} · {row.data.car} {row.data.type}</span>
                {issues.filter((issue) => issue.rowKey === row.key).map((issue) => (
                  <p key={issue.message} className="mt-1 text-xs font-bold text-red-700">{issue.message}</p>
                ))}
              </td>
              <td className="p-3">
                <select aria-label={`Peserta lama untuk nomor ${row.data.startNumber}`} value={row.participantId || ''} onChange={(e) => changeMatch(row.key, e.target.value)} className="w-full min-w-72 rounded border p-2 text-sm">
                  <option value="">+ Peserta baru</option>
                  {participantDetails.map((p) => <option key={p.id} value={p.id}>#{p.start_number} — {p.driver?.full_name || '-'} / {p.navigator?.full_name || '-'}</option>)}
                </select>
              </td>
              <td className="p-3 text-center">{row.kind === 'new' ? <button onClick={() => confirmNew(row.key)} className="rounded bg-red-600 px-2 py-1 text-[10px] font-black uppercase text-white">Konfirmasi Baru</button> : <MatchBadge row={row}/>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  </div>;
}

function UploadPanel({ busy, onFile }) { return <div className="rounded-xl border bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">⇧</div><h3 className="mt-4 text-xl font-black uppercase">Smart Update Entry List</h3><p className="mx-auto mt-2 max-w-2xl text-sm text-gray-500">Upload PDF tabel dari panitia atau Excel/CSV. Sistem hanya membuat preview dan belum mengubah database.</p><label className={`admin-btn-primary mt-6 inline-flex cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>{busy ? 'Membaca File...' : 'Pilih PDF / Excel'}<input type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }}/></label><div className="mx-auto mt-6 grid max-w-3xl gap-3 text-left sm:grid-cols-3"><Info title="1. Upload" text="File dibaca lokal tanpa mengubah database."/><Info title="2. Review" text="Cek pencocokan peserta dan konflik nomor."/><Info title="3. Terapkan" text="Update peserta lama dan tambah peserta baru."/></div></div>; }

async function parseWorkbook(file) {
  const XLSX = await import('xlsx'), wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }), sheet = wb.Sheets[wb.SheetNames[0]], rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  return rows.map((row) => ({ entryOrder: number(cell(row, ['NO URUT','ENTRY ORDER'])), participantId: cell(row, ['PARTICIPANT ID','ENTRY ID']), startNumber: number(cell(row, ['NO START','CAR NO','START NO'])), entrant: text(cell(row, ['ENTRANT','TEAM','TIM'])), driver: text(cell(row, ['DRIVER','NAMA DRIVER'])), driverRegion: text(cell(row, ['DRIVER REGION','REG DRIVER'])), navigator: text(cell(row, ['NAVIGATOR','CODRIVER','CO DRIVER'])), navigatorRegion: text(cell(row, ['NAVIGATOR REGION','REG NAVIGATOR'])), classCode: text(cell(row, ['CLASS','CLS'])), categoryCode: text(cell(row, ['CATEGORY','CAT'])), car: text(cell(row, ['BRAND','MERK'])) || text(cell(row, ['CAR','VEHICLE','KENDARAAN'])), type: text(cell(row, ['TYPE','TIPE'])) })).filter(validSourceRow).map((row, index) => ({ ...row, entryOrder: row.entryOrder || index + 1 }));
}
function validSourceRow(row) { return row.startNumber > 0 && row.driver && row.navigator && row.classCode && row.categoryCode; }
function cell(row, headers) { for (const [key,value] of Object.entries(row || {})) if (headers.some((h) => norm(h) === norm(key))) return value; return ''; }
function norm(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim(); }
function text(value) { return String(value || '').trim().replace(/\s+/g,' '); }
function number(value) { const parsed = Number(String(value || '').trim()); return Number.isInteger(parsed) && parsed > 0 ? parsed : 0; }
function dateOnly(value) { return String(value || '').slice(0,10); }
function MatchBadge({ row }) { const style = row.kind === 'matched' ? 'bg-green-100 text-green-700' : row.kind === 'confirmed-new' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'; return <span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${style}`}>{row.confidence}</span>; }
function Stat({ label, value, tone='gray' }) { const color = { gray:'border-gray-300',green:'border-green-400',blue:'border-blue-400',red:'border-red-400' }[tone]; return <div className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${color}`}><p className="text-xs font-black uppercase text-gray-500">{label}</p><p className="text-3xl font-black">{value}</p></div>; }
function Info({ title, text: body }) { return <div className="rounded-lg bg-gray-50 p-3"><b className="text-xs uppercase text-gray-900">{title}</b><p className="mt-1 text-xs text-gray-500">{body}</p></div>; }
