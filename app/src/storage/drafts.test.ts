import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { clearOwnerDrafts, draftCacheKey, listDrafts, listOperations, operationCacheKey, queueOperation, saveDraft } from './drafts';

const values = new Map<string, string>();
const storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => values.set(key, String(value)),
};

describe('account-isolated browser cache keys', () => {
  beforeAll(() => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage }));
  it('namespaces the same draft identifier by authenticated owner', () => {
    expect(draftCacheKey('user-a', 'idea-1')).toBe('user-a:idea-1');
    expect(draftCacheKey('user-a', 'idea-1')).not.toBe(draftCacheKey('user-b', 'idea-1'));
  });

  it('namespaces retry operations separately from records and other owners', () => {
    expect(operationCacheKey('user-a', 'idea-1')).toBe('user-a:save:idea-1');
    expect(operationCacheKey('user-a', 'idea-1')).not.toBe(operationCacheKey('user-b', 'idea-1'));
    expect(operationCacheKey('user-a', 'idea-1')).not.toBe(draftCacheKey('user-a', 'idea-1'));
  });

  it('isolates records, offline operations, account switching, and sign-out cleanup', async () => {
    const base = { id: 'shared-id', kind: 'trade_idea', updatedAt: '2026-08-09T12:00:00Z', sync: 'offline' as const };
    const ownerA = { ...base, ownerId: 'user-a', data: { Ticker: 'ALPHA' } };
    const ownerB = { ...base, ownerId: 'user-b', data: { Ticker: 'BETA' } };
    await saveDraft(ownerA); await saveDraft(ownerB); await queueOperation(ownerA); await queueOperation(ownerB);

    expect((await listDrafts('user-a')).map((item) => item.data.Ticker)).toEqual(['ALPHA']);
    expect((await listDrafts('user-b')).map((item) => item.data.Ticker)).toEqual(['BETA']);
    expect(await listOperations('user-a')).toHaveLength(1);
    expect(await listOperations('user-b')).toHaveLength(1);

    await clearOwnerDrafts('user-a');
    expect(await listDrafts('user-a')).toEqual([]);
    expect(await listOperations('user-a')).toEqual([]);
    expect((await listDrafts('user-b')).map((item) => item.data.Ticker)).toEqual(['BETA']);
    expect(await listOperations('user-b')).toHaveLength(1);
  });

  it('discards a legacy shared cache when its recorded owner does not match', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('oj-canonical-cache', 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('records')) request.result.createObjectStore('records', { keyPath: 'id' });
        if (!request.result.objectStoreNames.contains('operations')) request.result.createObjectStore('operations', { keyPath: 'id' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result; const transaction = db.transaction('records', 'readwrite');
        transaction.objectStore('records').put({ id: 'legacy-secret', kind: 'trade_idea', data: { Ticker: 'PRIVATE' }, updatedAt: '2026-08-01T00:00:00Z', sync: 'local' });
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => reject(transaction.error);
      };
    });
    localStorage.setItem('oj-cache-owner', 'legacy-user');
    expect(await listDrafts('different-user')).toEqual([]);
  });
});
