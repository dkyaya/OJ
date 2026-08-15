# Interaction workflow

OJ saves locally first, synchronizes approved owner records to Supabase, and explicitly resolves multi-device conflicts. The synchronized row is canonical immediately; there is no submission or pull-request step for an ordinary save.

Draft states include local, syncing, canonical, offline, retry, and conflict. The Work Update Packet is a recovery aid, not an instruction to place a trade or write private data into the public repository. Markdown export and private mirroring remain optional actions.

First-use product guidance is an explicit, versioned choice. The tour changes routes and stores progress in application preferences, but it performs no domain-record write and no provider request. A user can skip, pause, resume, complete, or replay it without affecting Catalyst, Idea, Candidate, Trade, Check-In, Exit, Debrief, or Forecast state. See `PRODUCT_TOUR.md`.
