# Formalization pipeline

1. User explicitly submits a synced revision.
2. `submit-formalization` authenticates and allowlist-checks the owner, validates ownership/revision, creates one idempotent job and immutable payload, then dispatches `formalize-oj-record.yml`.
3. GitHub fetches the snapshot with its backend secret, verifies a safe deterministic note path, generates Obsidian Markdown with payload hash and audit fields, validates/builds, pushes a deterministic `formalize/...` branch, and opens/reuses a PR.
4. Codex reviews and corrects the same PR branch. The user manually merges.
5. `reconcile-oj-publication.yml` calls the authenticated reconciliation function, which records the commit, note path, PR, merge time, and published state.

No submitted record is committed directly to `main`; auto-merge is intentionally absent.

The Edge Function uses a revision-derived idempotency key. Repeating the same submission returns the existing job. The workflow reuses an existing deterministic branch/PR and the Markdown generator is idempotent for the same job.

The trusted backend and generator support trade ideas/updates, entries, check-ins, exits, journal reviews, catalysts/updates, research annotations, thesis-invalidating trade-idea revisions, and corrections as newer revisions. Related records append to their parent canonical note when one exists. Entry and exit sections state whether an actual fill was explicitly confirmed. The current frontend exposes trade-idea creation first; the other record forms can be added without changing the secure pipeline.

Stable required checks are `OJ Validate`, `OJ Test`, `OJ Build`, and `OJ Security`. Add those exact names to the main ruleset only after their first successful pull-request run.
