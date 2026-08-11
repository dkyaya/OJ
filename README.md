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
4. Archive research-only ideas when they no longer belong in active views; restore them later with status, candidates, and revision history intact. Archive and restore require a live connection and the current revision.
5. If an archived research-only idea should be removed instead, use its separate permanent Delete action and type the exact ticker-specific confirmation. Ideas with trade or journal history cannot be deleted, and external exports remain separate copies.
6. Record an entry only after confirming a real fill. The transactional entry operation creates the position and updates the idea together.
7. Export one record or a full Obsidian-compatible journal whenever a Markdown copy is useful.

Research workspaces add optional collaboration without changing that owner boundary. Members can share catalyst facts, evidence, reviewed thesis summaries, research missions, explicitly shared forecasts, and factual debriefs. Account values, policies, trades, private Ideas, private forecasts, journal entries, and personal lessons never become workspace data. See `docs/WORKSPACE_MODEL.md`, `docs/SHARED_RESEARCH.md`, `docs/RESEARCH_MISSIONS.md`, and `docs/FORECAST_MODEL.md`.

See `docs/NAVIGATION_ARCHITECTURE.md`, `docs/SUPABASE_CANONICAL_MODEL.md`, `docs/IDEA_ARCHIVE.md`, and `docs/OBSIDIAN_EXPORT.md` for the current architecture.

## Accounts

OJ has no public signup. The production owner can send a future member invitation from Settings → Access. The email contains a six-digit invite code and a scanner-safe link that only opens OJ. The recipient enters the invited email, code, and a new password; OJ clears any conflicting session in that browser, verifies the code as the invited identity, and then invokes the server-validated activation operation. Settings also supports profile editing, password changes, current-device sign-out, and global sign-out.

Browser drafts and retry operations are namespaced by Supabase user ID. On sign-out, private application state and that account's local cache are cleared while harmless global theme preferences remain. See `docs/AUTHENTICATION.md`, `docs/INVITE_FLOW.md`, `docs/INVITE_OTP_ACTIVATION.md`, and `docs/SESSION_SECURITY.md`.
