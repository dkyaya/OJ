# Supabase architecture

Supabase stores owner-scoped drafts, revisions, immutable submission payloads, jobs, synchronization events, and the owner-visible normalized representation of a merged canonical note. Canonical trade history remains private Obsidian Markdown after manual merge in `dkyaya/OJ-Journal`. The browser uses only the project API URL and publishable key; backend credentials exist only in Edge Function or private GitHub secrets.

## Authentication and allowlist

OJ uses email magic links with PKCE. Production redirects must allow `https://dkyaya.github.io/OJ/`; local development must allow `http://localhost:5173`. New Auth users receive a `profiles` row with `approved=false`. After verifying the owner UUID in Supabase Auth, an administrator changes only that profile to `approved=true`. RLS requires both owner identity and approval for journal access.

The current implementation intentionally has no public signup-driven data access: authenticating alone is insufficient. Never use a backend secret in the browser.

## Version-controlled backend

Apply every file under `supabase/migrations/` in timestamp order, then deploy:

- `submit-formalization` with JWT verification;
- `formalization-status` with JWT verification;
- `reconcile-publication` without gateway JWT because it validates a timestamped, nonce-protected HMAC request and invokes one trusted transactional RPC.

For local development, install the Supabase CLI, run `supabase start`, `supabase db reset`, and `supabase test db`. Link and push to production only with management credentials stored outside source. Production migrations and function versions are also reproducible through `.github/workflows/deploy-supabase.yml` once its optional deployment secrets are configured.

## Canonical boundary

The public schema is explicitly exposed only where the browser needs it. Authenticated clients may read/insert/update approved owner drafts, read their profile, job status, and published normalized records, but cannot delete or mutate workflow state. Composite foreign keys bind every trade child to the same `(trade_idea_id,user_id)` owner. Server-only payloads and sync events have no browser grants/policies.

Supabase is synchronization and publication infrastructure, not a second Markdown journal. Published commit SHA and note path point to the private canonical file. Ordinary publication updates Supabase atomically and never triggers a public Pages build.
