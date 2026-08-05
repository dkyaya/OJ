# OJ — Options Journey public application

OJ is a public, static React application shell for a private options-research journal. It is not a brokerage, never receives brokerage credentials, and cannot place trades.

## Privacy boundary

This repository contains frontend code, branding, browser-safe Supabase configuration, schema/migrations, Edge Functions, tests, and empty demo fixtures. Canonical Markdown, trade theses, journal entries, research, attachments, emotional notes, real account values, immutable payloads, and formalization branches live only in the private `dkyaya/OJ-Journal` repository or owner-scoped Supabase rows.

`IndexedDB cache ↔ approved owner Supabase drafts → private OJ-Journal PR → manual merge → atomic owner-visible publication`

Ordinary journal publication never commits to this repository and never rebuilds GitHub Pages.

## Local checks

From `app/`, run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run privacy:check`.

## Owner workflow

1. Create or edit a local draft. OJ saves immediately in IndexedDB and syncs the exact revision after approved sign-in.
2. Resolve any device conflict explicitly.
3. Submit the synchronized revision. A GitHub App dispatches a private formalization workflow.
4. Automatic private checks and Codex review run on that PR.
5. The owner manually merges. A signed callback invokes one transactional publication RPC.
6. OJ loads the canonical normalized record from Supabase without a Pages deployment.
