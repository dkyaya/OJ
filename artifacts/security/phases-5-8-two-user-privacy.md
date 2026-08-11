# Phases 5–8 Synthetic Two-User Privacy Test

Date: 2026-08-10

The test created synthetic owner, member, and outsider identities in a transaction that ended in `ROLLBACK`.

Verified:

- Owner and member could read the shared workspace catalyst, thesis, evidence, mission, and explicitly shared viewpoint.
- Neither collaborator could read the other's private Idea.
- The member could not read the owner's private catalyst or private forecast.
- Forking a shared thesis created an independent member-owned private Idea with provenance and no financial fields.
- The mission refused completion without evidence.
- After evidence and Event Verified, the member completed it as No Trade; no position or trade record was created.
- A future forecast produced draft and locked immutable snapshots.
- A forecast for a past event was rejected by the server cutoff.
- The owner could see their own private forecast plus the member's shared viewpoint.
- Removing the member immediately removed workspace, evidence, and other-member forecast access while preserving the removed user's own forecast as their private record.
- The outsider could see no workspace, evidence, thesis, mission, or forecast rows and could not enumerate invitations.
- Activity contained only allowlisted collaboration event types and no account, trade, Idea, or journal object types.

Result: `phases_5_8_two_user_privacy_and_workflows = passed`.
