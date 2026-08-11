import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  Deno.env.get('OJ_ALLOWED_ORIGIN') || 'https://dkyaya.github.io',
  'http://localhost:5173',
]);
const inviteTtlMs = 60 * 60 * 1000;

const corsFor = (req: Request) => {
  const origin = req.headers.get('origin');
  return {
    ...(origin && allowedOrigins.has(origin) ? { 'access-control-allow-origin': origin } : {}),
    'access-control-allow-headers': 'apikey, authorization, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'origin',
  };
};

const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsFor(req), 'content-type': 'application/json', 'cache-control': 'no-store' },
});

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'forbidden_origin' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);
  if (Number(req.headers.get('content-length') || 0) > 2048) return json(req, { error: 'request_too_large' }, 413);

  try {
    const authorization = req.headers.get('authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const backendSecret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!authorization) return json(req, { error: 'authentication_required' }, 401);
    if (!url || !publishableKey || !backendSecret) return json(req, { error: 'server_configuration_incomplete' }, 503);

    const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(req, { error: 'authentication_required' }, 401);

    const admin = createClient(url, backendSecret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await admin.from('profiles').select('approved,account_role,account_status').eq('id', user.id).maybeSingle();
    if (!profile?.approved || profile.account_role !== 'owner' || profile.account_status !== 'active') return json(req, { error: 'owner_required' }, 403);

    const recent = await admin.from('workspace_invites').select('id', { count: 'exact', head: true }).eq('invited_by', user.id).gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((recent.count || 0) >= 5) return json(req, { error: 'rate_limited' }, 429);

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2048) return json(req, { error: 'request_too_large' }, 413);
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    if (Object.keys(body).some((key) => !['email', 'workspace_id'].includes(key))) return json(req, { error: 'invalid_invitation' }, 400);
    const email = String(body.email || '').trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(req, { error: 'invalid_invitation' }, 400);

    let workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : '';
    if (!workspaceId) {
      const membership = await admin.from('workspace_members').select('workspace_id').eq('user_id', user.id).eq('workspace_role', 'owner').eq('membership_status', 'active').limit(1).maybeSingle();
      workspaceId = membership.data?.workspace_id || '';
    }
    const ownerMembership = workspaceId ? await admin.from('workspace_members').select('workspace_id').eq('workspace_id', workspaceId).eq('user_id', user.id).eq('workspace_role', 'owner').eq('membership_status', 'active').maybeSingle() : { data: null };
    if (!ownerMembership.data) return json(req, { error: 'workspace_owner_required' }, 403);

    const expiresAt = new Date(Date.now() + inviteTtlMs).toISOString();
    const pendingWorkspaceInvite = await admin.from('workspace_invites').select('id').eq('workspace_id', workspaceId).eq('email_normalized', email).eq('status', 'pending').maybeSingle();
    const workspaceInvitation = pendingWorkspaceInvite.data
      ? await admin.from('workspace_invites').update({ invited_by: user.id, created_at: new Date().toISOString(), expires_at: expiresAt }).eq('id', pendingWorkspaceInvite.data.id).select('id').single()
      : await admin.from('workspace_invites').insert({ workspace_id: workspaceId, email_normalized: email, invited_by: user.id, status: 'pending', expires_at: expiresAt }).select('id').single();
    if (workspaceInvitation.error) return json(req, { error: 'invitation_failed' }, 500);

    const existingProfile = await admin.from('profiles').select('id,approved,account_status').ilike('email', email).maybeSingle();
    if (existingProfile.data?.approved && existingProfile.data.account_status === 'active') {
      return json(req, { status: 'invited', expires_at: expiresAt }, 202);
    }

    const existing = await admin.from('account_invites').select('status,expires_at').eq('email_normalized', email).maybeSingle();
    if (existing.data?.status === 'accepted') {
      await admin.from('workspace_invites').update({ status: 'revoked' }).eq('id', workspaceInvitation.data.id).eq('status', 'pending');
      return json(req, { error: 'invitation_unavailable' }, 409);
    }

    const invitation = await admin.from('account_invites').upsert({
      email_normalized: email,
      invited_by: user.id,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      accepted_at: null,
      accepted_user_id: null,
    }, { onConflict: 'email_normalized' }).select('id').single();
    if (invitation.error) return json(req, { error: 'invitation_failed' }, 500);

    const { error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) {
      await admin.from('account_invites').update({ status: 'revoked' }).eq('id', invitation.data.id).eq('status', 'pending');
      await admin.from('workspace_invites').update({ status: 'revoked' }).eq('id', workspaceInvitation.data.id).eq('status', 'pending');
      console.error('invite_delivery_failed');
      return json(req, { error: 'invitation_failed' }, 502);
    }

    return json(req, { status: 'invited', expires_at: expiresAt }, 202);
  } catch (error) {
    console.error(error instanceof SyntaxError ? 'invalid_json' : 'invite_request_failed');
    return json(req, { error: error instanceof SyntaxError ? 'invalid_json' : 'invitation_failed' }, error instanceof SyntaxError ? 400 : 500);
  }
});
