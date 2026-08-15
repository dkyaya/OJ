# OJ Phase 9 — Product Tour + Final Workflow Cleanup Relay

Date: 2026-08-15

Repository: `dkyaya/OJ`

Draft PR: [#24 — Add OJ’s adaptive product tour](https://github.com/dkyaya/OJ/pull/24)

## A. Baseline

- Starting `main`: `be9d02a4d237116ce0b2be9fc77a1baa9a294c77` (merged Phase 8.6).
- The pre-existing deterministic-clock repair was commit `25e5203a49b6b9a070038724f638f96a5ac8ce47`. PR #23 merged it into `main` as `1ae5f7c28380792453a5ae6c17875d31f0ecb5ce` while Phase 9 was being built.
- Phase 8.6 was already deployed and manually accepted. Phase 9 preserves its Idea → Candidate → Trade → Check-In → Exit → Debrief model.
- Existing navigation has six primary routes, four customizable mobile shortcuts plus More, and secondary Workspace/Settings routes.
- Existing per-user preferences are canonical in Supabase `application_preferences`, with flexible JSON under `data` and optimistic `revision` conflict detection.
- OJ remains invite-only, Supabase-backed, owner-scoped, and brokerage-independent.

## B. Pre-tour cleanup

Trade Check-Ins are no longer constructed as `workspace.journal` records. Journal’s canonical feed and count now derive only from `journal_reviews`. Journal rendering also defensively filters for `kind === "review"` so an old in-memory Check-In cannot leak into the feed.

Nothing was deleted or rewritten. Check-Ins still:

- load from `trade_checkins`;
- attach to each private Trade;
- appear in Trade monitoring/current state/history;
- feed the linked Debrief’s Evolution context;
- appear in Trade Markdown exports;
- remain available to lifecycle analytics.

Journal’s empty state now says that completed Trade debriefs and personal lessons appear there, while Check-Ins remain with each Trade.

The Overview Catalyst reference test freezes time at `2026-08-13T12:00:00Z` and restores real timers after the test. This prevents its synthetic August 14 Catalyst from becoming historical as wall-clock time advances.

## C. Tour architecture

The implementation uses a small reusable model/controller rather than a page-specific script:

- `features/tour/product-tour.ts` owns versioned state, the 11 semantic steps, copy, route, target ID, and preference merge helpers.
- `components/ProductTour.tsx` owns invitation, navigation, bounded target discovery, highlighting, callout placement, keyboard behavior, and mobile adaptation.
- `App.tsx` is the lifecycle/persistence owner. It decides when first-use consent appears, persists progress, opens the active tour, and preserves authenticated route boundaries.
- Pages expose stable `data-tour-id` targets. No step depends on DOM order or generated class names.

Each step navigates directly to a canonical hash route. The War Room step deep-links the first accessible Catalyst when one exists. Target lookup retries 12 times at 80 ms intervals after route rendering, scrolls a found target into view, and remeasures on scroll/resize. A missing example produces a centered explanatory callout; it never creates demo data or blocks progress.

The Tour component imports no domain actions, collaboration actions, provider code, Supabase client, research save function, or Trade-record function. Only `App.tsx` saves non-sensitive preference progress.

## D. Tour flow

| Step | Route | Target | Teaching point |
|---|---|---|---|
| 1. Welcome | `/` | Overview shell | Catalyst → Idea → Candidate → Trade → monitoring → reflection; no brokerage. |
| 2. Risk | `/` | Overview metrics | OJ capacity is a deliberate policy, not cash, margin, or buying power. |
| 3. Catalysts | `/catalysts` | Calendar | Start from scheduled facts and affected securities. |
| 4. War Room | `/catalysts?catalyst=…` | War Room | Evidence, missions, forecasts, and Intelligence without a provider call or record creation. |
| 5. Ideas | `/ideas` | Ideas shell | Shared facts, separate/private conclusions. |
| 6. Candidate | `/ideas` | Populated Idea list | Candidate is planned defined-risk research, not an order or fill. |
| 7. Record Trade | `/trades` | Record Trade action | Record actual execution manually only after an external fill. |
| 8. Monitoring | `/trades` | Active/closed Trade region | Check-Ins belong to Trade history, not Journal. |
| 9. Journal | `/journal` | Debrief surface | Reflect without rewriting facts or the original plan. |
| 10. Insights | `/insights` | Insights shell | Interpret confirmed history and small samples carefully. |
| 11. Finish | `/settings` | Guidance | Finish, resume, or replay from Settings. |

Populated accounts receive anchored context. Empty accounts retain route-level targets; example-dependent Candidate and War Room steps use the explicit centered fallback. The user can Back, Next, Pause, Finish, or press Escape at any point. Tour actions never open a data-entry form or activate a provider.

## E. Mobile behavior

- The controller navigates by route, not by bottom-navigation index.
- Tests cover shortcut sets: Overview/Catalysts/Ideas/Trades; Overview/Journal/Insights/Trades; and Catalysts/Ideas/Journal/Insights.
- A destination may be a shortcut or hidden in More; the Tour reaches it the same way.
- Desktop uses an anchored, translucent callout and highlighted target.
- At 700 px and below the callout becomes a safe-area-aware bottom sheet; target highlighting remains independent.
- At 360 px and below controls and invitation actions reflow without horizontal overflow.
- Callout height is viewport-bounded and internally scrollable.

Required live viewports remain on the acceptance checklist: 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 375×667, and 320×568.

## F. Persistence

No migration is required. Phase 9 stores:

```json
{
  "productTour": {
    "version": 1,
    "status": "in_progress",
    "step": 4,
    "updatedAt": "2026-08-15T12:00:00.000Z"
  }
}
```

inside `application_preferences.data`. Valid states are `not_started`, `in_progress`, `skipped`, and `completed`. `PRODUCT_TOUR_VERSION = 1`. An absent or older version becomes first-use again. Take Tour, Skip for Now, every step transition, Pause, and Finish use the existing optimistic preference save. Theme, calendar, compact cards, mobile navigation, and unrelated JSON are preserved.

First-use invitation appears only for an approved authenticated non-demo user with current-version `not_started`. Skip persists and suppresses repeat prompts. In-progress state resumes from Settings → Guidance. Skipped/completed state offers Take Product Tour for replay.

## G. Accessibility

- First-use invitation is a labeled modal with descriptive text, initial focus, Tab containment, Escape = Skip for Now, and focus restoration.
- Active tour is a labeled non-modal dialog; route content remains available.
- Back, Next, Pause, and Finish have visible text and keyboard focus.
- Left/Right arrows move steps; Escape pauses.
- Left/Right arrows are ignored when the event begins in an input, textarea, select, contenteditable region, or equivalent text-entry role, preserving caret, selection, and chooser behavior.
- Meta/Ctrl/Alt + Left/Right remain available to the browser and operating system.
- Take, Skip, Back, Next, Pause, Finish, and keyboard actions share a synchronous transition lock. A second action is ignored until the preference save settles, and failures release the lock.
- A missing anchor includes explicit explanatory text rather than an invisible position.
- Target focus/measurement updates after route changes and resize/scroll.
- `prefers-reduced-motion` disables tour animation, target transition, progress animation, and smooth scrolling.
- Mobile bottom sheet observes the bottom safe-area inset.

## H. Privacy/security

- No brokerage credentials, connection, order preview, routing, recommendation, or execution.
- No market-data/provider request and no API-credit use during the Tour.
- No Catalyst, Idea, Candidate, Trade, Check-In, Exit, Debrief, Forecast, evidence, mission, snapshot, or collaboration write.
- Preference state contains only version, status, step, and timestamp—no private Trade or research content.
- Route authorization is unchanged; only an approved authenticated user reaches the application/tour.
- Existing owner-scoped RLS remains authoritative.
- Privacy and UI-copy checks pass.

## I. Testing

Local final checks:

- `npm run typecheck` — pass.
- `npm run lint` — pass, zero warnings.
- `npm test` — pass, **54 files / 247 tests**.
- `npm run build` — pass, 1,683 transformed modules.
- `npm run copy:check` — pass.
- `npm run privacy:check` — pass.
- `npm audit --audit-level=high` — pass, 0 vulnerabilities.
- `git diff --check` — pass.

Coverage added for first-use copy; Take/Skip controls; version reset; skipped/completed/in-progress state; Settings replay/resume label; Back/Next/Finish; all route/target mappings; populated and empty accounts; example-dependent fallback; three custom mobile-nav sets; no domain/provider dependencies; responsive/safe-area/reduced-motion CSS; Check-In retention under Trade; Check-In Debrief context; Journal exclusion; Debrief rendering; Journal empty state; and deterministic Overview time. The review addendum adds real DOM/effect coverage for Tour focus; forward/backward arrows; input, textarea, select, and nested contenteditable protection; Meta/Ctrl/Alt modifiers; Escape; cross-input transition locking; post-settlement reuse; failure recovery; and first-use Take/Skip locking.

PR #24 keyboard-safety CI run [`31911374934`](https://github.com/dkyaya/OJ/actions/runs/31911374934) is green:

- OJ Public Validate — success.
- OJ Public Test — success.
- OJ Public Build — success.
- OJ Public Security — success.

GitHub emitted a non-blocking Node.js 20 action-runtime deprecation annotation for `actions/checkout@v4` and `actions/setup-node@v4`; all application steps ran under the configured Node 22 and passed. Updating third-party action majors is outside this review addendum.

Live local browser screenshots were not available: the Work sandbox rejected local listeners with `EPERM`, and browser policy blocked direct `file://` navigation. No visual-run claim is made. The responsive rules and semantic surfaces have render/static integration coverage, but the post-deployment manual matrix below remains required.

## J. Deployment

- Supabase: no schema, RLS, function, Edge Function, or secret change. Do not run the Supabase deployment workflow for Phase 9.
- GitHub Pages: the production build passes locally and in PR CI. Pages deployment is intentionally limited to `main`, so deploy after merge through the normal workflow.
- No public or private journal data is included in the branch or relay.
- After Pages deployment, perform the production checklist before beginning Phase 10.

## K. Production acceptance checklist

- [ ] Existing Check-Ins remain visible under their Trades.
- [ ] Routine Check-Ins do not appear in Journal or its count.
- [ ] Debrief Evolution still summarizes relevant Check-Ins.
- [ ] First-use invitation appears on a reset/test preference state.
- [ ] Take a Tour starts step 1; Skip for Now persists after reload/device change.
- [ ] Pause and Settings Resume return to the saved step.
- [ ] Completion persists; Settings replay starts at step 1.
- [ ] Default and all three custom mobile shortcut sets complete the Tour.
- [ ] Steps work when destinations move between shortcuts and More.
- [ ] Empty and populated accounts complete without mutation.
- [ ] Network inspection shows no provider request/credit use during Tour.
- [ ] Database inspection shows no domain record write during Tour.
- [ ] Desktop: 1440×900, 1280×800, 1024×768.
- [ ] Tablet: 768×1024.
- [ ] Mobile: 430×932, 390×844, 375×667, 320×568.
- [ ] Keyboard, Escape, focus order, and reduced-motion behavior pass.
- [ ] Arrow keys in route inputs, textareas, selects, and contenteditable regions do not move the Tour; Meta/Ctrl/Alt + Arrow remains native.
- [ ] Rapid button/keyboard attempts create only one Tour preference transition, and controls recover after a simulated save failure.
- [ ] Production Pages workflow is green at merged `main`.

## L. Git

- Branch: `feature/phase-9-product-tour`
- Base: `main`
- Draft PR: [#24](https://github.com/dkyaya/OJ/pull/24), merge state clean at relay packaging.
- Phase 9 commits:
  - `7a1e01f873a9b0afd192090cee62d8f0453d74d6` — Separate Trade check-ins from Journal
  - `706cd08dbe340cdc68471c0da3599dcd53bdeddc` — Build versioned product tour foundation
  - `a742e5c8ab19a65ec23aebf88c3fce88a2b060b7` — Add adaptive cross-route tour targets
  - `d77072e81de9b6889b3171ad772bb25ee4cfe236` — Harden product tour keyboard transitions
- Pre-Phase-9 repair now merged through PR #23:
  - `25e5203a49b6b9a070038724f638f96a5ac8ce47` — Stabilize Overview catalyst test clock
- User-owned untracked historical relay files were not staged or changed.
- No merge or auto-merge was performed.

## M. Blockers / uncertainties

- Live browser QA and screenshots could not be produced inside this Work sandbox because local HTTP listeners and local-file browser navigation are blocked. Production acceptance is therefore explicitly pending.
- The production Pages workflow runs only from `main`; it cannot prove the final deployed tour until the user merges PR #24.
- Vite retains its existing advisory for a JavaScript chunk above 500 kB (about 751 kB minified / 204 kB gzip). Phase 9 does not materially change that architecture and does not expand scope into code splitting.

No implementation, database, authentication, privacy, or CI blocker remains.

## N. Recommendation for P10

Do not begin P10 yet. Mark PR #24 ready only after reviewing this relay, then merge and run the normal Pages deployment. Complete the checklist in section K—especially the eight viewport sizes, custom mobile navigation, no-provider/no-domain-write checks, and empty-account fallback. If those pass, Phase 9 is ready to close and P10 can begin as a separate scoped branch. Do not fold contextual guidance or spread-efficiency work into PR #24.

STOP.
