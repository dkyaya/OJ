## Summary

Refines OJ’s Catalyst → Idea → Candidate → Trade → Monitoring → Exit → Debrief loop for real manual use while preserving its research-journal boundary.

## What changed

- adds **Record Trade** from qualified Ideas with Candidate and research prepopulation;
- preserves planned Candidate values separately from actual execution;
- stores a compact immutable entry-context snapshot with Catalyst, Research Snapshot, and locked Forecast references;
- derives and validates actual debit-vertical economics;
- surfaces policy-backed open maximum loss, remaining OJ capacity, and informational exposure concentration;
- adds user-authored Thesis Health and append-only Trade Check-Ins;
- adds full Exit recording, realized P/L, and direct Trade-to-Debrief continuity;
- expands Obsidian-friendly Markdown exports and adds a focused Insights foundation;
- introduces additive RLS-safe migration/RPC protection and synthetic two-user SQL checks;
- patches a transitive high-severity `nanoid` advisory.

OJ remains manual and brokerage-independent: no execution, account aggregation, automatic sizing, signals, or Robinhood access.

## Validation

- TypeScript: pass
- ESLint: pass, zero warnings
- Vitest: 49 files / 218 tests passed
- Production build: pass
- Copy check: pass
- Privacy scan: pass
- Dependency audit after patch: 0 vulnerabilities
- Diff check: pass

The migration SQL tests are included but require a trusted Postgres/Supabase test session. Local rendered QA was unavailable because this sandbox forbids local port binding; complete the relay’s exact desktop/mobile acceptance checklist before marking ready.

## Deployment order

1. Review and merge only with owner approval.
2. Run the Supabase workflow to apply `20260813201443_phase_8_6_research_to_trade_lifecycle.sql`.
3. Run the structural and rolled-back two-user SQL tests in a trusted test session.
4. Confirm advisors/migration ledger.
5. Deploy the matching Pages frontend.

The production risk policy already stores the deliberate `$800` ceiling; no policy mutation is included.
