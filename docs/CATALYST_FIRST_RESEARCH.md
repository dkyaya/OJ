# Catalyst-first research

OJ's research sequence is:

`Catalyst → Expectations → Research → Market Pricing → Thesis → Entry Window → Structure → Trade → Event Response → Exit → Review`

The order is intentional. A ticker is a possible vehicle, not the starting conclusion, and a spread is selected only after event verification, market transmission, pricing, and decision criteria are written. Research may validly end in **Parked**, **Rejected**, or **No Trade**.

## Scheduled events and contextual risk

Scheduled catalysts have a local date and time, IANA timezone, market session, date certainty, source quality, verification time, and release status. Confirmed releases populate Calendar views. Estimated and unconfirmed dates are visibly filterable.

Contextual risk—geopolitical developments, financing concerns, expectations saturation, or an unconfirmed speaker—does not receive a false calendar date. It remains a contextual Catalyst until a source verifies a schedule.

## Research board

Private Ideas progress through:

`Watching → Researching → Thesis Forming → Entry Candidate → Entered → Exited → Reviewed`

Alternative terminal or paused states are **Parked**, **Rejected**, and **No Trade**. Entry remains distinct from research stage: only an explicit user-confirmed brokerage fill creates a Trade.

One Idea may link to multiple Catalysts as primary, supporting, avoid, exit, or context. Exposure tags can overlap; OJ displays active maximum risk by tag and explicitly warns that tagged totals are not additive.

## Catalyst brief and research ledger

The existing Catalyst War Room now carries the brief:

- schedule, certainty, source quality, and last verification;
- consensus, prior, actual, and surprise;
- why the event matters and which variables transmit into markets;
- linked securities and related private Ideas;
- post-event cross-asset, rates, sector, and interpretation fields;
- first-party sources and append-only research snapshots.

The verified Catalyst source is a shared fact when the Catalyst is workspace-visible. Personal supporting sources store publisher, URL, quality, supported claim, access time, and verification time. Personal snapshots store an observation timestamp, explicit methodology, and structured inputs. They are append-only from the browser so changed market pricing never silently overwrites earlier research.

## Risk and execution boundary

OJ supports only defined-risk debit vertical candidates. Maximum loss is debit × 100 × contracts. The account policy is a ceiling, never a sizing target. A small construction overshoot can be recorded only with an explicit acknowledgement and reason, and is capped in the interface at the greater of $25 or 5% of the portfolio-risk ceiling.

OJ never auto-sizes, submits, routes, or confirms a brokerage order. Credentials and brokerage execution are outside the application.

## Deployment order

The migration `20260812025054_catalyst_first_research_foundation.sql` must be deployed before users create rich Catalysts, sources, or snapshots. Reads remain backward compatible while the migration is pending: the new ledger tables load as empty if they do not yet exist. The normal manual Supabase deployment workflow remains the production gate.

Real research records are not fixtures. They must be imported or created through the authenticated application/private journal only after the migration is deployed. Public demo data remains synthetic and uses `.invalid` source URLs.
