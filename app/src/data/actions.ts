import { supabase } from '../lib/supabase';
import { clearDraft, removeOperation } from '../storage/drafts';
import type { AccountPolicy } from '../types/domain';
import type { CatalystDateCertainty, CatalystScheduleKind, SnapshotType, SourceQuality } from '../types/domain';
import { zonedEventIso } from '../lib/date-time';

const httpUrl = (value: string) => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

async function approvedUser() {
  if (!supabase) throw new Error('Cloud is not configured.');
  const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Sign in to continue.');
  const profile = await supabase.from('profiles').select('approved').eq('id', user.id).maybeSingle();
  if (!profile.data?.approved) throw new Error('This account is not approved.'); return user;
}

export async function saveAccountPolicy(input: AccountPolicy, exists: boolean) {
  const user = await approvedUser();
  const row = {
    user_id: user.id, total_account_capital: input.totalCapital, maximum_open_options_risk: input.maximumOpenRisk,
    fixed_per_trade_limit: input.fixedPerTradeLimit ?? null, preferred_defined_risk_strategies: input.strategies,
    effective_date: input.effectiveDate, policy_version: input.version, source: 'oj_app',
  };
  const query = exists
    ? supabase!.from('account_policies').update(row).eq('user_id', user.id).eq('policy_version', input.version - 1)
    : supabase!.from('account_policies').insert(row);
  const { data, error } = await query.select().maybeSingle(); if (error || !data) throw new Error(error?.message || 'The risk policy changed on another device.'); return data;
}

export async function recordEntry(input: { ideaId: string; contracts: number; openedAt: string; maxRisk: number; debit?: number; notes?: string; confirmed: boolean }) {
  await approvedUser();
  if (!input.confirmed) throw new Error('Confirm that this is an actual fill.');
  const { data, error } = await supabase!.rpc('record_trade_entry', {
    p_trade_idea_id: input.ideaId, p_contracts: input.contracts, p_opened_at: new Date(input.openedAt).toISOString(), p_max_risk: input.maxRisk,
    p_entry_data: { debit: input.debit ?? null, notes: input.notes || 'TBD' }, p_confirm_actual: input.confirmed,
  });
  if (error) throw error; return String(data);
}

export function ideaLifecycleError(error: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error || '');
  if (/could not find the function|function .* does not exist|schema cache/i.test(detail)) return 'OJ is finishing its database update. Refresh in a moment and try again.';
  if (/changed on another device|revision/i.test(detail)) return 'This idea changed on another device. OJ refreshed the latest version; try again if you still want to continue.';
  if (/trade-backed|confirmed trade/i.test(detail)) return 'Ideas with confirmed trade history cannot be archived.';
  if (/already archived/i.test(detail)) return 'This idea is already archived.';
  if (/not archived/i.test(detail)) return 'This idea has already been restored.';
  if (/not found|row-level security/i.test(detail)) return 'OJ could not change this idea. Refresh and confirm that it still belongs to this account.';
  return 'OJ could not update the idea archive. Nothing was changed.';
}

export async function setTradeIdeaArchived(input: { ideaId: string; expectedRevision: number; archived: boolean }) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Connect to the internet to archive or restore an idea. OJ did not queue this change.');
  await approvedUser();
  const { data, error } = await supabase!.rpc('set_trade_idea_archived', {
    p_trade_idea_id: input.ideaId,
    p_expected_revision: input.expectedRevision,
    p_archived: input.archived,
  });
  if (error) throw new Error(ideaLifecycleError(error));
  if (typeof data !== 'number') throw new Error('OJ could not confirm the idea archive change. Refresh before trying again.');
  return data;
}

export function ideaDeletionError(error: unknown) {
  const detail = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error || '');
  if (/could not find the function|function .* does not exist|schema cache/i.test(detail)) return 'OJ is finishing its database update. Refresh in a moment and try again.';
  if (/changed on another device|revision/i.test(detail)) return 'This idea changed on another device. OJ refreshed the latest version; review it before trying again.';
  if (/archive the idea/i.test(detail)) return 'Archive this idea before deleting it permanently.';
  if (/confirmation did not match/i.test(detail)) return 'The deletion phrase did not match. Nothing was deleted.';
  if (/trade or journal history/i.test(detail)) return 'Ideas with trade or journal history cannot be deleted.';
  if (/not found|row-level security/i.test(detail)) return 'OJ could not find an eligible archived idea to delete. Refresh and try again.';
  return 'OJ could not delete this idea. Nothing was changed.';
}

