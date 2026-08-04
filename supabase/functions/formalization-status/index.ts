import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors });

  const auth = req.headers.get('authorization');
  if (!auth) return new Response('unauthorized', { status: 401, headers: cors });

  const body = await req.json().catch(() => ({}));
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
    .select('id,status,pr_number,pr_url,branch,error,updated_at')
    .eq('id', id)
    .single();

  return new Response(JSON.stringify(error ? { error: 'job_not_found' } : data), {
    status: error ? 404 : 200,
    headers: { ...cors, 'content-type': 'application/json' },
  });
});
