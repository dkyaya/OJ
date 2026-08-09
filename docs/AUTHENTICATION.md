# Authentication

Supabase Auth owns OJ credentials. The application never stores passwords, password hashes, reset secrets, access tokens, or refresh tokens in OJ tables.

The dedicated sign-in screen uses email and password with password-manager-compatible autocomplete fields. There is no public signup action. Forgotten passwords use Supabase reset email and return to `/OJ/?auth=reset`; invitation links return to `/OJ/?auth=activate`. Production and local callback roots are listed in `supabase/config.toml`.

OJ requires at least 12 characters in its password forms and does not impose arbitrary composition rules or prevent paste. Activation additionally requires a Supabase user with a confirmed email, a password identity, an invited profile, and a matching unexpired server-issued invitation.

Supabase restores the browser session before OJ renders private pages. Signed-out, unapproved, invited, pending, and disabled identities cannot load canonical records. Raw Supabase errors are mapped to short product-safe messages, and callback tokens are never logged.

The production Auth advisor currently reports leaked-password protection as disabled. Enable it in Supabase Auth when the project plan supports that feature; the application does not weaken server rate limits or build a custom lockout system.
