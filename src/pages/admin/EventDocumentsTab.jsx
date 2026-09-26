import { useCallback, useEffect, useState } from 'react';
import api, { assetUrl } from '../../services/api';

const emptyForm = {
  title: '',
  description: '',
  category: 'REGULATION',
  source_type: 'FILE',
  external_url: '',
  display_order: 0,
  is_published: true,
};

export default function EventDocumentsTab({ eventId }) {
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [editing, setEditing] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await api.get(`/admin/events/${eventId}/documents`);
      setDocuments(response.data.data || []);
    } catch (error) {
      alert(error.response?.data?.error || 'Gagal memuat dokumen event.');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timer = window.setTimeout(fetchDocuments, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDocuments]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setFile(null);
  };

  const editDocument = (document) => {
    setEditing(document);
    setForm({
      title: document.title || '',
      description: document.description || '',
      category: document.category || 'DOCUMENT',
      source_type: document.source_type || 'FILE',
      external_url: document.external_url || '',
      display_order: Number(document.display_order || 0),
      is_published: document.is_published !== false,
    });
    setFile(null);
  };

  const submitDocument = async (event) => {
    event.preventDefault();
    if (form.source_type === 'FILE' && !file && !editing?.file_url) {
      alert('Pilih file dokumen yang akan diunggah.');
      return;
    }
    if (form.source_type === 'LINK' && !form.external_url.trim()) {
      alert('Masukkan link dokumen.');
      return;
    }

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, String(value)));
    if (file) payload.append('file', file);

    setIsSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/events/${eventId}/documents/${editing.id}`, payload);
      } else {
        await api.post(`/admin/events/${eventId}/documents`, payload);
      }
      resetForm();
      await fetchDocuments();
    } catch (error) {
      alert(error.response?.data?.error || 'Gagal menyimpan dokumen event.');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDocument = async (document) => {
    if (!window.confirm(`Hapus dokumen “${document.title}”?`)) return;
    try {
      await api.delete(`/admin/events/${eventId}/documents/${document.id}`);
      if (editing?.id === document.id) resetForm();
      await fetchDocuments();
    } catch (error) {
      alert(error.response?.data?.error || 'Gagal menghapus dokumen event.');
    }
  };

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
      <form onSubmit={submitDocument} className="h-fit rounded-xl border border-gray-200 bg-slate-50 p-5">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-widest text-red-600">Dokumen Event</p>
          <h3 className="mt-1 text-lg font-black text-gray-800">{editing ? 'Edit Dokumen' : 'Tambah Dokumen'}</h3>
          <p className="mt-1 text-xs text-gray-500">Unggah file atau gunakan link eksternal. Hanya dokumen berstatus tampil yang terlihat publik.</p>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Judul</span>
          <input required maxLength="200" className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-red-500" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Contoh: Supplementary Regulation" />
        </label>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <label>
            <span className="mb-1 block text-xs font-bold text-gray-600">Kategori</span>
            <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="REGULATION">Regulasi</option>
              <option value="DOCUMENT">Dokumen</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold text-gray-600">Sumber</span>
            <select className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm font-bold" value={form.source_type} onChange={(event) => setForm({ ...form, source_type: event.target.value })}>
              <option value="FILE">Upload File</option>
              <option value="LINK">Link</option>
            </select>
          </label>
        </div>

        {form.source_type === 'FILE' ? (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-bold text-gray-600">File</span>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" required={!editing?.file_url} onChange={(event) => setFile(event.target.files?.[0] || null)} className="block w-full rounded-lg border border-gray-300 bg-white p-2 text-xs file:mr-3 file:rounded file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:font-bold file:text-white" />
            <p className="mt-1 text-[11px] text-gray-500">PDF, Word, Excel, JPG, atau PNG. Maksimal 10 MB.</p>
            {editing?.file_url && !file && <p className="mt-1 text-[11px] font-bold text-blue-600">File saat ini: {editing.original_file_name || 'dokumen'}</p>}
          </label>
        ) : (
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-bold text-gray-600">URL Dokumen</span>
            <input type="url" required className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-red-500" value={form.external_url} onChange={(event) => setForm({ ...form, external_url: event.target.value })} placeholder="https://..." />
          </label>
        )}

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-bold text-gray-600">Deskripsi</span>
          <textarea rows="3" maxLength="2000" className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm outline-none focus:ring-1 focus:ring-red-500" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Keterangan singkat untuk publik" />
        </label>

        <div className="mb-5 grid grid-cols-2 items-end gap-3">
          <label>
            <span className="mb-1 block text-xs font-bold text-gray-600">Urutan Tampil</span>
            <input type="number" min="0" className="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm" value={form.display_order} onChange={(event) => setForm({ ...form, display_order: Number(event.target.value) })} />
          </label>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-bold text-gray-700">
            <input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} />
            Tampilkan ke publik
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button disabled={isSaving} className="admin-btn-primary disabled:opacity-50">{isSaving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Dokumen'}</button>
          {editing && <button type="button" onClick={resetForm} className="admin-btn-muted">Batal</button>}
        </div>
      </form>

      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-gray-800">Dokumen & Regulasi Publik</h3>
            <p className="text-xs text-gray-500">Total {documents.length} dokumen pada event ini.</p>
          </div>
          <button type="button" onClick={fetchDocuments} className="admin-btn-muted">Refresh</button>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">Memuat dokumen...</div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">Belum ada dokumen untuk event ini.</div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => {
              const href = document.source_type === 'FILE' ? assetUrl(document.file_url) : document.external_url;
              return (
                <article key={document.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-1 text-[10px] font-black ${document.category === 'REGULATION' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{document.category === 'REGULATION' ? 'REGULASI' : 'DOKUMEN'}</span>
                        <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">{document.source_type === 'FILE' ? 'FILE' : 'LINK'}</span>
                        {!document.is_published && <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">DISEMBUNYIKAN</span>}
                        <span className="text-[10px] font-bold text-gray-400">Urutan {document.display_order}</span>
                      </div>
                      <h4 className="mt-2 break-words font-black text-gray-900">{document.title}</h4>
                      {document.description && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-gray-600">{document.description}</p>}
                      <p className="mt-2 break-all text-[11px] font-bold text-gray-400">{document.source_type === 'FILE' ? `${document.original_file_name || 'File'} · ${formatFileSize(document.file_size_bytes)}` : document.external_url}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <a href={href} target="_blank" rel="noopener noreferrer" className="admin-btn-muted">Buka</a>
                      <button type="button" onClick={() => editDocument(document)} className="admin-btn-edit">Edit</button>
                      <button type="button" onClick={() => deleteDocument(document)} className="admin-btn-delete">Hapus</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
