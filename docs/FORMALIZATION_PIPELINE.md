# Private formalization pipeline

Submit accepts only an authenticated, approved owner’s exact cloud revision. It stores an immutable payload and idempotent job, then Octokit authenticates as the selected-repository GitHub App installation and dispatches `formalize-oj-record.yml` in private `dkyaya/OJ-Journal`.

The private workflow validates and sanitizes the payload, derives a deterministic branch/path, preserves Markdown history, runs private checks, and opens/reuses a private PR using an App token. The App-created workflow actions allow normal private PR CI to start automatically. Codex reviews the branch; the user manually merges.

The private merge workflow signs the canonical record with timestamp/nonce HMAC. `reconcile-publication` validates the callback and invokes one transactional RPC. Supabase updates the canonical owner representation, payload/job/source metadata, and sync event atomically. The public repository and Pages deployment are untouched.

Public required checks: `OJ Public Validate`, `OJ Public Test`, `OJ Public Build`, `OJ Public Security`.
