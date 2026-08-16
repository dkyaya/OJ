# Phase 9.1 Real-UI Reuse Plan

This review plan records the production-surface audit performed before the Phase 9.1 real-UI repair. The goal is a small adapter seam around existing controls, not a second form system and not a global application rewrite.

## Audit

| Product surface | Current production location | Coupling found | Minimal reuse seam |
| --- | --- | --- | --- |
| Catalyst creation | `pages/CatalystsPage.tsx` | Form markup, state, and `saveCatalystRecord` live together. | Extract a controlled `CatalystEditor`; production supplies the Supabase action wrapper and Tutorial supplies its in-memory adapter. |
| Catalyst detail / War Room | `components/CatalystWarRoom.tsx` | Composes collaboration, forecasting, evidence, debrief, and Intelligence actions. | Do not reproduce or tutorialize collaboration. Reuse its Catalyst Intelligence component directly and retain the same Catalyst metadata language. |
| Catalyst Intelligence | `components/CatalystIntelligence.tsx` | Presentation, calculations, snapshot writes, and provider loaders live together. | Keep one `CatalystIntelligence` presentation; inject a narrow action/fixture adapter. Production defaults to canonical actions. Tutorial receives bundled contracts and in-memory review action with providers disabled. |
| Idea Setup / Catalyst / Research / Candidate | `components/Workflow.tsx` | Canonical field rendering is mixed with local drafts and cloud synchronization. | Extract controlled `IdeaEditorSurface` using `IDEA_SECTIONS` and `visibleFields`. Production `Workflow` retains draft/cloud orchestration; Tutorial renders the same surface with in-memory save handlers. Candidate remains section four of this shared editor. |
| Record Trade | `pages/TradesPage.tsx` | Private `RecordTradeForm` calls `recordEntry` directly. | Extract controlled `RecordTradeEditor`. Production passes `recordEntry`; Tutorial passes `recordTutorialTrade`. Both use `tradeEntryDraft` and `validateTradeEntry`. |
| Trade Check-In | `pages/TradesPage.tsx` | Private form calls `saveTradeCheckin` directly. | Extract `TradeCheckinEditor`; production and Tutorial provide different save adapters. |
| Exit | `pages/TradesPage.tsx` | Private form calls `recordTradeExit` directly. | Extract `TradeExitEditor`; both modes share lifecycle math and controls. |
| Trade detail | `pages/TradesPage.tsx` | Presentation is mixed with production navigation and action opening. | Extract a shared `TradeDetailSurface`; production composes navigation/actions while Guided uses the same facts, plan, monitoring, and history presentation. |
| Debrief | `pages/JournalPage.tsx` | Form and `saveJournalReview` are coupled. | Extract controlled `DebriefEditor` plus shared `DebriefContext`; production supplies the journal action and Tutorial supplies `saveTutorialDebrief`. |
| Insights | `pages/InsightsPage.tsx` | Read-only and already accepts a `Workspace`. | Reuse `InsightsPage` directly with a Tutorial-derived read-only Workspace view. It never receives the real Workspace or a mutation handler. |

## Adapter boundary

The Guided orchestrator retains only stage/progress, instructions, gating, Tutorial labels, and `TutorialWorkspace`. A pure `tutorial-ui-adapter` converts the in-memory objects into the existing read-only domain shapes required by shared production surfaces. It imports domain types and pure utilities only.

Production action wrappers remain in production pages/components and import Supabase-backed actions. Shared editor surfaces and Tutorial adapters do not import:

- `data/actions`;
- `data/collaboration-actions`;
- `lib/supabase`;
- provider loaders;
- `fetch`.

This produces one UI with two explicit action adapters:

```text
shared editor / presentation
├── production wrapper → canonical action
└── Guided orchestrator → TutorialWorkspace action
```

No migration, canonical tutorial row, provider request, broker action, or Phase 10 guidance system is needed.

## Placement repair

The placement contract will return only a non-overlapping rectangle when a target exists. Natural-size anchored candidates run first; detached candidates and reduced-height scrollable regions follow. If the viewport does not currently expose a usable region, the controller will scroll the target toward a safe edge and remeasure rather than accept overlap. The previous least-overlap fallback will be removed.
