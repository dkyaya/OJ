import { describe, expect, it } from 'vitest';
import { placeTourCallout, tourRectInsideViewport, tourRectsOverlap, type TourRect } from './placement';

const viewport = { width: 1200, height: 800 };
const card = { width: 360, height: 240 };
const rect = (placement: { top: number; left: number; height: number }): TourRect => ({ top: placement.top, left: placement.left, width: card.width, height: placement.height });
const required = <Value,>(value: Value | undefined): Value => {
  if (!value) throw new Error('Expected a protected callout placement.');
  return value;
};

describe('Product Tour collision-aware placement', () => {
  it('places below when there is protected space', () => {
    const target = { top: 100, left: 380, width: 200, height: 80 };
    const result = required(placeTourCallout({ viewport, target, card }));
    expect(result.placement).toBe('below');
    expect(tourRectsOverlap(rect(result), target)).toBe(false);
  });

  it('places above when below would leave the viewport', () => {
    const target = { top: 650, left: 380, width: 200, height: 80 };
    const result = required(placeTourCallout({ viewport, target, card }));
    expect(result.placement).toBe('above');
    expect(tourRectsOverlap(rect(result), target)).toBe(false);
  });

  it('uses a side placement when vertical candidates collide', () => {
    const target = { top: 250, left: 100, width: 160, height: 300 };
    const result = required(placeTourCallout({ viewport, target, card: { width: 360, height: 300 } }));
    expect(result.placement).toBe('right');
    expect(tourRectsOverlap({ top: result.top, left: result.left, width: 360, height: result.height }, target)).toBe(false);
  });

  it.each([
    { top: 24, left: 24, width: 180, height: 80 },
    { top: 660, left: 940, width: 220, height: 100 },
    { top: 320, left: 520, width: 160, height: 100 },
  ])('keeps the callout inside viewport bounds and off the target', (target) => {
    const result = required(placeTourCallout({ viewport, target, card }));
    expect(tourRectInsideViewport(rect(result), viewport)).toBe(true);
    expect(tourRectsOverlap(rect(result), target)).toBe(false);
  });

  it('keeps the Settings replay target visible', () => {
    const settingsTarget = { top: 540, left: 760, width: 360, height: 180 };
    const result = required(placeTourCallout({ viewport, target: settingsTarget, card }));
    expect(tourRectsOverlap(rect(result), settingsTarget)).toBe(false);
    expect(tourRectInsideViewport(rect(result), viewport)).toBe(true);
  });

  it('moves a mobile callout above a bottom-navigation target', () => {
    const mobileViewport = { width: 390, height: 844 };
    const mobileCard = { width: 370, height: 330 };
    const navigationTarget = { top: 772, left: 18, width: 70, height: 54 };
    const result = required(placeTourCallout({ viewport: mobileViewport, target: navigationTarget, card: mobileCard, margin: 10, mobile: true }));
    expect(['above', 'detached-top']).toContain(result.placement);
    expect(tourRectsOverlap({ top: result.top, left: result.left, width: mobileCard.width, height: result.height }, navigationTarget)).toBe(false);
  });

  it('uses a detached fallback when no anchored candidate fits', () => {
    const tightViewport = { width: 420, height: 520 };
    const wideTarget = { top: 150, left: 20, width: 380, height: 220 };
    const result = required(placeTourCallout({ viewport: tightViewport, target: wideTarget, card: { width: 380, height: 300 }, margin: 10 }));
    expect(result.anchored).toBe(false);
    expect(result.placement).toMatch(/^detached-/);
    const resultRect = { top: result.top, left: result.left, width: 380, height: result.height };
    expect(tourRectInsideViewport(resultRect, tightViewport, 10)).toBe(true);
    expect(tourRectsOverlap(resultRect, wideTarget)).toBe(false);
  });

  it.each([
    { width: 390, height: 844, target: { top: 164, left: 8, width: 374, height: 520 }, card: { width: 370, height: 360 } },
    { width: 375, height: 667, target: { top: 120, left: 8, width: 359, height: 430 }, card: { width: 355, height: 340 } },
    { width: 320, height: 568, target: { top: 112, left: 6, width: 308, height: 356 }, card: { width: 300, height: 330 } },
  ])('never covers a large target in a $width×$height viewport', ({ width, height, target, card: smallCard }) => {
    const result = required(placeTourCallout({ viewport: { width, height }, target, card: smallCard, margin: 10, mobile: true }));
    const callout = { top: result.top, left: result.left, width: smallCard.width, height: result.height };
    expect(tourRectInsideViewport(callout, { width, height }, 10)).toBe(true);
    expect(tourRectsOverlap(callout, target)).toBe(false);
  });

  it('returns no placement when a target leaves no protected region', () => {
    expect(placeTourCallout({ viewport: { width: 320, height: 568 }, target: { top: 6, left: 6, width: 308, height: 556 }, card: { width: 300, height: 330 }, margin: 10, mobile: true })).toBeUndefined();
  });
});
