# Private Journal Migration

The one-time importer lives in the private `OJ-Journal` repository because its inputs contain real research and account values. It parses Markdown/frontmatter, assigns deterministic UUIDs, preserves source path and commit, records a SHA-256 payload hash, and uses the migration registry to make reruns safe.

Migration order is account policy, catalysts, ideas, candidates, annotations, trades, and journal records. `TBD`, watchlist/deferred state, and `user_confirmed_fill: false` are preserved literally. The importer never converts a planned idea into a position.

The production owner migration is complete and reconciled. The expected policy, two planned/deferred ideas, five candidates, eight catalysts, and five mappings are present with provenance and without any trade, entry, request, or confirmed fill. The private report lives at `OJ-Journal/artifacts/migration/phase-4-5-owner-cutover.md`; no real source payload or owner UUID is copied into this public repository.

Future migrations still require an existing approved owner ID. Never invent an auth identity, re-import duplicate records, or use the public repository as a staging area for private payloads.
