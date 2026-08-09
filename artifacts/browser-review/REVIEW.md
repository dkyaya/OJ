# Browser review — 2026-08-04

## Scope

The Supabase-enabled local preview was run with the production browser-safe URL/key. Reviewed the loading screen, overview, mobile navigation, month/week/day catalyst calendar, privacy settings, cloud sign-in boundary, local draft autosave, saved-draft recovery, submission gate, emergency packet, and responsive new-trade modal. No brokerage or external account was accessed.

## Viewports

- 1440 × 900
- 1280 × 800
- 1024 × 768
- 430 × 932
- 390 × 844
- 375 × 667

At every size, measured loading container and visual-group centers matched the viewport center exactly; horizontal offset was `0px`. Reduced-motion CSS retains the same fixed flex centering while disabling the animations.

## Interaction findings

- IndexedDB autosave produced a visible **Saved locally** draft after the debounce.
- Without Auth, cloud sync retained the local copy, explained that sign-in is required, and kept **Submit for formalization** disabled.
- The emergency packet included cloud record ID plus empty cloud-revision/job receipt fields.
- Every desktop route is in the sidebar; every route and **New trade idea** are available through the mobile floating menu.
- Calendar opens in Month, Week and Day are usable, event drill-down works, and empty days now say **No scheduled catalysts**.
- Settings visibly explains public/static, authenticated-cloud, brokerage, and manual-merge boundaries.
- Browser console finished with zero warnings/errors.

## Defects corrected during review

1. Mobile cloud and theme controls overlapped. Added mobile header spacing.
2. Mobile menu trigger lacked an accessible name. Added open/close names and expanded state.
3. Empty Day calendar rendered blank. Added explicit empty-state text.
4. Floating mobile menu sat above the new-trade modal. Raised modal stacking so its actions cannot be obstructed.

## Evidence

- `loading-{width}x{height}.png` and `overview-{width}x{height}.png` for all required viewports
- `overview-430x932-fixed.png`
- `calendar-month-430x932.png`
- `settings-430x932.png`
- `new-trade-390x844-fixed.png`

## Limitations / production follow-up

No Supabase Auth user existed during this pass, so sending a magic link, allowlist rejection/approval, two-device authenticated hydration, live formalization dispatch, PR receipt, and published reconciliation were not exercised in the browser. They require the owner’s first sign-in and approval after this pull request is manually merged/deployed. Production Pages remains on the previous main build until that merge.
