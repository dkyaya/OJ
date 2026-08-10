import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { EmptyCard, SummaryCard } from '../components/cards';
import { saveJournalReview } from '../data/actions';
import { downloadJournal } from '../features/export/markdown';
import type { Workspace } from '../types/domain';
import { PageHeader } from '../components/layout/AppShell';

export function JournalPage({ workspace, onSaved }: { workspace: Workspace; onSaved: () => void }) {
  const [formOpen, setFormOpen] = useState(false); const [message, setMessage] = useState(''); const [form, setForm] = useState({ ideaId: '', summary: '', lesson: '', processRating: '3' });
  const save = async () => { try { await saveJournalReview({ ideaId: form.ideaId, summary: form.summary, lesson: form.lesson, processRating: Number(form.processRating) }); setMessage('Review saved.'); setFormOpen(false); onSaved(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Review failed.'); } };
  return <div className="page"><PageHeader title="Journal" subtitle="Review decisions and outcomes." action={<div className="action-row"><button onClick={() => downloadJournal(workspace)}><Download size={17} />Export Journal</button><button className="primary" onClick={() => setFormOpen(!formOpen)}><Plus size={17} />Add Review</button></div>} />
    {formOpen && <section className="card inline-form"><header><h2>Trade Review</h2><p>Evaluate execution and decision quality.</p></header><div className="form-grid"><label><span>Trade idea</span><select value={form.ideaId} onChange={(event) => setForm({ ...form, ideaId: event.target.value })}><option value="">Select an idea</option>{workspace.ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.ticker} · {idea.strategy}</option>)}</select></label><label><span>Process rating</span><select value={form.processRating} onChange={(event) => setForm({ ...form, processRating: event.target.value })}>{[1,2,3,4,5].map((rating) => <option key={rating}>{rating}</option>)}</select></label><label className="wide"><span>Summary</span><textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label><label className="wide"><span>Lesson</span><textarea value={form.lesson} onChange={(event) => setForm({ ...form, lesson: event.target.value })} /></label></div><footer><button onClick={() => setFormOpen(false)}>Cancel</button><button className="primary" disabled={!form.ideaId || !form.summary} onClick={() => void save()}>Save Review</button></footer></section>}
    {message && <p className="page-message" role="status">{message}</p>}{workspace.journal.length ? <div className="card-list">{workspace.journal.map((item) => <SummaryCard key={item.id} title={item.kind === 'review' ? 'Trade Review' : 'Trade Check-in'} subtitle={[...workspace.ideas, ...workspace.archivedIdeas].find((idea) => idea.id === item.ideaId)?.ticker || 'Linked idea'} status={item.kind} metric={item.summary} meta={new Date(item.createdAt).toLocaleString()} />)}</div> : <EmptyCard title="No Journal Records" subtitle="Check-ins and reviews will appear in chronological order." />}
  </div>;
}
