# Interaction workflow

OJ saves locally first, synchronizes approved owner records to Supabase, and explicitly resolves multi-device conflicts. The synchronized row is canonical immediately; there is no submission or pull-request step for an ordinary save.

Draft states include local, syncing, canonical, offline, retry, and conflict. The Work Update Packet is a recovery aid, not an instruction to place a trade or write private data into the public repository. Markdown export and private mirroring remain optional actions.

First-use product guidance is an explicit, versioned choice between a conceptual **Quick Tour** and a hands-on **Guided Walkthrough**. Quick Tour changes routes but does not change domain state. Guided Walkthrough uses an isolated in-memory Tutorial Workspace and bundled synthetic fixture; its Save and Record controls update only that disposable workspace. It makes no canonical record write, provider request, cache write, brokerage action, or collaboration update.

Guided actions follow the real product boundary: Catalyst captures the scheduled fact; Idea captures the user's interpretation; Candidate captures the plan; Trade captures an execution completed elsewhere; Check-In monitors a live Trade; Exit and Debrief close and reflect on the outcome; genuine completed history later informs Insights. The tutorial follows the same sequence without entering real risk, Journal, Insights, calibration, activity, or export state.

A pause stores only the version, status, and stage in application preferences. Resume reconstructs deterministic tutorial prerequisites. Finish, restart, exit, and sign-out clear the in-memory session. Both onboarding modes can be replayed from Settings. See `PRODUCT_TOUR.md`.
