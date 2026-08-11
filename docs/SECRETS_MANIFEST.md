# Secret and configuration manifest (names only)

| Name | Location | Purpose | Requirement |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Public repo variable | Browser API endpoint | Required for CI and Pages builds |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public repo variable | Browser-safe publishable key | Required for CI and Pages builds |
| `SUPABASE_ACCESS_TOKEN` | Public repo secret | Authenticate the Supabase CLI management operations | Required for manual production deployment |
| `SUPABASE_DB_PASSWORD` | Public repo secret | Authenticate production Postgres migration checks and pushes | Required for manual production deployment |
| `OJ_GITHUB_APP_ID` | Supabase Edge secret; private repo variable | App identity | Required for the optional Markdown mirror |
| `OJ_GITHUB_APP_INSTALLATION_ID` | Supabase Edge secret | Selected private-repo installation | Required for the optional Markdown mirror |
| `OJ_GITHUB_APP_PRIVATE_KEY` | Supabase Edge secret; private repo secret | Mint short-lived tokens | Required for the optional Markdown mirror |
| `OJ_PRIVATE_REPOSITORY` | Supabase Edge secret | Fixed private dispatch target | Required for the optional Markdown mirror |
| `OJ_FORMALIZATION_WORKFLOW` | Supabase Edge secret | Fixed workflow name | Required for the optional Markdown mirror |
| `OJ_FORMALIZATION_WEBHOOK_SECRET` | Supabase Edge secret; private repo secret | Signed merge callback | Required for the optional Markdown mirror |
| `SUPABASE_URL` | Private repo secret | Trusted API endpoint | Required for private mirror Actions |
| `SUPABASE_SECRET_KEY` | Private repo secret | Fetch and update trusted workflow records | Required for private mirror Actions |
| `GITHUB_OJ_TOKEN` | Supabase Edge secret | Deprecated PAT path | Remove after GitHub App cutover verification |

Secret values never belong in Git, application bundles, workflow logs, artifacts, or chat. The database password is the raw project Postgres password, not an API key, connection string, or URL-encoded value.
