import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('responsive application navigation', () => {
  it('uses four default shortcuts and a fifth measured More slot', () => {
    const markup = renderToStaticMarkup(<AppShell current="/insights" dark={false} onTheme={() => undefined} onBuildIdea={() => undefined} onRefresh={() => undefined}><div>Screen</div></AppShell>);

    expect(markup).toContain('Current section: Insights');
    expect(markup).toContain('<span>Insights</span>');
    expect(markup).toContain('Drag the glass selection or tap a section');
    expect(markup.match(/data-mobile-nav-slot=""/g)).toHaveLength(5);
  });

  it('accepts a personalized set of four mobile shortcuts', () => {
    const markup = renderToStaticMarkup(<AppShell current="/insights" dark={false} mobileNavigation={['/', '/ideas', '/journal', '/insights']} onTheme={() => undefined} onBuildIdea={() => undefined} onRefresh={() => undefined}><div>Screen</div></AppShell>);

    expect(markup).toContain('href="#/insights" class="active" aria-current="page" data-mobile-nav-slot=""');
    expect(markup).not.toContain('Current section: Insights');
    expect(markup.match(/data-mobile-nav-slot=""/g)).toHaveLength(5);
  });

  it('uses the final glass slot to identify a secondary screen', () => {
    const markup = renderToStaticMarkup(<AppShell current="/workspace" dark={false} onTheme={() => undefined} onBuildIdea={() => undefined} onRefresh={() => undefined}><div>Screen</div></AppShell>);

    expect(markup).toContain('Current section: Workspace');
    expect(markup).toContain('<span>Workspace</span>');
  });
});