export async function deleteTradeIdea(input: { ideaId: string; expectedRevision: number; confirmation: string }) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Connect to the internet to delete an idea. OJ did not queue this permanent action.');
  const user = await approvedUser();
  const { data, error } = await supabase!.rpc('delete_trade_idea', {
    p_trade_idea_id: input.ideaId,
    p_expected_revision: input.expectedRevision,
    p_confirmation: input.confirmation,
  });
  if (error) throw new Error(ideaDeletionError(error));
  if (typeof data !== 'string') throw new Error('OJ could not confirm the permanent deletion. Refresh before trying again.');
  await Promise.all([clearDraft(user.id, input.ideaId), removeOperation(user.id, input.ideaId)]).catch(() => undefined);
  return data;
}

export async function saveJournalReview(input: { ideaId: string; summary: string; lesson?: string; processRating?: number }) {
  const user = await approvedUser();
  const { data, error } = await supabase!.from('journal_reviews').insert({
    trade_idea_id: input.ideaId, user_id: user.id, ratings: { process: input.processRating ?? null }, data: { Summary: input.summary, Lesson: input.lesson || 'TBD' },
    revision: 1, sync_status: 'cloud_draft', source: 'oj_app',
  }).select().single();
  if (error) throw error; return data;
}

export async function saveCatalystRecord(input: {
  workspaceId: string; event: string; type: string; date?: string; time?: string; timezoneName: string;
  scheduleKind: CatalystScheduleKind; dateCertainty: CatalystDateCertainty; marketSession: 'pre_market' | 'regular' | 'after_hours' | 'all_day' | 'unscheduled';
  sensitivity?: string; source?: string; sourceUrl?: string; sourceQuality: SourceQuality; cluster?: string;
  consensus?: string; prior?: string; whyMatters?: string; keyVariables?: string; tags?: string;
}) {
  const user = await approvedUser();
  if (!input.workspaceId) throw new Error('A research workspace is required.');
  if (!input.event.trim()) throw new Error('Add an event.');
  if (input.scheduleKind === 'scheduled' && !input.date) throw new Error('Add a scheduled date.');
  if (input.sourceUrl?.trim() && !httpUrl(input.sourceUrl.trim())) throw new Error('Use an http or https source URL.');
  const scheduled = input.scheduleKind === 'scheduled';
  const richData = {
    sensitivity: input.sensitivity || 'TBD', schedule_kind: input.scheduleKind, scheduled_date: scheduled ? input.date : null, scheduled_time: scheduled ? input.time || '08:30' : null,
    timezone_name: input.timezoneName, market_session: scheduled ? input.marketSession : 'unscheduled', date_certainty: scheduled ? input.dateCertainty : 'contextual', source_url: input.sourceUrl?.trim() || null,
    source_quality: input.sourceQuality, consensus_value: input.consensus?.trim() || null, prior_value: input.prior?.trim() || null, why_matters: input.whyMatters?.trim() || null,
    key_variables: input.keyVariables?.split(/\n|,/).map((item) => item.trim()).filter(Boolean) || [], tags: input.tags?.split(/\n|,/).map((item) => item.trim().toLowerCase()).filter(Boolean) || [],
  };
  const base = {
    user_id: user.id,
    workspace_id: input.workspaceId,
    created_by: user.id,
    updated_by: user.id,
    visibility: 'workspace',
    event: input.event.trim(),
    event_type: input.type || 'Other',
    event_at: scheduled ? zonedEventIso(input.date!, input.time || '08:30', input.timezoneName) : null,
    schedule_kind: input.scheduleKind,
    scheduled_date: scheduled ? input.date : null,
    scheduled_time: scheduled ? input.time || '08:30' : null,
    timezone_name: input.timezoneName,
    market_session: scheduled ? input.marketSession : 'unscheduled',
    date_certainty: scheduled ? input.dateCertainty : 'contextual',
    event_status: scheduled ? 'scheduled' : 'contextual',
    expected_sensitivity: input.sensitivity || null,
    release_source: input.source?.trim() || null,
    source_url: input.sourceUrl?.trim() || null,
    source_quality: input.sourceQuality,
    last_verified_at: input.sourceQuality === 'unverified' ? null : new Date().toISOString(),
    catalyst_cluster_id: input.cluster?.trim() || null,
    consensus_value: input.consensus?.trim() || null,
    prior_value: input.prior?.trim() || null,
    why_matters: input.whyMatters?.trim() || null,
    key_variables: input.keyVariables?.split(/\n|,/).map((item) => item.trim()).filter(Boolean) || [],
    tags: input.tags?.split(/\n|,/).map((item) => item.trim().toLowerCase()).filter(Boolean) || [],
    research_status: 'researching',
    opportunity_scores: {},
    data: richData,
    revision: 1,
    sync_status: 'cloud_draft',
    source: 'oj_app',
    mirror_status: 'not_requested',
  };
  let result = await supabase!.from('catalysts').insert(base).select().single();
  if (result.error && /schedule_kind|scheduled_date|scheduled_time|timezone_name|market_session|date_certainty|event_status|source_url|source_quality|last_verified_at|consensus_value|prior_value|why_matters|key_variables|tags|schema cache/i.test(result.error.message)) {
    const legacy = { ...base } as Record<string, unknown>;
    for (const key of ['schedule_kind','scheduled_date','scheduled_time','timezone_name','market_session','date_certainty','event_status','source_url','source_quality','last_verified_at','consensus_value','prior_value','why_matters','key_variables','tags']) delete legacy[key];
    result = await supabase!.from('catalysts').insert(legacy).select().single();
  }
  if (result.error) throw result.error; return result.data;
}

