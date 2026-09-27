import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function ParcFerme() {
  const navigate = useNavigate();
  const { role, eventId, eventName, username, logout } = useAuthStore();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(eventId || '');
  const [participants, setParticipants] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/admin/events')
      .then((response) => {
        const availableEvents = response.data.data || [];
        setEvents(availableEvents);
        setSelectedEventId((current) => current || availableEvents[0]?.id || '');
      })
      .catch((requestError) => setError(requestError.response?.data?.error || 'Gagal memuat event.'));
  }, [isAdmin]);

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);
  const locked = String(selectedEvent?.result_status || '').toUpperCase() === 'LOCKED';

  const refresh = useCallback(async (silent = false) => {
    if (!selectedEventId) {
      setParticipants([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const response = await api.get(`/parc-ferme/events/${selectedEventId}/participants`);
      setParticipants(response.data.data || []);
      setLastUpdated(new Date());
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Gagal memuat daftar peserta.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedEventId]);

  useEffect(() => {
    refresh();
    if (!selectedEventId) return undefined;
    const timer = window.setInterval(() => refresh(true), 10000);
    return () => window.clearInterval(timer);
  }, [refresh, selectedEventId]);

  const confirmParticipant = async (participant) => {
    if (participant.parc_ferme_confirmed || savingId || locked) return;
    const number = participant.start_number;
    if (!window.confirm(`Konfirmasi mobil nomor ${number} sudah masuk Parc Fermé? Konfirmasi ini tidak dapat dibatalkan.`)) return;
    setSavingId(participant.participant_id);
    try {
      await api.post(`/parc-ferme/events/${selectedEventId}/participants/${participant.participant_id}/confirm`);
      setParticipants((current) => current.map((item) => item.participant_id === participant.participant_id
        ? { ...item, parc_ferme_confirmed: true, confirmed_by: username, confirmed_at: new Date().toISOString() }
        : item));
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Konfirmasi gagal disimpan.');
    } finally {
      setSavingId('');
    }
  };

  const visibleParticipants = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return participants;
    return participants.filter((participant) => [participant.start_number, participant.entrant_name, participant.driver_name, participant.co_driver_name, participant.vehicle_name, participant.class_name]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [participants, search]);
  const confirmedCount = participants.filter((participant) => participant.parc_ferme_confirmed).length;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-600">Race Control</p>
            <h1 className="mt-1 text-xl font-black uppercase text-slate-900">Parc Fermé</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">{isAdmin ? (selectedEvent?.name || 'Pilih event') : (eventName || 'Event')} · {username}</p>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-red-700">Logout</button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {isAdmin && (
          <label className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Event</span>
            <select value={selectedEventId} onChange={(changeEvent) => setSelectedEventId(changeEvent.target.value)} className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
              <option value="">Pilih event</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name} · {event.result_status || 'DRAFT'}</option>)}
            </select>
          </label>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950 p-4 text-white shadow-sm">
          <div>
            <p className="text-xs font-bold text-slate-400">KONFIRMASI MASUK</p>
            <p className="mt-1 text-lg font-black">{confirmedCount} <span className="text-sm font-semibold text-slate-400">dari {participants.length} mobil</span></p>
          </div>
          <p className="text-xs font-semibold text-slate-400">{lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString('id-ID', { hour12: false })}` : 'Memuat data…'}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Cari nomor mobil / peserta</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Contoh: 81 atau nama pembalap" className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-red-500" />
          </label>
        </section>

        {locked && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">Event sudah LOCKED. Konfirmasi Parc Fermé tidak dapat diubah.</div>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}

        <section className="space-y-3">
          {loading ? <div className="rounded-xl bg-white p-8 text-center text-sm font-bold text-slate-500">Memuat daftar peserta…</div>
            : visibleParticipants.length === 0 ? <div className="rounded-xl bg-white p-8 text-center text-sm font-bold text-slate-500">{selectedEventId ? 'Peserta tidak ditemukan.' : 'Pilih event untuk melihat peserta.'}</div>
              : visibleParticipants.map((participant) => {
                const confirmed = participant.parc_ferme_confirmed;
                return (
                  <article key={participant.participant_id} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 shadow-sm ${confirmed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-slate-950 px-2 text-xl font-black text-white">{participant.start_number}</div>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">{participant.driver_name || participant.entrant_name || 'Peserta'}{participant.co_driver_name ? ` / ${participant.co_driver_name}` : ''}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{[participant.entrant_name, participant.vehicle_name, participant.class_name].filter(Boolean).join(' · ') || '—'}</p>
                        {confirmed && <p className="mt-1 text-[10px] font-bold uppercase text-emerald-700">Masuk Parc Fermé{participant.confirmed_by ? ` · ${participant.confirmed_by}` : ''}{participant.confirmed_at ? ` · ${new Date(participant.confirmed_at).toLocaleString('id-ID', { hour12: false })}` : ''}</p>}
                      </div>
                    </div>
                    {confirmed
                      ? <span className="rounded-lg bg-emerald-600 px-4 py-3 text-xs font-black uppercase text-white">Masuk Parc Fermé</span>
                      : <button type="button" disabled={locked || savingId === participant.participant_id} onClick={() => confirmParticipant(participant)} className="min-h-11 rounded-lg bg-red-600 px-4 py-3 text-xs font-black uppercase text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{savingId === participant.participant_id ? 'Menyimpan…' : 'Konfirmasi Masuk'}</button>}
                  </article>
                );
              })}
        </section>
      </main>
    </div>
  );
}
