# Account Model

`auth.users.id` is the stable identity. `public.profiles.id` references it one-to-one and stores only application metadata: display name, initials, display email, approval state, app role, status, and timestamps.

App roles are deliberately minimal:

- `owner`: the first approved production profile and the only role allowed to invoke account invitations.
- `member`: the default for a future invited account.

Statuses are `pending`, `invited`, `active`, and `disabled`. Approval plus `active` status is required for private OJ data. Browser updates are limited to the signed-in user's display name and initials; ID, email, approval, role, and status are protected by grants, RLS, and a trigger.

These app-level roles are not future workspace roles. Phase 5 can reference the same stable profile identity without duplicating credentials or identity tables.
