import { describe, expect, it } from 'vitest';
import { externalReference } from './external-reference';

describe('external catalyst references', () => {
  it('parses an existing Markdown source', () => {
    expect(externalReference('[BLS schedule](https://www.bls.gov/schedule/)')).toEqual({
      href: 'https://www.bls.gov/schedule/',
      label: 'BLS schedule',
    });
  });

  it('accepts a plain official URL', () => {
    expect(externalReference('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm')).toEqual({
      href: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
      label: 'Official source',
    });
  });

  it('does not create links for unsafe schemes or plain labels', () => {
    expect(externalReference('javascript:alert(1)')).toBeUndefined();
    expect(externalReference('Research desk note')).toBeUndefined();
  });
});
