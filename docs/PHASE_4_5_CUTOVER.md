# Phase 4.5 Cutover

Phase 4.5 establishes the production account boundary and confirms the earlier canonical-data cutover.

Completed architecture:

- Supabase email/password sign-in, password reset, manual invite-code activation, session restoration, and current/global sign-out.
- One active production owner bootstrapped from the earliest existing approved profile, without a hard-coded frontend identity.
- Owner-only Edge Function invitations and a private invitation table.
- Editable display name and initials with server-managed role, status, approval, and email.
- User-partitioned IndexedDB drafts and retry operations with sign-out cleanup.
- Auth-gated rendering, safe callback routes, and no service-worker caching of private backend responses.
- Reconciled canonical owner data with no duplicate import, positions, entries, requests, or confirmed fills.
- Transactional two-user RLS/lifecycle and invitation activation/gating tests, rolled back after completion.

Phase 4.5.1 replaces direct one-time invitation URLs with a manual invite OTP. The scanner-safe template and the one-hour invitation window must be switched in production only after the repaired frontend is merged and GitHub Pages deploys it. The owner remains final merge authority.

Phase 5–8 work is not included. Stable Auth user → profile identity is ready for a later workspace membership model.
