# Forecast Model

A forecast belongs to one user and one shared catalyst. It contains an expected result, market direction, optional magnitude and unit, confidence, optional preferred ticker and strategy, and a Trade, Watch, No Trade, or Undecided intention.

Forecasts start Private. The author may explicitly switch visibility to Shared. Workspace members can then read only the forecast fields; no account, position, sizing, private Idea, or Journal data is joined into the record.

Every save creates an append-only draft snapshot. Updating an existing forecast requires the current revision and a reason, then advances the revision. Locking creates an immutable locked snapshot. Direct browser inserts/updates to forecasts and all browser writes to revision rows are revoked.

The catalyst `event_at` timestamp is the authoritative cutoff. Save, revision, and lock operations check it on the server, so a changed device clock cannot reopen a forecast. Post-event forecasts fail closed.

Debriefs record the actual release and market reaction. Factual summaries may be shared; personal trading lessons belong in Journal.
