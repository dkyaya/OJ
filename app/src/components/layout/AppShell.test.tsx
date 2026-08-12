import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('responsive application navigation', () => {
  it('keeps an overflow section visible in the mobile navbar', () => {
    const markup = renderToStaticMarkup(<AppShell current="/insights" dark={false} onTheme={() => undefined} onBuildIdea={() => undefined} onRefresh={() => undefined}><div>Screen</div></AppShell>);

    expect(markup).toContain('Current section: Insights');
    expect(markup).toContain('<span>Insights</span>');
    expect(markup).toContain('Swipe left or right to change sections');
  });
});
