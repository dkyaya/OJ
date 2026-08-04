# Secret manifest

No secret values belong in this file.

| Name | Location | Purpose | Current evidence / remaining action |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | GitHub repository variable | Browser API endpoint | Configured and intentionally browser-visible. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub repository variable | Browser Auth/RLS client | Configured and intentionally browser-visible. |
| `SUPABASE_URL` | GitHub Actions secret | Trusted REST/function endpoint | Secret name detected. |
| `SUPABASE_SECRET_KEY` | GitHub Actions secret and Supabase Edge Function secret | Trusted payload/reconciliation database access | GitHub name detected; confirm the Edge Function copy remains configured. |
| `GITHUB_OJ_TOKEN` | Supabase Edge Function secret | Dispatch the formalization workflow | User reported configured; confirm with the first signed-in submission. |
| `OJ_FORMALIZATION_WEBHOOK_SECRET` | Matching GitHub and Supabase secrets | Authenticate publication reconciliation | GitHub name detected; user reported matching Supabase value. |
| `SUPABASE_ACCESS_TOKEN` | Optional GitHub Actions secret | Future CLI-based backend deployment | Not detected; add only if using `deploy-supabase.yml`. |
| `SUPABASE_DB_PASSWORD` | Optional GitHub Actions secret | Future CLI migration push | Not detected; add only if using `deploy-supabase.yml`. |

The optional management credentials are unnecessary for the already-applied production migration/function versions, but are required if the repository deployment workflow becomes the future release path. Keep all backend values out of chat, source, logs, screenshots, static data, and relay packages.
