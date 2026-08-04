# Cloud synchronization

IndexedDB is the immediate autosave, offline cache, retry queue, and recovery layer. Editing schedules a local save after 150 ms and a cloud save after 1.2 seconds. Sign-in and manual refresh hydrate cloud drafts; the browser also retries when connectivity returns. Realtime is deliberately not required for this single-owner version: revision-safe hydration and reconnect retry are easier to audit and avoid a permanent subscription.

Cloud updates use compare-and-swap on the previous revision. If another device increments first, the second update cannot overwrite it. OJ preserves both versions, marks the record conflicted, and offers:

- keep local;
- keep cloud;
- duplicate local;
- compare every field and manually merge.

Visible states include saved locally, syncing, synced, offline, retry needed, outdated, conflict, submitted, PR open, and published. A paused or unreachable project leaves the local copy and emergency packet intact.

Submitted snapshots are immutable. Later editing creates a newer cloud revision without replacing the payload attached to an existing pull request.
