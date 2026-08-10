# Idea archive, restore, and permanent delete

Archive and delete are different lifecycle actions in OJ. Archive is reversible: an eligible idea moves from active Ideas to the explicit Archived filter when `trade_ideas.deleted_at` is set, and Restore clears that timestamp. Both operations increment the canonical revision exactly once and create the usual `record_revisions` snapshot. The underlying research status, thesis, candidates, catalyst links, source metadata, and entry state are not rewritten.

Only an authenticated, approved owner may call the caller-context `set_trade_idea_archived` operation, and the caller must provide the exact revision currently shown in OJ. Its update remains subject to the ordinary owner/approval RLS policy; a transaction-local marker allows only this operation through the direct browser archive-state guard. A stale device receives a conflict and cannot overwrite the newer row. Anonymous and cross-owner calls fail. Browser roles retain no `DELETE` grant or delete policy.

## Eligibility boundary

An idea may be archived only while it is research-only. A database trigger refuses archive when any canonical confirmed trade or confirmed entry exists for that idea, including closed trade history. The interface explains this restriction and disables the action when a loaded active or closed position is present; the database remains authoritative if the browser is stale.

Archived ideas cannot become positions. The entry-command RLS policy, public entry operation, and private entry processor all reject an archived parent. OJ never accesses brokerage credentials or places an order.

## Active views and retained records

Active overview counts, draft lists, trade-entry selectors, catalyst-linked ticker counts, and opportunity mappings use only non-archived ideas. The Archived filter shows the archive date and retains research details, candidate structures, revision metadata, Restore, and Markdown Export. The full journal export writes these records under `Archived Ideas/`.

Catalyst and security-mapping rows are preserved in Supabase. A mapping attached to an archived idea is suppressed only from active application views, so restoring the idea makes the original relationship visible again without reconstruction.

## Permanent deletion

Delete is available only inside an archived idea's expanded details. It is not a synonym for archive and does not appear on active idea cards. The owner must type the exact, case-sensitive phrase `DELETE TICKER`; OJ sends the idea ID, current revision, and phrase through the narrowly granted `delete_trade_idea` command. Direct browser table deletion remains unavailable.

The private processor owner-locks the row, verifies the exact revision and confirmation, and requires the idea to still be archived and research-only. Any trade, entry, check-in, exit, entry request, or journal review blocks deletion. A successful deletion removes the idea, candidates, research annotations, idea-specific catalyst mappings, revision snapshots, and optional Supabase formalization/mirror metadata. Calendar catalysts are preserved and detached because a scheduled event may be shared by other research.

OJ stores one content-free tombstone containing only the deleted idea UUID, owner UUID, and deletion time. A database trigger uses it to prevent an offline or stale device from recreating the same canonical record. No thesis, ticker, candidates, or journal text is kept in the tombstone, and browser roles cannot read or mutate it.

Deletion cannot recall files already downloaded or copied outside Supabase. Obsidian exports, private `OJ-Journal` files, backups, and other external copies must be removed separately if the owner wants them gone.

## Connectivity

Archive, restore, and delete deliberately fail closed while offline. OJ does not queue these lifecycle commands in IndexedDB because a later replay could bypass the user's current revision or newly created trade history. Reconnect, refresh the canonical row, and then confirm the action. After deletion, OJ clears the matching local draft and queued operation on that device; the server tombstone rejects stale-device recreation. Ordinary draft editing retains its existing offline cache and retry behavior.

## Verification

`supabase/tests/idea-archive-lifecycle.sql` exercises owner archive, restore, repeat archive, revision snapshots, stale-write rejection, cross-owner denial, candidate retention, active/closed trade restrictions, archived-entry denial, direct-delete denial, exact-confirmation deletion, child cleanup, catalyst preservation, and stale-device recreation denial in a rolled-back transaction. `supabase/tests/rls.sql` verifies the triggers, RPC grants, empty search paths, command-table isolation, tombstone isolation, entry policy, and absent table-delete privilege.
