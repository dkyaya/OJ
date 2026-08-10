# Session Security

Supabase persists and refreshes sessions independently on each device. An iPhone and Mac session may coexist.

- Sign Out This Device uses local sign-out, clears private in-memory state, removes that user's browser cache and retry queue, and returns to Sign In.
- Sign Out Everywhere invalidates refresh sessions globally. Already-issued access tokens may remain valid until their short expiry, which is standard Supabase session behavior.
- Session restoration runs before the app shell, preventing private-page flash on signed-out or inactive accounts.
- Invite activation inspects the current session, clears that account's IndexedDB partition and in-memory workspace, removes the local cache owner marker, and uses `signOut({ scope: 'local' })` before OTP verification. It never uses global sign-out.
- The signed-out event cannot redirect an in-progress activation back to Sign In. After OTP verification, OJ requires the current Supabase user ID and normalized email to match the verified invite session before setting a password or calling the activation RPC.

IndexedDB uses owner-qualified record and operation keys. Legacy shared-cache rows migrate only when the prior cached owner matches the authenticated user; otherwise the legacy database is discarded. A later user in the same browser cannot query another owner's local records.

The service worker handles same-origin document navigation only. It does not cache Supabase Auth, REST, Functions, account, or journal responses. Theme remains global because it contains no private data.
