# Catalyst Intelligence Layer V1

## Purpose and boundary

Catalyst Intelligence is a private analytical layer inside the existing Catalyst War Room. It helps a user record what the market priced, calculate transparent derived metrics, compare scenarios, and build a prospective calibration record. It does not write a thesis, select a trade, alter an Idea, or connect to a broker.

The layer has one deliberate flow:

1. **Data collection** records manual or normalized provider observations with source, time, and freshness.
2. **Analytics and pricing** run pure deterministic TypeScript functions over those observations.
3. **Research interpretation** remains human-authored in the existing Research Ledger, Evidence, Forecast, Idea, and Journal surfaces.

No provider response is treated as research interpretation. No provider response can create or update a trade.

## Existing architecture reused

- `catalysts` remains the event system.
- `trade_ideas` and `trade_candidates` remain the user-controlled decision structures.
- `research_sources` remains the source registry.
- `research_snapshots` remains the private, append-only Research Ledger.
- `trade_idea_catalysts` remains the link between an event and an Idea.
- Forecasts and debriefs retain their existing privacy and cutoff behavior.

V1 adds queryable provenance fields to `research_snapshots` and one service-only `catalyst_provider_cache`. The cache is not a second Research Ledger and cannot be read or written by a browser role.

## Normalized snapshot

The common market observation supports provider, source reference, source quality, observed/fetched timestamps, freshness, ticker, underlying price, expiration, contract, side, strike, bid/ask/midpoint, last, volume, open interest, IV, Greeks, methodology, and manual/provider provenance. Optional fields stay optional so a basic manual snapshot is usable.

Freshness is explicit:

- `current`: provider data represented as current by that provider.
- `delayed`: delayed market data; never presented as live.
- `historical`: a dated past observation.
- `manual`: user-transcribed data with its own observation timestamp.

## War Room experience

The **Intelligence** tab contains progressive sections:

- Market Pricing and permanent Manual Snapshot entry.
- Candidate Economics and user-controlled Scenario Lab.
- T-relative Timeline and descriptive Calibration.
- provider status, source, freshness, methodology, and limitations.

Provider checks and market requests are explicit button actions. The application does not poll. A loaded provider result is not added to research history until the user chooses **Save**.

### Readable option-chain snapshots

Normalized option chains use the reusable `OptionChainSnapshot` reader before save and in the Research Ledger. The default view pairs calls and puts by strike and shows bid, ask, midpoint, and IV around a central strike column. Contract symbols, volume, open interest, last price, and Greeks remain available under **Contract Details**. The normalized payload remains available, pretty printed, under collapsed **Technical Details**; structured data is never rendered as an inline JSON wall.

The chain header distinguishes provider, freshness, market observation time, retrieval time, and private-cache state. **Delayed** is prominent. `New provider response cached` means the request reached the provider and OJ cached the normalized result; `Private cache hit` means OJ reused a matching private cache record without a new provider request.

The nearest ATM strike minimizes absolute distance from the stored underlying. Exact ties use the lower strike so the result is deterministic; no ATM label appears when the underlying is missing. If that exact strike has both a valid call and put, the existing midpoint and straddle analytics derive the combined dollar and percent move. One-sided or invalid data reports insufficient data rather than mixing strikes.

Manual and provider observations with the same ticker and expiration are presented side by side with provider, freshness, and observation time. OJ does not claim the values are directly comparable when their timestamps differ.

### Snapshot removal and recovery

Snapshots remain immutable after save. **Remove Snapshot** appends a user-owned lifecycle event; it does not edit or delete the original observation. Removed snapshots are excluded from active research, timeline counts, IV context, calibration, history, and data-quality samples. **Removed Snapshots** retains the reason, note, and removal time and can **Restore** the exact original observation with a later append-only lifecycle event.

Removal and restoration require an approved active authenticated owner and atomic RPCs. Another user cannot read or change the lifecycle record. Restoration is explicit, so a stale client refresh cannot recreate removed data. If an observation is wrong, remove it and save a new corrected observation rather than editing history.

## Privacy and security

- Research snapshots remain owner-scoped by existing RLS.
- Provider credentials exist only in the Supabase Edge Function environment.
- The gateway requires an authenticated, approved, active OJ account.
- The cache is partitioned by user and exposed only to `service_role`.
- Snapshot lifecycle metadata is owner-only under RLS and browser roles cannot insert, update, or delete it directly.
- External responses are bounded and normalized before storage.
- Provider errors are reduced to deterministic codes; secret-bearing upstream messages do not reach the browser.
- CORS allows the production Pages origin and the local development origin.
- No brokerage credential, OAuth flow, order preview, order route, or execution capability exists.

## Zero-cost operation

Manual mode requires no external account and is permanent. BLS and Treasury paths use official public endpoints. SEC is public but requires a compliant request identity. MarketData, FRED, BEA, and Census are optional free-credential providers. Missing keys show `configuration needed` and never disable the layer.

Zero recurring cost is an architectural constraint, not a promise that every requested datum can be automated. When a permissible free source is unavailable, OJ exposes the limitation and keeps sourced manual entry available.

## Deployment

Deployment requires migrations `20260812224500_phase_8_5_catalyst_intelligence.sql` and `20260813030000_phase_8_5_1_snapshot_lifecycle.sql`, followed by the JWT-protected `catalyst-intelligence-data` Edge Function. Optional server secrets are documented in [DATA_PROVIDERS.md](./DATA_PROVIDERS.md). The existing manual GitHub workflow deploys pending migrations and the function; the user remains final merge and deployment authority.
