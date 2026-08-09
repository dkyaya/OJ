# Optional Private Mirror Pipeline

An explicit mirror request accepts only an authenticated, approved owner’s exact canonical revision. It stores an immutable payload and idempotent job, then Octokit authenticates as the selected-repository GitHub App installation and dispatches `formalize-oj-record.yml` in private `dkyaya/OJ-Journal`.

This legacy secure workflow is retained only when the owner explicitly requests a private Markdown mirror. It validates and sanitizes the payload, derives a deterministic branch/path, preserves Markdown history, runs private checks, and opens or reuses a private PR using an App token. It is not called by ordinary OJ saves.

The private merge workflow may sign a mirror receipt with timestamp/nonce HMAC. `reconcile-publication` validates the callback and updates mirror metadata. Supabase is already canonical; the public repository and Pages deployment remain untouched.

Public required checks: `OJ Public Validate`, `OJ Public Test`, `OJ Public Build`, `OJ Public Security`.
