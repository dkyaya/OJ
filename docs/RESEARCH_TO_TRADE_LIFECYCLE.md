# Research-to-Trade lifecycle

OJ carries a decision through `Catalyst → Idea → Candidate → Trade → Check-In → Exit → Debrief`. It is a private research and journal system, not a brokerage. Every entry and exit is recorded manually after execution occurs elsewhere; OJ never routes, imports, recommends, resizes, or cancels an order.

## Idea, Candidate, and Trade

- An **Idea** is the current, editable research record: thesis, evidence, conditions, invalidation, event plan, and Catalyst links.
- A **Candidate** is a planned defined-risk structure. It keeps the contemplated expiration, strikes, debit, contracts, and derived economics.
- A **Trade** is a confirmed actual fill. It keeps actual execution separately from the Candidate and links back to both records.

`Record Trade` is available for Watchlist and Ready Ideas that are not already Trade-backed. Selecting an Idea and Candidate prepopulates all known values. The user enters or confirms only actual execution details. Actual debit, strikes, expiration, contracts, timestamp, and fees may differ from the Candidate; recording a Trade never edits the Candidate.

For debit verticals, OJ validates strike orientation and requires `0 < debit < spread width`. It derives width, maximum loss, maximum profit, break-even, and reward/risk from the actual fill.

## Immutable entry context

The confirmed entry creates a compact `entry_context` version 1 snapshot. It contains the Idea revision, entry thesis and plan, Candidate revision and values, actual execution, linked Catalyst relationships, limited pre-entry Research Snapshot and locked Forecast IDs, exposure tags, and the policy context at entry. It references research records instead of copying option chains or entire ledgers.

Entry structure and provenance are immutable. Later Idea edits remain visible as the current linked Idea but cannot rewrite what was believed at entry. Trades, entry rows, Check-Ins, and Exits are browser-readable but written only through validated lifecycle functions. Historical Check-Ins are append-only.

Catalysts follow the workspace rule **Shared facts, separate conclusions**. A private Idea or Trade may cite either a private Catalyst owned by that user or a workspace-visible Catalyst available through active membership, even when another member created the Catalyst. OJ validates that access when the Catalyst is assigned and again when a Trade is recorded. The Trade remains privately owned. Its direct Catalyst reference and captured entry context remain historical provenance if the member later leaves or is removed; removal blocks future workspace access without rewriting prior private Trade history.

## Trade classes and monitoring

The user explicitly selects one class:

- `pre_catalyst_anticipation`: entered before the Catalyst with an intended pre-event exit unless reassessed.
- `catalyst_hold`: entered before and deliberately held through the event.
- `post_catalyst_confirmation`: entered after a reaction or confirmation.

OJ does not infer intent from timestamps. Trade detail keeps the original thesis, invalidation, planned exit, hold/avoid events, actual structure, relevant upcoming Catalysts, and pre-entry research references together.

A Check-In records user-authored Thesis Health—Stronger, Intact, Weaker, or Invalidated—plus a concise change summary, structured price/Catalyst/volatility/macro flags, invalidation state, and an optional current management view. A Check-In never mutates the original plan or automatically closes a Trade.

Check-Ins are monitoring history, not Journal entries. They remain visible in Trade detail, inform the linked Debrief context, and stay in Trade Markdown exports and future lifecycle analytics. The Journal feed and Journal count are built only from completed Trade Debriefs. This is a presentation/query boundary; Phase 9 does not delete, rewrite, or migrate historical Check-In rows.

## Risk policy

The current deliberate production policy is an **$800 simultaneous open-options maximum-loss ceiling**. It is a ceiling, not a target, and is loaded from `account_policies`; UI components do not hard-code it.

For an open debit vertical:

`maximum loss = actual debit × 100 × open contracts`

Closed Trades do not contribute. Shared exposure tags show informational concentration without double-counting risk or claiming measured correlation. Remaining capacity means the ceiling minus open defined-risk maximum loss. It is not brokerage buying power, cash, margin, or an execution constraint.

Historical fills above the current policy can still be recorded with an explicit acknowledgement and explanation. OJ does not resize or reject them.

Policy changes are deliberate Settings saves and do not derive automatically from account capital or brokerage balances.

## Exit and Debrief

Phase 8.6 records one full closing transaction: time, closing debit or credit, fees, reason, Thesis Health at exit, Catalyst relationship, and notes. The app derives realized P/L, atomically adds immutable Exit history, closes the Trade, and removes its maximum loss from open risk. Partial-lot accounting is intentionally out of scope.

The Journal’s linked Trade Debrief assembles facts, the original plan, Check-In evolution, Catalyst outcome, and entry research references. Reflection—what was right, wrong, worth repeating, and worth avoiding—remains user-authored.

Markdown export includes planned and actual structures, original entry context, Check-Ins, Exit, linked Debrief fields, and relevant Catalyst/research identifiers. Supabase remains canonical; Obsidian is an optional portable mirror.
