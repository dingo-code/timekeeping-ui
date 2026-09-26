import { useEffect, useState } from 'react';
import {
  getOfflineQueueSnapshot,
  OFFLINE_QUEUE_CHANGE_EVENT,
  removeOfflineInput,
  retryFailedOfflineInputs,
  syncOfflineQueue,
} from '../services/offlineQueue';

export default function OfflineQueueStatus() {
  const [snapshot, setSnapshot] = useState(getOfflineQueueSnapshot);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setSnapshot(getOfflineQueueSnapshot());
    window.addEventListener(OFFLINE_QUEUE_CHANGE_EVENT, update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener(OFFLINE_QUEUE_CHANGE_EVENT, update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (snapshot.online && snapshot.total === 0) return null;

  const color = snapshot.failed > 0
    ? 'bg-red-600'
    : snapshot.online
      ? 'bg-amber-500'
      : 'bg-slate-800';

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm text-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`${color} flex items-center gap-2 rounded-full px-4 py-2 font-bold text-white shadow-xl`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${snapshot.online ? 'bg-emerald-200' : 'bg-red-300'}`} />
        {!snapshot.online ? 'OFFLINE' : snapshot.syncing ? 'MENGIRIM…' : 'ANTREAN INPUT'}
        {snapshot.total > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5">{snapshot.total}</span>}
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-3">
            <div className="font-extrabold text-slate-800">Offline Queue</div>
            <div className="mt-1 text-xs text-slate-500">
              {snapshot.online ? 'Server dapat dijangkau. Input pending dikirim berurutan.' : 'Input baru tetap disimpan aman di perangkat ini.'}
            </div>
          </div>
          {snapshot.items.length > 0 && (
            <div className="max-h-64 divide-y divide-slate-100 overflow-auto">
              {snapshot.items.map((item) => (
                <div key={item.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800">{item.label}</div>
                      <div className={`text-xs font-semibold ${item.state === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                        {item.state === 'failed' ? `Gagal: ${item.lastError}` : 'Menunggu dikirim'}
                      </div>
                    </div>
                    {item.state === 'failed' && (
                      <button
                        type="button"
                        onClick={() => removeOfflineInput(item.id)}
                        className="text-xs font-bold text-slate-400 hover:text-red-600"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 border-t border-slate-100 p-3">
            {snapshot.failed > 0 && (
              <button type="button" onClick={retryFailedOfflineInputs} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">
                Coba Lagi ({snapshot.failed})
              </button>
            )}
            {snapshot.pending > 0 && (
              <button type="button" disabled={!snapshot.online || snapshot.syncing} onClick={syncOfflineQueue} className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">
                Sinkronkan ({snapshot.pending})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
