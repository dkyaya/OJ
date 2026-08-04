# OJ interaction workflow

OJ writes locally first, then synchronizes approved owner drafts to Supabase. Submit freezes an immutable revision and opens an automated PR. Codex reviews/corrects the PR; the user manually merges; canonical Markdown and Pages publication follow. Local drafts may be local, synced, submitted, outdated, conflicting, failed, or published. The packet remains a manual fallback.
