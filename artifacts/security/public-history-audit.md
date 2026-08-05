# Public repository history audit

Audited all local public branches and remote-tracking refs on 2026-08-05.

## Credential result

No committed value matching a GitHub PAT, Supabase backend secret, PEM private key, webhook-secret assignment, installation token, or user JWT was found. Source and workflow files contain credential **names** and placeholders, which are expected; no value requiring rotation was identified.

No dedicated secret scanner was installed in the environment, so the review used Git object history searches with value-shaped credential patterns plus manual patch inspection of every candidate file.

## Private-data result

Public history does contain earlier commits with:

- the conceptual August 2026 SPY thesis; and
- prior exact account-allocation values embedded in the frontend.

Both are removed from the current public branch and absent from the production build. The canonical SPY record now lives only in the private `dkyaya/OJ-Journal` repository.

Rewriting already-published Git history would be destructive and requires explicit owner approval. Until that decision is made, the old commits remain retrievable even though the current tree and Pages artifact are clean. No force push was performed in this run.
