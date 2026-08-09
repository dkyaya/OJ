import type { Draft } from '../storage/drafts';

const escapeLine = (value: string) => value.replace(/\r?\n/g, ' ').trim() || 'TBD';

export function packet(draft: Draft) {
  const rows = Object.entries(draft.data).map(([key, value]) => `- ${key}: ${escapeLine(value)}`).join('\n');
  return `# OJ Work Update Packet

## Metadata

- Record type: ${draft.kind}
- Generated at: ${draft.updatedAt}
- Record ID: ${draft.id}
- Supabase revision: ${draft.cloudRevision ?? 'Not synchronized'}
- Cache state: ${draft.sync}
- Safety: No brokerage access or credentials involved.

## Record

${rows}

## Recovery

- Resume the local draft or save it directly to the canonical Supabase record.
- Fields marked TBD require user-provided confirmation.
- Markdown export is optional and never overrides Supabase automatically.
`;
}
