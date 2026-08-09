# OJ — Options Journey

OJ is a private-by-default options research and journaling application delivered from a public static frontend. Supabase is the canonical datastore. OJ is not a brokerage, never receives brokerage credentials, and cannot place trades.

## Privacy boundary

This repository contains frontend code, branding, browser-safe Supabase configuration, schema migrations, Edge Functions, tests, and synthetic demo fixtures. Real trade theses, journal entries, research, attachments, emotional notes, account values, and exports never belong in public history.

`IndexedDB offline cache ↔ approved owner rows in Supabase`

An Obsidian-compatible Markdown export and the private `dkyaya/OJ-Journal` repository remain optional mirrors. Ordinary saves never create a Git commit or rebuild GitHub Pages.

## Local checks

From `app/`, run `npm ci`, `npm run copy:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run privacy:check`.

## Owner workflow

1. Sign in with an approved account.
2. Create or edit research. OJ keeps an offline IndexedDB copy and saves the same revision to Supabase.
3. Resolve a multi-device conflict explicitly if both copies changed.
4. Record an entry only after confirming a real fill. The transactional entry operation creates the position and updates the idea together.
5. Export one record or a full Obsidian-compatible journal whenever a Markdown copy is useful.

See `docs/NAVIGATION_ARCHITECTURE.md`, `docs/SUPABASE_CANONICAL_MODEL.md`, and `docs/OBSIDIAN_EXPORT.md` for the current architecture.
