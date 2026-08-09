# Phase 0 Current-State Matrix

Reviewed 2026-08-08 before implementation. Real records were inspected only in the private journal repository and were not copied into public history.

| Concern | Before Phase 1 | Phase 4 target | Reconciliation decision |
| --- | --- | --- | --- |
| Canonical data | Private Markdown after a formalization PR; Supabase acted as draft/publication infrastructure | Owner-scoped Supabase rows | Keep secure legacy automation only as an optional mirror/export path. |
| Ordinary save | IndexedDB → Supabase draft → GitHub App → private PR → merge callback | IndexedDB ↔ Supabase | Remove the PR dependency from normal UI actions. |
| Public privacy | Privacy checks passing on the repair branch; deployed `main` still precedes the repair | No real user data in source, bundle, fixtures, screenshots, or Pages artifacts | Preserve the repair branch and public privacy gate. Do not merge without the owner. |
| Supabase security | RLS enabled on existing application tables; security advisor had no findings | RLS on every canonical table, approved-user gating, explicit Data API grants | Extend the same owner model to trades, preferences, revisions, policy history, and migration registry. |
| Supabase content | No auth users and no application rows at review time | One approved owner and migrated private records | Import tooling can be completed, but the owner must first create the account that will own the rows. |
| Navigation | Multiple legacy route names and incomplete mobile access | Six primary sections plus secondary Settings | Canonicalize routes while preserving redirects for old hashes. |
| Cards | Page-specific presentation | Summary → metric → expandable details → full editor | Add shared card components and document their boundaries. |
| Mobile | Fixed bottom navigation omitted destinations | Four direct destinations plus an accessible More sheet | Keep every primary section and Build Idea reachable without crowding the bar. |
| Brokerage boundary | No brokerage connection | Unchanged | Require explicit actual-fill confirmation and a transactional entry operation. |
| Private journal | Canonical Obsidian vault | Optional mirror/export and historical source | Preserve provenance and Markdown; do not require it at runtime. |
| GitHub state | Public repair PR open; private migration branch unmerged | Owner remains final merge authority | Update existing branches only; no merge or auto-merge. |

## Validation Baseline

- Public app: lint, typecheck, 13 baseline tests, build, privacy scan, and dependency audit passed before this work.
- Private journal: validation, tests, security scan, and formalization dry run passed before this work.
- Supabase: seven pre-existing migrations applied; zero auth users; all application tables empty; no Security Advisor findings.
- Production: the GitHub Pages site is still built from the older `main` branch. Local validation cannot change production until the owner merges the repair PR.

## Preserved Work

- The ongoing security separation, GitHub App, RLS, reconciliation, calendar, and responsive work was retained.
- Existing legacy URLs continue to resolve through explicit aliases.
- Legacy formalization functions remain deployable for optional private Markdown mirroring, not normal application saves.
