import { Download, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyCard, ExpandablePanel, SummaryCard } from '../components/cards';
import { downloadText, tradeMarkdown } from '../features/export/markdown';
import type { Workspace } from '../types/domain';
import { PageHeader } from '../components/layout/AppShell';

export function IdeasPage({ workspace, onBuildIdea }: { workspace: Workspace; onBuildIdea: () => void }) {
  const [filter, setFilter] = useState('all'); const ideas = filter === 'all' ? workspace.ideas : workspace.ideas.filter((idea) => idea.status === filter);
  return <div className="page"><PageHeader title="Ideas" subtitle="Research and compare trade setups." action={<button className="primary" onClick={onBuildIdea}><Plus size={17} />Build Idea</button>} />
    <div className="filter-bar" role="group" aria-label="Idea status">{['all','watchlist','ready','deferred'].map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item}</button>)}</div>
    {ideas.length ? <div className="idea-list">{ideas.map((idea) => <div className="object-stack" key={idea.id}><SummaryCard title={idea.ticker} subtitle={idea.strategy} status={idea.status} metric={idea.risk === undefined ? 'Risk TBD' : `$${idea.risk.toFixed(2)} risk`} meta={`${idea.bias} · r${idea.revision}`} action={<button className="icon-text" onClick={() => downloadText(`${idea.ticker}-${idea.id.slice(0, 8)}.md`, tradeMarkdown(idea, workspace.positions.find((item) => item.ideaId === idea.id)))}><Download size={15} />Export</button>} />
        <ExpandablePanel title="Research Details" summary="Thesis, conditions, and candidate spreads."><div className="detail-grid"><section><h3>Thesis</h3><p>{idea.thesis || 'TBD'}</p></section><section><h3>Entry Conditions</h3><p>{idea.entryConditions || 'TBD'}</p></section><section><h3>Invalidation</h3><p>{idea.invalidation || 'TBD'}</p></section><section><h3>Planned Exit</h3><p>{idea.plannedExit || 'TBD'}</p></section></div><div className="candidate-grid">{idea.candidates.length ? idea.candidates.map((candidate) => <SummaryCard key={candidate.id} title={candidate.name} subtitle={`${candidate.longStrike ?? 'TBD'} / ${candidate.shortStrike ?? 'TBD'}`} status="Candidate" metric={candidate.maxLoss === undefined ? 'Risk TBD' : `$${candidate.maxLoss.toFixed(2)} max loss`} meta={candidate.debit === undefined ? 'Debit TBD' : `$${candidate.debit.toFixed(2)} debit`} />) : <EmptyCard title="No Candidates" subtitle="Add a defined-risk structure when research is ready." />}</div></ExpandablePanel></div>)}</div> : <EmptyCard title="No Matching Ideas" subtitle="Research may end with no trade. New ideas remain drafts until you decide." action={<button onClick={onBuildIdea}>Build Idea</button>} />}
  </div>;
}
