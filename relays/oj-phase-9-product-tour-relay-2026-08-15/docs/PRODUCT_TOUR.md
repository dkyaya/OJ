# Product Tour

OJ’s versioned product tour introduces the catalyst-first workflow without creating or changing a domain record. It is an orientation layer, not a sample-data generator. Moving through the tour changes routes and saves only tour progress in the signed-in user’s existing application preferences. It does not call a market-data provider, consume an API credit, create a Catalyst or Idea, or touch a brokerage.

## First use and persistence

`PRODUCT_TOUR_VERSION` is currently `1`. The canonical state lives at `application_preferences.data.productTour`:

```json
{
  "version": 1,
  "status": "in_progress",
  "step": 4,
  "updatedAt": "2026-08-15T12:00:00.000Z"
}
```

Valid statuses are `not_started`, `in_progress`, `skipped`, and `completed`. An absent or older-version state is treated as new, allowing a materially revised tour to be offered deliberately in a later release. First use asks for consent with **Take a Tour** and **Skip for Now**. Skip and completion persist across devices. An in-progress tour can be paused and resumed from **Settings → Guidance**; skipped and completed tours can be replayed there.

No schema migration is required. Preference saves preserve theme, calendar view, compact-card choice, mobile navigation, and unrelated preference JSON. Optimistic preference revisions continue to detect competing device changes.

## Steps

The 11 steps cover:

1. Overview and the complete catalyst-first lifecycle.
2. OJ risk policy versus brokerage buying power.
3. Catalyst calendar and shared factual research.
4. War Room and Catalyst Intelligence without provider activity.
5. Private Ideas under “Shared facts, separate conclusions.”
6. Planned Candidates versus actual execution.
7. Manual Record Trade after external execution.
8. Trade monitoring and Check-Ins.
9. Journal debriefs and personal reflection.
10. Insights and small-sample caution.
11. Settings Guidance, replay, and completion.

The controller navigates directly by route; it never assumes a mobile shortcut position or requires a destination to be visible outside **More**. Every anchor uses a stable semantic `data-tour-id`. Target lookup retries for a bounded interval after cross-route rendering. If an account has no Catalyst, Candidate, Trade, or other example, the step becomes a centered explanatory callout instead of failing or fabricating data.

## Responsive and accessible behavior

Desktop uses an anchored popover and highlighted region. Narrow viewports use a bottom sheet so the explanation stays readable above safe-area insets. Target bounds are remeasured on scroll and resize. Reduced-motion preferences disable tour animation and smooth scrolling.

The first-use dialog moves focus into its choices, traps Tab within the modal, restores prior focus, and treats Escape as **Skip for Now**. The active tour is non-modal: its Back, Next, Pause, and Finish controls are keyboard reachable; Left/Right arrows move between steps; Escape pauses; route content remains available. Missing targets are announced in the callout rather than producing an invisible or off-screen control.

## Product boundary

The tour intentionally reinforces these distinctions:

- Catalyst facts may be shared; Ideas, sizing, Trades, and Journal reflection stay private.
- A Candidate is planned research, not an order.
- A Trade is manually recorded only after execution elsewhere.
- A Check-In belongs to Trade monitoring and history, not the Journal feed.
- Journal contains completed Trade debriefs and personal lessons.
- OJ risk capacity is not brokerage cash, margin, or buying power.

Phase 9 does not add contextual guidance, spread-efficiency tooling, a brokerage connection, or collaboration gameplay.
