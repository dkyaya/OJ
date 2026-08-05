# Recovery

- Offline/cloud failure: keep the IndexedDB draft and retry after reconnecting; resolve conflicts explicitly.
- App dispatch failure: keep the immutable payload/job, repair App configuration, and resubmit the same revision. Idempotency reuses it.
- Private PR failure: correct the existing deterministic private branch and rerun checks. Never bypass manual merge.
- Reconciliation failure: private merged Markdown remains canonical. Retry the signed callback with a fresh timestamp/nonce after correcting the fault.
- Public deployment failure: journal publication is unaffected because ordinary records never rebuild Pages.
- Device/account change: logout clears owner-scoped IndexedDB and browser caches; sign in again to hydrate.
- Credential incident: rotate the affected credential, audit logs/history, and rewrite Git history only with explicit owner approval.
