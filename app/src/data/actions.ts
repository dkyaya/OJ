import { supabase } from '../lib/supabase';
import { clearDraft, removeOperation } from '../storage/drafts';
import type { AccountPolicy } from '../types/domain';

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

export async function saveCatalystRecord(input: { event: string; type: string; date: string; sensitivity?: string; source?: string; cluster?: string }) {
  const user = await approvedUser();
  if (!input.event.trim() || !input.date) throw new Error('Add an event and date.');
  const { data, error } = await supabase!.from('catalysts').insert({
    user_id: user.id,
    event: input.event.trim(),
    event_type: input.type || 'Other',
    event_at: `${input.date}T12:00:00.000Z`,
    expected_sensitivity: input.sensitivity || null,
    release_source: input.source?.trim() || null,
    catalyst_cluster_id: input.cluster?.trim() || null,
    research_status: 'researching',
    opportunity_scores: {},
    data: { sensitivity: input.sensitivity || 'TBD' },
    revision: 1,
    sync_status: 'cloud_draft',
    source: 'oj_app',
    mirror_status: 'not_requested',
  }).select().single();
  if (error) throw error; return data;
}
