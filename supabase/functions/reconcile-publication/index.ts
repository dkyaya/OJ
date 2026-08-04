import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const safe = (left: string, right: string) => {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const given = req.headers.get('x-oj-webhook-secret') || '';
  const expected = Deno.env.get('OJ_FORMALIZATION_WEBHOOK_SECRET') || '';
  if (!safe(given, expected)) return new Response('unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.job_id || !body.commit_sha) return new Response('invalid', { status: 400 });

  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !secret) return new Response('server configuration incomplete', { status: 503 });
  const db = createClient(url, secret);
  const { data: job } = await db.from('formalization_jobs').select('*').eq('id', body.job_id).single();
  if (!job?.note_path) return new Response('not found', { status: 404 });

  const now = new Date().toISOString();
  const { error: jobError } = await db
    .from('formalization_jobs')
    .update({
      status: 'published',
      pr_number: body.pr_number,
      pr_url: body.pr_url,
      branch: body.branch,
      updated_at: now,
    })
    .eq('id', job.id);
  if (jobError) return new Response('job update failed', { status: 500 });

  const { data: published, error: publishedError } = await db
    .from('published_records')
    .upsert(
      {
        user_id: job.user_id,
        record_type: job.record_type,
        record_id: job.record_id,
        note_path: job.note_path,
        commit_sha: body.commit_sha,
        pr_number: body.pr_number,
        merged_at: now,
      },
      { onConflict: 'record_type,record_id' },
    )
    .select('id')
    .single();
  if (publishedError || !published) return new Response('publication update failed', { status: 500 });

  const tables: Record<string, string> = {
    trade_idea: 'trade_ideas',
    trade_entry: 'trade_entries',
    trade_checkin: 'trade_checkins',
    trade_exit: 'trade_exits',
    journal_review: 'journal_reviews',
    catalyst: 'catalysts',
    research_annotation: 'research_annotations',
  };
  const table = tables[job.record_type];
  if (!table) return new Response('unsupported record type', { status: 400 });
  const update: Record<string, unknown> = { sync_status: 'published', updated_at: now };
  if (table === 'trade_ideas') {
    update.published_record_id = published.id;
    update.published_commit_sha = body.commit_sha;
    update.published_note_path = job.note_path;
    update.last_published_at = now;
  }
  const { error: recordError } = await db.from(table).update(update).eq('id', job.record_id).eq('user_id', job.user_id);
  if (recordError) return new Response('record update failed', { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
});
