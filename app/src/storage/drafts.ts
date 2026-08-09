export type DraftSyncState = 'local' | 'syncing' | 'canonical' | 'offline' | 'retry' | 'conflict';

export type Draft = {
  id: string;
  kind: string;
  data: Record<string, string>;
  updatedAt: string;
  cloudRevision?: number;
  cloudUpdatedAt?: string;
  sync: DraftSyncState;
};

export type PendingOperation = {
  id: string;
  recordId: string;
  kind: 'save_trade_idea';
  payload: Draft;
  createdAt: string;
  attempts: number;
};

const dbName = 'oj-canonical-cache';
const recordStore = 'records';
const operationStore = 'operations';

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(dbName, 2);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(recordStore)) request.result.createObjectStore(recordStore, { keyPath: 'id' });
    if (!request.result.objectStoreNames.contains(operationStore)) request.result.createObjectStore(operationStore, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function write(store: string, value: unknown) {
  return open().then((db) => new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(value);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }));
}

function all<T>(store: string) {
  return open().then((db) => new Promise<T[]>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]); request.onerror = () => reject(request.error);
  }));
}

function remove(store: string, id: string) {
  return open().then((db) => new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(id);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }));
}

export const saveDraft = (draft: Draft) => write(recordStore, draft);
export const listDrafts = async () => (await all<Draft>(recordStore)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const clearDraft = (id: string) => remove(recordStore, id);

export async function queueOperation(draft: Draft) {
  const pending: PendingOperation = { id: `save:${draft.id}`, recordId: draft.id, kind: 'save_trade_idea', payload: draft, createdAt: new Date().toISOString(), attempts: 0 };
  await write(operationStore, pending); return pending;
}
export const listOperations = async () => (await all<PendingOperation>(operationStore)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
export const removeOperation = (id: string) => remove(operationStore, id);

export async function clearAllDrafts() {
  const db = await open();
  await Promise.all([recordStore, operationStore].map((store) => new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).clear();
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  })));
}
