import { describe, expect, it } from 'vitest';
import { ideaDeletionError, ideaLifecycleError } from './actions';

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

describe('idea deletion error copy', () => {
  it('keeps archive-first and permanent-delete errors distinct', () => {
    expect(ideaDeletionError(new Error('archive the idea before deleting it'))).toBe('Archive this idea before deleting it permanently.');
    expect(ideaDeletionError(new Error('delete confirmation did not match'))).toBe('The deletion phrase did not match. Nothing was deleted.');
  });

  it('protects journal history and hides unknown backend details', () => {
    expect(ideaDeletionError(new Error('ideas with trade or journal history cannot be deleted'))).toBe('Ideas with trade or journal history cannot be deleted.');
    expect(ideaDeletionError(new Error('private implementation detail'))).toBe('OJ could not delete this idea. Nothing was changed.');
  });
});
