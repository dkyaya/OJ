# Invite activation production test

Date: 2026-08-10

Status: scanner-safe invite delivery, manual OTP activation, password sign-in, application activation, and cleanup passed in production. The strict real-member two-browser `TEST`-draft exercise was not completed before cleanup and is not claimed here.

## Protected starting state

- Auth users: 1
- Profiles: 1
- Active approved owners: 1
- Account invitations: 0
- Trade ideas: 3
- Trade candidates: 5
- Catalysts: 8
- Account policies: 1
- Confirmed trades, entries, and exits: 0

The relay expected two ideas, but production contained three before this repair. The additional owner record was treated as legitimate private data and was not changed.

## Production cutover

- PR #5 merged and GitHub Pages deployed the repaired activation form.
- The hosted Invite User template contains a six-digit `{{ .Token }}` and a static `https://dkyaya.github.io/OJ/?auth=activate` action URL.
- The hosted template contains no `ConfirmationURL` or `TokenHash` action.
- Auth OTP length is six digits and Auth/application invitation expiry is one hour.
- `invite-account` Edge Function version 2 is active with JWT verification.
- Gmail custom SMTP delivered the real invitation after the owner supplied a Google App Password.

## Real temporary lifecycle

The temporary address and every credential are intentionally omitted.

1. The approved active owner sent one invitation from Settings → Access.
2. The Edge Function returned HTTP 202 and the email was delivered.
3. The recipient opened the inert activation page, entered the manual code, chose a password, activated, and signed in.
4. Production state confirmed an accepted invitation linked to the invited Auth user, confirmed email, recorded sign-in, approved profile, `member` role, and `active` account status.
5. The accepted invitation, temporary Auth sessions, exact invitation row, Auth identity, and cascading profile were removed in a guarded transaction.

The real run proves the repaired email, OTP, identity verification, password update, activation RPC, and normal password sign-in path. It does not claim that a synthetic member-owned draft was created or that a second simultaneous member browser session was exercised.

## Scanner and session evidence

- Repeated direct navigation to `?auth=activate` rendered Email, Invite Code, New Password, and Confirm Password without calling a token-bearing verification URL.
- Repeated GET navigation left production at zero invitations and one owner.
- The application tests verify that activation clears only the current browser session and current account cache before OTP verification, then requires the resulting session ID and normalized email to match the invited identity.
- The valid production lifecycle produced no `One-time token not found`, `Email link is invalid or has expired`, or `valid invitation required` event.
- Post-cleanup `/user` 403 responses were expected from the now-deleted temporary browser identity and did not affect the owner.

## Isolation evidence

- The live rollback-only canonical two-user RLS/lifecycle suite passed owner/member row isolation.
- Frontend cache tests passed per-user IndexedDB partitioning, local-session clearing, and account switching.
- The real temporary member did not create any canonical record before cleanup, and the database contained no member-owned application rows.
- Direct observation of a real member `TEST` draft across two browser sessions was not performed and remains a strict Phase 5 readiness gate if the relay is interpreted literally.

## Browser review

- The production activation form rendered with the required fields and password-manager autocomplete values.
- Desktop/tablet captures at 1440×900, 1280×800, 1024×768, and 768×1024 had no horizontal overflow.
- The 430×932 capture had no horizontal overflow.
- Stricter scaled 390, 375, and 320 captures exposed a global 320 CSS-pixel document floor. Draft PR #6 removes that floor; production recheck follows its merge/deploy.
- No screenshot contains an email address, invite code, password, token, or private journal record.

## Automated validation

- Clean dependency install completed with zero audit vulnerabilities.
- UI copy check, ESLint, TypeScript, production build, and privacy scan passed.
- 47 of 47 frontend tests passed.
- Live rollback-only invite activation/gating, canonical two-user RLS/lifecycle, and portable RLS/RPC/privacy suites passed before the real lifecycle.

## Final production state

- Auth users: 1
- Profiles: 1
- Active approved owners: 1
- Account invitations: 0
- Trade ideas: 3
- Trade candidates: 5
- Catalysts: 8
- Account policies: 1
- Confirmed trades, entries, and exits: 0

No trade status, fill, position, entry, exit, account policy, or private owner research record changed.

No real invitation code, password, token, email address, user UUID, or private journal payload appears in this artifact.
