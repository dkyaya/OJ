import type { Catalyst, JournalRecord, Position, TradeIdea, Workspace } from '../../types/domain';
import { createZip } from './zip';

const value = (input: unknown) => input === undefined || input === null || input === '' ? 'TBD' : String(input);
const yaml = (input: unknown) => JSON.stringify(value(input));
const safeName = (input: string) => input.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-|-$/g, '') || 'record';

function legacyTradeMarkdown(idea: TradeIdea, position?: Position) {
  return `---\nrecord_type: trade_idea\nid: ${yaml(idea.id)}\nticker: ${yaml(idea.ticker)}\nstrategy: ${yaml(idea.strategy)}\nstatus: ${yaml(idea.status)}\nrevision: ${idea.revision}\nexported_from: OJ\n---\n\n# ${idea.ticker} ${idea.strategy}\n\n## Thesis\n\n${value(idea.thesis)}\n\n## Candidates\n\n${idea.candidates.length ? idea.candidates.map((candidate) => `### ${candidate.name}\n\n- Long strike: ${value(candidate.longStrike)}\n- Short strike: ${value(candidate.shortStrike)}\n- Debit: ${value(candidate.debit)}\n- Contracts: ${value(candidate.contracts)}\n- Maximum loss: ${value(candidate.maxLoss)}\n- Maximum profit: ${value(candidate.maxProfit)}\n- Break-even: ${value(candidate.breakEven)}`).join('\n\n') : 'TBD'}\n\n## Entry\n\n${position ? `Confirmed position opened ${position.openedAt}; ${position.contracts} contract(s).` : 'Not entered.'}\n\n## Entry Conditions\n\n${value(idea.entryConditions)}\n\n## Invalidation\n\n${value(idea.invalidation)}\n\n## Planned Exit\n\n${value(idea.plannedExit)}\n\n## Catalyst\n\n${value(idea.catalystId)}\n`;
}

export function tradeMarkdown(idea: TradeIdea, position?: Position) {
  const base = legacyTradeMarkdown(idea, position).replace(
    `status: ${yaml(idea.status)}\nrevision:`,
    `status: ${yaml(idea.status)}\nresearch_stage: ${yaml(idea.researchStage)}\nexposure_tags: ${JSON.stringify(idea.exposureTags)}\nrevision:`,
  );
  return `${base}\n## Decision Timing\n\n- Next decision: ${value(idea.nextDecisionAt)}\n- Earliest entry: ${value(idea.earliestEntryAt)}\n- Latest entry: ${value(idea.latestEntryAt)}\n\n## Exposure Tags\n\n${idea.exposureTags.length ? idea.exposureTags.map((item) => `- ${item}`).join('\n') : 'TBD'}\n\n## Risk Exception\n\n${idea.riskOvershootAcknowledged ? value(idea.riskOvershootNote) : 'None. OJ did not auto-size or route an order.'}\n`;
}

function legacyCatalystMarkdown(catalyst: Catalyst) {
  return `---\nrecord_type: catalyst\nid: ${yaml(catalyst.id)}\ncategory: ${yaml(catalyst.category)}\nlegacy_event_type: ${yaml(catalyst.type)}\nevent_at: ${yaml(catalyst.date)}\nstatus: ${yaml(catalyst.status)}\nrevision: ${catalyst.revision}\nexported_from: OJ\n---\n\n# ${catalyst.event}\n\n## Schedule\n\n- Date: ${value(catalyst.date)}\n- Category: ${value(catalyst.category || catalyst.type)}\n- Sensitivity: ${value(catalyst.sensitivity)}\n- Source: ${value(catalyst.source)}\n- Cluster: ${value(catalyst.cluster)}\n\n## Linked Securities\n\n${catalyst.linkedTickers.length ? catalyst.linkedTickers.map((ticker) => `- ${ticker}`).join('\n') : 'TBD'}\n`;
}

