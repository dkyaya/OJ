export type DraftSyncState = 'local' | 'syncing' | 'canonical' | 'offline' | 'retry' | 'conflict';

export type Draft = {
  id: string;
  ownerId: string;
  kind: string;
  data: Record<string, string>;
  updatedAt: string;
  cloudRevision?: number;
  cloudUpdatedAt?: string;
  sync: DraftSyncState;
};

export type PendingOperation = {
  id: string;
  ownerId: string;
  cacheKey: string;
  recordId: string;
  kind: 'save_trade_idea';
  payload: Draft;
  createdAt: string;
  attempts: number;
};

type StoredDraft = Draft & { cacheKey: string };

const dbName = 'oj-canonical-cache-v3';
const legacyDbName = 'oj-canonical-cache';
const recordStore = 'records';
const operationStore = 'operations';
const ownerIndex = 'ownerId';
const migratedOwners = new Set<string>();

export const draftCacheKey = (ownerId: string, id: string) => `${ownerId}:${id}`;
export const operationCacheKey = (ownerId: string, id: string) => `${ownerId}:save:${id}`;

const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = () => {
    const records = request.result.createObjectStore(recordStore, { keyPath: 'cacheKey' });
    records.createIndex(ownerIndex, ownerIndex, { unique: false });
    const operations = request.result.createObjectStore(operationStore, { keyPath: 'cacheKey' });
    operations.createIndex(ownerIndex, ownerIndex, { unique: false });
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

function byOwner<T>(store: string, ownerId: string) {
  return open().then((db) => new Promise<T[]>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).index(ownerIndex).getAll(IDBKeyRange.only(ownerId));
    request.onsuccess = () => resolve(request.result as T[]); request.onerror = () => reject(request.error);
  }));
}

function remove(store: string, cacheKey: string) {
  return open().then((db) => new Promise<void>((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(cacheKey);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  }));
}

function clearOwnerStore(store: string, ownerId: string) {
  return open().then((db) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    const objectStore = transaction.objectStore(store);
    const request = objectStore.index(ownerIndex).getAllKeys(IDBKeyRange.only(ownerId));
    request.onsuccess = () => request.result.forEach((key) => objectStore.delete(key));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  }));
}

function readLegacyStore<T>(db: IDBDatabase, store: string) {
  if (!db.objectStoreNames.contains(store)) return Promise.resolve<T[]>([]);
  return new Promise<T[]>((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]); request.onerror = () => reject(request.error);
  });
}

async function migrateLegacyCache(ownerId: string) {
  if (migratedOwners.has(ownerId)) return;
  migratedOwners.add(ownerId);
  const legacyOwner = localStorage.getItem('oj-cache-owner');
  if (legacyOwner !== ownerId) {
    await new Promise<void>((resolve) => {
      const deletion = indexedDB.deleteDatabase(legacyDbName);
      deletion.onsuccess = () => resolve(); deletion.onerror = () => resolve(); deletion.onblocked = () => resolve();
    });
    return;
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.open(legacyDbName);
    request.onerror = () => resolve();
    request.onsuccess = async () => {
      const db = request.result;
      try {
        const [records, operations] = await Promise.all([
          readLegacyStore<Omit<Draft, 'ownerId'>>(db, recordStore),
          readLegacyStore<Omit<PendingOperation, 'ownerId' | 'cacheKey'>>(db, operationStore),
        ]);
        await Promise.all(records.map((item) => saveDraft({ ...item, ownerId })));
        await Promise.all(operations.map((item) => write(operationStore, {
          ...item,
          id: `save:${item.recordId}`,
          ownerId,
          cacheKey: operationCacheKey(ownerId, item.recordId),
          payload: { ...item.payload, ownerId },
        })));
      } finally {
        db.close();
        const deletion = indexedDB.deleteDatabase(legacyDbName);
        deletion.onsuccess = () => resolve(); deletion.onerror = () => resolve(); deletion.onblocked = () => resolve();
      }
    };
  });
}

export async function prepareOwnerCache(ownerId: string) {
  if (!ownerId) throw new Error('A signed-in account is required for local storage.');
  await migrateLegacyCache(ownerId);
  localStorage.setItem('oj-cache-owner', ownerId);
}

export async function saveDraft(draft: Draft) {
  await prepareOwnerCache(draft.ownerId);
  await write(recordStore, { ...draft, cacheKey: draftCacheKey(draft.ownerId, draft.id) } satisfies StoredDraft);
}

export async function listDrafts(ownerId: string) {
  await prepareOwnerCache(ownerId);
  return (await byOwner<StoredDraft>(recordStore, ownerId))
    .map((item) => ({ id: item.id, ownerId: item.ownerId, kind: item.kind, data: item.data, updatedAt: item.updatedAt, cloudRevision: item.cloudRevision, cloudUpdatedAt: item.cloudUpdatedAt, sync: item.sync }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function clearDraft(ownerId: string, id: string) {
  await remove(recordStore, draftCacheKey(ownerId, id));
}

export async function queueOperation(draft: Draft) {
  await prepareOwnerCache(draft.ownerId);
  const pending: PendingOperation = {
    id: `save:${draft.id}`,
    ownerId: draft.ownerId,
    cacheKey: operationCacheKey(draft.ownerId, draft.id),
    recordId: draft.id,
    kind: 'save_trade_idea',
    payload: draft,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await write(operationStore, pending); return pending;
}

export async function listOperations(ownerId: string) {
  await prepareOwnerCache(ownerId);
  return (await byOwner<PendingOperation>(operationStore, ownerId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOperation(ownerId: string, recordId: string) {
  await remove(operationStore, operationCacheKey(ownerId, recordId));
}

export async function clearOwnerDrafts(ownerId: string) {
  if (!ownerId) return;
  await Promise.all([clearOwnerStore(recordStore, ownerId), clearOwnerStore(operationStore, ownerId)]);
}
