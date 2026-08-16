# Product Tour

OJ offers two separate onboarding experiences:

- **Quick Tour** explains how OJ is organized in about two minutes. It remains the read-only, route-aware Phase 9 tour.
- **Guided Walkthrough** lets a user practice the Catalyst-to-Insights workflow in about five to seven minutes with a clearly labeled synthetic company, `OJ Tutorial Co. (OJDEMO)`.

Both leave canonical OJ records untouched. Neither places an order, connects to a broker, or requests market or government-provider data.

## First use and preferences

First use offers **Quick Tour**, **Guided Walkthrough**, and **Skip for Now**. The two modes remain separate: the Quick Tour is conceptual and freely navigable; the Guided Walkthrough is hands-on and gates its key steps until the tutorial action is complete.

Only small, versioned onboarding state is stored in `application_preferences.data`:

```json
{
  "productTour": { "version": 1, "status": "completed", "step": 10 },
  "guidedWalkthrough": { "version": 1, "status": "paused", "stage": 4 }
}
```

Timestamps may also be present. Theme, calendar view, compact-card choice, mobile navigation, and unrelated preference JSON are preserved. No Catalyst, Idea, option chain, Trade, note, account value, or arbitrary tutorial input is stored in preferences. No schema migration is required.

Settings exposes both modes under **Product Tour**. A user can start or replay the Quick Tour, start or resume the Guided Walkthrough, or restart the Guided Walkthrough with a clean tutorial session.

## Isolated Tutorial Workspace

The Guided Walkthrough uses an in-memory `TutorialWorkspace`, not the authenticated production `Workspace` and not demo mode. Demo mode is a synthetic preview of the whole application; the Guided Walkthrough is a temporary learning session within an authenticated account.

The Tutorial Workspace contains lightweight tutorial analogues for Catalyst, Intelligence observation, Idea, Candidate, Trade, Check-In, Exit, and Debrief. Its fixture and orchestration modules have an explicit import boundary from Supabase, production write actions, collaboration actions, and research providers. The UI reuses production payoff, P/L, option-chain, expected-move, and scenario utilities, plus the production option-chain presentation.

The bundled fixture has six call/put contracts across the 95, 100, and 105 strikes. It is labeled **Tutorial Fixture / Synthetic / Tutorial session**. Opening Catalyst Intelligence produces no MarketData, BLS, BEA, FRED, Census, Treasury, SEC, cache, or Research Ledger write.

## Guided story and lifecycle

The walkthrough teaches:

1. Create the synthetic `OJ Tutorial Co. Q2 Earnings` Catalyst.
2. Review Catalyst Intelligence, expected move, Scenario Lab, and Research Ledger provenance.
3. Save a bullish Tutorial Idea linked to the factual Catalyst.
4. Save a 100/105 bull call Candidate at a planned $1.40 debit.
5. Manually record the simulated $1.32 fill after external execution.
6. Add a **Thesis Intact** Check-In.
7. Record a $2.10 spread exit.
8. Save a short Debrief.
9. See how genuine completed history would later contribute to Insights.

Production payoff utilities derive the planned $140 maximum loss, $360 maximum profit, and $101.40 breakeven; actual execution derives $132, $368, and $101.32. Production P/L utilities derive the $78 gain before fees.

Pause saves only the current stage. Reloading or resuming reconstructs deterministic prerequisites and restarts the current section without persisting entered tutorial text. Finish, restart, explicit exit, and sign-out clear tutorial objects from memory. Because those objects never enter canonical state, they cannot affect risk capacity, Journal, Insights, calibration, collaboration, activity, provider cache, or exports.

## Quick Tour placement and accessibility

Quick Tour anchors use semantic `data-tour-id` targets. Pure placement logic treats the highlighted target as a protected rectangle, tests below/above/right/left candidates inside viewport margins, and chooses a non-overlapping placement. When none fits, the card detaches while the target stays visible. Mobile can raise or top-position the card so a highlighted bottom-navigation target is not covered.

Target bounds are remeasured after route changes, nested or document scroll, resize, orientation change, and card-size changes. Missing targets receive an explanatory detached card instead of an invisible control.

The first-use invitation is modal and manages focus. Quick Tour and Guided Walkthrough are non-modal. Editable controls retain native arrow-key behavior; Meta, Ctrl, and Alt arrow shortcuts are preserved; Escape pauses; and a synchronous lock serializes buttons and keyboard transitions. Focus moves to the current heading/card. Reduced-motion settings disable optional movement, and actions remain keyboard reachable.

Phase 9.1 does not add contextual guidance, brokerage connections, provider polling, collaboration onboarding, achievements, or automatic trade recommendations.
