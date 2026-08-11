# Workspace RLS

All Phase 5–8 tables enable Row Level Security and use explicit grants.

- `private.is_workspace_member` and `private.is_workspace_owner` are security-definer helpers with an empty search path. They require a non-null authenticated identity and an active membership in an unarchived workspace.
- Workspace and member tables are selectable only by active, approved members. The member directory RPC returns display names and initials, not email addresses.
- Workspace invitations are forced-RLS, have no browser policy, and have no browser table grants.
- Shared research and mission inserts require an approved member and current-user authorship. Updates remain author/participant constrained where applicable.
- Private owner tables retain their original owner RLS. Workspace policies do not reference or broaden trades, account policies, private Ideas, Journal records, drafts, or offline caches.
- Forecast selection allows the owner or an active workspace member only when visibility is Shared. Revision visibility is captured at snapshot time.
- Shared activity can be inserted only by private triggers/RPCs and uses a constrained event-type list.

Portable structural and synthetic two-user tests live in `supabase/tests/phases-5-8-structure.sql` and `supabase/tests/phases-5-8-two-user-privacy.sql`.
