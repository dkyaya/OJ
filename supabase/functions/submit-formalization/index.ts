import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { App } from 'npm:octokit@5.0.5';

const allowedOrigins = new Set([
  Deno.env.get('OJ_ALLOWED_ORIGIN') || 'https://dkyaya.github.io',
  'http://localhost:5173',
]);
const corsFor = (req: Request) => {
  const origin = req.headers.get('origin');
  return {
  ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
  'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'vary': 'origin',
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'content-type': 'application/json', 'cache-control': 'no-store' },
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
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return new Response('forbidden origin', { status: 403 });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) });

  try {
    if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
    const length = Number(req.headers.get('content-length') || 0);
    if (length > 4096) return json(req, { error: 'request_too_large' }, 413);

    const auth = req.headers.get('authorization');
    if (!auth) return json(req, { error: 'authentication_required' }, 401);

    const url = Deno.env.get('SUPABASE_URL');
    const backendSecret = Deno.env.get('SUPABASE_SECRET_KEY');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const appId = Deno.env.get('OJ_GITHUB_APP_ID');
    const installationId = Number(Deno.env.get('OJ_GITHUB_APP_INSTALLATION_ID'));
    const privateKey = (Deno.env.get('OJ_GITHUB_APP_PRIVATE_KEY') || '').replaceAll('\\n', '\n');
    const repo = Deno.env.get('OJ_PRIVATE_REPOSITORY') || 'dkyaya/OJ-Journal';
    const workflow = Deno.env.get('OJ_FORMALIZATION_WORKFLOW') || 'formalize-oj-record.yml';
    if (!url || !backendSecret || !publishableKey || !appId || !Number.isInteger(installationId) || !privateKey) {
      return json(req, { error: 'server_configuration_incomplete' }, 503);
    }
    if (repo !== 'dkyaya/OJ-Journal' || workflow !== 'formalize-oj-record.yml') return json(req, { error: 'server_target_invalid' }, 503);

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: auth } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json(req, { error: 'authentication_required' }, 401);

    const admin = createClient(url, backendSecret);
    const { data: profile } = await admin
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single();
    if (!profile?.approved) return json(req, { error: 'not_allowlisted' }, 403);

    const recent = await admin
      .from('formalization_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((recent.count || 0) >= 10) return json(req, { error: 'rate_limited' }, 429);

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4096) return json(req, { error: 'request_too_large' }, 413);
    const body = JSON.parse(rawBody);
    const recordId = String(body.record_id || '');
    const recordType = String(body.record_type || 'trade_idea');
    const revision = Number(body.revision);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recordId) || !Number.isInteger(revision) || revision < 1 || Object.keys(body).some((key) => !['record_id','record_type','revision'].includes(key))) {
      return json(req, { error: 'invalid_submission' }, 400);
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
    if (!table) return json(req, { error: 'unsupported_record_type' }, 400);

    const { data: record } = await admin
      .from(table)
      .select('*')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single();
    if (!record) return json(req, { error: 'record_not_found' }, 404);
    if (record.revision !== revision) {
      return json(req, { error: 'revision_conflict', cloud_revision: record.revision }, 409);
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
      if (!parent) return json(req, { error: 'parent_not_found' }, 409);
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
    let job = existing.data;
    if (job && job.status !== 'failed') return json(req, { job_id: job.id, status: job.status, reused: true });
    if (!job) {
      const created = await admin.from('formalization_jobs').insert({
          user_id: user.id, record_type: recordType, record_id: recordId, payload_revision: revision,
          payload_hash: payloadHash, idempotency_key: idempotencyKey, status: 'formalization_pending',
        }).select('id,status').single();
      if (created.error || !created.data) {
        const raced = await admin.from('formalization_jobs').select('id,status').eq('idempotency_key', idempotencyKey).maybeSingle();
        if (!raced.data) throw new Error('job_creation_failed');
        job = raced.data;
      } else job = created.data;
      const { error: payloadError } = await admin.from('formalization_payloads').insert({
        job_id: job.id, user_id: user.id, payload: snapshot, payload_hash: payloadHash,
      });
      if (payloadError) {
        await admin.from('formalization_jobs').update({ status: 'failed', error: 'payload_snapshot_failed' }).eq('id', job.id);
        throw new Error('payload_snapshot_failed');
      }
    } else {
      await admin.from('formalization_jobs').update({ status: 'formalization_pending', error: null }).eq('id', job.id).eq('user_id', user.id);
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

    const [owner, repository] = repo.split('/');
    const app = new App({ appId, privateKey });
    const octokit = await app.getInstallationOctokit(installationId);
    try {
      await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
        owner, repo: repository, workflow_id: workflow, ref: 'main', inputs: { job_id: job.id },
        headers: { 'x-github-api-version': '2026-03-10' },
      });
    } catch {
      await admin
        .from('formalization_jobs')
        .update({ status: 'failed', error: 'dispatch_failed' })
        .eq('id', job.id);
      return json(req, { error: 'workflow_dispatch_failed', job_id: job.id }, 502);
    }

    return json(req, { job_id: job.id, status: 'formalization_pending' }, 202);
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'invalid_json' : 'submission_error');
    return json(req, { error: error instanceof SyntaxError ? 'invalid_json' : 'submission_failed' }, error instanceof SyntaxError ? 400 : 500);
  }
});
