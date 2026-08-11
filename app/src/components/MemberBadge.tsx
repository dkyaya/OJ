import type { WorkspaceMember } from '../types/domain';

export function MemberBadge({ member, initials: providedInitials, name: providedName, prefix, compact = false }: { member?: WorkspaceMember; initials?: string; name?: string; prefix?: string; compact?: boolean }) {
  const initials = providedInitials || member?.initials || 'OJ';
  const name = providedName || member?.displayName || 'Member';
  return <span className={`member-badge${compact ? ' compact' : ''}`}><span aria-hidden="true">{initials.slice(0, 4)}</span><b>{prefix ? `${prefix} ${name}` : name}</b></span>;
}