export async function saveResearchSource(input: {
  catalystId?: string; tradeIdeaId?: string; title: string; publisher?: string; url: string;
  sourceQuality: SourceQuality; claimSummary?: string; publishedAt?: string; verified: boolean;
}) {
  const user = await approvedUser();
  if (!input.catalystId && !input.tradeIdeaId) throw new Error('Choose a catalyst or Idea for this source.');
  if (!input.title.trim() || !input.url.trim()) throw new Error('Add a source title and URL.');
  if (!httpUrl(input.url.trim())) throw new Error('Use an http or https source URL.');
  const { data, error } = await supabase!.from('research_sources').insert({
    user_id: user.id, catalyst_id: input.catalystId || null, trade_idea_id: input.tradeIdeaId || null,
    title: input.title.trim(), publisher: input.publisher?.trim() || null, url: input.url.trim(), source_quality: input.sourceQuality,
    claim_summary: input.claimSummary?.trim() || null, published_at: input.publishedAt ? new Date(input.publishedAt).toISOString() : null,
    accessed_at: new Date().toISOString(), verified_at: input.verified ? new Date().toISOString() : null,
  }).select().single();
  if (error) throw new Error(/research_sources|schema cache|could not find the table/i.test(error.message) ? 'OJ is finishing its catalyst-research database update. Try again after the Supabase workflow completes.' : error.message); return data;
}

export async function saveResearchSnapshot(input: {
  catalystId?: string; tradeIdeaId?: string; snapshotType: SnapshotType; ticker?: string; observedAt: string;
  methodology: string; values: Record<string, unknown>; provider?: string; sourceQuality?: SourceQuality; freshness?: 'current' | 'delayed' | 'historical' | 'manual'; fetchedAt?: string; sourceReference?: string;
  sessionLabel?: 'T-5' | 'T-3' | 'T-1' | 'T0' | 'T+1' | 'T+5'; sourceDate?: string; calendarDaysToCatalyst?: number; catalystTimezone?: string; catalystSession?: string;
}) {
  const user = await approvedUser();
  if (!input.catalystId && !input.tradeIdeaId) throw new Error('Choose a catalyst or Idea for this snapshot.');
  if (!input.methodology.trim() || !input.observedAt) throw new Error('Record the observation time and methodology.');
  const values = Object.fromEntries(Object.entries(input.values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]).filter(([, value]) => value !== '' && value !== undefined && value !== null));
  if (new TextEncoder().encode(JSON.stringify(values)).byteLength > 100_000) throw new Error('Snapshot detail is too large. Save a focused observation.');
  const { data, error } = await supabase!.from('research_snapshots').insert({
    user_id: user.id, catalyst_id: input.catalystId || null, trade_idea_id: input.tradeIdeaId || null,
    snapshot_type: input.snapshotType, ticker: input.ticker?.trim().toUpperCase() || null,
    observed_at: new Date(input.observedAt).toISOString(), methodology: input.methodology.trim(), values,
    provider: input.provider?.trim().toLowerCase() || 'manual', source_quality: input.sourceQuality || 'unverified', freshness: input.freshness || 'manual', fetched_at: input.fetchedAt ? new Date(input.fetchedAt).toISOString() : new Date().toISOString(), source_reference: input.sourceReference?.trim() || null,
    session_label: input.sessionLabel || null, source_date: input.sourceDate || null, calendar_days_to_catalyst: input.calendarDaysToCatalyst ?? null,
    catalyst_timezone: input.catalystTimezone?.trim() || null, catalyst_session: input.catalystSession || null,
  }).select().single();
  if (error) throw new Error(/research_snapshots|schema cache|could not find the table/i.test(error.message) ? 'OJ is finishing its catalyst-research database update. Try again after the Supabase workflow completes.' : error.message); return data;
}
