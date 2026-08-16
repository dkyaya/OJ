import { useEffect, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { EmptyCard, ExpandablePanel, SummaryCard } from '../components/cards';
import { saveJournalReview } from '../data/actions';
import { downloadJournal } from '../features/export/markdown';
import type { Workspace } from '../types/domain';
import { PageHeader } from '../components/layout/AppShell';
import { DebriefContext, DebriefEditor } from '../components/editors/DebriefEditor';

export function JournalPage({ workspace, onSaved, initialTradeId, onInitialTradeConsumed }: { workspace: Workspace; onSaved: () => void | Promise<void>; initialTradeId?: string; onInitialTradeConsumed?: () => void }) {
  const [formOpen, setFormOpen] = useState(Boolean(initialTradeId)); const [message, setMessage] = useState('');
  useEffect(() => { if (initialTradeId && workspace.positions.some((item) => item.id === initialTradeId)) { setFormOpen(true); onInitialTradeConsumed?.(); } }, [initialTradeId, onInitialTradeConsumed, workspace.positions]);
  const debriefs = workspace.journal.filter((item) => item.kind === 'review');
  return <div className="page" data-tour-id="journal-debriefs"><PageHeader title="Journal" subtitle="Reconstruct the Trade story without rewriting history." action={<div className="action-row"><button onClick={() => downloadJournal(workspace)}><Download size={17} />Export Journal</button><button className="primary" onClick={() => setFormOpen(!formOpen)}><Plus size={17} />Add Debrief</button></div>} />
    {formOpen && <DebriefEditor workspace={workspace} initialTradeId={initialTradeId} onCancel={() => setFormOpen(false)} onSave={async (input) => { await saveJournalReview(input); setMessage('Debrief saved.'); setFormOpen(false); await onSaved(); }} />}
    {message && <p className="page-message" role="status">{message}</p>}{debriefs.length ? <div className="journal-list">{debriefs.map((item) => { const linkedTrade = workspace.positions.find((position) => position.id === item.tradeId); return <div className="object-stack" key={item.id}><SummaryCard title="Trade Debrief" subtitle={linkedTrade?.ticker || [...workspace.ideas, ...workspace.archivedIdeas].find((idea) => idea.id === item.ideaId)?.ticker || 'Linked Idea'} status={item.kind} metric={item.summary} meta={new Date(item.createdAt).toLocaleString()} />{linkedTrade && <ExpandablePanel title="Linked Trade Story" summary="Facts, original plan, evolution, and outcome."><DebriefContext trade={linkedTrade} workspace={workspace} /></ExpandablePanel>}</div>; })}</div> : <EmptyCard title="No Journal Debriefs" subtitle="Completed Trade debriefs and personal lessons will appear here. Check-Ins remain with each Trade." />}
  </div>;
}
