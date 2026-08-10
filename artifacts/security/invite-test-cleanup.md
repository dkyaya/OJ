# Invite test cleanup

Date: 2026-08-09

Status: procedure verified by schema review; production execution awaits the real temporary invite test.

## Safe order

1. Identify the temporary user by the exact test identity selected for the lifecycle. Never select by broad pattern.
2. Confirm that identity is not the owner and its profile role is `member`.
3. Delete or archive the member-owned synthetic `TEST` draft and confirm no owner row is selected.
4. Inspect member-owned dependent rows, accepted invitation reference, revision/audit rows, and foreign-key behavior.
5. Delete the exact temporary Auth user through a trusted admin surface.
6. Remove the exact invitation row if it is not cleared by the tested cleanup operation.
7. Confirm no orphan profile, invite, draft, revision, or member-owned row remains.
8. Recount Auth users, profiles, owners, invitations, canonical research, policies, trades, entries, and exits.

## Required final state

- 1 Auth user
- 1 profile
- 1 active approved owner
- 0 temporary invitations
- Owner canonical counts unchanged from the protected pre-test snapshot
- 0 confirmed trades, entries, and exits unless the owner independently records a real fill

The real execution report must record aggregate counts only and must not include credentials, invite codes, tokens, or private journal content.
