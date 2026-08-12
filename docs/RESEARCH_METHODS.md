# Research methods

OJ stores calculations with their observation time, source, horizon, and methodology. A number without those inputs is not treated as auditable research.

## Implied moves

**Event-implied move** estimates the movement attributed to a specific event. It must record how non-event time value was removed or otherwise estimated.

**Expiration-implied move** estimates the movement priced through an option expiration. A common approximation is:

`(ATM call midpoint + ATM put midpoint) ÷ underlying price × 100`

These are different horizons. OJ stores and labels them separately and never silently substitutes one for the other. The snapshot should record the ticker, underlying price, expiration, strikes, call and put mids, observation time, and calculation method.

## Realized event moves

For earnings, the default realized reaction is previous regular-session close to the event-day regular-session close:

`(event close − previous close) ÷ previous close × 100`

Each observation retains both signed and absolute return. Rolling summaries show the most recent four and eight comparable events, the sample count, average signed return, and average absolute return. A different window—close-to-open, close-to-next-close, or intraday—must be explicitly named rather than mixed into the default series.

## Entry-window snapshots

When an entry window spans multiple sessions, each snapshot may capture:

- underlying price and relative strength;
- relevant implied volatility and skew;
- event-implied and expiration-implied moves;
- candidate debit and bid/ask quality;
- 2-year and 10-year yields;
- central-bank probability assumptions;
- information gained since the previous observation.

The purpose is to compare the value of waiting for information against higher event premium, theta, or lost entry quality. It is not a command to enter.

## Debit spreads and volatility

OJ supports bull-call and bear-put debit spreads. A debit spread can lose value from volatility compression because the long option usually carries more vega than the short option. The application must not claim that “IV crush benefits a debit spread” without position-specific analysis.

For one or more contracts:

- maximum loss = debit × 100 × contracts;
- maximum profit = (spread width − debit) × 100 × contracts;
- bull-call break-even = long strike + debit;
- bear-put break-even = long strike − debit.

All pricing is informational. A candidate is not a fill, and a research stage is not a Trade.

