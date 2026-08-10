import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { ideasForFilter } from '../lib/idea-lifecycle';
import type { Position, TradeIdea, Workspace } from '../types/domain';
import { ArchiveIdeaDialog, IdeasPage } from './IdeasPage';

const archivedIdea: TradeIdea = {
  ...demoWorkspace.ideas[0],
  id: '10000000-0000-4000-8000-000000000099',
  ticker: 'ARCHIVE',
  status: 'ready',
  archivedAt: '2026-08-10T18:00:00.000Z',
  revision: 4,
};

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return { ...demoWorkspace, ideas: [...demoWorkspace.ideas], archivedIdeas: [archivedIdea], ...overrides };
}

describe('idea archive presentation', () => {
  it('separates archived research from every active filter without losing candidates', () => {
    const current = workspace();
    expect(ideasForFilter(current, 'all').map((idea) => idea.ticker)).not.toContain('ARCHIVE');
    expect(ideasForFilter(current, 'ready')).toHaveLength(0);
    expect(ideasForFilter(current, 'archived')[0].candidates).toHaveLength(1);
  });

  it('renders Archived, Restore, Export, and preserved research without an archive action', () => {
    const html = renderToStaticMarkup(<IdeasPage workspace={workspace()} onBuildIdea={() => undefined} onSaved={() => undefined} initialFilter="archived" />);
    expect(html).toContain('data-status="archived"');
    expect(html).toContain('Restore');
    expect(html).toContain('Export');
    expect(html).toContain('Balanced');
    expect(html).not.toContain('Archive unavailable');
  });

  it('explains why trade-backed ideas cannot be archived', () => {
    const idea = demoWorkspace.ideas[0];
    const position: Position = { id: 'position', ideaId: idea.id, ticker: idea.ticker, strategy: idea.strategy, status: 'closed', contracts: 1, openedAt: '2026-08-01T12:00:00Z', closedAt: '2026-08-02T12:00:00Z', revision: 1, data: {} };
    const html = renderToStaticMarkup(<IdeasPage workspace={workspace({ archivedIdeas: [], positions: [position] })} onBuildIdea={() => undefined} onSaved={() => undefined} />);
    expect(html).toContain('Archive unavailable');
    expect(html).toContain('confirmed trade history');
    expect(html).toContain('disabled');
  });

  it('uses an explicit modal confirmation with a reversible-archive explanation', () => {
    const html = renderToStaticMarkup(<ArchiveIdeaDialog idea={demoWorkspace.ideas[0]} busy={false} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Archive DEMO?');
    expect(html).toContain('Keep Idea');
    expect(html).toContain('You can restore it later');
  });
});
