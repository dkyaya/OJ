import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createProductTourState } from '../features/tour/product-tour';
import { ProductTour, ProductTourInvitation } from './ProductTour';

describe('product tour presentation', () => {
  it('offers explicit first-use consent without implying a domain write', () => {
    const html = renderToStaticMarkup(<ProductTourInvitation onTake={() => undefined} onSkip={() => undefined} />);
    expect(html).toContain('Take a Tour');
    expect(html).toContain('Skip for Now');
    expect(html).toContain('creates no research');
    expect(html).toContain('never touches a brokerage');
  });

  it('renders bounded navigation and lifecycle separation copy', () => {
    const html = renderToStaticMarkup(<ProductTour state={createProductTourState('in_progress', 7, new Date('2026-08-15T12:00:00Z'))} onStep={() => undefined} onPause={() => undefined} onFinish={() => undefined} />);
    expect(html).toContain('8 / 11');
    expect(html).toContain('Trade monitoring');
    expect(html).toContain('they do not appear as Journal entries');
    expect(html).toContain('Pause');
    expect(html).toContain('Back');
    expect(html).toContain('Next');
  });

  it('replaces Next with Finish on the final Settings step', () => {
    const html = renderToStaticMarkup(<ProductTour state={createProductTourState('in_progress', 10, new Date('2026-08-15T12:00:00Z'))} onStep={() => undefined} onPause={() => undefined} onFinish={() => undefined} />);
    expect(html).toContain('You are ready');
    expect(html).toContain('Finish');
    expect(html).not.toContain('>Next<');
  });
});
