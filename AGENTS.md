# OJ Public Application Agent Guide

- Supabase is OJ's canonical application datastore. Signed-in, approved users save directly to owner-scoped rows; ordinary saves do not create commits, branches, pull requests, or Pages deployments.
- This public repository contains browser-safe application code, infrastructure, branding, documentation, and unmistakably empty or synthetic fixtures. Never add real account values, theses, journal records, emotional notes, attachments, credentials, or exported user data.
- `dkyaya/OJ-Journal` is an optional private Markdown mirror and export target. Preserve its history, but never make normal OJ use depend on it.
- Keep the primary navigation to exactly six sections: Overview, Catalysts, Ideas, Trades, Journal, and Insights. Settings is secondary.
- Use the progressive card hierarchy in `docs/CARD_HIERARCHY.md`; keep visible labels direct, short, and mobile-safe.
- Never access brokerage credentials, connect to Robinhood, place trades, invent fills, or mark a trade entered or closed without explicit user confirmation.
- If optional GitHub mirror automation is used, preserve its manual private-PR merge gate and never enable auto-merge.
- Every meaningful frontend change requires copy checks, lint, typecheck, tests, build, privacy scan, and desktop/mobile browser review with empty or synthetic data.
- Edge Functions must use owner/approval checks, origin-restricted CORS, input limits, redacted errors, and least-privilege secrets.
- Supabase Auth exclusively manages credentials. Never request, store, log, commit, or relay plaintext passwords, password hashes, reset tokens, refresh tokens, or service-role secrets.
- OJ is invite-only. Do not add public signup, browser-controlled approval, browser role escalation, or readable invitation policies. Owner invitations must pass through the authenticated owner-only Edge Function.
- Every private IndexedDB record, draft, conflict, and retry operation must be partitioned by the stable Supabase user ID. Sign-out must clear private in-memory state and the current user's cache without removing harmless global display preferences.
- Keep app-level `owner` / `member` roles separate from future workspace roles. Do not begin workspace, collaboration, mission, or forecast phases without a later explicit task.
