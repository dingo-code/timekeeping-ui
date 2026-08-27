import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [eventId, setEventId] = useState('');
  const [participants, setParticipants] = useState([]);
  const [stages, setStages] = useState([]);
  const [practices, setPractices] = useState([]);
  const [stageStats, setStageStats] = useState([]);
  const [practiceEntryCount, setPracticeEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/admin/events'), api.get('/admin/users')])
      .then(([eventResponse, userResponse]) => {
        if (!active) return;
        const nextEvents = eventResponse.data.data || [];
        setEvents(nextEvents);
        setUsers(userResponse.data.data || []);
        const activeEvent = nextEvents.find((item) => item.is_active) || nextEvents[0];
        setEventId(activeEvent?.id || '');
      })
      .catch((requestError) => setError(requestError.response?.data?.error || 'Gagal memuat dashboard.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!eventId) return undefined;

    let active = true;
    Promise.all([
      api.get(`/events/${eventId}/participants`),
      api.get(`/events/${eventId}/stages`),
      api.get(`/practices/events/${eventId}`),
    ])
      .then(async ([participantResponse, stageResponse, practiceResponse]) => {
        if (!active) return;
        const nextParticipants = participantResponse.data.data || [];
        const nextStages = stageResponse.data.data || [];
        const nextPractices = practiceResponse.data.data || [];
        setParticipants(nextParticipants);
        setStages(nextStages);
        setPractices(nextPractices);

        const [recordResults, practiceResults] = await Promise.all([
          Promise.allSettled(nextStages.map((stage) => api.get(`/public/stages/${stage.id}/records`))),
          Promise.allSettled(nextPractices.map((practice) => api.get(`/admin/practices/${practice.id}/entries`))),
        ]);
        if (!active) return;
        setStageStats(nextStages.map((stage, index) => {
          const result = recordResults[index];
          const records = result?.status === 'fulfilled' ? result.value.data.data || [] : [];
          const activeRecords = records.filter((record) => record.is_active !== false);
          return summarizeStage(stage, activeRecords, nextParticipants.length);
        }));
        setPracticeEntryCount(practiceResults.reduce((total, result) => (
          total + (result.status === 'fulfilled' ? (result.value.data.data || []).filter((entry) => entry.is_active !== false).length : 0)
        ), 0));
      })
      .catch((requestError) => setError(requestError.response?.data?.error || 'Gagal memuat ringkasan event.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [eventId]);

  const selectedEvent = events.find((item) => item.id === eventId);
  const assignedOfficers = users.filter((user) => user.event_id === eventId && user.role !== 'admin');
  const openStages = stages.filter((stage) => stage.is_open).length;
  const openPractices = practices.filter((practice) => practice.is_open).length;
  const totalStarted = stageStats.reduce((total, item) => total + item.started, 0);
  const totalFinished = stageStats.reduce((total, item) => total + item.finished, 0);
  const attentionCount = stageStats.reduce((total, item) => total + item.attention, 0);

  const readiness = useMemo(() => [
    { label: 'Identitas dan jadwal event', done: Boolean(selectedEvent?.name && selectedEvent?.start_date && selectedEvent?.end_date && selectedEvent?.location), link: `/admin/event/${eventId}` },
    { label: 'Point system dipilih', done: Boolean(selectedEvent?.point_system_id), link: '/admin/event/point-systems' },
    { label: 'Entry List tersedia', done: participants.length > 0, link: `/admin/event/${eventId}` },
    { label: 'Special Stage tersedia', done: stages.length > 0, link: `/admin/event/${eventId}` },
    { label: 'Petugas event ditugaskan', done: assignedOfficers.length > 0, link: '/admin/users' },
    { label: 'Peserta Practice disiapkan', done: practices.length === 0 || practiceEntryCount > 0, link: `/admin/event/${eventId}` },
  ], [selectedEvent, eventId, participants.length, stages.length, assignedOfficers.length, practices.length, practiceEntryCount]);
  const readinessDone = readiness.filter((item) => item.done).length;
  const readinessPercent = Math.round((readinessDone / readiness.length) * 100);

  const warnings = [
    participants.length === 0 && { title: 'Entry List masih kosong', detail: 'Import atau tambahkan peserta sebelum menyiapkan starting list.', link: `/admin/event/${eventId}` },
    stages.length === 0 && { title: 'Special Stage belum dibuat', detail: 'Tambahkan SS agar input waktu dapat digunakan.', link: `/admin/event/${eventId}` },
    assignedOfficers.length === 0 && { title: 'Belum ada petugas event', detail: 'Hubungkan user Start, TC, Finish, atau Kamar Hitung ke event ini.', link: '/admin/users' },
    practices.length > 0 && practiceEntryCount === 0 && { title: 'Peserta Practice belum disiapkan', detail: 'Sesi sudah dibuat tetapi belum memiliki peserta.', link: `/admin/event/${eventId}` },
    attentionCount > 0 && { title: `${attentionCount} input perlu diperiksa`, detail: 'Ada peserta yang sudah Start tetapi belum memiliki Finish.', link: '/monitoring-input', external: true },
  ].filter(Boolean);

  if (!loading && events.length === 0) return <EmptyDashboard />;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl bg-gray-950 text-white shadow-sm">
        <div className="grid gap-5 p-6 lg:grid-cols-[1fr_340px] lg:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-red-400">Race Control Overview</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Dashboard Operasional</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">Pantau kesiapan event dan progres input waktu dari satu halaman.</p>
          </div>
          <label>
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-500">Event yang dipantau</span>
            <select value={eventId} onChange={(event) => { setLoading(true); setError(''); setEventId(event.target.value); }} className="h-12 w-full rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-bold text-white outline-none focus:border-red-500">
              {events.map((event) => <option className="text-gray-900" key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 bg-white/[0.04] px-6 py-3 text-xs font-semibold text-gray-400">
          <span>{formatEventDate(selectedEvent)}</span>
          <span>{selectedEvent?.location || 'Lokasi belum diisi'}</span>
          <span className={selectedEvent?.is_active ? 'text-emerald-400' : 'text-gray-500'}>{selectedEvent?.is_active ? '● Event aktif' : '○ Event tidak aktif'}</span>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Entry List" value={participants.length} note="peserta terdaftar" icon="users" tone="red" loading={loading} />
        <MetricCard label="Special Stage" value={stages.length} note={`${openStages} SS sedang dibuka`} icon="flag" tone="blue" loading={loading} />
        <MetricCard label="Practice" value={practices.length} note={`${openPractices} sesi sedang dibuka`} icon="timer" tone="amber" loading={loading} />
        <MetricCard label="Petugas" value={assignedOfficers.length} note="user terhubung ke event" icon="shield" tone="emerald" loading={loading} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Kesiapan Event" subtitle={`${readinessDone} dari ${readiness.length} komponen siap`}>
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-xs font-black"><span>PROGRES</span><span>{readinessPercent}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-red-600 transition-all" style={{ width: `${readinessPercent}%` }} /></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {readiness.map((item) => (
              <Link key={item.label} to={item.link} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-gray-300 hover:bg-gray-50">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black ${item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.done ? '✓' : '!'}</span>
                <span className="text-sm font-bold text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Perlu Perhatian" subtitle={warnings.length ? `${warnings.length} kondisi perlu ditindaklanjuti` : 'Semua kondisi utama terlihat normal'}>
          {warnings.length ? <div className="space-y-2">{warnings.map((warning) => (
            warning.external ? <a key={warning.title} href={warning.link} target="_blank" rel="noreferrer" className="block rounded-xl border border-amber-200 bg-amber-50 p-3 transition hover:border-amber-400">{warningContent(warning)}</a>
              : <Link key={warning.title} to={warning.link} className="block rounded-xl border border-amber-200 bg-amber-50 p-3 transition hover:border-amber-400">{warningContent(warning)}</Link>
          ))}</div> : <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 text-center"><span className="text-2xl text-emerald-600">✓</span><p className="mt-2 text-sm font-black text-emerald-800">Tidak ada peringatan utama</p><p className="text-xs text-emerald-600">Event siap untuk dijalankan.</p></div>}
        </Panel>
      </section>

      <Panel title="Monitoring Special Stage" subtitle={`${totalStarted} Start · ${totalFinished} Finish · ${attentionCount} perlu diperiksa`} action={<a href="/monitoring-input" target="_blank" rel="noreferrer" className="text-xs font-black text-red-600 hover:text-red-700">BUKA MONITORING →</a>}>
        {stageStats.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{stageStats.map((item) => <StageCard key={item.id} item={item} />)}</div> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-gray-500">Belum ada Special Stage pada event ini.</div>}
      </Panel>

      <Panel title="Akses Cepat" subtitle="Menu yang paling sering digunakan saat persiapan dan pelaksanaan event">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to={`/admin/event/${eventId}`} icon="edit" title="Kelola Event" detail="Entry List, SS, Practice" />
          <QuickLink href="/monitoring-input" icon="pulse" title="Monitoring Input" detail="Pantau Start dan Finish" />
          <QuickLink href="/live-timing" icon="live" title="Live Timing" detail="Lihat hasil sementara" />
          <QuickLink to="/admin/results/print" icon="print" title="Cetak Result" detail="Siapkan hasil perlombaan" />
        </div>
      </Panel>
    </div>
  );
}

function summarizeStage(stage, records, participantCount) {
  const startedIds = new Set(records.filter((record) => record.start_time).map(recordParticipantKey));
  const finishedIds = new Set(records.filter((record) => record.finish_time).map(recordParticipantKey));
  const attention = [...startedIds].filter((id) => !finishedIds.has(id)).length;
  return { ...stage, started: startedIds.size, finished: finishedIds.size, attention, pending: Math.max(0, participantCount - startedIds.size) };
}

function recordParticipantKey(record) { return record.participant_id || record.start_number; }

function MetricCard({ label, value, note, icon, tone, loading }) {
  const tones = { red: 'bg-red-50 text-red-600', blue: 'bg-blue-50 text-blue-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600' };
  return <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p><p className="mt-2 text-3xl font-black text-gray-900">{loading ? '—' : value}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><DashboardIcon name={icon} /></span></div><p className="mt-3 text-xs font-semibold text-gray-500">{note}</p></div>;
}

function Panel({ title, subtitle, action, children }) {
  return <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="font-black text-gray-900">{title}</h2><p className="mt-1 text-xs text-gray-500">{subtitle}</p></div>{action}</div>{children}</section>;
}

function StageCard({ item }) {
  const percentage = item.started ? Math.round((item.finished / item.started) * 100) : 0;
  return <div className="rounded-xl border border-gray-200 p-4"><div className="flex items-start justify-between"><div><p className="font-black text-gray-900">SS {item.ss_order} · {item.ss_name}</p><p className="mt-1 text-xs text-gray-500">{item.distance_km || 0} km</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${item.is_open ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{item.is_open ? 'Open' : 'Close'}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><StageStat label="Start" value={item.started} /><StageStat label="Finish" value={item.finished} /><StageStat label="Pending" value={item.pending} warning={item.attention > 0} /></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-red-600" style={{ width: `${percentage}%` }} /></div>{item.attention > 0 && <p className="mt-2 text-[11px] font-bold text-amber-600">⚠ {item.attention} sudah Start, belum Finish</p>}</div>;
}

function StageStat({ label, value, warning }) { return <div className={`rounded-lg p-2 ${warning ? 'bg-amber-50' : 'bg-gray-50'}`}><p className="text-lg font-black text-gray-900">{value}</p><p className="text-[9px] font-black uppercase tracking-wider text-gray-400">{label}</p></div>; }

function QuickLink({ to, href, icon, title, detail }) {
  const className = 'group flex items-center gap-3 rounded-xl border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md';
  const content = <><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-white transition group-hover:bg-red-600"><DashboardIcon name={icon} /></span><span><span className="block text-sm font-black text-gray-900">{title}</span><span className="block text-xs text-gray-500">{detail}</span></span></>;
  return href ? <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a> : <Link to={to} className={className}>{content}</Link>;
}

function DashboardIcon({ name }) {
  const paths = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    flag: <><path d="M5 22V4"/><path d="M5 4h13l-2 4 2 4H5"/></>, timer: <><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></>, shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>, pulse: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>, live: <><path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7"/><circle cx="12" cy="12" r="1"/></>, print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></>,
  };
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function warningContent(warning) { return <div className="flex gap-3"><span className="font-black text-amber-600">!</span><span><span className="block text-sm font-black text-gray-900">{warning.title}</span><span className="mt-0.5 block text-xs text-gray-600">{warning.detail}</span></span></div>; }

function formatEventDate(event) {
  if (!event?.start_date) return 'Tanggal belum diisi';
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const start = new Date(event.start_date).toLocaleDateString('id-ID', options);
  const end = event.end_date ? new Date(event.end_date).toLocaleDateString('id-ID', options) : start;
  return start === end ? start : `${start} – ${end}`;
}

function EmptyDashboard() {
  return <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center"><div><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-600">🏁</span><h1 className="mt-4 text-xl font-black text-gray-900">Belum ada event</h1><p className="mt-1 text-sm text-gray-500">Buat event pertama untuk mulai menggunakan dashboard operasional.</p><Link to="/admin/event" className="admin-btn-primary mt-5 inline-flex">Buat Event</Link></div></div>;
}
