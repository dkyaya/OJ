import { EmptyCard, MetricCard, SummaryCard } from '../components/cards';
import type { Workspace } from '../types/domain';
import { PageHeader } from '../components/layout/AppShell';

export function InsightsPage({ workspace }: { workspace: Workspace }) {
  const reviewed = workspace.journal.filter((item) => item.kind === 'review'); const activeRisk = workspace.positions.filter((item) => item.status === 'active').reduce((sum, item) => sum + (item.maxRisk || 0), 0);
  const strategyCounts = workspace.ideas.reduce<Record<string, number>>((counts, idea) => ({ ...counts, [idea.strategy]: (counts[idea.strategy] || 0) + 1 }), {});
  const catalystCounts = workspace.catalysts.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.type]: (counts[item.type] || 0) + 1 }), {});
  return <div className="page"><PageHeader title="Insights" subtitle="Patterns across your trading history." />
    <section className="metric-grid"><MetricCard title="Ideas" value={workspace.ideas.length} subtitle="All researched setups." /><MetricCard title="Confirmed Trades" value={workspace.positions.length} subtitle="Actual entries only." /><MetricCard title="Reviews" value={reviewed.length} subtitle="Completed trade reviews." /><MetricCard title="Risk in Use" value={`$${activeRisk.toFixed(2)}`} subtitle="Maximum loss across active trades." /></section>
    <div className="dashboard-grid"><section><div className="section-heading"><div><h2>Strategy Mix</h2><p>How research is distributed.</p></div></div>{Object.keys(strategyCounts).length ? <div className="card-list">{Object.entries(strategyCounts).map(([strategy, count]) => <SummaryCard key={strategy} title={strategy} subtitle="Researched ideas" metric={count} />)}</div> : <EmptyCard title="No Strategy Data" subtitle="Insights begin after ideas are saved." />}</section><section><div className="section-heading"><div><h2>Catalyst Mix</h2><p>Scheduled events by category.</p></div></div>{Object.keys(catalystCounts).length ? <div className="card-list">{Object.entries(catalystCounts).map(([type, count]) => <SummaryCard key={type} title={type} subtitle="Scheduled catalysts" metric={count} />)}</div> : <EmptyCard title="No Catalyst Data" subtitle="Add scheduled events to compare categories." />}</section></div>
    <section className="card interpretation"><h2>Interpretation</h2><p>{workspace.positions.length < 5 ? 'More confirmed trades are needed before outcome rates are meaningful.' : 'Review strategy and catalyst results together before changing risk rules.'}</p></section>
  </div>;
}
