# Invite Flow

OJ is invite-only. Settings → Access is shown only to the active app owner and calls the JWT-protected `invite-account` Edge Function.

The function validates the caller, owner role, origin, payload size, email shape, and an hourly invitation limit. It writes a private pending invitation with a 24-hour application expiry, then asks Supabase Auth to send its standard invitation email. The server secret never reaches the browser. `account_invites` has RLS enabled, no browser policy, and no `authenticated` table grant, so users cannot enumerate invited emails.

An invited person opens the email, receives a verified Supabase session, creates a password, and invokes the narrowly scoped activation operation. Activation checks the confirmed Auth email, password identity, profile state, exact normalized email, pending status, and expiry before marking both profile and invitation active/accepted in one transaction.

Uninvited, expired, and revoked identities remain pending or invited-but-inactive and see only “Invite Required.” Members cannot invite users, approve themselves, or change roles. Sending a real invitation remains an explicit owner action; migrations and tests send none.
