import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { wmtOptionChainFixture } from '../test/fixtures/wmt-option-chain';
import { OptionChainSnapshot } from './OptionChainSnapshot';

describe('OptionChainSnapshot', () => {
  it('renders a readable paired table, freshness, timestamps, summary, and disclosures', () => {
    const markup = renderToStaticMarkup(<OptionChainSnapshot contracts={wmtOptionChainFixture} cache={{ hit: true, fetchedAt: '2026-08-13T03:57:00Z' }} technicalValues={{ option_chain: wmtOptionChainFixture }} />);
    expect(markup).toContain('WMT');
    expect(markup).toContain('12 contracts');
    expect(markup).toContain('Call Bid');
    expect(markup).toContain('Put IV');
    expect(markup).toContain('ATM');
    expect(markup).toContain('delayed');
    expect(markup).toContain('Observed');
    expect(markup).toContain('Fetched');
    expect(markup).toContain('Private cache hit');
    expect(markup).toContain('Contract Details');
    expect(markup).toContain('Open interest');
    expect(markup).toContain('Delta');
    expect(markup).toContain('Technical Details');
    expect(markup).not.toContain('option_chain: [{');
  });
});
