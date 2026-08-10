# Invite activation production test

Date: 2026-08-09

Status: awaiting repaired frontend merge and scanner-safe hosted template cutover.

## Protected starting state

- Auth users: 1
- Profiles: 1
- Active approved owners: 1
- Account invitations: 0
- Trade ideas: 3
- Trade candidates: 5
- Catalysts: 8
- Confirmed trades, entries, and exits: 0

The relay expected two ideas, but production contained three at the start of this repair. The additional owner record is treated as legitimate private data and is not changed.

## Pre-deployment validation

- `npm ci`, copy check, lint, typecheck, production build, and privacy scan passed.
- 47 of 47 frontend tests passed, including local-session clearing order, local-only sign-out, exact invite OTP parameters, identity mismatch rejection, scanner-safe template content, inert repeated activation routing, account cache isolation, password/reset regression, canonical loading, export, loading, navigation, and trade calculations.
- The live rolled-back invite activation/gating SQL suite passed valid, uninvited, revoked, and expired invitation behavior.
- The live rolled-back canonical two-user RLS/lifecycle suite passed.
- The portable live rolled-back structural RLS suite passed ownership policies, invite-table privacy, activation RPC security-definer/search-path configuration, and role grants.
- Draft PR #5 public build, test, validate, and security jobs passed.
- Final aggregate recount after all rolled-back tests remained 1 Auth user, 1 profile, 1 active approved owner, 0 invitations, 3 ideas, 5 candidates, 8 catalysts, 1 policy, and 0 trades/entries/exits.

No backend configuration was changed before frontend deployment. The current hosted invite template and Edge Function remain on the prior production version until the user merges PR #5.

The local web server could not bind a loopback port in the managed Work sandbox, and the repaired Pages bundle does not exist until merge. The eight-viewport browser matrix therefore remains a post-deployment gate rather than a claimed result.

## Required evidence after deployment

- Repeated GET navigation to the activation URL does not call `/verify` or change invitation/profile state.
- Manual code verification establishes the temporary invited identity after clearing only the local owner session.
- Temporary member sees none of the owner's ideas, candidates, catalysts, policy, positions, or journal records.
- A synthetic `TEST` draft persists for the member across two isolated sessions and is invisible to the owner.
- Local member logout leaves the other member session and owner sessions active.
- Valid flow logs contain no expired-link or valid-invitation-required failure.
- Temporary record, invitation, profile, and Auth identity are removed safely.
- Final production state returns to one owner, one profile, and zero invitations.

No real invitation code, password, token, email address, or private journal payload belongs in this artifact.
