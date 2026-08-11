import { describe, expect, it } from 'vitest';
import { normalizePath, primaryNavigation } from './navigation';

describe('primary navigation', () => {
  it('contains exactly the six product sections', () => expect(primaryNavigation.map((item) => item.label)).toEqual(['Overview','Catalysts','Ideas','Trades','Journal','Insights']));
  it('provides a direct subtitle for every section', () => primaryNavigation.forEach((item) => expect(item.subtitle.split(/\s+/).length).toBeLessThanOrEqual(8)));
  it('maps legacy bookmarks to the new architecture', () => {
    expect(normalizePath('#/trade-ideas').path).toBe('/ideas'); expect(normalizePath('#/active-trades').path).toBe('/trades'); expect(normalizePath('#/analytics').path).toBe('/insights');
  });
  it('keeps Workspace secondary but directly routable', () => {
    expect(primaryNavigation.map((item) => String(item.path))).not.toContain('/workspace');
    expect(normalizePath('#/workspace').path).toBe('/workspace');
  });
});
