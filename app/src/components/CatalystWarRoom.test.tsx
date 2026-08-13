import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { CatalystWarRoom, ForecastSection } from './CatalystWarRoom';

describe('Catalyst War Room', () => {
  it('renders a Markdown source as a safe official-document link', () => {
    const catalyst = { ...demoWorkspace.catalysts[0], source: '[Release calendar](https://www.bls.gov/schedule/)' };
    const markup = renderToStaticMarkup(<CatalystWarRoom catalyst={catalyst} workspace={demoWorkspace} onBack={() => undefined} onSaved={() => undefined} />);

    expect(markup).toContain('Catalyst War Room');
    expect(markup).toContain('Intelligence');
    expect(markup).toContain('href="https://www.bls.gov/schedule/"');
    expect(markup).not.toContain('[Release calendar]');
  });

  it('closes forecast inputs after the server cutoff instead of allowing a doomed submission', () => {
    const catalyst = { ...demoWorkspace.catalysts[0], eventAt: '2026-08-06T12:00:00Z' };
    const markup = renderToStaticMarkup(<ForecastSection catalyst={catalyst} workspace={demoWorkspace} onSaved={() => undefined} setMessage={() => undefined} />);

    expect(markup).toContain('Forecast window closed');
    expect(markup).toContain('Pre-event forecasts cannot be created, revised, or locked after the cutoff.');
    expect(markup).toContain('<fieldset class="form-grid" disabled=""');
    expect(markup).toContain('<button class="primary" disabled=""');
  });
});
