import { describe, expect, it } from 'vitest';
import { revisionState } from './revisions';

describe('canonical revision conflicts', () => {
  it('preserves divergent revisions', () => expect(revisionState(2, 3, true, true)).toBe('conflict'));
  it('marks newer cloud data without overwriting local changes', () => expect(revisionState(2, 3, false, true)).toBe('cloud-newer'));
  it('treats equal unchanged revisions as canonical', () => expect(revisionState(3, 3, false, false)).toBe('canonical'));
});
