# Supabase architecture

Supabase stores the canonical owner-scoped application records, revisions, portfolio policy, preferences, and optional mirror jobs. The private Obsidian journal is a portable mirror and historical migration source. The browser uses only the project API URL and publishable key; backend credentials exist only in trusted functions or private migration environments.

## Authentication and allowlist

OJ uses email magic links with PKCE. Production redirects must allow `https://dkyaya.github.io/OJ/`; local development must allow `http://localhost:5173`. New Auth users receive a `profiles` row with `approved=false`. After verifying the owner UUID in Supabase Auth, an administrator changes only that profile to `approved=true`. RLS requires both owner identity and approval for journal access.

The current implementation intentionally has no public signup-driven data access: authenticating alone is insufficient. Never use a backend secret in the browser.

## Version-controlled backend

Apply every file under `supabase/migrations/` in timestamp order, then deploy:

- optional `submit-formalization` with JWT verification for an owner-requested mirror;
- optional `formalization-status` with JWT verification;
- `reconcile-publication` without gateway JWT because it validates a timestamped, nonce-protected HMAC request and invokes one trusted transactional RPC.

For local development, install the Supabase CLI, run `supabase start`, `supabase db reset`, and `supabase test db`. Link and push to production only with management credentials stored outside source. Production migrations and function versions are also reproducible through `.github/workflows/deploy-supabase.yml` once its optional deployment secrets are configured.

## Canonical boundary

The public schema is explicitly exposed only where the browser needs it. Authenticated clients may read and update approved owner records, but cannot directly delete tables, mutate trusted workflow state, or directly create confirmed positions. Permanent idea deletion is mediated by an archive-first, exact-confirmation command and private processor. Composite foreign keys bind every trade child to the same `(trade_idea_id,user_id)` owner. Server-only payloads and sync events have no browser grants or policies.

Supabase is the application authority. Commit SHA and note path fields are optional provenance for a private Markdown mirror. Ordinary saves update Supabase directly and never trigger a public Pages build.
