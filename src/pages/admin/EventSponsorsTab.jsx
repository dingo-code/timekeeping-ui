import { useCallback, useEffect, useState } from 'react';
import api, { assetUrl } from '../../services/api';

const emptyForm = {
  name: '',
  sponsor_type: 'PARTNER',
  website_url: '',
  display_order: 0,
  is_published: true,
  show_in_embed: true,
};

const sponsorTypeLabel = {
  MAIN: 'Main Sponsor',
  PARTNER: 'Official Partner',
  SUPPORTING: 'Supporting Partner',
};

export default function EventSponsorsTab({ eventId }) {
  const [sponsors, setSponsors] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [logo, setLogo] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSponsors = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await api.get(`/admin/events/${eventId}/sponsors`);
      setSponsors(response.data.data || []);
    } catch (error) {
      alert(error.response?.data?.error || 'Gagal memuat sponsor event.');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timer = window.setTimeout(fetchSponsors, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSponsors]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setLogo(null);
    setRemoveLogo(false);
  };

  const editSponsor = (sponsor) => {
    setEditing(sponsor);
    setForm({
      name: sponsor.name || '',
      sponsor_type: sponsor.sponsor_type || 'PARTNER',
      website_url: sponsor.website_url || '',
      display_order: Number(sponsor.display_order || 0),
      is_published: sponsor.is_published !== false,
      show_in_embed: sponsor.show_in_embed !== false,
    });
    setLogo(null);
    setRemoveLogo(false);
  };

  const submitSponsor = async (event) => {
    event.preventDefault();
    const payload = new FormData();
    Object.entries({
      ...form,
      name: form.name.trim(),
      website_url: form.website_url.trim(),
      display_order: Math.max(0, Number(form.display_order) || 0),
      is_published: Boolean(form.is_published),
      show_in_embed: Boolean(form.show_in_embed),
      remove_logo: removeLogo,
    }).forEach(([key, value]) => payload.append(key, String(value)));
    if (logo) payload.append('logo', logo);

    setIsSaving(true);
    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };
      if (editing) {
        await api.put(`/admin/events/${eventId}/sponsors/${editing.id}`, payload, config);
      } else {
        await api.post(`/admin/events/${eventId}/sponsors`, payload, config);
      }
      resetForm();
      await fetchSponsors();
    } catch (error) {
      alert(error.response?.data?.error || 'Gagal menyimpan sponsor event.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSponsor = async (sponsor) => {
    if (!window.confirm(`Hapus sponsor “${sponsor.name}”?`)) return;
    try {
      await api.delete(`/admin/events/${eventId}/sponsors/${sponsor.id}`);
      if (editing?.id === sponsor.id) resetForm();
      await fetchSponsors();
    } catch (error) {
      alert(error.response?.data?.error || 'Gagal menghapus sponsor event.');
    }
  };

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <form onSubmit={submitSponsor} className="h-fit rounded-xl border border-gray-200 bg-slate-50 p-5">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-widest text-red-600">Event Partners</p>
          <h3 className="mt-1 text-lg font-black text-gray-800">{editing ? 'Edit Sponsor' : 'Add Sponsor'}</h3>
          <p className="mt-1 text-xs text-gray-500">Logo bersifat opsional. Tanpa logo, nama sponsor akan tetap ditampilkan di Live Timing.</p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Sponsor Name</span>
          <input required maxLength="160" className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-red-500" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contoh: Compact Indonesia" />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-xs font-bold text-gray-600">Category</span>
            <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold" value={form.sponsor_type} onChange={(event) => setForm({ ...form, sponsor_type: event.target.value })}>
              <option value="MAIN">Main Sponsor</option>
              <option value="PARTNER">Official Partner</option>
              <option value="SUPPORTING">Supporting Partner</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-gray-600">Display Order</span>
            <input type="number" min="0" className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: Number(event.target.value) })} />
          </label>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Website (optional)</span>
          <input type="url" className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-red-500" value={form.website_url} onChange={(event) => setForm({ ...form, website_url: event.target.value })} placeholder="https://..." />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Logo (optional)</span>
          <input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => { setLogo(event.target.files?.[0] || null); setRemoveLogo(false); }} className="block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:font-bold file:text-white" />
          <p className="mt-1 text-[11px] text-gray-500">JPG, PNG, atau WEBP. Maksimal 2 MB.</p>
        </label>

        {editing?.logo_url && !logo && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <img src={assetUrl(editing.logo_url)} alt={editing.name} className="h-10 w-24 object-contain" />
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
              <input type="checkbox" checked={removeLogo} onChange={(event) => setRemoveLogo(event.target.checked)} />
              Remove current logo
            </label>
          </div>
        )}

        <div className="mb-5 space-y-2">
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-bold text-gray-700">
            <input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} />
            Show on public Live Timing
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-bold text-gray-700">
            <input type="checkbox" checked={form.show_in_embed} onChange={(event) => setForm({ ...form, show_in_embed: event.target.checked })} />
            Show on embedded Live Timing
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={isSaving} className="admin-btn-primary disabled:opacity-50">{isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Add Sponsor'}</button>
          {editing && <button type="button" onClick={resetForm} className="admin-btn-muted">Cancel</button>}
        </div>
      </form>

      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-gray-800">Live Timing Sponsors</h3>
            <p className="text-xs text-gray-500">Total {sponsors.length} sponsor pada event ini.</p>
          </div>
          <button type="button" onClick={fetchSponsors} className="admin-btn-muted">Refresh</button>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Memuat sponsor...</div>
        ) : sponsors.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">Belum ada sponsor untuk event ini.</div>
        ) : (
          <div className="space-y-3">
            {sponsors.map((sponsor) => (
              <article key={sponsor.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 p-2">
                      {sponsor.logo_url ? <img src={assetUrl(sponsor.logo_url)} alt={sponsor.name} className="h-full w-full object-contain" /> : <span className="text-center text-xs font-black uppercase text-gray-700">{sponsor.name}</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-black text-red-700">{sponsorTypeLabel[sponsor.sponsor_type] || sponsor.sponsor_type}</span>
                        {!sponsor.is_published && <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">HIDDEN</span>}
                        {!sponsor.show_in_embed && <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">NOT IN EMBED</span>}
                        <span className="text-[10px] font-bold text-gray-400">Order {sponsor.display_order}</span>
                      </div>
                      <h4 className="mt-2 break-words font-black text-gray-900">{sponsor.name}</h4>
                      {sponsor.website_url && <p className="mt-1 break-all text-[11px] font-bold text-gray-400">{sponsor.website_url}</p>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {sponsor.website_url && <a href={sponsor.website_url} target="_blank" rel="noopener noreferrer" className="admin-btn-muted">Open</a>}
                    <button type="button" onClick={() => editSponsor(sponsor)} className="admin-btn-edit">Edit</button>
                    <button type="button" onClick={() => deleteSponsor(sponsor)} className="admin-btn-delete">Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
