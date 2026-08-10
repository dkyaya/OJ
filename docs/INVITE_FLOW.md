# Invite Flow

OJ is invite-only. Settings → Access is shown only to the active app owner and calls the JWT-protected `invite-account` Edge Function.

The function validates the caller, owner role, origin, payload size, email shape, and an hourly invitation limit. It writes a private pending invitation with a one-hour application expiry, then asks Supabase Auth to send the configured invite-code email. If email delivery fails, the function revokes the application invitation instead of leaving a usable-looking pending row. The server secret never reaches the browser. `account_invites` has RLS enabled, no browser policy, and no `authenticated` table grant, so users cannot enumerate invited emails.

The email renders the six-digit Supabase `{{ .Token }}` and links only to `https://dkyaya.github.io/OJ/?auth=activate`. It never renders `{{ .ConfirmationURL }}` or `{{ .TokenHash }}`. Link scanners, previews, and repeated GET requests can open that static application route without consuming the code, creating a session, or accepting the invitation.

The recipient enters the invited email, code, new password, and password confirmation. OJ validates all fields, clears conflicting local session/cache state, verifies the OTP with `type: 'invite'`, verifies the returned session and confirmed email, sets the password, and invokes the narrowly scoped activation operation. Activation checks the confirmed Auth email, password identity, profile state, exact normalized email, pending status, and expiry before marking both profile and invitation active/accepted in one transaction.

Uninvited, expired, revoked, wrong-email, wrong-code, and already-used code attempts cannot activate. Members cannot invite users, approve themselves, or change roles. Sending a real invitation remains an explicit owner action; migrations and automated tests send none. See `INVITE_OTP_ACTIVATION.md` for the hosted template and cutover sequence.
