import { supabase } from '../lib/supabase';
import type { AccountPolicy, AccountProfile, AppPreferences, Candidate, Catalyst, CatalystDateCertainty, CatalystEventStatus, CatalystScheduleKind, IdeaStatus, JournalRecord, Opportunity, Position, ResearchSnapshot, ResearchSnapshotLifecycleEvent, ResearchSnapshotRemovalReason, ResearchSource, ResearchStage, SnapshotType, SourceQuality, TradeIdea, TradeIdeaCatalystLink, Workspace } from '../types/domain';
import { demoWorkspace } from './demo';
import { emptyCollaboration, loadCollaboration } from './collaboration';
import { persistedSessionUser } from '../lib/session';
import { normalizeMobileNavigation } from '../config/navigation';
import { partitionResearchSnapshots } from '../lib/research-snapshot-lifecycle';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const number = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const stringArray = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const dataText = (data: Record<string, unknown>, ...keys: string[]) => keys.map((key) => text(data[key])).find(Boolean);
const optionalString = (value: unknown) => value === null || value === undefined || value === '' ? undefined : String(value);
const migrationPending = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /could not find the table/i.test(error.message || '')));

export const emptyWorkspace = (): Workspace => ({
  authenticated: false, approved: false, demo: false, ideas: [], archivedIdeas: [], catalysts: [], ideaCatalystLinks: [], researchSources: [], researchSnapshots: [], removedResearchSnapshots: [], positions: [], journal: [], opportunities: [], ...emptyCollaboration(), pendingReviews: 0, lastLoadedAt: new Date().toISOString(),
});

const literal = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => allowed.includes(value as T) ? value as T : fallback;

function ideaStatus(row: Record<string, unknown>, data: Record<string, unknown>): IdeaStatus {
  const literal = text(row.idea_status || data.Status || data.status).toLowerCase();
  if (['draft','watchlist','ready','deferred','rejected','invalidated'].includes(literal)) return literal as IdeaStatus;
  const entry = text(row.entry_status).toLowerCase();
  if (entry === 'deferred' || entry === 'rejected') return entry;
  return 'draft';
}

function mapCandidates(rows: Record<string, unknown>[]): Map<string, Candidate[]> {
  const mapped = new Map<string, Candidate[]>();
  for (const row of rows) {
    const data = record(row.data);
    const item: Candidate = {
      id: String(row.id), name: 'Candidate', legacyName: text(data.label || data.Label, text(row.name)) || undefined,
      longStrike: number(data.long_strike ?? data['Long strike']), shortStrike: number(data.short_strike ?? data['Short strike']),
      debit: number(data.debit ?? data['Net debit']), contracts: number(data.contracts ?? data.Contracts),
      maxLoss: number(data.max_loss ?? data['Maximum risk'] ?? data['Calculated max loss']), maxProfit: number(data.max_profit ?? data['Calculated max profit']),
      breakEven: number(data.break_even ?? data['Calculated break-even']), notes: dataText(data, 'notes', 'Notes'),
    };
    const parent = String(row.trade_idea_id); mapped.set(parent, [...(mapped.get(parent) || []), item]);
  }
  return mapped;
}

export function activeIdeaOpportunities(items: Opportunity[], archivedIdeaIds: ReadonlySet<string>) {
  return items.filter((item) => !item.ideaId || !archivedIdeaIds.has(item.ideaId));
}

