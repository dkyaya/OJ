# Supabase Canonical Validation

Validated against project `ljpcgvqsrgpssqobeznp` on 2026-08-08.

- Applied canonical, lifecycle-lock, eligibility, and private-entry-processor migrations successfully.
- Confirmed RLS is enabled on every listed public application table.
- Security Advisor: zero findings.
- Performance Advisor: zero warnings and zero errors; informational unused-index notices are expected while the database is empty.
- Two-user rollback test: passed owner-only idea reads, owner-only preferences, cross-owner write denial, direct confirmed-position denial, draft-idea rejection, explicit confirmation enforcement, atomic entry creation, and cross-owner trade/RPC isolation.
- Post-test content remains empty: zero auth users, profiles, ideas, catalysts, and trades.

The historical import is not complete because an approved owner profile does not yet exist. The test users and rows were created only inside a transaction and rolled back.
