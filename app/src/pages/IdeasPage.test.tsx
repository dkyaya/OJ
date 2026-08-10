import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { canConfirmIdeaDelete, deleteConfirmationFor, ideasForFilter } from '../lib/idea-lifecycle';
import type { Position, TradeIdea, Workspace } from '../types/domain';
import { ArchiveIdeaDialog, DeleteIdeaDialog, IdeasPage } from './IdeasPage';

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

  it('renders Archive, Restore, and Delete as separate lifecycle actions', () => {
    const html = renderToStaticMarkup(<IdeasPage workspace={workspace()} onBuildIdea={() => undefined} onSaved={() => undefined} initialFilter="archived" />);
    expect(html).toContain('data-status="archived"');
    expect(html).toContain('Restore');
    expect(html).toContain('Export');
    expect(html).toContain('Delete Permanently');
    expect(html).toContain('Permanent deletion');
    expect(html).toContain('Balanced');
    expect(html).not.toContain('Archive unavailable');
    expect(html).not.toContain('Archive Idea');
  });

  it('does not offer permanent deletion before an idea is archived', () => {
    const html = renderToStaticMarkup(<IdeasPage workspace={workspace({ archivedIdeas: [] })} onBuildIdea={() => undefined} onSaved={() => undefined} />);
    expect(html).toContain('Archive Idea');
    expect(html).not.toContain('Delete Permanently');
  });

  it('disables permanent deletion when archived research has journal history', () => {
    const html = renderToStaticMarkup(<IdeasPage workspace={workspace({ journal: [{ id: 'review', ideaId: archivedIdea.id, kind: 'review', createdAt: '2026-08-10T19:00:00Z', summary: 'Keep this history', data: {} }] })} onBuildIdea={() => undefined} onSaved={() => undefined} initialFilter="archived" />);
    expect(html).toContain('Delete unavailable');
    expect(html).toContain('trade or journal history');
    expect(html).toContain('disabled');
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

  it('requires an exact ticker-specific phrase for permanent deletion', () => {
    const html = renderToStaticMarkup(<DeleteIdeaDialog idea={archivedIdea} busy={false} onCancel={() => undefined} onConfirm={() => undefined} />);
    expect(html).toContain('Permanent action');
    expect(html).toContain('DELETE ARCHIVE');
    expect(html).toContain('cannot be undone');
    expect(html).toContain('private journal copies are not recalled');
    expect(html).toContain('disabled');
    expect(deleteConfirmationFor('SPY')).toBe('DELETE SPY');
    expect(canConfirmIdeaDelete('SPY', 'DELETE SPY')).toBe(true);
    expect(canConfirmIdeaDelete('SPY', 'delete spy')).toBe(false);
  });
});