export async function loadWorkspace(): Promise<Workspace> {
  if (new URLSearchParams(location.search).get('demo') === '1') return { ...demoWorkspace, lastLoadedAt: new Date().toISOString() };
  if (!supabase) return emptyWorkspace();
  const user = await persistedSessionUser(supabase.auth);
  if (!user) return emptyWorkspace();
  const profileResult = await supabase.from('profiles').select('id,email,approved,display_name,initials,account_role,account_status').eq('id', user.id).maybeSingle();
  if (profileResult.error) throw new Error(profileResult.error.message);
  const profileRow = profileResult.data as Record<string, unknown> | null;
  const email = text(profileRow?.email, user.email || '');
  const displayName = text(profileRow?.display_name, email.split('@')[0] || 'OJ Member');
  const initials = text(profileRow?.initials, displayName.split(/\s+/).map((part) => part[0]).join('').slice(0, 4).toUpperCase() || 'OJ');
  const profile: AccountProfile = {
    id: user.id,
    email,
    displayName,
    initials,
    role: profileRow?.account_role === 'owner' ? 'owner' : 'member',
    status: ['invited', 'active', 'disabled'].includes(String(profileRow?.account_status)) ? profileRow?.account_status as AccountProfile['status'] : 'pending',
  };
  if (!profileRow?.approved || profile.status !== 'active') return { ...emptyWorkspace(), authenticated: true, profile };

  const [ideasResult, candidatesResult, catalystsResult, mappingsResult, linksResult, sourcesResult, snapshotsResult, snapshotLifecycleResult, tradesResult, checkinsResult, reviewsResult, policyResult, preferencesResult, collaboration] = await Promise.all([
    supabase.from('trade_ideas').select('*').order('updated_at', { ascending: false }),
    supabase.from('trade_candidates').select('*').order('updated_at', { ascending: false }),
    supabase.from('catalysts').select('*').is('deleted_at', null).order('event_at', { ascending: true }),
    supabase.from('catalyst_security_mappings').select('*').is('deleted_at', null),
    supabase.from('trade_idea_catalysts').select('*').order('created_at', { ascending: true }),
    supabase.from('research_sources').select('*').order('accessed_at', { ascending: false }),
    supabase.from('research_snapshots').select('*').order('observed_at', { ascending: false }),
    supabase.from('research_snapshot_lifecycle_events').select('*').order('created_at', { ascending: true }),
    supabase.from('trades').select('*').is('deleted_at', null).order('updated_at', { ascending: false }),
    supabase.from('trade_checkins').select('*').order('created_at', { ascending: false }),
    supabase.from('journal_reviews').select('*').order('created_at', { ascending: false }),
    supabase.from('account_policies').select('*').maybeSingle(),
    supabase.from('application_preferences').select('*').maybeSingle(),
    loadCollaboration(user.id),
  ]);
  const requiredResults = [ideasResult, candidatesResult, catalystsResult, mappingsResult, tradesResult, checkinsResult, reviewsResult, policyResult, preferencesResult];
  const firstError = requiredResults.find((result) => result.error)?.error || [linksResult, sourcesResult, snapshotsResult, snapshotLifecycleResult].find((result) => result.error && !migrationPending(result.error))?.error;
  if (firstError) throw new Error(firstError.message);

  const candidateMap = mapCandidates((candidatesResult.data || []) as Record<string, unknown>[]);
  const allIdeas: TradeIdea[] = ((ideasResult.data || []) as Record<string, unknown>[]).map((row) => {
    const data = record(row.data); const id = String(row.id);
    return {
      id, ticker: text(row.ticker, 'TBD'), assetType: text(row.underlying_type) || undefined, strategy: text(row.strategy, 'TBD').replaceAll('-', ' '), bias: text(row.bias, 'TBD'), status: ideaStatus(row, data),
      confidence: text(row.confidence) || undefined, thesis: dataText(data, 'Thesis', 'thesis'), evidence: dataText(data, 'Evidence', 'evidence'), entryConditions: dataText(data, 'Entry conditions', 'Entry Conditions'),
      invalidation: dataText(data, 'Invalidation', 'invalidation'), plannedExit: dataText(data, 'Planned exit', 'Exit plan', 'Planned Exit'),
      holdThroughEvents: stringArray(row.planned_hold_through_events).length ? stringArray(row.planned_hold_through_events) : dataText(data, 'Hold through events', 'Hold Through')?.split(/\n|,/).map((item) => item.trim()).filter(Boolean) || [],
      avoidEvents: stringArray(row.planned_avoid_events).length ? stringArray(row.planned_avoid_events) : dataText(data, 'Avoid events', 'Avoid')?.split(/\n|,/).map((item) => item.trim()).filter(Boolean) || [],
      catalystId: row.originating_catalyst_id ? String(row.originating_catalyst_id) : undefined, catalystCluster: text(row.catalyst_cluster_id) || undefined,
      researchStage: literal<ResearchStage>(row.research_stage, ['watching','researching','thesis_forming','entry_candidate','entered','exited','reviewed','parked','rejected','no_trade'], 'watching'),
      nextDecisionAt: optionalString(row.next_decision_at), earliestEntryAt: optionalString(row.earliest_entry_at), latestEntryAt: optionalString(row.latest_entry_at),
      exposureTags: stringArray(row.exposure_tags), riskOvershootAcknowledged: Boolean(row.risk_overshoot_acknowledged), riskOvershootNote: optionalString(row.risk_overshoot_note),
      risk: number(data['Calculated max loss']), archivedAt: row.deleted_at ? String(row.deleted_at) : undefined, updatedAt: String(row.updated_at), revision: Number(row.revision || 1), candidates: candidateMap.get(id) || [], data,
    };
  });
  const archivedIdeas = allIdeas.filter((idea) => idea.archivedAt);
  const archivedIdeaIds = new Set(archivedIdeas.map((idea) => idea.id));
  const ideas = allIdeas.filter((idea) => !idea.archivedAt);
  const opportunities = activeIdeaOpportunities(((mappingsResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), catalystId: String(row.catalyst_id), ideaId: row.trade_idea_id ? String(row.trade_idea_id) : undefined,
    ticker: text(row.ticker, 'TBD'), exposure: text(row.exposure_type, 'direct'), sensitivity: text(row.sensitivity) || undefined,
    rationale: text(row.rationale) || undefined, scores: record(row.opportunity_scores),
  })), archivedIdeaIds);
  const catalysts: Catalyst[] = ((catalystsResult.data || []) as Record<string, unknown>[]).map((row) => {
    const id = String(row.id); const data = record(row.data);
    return {
      id, event: text(row.event, 'Untitled event'), type: text(row.event_type, 'Other'), category: optionalString(row.catalyst_category), date: optionalString(row.scheduled_date) || (row.event_at ? String(row.event_at).slice(0, 10) : undefined), eventAt: optionalString(row.event_at),
      scheduleKind: literal<CatalystScheduleKind>(row.schedule_kind, ['scheduled','contextual'], 'scheduled'), scheduledTime: optionalString(row.scheduled_time)?.slice(0, 5),
      timezoneName: text(row.timezone_name, 'America/New_York'), marketSession: literal(row.market_session, ['pre_market','regular','after_hours','all_day','unscheduled'] as const, 'pre_market'),
      dateCertainty: literal<CatalystDateCertainty>(row.date_certainty, ['confirmed','estimated','unconfirmed','contextual'], 'confirmed'),
      eventStatus: literal<CatalystEventStatus>(row.event_status, ['scheduled','released','revised','cancelled','contextual'], 'scheduled'),
      sensitivity: text(row.expected_sensitivity || data.sensitivity) || undefined, status: text(row.research_status, 'researching'),
      source: text(row.release_source || data.scheduled_source) || undefined, sourceUrl: optionalString(row.source_url), sourceQuality: literal<SourceQuality>(row.source_quality, ['official','primary','secondary','unverified'], 'unverified'), lastVerifiedAt: optionalString(row.last_verified_at),
      consensus: optionalString(row.consensus_value), prior: optionalString(row.prior_value), actual: optionalString(row.actual_value), surprise: optionalString(row.surprise_value),
      whyMatters: optionalString(row.why_matters), keyVariables: stringArray(row.key_variables), transmissionPath: optionalString(row.transmission_path),
      crossAssetReaction: optionalString(row.cross_asset_reaction), ratesReaction: optionalString(row.rates_reaction), sectorReaction: optionalString(row.sector_reaction), postEventInterpretation: optionalString(row.post_event_interpretation), tags: stringArray(row.tags), cluster: text(row.catalyst_cluster_id) || undefined,
      linkedTickers: opportunities.filter((item) => item.catalystId === id).map((item) => item.ticker), revision: Number(row.revision || 1), data,
      ownerId: optionalString(row.user_id), workspaceId: optionalString(row.workspace_id), createdBy: optionalString(row.created_by), updatedBy: optionalString(row.updated_by), visibility: row.visibility === 'workspace' ? 'workspace' : 'private',
    };
  });
  const ideaCatalystLinks: TradeIdeaCatalystLink[] = ((linksResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), tradeIdeaId: String(row.trade_idea_id), catalystId: String(row.catalyst_id), relationship: literal(row.relationship, ['primary','supporting','avoid','exit','context'] as const, 'supporting'),
  }));
  const researchSources: ResearchSource[] = ((sourcesResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), catalystId: optionalString(row.catalyst_id), tradeIdeaId: optionalString(row.trade_idea_id), title: text(row.title, 'Untitled source'), publisher: optionalString(row.publisher), url: text(row.url),
    sourceQuality: literal<SourceQuality>(row.source_quality, ['official','primary','secondary','unverified'], 'unverified'), claimSummary: optionalString(row.claim_summary), publishedAt: optionalString(row.published_at), accessedAt: String(row.accessed_at), verifiedAt: optionalString(row.verified_at),
  }));
  const allResearchSnapshots: ResearchSnapshot[] = ((snapshotsResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), catalystId: optionalString(row.catalyst_id), tradeIdeaId: optionalString(row.trade_idea_id), sourceId: optionalString(row.source_id),
    snapshotType: literal<SnapshotType>(row.snapshot_type, ['market_pricing','event_implied_move','expiration_implied_move','entry_window','event_reaction','realized_event_move','macro_context'], 'market_pricing'),
    ticker: optionalString(row.ticker), observedAt: String(row.observed_at), methodology: text(row.methodology, 'Method not recorded'), values: record(row.values),
    provider: text(row.provider, 'manual'), sourceQuality: literal<SourceQuality>(row.source_quality, ['official','primary','secondary','unverified'], 'unverified'), freshness: literal(row.freshness, ['current','delayed','historical','manual'] as const, 'manual'), fetchedAt: String(row.fetched_at || row.created_at || row.observed_at), sourceReference: optionalString(row.source_reference),
    sessionLabel: row.session_label ? literal(row.session_label, ['T-5','T-3','T-1','T0','T+1','T+5'] as const, 'T0') : undefined, sourceDate: optionalString(row.source_date),
    calendarDaysToCatalyst: number(row.calendar_days_to_catalyst), catalystTimezone: optionalString(row.catalyst_timezone), catalystSession: optionalString(row.catalyst_session),
  }));
  const snapshotLifecycle: ResearchSnapshotLifecycleEvent[] = ((snapshotLifecycleResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), eventOrder: Number(row.event_order), snapshotId: String(row.snapshot_id), action: literal(row.action, ['remove','restore'] as const, 'remove'),
    reason: row.reason ? literal<ResearchSnapshotRemovalReason>(row.reason, ['test_snapshot','data_entry_error','wrong_expiration','duplicate','wrong_ticker','bad_source_data','other'], 'other') : undefined,
    note: optionalString(row.note), createdAt: String(row.created_at),
  }));
  const { active: researchSnapshots, removed: removedResearchSnapshots } = partitionResearchSnapshots(allResearchSnapshots, snapshotLifecycle);
  const positions: Position[] = ((tradesResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), ideaId: String(row.trade_idea_id), ticker: text(row.ticker, 'TBD'), strategy: text(row.strategy, 'TBD'), status: row.status === 'closed' ? 'closed' : 'active',
    contracts: Number(row.contracts), maxRisk: number(row.max_risk), openedAt: String(row.opened_at), closedAt: row.closed_at ? String(row.closed_at) : undefined,
    revision: Number(row.revision || 1), data: record(row.data),
  }));
  const journal: JournalRecord[] = [
    ...((checkinsResult.data || []) as Record<string, unknown>[]).map((row) => ({ id: String(row.id), ideaId: String(row.trade_idea_id), kind: 'check-in' as const, createdAt: String(row.created_at), summary: dataText(record(row.data), 'Summary', 'summary', 'Note') || 'Trade check-in', data: record(row.data) })),
    ...((reviewsResult.data || []) as Record<string, unknown>[]).map((row) => ({ id: String(row.id), ideaId: String(row.trade_idea_id), kind: 'review' as const, createdAt: String(row.created_at), summary: dataText(record(row.data), 'Summary', 'summary', 'Lesson') || 'Trade review', data: record(row.data) })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const policyRow = policyResult.data as Record<string, unknown> | null;
  const policy: AccountPolicy | undefined = policyRow ? {
    totalCapital: Number(policyRow.total_account_capital), maximumOpenRisk: Number(policyRow.maximum_open_options_risk), fixedPerTradeLimit: number(policyRow.fixed_per_trade_limit),
    strategies: stringArray(policyRow.preferred_defined_risk_strategies), effectiveDate: String(policyRow.effective_date), version: Number(policyRow.policy_version || 1),
  } : undefined;
  const preferenceRow = preferencesResult.data as Record<string, unknown> | null;
  const preferenceData = record(preferenceRow?.data);
  const preferences: AppPreferences | undefined = preferenceRow ? {
    theme: ['light','dark'].includes(String(preferenceRow.theme)) ? preferenceRow.theme as 'light' | 'dark' : 'system',
    calendarView: ['week','day'].includes(String(preferenceRow.calendar_view)) ? preferenceRow.calendar_view as 'week' | 'day' : 'month',
    compactCards: Boolean(preferenceRow.compact_cards), mobileNavigation: normalizeMobileNavigation(preferenceData.mobileNavigation), data: preferenceData, revision: Number(preferenceRow.revision || 1),
  } : undefined;
  return { authenticated: true, approved: true, demo: false, ideas, archivedIdeas, catalysts, ideaCatalystLinks, researchSources, researchSnapshots, removedResearchSnapshots, positions, journal, opportunities, profile, policy, preferences, ...collaboration, pendingReviews: positions.filter((item) => item.status === 'closed' && !journal.some((entry) => entry.ideaId === item.ideaId && entry.kind === 'review')).length, lastLoadedAt: new Date().toISOString() };
}

export async function savePreferences(input: Omit<AppPreferences, 'revision'>, currentRevision?: number) {
  if (!supabase) throw new Error('Cloud is not configured.');
  const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in to save preferences.');
  const row = { user_id: user.id, theme: input.theme, calendar_view: input.calendarView, compact_cards: input.compactCards, data: { ...input.data, mobileNavigation: normalizeMobileNavigation(input.mobileNavigation) }, revision: currentRevision ? currentRevision + 1 : 1 };
  const query = currentRevision
    ? supabase.from('application_preferences').update(row).eq('user_id', user.id).eq('revision', currentRevision)
    : supabase.from('application_preferences').insert(row);
  const { data, error } = await query.select().maybeSingle(); if (error || !data) throw new Error(error?.message || 'Preferences changed on another device.'); return data;
}
