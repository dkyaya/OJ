import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([Deno.env.get('OJ_ALLOWED_ORIGIN') || 'https://dkyaya.github.io', 'http://localhost:5173']);
const corsFor = (req: Request) => {
  const origin = req.headers.get('origin');
  return {
  ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
  'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'vary': 'origin',
  };
};

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return new Response('forbidden origin', { status: 403 });
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });
  if (Number(req.headers.get('content-length') || 0) > 2048) return new Response('request too large', { status: 413, headers: cors });

  const auth = req.headers.get('authorization');
  if (!auth) return new Response('unauthorized', { status: 401, headers: cors });

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > 2048) return new Response('request too large', { status: 413, headers: cors });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }
  const id = typeof body.job_id === 'string' ? body.job_id : null;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response(JSON.stringify({ error: 'invalid_job_id' }), {
      status: 400,
      headers: { ...cors, 'content-type': 'application/json' },
    });
  }

  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data, error } = await client
    .from('formalization_jobs')
    .select('id,status,pr_number,pr_url,branch,note_path,canonical_commit_sha,published_at,error,updated_at')
    .eq('id', id)
    .single();

  return new Response(JSON.stringify(error ? { error: 'job_not_found' } : data), {
    status: error ? 404 : 200,
    headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
});
