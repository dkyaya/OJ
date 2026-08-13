import { describe, expect, it } from 'vitest';
import { secCompanyFilingsUrl, validateOfficialCompanySource } from './company-sources';

describe('official company source registry', () => {
  it('builds an official SEC browse link from a CIK', () => {
    expect(secCompanyFilingsUrl('320193')).toContain('CIK=0000320193');
  });

  it('accepts curated HTTPS sources without attempting to scrape them', () => {
    expect(validateOfficialCompanySource({ ticker: 'ABC', kind: 'investor_relations', label: 'IR Home', url: 'https://example.com/investors' })).toMatchObject({ ticker: 'ABC', label: 'IR Home' });
    expect(validateOfficialCompanySource({ ticker: 'ABC', kind: 'investor_relations', label: 'IR Home', url: 'http://example.com' })).toBeUndefined();
  });
});
