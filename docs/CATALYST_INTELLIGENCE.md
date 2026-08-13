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

## Privacy and security

- Research snapshots remain owner-scoped by existing RLS.
- Provider credentials exist only in the Supabase Edge Function environment.
- The gateway requires an authenticated, approved, active OJ account.
- The cache is partitioned by user and exposed only to `service_role`.
- External responses are bounded and normalized before storage.
- Provider errors are reduced to deterministic codes; secret-bearing upstream messages do not reach the browser.
- CORS allows the production Pages origin and the local development origin.
- No brokerage credential, OAuth flow, order preview, order route, or execution capability exists.

## Zero-cost operation

Manual mode requires no external account and is permanent. BLS and Treasury paths use official public endpoints. SEC is public but requires a compliant request identity. MarketData, FRED, BEA, and Census are optional free-credential providers. Missing keys show `configuration needed` and never disable the layer.

Zero recurring cost is an architectural constraint, not a promise that every requested datum can be automated. When a permissible free source is unavailable, OJ exposes the limitation and keeps sourced manual entry available.

## Deployment

Deployment requires migration `20260812224500_phase_8_5_catalyst_intelligence.sql` followed by the JWT-protected `catalyst-intelligence-data` Edge Function. Optional server secrets are documented in [DATA_PROVIDERS.md](./DATA_PROVIDERS.md). The existing manual GitHub workflow deploys the migration and function; the user remains final merge and deployment authority.
