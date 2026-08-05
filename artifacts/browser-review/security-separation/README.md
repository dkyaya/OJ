# Public-safe responsive browser review

Executed with the controller browser against the local production-shaped OJ frontend on 2026-08-05. All screenshots contain only the signed-out empty shell or a device-local synthetic blank form.

## Viewport matrix

| Viewport | Loading artwork centered | Horizontal overflow | Desktop sidebar | Mobile navigation |
| --- | --- | --- | --- | --- |
| 1440 × 900 | exact X center (720 px) | none | visible | not required |
| 1280 × 800 | exact X center (640 px) | none | visible | not required |
| 1024 × 768 | exact X center (512 px) | none | visible | not required |
| 768 × 1024 | exact X center (384 px) | none | hidden | available |
| 430 × 932 | exact X center (215 px) | none | hidden | available |
| 390 × 844 | exact X center (195 px) | none | hidden | available |
| 375 × 667 | exact X center (187.5 px) | none | hidden | available |
| 320 × 568 | exact X center (160 px) | none | hidden | available |

Both the 104 px loading mark and its status text shared the viewport's exact horizontal center at every size. The fixed overlay covered the whole viewport and did not inherit a sidebar offset.

## Interactive results

- The mobile drawer exposed Overview, Trade ideas, Active, Closed, Research, Calendar, Analytics, Journal, Settings, and New trade idea.
- New trade idea opened its five-step local-first dialog at 320 × 568.
- Calendar opened in Month view and switched to Week and Day views.
- The month grid stayed compact; each day reserves a bounded event area and supports a `+N more` summary.
- Signed-out account data remained explicitly private and no former exact account values appeared in the DOM.
- No viewport produced horizontal document overflow.

## Evidence files

- `signed-out-overview-<viewport>.png` for all eight requested sizes
- `loading-centered-1440x900.png` and `loading-centered-390x844.png`
- `mobile-menu-320x568.png`
- `new-trade-320x568.png`
- `calendar-month-1440x900.png`
- `calendar-month-320x568.png`
- `calendar-week-320x568.png`
- `calendar-day-320x568.png`

## Remaining authenticated evidence gate

An approved synthetic owner browser session was not invented or substituted. Signed-in cross-device, conflict, submission, private-PR, and published-state screenshots remain gated on the dedicated GitHub App credentials and a harmless approved `TEST` account lifecycle. Component, storage, public-bundle, RLS, and transactional database tests passed independently, but those are not represented here as browser evidence.