export function catalystMarkdown(catalyst: Catalyst) {
  const base = legacyCatalystMarkdown(catalyst).replace(
    `category: ${yaml(catalyst.category)}\nlegacy_event_type: ${yaml(catalyst.type)}\nevent_at: ${yaml(catalyst.date)}\nstatus:`,
    `category: ${yaml(catalyst.category)}\nlegacy_event_type: ${yaml(catalyst.type)}\nschedule_kind: ${yaml(catalyst.scheduleKind)}\nevent_at: ${yaml(catalyst.eventAt)}\ndate_certainty: ${yaml(catalyst.dateCertainty)}\nevent_status: ${yaml(catalyst.eventStatus)}\ntags: ${JSON.stringify(catalyst.tags)}\nstatus:`,
  );
  return `${base}\n## Verified Schedule\n\n- Local time: ${value(catalyst.scheduledTime)}\n- Timezone: ${value(catalyst.timezoneName)}\n- Market session: ${value(catalyst.marketSession)}\n- Date certainty: ${value(catalyst.dateCertainty)}\n\n## Expectations\n\n- Consensus: ${value(catalyst.consensus)}\n- Prior: ${value(catalyst.prior)}\n- Actual: ${value(catalyst.actual)}\n- Surprise: ${value(catalyst.surprise)}\n\n## Why It Matters\n\n${value(catalyst.whyMatters)}\n\n### Key Variables\n\n${catalyst.keyVariables.length ? catalyst.keyVariables.map((item) => `- ${item}`).join('\n') : 'TBD'}\n\n## Market Response\n\n- Cross-asset: ${value(catalyst.crossAssetReaction)}\n- Rates: ${value(catalyst.ratesReaction)}\n- Sectors: ${value(catalyst.sectorReaction)}\n- Interpretation: ${value(catalyst.postEventInterpretation)}\n\n## Verification\n\n- Source URL: ${value(catalyst.sourceUrl)}\n- Quality: ${value(catalyst.sourceQuality)}\n- Last verified: ${value(catalyst.lastVerifiedAt)}\n`;
}

function positionMarkdown(position: Position, idea?: TradeIdea) {
  const context = position.entryContext;
  return `---\nrecord_type: trade\nid: ${yaml(position.id)}\ntrade_idea_id: ${yaml(position.ideaId)}\nstatus: ${yaml(position.status)}\ntrade_class: ${yaml(position.tradeClass)}\ncontracts: ${position.contracts}\nrevision: ${position.revision}\nexported_from: OJ\n---\n\n# ${position.ticker} ${position.strategy}\n\n## Actual Trade Structure\n\n- Opened: ${value(position.openedAt)}\n- Closed: ${value(position.closedAt)}\n- Expiration: ${value(position.expiration)}\n- Long strike: ${value(position.longStrike)}\n- Short strike: ${value(position.shortStrike)}\n- Actual debit: ${value(position.actualDebit)}\n- Entry fees: ${value(position.entryFees)}\n- Maximum loss: ${value(position.maxRisk)}\n- Maximum profit: ${value(position.maxProfit)}\n- Break-even: ${value(position.breakEven)}\n- Linked idea: ${value(idea?.id)}\n\n## Entry Thesis\n\n${value(context?.thesis)}\n\n- Idea revision at entry: ${value(context?.ideaRevision)}\n- Evidence: ${value(context?.evidence)}\n- Entry conditions: ${value(context?.entryConditions)}\n- Invalidation: ${value(context?.invalidation)}\n- Planned exit: ${value(context?.plannedExit)}\n- Hold through: ${context?.holdThroughEvents.length ? context.holdThroughEvents.join(', ') : 'TBD'}\n- Avoid: ${context?.avoidEvents.length ? context.avoidEvents.join(', ') : 'TBD'}\n- Originating catalyst: ${value(context?.originatingCatalystId)}\n- Linked catalysts: ${context?.linkedCatalysts.length ? context.linkedCatalysts.map((item) => `${item.catalystId} (${item.relationship})`).join(', ') : 'TBD'}\n- Research snapshots: ${context?.researchSnapshotIds.length ? context.researchSnapshotIds.join(', ') : 'TBD'}\n- Locked forecasts: ${context?.forecastIds.length ? context.forecastIds.join(', ') : 'TBD'}\n\n## Planned Candidate at Entry\n\n- Candidate: ${value(context?.candidate?.id)}\n- Candidate revision: ${value(context?.candidate?.revision)}\n- Expiration: ${value(context?.candidate?.expiration)}\n- Strikes: ${value(context?.candidate?.longStrike)} / ${value(context?.candidate?.shortStrike)}\n- Planned debit: ${value(context?.candidate?.plannedDebit)}\n- Planned contracts: ${value(context?.candidate?.plannedContracts)}\n- Planned maximum loss: ${value(context?.candidate?.plannedMaxLoss)}\n- Planned maximum profit: ${value(context?.candidate?.plannedMaxProfit)}\n- Planned break-even: ${value(context?.candidate?.plannedBreakEven)}\n\n## Thesis Evolution\n\n${position.checkins.length ? position.checkins.map((checkin) => `### ${checkin.checkedAt} — ${checkin.thesisHealth}\n\n${value(checkin.whatChanged)}\n\nCurrent management view: ${value(checkin.managementView)}\n\n- Price changed: ${checkin.priceChanged}\n- Catalyst changed: ${checkin.catalystChanged}\n- Volatility changed: ${checkin.volatilityChanged}\n- Macro changed: ${checkin.macroChanged}\n- Planned exit state: ${checkin.plannedExitState}\n- Invalidation occurred: ${checkin.invalidationOccurred}\n- Notes: ${value(checkin.notes)}`).join('\n\n') : 'No check-ins recorded.'}\n\n## Exit\n\n${position.exit ? `- Exited: ${position.exit.exitedAt}\n- Value: ${position.exit.exitValue} ${position.exit.exitValueType}\n- Fees: ${position.exit.fees}\n- Realized P/L: ${position.exit.realizedPnl}\n- Reason: ${position.exit.exitReason}\n- Thesis at exit: ${position.exit.thesisHealth}\n- Catalyst relationship: ${value(position.exit.catalystRelationship)}\n\n${value(position.exit.notes)}` : 'Open Trade.'}\n\n## Current Linked Idea\n\n${value(idea?.thesis)}\n`;
}

