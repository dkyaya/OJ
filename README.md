# OJ — Options Journey

OJ is a private, local-first options-trading research journal with authenticated Supabase draft synchronization and a static React shell. It is not a brokerage and cannot place trades.

## Architecture

`IndexedDB cache ↔ Supabase private drafts → immutable submission → automated PR → human merge → canonical Obsidian Markdown → sanitized GitHub Pages build`

The initial repository was empty; this foundation follows the supplied structure with the Vite application contained in `app/` and source-vault folders at the repository root.

## Local use

```bash
cd app
npm install
npm run build
npm run dev
```

The build validates `Trade Ideas/`, then produces sanitized output under `app/public/data/`. Never edit generated JSON as the source of truth. Copy `app/.env.example` to an ignored local `.env` for browser-safe Supabase configuration.

## Cloud and Obsidian workflow

1. OJ immediately saves a draft to IndexedDB, then syncs it to the signed-in owner’s Supabase rows.
2. Submission freezes an immutable revision and dispatches the formalization workflow.
3. Automation opens a branch and pull request; Codex reviews the same branch.
4. The user manually merges. Reconciliation marks the cloud record published and GitHub Pages redeploys.
5. Unknown market/fill fields remain `TBD`; actual entries/exits always require explicit confirmation.

## Privacy

The public shell contains no exact balances or private draft content. Authenticated records are loaded from Supabase under owner-only RLS and an approval allowlist. Never store credentials, account numbers, tax data, addresses, raw confirmations, or brokerage authentication in OJ.

## Quality checks

Run `npm run validate:data`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from `app/`. Browser-review evidence is kept in `artifacts/browser-review/` and never deployed.
