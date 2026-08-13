# Catalyst Pricing Engine V1

All pricing modules are pure TypeScript. They have no database, provider, authentication, or browser dependency. Inputs are validated and invalid results return no value rather than a fabricated estimate.

## Quotes and implied moves

**Midpoint**

`mid = (bid + ask) / 2`

The calculation requires finite non-negative prices and `ask >= bid`.

**ATM straddle-implied move estimate**

`dollar move = ATM call midpoint + ATM put midpoint`

`percent move = dollar move / spot × 100`

This is labeled an approximate priced move. It is not an exact probability boundary.

For a normalized provider chain, OJ pairs calls and puts at identical strikes and selects the stored-underlying's nearest strike. Exact distance ties select the lower strike deterministically. The chain summary calls this **Nearest ATM**, not a recommendation. It uses only the call and put from that same strike; a missing side, invalid quote, or missing underlying produces no straddle estimate.

The midpoint helper prefers a valid bid/ask calculation and may use a stored normalized midpoint when one side of the quote is unavailable. Provider, delayed/current freshness, observation time, and retrieval time remain visible next to the resulting estimate.

**Volatility-implied one-sigma move**

`dollar move = spot × annual IV × sqrt(days to maturity / days in year)`

The method displays its DTE and annualized-IV assumptions and remains distinct from the straddle estimate.

## IV context

IV Rank reports the current IV location between the observed lookback low and high:

`(current - low) / (high - low) × 100`

IV Percentile reports how many lookback observations are below the current IV. Both display the observation count. A flat or insufficient history does not produce a rank.

## Incremental and estimated event variance

Total variance for a maturity is `IV² × time in years`. Incremental variance is the longer-expiration total variance minus the shorter-expiration total variance. A negative result is rejected rather than relabeled.

An optional estimated event variance subtracts a documented baseline variance from a supplied total variance. It is always labeled **estimated**; OJ does not call a simple IV difference an observed earnings premium.

## Vertical economics

The engine reuses `spreadMetrics()` from the existing payoff library for width, maximum loss, maximum profit, break-even, and reward/risk. Supported V1 structures are bull-call and bear-put debit spreads.

At expiration, the scenario value is the exact intrinsic vertical value. Before expiration, the app calculates a theoretical mark for each leg with a Cox-Ross-Rubinstein binomial tree and subtracts the short-leg value from the long-leg value.

V1 defaults are visible:

- 200 CRR steps.
- American exercise style for equity/ETF options.
- user-supplied risk-free rate.
- zero dividend yield when none is supplied.
- user-supplied scenario IV.

The result is labeled **Theoretical mark estimate**. It is not an executable quote and does not include market impact or a guaranteed fill.

## Implied-volatility solver

The solver uses bounded bisection against the CRR model. It checks approximate discounted arbitrage bounds, finds a valid lower-volatility tree, and stops after a fixed iteration bound. Invalid prices, missing roots, invalid trees, or non-convergence return no IV.

## Scenario EV and assessment

Bull, Base, and Bear are user-controlled. Each supplies probability, underlying move or target, evaluation date, and target IV. EV is withheld unless probabilities total exactly 100% within a numerical tolerance.

`scenario contribution = scenario P/L × scenario probability`

`EV = sum of scenario contributions`

The early-entry label is inspectable:

- **Attractive:** EV is at least 10% of defined maximum risk.
- **Expensive:** EV is below -5% of defined maximum risk.
- **Fairly Priced:** EV is between those boundaries.
- **Insufficient:** valid EV or maximum risk is missing.

These are product research bands, not an AI score or trade recommendation. The UI states the applicable rule next to the label.

## Known limitations

- CRR is a model, not a market quote.
- V1 does not model a full volatility surface, discrete dividends, borrow constraints, or execution slippage.
- Scenario probabilities are the user's beliefs, not inferred probabilities.
- Small calibration samples remain descriptive.
- Same-day decisions may require manual current quotes because free automated options are delayed.
