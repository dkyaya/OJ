import { Archive, ArchiveRestore, Download, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyCard, ExpandablePanel, SummaryCard } from '../components/cards';
import { PageHeader } from '../components/layout/AppShell';
import { ideaLifecycleError, setTradeIdeaArchived } from '../data/actions';
import { downloadText, tradeMarkdown } from '../features/export/markdown';
import { ideasForFilter, type IdeaFilter } from '../lib/idea-lifecycle';
import type { TradeIdea, Workspace } from '../types/domain';

function exportIdea(idea: TradeIdea, workspace: Workspace) {
  downloadText(`${idea.ticker}-${idea.id.slice(0, 8)}.md`, tradeMarkdown(idea, workspace.positions.find((item) => item.ideaId === idea.id)));
}

function ResearchDetails({ idea, tradeBacked, busy, archived, onArchive }: { idea: TradeIdea; tradeBacked: boolean; busy: boolean; archived: boolean; onArchive: () => void }) {
  const explanationId = `archive-explanation-${idea.id}`;
  return <ExpandablePanel title={archived ? 'Archived Research Details' : 'Research Details'} summary="Thesis, conditions, and candidate spreads.">
    <div className="detail-grid"><section><h3>Thesis</h3><p>{idea.thesis || 'TBD'}</p></section><section><h3>Entry Conditions</h3><p>{idea.entryConditions || 'TBD'}</p></section><section><h3>Invalidation</h3><p>{idea.invalidation || 'TBD'}</p></section><section><h3>Planned Exit</h3><p>{idea.plannedExit || 'TBD'}</p></section></div>
    <div className="candidate-grid">{idea.candidates.length ? idea.candidates.map((candidate) => <SummaryCard key={candidate.id} title={candidate.name} subtitle={`${candidate.longStrike ?? 'TBD'} / ${candidate.shortStrike ?? 'TBD'}`} status="Candidate" metric={candidate.maxLoss === undefined ? 'Risk TBD' : `$${candidate.maxLoss.toFixed(2)} max loss`} meta={candidate.debit === undefined ? 'Debit TBD' : `$${candidate.debit.toFixed(2)} debit`} />) : <EmptyCard title="No Candidates" subtitle="Add a defined-risk structure when research is ready." />}</div>
    {!archived && <section className="idea-lifecycle-section" aria-labelledby={`lifecycle-title-${idea.id}`}>
      <div><h3 id={`lifecycle-title-${idea.id}`}>Idea lifecycle</h3><p id={explanationId}>{tradeBacked ? 'This idea has confirmed trade history and must remain in the journal.' : 'Archive hides this research from active views. You can restore it later without losing its thesis or candidates.'}</p></div>
      <button className="subtle-danger" disabled={tradeBacked || busy} aria-describedby={explanationId} onClick={onArchive}><Archive size={15} />{tradeBacked ? 'Archive unavailable' : busy ? 'Archiving…' : 'Archive Idea'}</button>
    </section>}
  </ExpandablePanel>;
}

export function ArchiveIdeaDialog({ idea, busy, onCancel, onConfirm }: { idea?: TradeIdea; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!idea) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    const focusTimer = window.setTimeout(() => focusable()[0]?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable(); if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [busy, idea, onCancel]);
  if (!idea) return null;
  return <div className="modal-backdrop archive-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-dialog-title" aria-describedby="archive-dialog-description" ref={dialog}>
      <header><div><span className="eyebrow">Reversible archive</span><h2 id="archive-dialog-title">Archive {idea.ticker}?</h2></div><button className="icon-button" aria-label="Close archive confirmation" disabled={busy} onClick={onCancel}><X /></button></header>
      <p id="archive-dialog-description">This removes the idea from active views and catalyst counts. Its status, research, candidates, revisions, and export remain intact in Archived. You can restore it later.</p>
      <footer><button disabled={busy} onClick={onCancel}>Keep Idea</button><button className="danger-button" disabled={busy} onClick={onConfirm}><Archive size={16} />{busy ? 'Archiving…' : 'Archive Idea'}</button></footer>
    </section>
  </div>;
}

