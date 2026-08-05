import type { Draft } from '../storage/drafts';

const escapeLine = (value: string) => value.replace(/\r?\n/g, ' ').trim() || 'TBD';

export function packet(draft: Draft) {
  const rows = Object.entries(draft.data)
    .map(([key, value]) => `- ${key}: ${escapeLine(value)}`)
    .join('\n');
  return `# OJ Work Update Packet

## Metadata

- Packet type: ${draft.kind}
- Generated at: ${draft.updatedAt}
- Cloud record ID: ${draft.id}
- Cloud revision: ${draft.cloudRevision ?? 'Not synchronized'}
- Formalization job ID: ${draft.formalizationJobId ?? 'Not submitted'}
- Requested action: Resume this private cloud draft; submit only through the private canonical-journal PR workflow.
- Local sync state: ${draft.sync}
- Safety: No brokerage access or credentials involved.

## Record

${rows}

## Missing information

- Any field marked TBD requires user-provided confirmation.

## Requested repository updates

- Update the canonical Obsidian Markdown record.
- Regenerate validated public data and deploy.
`;
}
