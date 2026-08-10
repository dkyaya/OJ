import { describe, expect, it } from 'vitest';
import { ideaLifecycleError } from './actions';

describe('idea lifecycle error copy', () => {
  it('maps revision conflicts without exposing database details', () => {
    expect(ideaLifecycleError(new Error('trade idea changed on another device'))).toContain('changed on another device');
  });

  it('explains the canonical trade-history restriction', () => {
    expect(ideaLifecycleError({ message: 'trade-backed ideas cannot be archived' })).toBe('Ideas with confirmed trade history cannot be archived.');
  });

  it('uses a safe fallback for unknown backend failures', () => {
    expect(ideaLifecycleError(new Error('internal implementation detail'))).toBe('OJ could not update the idea archive. Nothing was changed.');
  });
});
