# OJ — Options Journey

OJ is a private, local-first options-trading research journal with a static React dashboard. It is not a brokerage and cannot place trades.

## Architecture

`Obsidian Markdown → validate notes → sanitize/static JSON → Vite React dashboard → GitHub Pages`

The initial repository was empty; this foundation follows the supplied structure with the Vite application contained in `app/` and source-vault folders at the repository root.

## Local use

```bash
cd app
npm install
npm run build
npm run dev
```

The first command validates `Trade Ideas/`, then produces sanitized output under `app/public/data/`. Never edit those generated JSON files as the source of truth.

## Obsidian workflow

1. Create a note with a supplied template.
2. Keep all unknown contract/fill fields as `TBD`.
3. Move notes to `Active Trades/` or `Closed Trades/` only after explicit user-confirmed fills/exits.
4. Run `npm run data:build` to update the dashboard.

## Privacy

Only sanitized public-safe fields are emitted. Do not place credentials, account numbers, tax data, addresses, unredacted confirmations, or private attachments in public-source notes. GitHub Pages deployment is configured in `.github/workflows/deploy-pages.yml` and expects repository Pages to be enabled.

## Quality checks

Run `npm run validate:data`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from `app/`. Browser-review evidence is kept in `artifacts/browser-review/` and never deployed.
