import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  getSession: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
  clearOwnerDrafts: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      verifyOtp: mocks.verifyOtp,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
    },
    rpc: mocks.rpc,
  },
}));

vi.mock('../storage/drafts', () => ({ clearOwnerDrafts: mocks.clearOwnerDrafts }));

import { activateInvitedAccount } from './auth';

const storageValues = new Map<string, string>();
const localStorageStub = {
  get length() { return storageValues.size; },
  clear: () => storageValues.clear(),
  getItem: (key: string) => storageValues.get(key) ?? null,
  key: (index: number) => [...storageValues.keys()][index] ?? null,
  removeItem: (key: string) => { storageValues.delete(key); },
  setItem: (key: string, value: string) => { storageValues.set(key, String(value)); },
};

const owner = { id: 'owner-user', email: 'owner@example.test', email_confirmed_at: '2026-08-09T12:00:00Z' };
const invited = { id: 'invited-user', email: 'invited@example.test', email_confirmed_at: '2026-08-09T12:00:00Z' };
const password = 'correct horse battery staple';

function successfulInviteVerification(user = invited) {
  mocks.verifyOtp.mockImplementation(async () => {
    mocks.calls.push('verifyOtp');
    return { data: { session: { user } }, error: null };
  });
  mocks.getUser.mockImplementation(async () => {
    mocks.calls.push('getUser');
    return { data: { user }, error: null };
  });
  mocks.updateUser.mockImplementation(async () => {
    mocks.calls.push('updateUser');
    return { data: { user }, error: null };
  });
  mocks.rpc.mockImplementation(async () => {
    mocks.calls.push('activateRpc');
    return { data: null, error: null };
  });
}

describe('manual invite activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calls.length = 0;
    storageValues.clear();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageStub });
    mocks.getSession.mockImplementation(async () => {
      mocks.calls.push('getSession');
      return { data: { session: { user: owner } }, error: null };
    });
    mocks.clearOwnerDrafts.mockImplementation(async (ownerId: string) => { mocks.calls.push(`clear:${ownerId}`); });
    mocks.signOut.mockImplementation(async ({ scope }: { scope: string }) => {
      mocks.calls.push(`signOut:${scope}`);
      return { error: null };
    });
    successfulInviteVerification();
  });

  it('clears only the local owner context before verifying and activates as the invited identity', async () => {
    localStorage.setItem('oj-cache-owner', owner.id);
    const clearMemory = vi.fn(() => { mocks.calls.push('clearMemory'); });

    await activateInvitedAccount('  INVITED@example.test ', '123456', password, password, clearMemory);

    expect(mocks.calls).toEqual([
      'getSession',
      `clear:${owner.id}`,
      'clearMemory',
      'signOut:local',
      'verifyOtp',
      'getUser',
      'updateUser',
      'activateRpc',
    ]);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ email: invited.email, token: '123456', type: 'invite' });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).not.toHaveBeenCalledWith({ scope: 'global' });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password });
    expect(mocks.rpc).toHaveBeenCalledWith('activate_invited_account');
    expect(localStorage.getItem('oj-cache-owner')).toBeNull();
  });

  it('activates from a signed-out browser without attempting a sign-out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await activateInvitedAccount(invited.email, '123456', password, password);
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('stops after an invalid, expired, or already-used code', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: 'otp_expired' } });
    await expect(activateInvitedAccount(invited.email, '654321', password, password)).rejects.toThrow('Invalid or expired invite code.');
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signs out and refuses a verified session whose email does not match the form', async () => {
    const other = { ...invited, id: 'other-user', email: 'other@example.test' };
    successfulInviteVerification(other);
    await expect(activateInvitedAccount(invited.email, '123456', password, password)).rejects.toThrow('Account activation failed. Request a new invite.');
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('validates all input before clearing an existing session', async () => {
    await expect(activateInvitedAccount('not-an-email', '123456', password, password)).rejects.toThrow('Enter a valid email.');
    await expect(activateInvitedAccount(invited.email, '123', password, password)).rejects.toThrow('Enter the 6-digit invite code.');
    await expect(activateInvitedAccount(invited.email, '123456', password, `${password}!`)).rejects.toThrow('Passwords do not match.');
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
});
