import { supabase } from '../lib/supabase';
import type { AccountPolicy, AccountProfile, AppPreferences, Candidate, Catalyst, IdeaStatus, JournalRecord, Opportunity, Position, TradeIdea, Workspace } from '../types/domain';
import { demoWorkspace } from './demo';

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const number = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const stringArray = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const dataText = (data: Record<string, unknown>, ...keys: string[]) => keys.map((key) => text(data[key])).find(Boolean);

export const emptyWorkspace = (): Workspace => ({
  authenticated: false, approved: false, demo: false, ideas: [], catalysts: [], positions: [], journal: [], opportunities: [], pendingReviews: 0, lastLoadedAt: new Date().toISOString(),
});

function ideaStatus(row: Record<string, unknown>, data: Record<string, unknown>): IdeaStatus {
  const literal = text(data.Status || data.status).toLowerCase();
  if (['draft','watchlist','ready','deferred','rejected','invalidated'].includes(literal)) return literal as IdeaStatus;
  const entry = text(row.entry_status).toLowerCase();
  if (entry === 'deferred' || entry === 'rejected') return entry;
  return 'watchlist';
}

function mapCandidates(rows: Record<string, unknown>[]): Map<string, Candidate[]> {
  const mapped = new Map<string, Candidate[]>();
  for (const row of rows) {
    const data = record(row.data);
    const item: Candidate = {
      id: String(row.id), name: text(data.label || data.Label, text(row.name, 'Candidate')),
      longStrike: number(data.long_strike ?? data['Long strike']), shortStrike: number(data.short_strike ?? data['Short strike']),
      debit: number(data.debit ?? data['Net debit']), contracts: number(data.contracts ?? data.Contracts),
      maxLoss: number(data.max_loss ?? data['Maximum risk'] ?? data['Calculated max loss']), maxProfit: number(data.max_profit ?? data['Calculated max profit']),
      breakEven: number(data.break_even ?? data['Calculated break-even']), notes: dataText(data, 'notes', 'Notes'),
    };
    const parent = String(row.trade_idea_id); mapped.set(parent, [...(mapped.get(parent) || []), item]);
  }
  return mapped;
}

export async function loadWorkspace(): Promise<Workspace> {
  if (new URLSearchParams(location.search).get('demo') === '1') return { ...demoWorkspace, lastLoadedAt: new Date().toISOString() };
  if (!supabase) return emptyWorkspace();
  const { data: { user } } = await supabase.auth.getUser();
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

  const [ideasResult, candidatesResult, catalystsResult, mappingsResult, tradesResult, checkinsResult, reviewsResult, policyResult, preferencesResult] = await Promise.all([
    supabase.from('trade_ideas').select('*').is('deleted_at', null).order('updated_at', { ascending: false }),
    supabase.from('trade_candidates').select('*').order('updated_at', { ascending: false }),
    supabase.from('catalysts').select('*').is('deleted_at', null).order('event_at', { ascending: true }),
    supabase.from('catalyst_security_mappings').select('*').is('deleted_at', null),
    supabase.from('trades').select('*').is('deleted_at', null).order('updated_at', { ascending: false }),
    supabase.from('trade_checkins').select('*').order('created_at', { ascending: false }),
    supabase.from('journal_reviews').select('*').order('created_at', { ascending: false }),
    supabase.from('account_policies').select('*').maybeSingle(),
    supabase.from('application_preferences').select('*').maybeSingle(),
  ]);
  const firstError = [ideasResult, candidatesResult, catalystsResult, mappingsResult, tradesResult, checkinsResult, reviewsResult, policyResult, preferencesResult].find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const candidateMap = mapCandidates((candidatesResult.data || []) as Record<string, unknown>[]);
  const opportunities: Opportunity[] = ((mappingsResult.data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id), catalystId: String(row.catalyst_id), ideaId: row.trade_idea_id ? String(row.trade_idea_id) : undefined,
    ticker: text(row.ticker, 'TBD'), exposure: text(row.exposure_type, 'direct'), sensitivity: text(row.sensitivity) || undefined,
    rationale: text(row.rationale) || undefined, scores: record(row.opportunity_scores),
  }));
  const ideas: TradeIdea[] = ((ideasResult.data || []) as Record<string, unknown>[]).map((row) => {
    const data = record(row.data); const id = String(row.id);
    return {
      id, ticker: text(row.ticker, 'TBD'), strategy: text(row.strategy, 'TBD').replaceAll('-', ' '), bias: text(row.bias, 'TBD'), status: ideaStatus(row, data),
      confidence: text(row.confidence) || undefined, thesis: dataText(data, 'Thesis', 'thesis'), entryConditions: dataText(data, 'Entry conditions', 'Entry Conditions'),
      invalidation: dataText(data, 'Invalidation', 'invalidation'), plannedExit: dataText(data, 'Planned exit', 'Exit plan', 'Planned Exit'),
      catalystId: row.originating_catalyst_id ? String(row.originating_catalyst_id) : undefined, catalystCluster: text(row.catalyst_cluster_id) || undefined,
      risk: number(data['Calculated max loss']), updatedAt: String(row.updated_at), revision: Number(row.revision || 1), candidates: candidateMap.get(id) || [], data,
    };
  });
  const catalysts: Catalyst[] = ((catalystsResult.data || []) as Record<string, unknown>[]).map((row) => {
    const id = String(row.id); const data = record(row.data);
    return {
      id, event: text(row.event, 'Untitled event'), type: text(row.event_type, 'Other'), date: row.event_at ? String(row.event_at).slice(0, 10) : undefined,
      sensitivity: text(row.expected_sensitivity || data.sensitivity) || undefined, status: text(row.research_status, 'researching'),
      source: text(row.release_source || data.scheduled_source) || undefined, cluster: text(row.catalyst_cluster_id) || undefined,
      linkedTickers: opportunities.filter((item) => item.catalystId === id).map((item) => item.ticker), revision: Number(row.revision || 1), data,
    };
  });
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
  const preferences: AppPreferences | undefined = preferenceRow ? {
    theme: ['light','dark'].includes(String(preferenceRow.theme)) ? preferenceRow.theme as 'light' | 'dark' : 'system',
    calendarView: ['week','day'].includes(String(preferenceRow.calendar_view)) ? preferenceRow.calendar_view as 'week' | 'day' : 'month',
    compactCards: Boolean(preferenceRow.compact_cards), revision: Number(preferenceRow.revision || 1),
  } : undefined;
  return { authenticated: true, approved: true, demo: false, ideas, catalysts, positions, journal, opportunities, profile, policy, preferences, pendingReviews: positions.filter((item) => item.status === 'closed' && !journal.some((entry) => entry.ideaId === item.ideaId && entry.kind === 'review')).length, lastLoadedAt: new Date().toISOString() };
}

export async function savePreferences(input: Omit<AppPreferences, 'revision'>, currentRevision?: number) {
  if (!supabase) throw new Error('Cloud is not configured.');
  const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in to save preferences.');
  const row = { user_id: user.id, theme: input.theme, calendar_view: input.calendarView, compact_cards: input.compactCards, revision: currentRevision ? currentRevision + 1 : 1 };
  const query = currentRevision
    ? supabase.from('application_preferences').update(row).eq('user_id', user.id).eq('revision', currentRevision)
    : supabase.from('application_preferences').insert(row);
  const { data, error } = await query.select().maybeSingle(); if (error || !data) throw new Error(error?.message || 'Preferences changed on another device.'); return data;
}
