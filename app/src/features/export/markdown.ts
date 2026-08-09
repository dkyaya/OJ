import type { Catalyst, JournalRecord, Position, TradeIdea, Workspace } from '../../types/domain';
import { createZip } from './zip';

const value = (input: unknown) => input === undefined || input === null || input === '' ? 'TBD' : String(input);
const yaml = (input: unknown) => JSON.stringify(value(input));
const safeName = (input: string) => input.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'record';

export function tradeMarkdown(idea: TradeIdea, position?: Position) {
  return `---\nrecord_type: trade_idea\nid: ${yaml(idea.id)}\nticker: ${yaml(idea.ticker)}\nstrategy: ${yaml(idea.strategy)}\nstatus: ${yaml(idea.status)}\nrevision: ${idea.revision}\nexported_from: OJ\n---\n\n# ${idea.ticker} ${idea.strategy}\n\n## Thesis\n\n${value(idea.thesis)}\n\n## Candidates\n\n${idea.candidates.length ? idea.candidates.map((candidate) => `### ${candidate.name}\n\n- Long strike: ${value(candidate.longStrike)}\n- Short strike: ${value(candidate.shortStrike)}\n- Debit: ${value(candidate.debit)}\n- Contracts: ${value(candidate.contracts)}\n- Maximum loss: ${value(candidate.maxLoss)}\n- Maximum profit: ${value(candidate.maxProfit)}\n- Break-even: ${value(candidate.breakEven)}`).join('\n\n') : 'TBD'}\n\n## Entry\n\n${position ? `Confirmed position opened ${position.openedAt}; ${position.contracts} contract(s).` : 'Not entered.'}\n\n## Entry Conditions\n\n${value(idea.entryConditions)}\n\n## Invalidation\n\n${value(idea.invalidation)}\n\n## Planned Exit\n\n${value(idea.plannedExit)}\n\n## Catalyst\n\n${value(idea.catalystId)}\n`;
}

export function catalystMarkdown(catalyst: Catalyst) {
  return `---\nrecord_type: catalyst\nid: ${yaml(catalyst.id)}\nevent_type: ${yaml(catalyst.type)}\nevent_at: ${yaml(catalyst.date)}\nstatus: ${yaml(catalyst.status)}\nrevision: ${catalyst.revision}\nexported_from: OJ\n---\n\n# ${catalyst.event}\n\n## Schedule\n\n- Date: ${value(catalyst.date)}\n- Sensitivity: ${value(catalyst.sensitivity)}\n- Source: ${value(catalyst.source)}\n- Cluster: ${value(catalyst.cluster)}\n\n## Linked Securities\n\n${catalyst.linkedTickers.length ? catalyst.linkedTickers.map((ticker) => `- ${ticker}`).join('\n') : 'TBD'}\n`;
}

function positionMarkdown(position: Position, idea?: TradeIdea) {
  return `---\nrecord_type: trade\nid: ${yaml(position.id)}\ntrade_idea_id: ${yaml(position.ideaId)}\nstatus: ${yaml(position.status)}\ncontracts: ${position.contracts}\nrevision: ${position.revision}\nexported_from: OJ\n---\n\n# ${position.ticker} ${position.strategy}\n\n- Opened: ${value(position.openedAt)}\n- Closed: ${value(position.closedAt)}\n- Maximum risk: ${value(position.maxRisk)}\n- Linked idea: ${value(idea?.id)}\n\n## Thesis\n\n${value(idea?.thesis)}\n`;
}

function journalMarkdown(entry: JournalRecord, idea?: TradeIdea) {
  return `---\nrecord_type: ${yaml(entry.kind)}\nid: ${yaml(entry.id)}\ntrade_idea_id: ${yaml(entry.ideaId)}\ncreated_at: ${yaml(entry.createdAt)}\nexported_from: OJ\n---\n\n# ${entry.kind === 'review' ? 'Trade Review' : 'Trade Check-in'}\n\n- Idea: ${value(idea ? `${idea.ticker} ${idea.strategy}` : entry.ideaId)}\n- Created: ${value(entry.createdAt)}\n\n## Summary\n\n${value(entry.summary)}\n`;
}

export function journalExportFiles(workspace: Workspace) {
  const files: Record<string, string> = {
    'README.md': '# OJ Journal Export\n\nGenerated from the signed-in user’s canonical Supabase records. Import this folder into Obsidian if desired. OJ does not require this mirror.\n',
    'Dashboard.md': `# OJ Dashboard\n\n- Ideas: ${workspace.ideas.length}\n- Catalysts: ${workspace.catalysts.length}\n- Active trades: ${workspace.positions.filter((item) => item.status === 'active').length}\n- Closed trades: ${workspace.positions.filter((item) => item.status === 'closed').length}\n- Journal records: ${workspace.journal.length}\n`,
  };
  for (const idea of workspace.ideas) {
    const position = workspace.positions.find((item) => item.ideaId === idea.id);
    files[`Trade Ideas/${safeName(`${idea.ticker}-${idea.strategy}-${idea.id.slice(0, 8)}`)}.md`] = tradeMarkdown(idea, position);
  }
  for (const catalyst of workspace.catalysts) files[`Catalysts/${safeName(`${catalyst.date || 'TBD'}-${catalyst.event}-${catalyst.id.slice(0, 8)}`)}.md`] = catalystMarkdown(catalyst);
  for (const position of workspace.positions) {
    const folder = position.status === 'active' ? 'Active Trades' : 'Closed Trades';
    files[`${folder}/${safeName(`${position.ticker}-${position.id.slice(0, 8)}`)}.md`] = positionMarkdown(position, workspace.ideas.find((idea) => idea.id === position.ideaId));
  }
  for (const entry of workspace.journal) files[`Journal/${safeName(`${entry.createdAt.slice(0, 10)}-${entry.kind}-${entry.id.slice(0, 8)}`)}.md`] = journalMarkdown(entry, workspace.ideas.find((idea) => idea.id === entry.ideaId));
  files['Journal/Journal Index.md'] = `# Journal\n\n${workspace.journal.length ? workspace.journal.map((item) => `- ${item.createdAt}: ${item.summary}`).join('\n') : 'No journal records.'}\n`;
  files['Research/Catalyst Index.md'] = `# Catalyst Research\n\n${workspace.catalysts.length ? workspace.catalysts.map((item) => `- ${item.date || 'TBD'} — ${item.event} (${item.linkedTickers.join(', ') || 'mapping TBD'})`).join('\n') : 'No catalyst research.'}\n`;
  files['Research/Account Policy.md'] = workspace.policy ? `# Account Policy\n\n- Effective: ${workspace.policy.effectiveDate}\n- Total capital: ${workspace.policy.totalCapital}\n- Maximum open options risk: ${workspace.policy.maximumOpenRisk}\n- Fixed per-trade limit: ${value(workspace.policy.fixedPerTradeLimit)}\n- Strategies: ${workspace.policy.strategies.join(', ') || 'TBD'}\n- Version: ${workspace.policy.version}\n` : '# Account Policy\n\nTBD\n';
  return files;
}

export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

export function downloadJournal(workspace: Workspace) {
  const zip = createZip(journalExportFiles(workspace));
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'OJ-Journal-Export.zip'; anchor.click(); URL.revokeObjectURL(url);
}
