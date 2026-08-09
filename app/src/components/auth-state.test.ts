import { describe, expect, it } from 'vitest';
import { observeAuthState, type AuthObserver } from './auth-state';

type TestUser = { id: string };
type TestEvent = 'SIGNED_IN' | 'SIGNED_OUT';

describe('auth state observer', () => {
  it('checks the current user once and owns one subscription until cleanup', async () => {
    const owner: TestUser = { id: 'owner' };
    const states: Array<[string, TestUser | null]> = [];
    let getUserCalls = 0; let subscribeCalls = 0; let unsubscribeCalls = 0;
    let emit: ((event: TestEvent, session: { user: TestUser } | null) => void) | undefined;
    const auth: AuthObserver<TestUser, TestEvent> = {
      getUser: async () => { getUserCalls += 1; return { data: { user: owner } }; },
      onAuthStateChange: (callback) => {
        subscribeCalls += 1; emit = callback;
        return { data: { subscription: { unsubscribe: () => { unsubscribeCalls += 1; } } } };
      },
    };
    const stop = observeAuthState(auth, (event, user) => states.push([event, user]));
    await Promise.resolve();
    emit?.('SIGNED_IN', { user: owner });
    expect(getUserCalls).toBe(1); expect(subscribeCalls).toBe(1);
    expect(states).toEqual([['INITIAL_USER', owner], ['SIGNED_IN', owner]]);
    stop(); expect(unsubscribeCalls).toBe(1);
  });
});
