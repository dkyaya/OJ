# GitHub App automation

`OJ Formalization Bot` replaces the durable PAT. Supabase keeps the App ID, selected-repository installation ID, and private key, then uses Octokit to authenticate as the installation and dispatch the private workflow. Private Actions mints another short-lived token with the official `actions/create-github-app-token` action for branch and PR writes.

The App is installed only on `dkyaya/OJ-Journal` with Metadata read, Actions read/write, Contents read/write, and Pull requests read/write. Tokens are not stored and expire/revoke automatically. Because PR branches are pushed and PRs opened by the App token rather than the repository `GITHUB_TOKEN`, normal `pull_request` CI triggers automatically.

Keep `GITHUB_OJ_TOKEN` until one synthetic lifecycle succeeds; then delete the Edge secret and revoke the PAT at GitHub.
