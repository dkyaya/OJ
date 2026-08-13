# Phase 8.6 validation record

## Successful checks

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass; zero warnings |
| `npm test -- --run` | Pass; 49 files, 218 tests |
| `npm run build` | Pass; 1,679 modules |
| `npm run copy:check` | Pass |
| `npm run privacy:check` | Pass |
| `git diff --check` | Pass for the full branch; mail-format patch bodies use the repository’s `-whitespace` attribute and five-patch `git am` replay also passes |
| `npm audit fix` / patched lock | Pass; 0 vulnerabilities, `nanoid` 3.3.18 |

## Warnings and unavailable checks

- Vite reports one chunk above its 500 kB advisory threshold: about 737 kB minified / 199 kB gzip.
- The final repeated online audit query could not resolve the npm endpoint. The earlier audit completed successfully after the lockfile patch and the installed/locked patched version was verified.
- SQL structural and synthetic three-user files were updated and statically reviewed but not executed. The environment has no Supabase CLI, Postgres, Docker, or development branch, and production was not used for synthetic test fixtures. The production migration ledger was rechecked and correctly remains at Phase 8.5.1.
- Local visual rendering was unavailable. Binding `127.0.0.1:5173` returned `EPERM`; browser policy blocked `file://`. No rendered QA claim is made.
- Main/Phase 8.5.1 CI and Supabase deployment were successful at the baseline SHA. Phase 8.6 CI has not run because remote publishing is blocked.
