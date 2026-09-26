import api from './api';
import { useAuthStore } from '../store/useAuthStore';

const STORAGE_KEY = 'timekeeping_offline_queue_v1';
const CHANGE_EVENT = 'timekeeping:offline-queue-change';
const SYNC_EVENT = 'timekeeping:offline-queue-synced';
const REQUEST_TIMEOUT_MS = 10000;

let flushing = false;
let initialized = false;
let intervalId = null;

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
}

function readQueue() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: getOfflineQueueSnapshot() }));
}

function currentOwner() {
  return String(useAuthStore.getState().username || '').trim();
}

function ownerItems(items = readQueue()) {
  const owner = currentOwner();
  return items.filter((item) => item.owner === owner);
}

function errorMessage(error) {
  return error?.response?.data?.error || error?.message || 'Gagal mengirim input';
}

function isConnectionFailure(error) {
  return !error?.response || error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED';
}

function enqueueRequest(request) {
  const items = readQueue();
  items.push(request);
  writeQueue(items);
}

export function getOfflineQueueSnapshot() {
  const items = ownerItems();
  return {
    online: navigator.onLine,
    syncing: flushing,
    pending: items.filter((item) => item.state === 'pending').length,
    failed: items.filter((item) => item.state === 'failed').length,
    total: items.length,
    items,
  };
}

export async function submitTimingRequest({ method = 'post', url, data, label = 'Input waktu', metadata = {} }) {
  const idempotencyKey = makeId();
  const request = {
    id: makeId(),
    idempotencyKey,
    owner: currentOwner(),
    method: method.toLowerCase(),
    url,
    data,
    label,
    metadata,
    state: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastError: '',
  };

  if (!navigator.onLine) {
    enqueueRequest(request);
    return queuedResponse(request);
  }

  try {
    return await api.request({
      method: request.method,
      url: request.url,
      data: request.data,
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    request.lastError = errorMessage(error);
    enqueueRequest(request);
    return queuedResponse(request);
  }
}

function queuedResponse(request) {
  return {
    status: 202,
    data: {
      queued: true,
      queue_id: request.id,
      idempotency_key: request.idempotencyKey,
      message: 'Koneksi tidak tersedia. Input aman tersimpan di perangkat dan akan dikirim otomatis.',
    },
  };
}

export async function syncOfflineQueue() {
  if (flushing || !navigator.onLine || !currentOwner()) return getOfflineQueueSnapshot();
  flushing = true;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: getOfflineQueueSnapshot() }));

  try {
    let items = readQueue();
    const owner = currentOwner();
    const candidates = items
      .filter((item) => item.owner === owner && item.state === 'pending')
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));

    for (const queued of candidates) {
      try {
        const response = await api.request({
          method: queued.method,
          url: queued.url,
          data: queued.data,
          timeout: REQUEST_TIMEOUT_MS,
          headers: { 'Idempotency-Key': queued.idempotencyKey },
        });
        items = readQueue().filter((item) => item.id !== queued.id);
        writeQueue(items);
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, {
          detail: { item: queued, response: response.data },
        }));
      } catch (error) {
        if (isConnectionFailure(error) || error?.response?.status === 425) break;

        items = readQueue().map((item) => item.id === queued.id ? {
          ...item,
          state: 'failed',
          attempts: (item.attempts || 0) + 1,
          lastError: errorMessage(error),
        } : item);
        writeQueue(items);
      }
    }
  } finally {
    flushing = false;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: getOfflineQueueSnapshot() }));
  }
  return getOfflineQueueSnapshot();
}

export function retryFailedOfflineInputs() {
  const owner = currentOwner();
  writeQueue(readQueue().map((item) => item.owner === owner && item.state === 'failed'
    ? { ...item, state: 'pending', lastError: '' }
    : item));
  return syncOfflineQueue();
}

export function removeOfflineInput(id) {
  const owner = currentOwner();
  writeQueue(readQueue().filter((item) => !(item.id === id && item.owner === owner)));
}

export function initOfflineQueue() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('online', syncOfflineQueue);
  window.addEventListener('focus', syncOfflineQueue);
  intervalId = window.setInterval(syncOfflineQueue, 15000);
  window.setTimeout(syncOfflineQueue, 250);
}

export function stopOfflineQueue() {
  if (!initialized) return;
  window.removeEventListener('online', syncOfflineQueue);
  window.removeEventListener('focus', syncOfflineQueue);
  if (intervalId) window.clearInterval(intervalId);
  intervalId = null;
  initialized = false;
}

export { CHANGE_EVENT as OFFLINE_QUEUE_CHANGE_EVENT, SYNC_EVENT as OFFLINE_QUEUE_SYNC_EVENT };
