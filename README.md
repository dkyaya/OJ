# OJ — Options Journey

OJ is a private-by-default options research and journaling application delivered from a public static frontend. Supabase is the canonical datastore. OJ is not a brokerage, never receives brokerage credentials, and cannot place trades.

## Privacy boundary

This repository contains frontend code, branding, browser-safe Supabase configuration, schema migrations, Edge Functions, tests, and synthetic demo fixtures. Real trade theses, journal entries, research, attachments, emotional notes, account values, and exports never belong in public history.

`IndexedDB offline cache ↔ approved owner rows in Supabase`

An Obsidian-compatible Markdown export and the private `dkyaya/OJ-Journal` repository remain optional mirrors. Ordinary saves never create a Git commit or rebuild GitHub Pages.

## Local checks

From `app/`, run `npm ci`, `npm run copy:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run privacy:check`.

## Owner workflow

1. Sign in with the verified email and password for an invited, active account. Supabase restores and refreshes sessions; OJ never handles credential storage.
2. Create or edit research. OJ keeps an offline IndexedDB copy and saves the same revision to Supabase.
3. Resolve a multi-device conflict explicitly if both copies changed.
4. Record an entry only after confirming a real fill. The transactional entry operation creates the position and updates the idea together.
5. Export one record or a full Obsidian-compatible journal whenever a Markdown copy is useful.

See `docs/NAVIGATION_ARCHITECTURE.md`, `docs/SUPABASE_CANONICAL_MODEL.md`, and `docs/OBSIDIAN_EXPORT.md` for the current architecture.

## Accounts

OJ has no public signup. The production owner can send a future member invitation from Settings → Access. The invite link establishes a verified Supabase session, the member chooses a password, and a server-validated activation promotes only the matching live invitation. Settings also supports profile editing, password changes, current-device sign-out, and global sign-out.

Browser drafts and retry operations are namespaced by Supabase user ID. On sign-out, private application state and that account's local cache are cleared while harmless global theme preferences remain. See `docs/AUTHENTICATION.md`, `docs/INVITE_FLOW.md`, and `docs/SESSION_SECURITY.md`.
