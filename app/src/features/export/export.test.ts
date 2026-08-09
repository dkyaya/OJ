import { describe, expect, it } from 'vitest';
import { catalystMarkdown, journalExportFiles, tradeMarkdown } from './markdown';
import { createZip } from './zip';
import { demoWorkspace } from '../../data/demo';

describe('Markdown portability', () => {
  it('preserves status and TBD fields in a trade export', () => { const markdown = tradeMarkdown(demoWorkspace.ideas[1]); expect(markdown).toContain('status: "deferred"'); expect(markdown).toContain('Not entered.'); expect(markdown).toContain('TBD'); });
  it('exports catalyst metadata and links', () => { const markdown = catalystMarkdown(demoWorkspace.catalysts[0]); expect(markdown).toContain('record_type: catalyst'); expect(markdown).toContain('DEMO'); });
  it('builds an Obsidian-friendly journal tree', () => { const files = journalExportFiles(demoWorkspace); expect(Object.keys(files).some((name) => name.startsWith('Trade Ideas/'))).toBe(true); expect(Object.keys(files).some((name) => name.startsWith('Catalysts/'))).toBe(true); expect(Object.keys(files)).toContain('Dashboard.md'); expect(Object.keys(files)).toContain('Journal/Journal Index.md'); expect(Object.keys(files)).toContain('Research/Account Policy.md'); });
  it('produces a valid ZIP container signature', () => { const zip = createZip({ 'README.md': '# Export' }); expect(Array.from(zip.slice(0, 4))).toEqual([0x50,0x4b,0x03,0x04]); });
});