function journalMarkdown(entry: JournalRecord, idea?: TradeIdea) {
  const detail = (key: string) => value(entry.data[key]);
  const reflection = entry.kind === 'review' ? `\n## Outcome and Reflection\n\n- Catalyst outcome: ${detail('Catalyst outcome')}\n- What was right: ${detail('What was right')}\n- What was wrong: ${detail('What was wrong')}\n- What to repeat: ${detail('Repeat')}\n- What to avoid: ${detail('Avoid next time')}\n\n## Lesson\n\n${detail('Lesson')}\n` : '';
  return `---\nrecord_type: ${yaml(entry.kind)}\nid: ${yaml(entry.id)}\ntrade_idea_id: ${yaml(entry.ideaId)}\ntrade_id: ${yaml(entry.tradeId)}\ncreated_at: ${yaml(entry.createdAt)}\nexported_from: OJ\n---\n\n# ${entry.kind === 'review' ? 'Trade Debrief' : 'Trade Check-in'}\n\n- Idea: ${value(idea ? `${idea.ticker} ${idea.strategy}` : entry.ideaId)}\n- Created: ${value(entry.createdAt)}\n\n## Summary\n\n${value(entry.summary)}\n${reflection}`;
}

export function journalExportFiles(workspace: Workspace) {
  const files: Record<string, string> = {
    'README.md': '# OJ Journal Export\n\nGenerated from the signed-in user’s canonical Supabase records. Import this folder into Obsidian if desired. OJ does not require this mirror.\n',
    'Dashboard.md': `# OJ Dashboard\n\n- Active ideas: ${workspace.ideas.length}\n- Archived ideas: ${workspace.archivedIdeas.length}\n- Catalysts: ${workspace.catalysts.length}\n- Active trades: ${workspace.positions.filter((item) => item.status === 'active').length}\n- Closed trades: ${workspace.positions.filter((item) => item.status === 'closed').length}\n- Journal records: ${workspace.journal.length}\n`,
  };
  for (const idea of workspace.ideas) {
    const position = workspace.positions.find((item) => item.ideaId === idea.id);
    files[`Trade Ideas/${safeName(`${idea.ticker}-${idea.strategy}-${idea.id.slice(0, 8)}`)}.md`] = tradeMarkdown(idea, position);
  }
  for (const idea of workspace.archivedIdeas) files[`Archived Ideas/${safeName(`${idea.ticker}-${idea.strategy}-${idea.id.slice(0, 8)}`)}.md`] = tradeMarkdown(idea);
  for (const catalyst of workspace.catalysts) files[`Catalysts/${safeName(`${catalyst.date || 'TBD'}-${catalyst.event}-${catalyst.id.slice(0, 8)}`)}.md`] = catalystMarkdown(catalyst);
  for (const position of workspace.positions) {
    const folder = position.status === 'active' ? 'Active Trades' : 'Closed Trades';
    files[`${folder}/${safeName(`${position.ticker}-${position.id.slice(0, 8)}`)}.md`] = positionMarkdown(position, [...workspace.ideas, ...workspace.archivedIdeas].find((idea) => idea.id === position.ideaId));
  }
  for (const entry of workspace.journal) files[`Journal/${safeName(`${entry.createdAt.slice(0, 10)}-${entry.kind}-${entry.id.slice(0, 8)}`)}.md`] = journalMarkdown(entry, [...workspace.ideas, ...workspace.archivedIdeas].find((idea) => idea.id === entry.ideaId));
  files['Journal/Journal Index.md'] = `# Journal\n\n${workspace.journal.length ? workspace.journal.map((item) => `- ${item.createdAt}: ${item.summary}`).join('\n') : 'No journal records.'}\n`;
  files['Research/Catalyst Index.md'] = `# Catalyst Research\n\n${workspace.catalysts.length ? workspace.catalysts.map((item) => `- ${item.date || 'TBD'} — ${item.event} (${item.linkedTickers.join(', ') || 'mapping TBD'})`).join('\n') : 'No catalyst research.'}\n`;
  files['Research/Account Policy.md'] = workspace.policy ? `# Account Policy\n\n- Effective: ${workspace.policy.effectiveDate}\n- Total capital: ${workspace.policy.totalCapital}\n- Maximum open options risk: ${workspace.policy.maximumOpenRisk}\n- Fixed per-trade limit: ${value(workspace.policy.fixedPerTradeLimit)}\n- Strategies: ${workspace.policy.strategies.join(', ') || 'TBD'}\n- Version: ${workspace.policy.version}\n` : '# Account Policy\n\nTBD\n';
  files['Research/Idea Catalyst Links.md'] = `# Idea–Catalyst Links\n\n${workspace.ideaCatalystLinks.length ? workspace.ideaCatalystLinks.map((item) => `- Idea ${item.tradeIdeaId} → Catalyst ${item.catalystId} (${item.relationship})`).join('\n') : 'No additional Catalyst links.'}\n`;
  files['Research/Sources.md'] = `# Personal Research Sources\n\n${workspace.researchSources.length ? workspace.researchSources.map((item) => `## ${item.title}\n\n- Publisher: ${value(item.publisher)}\n- URL: ${item.url}\n- Quality: ${item.sourceQuality}\n- Catalyst: ${value(item.catalystId)}\n- Idea: ${value(item.tradeIdeaId)}\n- Accessed: ${item.accessedAt}\n- Verified: ${value(item.verifiedAt)}\n\n${value(item.claimSummary)}`).join('\n\n') : 'No personal source records.'}\n`;
  files['Research/Snapshots.md'] = `# Research Snapshots\n\n${workspace.researchSnapshots.length ? workspace.researchSnapshots.map((item) => `## ${item.snapshotType.replaceAll('_', ' ')} — ${item.observedAt}\n\n- Ticker: ${value(item.ticker)}\n- Catalyst: ${value(item.catalystId)}\n- Idea: ${value(item.tradeIdeaId)}\n- Methodology: ${item.methodology}\n- Values: ${JSON.stringify(item.values)}`).join('\n\n') : 'No research snapshots.'}\n`;
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
