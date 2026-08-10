# Invite OTP Activation

## Root cause

The original Supabase invitation template rendered `{{ .ConfirmationURL }}`. That URL contains a single-use verification credential. Google and other email-security systems fetched it before or alongside the user, consuming the credential. A later browser GET then produced “One-time token not found” or “Email link is invalid or has expired.”

The activation page could also open in a browser that already held the production owner's Supabase session. After invite verification and password update, session restoration could make the activation RPC run as the owner. The RPC correctly rejected that identity because the owner's email did not match the pending invitation.

## Scanner-safe email

The repository template is `supabase/templates/invite.html`. The hosted Supabase Invite User template must use the same content:

- Subject: `You're invited to OJ`
- Code variable: `{{ .Token }}`
- Action URL: `https://dkyaya.github.io/OJ/?auth=activate`
- Forbidden variables in the invite action: `{{ .ConfirmationURL }}` and `{{ .TokenHash }}`

`{{ .Token }}` is a six-digit Supabase OTP. The action URL is a static GitHub Pages route with no token query or fragment. Opening it performs no Auth verification and no application write.

For local Supabase, `supabase/config.toml` points `[auth.email.template.invite]` at the checked-in template. Hosted projects require copying the subject and HTML into Authentication → Emails → Templates → Invite user.

## Activation order

1. Normalize and validate email, six-digit code, password length, and confirmation.
2. Inspect the current Supabase session.
3. Clear that identity's IndexedDB partition, retry queue, in-memory workspace, and local cache marker.
4. Sign out with local scope only when a session exists.
5. Call `verifyOtp({ email, token, type: 'invite' })`.
6. Require an authenticated session, matching user ID, exact normalized email, and confirmed email.
7. Set the new password.
8. Call `activate_invited_account()` as the invited identity.
9. Clear activation URL state, refresh the workspace, and route to Overview.

Any identity mismatch triggers another local sign-out and stops before password or RPC operations. Errors are product-safe and never include the code or database exception.

## Lifetime

OJ application invitations expire one hour after issue. Supabase Email OTP Expiration must also be set to 3600 seconds. The application window is therefore never longer than the Auth code window. Codes remain single use because Supabase Auth consumes them only during explicit OTP verification; the application RPC separately requires a still-pending unexpired invitation.

## Production cutover

Use this order so the old frontend never receives code-only emails it cannot process:

1. Merge and deploy the repaired frontend.
2. Confirm `?auth=activate` renders Email, Invite Code, New Password, and Confirm Password.
3. Deploy the updated `invite-account` Edge Function.
4. Set Email OTP Expiration to 3600 seconds.
5. Replace the hosted Invite User template with the checked-in subject and HTML.
6. Run one real temporary invite lifecycle and full cleanup.
7. Review Auth/API/Function/Postgres logs and the Supabase Security Advisor.

Do not begin Phase 5+ until the real lifecycle, isolation, cross-session, and cleanup checks pass.
