# Catalyst Timeline and Calibration

## Canonical trading-session labels

OJ uses trading sessions, not ambiguous calendar-day labels:

- **T-5:** five completed trading sessions before the catalyst session.
- **T-3:** three completed trading sessions before.
- **T-1:** final completed trading session before.
- **T0:** catalyst session.
- **T+1:** next completed trading session.
- **T+5:** fifth completed trading session after.

Every snapshot still stores an exact `observed_at`. It can also store source date, calendar days to catalyst, catalyst timezone, and market-session context. Arbitrary timestamps remain valid.

Historical label derivation must use a supplied ordered list of actual trading sessions. It does not subtract weekdays and therefore does not silently treat market holidays as sessions. Pre-market, regular-session, after-hours, all-day, and unscheduled catalysts retain their explicit event context.

## Prospective Research Ledger workflow

Useful comparison snapshots include:

- T-5/T-3/T-1 underlying price, IV, ATM straddle move, and candidate debit.
- T0 release value and same-session reaction.
- T+1/T+5 realized move and follow-through.
- exact source, observed time, fetched time, freshness, and methodology.

Snapshots are append-only. A corrected or later observation creates a new record; it does not rewrite the original market observation.

## Calibration outputs

V1 reports only descriptive statistics when a snapshot includes both an implied move and a realized move:

- sample size `n`.
- average implied absolute move.
- average realized absolute move.
- average absolute prediction error.
- percentage of realized moves that exceeded the implied estimate.
- average pre-event drift when recorded.

No confidence interval, win probability, or machine-learned score is produced. Small `n` remains visibly small.

## Data-quality rule

The simple quality state considers source quality, freshness, completeness, and sample size:

- fewer than half of required fields: **Insufficient**.
- official/primary source, appropriate freshness, and larger sample progressively improve the state.
- score 6+: **Strong**.
- score 4–5: **Moderate**.
- lower valid score: **Limited**.

The rule is inspectable in `analytics.ts`; it is not a hidden confidence score. A manual observation can be useful while still showing its limitations.

## Revision and hindsight limits

Macroeconomic releases can be revised. V1 preserves the value observed at the snapshot timestamp and supports source notes, but it does not yet provide a full ALFRED vintage-retrieval workflow. Backtests must not substitute a later revised value for an original release unless labeled explicitly.

Earnings dates must come from an existing verified Catalyst, a curated company source, or a safe official record. An SEC filing timestamp alone is not enough to assert the exact earnings-event timestamp.

## Interpretation boundary

The calibration layer may say what was priced and what happened. The user remains responsible for why it happened, whether the comparison is relevant, and whether it changes an Idea. Analytics never rewrite bias, confidence, strikes, sizing, planned exit, or hold-through fields.
