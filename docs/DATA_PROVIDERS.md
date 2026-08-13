# Catalyst Intelligence Data Providers

## Feasibility gate

V1 passes the zero-recurring-cost gate because manual entry is permanent, official no-key sources cover a useful macro/company core, and every credentialed provider is optional. No paid plan is required for the application to build, test, or operate.

| Input | Source | Class | Auth | Free constraint | Freshness / depth | Terms and cache | Fallback | V1 |
|---|---|---|---|---|---|---|---|---|
| Option quotes/Greeks | [MarketData Free Forever](https://www.marketdata.app/docs/account/plans/free-forever/) | Third-party | `MARKETDATA_API_KEY` | 100 daily credits; each returned option can consume a credit | 24-hour delayed; about one year history | One ticker, exact expiration, max 10 nearby strikes; historical requests effectively immutable | Manual option snapshot | Yes, optional |
| Manual option/market observation | User-named platform/source | Manual | None | None | User records exact time | Stored only on explicit save with provenance | N/A | Yes, permanent |
| CPI/PPI/payroll/unemployment | [BLS API](https://www.bls.gov/developers/) | Official | None for public V1 | Public V1 limits apply | Official released series | Allowlisted series; six-hour cache | Sourced manual release | Yes |
| GDP/PCE | [BEA API](https://apps.bea.gov/api/) | Official | `BEA_API_KEY` | Free key; rate limits and `Retry-After` apply | Official released series | Allowlisted NIPA tables; 12-hour cache | Official source/manual | Yes, optional |
| 2Y/10Y/nearby rate | [U.S. Treasury](https://home.treasury.gov/resource-center/data-chart-center/interest-rates) | Official | None | Public feed | Daily history | Narrow year request; 12-hour cache | Manual rate with date/maturity | Yes |
| Macro history | [FRED API](https://fred.stlouisfed.org/docs/api/) | Official aggregator | `FRED_API_KEY` | Free key; service limits may change | Series-dependent | Allowlisted series and max 120 rows; six-hour cache; required FRED attribution | Original publisher/manual | Yes, optional |
| Filing history | [SEC EDGAR API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | Official | `SEC_USER_AGENT` request identity | Public fair-access policy | Updated throughout day | Exact CIK, recent rows only, 30-minute cache | Curated IR/SEC link | Yes |
| Population context | [Census API](https://www.census.gov/data/developers.html) | Official | `CENSUS_API_KEY` | Free key | ACS vintage-dependent | One allowlisted ACS profile variable and state; 24-hour cache | Official table/manual | Yes, narrow |
| Company communications | Curated company Investor Relations pages | Official company | None normally | Site-specific | Company-specific | Links only in V1; no universal scraping | SEC filings | Yes, manual registry |

MarketData's official [plan limits](https://www.marketdata.app/docs/account/plan-limits/) and [option-chain documentation](https://www.marketdata.app/docs/api/options/chain/) are the source of truth. Complete chains and `expiration=all` are intentionally unsupported. The application never polls.

## Server configuration

Optional Supabase Edge Function secrets/configuration:

```text
MARKETDATA_API_KEY
FRED_API_KEY
BEA_API_KEY
CENSUS_API_KEY
SEC_USER_AGENT
```

`SEC_USER_AGENT` is a request identity, not a secret, but is configured server-side with the other provider settings. None of these values belongs in a Vite variable, GitHub Pages artifact, browser storage, Research Ledger row, log, or error response.

The Edge runtime also uses Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and a backend secret/service-role credential. Those values are not supplied by the frontend.

## Gateway actions

The single `catalyst-intelligence-data` function supports:

- `status`
- `options_chain`
- `bls_series`
- `treasury_rates`
- `sec_filings`
- `fred_series`
- `bea_data`
- `census_population`

Every action has an allowlist and a bounded response. Unknown keys, broad datasets, unrestricted option chains, invalid periods, and oversized responses are rejected.

## Cache rules

The cache key is a SHA-256 digest of provider action and normalized non-secret parameters. Cache rows are private to one user and service-only.

- exact historical MarketData requests remain valid through a far-future expiry and are reused.
- delayed options cache for 30 minutes.
- new MarketData cache misses stop after four requests across the shared key in any rolling 24-hour period; with at most 22 returned contracts per request, the worst planned total remains below 100 daily credits.
- SEC cache for 30 minutes.
- macro providers cache between 6 and 24 hours according to source cadence.
- the browser has no force-refresh flag and no polling loop.
- cache hits are reported to the UI.

The cache stores normalized payloads, not opaque HTTP bodies. Research history changes only when the user explicitly appends a snapshot.

## Provider/legal limitations

- FRED output must include: “This product uses the FRED API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.”
- SEC filing time is not assumed to be an earnings event time.
- IR links are curated; V1 does not scrape company sites.
- BLS V1 and every other public API may apply operational rate limits.
- Census, BEA, FRED, and MarketData are unavailable until their optional keys are configured.
- No test or CI job calls a production provider or spends real provider credits.
