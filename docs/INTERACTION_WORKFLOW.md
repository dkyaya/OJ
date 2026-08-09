# Interaction workflow

OJ saves locally first, synchronizes approved owner records to Supabase, and explicitly resolves multi-device conflicts. The synchronized row is canonical immediately; there is no submission or pull-request step for an ordinary save.

Draft states include local, syncing, canonical, offline, retry, and conflict. The Work Update Packet is a recovery aid, not an instruction to place a trade or write private data into the public repository. Markdown export and private mirroring remain optional actions.
