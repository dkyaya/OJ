import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  });

const sha256 = async (value: string) =>
  crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(value))
    .then((bytes) =>
      Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    );

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    const auth = req.headers.get('authorization');
    if (!auth) return json({ error: 'authentication_required' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const backendSecret = Deno.env.get('SUPABASE_SECRET_KEY');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const githubToken = Deno.env.get('GITHUB_OJ_TOKEN');
    const repo = Deno.env.get('GITHUB_REPOSITORY') || 'dkyaya/OJ';
    const workflow = Deno.env.get('GITHUB_FORMALIZATION_WORKFLOW') || 'formalize-oj-record.yml';
    if (!url || !backendSecret || !publishableKey || !githubToken) {
      return json({ error: 'server_configuration_incomplete' }, 503);
    }

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'authentication_required' }, 401);

    const admin = createClient(url, backendSecret);
    const { data: profile } = await admin
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single();
    if (!profile?.approved) return json({ error: 'not_allowlisted' }, 403);

    const body = await req.json();
    const recordId = String(body.record_id || '');
    const recordType = String(body.record_type || 'trade_idea');
    const revision = Number(body.revision);
    if (!recordId || !Number.isInteger(revision) || revision < 1) {
      return json({ error: 'invalid_submission' }, 400);
    }

    const tables: Record<string, string> = {
      trade_idea: 'trade_ideas',
      trade_entry: 'trade_entries',
      trade_checkin: 'trade_checkins',
      trade_exit: 'trade_exits',
      journal_review: 'journal_reviews',
      catalyst: 'catalysts',
      research_annotation: 'research_annotations',
    };
    const table = tables[recordType] || null;
    if (!table) return json({ error: 'unsupported_record_type' }, 400);

    const { data: record } = await admin
      .from(table)
      .select('*')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single();
    if (!record) return json({ error: 'record_not_found' }, 404);
    if (record.revision !== revision) {
      return json({ error: 'revision_conflict', cloud_revision: record.revision }, 409);
    }

    let parent: Record<string, unknown> | null = null;
    if ('trade_idea_id' in record && record.trade_idea_id) {
      const parentResult = await admin
        .from('trade_ideas')
        .select('id,ticker,strategy,published_note_path,published_commit_sha')
        .eq('id', record.trade_idea_id)
        .eq('user_id', user.id)
        .single();
      parent = parentResult.data;
    }
    const snapshot = {
      ...record,
      _formalization: { record_type: recordType, parent },
    };
    const idempotencyKey = await sha256(`${user.id}:${recordType}:${recordId}:${revision}`);
    const payloadHash = await sha256(JSON.stringify(snapshot));
    const existing = await admin
      .from('formalization_jobs')
      .select('id,status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing.data) {
      return json({ job_id: existing.data.id, status: existing.data.status, reused: true });
    }

    const { data: job, error: jobError } = await admin
      .from('formalization_jobs')
      .insert({
        user_id: user.id,
        record_type: recordType,
        record_id: recordId,
        payload_revision: revision,
        idempotency_key: idempotencyKey,
        status: 'formalization_pending',
      })
      .select('id,status')
      .single();
    if (jobError || !job) throw jobError || new Error('job_creation_failed');

    const { error: payloadError } = await admin.from('formalization_payloads').insert({
      job_id: job.id,
      user_id: user.id,
      payload: snapshot,
      payload_hash: payloadHash,
    });
    if (payloadError) {
      await admin.from('formalization_jobs').update({ status: 'failed', error: 'payload_snapshot_failed' }).eq('id', job.id);
      throw new Error('payload_snapshot_failed');
    }

    const submissionUpdate: Record<string, unknown> = {
      sync_status: 'submitted',
      updated_at: new Date().toISOString(),
    };
    if (table === 'trade_ideas') submissionUpdate.last_submitted_at = new Date().toISOString();
    await admin
      .from(table)
      .update(submissionUpdate)
      .eq('id', recordId)
      .eq('user_id', user.id);

    const dispatch = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${githubToken}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'x-github-api-version': '2022-11-28',
        },
        body: JSON.stringify({ ref: 'main', inputs: { job_id: job.id } }),
      },
    );
    if (!dispatch.ok) {
      await admin
        .from('formalization_jobs')
        .update({ status: 'failed', error: `dispatch_${dispatch.status}` })
        .eq('id', job.id);
      return json({ error: 'workflow_dispatch_failed', job_id: job.id }, 502);
    }

    return json({ job_id: job.id, status: 'formalization_pending' }, 202);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'unknown_submission_error');
    return json({ error: 'submission_failed' }, 500);
  }
});
