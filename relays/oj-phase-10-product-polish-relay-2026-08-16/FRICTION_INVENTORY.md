# Phase 10 Friction Inventory

| Page/area | Severity | Problem | Repair | Before → after |
| --- | --- | --- | --- | --- |
| Global | P1 | Loose spacing and equally weighted cards caused unnecessary scrolling. | Added a bounded responsive density layer and explicit hierarchy. | Long repetitive rhythm → compact summaries with deep detail preserved. |
| Initial load | P1 | Most routes and Guided/Workflow code shipped eagerly. | Added route/overlay lazy loading and vendor chunks. | One 786.85 kB main bundle → 532.80 kB preloaded graph plus route chunks. |
| Settings / Product Tour | P1 | Completed Guided state exposed Replay plus redundant Restart; labels blurred start/resume/replay. | Added lifecycle-specific labels and completed-state action cleanup. | Ambiguous duplicate choices → one correct completed action; Resume/Restart only when unfinished. |
| Idea editor / archive | P1 | A shared revision trigger referenced an Idea-only field on Candidate rows and blocked protected restore. | Added a narrow row-shape-safe trigger migration that honors protected archive context. | Candidate update error / restore conflict → rollback-tested edit and archive lifecycle. |
| SQL validation | P1 | Old synthetic fixtures and PL/pgSQL variable names no longer tested the intended schema reliably. | Qualified/renamed ambiguous variables and updated fixtures to canonical provenance fields. | False failures/ambiguous predicates → green explicit structural/lifecycle suites. |
| Workspace Access | P2 | Shared versus private boundaries required too much prior knowledge. | Added paired Shared research / Always personal summaries and safer invite confirmation. | Generic role copy → self-contained collaboration boundary. |
| Preferences | P2 | Saved compact-card preference had no visual effect. | Propagated preference to shell density and excluded complex surfaces. | Stored-only toggle → visible reusable-card density choice. |
| Ideas | P2 | Summary cards hid Catalyst and candidate availability. | Added primary Catalyst and candidate count. | Open details for orientation → key research context visible in list. |
| Trades | P2 | Daily summaries omitted thesis health, next Catalyst, and expiry. | Added tested card-presentation helper and summary facts. | Position identity only → next decision context visible. |
| Overview | P2 | Active Trade overview omitted expiry. | Added expiration to summary metadata. | Risk snapshot only → risk plus time boundary. |
| Journal | P2 | Full reflections made list scanning dense and repeated linked context. | Added preview plus one disclosure panel. | Full text always expanded → concise scan with complete content one action away. |
| Repo hygiene | P2 | TypeScript incremental build output was tracked. | Removed it from tracking and ignored it. | Routine build dirtied worktree → generated output stays local. |
| Visual acceptance | P3 | Phase 10 could not be rendered locally inside the sandbox. | Preserved honest baseline observations and added post-deploy checklist. | No false claim → explicit manual production gate. |
| Real invite drill | P3 | A real friend should not be used as a test identity. | Supplied disposable-member acceptance and cleanup checklist. | Risky ad-hoc invite → bounded test before real onboarding. |

No P0 issue was found. All P1 and P2 issues are resolved in the branch.
