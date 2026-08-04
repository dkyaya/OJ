# Recovery

- Offline/Supabase paused: continue locally, then retry cloud sync; export the packet if needed.
- Revision conflict: preserve both versions, choose local/cloud, duplicate, or manually merge before resubmitting.
- Dispatch/PR failure: job remains failed with an audit record; correct the cause and resubmit the same immutable revision to reuse its idempotency key.
- Validation failure: Codex fixes the existing formalization branch/PR.
- Pages failure: canonical Markdown remains safe after merge; rerun deployment after repair.
- Lost device: authenticated cloud drafts can hydrate another device; unsynced IndexedDB-only edits cannot.
