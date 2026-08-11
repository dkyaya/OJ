# Privacy model

GitHub Pages serves an empty shell. After sign-in, the browser uses a publishable key and an authenticated user session; RLS requires a non-null owner ID and server-controlled approval. IndexedDB is an offline cache and is cleared on logout or account change. The service worker never caches Supabase API traffic.

Browser-writable draft tables allow owner select/insert/update only. Browser deletes and ownership changes are disabled. Formalization payloads, trusted sync events, workflow metadata mutation, approval state, and publication state remain server-only. Published normalized records are readable only by their approved owner.

React renders user text as escaped text; no raw Markdown HTML is inserted. PR links are accepted only under `https://github.com/dkyaya/OJ-Journal/pull/<number>`.

Workspace membership never widens owner-scoped RLS. Members may read shared catalysts, evidence, mission records, safe thesis summaries, explicitly shared forecast fields, and shared factual debriefs. They cannot read another member's account policy, balance, risk, fills, trades, private Ideas, private forecast or forecast snapshots, Journal, drafts, or personal debrief fields.

Invitation rows are not browser-readable. Member identity is exposed through a narrow directory RPC containing display name, initials, workspace role, status, and join time—not email. Shared activity is server-written from a fixed event-type allowlist and contains generic summaries rather than record payloads.
