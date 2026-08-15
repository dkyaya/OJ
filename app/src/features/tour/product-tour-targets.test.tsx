import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CatalystWarRoom } from '../../components/CatalystWarRoom';
import { emptyWorkspace } from '../../data/workspace';
import { demoWorkspace } from '../../data/demo';
import { CatalystsPage } from '../../pages/CatalystsPage';
import { IdeasPage } from '../../pages/IdeasPage';
import { InsightsPage } from '../../pages/InsightsPage';
import { JournalPage } from '../../pages/JournalPage';
import { OverviewPage } from '../../pages/OverviewPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { TradesPage } from '../../pages/TradesPage';

const noop = () => undefined;

describe('product tour semantic targets', () => {
  it('keeps route anchors stable for populated accounts', () => {
    const pages = [
      renderToStaticMarkup(<OverviewPage workspace={demoWorkspace} onBuildIdea={noop} />),
      renderToStaticMarkup(<CatalystsPage workspace={demoWorkspace} onSaved={noop} />),
      renderToStaticMarkup(<CatalystWarRoom catalyst={demoWorkspace.catalysts[0]} workspace={demoWorkspace} onBack={noop} onSaved={noop} />),
      renderToStaticMarkup(<IdeasPage workspace={demoWorkspace} onBuildIdea={noop} onSaved={noop} />),
      renderToStaticMarkup(<TradesPage workspace={demoWorkspace} onSaved={noop} onDebrief={noop} />),
      renderToStaticMarkup(<JournalPage workspace={demoWorkspace} onSaved={noop} />),
      renderToStaticMarkup(<InsightsPage workspace={demoWorkspace} />),
      renderToStaticMarkup(<SettingsPage workspace={demoWorkspace} onSaved={noop} />),
    ].join('\n');
    for (const target of ['overview-shell','overview-risk','catalyst-calendar','catalyst-war-room','ideas-shell','idea-candidates','record-trade-action','trade-monitoring','journal-debriefs','insights-shell','tour-guidance']) {
      expect(pages).toContain(`data-tour-id="${target}"`);
    }
  });

  it('keeps empty-account route anchors while allowing example-dependent fallback', () => {
    const empty = { ...emptyWorkspace(), authenticated: true, approved: true, profile: demoWorkspace.profile };
    const pages = [
      renderToStaticMarkup(<OverviewPage workspace={empty} onBuildIdea={noop} />),
      renderToStaticMarkup(<CatalystsPage workspace={empty} onSaved={noop} />),
      renderToStaticMarkup(<IdeasPage workspace={empty} onBuildIdea={noop} onSaved={noop} />),
      renderToStaticMarkup(<TradesPage workspace={empty} onSaved={noop} onDebrief={noop} />),
      renderToStaticMarkup(<JournalPage workspace={empty} onSaved={noop} />),
      renderToStaticMarkup(<InsightsPage workspace={empty} />),
      renderToStaticMarkup(<SettingsPage workspace={empty} onSaved={noop} />),
    ].join('\n');
    for (const target of ['overview-shell','overview-risk','catalyst-calendar','ideas-shell','record-trade-action','trade-monitoring','journal-debriefs','insights-shell','tour-guidance']) {
      expect(pages).toContain(`data-tour-id="${target}"`);
    }
    expect(pages).not.toContain('data-tour-id="idea-candidates"');
  });
});
