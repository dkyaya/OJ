import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { persistedSessionUser, type SessionReader } from './session';

const user = { id: '90000000-0000-4000-8000-000000000001', email: 'owner@example.invalid' } as User;

describe('persisted session refreshes', () => {
  it('keeps the same signed-in user through repeated background refreshes', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: { user } }, error: null });
    const auth = { getSession } as SessionReader;

    for (let index = 0; index < 100; index += 1) {
      await expect(persistedSessionUser(auth)).resolves.toBe(user);
    }

    expect(getSession).toHaveBeenCalledTimes(100);
  });

  it('surfaces a transient session-read error instead of impersonating a sign-out', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: { message: 'temporary storage failure' } }),
    } as SessionReader;

    await expect(persistedSessionUser(auth)).rejects.toThrow('temporary storage failure');
  });

  it('returns null only when the persisted session is genuinely absent', async () => {
    const auth = {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    } as SessionReader;

    await expect(persistedSessionUser(auth)).resolves.toBeNull();
  });
});
