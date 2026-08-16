import { describe, expect, it } from 'vitest';
import { PRODUCT_TOUR_VERSION, createProductTourState, productTourActionLabel, productTourPreferenceData, productTourSteps, readProductTourState } from './product-tour';

describe('product tour state', () => {
  it('starts a new version without treating older completion as current', () => {
    expect(readProductTourState(undefined)).toMatchObject({ version: PRODUCT_TOUR_VERSION, status: 'not_started', step: 0 });
    expect(readProductTourState({ productTour: { version: 0, status: 'completed', step: 10 } }).status).toBe('not_started');
  });

  it('clamps resumable progress and preserves unrelated preference JSON', () => {
    const progress = readProductTourState({ productTour: { version: PRODUCT_TOUR_VERSION, status: 'in_progress', step: 999 } });
    expect(progress.step).toBe(productTourSteps.length - 1);
    expect(productTourActionLabel(progress)).toBe('Resume Quick Tour');
    expect(productTourPreferenceData({ mobileNavigation: ['/'] }, progress)).toEqual({ mobileNavigation: ['/'], productTour: progress });
  });

  it('creates deterministic skipped and completed states', () => {
    const now = new Date('2026-08-15T12:00:00Z');
    expect(createProductTourState('skipped', 2, now)).toEqual({ version: PRODUCT_TOUR_VERSION, status: 'skipped', step: 2, updatedAt: now.toISOString() });
    const completed = createProductTourState('completed', 20, now);
    expect(completed.step).toBe(productTourSteps.length - 1);
    expect(productTourActionLabel(completed)).toBe('Replay Quick Tour');
    expect(productTourActionLabel(createProductTourState('not_started', 0, now))).toBe('Start Quick Tour');
  });

  it('uses stable semantic targets and programmatic routes for every step', () => {
    expect(productTourSteps).toHaveLength(11);
    expect(new Set(productTourSteps.map((step) => step.id)).size).toBe(productTourSteps.length);
    expect(productTourSteps.every((step) => step.target && step.route.startsWith('/'))).toBe(true);
    expect(productTourSteps.find((step) => step.id === 'record-trade')?.body).toContain('outside OJ');
    expect(productTourSteps.find((step) => step.id === 'monitoring')?.body).toContain('do not appear as Journal entries');
    expect(productTourSteps.at(-1)?.body).toContain('Product Tour in Settings');
  });

  it('does not depend on any customizable mobile shortcut set', () => {
    const mobileSets = [
      ['/', '/catalysts', '/ideas', '/trades'],
      ['/', '/journal', '/insights', '/trades'],
      ['/catalysts', '/ideas', '/journal', '/insights'],
    ];
    const routes = productTourSteps.map((step) => step.route);
    for (const shortcuts of mobileSets) {
      expect(routes).toContain('/catalysts');
      expect(routes).toContain('/ideas');
      expect(routes).toContain('/trades');
      expect(routes).toContain('/journal');
      expect(routes).toContain('/insights');
      expect(shortcuts).toHaveLength(4);
    }
  });
});
