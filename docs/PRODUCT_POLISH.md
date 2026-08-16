# Product Polish

OJ's daily-use interface follows a compact, progressive-disclosure system rather than treating every record as a full document.

## Density and hierarchy

- Page headers establish the current task with one title, one short description, and at most one primary action group.
- Summary cards lead with identity and state, then the next decision-relevant fact. Supporting detail follows in quieter metadata.
- Overview and list pages keep compact summaries visible; editors, research detail, and full reflections open only when requested.
- Metrics use small repeatable grids that remain two columns on narrow phones when labels can wrap safely.
- The saved **compact summary cards** preference reduces reusable card padding without compressing calendars, forms, expandable detail, or Catalyst Intelligence controls.

## Action hierarchy

One visually primary action should represent the next normal step. Secondary actions use quieter treatment, and destructive actions stay explicit and separated. Duplicate actions that produce the same state are not shown together. Onboarding labels reflect lifecycle state: Start, Resume, Replay, and Restart are not interchangeable.

## Shared-use copy

Workspace surfaces distinguish **Shared research** from **Always personal** records. Catalysts, evidence, missions, questions, and deliberately shared thesis summaries may be collaborative. Account values, risk policy, private Ideas and forecasts, Trades, fills, and Journal records remain personal. Layout and copy explain this boundary; authorization remains enforced by Supabase RLS and protected functions.

## Performance boundary

Route pages, the Guided Walkthrough, and the Idea Workflow load on demand. React, Supabase, and icon dependencies use stable vendor chunks for browser caching. OJ preserves the GitHub Pages `/OJ/` base and its service-worker registration.

## Review rule

Polish changes should reduce friction that affects comprehension or repeated use. Small visual variation alone is not a reason to add a new abstraction or product phase. Validate representative desktop, tablet, and mobile layouts in both themes before production acceptance.
