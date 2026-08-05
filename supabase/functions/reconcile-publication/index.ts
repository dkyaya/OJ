import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
const timingSafe = (left: string, right: string) => {
  if (!/^[0-9a-f]{64}$/i.test(left) || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > 550_000) return json({ error: 'request_too_large' }, 413);
  const raw = await req.text();
  if (encoder.encode(raw).byteLength > 550_000) return json({ error: 'request_too_large' }, 413);
  const timestamp = req.headers.get('x-oj-timestamp') || '';
  const nonce = req.headers.get('x-oj-nonce') || '';
  const signature = req.headers.get('x-oj-signature') || '';
  const occurredAt = Number(timestamp);
  if (!Number.isInteger(occurredAt) || Math.abs(Date.now() / 1000 - occurredAt) > 300) return json({ error: 'stale_callback' }, 401);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce)) return json({ error: 'invalid_nonce' }, 401);
  const secret = Deno.env.get('OJ_FORMALIZATION_WEBHOOK_SECRET') || '';
  if (!secret) return json({ error: 'server_configuration_incomplete' }, 503);
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${nonce}.${raw}`)));
  if (!timingSafe(signature, expected)) return json({ error: 'invalid_signature' }, 401);

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400); }
  const keys = ['job_id','payload_revision','pr_number','pr_url','branch','commit_sha','note_path','payload_hash','canonical_record'];
  if (Object.keys(body).some((keyName) => !keys.includes(keyName))) return json({ error: 'invalid_schema' }, 400);
  if (!/^[0-9a-f-]{36}$/i.test(String(body.job_id || '')) || !Number.isInteger(body.payload_revision) || !Number.isInteger(body.pr_number)) return json({ error: 'invalid_schema' }, 400);
  if (!/^https:\/\/github\.com\/dkyaya\/OJ-Journal\/pull\/[1-9][0-9]*$/.test(String(body.pr_url || ''))) return json({ error: 'invalid_pr_url' }, 400);
  if (!body.canonical_record || typeof body.canonical_record !== 'object' || Array.isArray(body.canonical_record)) return json({ error: 'invalid_canonical_record' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY');
  if (!url || !secretKey) return json({ error: 'server_configuration_incomplete' }, 503);
  const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc('reconcile_formalization_publication', {
    p_job_id: body.job_id,
    p_payload_revision: body.payload_revision,
    p_pr_number: body.pr_number,
    p_pr_url: body.pr_url,
    p_branch: body.branch,
    p_commit_sha: body.commit_sha,
    p_note_path: body.note_path,
    p_payload_hash: body.payload_hash,
    p_canonical_record: body.canonical_record,
    p_nonce: nonce,
    p_occurred_at: new Date(occurredAt * 1000).toISOString(),
  });
  if (error) {
    console.error('atomic_reconciliation_rejected');
    const replay = error.message?.includes('reconciliation_nonces_pkey');
    return json({ error: replay ? 'replayed_callback' : 'reconciliation_rejected' }, replay ? 409 : 422);
  }
  return json(data);
});
