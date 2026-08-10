# Invite test cleanup

Date: 2026-08-10

Status: executed and verified in production.

## Pre-delete checks

- Selected the temporary identity by one exact address supplied for this lifecycle; no broad match was used.
- Confirmed its profile was `member`, not `owner`.
- Confirmed the invitation was accepted and linked to that member.
- Inspected every public foreign key referencing `auth.users` or `public.profiles`.
- Confirmed the temporary member owned no policy, research, journal, revision, synchronization, trade, entry, exit, request, candidate, catalyst, or formalization row.

## Executed safe order

1. Removed the exact temporary Auth sessions.
2. Removed the exact accepted invitation before profile deletion so the accepted-invitation consistency constraint could not be violated by `accepted_user_id on delete set null`.
3. Deleted the exact temporary Auth user only after a `member` role guard passed.
4. Allowed the existing `profiles.id → auth.users.id on delete cascade` relationship to remove the temporary profile.
5. Recounted the test identity, owner account, invitations, and canonical records.

## Verified final state

- Remaining temporary invitations: 0
- Remaining temporary Auth users: 0
- Remaining temporary profiles: 0
- Auth users: 1
- Profiles: 1
- Active approved owners: 1
- Account invitations: 0
- Owner canonical counts unchanged: 3 ideas, 5 candidates, 8 catalysts, 1 policy
- Confirmed trades, entries, and exits: 0

Supabase documents that a deleted Auth user's existing JWT can remain cryptographically valid until expiry. OJ's approved-profile RLS gate fails immediately after the profile is removed, and the temporary sessions were deleted first. The now-stale browser correctly received `User from sub claim in JWT does not exist` after cleanup.

This report contains no email address, UUID, password, invite code, access token, refresh token, JWT, or private record content.
