# Cloud synchronization

IndexedDB is the immediate autosave, offline cache, retry queue, and recovery layer. Editing schedules a local save after 150 ms and a cloud save after 1.2 seconds. Sign-in and manual refresh hydrate cloud drafts; the browser also retries when connectivity returns. Realtime is deliberately not required for this single-owner version: revision-safe hydration and reconnect retry are easier to audit and avoid a permanent subscription.

Cloud updates use compare-and-swap on the previous revision. If another device increments first, the second update cannot overwrite it. OJ preserves both versions, marks the record conflicted, and offers:

- keep local;
- keep cloud;
- duplicate local;
- compare every field and manually merge.

Visible states are Local Draft, Saving, Saved to OJ, Saved Offline, Retry Needed, and Conflict. A paused or unreachable project leaves the local copy and emergency packet intact.

Supabase rows use monotonic revisions, and `record_revisions` preserves snapshots. Logout or account change clears the owner-scoped IndexedDB cache before another account can hydrate. Optional Markdown mirroring is separate from normal saves.

Archive and restore are intentionally excluded from offline retry. These lifecycle commands require a live owner session, the latest canonical revision, and a fresh server check that no confirmed trade history exists. If offline, OJ changes nothing and asks the owner to reconnect and retry.
