# Approval model

`Cloud draft -> owner submits -> private PR -> automatic private CI -> Codex review/correction -> owner manually merges -> atomic Supabase publication`

New profiles are server-created with `approved=false`. Browser clients cannot update any profile field, cannot self-approve, and cannot use mutable user metadata as authorization. RLS and Edge Functions separately require the non-null authenticated owner and server-controlled approval.

Entries, exits, thesis changes, private-journal merges, approval changes, and archive/deletion workflows remain manually controlled. OJ never executes brokerage actions.
