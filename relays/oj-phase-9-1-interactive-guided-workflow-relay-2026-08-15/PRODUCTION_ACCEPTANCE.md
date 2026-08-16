# Phase 9.1 Production Acceptance

Perform after deploying PR #25 to an owner-controlled review environment. Use an authenticated account. Record results; do not merge solely from local automation.

## Viewports

Run the critical Quick and Guided checks at:

- 1440×900
- 1280×800
- 1024×768
- 768×1024
- 430×932
- 390×844
- 375×667
- 320×568

At every size verify no horizontal page overflow, no right-side accidental scrollbar, reachable sticky actions, scrollable tutorial content, safe-area clearance, readable labels, visible focus, and no target/callout overlap. At 320×568, explicitly exercise a wide/tall highlighted target and confirm the callout becomes a reduced-height scrollable card without covering any part of the target.

## Quick Tour

1. Reset onboarding preference for the review account or use a fresh approved account.
2. Confirm first use shows **Quick Tour**, **Guided Walkthrough**, and **Skip for Now**.
3. Start Quick Tour and complete all 11 steps.
4. Confirm the Settings/Product Tour target remains completely visible at the replay step.
5. At desktop/tablet/mobile widths, confirm every highlighted target remains visible and the card stays inside the viewport.
6. Scroll the document and nested containers; resize and rotate. Confirm highlight/card repositions.
7. Customize the four mobile shortcuts and confirm route targeting still works through More.
8. On a targetless/empty account, confirm the explanatory detached fallback appears.
9. Focus input, textarea, select, and contenteditable controls; Left/Right must keep native behavior.
10. Confirm Meta/Ctrl/Alt + arrows are untouched; Escape pauses.
11. Resume from Settings, complete, and replay from Settings.
12. Confirm no domain row, provider request, or brokerage action occurred.

## Guided Walkthrough

1. Start **Guided Walkthrough**.
2. Confirm `Tutorial`, `Synthetic example`, `Temporary workspace`, and `OJDEMO` are unmistakable.
3. Create the prefilled Tutorial Catalyst. Confirm its field order, labels, validation, and primary save control match the normal **Add Catalyst** editor.
4. Confirm it does not appear in the real Catalysts list after pausing/leaving Tutorial context.
5. Open the Tutorial Catalyst Intelligence stage.
6. Confirm the 95/100/105 call/put fixture, $100 underlying, ATM/straddle/volatility summaries, `Tutorial Fixture`, `Synthetic`, and `No provider request made`.
7. Change the Base Scenario price; confirm the illustrative theoretical mark updates and no recommendation/order language appears.
8. Confirm **Check Provider Status** and **Load Delayed Options** are disabled and there is no Tutorial Research Ledger history before saving. Use **Save Snapshot**; confirm one Tutorial Fixture history entry appears with explicit temporary-session copy. Restart and repeat with **Save 6 Contracts**. Confirm both paths create only Tutorial memory and make no MarketData/government-provider request, credit consumption, provider-cache entry, or production snapshot.
9. Confirm the saved-snapshot notice says it did not enter the production Research Ledger and will disappear when the Tutorial clears. Build the Tutorial Idea through Setup, Catalyst, and Research; save it. Compare with **New Idea** and confirm the same step navigation, field layout, selectors, and primary controls.
10. Confirm the page teaches Catalyst=fact, Idea=interpretation, Candidate=planned expression, Trade=what happened elsewhere.
11. Save the 100/105 Candidate at $1.40 for one contract. Confirm this is the same fourth Candidate section used by the production Idea editor.
12. Confirm planned width $5, max loss $140, max profit $360, breakeven $101.40.
13. At Record Trade, confirm the production Phase 8.6 form is recognizable: actual expiration, strikes, contracts, debit, fees, fill time, planned-vs-actual panels, risk capacity, broker boundary, and checkbox. Confirm Tutorial says `I understand this is a synthetic fill simulation. OJ did not place an order.`, never asks the user to attest an actual fill, and submits as **Record Tutorial Trade**. Record $1.32.
14. Confirm planned Candidate remains $1.40 while actual Trade is $1.32.
15. Confirm actual max loss $132, max profit $368, breakeven $101.32.
16. Confirm Trade detail shows the same structure/thesis/monitoring, planned-vs-actual, catalyst, entry-research, and history sections as a real Trade. Add the Thesis Intact Check-In and confirm it does not appear in the real Journal.
17. Record the $2.10 exit through the normal full-exit controls and confirm Tutorial P/L is +$78 before fees. Confirm the checkbox identifies a synthetic closing transaction and the action says **Record Tutorial Exit**, not **Record Exit & Debrief**.
18. Save through the normal Debrief editor/context presentation and reach Insights.
19. Confirm the actual read-only Insights page is shown against only Tutorial-derived data and is labeled excluded from real analytics.
20. Finish and confirm Tutorial Workspace clears.

## Lifecycle and safety

1. Start again, complete several stages, then Pause.
2. Resume from Settings; confirm deterministic prerequisites return at the current section.
3. Restart; confirm the old Tutorial objects, including its saved Research Snapshot, clear before the fresh Catalyst section.
4. Exit; confirm no Tutorial object remains in production pages.
5. Start again and sign out; sign in and confirm the in-memory Tutorial session is gone.
6. Compare real before/after:
   - Catalysts
   - Ideas/Candidates
   - Trades/entries/check-ins/exits
   - Journal/Debriefs
   - Overview open risk and remaining capacity
   - Insights and P/L
   - calibration/forecasts/history
   - workspace activity/missions/sharing
   - Markdown/data exports
7. All must remain unchanged.
8. Confirm no brokerage credential prompt, broker name, order submission, or order-routing behavior exists.

## Mobile specifics

1. Open the on-screen keyboard in each editable Tutorial field; sticky Back/Next/Pause must remain reachable after scrolling.
2. Drag/tap the liquid-glass navigation while Guided is active; underlying navigation must not erase the Tutorial session.
3. Highlight a bottom-navigation Quick Tour target and confirm the card rises above or detaches to the top.
4. Confirm the Settings replay card is not covered at 430, 390, 375, and 320 widths.
5. Rotate portrait/landscape and confirm callout recomputation without horizontal drift.

## Acceptance decision

Accept Phase 9 only if all required CI jobs are green and every item above passes. If any visual target overlap, data contamination, provider traffic, or cleanup failure appears, keep PR #25 draft and repair Phase 9.1. Do not begin Phase 10 before acceptance.
