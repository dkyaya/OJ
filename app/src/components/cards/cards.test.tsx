import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyCard, ExpandablePanel, SummaryCard } from '.';

describe('card hierarchy', () => {
  it('keeps summary metadata structurally separate from detail content', () => {
    const html = renderToStaticMarkup(<SummaryCard title="DEMO" subtitle="Bear Put Spread" status="Watchlist" metric="$80 risk" meta="Aug 14" />);
    expect(html).toContain('summary-card'); expect(html).toContain('card-metric'); expect(html).toContain('data-status="watchlist"');
  });
  it('uses disclosure for level-two content', () => expect(renderToStaticMarkup(<ExpandablePanel title="Research Details" summary="Thesis and conditions.">Details</ExpandablePanel>)).toContain('<details'));
  it('gives empty states a title and explanation', () => { const html = renderToStaticMarkup(<EmptyCard title="No Ideas" subtitle="Build an idea." />); expect(html).toContain('<h2>No Ideas</h2>'); expect(html).toContain('Build an idea.'); });
});
