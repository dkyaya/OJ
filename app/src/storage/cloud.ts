import { cloudConfigured, supabase } from '../lib/supabase';
import { spreadMetrics, type Spread } from '../lib/payoff';
import type { Draft, DraftSyncState } from './drafts';

export type CloudResult = {
  state: 'local' | 'synced' | 'conflict' | 'rejected' | 'error';
  draft: Draft;
  cloud?: Record<string, unknown>;
  message?: string;
};

const cloudState = (status: string | null | undefined): DraftSyncState => {
  if (status === 'published') return 'published';
  if (status === 'pull_request_open' || status === 'changes_requested' || status === 'validated' || status === 'merged' || status === 'publishing') return 'pr_open';
  if (status === 'submitted' || status === 'formalization_pending') return 'submitted';
  if (status === 'failed') return 'retry';
  if (status === 'conflict') return 'conflict';
  return 'synced';
};

const text = (data: Record<string, string>, key: string) => data[key]?.trim() || '';
const optionalNumber = (value: string) => (value.trim() && Number.isFinite(Number(value)) ? Number(value) : null);
const optionalInteger = (value: string) => (Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null);
const numberFrom = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && Number.isFinite(Number(value)) ? Number(value) : null;
const lines = (value: string) => value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function cloudRowToDraft(row: Record<string, unknown>): Draft {
  return {
    id: String(row.id),
    kind: 'Create trade idea',
    data: (row.data as Record<string, string>) || {},
    updatedAt: String(row.updated_at),
    sync: cloudState(String(row.sync_status || 'cloud_draft')),
    cloudRevision: Number(row.revision),
    cloudUpdatedAt: String(row.updated_at),
    canonicalNotePath: row.published_note_path ? String(row.published_note_path) : undefined,
    publishedCommitSha: row.published_commit_sha ? String(row.published_commit_sha) : undefined,
  };
}

