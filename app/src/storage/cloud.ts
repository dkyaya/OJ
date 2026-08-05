import { cloudConfigured, supabase } from '../lib/supabase';
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

export async function syncDraft(draft: Draft): Promise<CloudResult> {
  if (!cloudConfigured || !supabase) {
    return { state: 'local', draft: { ...draft, sync: 'local' }, message: 'Saved locally; cloud is not configured.' };
  }
  if (!navigator.onLine) {
    return { state: 'local', draft: { ...draft, sync: 'offline' }, message: 'Saved locally. Cloud sync will retry when online.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { state: 'local', draft: { ...draft, sync: 'local' }, message: 'Saved locally. Sign in to sync across devices.' };
  }

  const profile = await supabase.from('profiles').select('approved').eq('id', user.id).single();
  if (!profile.data?.approved) {
    return { state: 'rejected', draft: { ...draft, sync: 'local' }, message: 'This account is not allowlisted yet.' };
  }

  const remote = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
  if (remote.error) {
    return { state: 'error', draft: { ...draft, sync: 'retry' }, message: remote.error.message };
  }
  if (remote.data && draft.cloudRevision !== remote.data.revision) {
    return {
      state: 'conflict',
      draft: { ...draft, sync: 'conflict' },
      cloud: remote.data,
      message: 'Cloud and local revisions both changed. Both copies were preserved.',
    };
  }

  const revision = remote.data ? remote.data.revision + 1 : 1;
  const row = {
    ticker: draft.data.Ticker || 'TBD',
    strategy: (draft.data.Strategy || 'bull-call-spread').toLowerCase().replaceAll(' ', '-'),
    bias: draft.data.Bias || 'TBD',
    confidence: draft.data.Confidence || null,
    data: draft.data,
    revision,
    sync_status: 'cloud_draft',
    updated_at: new Date().toISOString(),
  };

  const saved = remote.data
    ? await supabase
        .from('trade_ideas')
        .update(row)
        .eq('id', draft.id)
        .eq('user_id', user.id)
        .eq('revision', remote.data.revision)
        .select()
        .maybeSingle()
    : await supabase.from('trade_ideas').insert({ ...row, id: draft.id, user_id: user.id }).select().maybeSingle();

  if (saved.error) {
    const latest = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
    if (latest.data) {
      return {
        state: 'conflict',
        draft: { ...draft, sync: 'conflict' },
        cloud: latest.data,
        message: 'Another device updated this draft first. Both copies were preserved.',
      };
    }
    return { state: 'error', draft: { ...draft, sync: 'retry' }, message: saved.error.message };
  }
  if (!saved.data) {
    const latest = await supabase.from('trade_ideas').select('*').eq('id', draft.id).maybeSingle();
    return {
      state: 'conflict',
      draft: { ...draft, sync: 'conflict' },
      cloud: latest.data || undefined,
      message: 'Another device updated this draft first. Both copies were preserved.',
    };
  }

  return {
    state: 'synced',
    draft: {
      ...draft,
      sync: 'synced',
      cloudRevision: revision,
      cloudUpdatedAt: saved.data.updated_at,
      updatedAt: saved.data.updated_at,
    },
    cloud: saved.data,
  };
}

export async function hydrateCloud() {
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('trade_ideas')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function submitFormalization(draft: Draft) {
  if (!supabase || !draft.cloudRevision) throw new Error('Sync the cloud draft before submitting.');
  const { data, error } = await supabase.functions.invoke('submit-formalization', {
    body: { record_type: 'trade_idea', record_id: draft.id, revision: draft.cloudRevision },
  });
  if (error) throw error;
  return data as { job_id: string; status: string; reused?: boolean };
}

export async function getFormalizationStatus(jobId: string) {
  if (!supabase) throw new Error('Cloud is not configured.');
  const { data, error } = await supabase.functions.invoke('formalization-status', {
    body: { job_id: jobId },
  });
  if (error) throw error;
  return data as {
    id: string;
    status: string;
    pr_number?: number;
    pr_url?: string;
    branch?: string;
    error?: string;
    updated_at: string;
  };
}
