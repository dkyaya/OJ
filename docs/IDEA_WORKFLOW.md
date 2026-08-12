# Canonical Idea workflow

OJ uses one form for creating and editing a private Idea:

1. **Setup** — Ticker, Asset Type, Strategy, Bias, Status
2. **Catalyst** — use a scheduled catalyst or create one with Event Name, Source, Link, Date, and Category
3. **Research** — Thesis, private Evidence, Entry Conditions, Planned Exit, Invalidation, Hold Through, and Avoid
4. **Candidate** — Long Strike, Short Strike, Net Debit, Number of Contracts, and Confidence

The only user-facing Idea statuses are Watchlist, Ready, Deferred, Draft, Rejected, and Invalidated. Archive is a separate reversible lifecycle; archived Ideas are read-only until restored. Permanent delete remains a separate confirmed action.

## Edit guarantees

- Editing preserves the Idea ID and linked Trade provenance.
- Saves include the expected revision. A stale device must refresh before it can overwrite a newer record.
- A deleted canonical record cannot be recreated by an IndexedDB retry.
- A meaningful save creates the next `record_revisions` snapshot. A no-op save creates none.
- Private Idea evidence remains separate from shared Workspace evidence cards.
- The app never connects to a broker or sends an order.

## Catalyst categories

New records use Employment, Inflation, Growth / Activity, Central Bank, Earnings, Company / Corporate, Rates / Treasury, Fiscal Policy, Trade / Tariffs, Regulation / Legal, Geopolitical, Commodity / Energy, Technical / Market Structure, or Other.

The migration promotes only deterministic legacy event types. Ambiguous `Policy` values stay in `event_type` with a null canonical category so a person can classify them later. The original value remains available as provenance.

## Candidate compatibility

`Candidate` is the canonical label for new or changed structures. Existing `Balanced` and `Aggressive` database values remain accepted and readable for history, but neither appears as a current product choice.
