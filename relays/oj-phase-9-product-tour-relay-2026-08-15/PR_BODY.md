## What changed

- Separates Trade Check-Ins from Journal while retaining monitoring, Debrief, export, and analytics history.
- Adds a versioned 11-step adaptive product tour with first-use consent, skip, pause, resume, completion, and Settings replay.
- Uses canonical routes and stable semantic targets, independent of customizable mobile shortcuts and More placement.
- Adds empty-account fallback, mobile bottom-sheet behavior, focus/keyboard/reduced-motion support, regression tests, and documentation.
- Reuses `application_preferences.data`; no Supabase migration is needed.

## Product boundary

The tour makes no provider request and no financial/research-domain write. OJ remains brokerage-independent. Candidate remains planned research; Trade remains a manual record of execution performed elsewhere; Check-In remains Trade monitoring; Journal remains Debrief/reflection.

## Validation

- Typecheck, lint, 53 files / 235 tests, build, copy check, privacy check, dependency audit, and diff check pass locally.
- OJ Public Validate, Test, Build, and Security pass on PR #24.
- Live local browser QA was unavailable because the Work sandbox blocks local listeners and local-file browser navigation. The relay retains the eight-viewport production checklist for post-merge verification.
