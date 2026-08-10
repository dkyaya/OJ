# Idea archive and restore

OJ archives research; it does not delete it. An eligible idea moves from active Ideas to the explicit Archived filter when `trade_ideas.deleted_at` is set. Restore clears that timestamp. Both operations increment the canonical revision exactly once and create the usual `record_revisions` snapshot. The underlying research status, thesis, candidates, catalyst links, source metadata, and entry state are not rewritten.

Only an authenticated, approved owner may call the caller-context `set_trade_idea_archived` operation, and the caller must provide the exact revision currently shown in OJ. Its update remains subject to the ordinary owner/approval RLS policy; a transaction-local marker allows only this operation through the direct browser archive-state guard. A stale device receives a conflict and cannot overwrite the newer row. Anonymous and cross-owner calls fail. Browser roles retain no `DELETE` grant or delete policy.

## Eligibility boundary

An idea may be archived only while it is research-only. A database trigger refuses archive when any canonical confirmed trade or confirmed entry exists for that idea, including closed trade history. The interface explains this restriction and disables the action when a loaded active or closed position is present; the database remains authoritative if the browser is stale.

Archived ideas cannot become positions. The entry-command RLS policy, public entry operation, and private entry processor all reject an archived parent. OJ never accesses brokerage credentials or places an order.

## Active views and retained records

Active overview counts, draft lists, trade-entry selectors, catalyst-linked ticker counts, and opportunity mappings use only non-archived ideas. The Archived filter shows the archive date and retains research details, candidate structures, revision metadata, Restore, and Markdown Export. The full journal export writes these records under `Archived Ideas/`.

Catalyst and security-mapping rows are preserved in Supabase. A mapping attached to an archived idea is suppressed only from active application views, so restoring the idea makes the original relationship visible again without reconstruction.

## Connectivity

Archive and restore deliberately fail closed while offline. OJ does not queue these lifecycle commands in IndexedDB because a later replay could bypass the user's current revision or newly created trade history. Reconnect, refresh the canonical row, and then confirm the action. Ordinary draft editing retains its existing offline cache and retry behavior.

## Verification

`supabase/tests/idea-archive-lifecycle.sql` exercises owner archive, restore, repeat archive, revision snapshots, stale-write rejection, cross-owner denial, candidate retention, active/closed trade restrictions, archived-entry denial, and hard-delete denial in a rolled-back transaction. `supabase/tests/rls.sql` verifies the trigger, RPC grants, empty search path, entry policy, and absent delete privilege.
