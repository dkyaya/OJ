# Collaboration Model

OJ separates shared facts from private conclusions.

Shared objects are workspace catalysts, safe security mappings, evidence, evidence responses, reviewed thesis summaries, mission coordination, open questions, liquidity observations, explicitly shared forecast fields, and factual debriefs.

Private objects are account values, risk policy, orders, fills, trades, private Ideas and candidates, private forecasts and revisions, Journal content, emotional notes, personal lessons, drafts, conflicts, and offline queues.

An activity event is created only by a server trigger or checked RPC. Its type must be in the schema allowlist, and its summary is intentionally generic. The activity feed is not a replica of the underlying record and cannot contain a financial payload.

Initials provide lightweight attribution. OJ does not add profile photos, presence pressure, chat, scoring, leaderboards, or required role coverage in Phases 5–8.

Shared collaboration records are network-only in these phases. They are not placed in the private IndexedDB draft/retry cache, so an offline shared write fails closed and is never replayed under a stale membership. The existing private cache remains partitioned by Supabase user ID and is cleared on account switch/sign-out. The existing 30-second refresh and focused-window refresh model is retained instead of adding a fragile Realtime dependency.
