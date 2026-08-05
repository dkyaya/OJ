# Security review

## Confirmed and corrected

- Canonical Markdown and exact account fixtures were removed from the public tree and build.
- Child-to-parent ownership is enforced by composite foreign keys and matching RLS checks.
- Browser roles cannot forge jobs, payloads, publication receipts, trusted events, approval state, PR metadata, or canonical commits.
- Owner identifiers cannot be inserted for another user or changed after insert.
- Logout and account-change paths clear IndexedDB drafts and browser caches.
- The service worker does not cache Supabase Auth, REST, or Edge Function traffic.
- Machine reconciliation is POST-only, HMAC signed, timestamp bounded, nonce protected, constant-time compared, and reduced to one atomic RPC.
- Trusted functions have explicit safe search paths and minimal execute grants.
- GitHub App inputs, branch names, note paths, and shell arguments are constrained and sanitized.
- The private workflow rechecks approval, source ownership, revision, state, and immutable-payload correspondence before writing Markdown.
- A current React Router advisory was eliminated by removing the unneeded dependency and using local hash navigation; `npm audit` now reports zero vulnerabilities.

## Reviewed and not exploitable in the current design

- Markdown XSS: the public app renders normalized fields as React text and does not inject canonical Markdown as HTML.
- Public attachment guessing: Supabase Storage is unused and no buckets are required.
- Realtime cross-owner leakage: journal tables are not in the Realtime publication.
- Frontend secret exposure: only the public Supabase URL/key may be supplied to Vite; backend/App/HMAC secrets are absent from source and build artifacts.
- Brokerage execution: there is no brokerage client, token, order route, or credential store.

## Gates still requiring owner setup

- GitHub App installation-token minting and automatic private PR CI.
- A harmless approved `TEST` owner lifecycle across two browser sessions, including conflict, submit, manual merge, and published hydration.
- Production Auth redirect-URL confirmation in the Supabase dashboard.
- Destructive public-history rewrite decision for the already-published thesis/account context.

The Supabase security advisor reports zero findings. Performance advice is limited to unused-index informational notices expected on the empty/new schema; see the [Supabase database linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