export function IdeasPage({ workspace, onBuildIdea, onSaved, initialFilter = 'all' }: { workspace: Workspace; onBuildIdea: () => void; onSaved: () => void | Promise<void>; initialFilter?: IdeaFilter }) {
  const [filter, setFilter] = useState<IdeaFilter>(initialFilter);
  const [pendingArchive, setPendingArchive] = useState<TradeIdea>();
  const [busyIdeaId, setBusyIdeaId] = useState('');
  const [message, setMessage] = useState('');
  const ideas = ideasForFilter(workspace, filter);
  const filters: IdeaFilter[] = ['all', 'watchlist', 'ready', 'deferred', 'archived'];

  const changeLifecycle = async (idea: TradeIdea, archived: boolean) => {
    setBusyIdeaId(idea.id); setMessage('');
    try {
      await setTradeIdeaArchived({ ideaId: idea.id, expectedRevision: idea.revision, archived });
      setPendingArchive(undefined);
      await onSaved();
      setMessage(archived ? `${idea.ticker} moved to Archived.` : `${idea.ticker} restored to active Ideas.`);
      if (!archived) setFilter('all');
    } catch (error) {
      setPendingArchive(undefined);
      setMessage(error instanceof Error ? error.message : ideaLifecycleError(error));
      await onSaved();
    } finally { setBusyIdeaId(''); }
  };

  return <div className="page"><PageHeader title="Ideas" subtitle="Research and compare trade setups." action={<button className="primary" onClick={onBuildIdea}><Plus size={17} />Build Idea</button>} />
    <div className="filter-bar" role="group" aria-label="Idea status">{filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item}</button>)}</div>
    {message && <p className="page-message" role="status" aria-live="polite">{message}</p>}
    {ideas.length ? <div className="idea-list">{ideas.map((idea) => {
      const archived = Boolean(idea.archivedAt); const tradeBacked = workspace.positions.some((item) => item.ideaId === idea.id); const busy = busyIdeaId === idea.id;
      const action = archived ? <div className="lifecycle-card-actions"><button className="icon-text restore-action" disabled={busy} onClick={() => void changeLifecycle(idea, false)}><ArchiveRestore size={15} />{busy ? 'Restoring…' : 'Restore'}</button><button className="icon-text" onClick={() => exportIdea(idea, workspace)}><Download size={15} />Export</button></div> : <button className="icon-text" onClick={() => exportIdea(idea, workspace)}><Download size={15} />Export</button>;
      return <div className={`object-stack${archived ? ' archived-idea' : ''}`} key={idea.id}><SummaryCard title={idea.ticker} subtitle={idea.strategy} status={archived ? 'Archived' : idea.status} metric={idea.risk === undefined ? 'Risk TBD' : `$${idea.risk.toFixed(2)} risk`} meta={archived ? `Archived ${new Date(idea.archivedAt!).toLocaleDateString()} · r${idea.revision}` : `${idea.bias} · r${idea.revision}`} action={action} />
        <ResearchDetails idea={idea} tradeBacked={tradeBacked} busy={busy} archived={archived} onArchive={() => setPendingArchive(idea)} />
      </div>;
    })}</div> : <EmptyCard title={filter === 'archived' ? 'No Archived Ideas' : 'No Matching Ideas'} subtitle={filter === 'archived' ? 'Archived research will remain available here until you restore it.' : 'Research may end with no trade. New ideas remain drafts until you decide.'} action={filter === 'archived' ? undefined : <button onClick={onBuildIdea}>Build Idea</button>} />}
    <ArchiveIdeaDialog idea={pendingArchive} busy={Boolean(pendingArchive && busyIdeaId === pendingArchive.id)} onCancel={() => setPendingArchive(undefined)} onConfirm={() => pendingArchive && void changeLifecycle(pendingArchive, true)} />
  </div>;
}
