import { describe, expect, it } from 'vitest';
import { catalystHash, catalystIdFromHash, defaultMobileNavigation, normalizeMobileNavigation, normalizePath, primaryNavigation, replaceMobileNavigationShortcut, routeMotionDirection, swipeNavigationTarget } from './navigation';

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
  it('defaults the mobile bar to four shortcuts and repairs invalid saved choices', () => {
    expect(defaultMobileNavigation).toEqual(['/', '/catalysts', '/ideas', '/trades']);
    expect(normalizeMobileNavigation(['/journal', '/insights', '/journal', '/unsafe'])).toEqual(['/journal', '/insights', '/', '/catalysts']);
  });
  it('lets a shortcut selector replace or reorder a slot without duplicates', () => {
    expect(replaceMobileNavigationShortcut(defaultMobileNavigation, 3, '/journal')).toEqual(['/', '/catalysts', '/ideas', '/journal']);
    expect(replaceMobileNavigationShortcut(defaultMobileNavigation, 0, '/ideas')).toEqual(['/ideas', '/catalysts', '/', '/trades']);
  });
  it('deep-links a War Room while keeping Catalysts as the active section', () => {
    const id = '20000000-0000-4000-8000-000000000001';
    expect(catalystHash(id)).toBe(`#/catalysts?catalyst=${id}`);
    expect(catalystIdFromHash(catalystHash(id))).toBe(id);
    expect(normalizePath(catalystHash(id)).path).toBe('/catalysts');
  });
  it('rejects unsafe catalyst query values', () => expect(catalystIdFromHash('#/catalysts?catalyst=%3Cscript%3E')).toBe(''));
  it('describes primary screen motion from the navigation order', () => {
    expect(routeMotionDirection('/', '/ideas')).toBe('forward');
    expect(routeMotionDirection('/journal', '/trades')).toBe('backward');
    expect(routeMotionDirection('/settings', '/')).toBe('neutral');
  });
  it('drags the mobile selection to the matching primary section', () => {
    expect(swipeNavigationTarget('/ideas', 72)).toBe('/trades');
    expect(swipeNavigationTarget('/ideas', -72)).toBe('/catalysts');
    expect(swipeNavigationTarget('/ideas', 118)).toBe('/journal');
    expect(swipeNavigationTarget('/ideas', 20)).toBeUndefined();
    expect(swipeNavigationTarget('/', -72)).toBeUndefined();
    expect(swipeNavigationTarget('/insights', 72)).toBeUndefined();
    expect(swipeNavigationTarget('/workspace', 72)).toBeUndefined();
    expect(swipeNavigationTarget('/catalysts', 72, 52, 24, defaultMobileNavigation)).toBe('/ideas');
    expect(swipeNavigationTarget('/journal', 72, 52, 24, defaultMobileNavigation)).toBeUndefined();
  });
});
