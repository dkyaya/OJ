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
