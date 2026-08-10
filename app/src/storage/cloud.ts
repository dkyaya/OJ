import { cloudConfigured, supabase } from '../lib/supabase';
import { spreadMetrics, type Spread } from '../lib/payoff';
import { listOperations, queueOperation, removeOperation, saveDraft, type Draft } from './drafts';

export type CloudResult = { state: 'local' | 'canonical' | 'conflict' | 'rejected' | 'error'; draft: Draft; cloud?: Record<string, unknown>; message?: string };

export function shouldRejectMissingCanonical(draft: Draft) {
  return draft.cloudRevision !== undefined;
}

const text = (data: Record<string, string>, key: string) => data[key]?.trim() || '';
const optionalNumber = (value: string) => value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
const optionalInteger = (value: string) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const lines = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function cloudRowToDraft(row: Record<string, unknown>, ownerId: string): Draft {
  return { id: String(row.id), ownerId, kind: 'trade_idea', data: (row.data as Record<string, string>) || {}, updatedAt: String(row.updated_at), sync: 'canonical', cloudRevision: Number(row.revision), cloudUpdatedAt: String(row.updated_at) };
}

async function owner(expectedOwnerId: string) {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return null;
  if (user.id !== expectedOwnerId) return null;
  const profile = await supabase.from('profiles').select('approved,account_status').eq('id', user.id).maybeSingle();
  return profile.data?.approved && profile.data.account_status === 'active' ? user : null;
}

async function saveCatalyst(draft: Draft, userId: string, catalystId: string) {
  if (!supabase) return;
  const existing = await supabase.from('catalysts').select('id,revision').eq('id', catalystId).maybeSingle();
  if (existing.error) throw existing.error;
  const revision = existing.data ? Number(existing.data.revision) + 1 : 1;
  const row = {
    event: text(draft.data, 'Catalyst title'), event_type: text(draft.data, 'Catalyst category') || 'Other',
    event_at: `${text(draft.data, 'Catalyst date')}T12:00:00.000Z`, catalyst_cluster_id: text(draft.data, 'Catalyst cluster') || null,
    release_source: text(draft.data, 'Verification source') || null, expected_sensitivity: text(draft.data, 'Sensitivity') || null,
    research_status: 'researching', opportunity_scores: {}, data: { sensitivity: text(draft.data, 'Sensitivity') || 'TBD' },
    revision, sync_status: 'cloud_draft', source: 'oj_app', mirror_status: 'not_requested', updated_at: new Date().toISOString(),
  };
  const query = existing.data
    ? supabase.from('catalysts').update(row).eq('id', catalystId).eq('user_id', userId).eq('revision', existing.data.revision)
    : supabase.from('catalysts').insert({ ...row, id: catalystId, user_id: userId });
  const saved = await query.select().maybeSingle(); if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Catalyst revision conflict.');
}

async function saveCandidate(draft: Draft, userId: string, revision: number) {
  if (!supabase || !text(draft.data, 'Long strike')) return;
  // A draft represents one candidate, so its stable local identifier is also the
  // canonical candidate identifier. Reusing it makes retries idempotent.
  const candidateId = text(draft.data, 'Candidate ID') || draft.id;
  const existing = await supabase.from('trade_candidates').select('id,revision').eq('id', candidateId).maybeSingle();
  const candidateRevision = existing.data ? Number(existing.data.revision) + 1 : 1;
  const data = {
    label: text(draft.data, 'Candidate name') || 'Balanced', long_strike: optionalNumber(text(draft.data, 'Long strike')),
    short_strike: optionalNumber(text(draft.data, 'Short strike')), debit: optionalNumber(text(draft.data, 'Net debit')),
    contracts: optionalInteger(text(draft.data, 'Contracts')), max_loss: optionalNumber(text(draft.data, 'Calculated max loss')),
    max_profit: optionalNumber(text(draft.data, 'Calculated max profit')), break_even: optionalNumber(text(draft.data, 'Calculated break-even')),
  };
  const row = { trade_idea_id: draft.id, user_id: userId, name: (text(draft.data, 'Candidate name') || 'Balanced').includes('Aggressive') ? 'Aggressive' : 'Balanced', data, revision: candidateRevision, source: 'oj_app', updated_at: new Date().toISOString() };
  const query = existing.data ? supabase.from('trade_candidates').update(row).eq('id', candidateId).eq('revision', existing.data.revision) : supabase.from('trade_candidates').insert({ ...row, id: candidateId });
  const saved = await query.select().maybeSingle(); if (saved.error || !saved.data) throw new Error(saved.error?.message || `Candidate revision ${revision} could not be saved.`);
}

