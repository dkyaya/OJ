# Interaction workflow

OJ saves locally first, synchronizes approved owner drafts to Supabase, and explicitly resolves multi-device conflicts. Submit freezes the synchronized revision and starts a private canonical-journal PR. Codex reviews/corrects that branch; the owner manually merges; atomic reconciliation publishes the normalized owner record without a public commit or Pages rebuild.

Draft states include local, syncing, synced, offline, conflict, submitted, private PR open, and published. The Work Update Packet is a recovery aid, not an instruction to place a trade or write into the public repository.
