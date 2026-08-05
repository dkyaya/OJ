# Secret and configuration manifest (names only)

| Name | Location | Purpose | State |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | Public repo variable | Browser API endpoint | Configured |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public repo variable | Browser-safe publishable key | Configured |
| `OJ_GITHUB_APP_ID` | Supabase Edge secret; private repo variable | App identity | Owner setup pending |
| `OJ_GITHUB_APP_INSTALLATION_ID` | Supabase Edge secret | Selected private-repo installation | Owner setup pending |
| `OJ_GITHUB_APP_PRIVATE_KEY` | Supabase Edge secret; private repo secret | Mint short-lived tokens | Owner setup pending |
| `OJ_PRIVATE_REPOSITORY` | Supabase Edge secret | Fixed private dispatch target | Owner setup pending/constant |
| `OJ_FORMALIZATION_WORKFLOW` | Supabase Edge secret | Fixed workflow name | Owner setup pending/constant |
| `OJ_FORMALIZATION_WEBHOOK_SECRET` | Supabase Edge secret; private repo secret | Signed merge callback | Existing Edge value; add to private repo |
| `SUPABASE_URL` | Private repo secret | Trusted API endpoint | Add to private repo |
| `SUPABASE_SECRET_KEY` | Private repo secret | Fetch/update trusted workflow records | Add to private repo |
| `GITHUB_OJ_TOKEN` | Supabase Edge secret | Deprecated PAT path | Retain until App dry run, then delete/revoke |

No values belong in Git, the bundle, workflow logs, artifacts, or chat.