export async function syncDraft(draft: Draft): Promise<CloudResult> {
  if (!cloudConfigured || !supabase) return { state: 'local', draft: { ...draft, sync: 'local' }, message: 'Saved on this device. Cloud is not configured.' };
  if (!navigator.onLine) { const offline = { ...draft, sync: 'offline' as const }; await queueOperation(offline); return { state: 'local', draft: offline, message: 'Saved offline. OJ will retry when connected.' }; }
  const user = await owner(draft.ownerId);
  if (!user) return { state: 'rejected', draft: { ...draft, sync: 'local' }, message: 'Sign in with an approved account to save to OJ.' };
  const remote = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
  if (remote.error) return { state: 'error', draft: { ...draft, sync: 'retry' }, message: remote.error.message };
  if (!remote.data && shouldRejectMissingCanonical(draft)) {
    return { state: 'rejected', draft: { ...draft, sync: 'conflict' }, message: 'This idea was removed from OJ and cannot be recreated from a stale device. Duplicate it as a new idea if you need the local copy.' };
  }
  if (remote.data && draft.cloudRevision !== Number(remote.data.revision)) return { state: 'conflict', draft: { ...draft, sync: 'conflict' }, cloud: remote.data, message: 'This idea changed on another device. Compare both versions before saving.' };

  let catalystId = uuid(text(draft.data, 'Existing catalyst ID')) ? text(draft.data, 'Existing catalyst ID') : '';
  if (text(draft.data, 'Research path') === 'Catalyst first' && text(draft.data, 'Create linked catalyst') === 'Yes' && text(draft.data, 'Catalyst title') && text(draft.data, 'Catalyst date')) {
    // The linked catalyst shares the draft's stable UUID in its own table. This
    // keeps autosave and offline retries idempotent without coupling the records.
    catalystId = text(draft.data, 'Catalyst ID') || draft.id; await saveCatalyst(draft, user.id, catalystId);
  }
  const revision = remote.data ? Number(remote.data.revision) + 1 : 1;
  const strategySlug = text(draft.data, 'Strategy').toLowerCase().replaceAll(' ', '-');
  const strategy = (strategySlug === 'bear-put-spread' ? strategySlug : 'bull-call-spread') as Spread;
  const metrics = spreadMetrics(strategy, Number(text(draft.data, 'Long strike')), Number(text(draft.data, 'Short strike')), Number(text(draft.data, 'Net debit')), optionalInteger(text(draft.data, 'Contracts')));
  const recordedData = metrics ? { ...draft.data, 'Calculated max loss': String(metrics.maxLoss), 'Calculated max profit': String(metrics.maxProfit), 'Calculated break-even': String(metrics.breakEven) } : draft.data;
  const base = {
    ticker: text(draft.data, 'Ticker').toUpperCase() || 'TBD', strategy, bias: text(draft.data, 'Bias') || 'TBD', confidence: text(draft.data, 'Confidence') || null,
    underlying_type: text(draft.data, 'Underlying type') || null, originating_catalyst_id: catalystId || null, catalyst_cluster_id: text(draft.data, 'Catalyst cluster') || null,
    correlation_cluster: text(draft.data, 'Correlation cluster') || null, planned_hold_through_events: lines(text(draft.data, 'Hold through events')),
    planned_avoid_events: lines(text(draft.data, 'Avoid events')), expected_move: optionalNumber(text(draft.data, 'Expected move')), implied_move: optionalNumber(text(draft.data, 'Implied move')),
    opportunity_scores: {}, contracts: optionalInteger(text(draft.data, 'Contracts')), data: recordedData, revision, sync_status: 'cloud_draft', source: 'oj_app', mirror_status: 'not_requested', updated_at: new Date().toISOString(),
  };
  const query = remote.data
    ? supabase.from('trade_ideas').update(base).eq('id', draft.id).eq('user_id', user.id).eq('revision', remote.data.revision)
    : supabase.from('trade_ideas').insert({ ...base, id: draft.id, user_id: user.id, entry_status: text(draft.data, 'Status').toLowerCase() === 'deferred' ? 'deferred' : 'not-entered', user_confirmed_fill: false });
  const saved = await query.select().maybeSingle();
  if (saved.error || !saved.data) {
    const latest = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
    return latest.data ? { state: 'conflict', draft: { ...draft, sync: 'conflict' }, cloud: latest.data, message: 'Another device saved first. Both versions remain available.' } : { state: 'error', draft: { ...draft, sync: 'retry' }, message: saved.error?.message || 'Save failed.' };
  }
  await saveCandidate({ ...draft, data: recordedData }, user.id, revision);
  const canonical = { ...draft, data: recordedData, sync: 'canonical' as const, cloudRevision: revision, cloudUpdatedAt: String(saved.data.updated_at), updatedAt: String(saved.data.updated_at) };
  await saveDraft(canonical); await removeOperation(draft.ownerId, draft.id).catch(() => undefined);
  return { state: 'canonical', draft: canonical, cloud: saved.data, message: 'Saved to OJ.' };
}

export async function flushPendingOperations(ownerId: string) {
  const operations = await listOperations(ownerId);
  for (const operation of operations) {
    const result = await syncDraft(operation.payload); if (result.state === 'canonical') await removeOperation(ownerId, operation.recordId);
  }
}

export async function hydrateCloud(ownerId: string) {
  if (!supabase) return [];
  const user = await owner(ownerId); if (!user) return [];
  const { data, error } = await supabase.from('trade_ideas').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
  if (error) throw error; return data || [];
}
