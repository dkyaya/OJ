# Production Acceptance

Do this after the PR is merged and both deployment workflows complete. Use synthetic records and a disposable second account—not the real friend—until every item passes.

## Polish and responsive review

- [ ] Confirm the Supabase migration `20260816143000_phase_10_revision_trigger_repair.sql` is listed as deployed.
- [ ] Confirm GitHub Pages serves the Phase 10 commit at `/OJ/`.
- [ ] Test dark and light themes at 1440×900, 1280×800, 1024×768, 768×1024, 430×932, 390×844, 375×667, and 320×568.
- [ ] Confirm no horizontal page pan, clipped controls, overlapping liquid navigation, or persistent right-side scrollbar.
- [ ] Confirm Overview, Catalysts/Intelligence, Ideas, Trades, Journal, Insights, Workspace, and Settings establish a useful first viewport.
- [ ] Toggle compact summary cards, save, reload, and confirm density changes without compressing the calendar, forms, expandable detail, or Intelligence controls.
- [ ] Confirm completed Quick Tour shows Replay only.
- [ ] Confirm never-started Guided shows Start only; paused shows Resume + Restart; completed shows Replay only.
- [ ] Confirm reduced-motion and keyboard navigation remain usable.
- [ ] Confirm installable PWA assets and offline navigation fallback remain available under `/OJ/`.

## Disposable two-person shared-use drill

- [ ] Owner creates or selects a synthetic workspace.
- [ ] Owner invites a disposable `.invalid`/controlled test identity through the supported activation path.
- [ ] Member activates and signs in without owner coaching.
- [ ] Member can see the deliberately shared workspace Catalyst/evidence/mission/question.
- [ ] Member creates a private Idea linked to the shared Catalyst.
- [ ] Owner cannot see the member's private Idea or candidate.
- [ ] Member creates a private Forecast; owner cannot see it unless explicitly shared.
- [ ] Member records a synthetic private Trade after manual-fill confirmation.
- [ ] Owner cannot see member account values, risk, Trade, fill, check-in, exit, debrief, or Journal.
- [ ] Non-member cannot access or create against shared workspace facts.
- [ ] Owner removes member.
- [ ] Removed member loses future workspace access.
- [ ] Existing member-owned private history and recorded provenance remain intact.

## Idea/archive regression

- [ ] Edit an unentered synthetic Idea and its Candidate successfully.
- [ ] Archive the Idea.
- [ ] Restore the Idea.
- [ ] Confirm stale-revision protection still reports the cross-device conflict.
- [ ] Permanently delete only an archived, history-free synthetic Idea with exact confirmation.

## Cleanup

- [ ] Delete synthetic workspace research through supported owner actions.
- [ ] Remove the disposable member and any pending invites.
- [ ] Delete disposable auth/profile records through the trusted admin path.
- [ ] Confirm no synthetic Trade or journal data remains.
- [ ] Confirm no screenshots or logs contain real private data.

## Rollback path

If UI polish regresses, revert the Phase 10 application commit and redeploy Pages. If the trigger migration causes an unexpected editor/archive regression, stop writes and deploy a forward migration restoring the prior function body; do not rewrite migration history. The migration changes only one trigger function and does not alter tables or RLS policies.
