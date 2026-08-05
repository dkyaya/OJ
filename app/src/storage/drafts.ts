export type DraftSyncState =
  | 'draft'
  | 'awaiting'
  | 'local'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'retry'
  | 'outdated'
  | 'conflict'
  | 'submitted'
  | 'pr_open'
  | 'published';

export type Draft = {
  id: string;
  kind: string;
  data: Record<string, string>;
  updatedAt: string;
  publishedVersion?: string;
  cloudRevision?: number;
  cloudUpdatedAt?: string;
  formalizationJobId?: string;
  formalizationStatus?: string;
  prUrl?: string;
  canonicalNotePath?: string;
  publishedCommitSha?: string;
  sync: DraftSyncState;
};

const dbName = 'oj-drafts';
const store = 'records';

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(store, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function saveDraft(draft: Draft) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(draft);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listDrafts() {
  const db = await open();
  return new Promise<Draft[]>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () =>
      resolve(request.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function clearDraft(id: string) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllDrafts() {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
