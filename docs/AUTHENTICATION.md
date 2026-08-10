# Authentication

Supabase Auth owns OJ credentials. The application never stores passwords, password hashes, reset secrets, access tokens, or refresh tokens in OJ tables.

The dedicated sign-in screen uses email and password with password-manager-compatible autocomplete fields. There is no public signup action. Forgotten passwords use Supabase reset email and return to `/OJ/?auth=reset`. Invitation emails link to the inert `/OJ/?auth=activate` page and contain a separate six-digit `{{ .Token }}` code. The activation URL contains no one-time credential and may be opened repeatedly without verification or database mutation. Production and local callback roots are listed in `supabase/config.toml`.

OJ requires at least 12 characters in its password forms and does not impose arbitrary composition rules or prevent paste. Activation first verifies the invite OTP with Supabase Auth, confirms the established session identity and normalized email, sets the password, and only then calls the activation RPC. The RPC additionally requires a confirmed email, password identity, invited member profile, and matching pending unexpired server-issued invitation.

Supabase restores the browser session before OJ renders private pages. Signed-out, unapproved, invited, pending, and disabled identities cannot load canonical records. Entering activation mode hides the authenticated application shell. Submitting the activation form clears only the current browser's conflicting session and private cache before OTP verification; sessions on other devices remain active. Raw Supabase errors are mapped to short product-safe messages, and codes, callback tokens, and credentials are never logged.

The production Auth advisor currently reports leaked-password protection as disabled. Enable it in Supabase Auth when the project plan supports that feature; the application does not weaken server rate limits or build a custom lockout system.
