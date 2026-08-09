# Recovery

- Offline/cloud failure: keep the IndexedDB draft and retry after reconnecting; resolve conflicts explicitly.
- App dispatch failure: keep the immutable payload/job, repair App configuration, and resubmit the same revision. Idempotency reuses it.
- Save failure: preserve the IndexedDB operation, show Saved Offline or Retry Needed, and retry after connectivity returns.
- Conflict: keep both revisions and require an explicit device choice.
- Optional private mirror PR failure: correct the deterministic private branch and rerun checks. Never bypass manual merge.
- Mirror reconciliation failure: Supabase remains canonical. Retry the signed receipt only after correcting the fault.
- Public deployment failure: journal publication is unaffected because ordinary records never rebuild Pages.
- Device/account change: logout clears owner-scoped IndexedDB and browser caches; sign in again to hydrate.
- Credential incident: rotate the affected credential, audit logs/history, and rewrite Git history only with explicit owner approval.
