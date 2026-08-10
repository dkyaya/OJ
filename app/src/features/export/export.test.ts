import { describe, expect, it } from 'vitest';
import { catalystMarkdown, journalExportFiles, tradeMarkdown } from './markdown';
import { createZip } from './zip';
import { demoWorkspace } from '../../data/demo';

describe('Markdown portability', () => {
  it('preserves status and TBD fields in a trade export', () => { const markdown = tradeMarkdown(demoWorkspace.ideas[1]); expect(markdown).toContain('status: "deferred"'); expect(markdown).toContain('Not entered.'); expect(markdown).toContain('TBD'); });
  it('exports catalyst metadata and links', () => { const markdown = catalystMarkdown(demoWorkspace.catalysts[0]); expect(markdown).toContain('record_type: catalyst'); expect(markdown).toContain('DEMO'); });
  it('builds an Obsidian-friendly journal tree', () => { const files = journalExportFiles(demoWorkspace); expect(Object.keys(files).some((name) => name.startsWith('Trade Ideas/'))).toBe(true); expect(Object.keys(files).some((name) => name.startsWith('Catalysts/'))).toBe(true); expect(Object.keys(files)).toContain('Dashboard.md'); expect(Object.keys(files)).toContain('Journal/Journal Index.md'); expect(Object.keys(files)).toContain('Research/Account Policy.md'); });
  it('keeps archived ideas and candidates in a separate export folder', () => { const archived = { ...demoWorkspace.ideas[0], archivedAt: '2026-08-10T12:00:00Z' }; const files = journalExportFiles({ ...demoWorkspace, ideas: demoWorkspace.ideas.slice(1), archivedIdeas: [archived] }); const name = Object.keys(files).find((item) => item.startsWith('Archived Ideas/')); expect(name).toBeTruthy(); expect(files[name!]).toContain('### Balanced'); expect(files['Dashboard.md']).toContain('Archived ideas: 1'); });
  it('produces a valid ZIP container signature', () => { const zip = createZip({ 'README.md': '# Export' }); expect(Array.from(zip.slice(0, 4))).toEqual([0x50,0x4b,0x03,0x04]); });
});
