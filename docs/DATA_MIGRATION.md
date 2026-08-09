# Private Journal Migration

The one-time importer lives in the private `OJ-Journal` repository because its inputs contain real research and account values. It parses Markdown/frontmatter, assigns deterministic UUIDs, preserves source path and commit, records a SHA-256 payload hash, and uses the migration registry to make reruns safe.

Migration order is account policy, catalysts, ideas, candidates, annotations, trades, and journal records. `TBD`, watchlist/deferred state, and `user_confirmed_fill: false` are preserved literally. The importer never converts a planned idea into a position.

An approved Supabase owner ID is mandatory. If no owner exists, run only the dry report and stop. Never invent an auth identity or use the public repository as a staging area for private payloads.
