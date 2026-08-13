import { Archive, ArchiveRestore, Download, Pencil, Plus, ReceiptText, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyCard, ExpandablePanel, SummaryCard } from '../components/cards';
import { PageHeader } from '../components/layout/AppShell';
import { Workflow } from '../components/Workflow';
import { deleteTradeIdea, ideaDeletionError, ideaLifecycleError, setTradeIdeaArchived } from '../data/actions';
import { downloadText, tradeMarkdown } from '../features/export/markdown';
import { canConfirmIdeaDelete, deleteConfirmationFor, ideasForFilter, type IdeaFilter } from '../lib/idea-lifecycle';
import type { TradeIdea, Workspace } from '../types/domain';
import { SharedThesisPanel } from '../components/SharedThesisPanel';
import { ResearchLedger } from '../components/ResearchLedger';

function exportIdea(idea: TradeIdea, workspace: Workspace) {
  downloadText(`${idea.ticker}-${idea.id.slice(0, 8)}.md`, tradeMarkdown(idea, workspace.positions.find((item) => item.ideaId === idea.id)));
}

function ResearchDetails({ idea, workspace, tradeBacked, deleteBlocked, busy, archived, onEdit, onRecordTrade, onArchive, onDelete, onSaved }: { idea: TradeIdea; workspace: Workspace; tradeBacked: boolean; deleteBlocked: boolean; busy: boolean; archived: boolean; onEdit: () => void; onRecordTrade: () => void; onArchive: () => void; onDelete: () => void; onSaved: () => void | Promise<void> }) {
  const explanationId = `archive-explanation-${idea.id}`;
  return <ExpandablePanel title={archived ? 'Archived Research Details' : 'Research Details'} summary="Thesis, conditions, and candidate spreads.">
    {!archived && <section className="decision-record-editor"><header><div><h3>Idea Editor</h3><p>Edit current research or record a fill after execution occurs elsewhere. Linked Trade history stays unchanged.</p></div><div className="action-row"><button onClick={onEdit}><Pencil size={15} />Edit Idea</button>{!tradeBacked && ['watchlist','ready'].includes(idea.status) && <button className="primary" onClick={onRecordTrade}><ReceiptText size={15} />Record Trade</button>}</div></header></section>}
    <div className="detail-grid"><section><h3>Thesis</h3><p>{idea.thesis || 'TBD'}</p></section><section><h3>Evidence</h3><p>{idea.evidence || 'TBD'}</p></section><section><h3>Entry Conditions</h3><p>{idea.entryConditions || 'TBD'}</p></section><section><h3>Invalidation</h3><p>{idea.invalidation || 'TBD'}</p></section><section><h3>Planned Exit</h3><p>{idea.plannedExit || 'TBD'}</p></section><section><h3>Hold Through / Avoid</h3><p>{idea.holdThroughEvents.length ? `Hold: ${idea.holdThroughEvents.join(', ')}` : 'Hold-through events TBD'}</p><small>{idea.avoidEvents.length ? `Avoid: ${idea.avoidEvents.join(', ')}` : 'Avoid events TBD'}</small></section></div>
    <div className="candidate-grid">{idea.candidates.length ? idea.candidates.map((candidate) => <SummaryCard key={candidate.id} title={candidate.name} subtitle={`${candidate.longStrike ?? 'TBD'} / ${candidate.shortStrike ?? 'TBD'}`} status="Candidate" metric={candidate.maxLoss === undefined ? 'Risk TBD' : `$${candidate.maxLoss.toFixed(2)} max loss`} meta={candidate.debit === undefined ? 'Debit TBD' : `$${candidate.debit.toFixed(2)} debit`} />) : <EmptyCard title="No Candidates" subtitle="Add a defined-risk structure when research is ready." />}</div>
    <ResearchLedger workspace={workspace} tradeIdeaId={idea.id} catalystId={idea.catalystId} ticker={idea.ticker} onSaved={onSaved} />
    {!archived && <section className="idea-lifecycle-section" aria-labelledby={`lifecycle-title-${idea.id}`}>
      <div><h3 id={`lifecycle-title-${idea.id}`}>Idea lifecycle</h3><p id={explanationId}>{tradeBacked ? 'This idea has confirmed trade history and must remain in the journal.' : 'Archive hides this research from active views. You can restore it later without losing its thesis or candidates.'}</p></div>
      <button className="subtle-danger" disabled={tradeBacked || busy} aria-describedby={explanationId} onClick={onArchive}><Archive size={15} />{tradeBacked ? 'Archive unavailable' : busy ? 'Archiving…' : 'Archive Idea'}</button>
    </section>}
    {archived && <section className="idea-lifecycle-section permanent-delete-section" aria-labelledby={`delete-title-${idea.id}`}>
      <div><h3 id={`delete-title-${idea.id}`}>Permanent deletion</h3><p id={`delete-explanation-${idea.id}`}>{deleteBlocked ? 'This idea has trade or journal history and must remain in OJ.' : 'Delete removes this archived idea and its research-only records from OJ. Downloaded exports and private journal copies are separate and may remain.'}</p></div>
      <button className="subtle-danger" disabled={deleteBlocked || busy} aria-describedby={`delete-explanation-${idea.id}`} onClick={onDelete}><Trash2 size={15} />{deleteBlocked ? 'Delete unavailable' : busy ? 'Deleting…' : 'Delete Permanently'}</button>
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

export function DeleteIdeaDialog({ idea, busy, onCancel, onConfirm }: { idea?: TradeIdea; busy: boolean; onCancel: () => void; onConfirm: (confirmation: string) => void }) {
  const dialog = useRef<HTMLElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const expected = idea ? deleteConfirmationFor(idea.ticker) : '';
  const confirmed = idea ? canConfirmIdeaDelete(idea.ticker, confirmation) : false;

  useEffect(() => { setConfirmation(''); }, [idea?.id]);
  useEffect(() => {
    if (!idea) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || []);
    const focusTimer = window.setTimeout(() => confirmationInput.current?.focus(), 0);
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
    <section className="archive-dialog delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" ref={dialog}>
      <header><div><span className="eyebrow">Permanent action</span><h2 id="delete-dialog-title">Delete {idea.ticker}?</h2></div><button className="icon-button" aria-label="Close delete confirmation" disabled={busy} onClick={onCancel}><X /></button></header>
      <p id="delete-dialog-description">This permanently removes the archived idea and its research-only records from OJ. It cannot be undone. Existing downloads, Obsidian exports, and private journal copies are not recalled.</p>
      <label className="delete-confirmation"><span>Type <strong>{expected}</strong> to confirm</span><input ref={confirmationInput} autoComplete="off" spellCheck={false} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} aria-describedby="delete-dialog-description" /></label>
      <footer><button disabled={busy} onClick={onCancel}>Keep Archived</button><button className="danger-button" disabled={busy || !confirmed} onClick={() => onConfirm(confirmation)}><Trash2 size={16} />{busy ? 'Deleting…' : 'Delete Permanently'}</button></footer>
    </section>
  </div>;
}

export function IdeasPage({ workspace, onBuildIdea, onRecordTrade, onSaved, initialFilter = 'all' }: { workspace: Workspace; onBuildIdea: () => void; onRecordTrade?: (idea: TradeIdea) => void; onSaved: () => void | Promise<void>; initialFilter?: IdeaFilter }) {
  const [filter, setFilter] = useState<IdeaFilter>(initialFilter);
  const [editingIdea, setEditingIdea] = useState<TradeIdea>();
  const [pendingArchive, setPendingArchive] = useState<TradeIdea>();
  const [pendingDelete, setPendingDelete] = useState<TradeIdea>();
  const [busyIdeaId, setBusyIdeaId] = useState('');
  const [message, setMessage] = useState('');
  const ideas = ideasForFilter(workspace, filter);
  const filters: IdeaFilter[] = ['all', 'draft', 'watchlist', 'ready', 'deferred', 'rejected', 'invalidated', 'archived'];
  const exposure = new Map<string, { risk: number; active: number; ideas: number }>();
  for (const idea of workspace.ideas) for (const tag of idea.exposureTags.length ? idea.exposureTags : ['untagged']) {
    const current = exposure.get(tag) || { risk: 0, active: 0, ideas: 0 }; current.ideas += 1;
    const position = workspace.positions.find((item) => item.ideaId === idea.id && item.status === 'active');
    if (position) { current.risk += position.maxRisk || 0; current.active += 1; } exposure.set(tag, current);
  }

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

  const permanentlyDelete = async (idea: TradeIdea, confirmation: string) => {
    setBusyIdeaId(idea.id); setMessage('');
    try {
      await deleteTradeIdea({ ideaId: idea.id, expectedRevision: idea.revision, confirmation });
      setPendingDelete(undefined);
      await onSaved();
      setMessage(`${idea.ticker} was permanently deleted from OJ.`);
    } catch (error) {
      setPendingDelete(undefined);
      setMessage(error instanceof Error ? error.message : ideaDeletionError(error));
      await onSaved();
    } finally { setBusyIdeaId(''); }
  };

  return <div className="page"><PageHeader title="Ideas" subtitle="Research and compare trade setups." action={<button className="primary" onClick={onBuildIdea}><Plus size={17} />Build Idea</button>} />
    <div className="filter-bar" role="group" aria-label="Idea status">{filters.map((item) => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
    {exposure.size > 0 && <section className="card exposure-summary"><header><div><span className="eyebrow">Portfolio context</span><h2>Exposure Clusters</h2></div><p>Active maximum risk may appear in more than one tag; totals intentionally overlap.</p></header><div>{[...exposure.entries()].sort((a, b) => b[1].risk - a[1].risk).map(([tag, values]) => <article key={tag}><b>{tag}</b><strong>${values.risk.toFixed(2)}</strong><span>{values.active} active · {values.ideas} research {values.ideas === 1 ? 'path' : 'paths'}</span></article>)}</div></section>}
    {message && <p className="page-message" role="status" aria-live="polite">{message}</p>}
    {ideas.length ? <div className="idea-list">{ideas.map((idea) => {
      const archived = Boolean(idea.archivedAt); const tradeBacked = workspace.positions.some((item) => item.ideaId === idea.id); const deleteBlocked = tradeBacked || workspace.journal.some((item) => item.ideaId === idea.id); const busy = busyIdeaId === idea.id;
      const action = archived ? <div className="lifecycle-card-actions"><button className="icon-text restore-action" disabled={busy} onClick={() => void changeLifecycle(idea, false)}><ArchiveRestore size={15} />{busy ? 'Restoring…' : 'Restore'}</button><button className="icon-text" onClick={() => exportIdea(idea, workspace)}><Download size={15} />Export</button></div> : <button className="icon-text" onClick={() => exportIdea(idea, workspace)}><Download size={15} />Export</button>;
      return <div className={`object-stack${archived ? ' archived-idea' : ''}`} key={idea.id}><SummaryCard title={idea.ticker} subtitle={idea.strategy} status={archived ? 'Archived' : idea.status} metric={idea.risk === undefined ? 'Risk TBD' : `$${idea.risk.toFixed(2)} risk`} meta={archived ? `Archived ${new Date(idea.archivedAt!).toLocaleDateString()} · r${idea.revision}` : `${idea.bias} · ${idea.status} · r${idea.revision}`} action={action} />
        <ResearchDetails idea={idea} workspace={workspace} tradeBacked={tradeBacked} deleteBlocked={deleteBlocked} busy={busy} archived={archived} onEdit={() => setEditingIdea(idea)} onRecordTrade={() => onRecordTrade?.(idea)} onArchive={() => setPendingArchive(idea)} onDelete={() => setPendingDelete(idea)} onSaved={onSaved} />
      </div>;
    })}</div> : <EmptyCard title={filter === 'archived' ? 'No Archived Ideas' : 'No Matching Ideas'} subtitle={filter === 'archived' ? 'Archived research will remain available here until you restore it.' : 'Research may end with no trade. New ideas remain drafts until you decide.'} action={filter === 'archived' ? undefined : <button onClick={onBuildIdea}>Build Idea</button>} />}
    {filter !== 'archived' && <SharedThesisPanel workspace={workspace} onSaved={onSaved} />}
    <ArchiveIdeaDialog idea={pendingArchive} busy={Boolean(pendingArchive && busyIdeaId === pendingArchive.id)} onCancel={() => setPendingArchive(undefined)} onConfirm={() => pendingArchive && void changeLifecycle(pendingArchive, true)} />
    <DeleteIdeaDialog idea={pendingDelete} busy={Boolean(pendingDelete && busyIdeaId === pendingDelete.id)} onCancel={() => setPendingDelete(undefined)} onConfirm={(confirmation) => pendingDelete && void permanentlyDelete(pendingDelete, confirmation)} />
    <Workflow open={Boolean(editingIdea)} onClose={() => setEditingIdea(undefined)} onSaved={onSaved} ownerId={workspace.profile?.id || ''} idea={editingIdea} catalysts={workspace.catalysts.filter((item) => item.scheduleKind === 'scheduled').map((item) => ({ id: item.id, event: item.event, date: item.date }))} maximumRisk={workspace.policy?.maximumOpenRisk} openRisk={workspace.positions.filter((item) => item.status === 'active').reduce((total, item) => total + (item.maxRisk || 0), 0)} />
  </div>;
}
