# Card Hierarchy

OJ uses progressive disclosure instead of page-specific card variants.

1. **Summary Card** — identity, one status, one important metric, compact metadata, and at most one action.
2. **Metric Card** — one portfolio or workflow number with a short definition.
3. **Expandable Panel** — thesis, conditions, evidence, candidate comparison, or other secondary detail.
4. **Full Editor** — focused creation or update workflow with validation and save state.

Cards must remain legible at 320 CSS pixels, support natural text wrapping, preserve visible keyboard focus, and use escaped React text. Mobile editors and navigation sheets use the full available width with safe-area padding. Dense tables are replaced by a grid or agenda at narrow widths.

Do not put a full thesis, all Greeks, every catalyst field, and multiple competing actions into a summary card. Missing values render as `TBD` or a direct empty state.

Workspace attribution uses compact initials plus a display name. Evidence and viewpoint cards surface author, classification selected by that author, and verification/lock state. They do not display account or position data. The Catalyst War Room uses section tabs—Summary, Evidence, Mission, Forecasts, and Debrief—to avoid one long dense card.