async function saveCatalystDraft(draft: Draft, userId: string, catalystId: string) {
  if (!supabase) return;
  const existing = await supabase.from('catalysts').select('id,revision').eq('id', catalystId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const data = draft.data;
  const revision = existing.data ? Number(existing.data.revision) + 1 : 1;
  const row = {
    event: text(data, 'Catalyst title'),
    event_type: text(data, 'Catalyst category') || 'other',
    event_at: `${text(data, 'Catalyst date')}T12:00:00.000Z`,
    catalyst_cluster_id: text(data, 'Catalyst cluster') || null,
    release_source: text(data, 'Verification source') || null,
    expected_sensitivity: text(data, 'Sensitivity') || null,
    research_status: 'researching',
    opportunity_scores: {},
    data: {
      sensitivity: text(data, 'Sensitivity') || 'TBD',
      scheduled_source: text(data, 'Verification source') || 'TBD',
      hold_through: lines(text(data, 'Hold through events')),
      avoid_events: lines(text(data, 'Avoid events')),
    },
    revision,
    sync_status: 'cloud_draft',
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from('catalysts').update(row).eq('id', catalystId).eq('user_id', userId).eq('revision', existing.data.revision).select().maybeSingle()
    : await supabase.from('catalysts').insert({ ...row, id: catalystId, user_id: userId }).select().maybeSingle();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Catalyst changed on another device. Refresh and review both copies.');
}

async function saveSecurityMapping(draft: Draft, userId: string, catalystId: string, tradeIdeaId: string) {
  if (!supabase || !text(draft.data, 'Ticker')) return;
  const existing = await supabase.from('catalyst_security_mappings').select('id,revision').eq('id', draft.id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const data = draft.data;
  const revision = existing.data ? Number(existing.data.revision) + 1 : 1;
  const row = {
    catalyst_id: catalystId,
    trade_idea_id: tradeIdeaId,
    ticker: text(data, 'Ticker').toUpperCase(),
    exposure_type: text(data, 'Exposure type') || 'direct',
    research_status: 'researching',
    sensitivity: text(data, 'Sensitivity') || null,
    correlation_cluster: text(data, 'Correlation cluster') || null,
    expected_move: optionalNumber(text(data, 'Expected move')),
    implied_move: optionalNumber(text(data, 'Implied move')),
    opportunity_scores: {},
    rationale: text(data, 'Security mapping rationale') || null,
    data: { manual_score_rationale: text(data, 'Score rationale') || 'TBD' },
    revision,
    sync_status: 'cloud_draft',
    updated_at: new Date().toISOString(),
  };
  const saved = existing.data
    ? await supabase.from('catalyst_security_mappings').update(row).eq('id', draft.id).eq('user_id', userId).eq('revision', existing.data.revision).select().maybeSingle()
    : await supabase.from('catalyst_security_mappings').insert({ ...row, id: draft.id, user_id: userId }).select().maybeSingle();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Security mapping changed on another device. Refresh and review both copies.');
}

export async function syncDraft(draft: Draft): Promise<CloudResult> {
  if (!cloudConfigured || !supabase) return { state: 'local', draft: { ...draft, sync: 'local' }, message: 'Saved locally; cloud is not configured.' };
  if (!navigator.onLine) return { state: 'local', draft: { ...draft, sync: 'offline' }, message: 'Saved locally. Cloud sync will retry when online.' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { state: 'local', draft: { ...draft, sync: 'local' }, message: 'Saved locally. Sign in to sync across devices.' };

  const profile = await supabase.from('profiles').select('approved').eq('id', user.id).single();
  if (!profile.data?.approved) return { state: 'rejected', draft: { ...draft, sync: 'local' }, message: 'This account is not allowlisted yet.' };

  const remote = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
  if (remote.error) return { state: 'error', draft: { ...draft, sync: 'retry' }, message: remote.error.message };
  if (remote.data && draft.cloudRevision !== remote.data.revision) {
    return { state: 'conflict', draft: { ...draft, sync: 'conflict' }, cloud: remote.data, message: 'Cloud and local revisions both changed. Both copies were preserved.' };
  }

  const catalystMode = text(draft.data, 'Research path') === 'Catalyst first';
  const requestedExistingCatalyst = text(draft.data, 'Existing catalyst ID');
  const createLinkedCatalyst = text(draft.data, 'Create linked catalyst') === 'Yes';
  let catalystId = uuid(requestedExistingCatalyst) ? requestedExistingCatalyst : '';
  if (catalystMode && createLinkedCatalyst && text(draft.data, 'Catalyst title') && text(draft.data, 'Catalyst date')) {
    catalystId = draft.id;
    try {
      await saveCatalystDraft(draft, user.id, catalystId);
    } catch (error) {
      return { state: 'error', draft: { ...draft, sync: 'retry' }, message: error instanceof Error ? error.message : 'Catalyst draft could not be saved.' };
    }
  }

  const revision = remote.data ? Number(remote.data.revision) + 1 : 1;
  const strategy = (text(draft.data, 'Strategy') || 'bull-call-spread').toLowerCase().replaceAll(' ', '-');
  const normalizedStrategy = (strategy === 'bear-put-spread' ? strategy : 'bull-call-spread') as Spread;
  const metrics = spreadMetrics(
    normalizedStrategy,
    Number(text(draft.data, 'Long strike')),
    Number(text(draft.data, 'Short strike')),
    Number(text(draft.data, 'Net debit')),
    optionalInteger(text(draft.data, 'Contracts')),
  );
  let riskCapacityBefore: number | null = null;
  let riskCapacityAfter: number | null = null;
  if (metrics) {
    const [policyResult, activeIdeasResult] = await Promise.all([
      supabase.from('account_policies').select('maximum_open_options_risk').maybeSingle(),
      supabase.from('trade_ideas').select('data').eq('entry_status', 'active').is('deleted_at', null),
    ]);
    const capacity = policyResult.data ? Number(policyResult.data.maximum_open_options_risk) : Number.NaN;
    const openRisk = (activeIdeasResult.data || []).reduce((sum, idea) => {
      const record = (idea.data || {}) as Record<string, unknown>;
      const value = numberFrom(record['Calculated max loss']);
      return value !== null && value >= 0 ? sum + value : sum;
    }, 0);
    if (Number.isFinite(capacity) && capacity > 0) {
      riskCapacityBefore = capacity - openRisk;
      riskCapacityAfter = capacity - openRisk - metrics.maxLoss;
    }
  }
  const recordedData = metrics
    ? { ...draft.data, 'Calculated max loss': String(metrics.maxLoss), 'Calculated max profit': String(metrics.maxProfit), 'Calculated break-even': String(metrics.breakEven) }
    : draft.data;
  const baseRow = {
    ticker: text(draft.data, 'Ticker').toUpperCase() || 'TBD',
    strategy: normalizedStrategy,
    bias: text(draft.data, 'Bias') || 'TBD',
    confidence: text(draft.data, 'Confidence') || null,
    underlying_type: text(draft.data, 'Underlying type') || null,
    originating_catalyst_id: catalystId || null,
    catalyst_cluster_id: text(draft.data, 'Catalyst cluster') || null,
    correlation_cluster: text(draft.data, 'Correlation cluster') || null,
    planned_hold_through_events: lines(text(draft.data, 'Hold through events')),
    planned_avoid_events: lines(text(draft.data, 'Avoid events')),
    expected_move: optionalNumber(text(draft.data, 'Expected move')),
    implied_move: optionalNumber(text(draft.data, 'Implied move')),
    opportunity_scores: {},
    contracts: optionalInteger(text(draft.data, 'Contracts')),
    risk_capacity_before: riskCapacityBefore,
    risk_capacity_after: riskCapacityAfter,
    data: recordedData,
    revision,
    sync_status: 'cloud_draft',
    updated_at: new Date().toISOString(),
  };
  const row = remote.data ? baseRow : { ...baseRow, entry_status: 'not-entered', user_confirmed_fill: false };
  const saved = remote.data
    ? await supabase.from('trade_ideas').update(row).eq('id', draft.id).eq('user_id', user.id).eq('revision', remote.data.revision).select().maybeSingle()
    : await supabase.from('trade_ideas').insert({ ...row, id: draft.id, user_id: user.id }).select().maybeSingle();

  if (saved.error) {
    const latest = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
    if (latest.data) return { state: 'conflict', draft: { ...draft, sync: 'conflict' }, cloud: latest.data, message: 'Another device updated this draft first. Both copies were preserved.' };
    return { state: 'error', draft: { ...draft, sync: 'retry' }, message: saved.error.message };
  }
  if (!saved.data) return { state: 'conflict', draft: { ...draft, sync: 'conflict' }, message: 'Another device updated this draft first. Both copies were preserved.' };

  if (catalystId) {
    try {
      await saveSecurityMapping(draft, user.id, catalystId, draft.id);
    } catch (error) {
      return { state: 'error', draft: { ...draft, sync: 'retry' }, cloud: saved.data, message: error instanceof Error ? error.message : 'Trade idea saved, but its security mapping needs a retry.' };
    }
  }

  return {
    state: 'synced',
    draft: { ...draft, data: recordedData, sync: 'synced', cloudRevision: revision, cloudUpdatedAt: saved.data.updated_at, updatedAt: saved.data.updated_at },
    cloud: saved.data,
  };
}

export async function hydrateCloud() {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('trade_ideas').select('*').is('deleted_at', null).order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function submitFormalization(draft: Draft) {
  if (!supabase || !draft.cloudRevision) throw new Error('Sync the cloud draft before submitting.');
  const { data, error } = await supabase.functions.invoke('submit-formalization', { body: { record_type: 'trade_idea', record_id: draft.id, revision: draft.cloudRevision } });
  if (error) throw error;
  return data as { job_id: string; status: string; reused?: boolean };
}

export async function getFormalizationStatus(jobId: string) {
  if (!supabase) throw new Error('Cloud is not configured.');
  const { data, error } = await supabase.functions.invoke('formalization-status', { body: { job_id: jobId } });
  if (error) throw error;
  return data as { id: string; status: string; pr_number?: number; pr_url?: string; branch?: string; error?: string; updated_at: string };
}
