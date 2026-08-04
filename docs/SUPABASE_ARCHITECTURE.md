# Supabase architecture

Supabase stores owner-scoped drafts, revisions, immutable submission payloads, jobs, synchronization events, and publication references. Canonical trade history remains Obsidian Markdown after manual pull-request merge. The browser uses only the project API URL and publishable key; backend credentials exist only in Edge Function or GitHub secrets.

## Authentication and allowlist

OJ uses email magic links with PKCE. Production redirects must allow `https://dkyaya.github.io/OJ/`; local development must allow `http://localhost:5173`. New Auth users receive a `profiles` row with `approved=false`. After verifying the owner UUID in Supabase Auth, an administrator changes only that profile to `approved=true`. RLS requires both owner identity and approval for journal access.

The current implementation intentionally has no public signup-driven data access: authenticating alone is insufficient. Never use a backend secret in the browser.

## Version-controlled backend

Apply every file under `supabase/migrations/` in timestamp order, then deploy:

- `submit-formalization` with JWT verification;
- `formalization-status` with JWT verification;
- `reconcile-publication` without gateway JWT because it performs its own constant-time webhook-secret check.

For local development, install the Supabase CLI, run `supabase start`, `supabase db reset`, and `supabase test db`. Link and push to production only with management credentials stored outside source. Production migrations and function versions are also reproducible through `.github/workflows/deploy-supabase.yml` once its optional deployment secrets are configured.

## Canonical boundary

Supabase is synchronization and workflow infrastructure, not a second journal. Published commit SHA and note path point back to the canonical repository file. Immutable payload snapshots and pull requests preserve the audit trail.
