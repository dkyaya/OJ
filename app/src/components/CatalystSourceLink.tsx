import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { externalReference } from '../lib/external-reference';

export function CatalystSourceLink({ source, children, fallback = 'Source TBD', className = '' }: { source?: string; children?: ReactNode; fallback?: ReactNode; className?: string }) {
  const reference = externalReference(source);
  if (!reference) return <>{children ?? source ?? fallback}</>;
  const accessibleLabel = typeof children === 'string' ? children : reference.label;
  return <a className={`external-reference ${className}`.trim()} href={reference.href} target="_blank" rel="noreferrer" aria-label={`${accessibleLabel} — open official source in a new tab`}>{children ?? reference.label}<ExternalLink size={13} aria-hidden="true" /></a>;
}
