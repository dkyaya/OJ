import { describe, expect, it } from 'vitest';
import { catalystMarkdown, journalExportFiles, tradeMarkdown } from './markdown';
import { createZip } from './zip';
import { demoWorkspace } from '../../data/demo';

describe('Markdown portability', () => {
  it('preserves research stage, exposure, and TBD fields in a trade export', () => { const markdown = tradeMarkdown(demoWorkspace.ideas[1]); expect(markdown).toContain('status: "deferred"'); expect(markdown).toContain('research_stage: "parked"'); expect(markdown).toContain('exposure_tags:'); expect(markdown).toContain('Not entered.'); expect(markdown).toContain('TBD'); });
  it('exports the Catalyst brief and linked securities', () => { const markdown = catalystMarkdown(demoWorkspace.catalysts[0]); expect(markdown).toContain('record_type: catalyst'); expect(markdown).toContain('date_certainty: "confirmed"'); expect(markdown).toContain('## Expectations'); expect(markdown).toContain('DEMO'); });
  it('builds an Obsidian-friendly journal tree with provenance and snapshots', () => { const files = journalExportFiles(demoWorkspace); expect(Object.keys(files).some((name) => name.startsWith('Trade Ideas/'))).toBe(true); expect(Object.keys(files).some((name) => name.startsWith('Catalysts/'))).toBe(true); expect(Object.keys(files)).toContain('Dashboard.md'); expect(Object.keys(files)).toContain('Journal/Journal Index.md'); expect(Object.keys(files)).toContain('Research/Account Policy.md'); expect(files['Research/Sources.md']).toContain('Synthetic schedule source'); expect(files['Research/Snapshots.md']).toContain('event_implied_move'); });
  it('keeps archived ideas and candidates in a separate export folder', () => { const archived = { ...demoWorkspace.ideas[0], archivedAt: '2026-08-10T12:00:00Z' }; const files = journalExportFiles({ ...demoWorkspace, ideas: demoWorkspace.ideas.slice(1), archivedIdeas: [archived] }); const name = Object.keys(files).find((item) => item.startsWith('Archived Ideas/')); expect(name).toBeTruthy(); expect(files[name!]).toContain('### Candidate'); expect(files[name!]).not.toContain('### Balanced'); expect(files['Dashboard.md']).toContain('Archived ideas: 1'); });
  it('produces a valid ZIP container signature', () => { const zip = createZip({ 'README.md': '# Export' }); expect(Array.from(zip.slice(0, 4))).toEqual([0x50,0x4b,0x03,0x04]); });
});
