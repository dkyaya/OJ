import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('product tour implementation boundary', () => {
  it('contains no domain action, provider, brokerage, or Supabase client dependency', () => {
    const component = readFileSync(new URL('../../components/ProductTour.tsx', import.meta.url), 'utf8');
    const model = readFileSync(new URL('./product-tour.ts', import.meta.url), 'utf8');
    for (const forbidden of ['data/actions', 'collaboration-actions', 'catalyst-intelligence/providers', 'lib/supabase', 'saveResearchSnapshot', 'recordTrade']) {
      expect(`${component}\n${model}`).not.toContain(forbidden);
    }
  });

  it('defines mobile, safe-area, viewport, and reduced-motion protections', () => {
    const css = readFileSync(new URL('../../styles/product-tour.css', import.meta.url), 'utf8');
    expect(css).toContain('@media(max-width:700px)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('max-height:calc(100dvh - 32px)');
    expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  });
});
