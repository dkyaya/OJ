import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { CatalystIntelligence } from './CatalystIntelligence';

describe('Catalyst Intelligence UI', () => {
  it('renders manual-first intelligence, scenario, timeline, and provider disclosures', () => {
    const markup = renderToStaticMarkup(<CatalystIntelligence catalyst={demoWorkspace.catalysts[0]} workspace={demoWorkspace} onSaved={() => undefined} setMessage={() => undefined} />);
    expect(markup).toContain('Catalyst Intelligence');
    expect(markup).toContain('Permanent no-key path');
    expect(markup).toContain('Candidate Economics &amp; Scenario Lab');
    expect(markup).toContain('T-5');
    expect(markup).toContain('n = 0');
    expect(markup).toContain('No polling');
    expect(markup).toContain('No trade or Idea is changed automatically');
  });
});
