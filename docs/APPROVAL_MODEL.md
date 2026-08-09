# Approval model

`Owner edits -> IndexedDB retry cache -> owner-scoped Supabase canonical row`

Approved authentication and RLS gate normal use. A separate optional path can export Markdown or request a private mirror PR; the owner remains the final merge authority for that mirror.

New profiles are server-created with `approved=false`. Browser clients cannot update any profile field, cannot self-approve, and cannot use mutable user metadata as authorization. RLS and Edge Functions separately require the non-null authenticated owner and server-controlled approval.

Entries, exits, thesis changes, private-journal merges, approval changes, and archive/deletion workflows remain manually controlled. OJ never executes brokerage actions.
