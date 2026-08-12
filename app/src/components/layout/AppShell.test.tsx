import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('responsive application navigation', () => {
  it('keeps every primary section visible in the mobile glass navbar', () => {
    const markup = renderToStaticMarkup(<AppShell current="/insights" dark={false} onTheme={() => undefined} onBuildIdea={() => undefined} onRefresh={() => undefined}><div>Screen</div></AppShell>);

    expect(markup).toContain('href="#/insights" class="active" aria-current="page"');
    expect(markup).toContain('<span>Insights</span>');
    expect(markup).toContain('Drag the glass selection or tap a section');
  });

  it('uses the final glass slot to identify a secondary screen', () => {
    const markup = renderToStaticMarkup(<AppShell current="/workspace" dark={false} onTheme={() => undefined} onBuildIdea={() => undefined} onRefresh={() => undefined}><div>Screen</div></AppShell>);

    expect(markup).toContain('Current section: Workspace');
    expect(markup).toContain('<span>Workspace</span>');
  });
});
