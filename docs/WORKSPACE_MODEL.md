# Workspace Model

OJ creates one solo-first research workspace for an existing active owner. A workspace can remain a one-person desk indefinitely; no screen waits for a collaborator.

Workspace roles are `owner` and `member`. They are separate from the protected app account role. A workspace owner can rename the desk, invite members, and remove members. A member can contribute shared research and leave. The sole owner cannot remove themselves or leave without a future ownership-transfer flow.

Invitations are server-managed. The invite Edge Function validates the authenticated app owner and workspace ownership, normalizes the email, applies rate limits, and sends a scanner-safe Auth invitation where account activation is needed. Existing active accounts accept the pending workspace invitation in Settings. Browser code cannot enumerate invitations or member emails.

Leaving or removal ends shared access without deleting the person's private OJ records. Existing shared artifacts retain factual authorship through the stable profile ID.
