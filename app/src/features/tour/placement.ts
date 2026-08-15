export type TourRect = { top: number; left: number; width: number; height: number };
export type TourSize = { width: number; height: number };
export type TourPlacementName = 'below' | 'above' | 'right' | 'left' | 'detached-top' | 'detached-bottom' | 'centered';
export type TourPlacement = { top: number; left: number; height: number; placement: TourPlacementName; anchored: boolean };

const right = (rect: TourRect) => rect.left + rect.width;
const bottom = (rect: TourRect) => rect.top + rect.height;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function tourRectsOverlap(first: TourRect, second: TourRect): boolean {
  return first.left < right(second) && right(first) > second.left && first.top < bottom(second) && bottom(first) > second.top;
}

export function tourRectInsideViewport(rect: TourRect, viewport: TourSize, margin = 16): boolean {
  return rect.left >= margin && rect.top >= margin && right(rect) <= viewport.width - margin && bottom(rect) <= viewport.height - margin;
}

const positionRect = (placement: TourPlacement, card: TourSize): TourRect => ({ top: placement.top, left: placement.left, width: card.width, height: placement.height });

export function placeTourCallout({ viewport, target, card, margin = 16, gap = 14, mobile = false }: {
  viewport: TourSize;
  target?: TourRect;
  card: TourSize;
  margin?: number;
  gap?: number;
  mobile?: boolean;
}): TourPlacement | undefined {
  const maxLeft = Math.max(margin, viewport.width - margin - card.width);
  const maxTop = Math.max(margin, viewport.height - margin - card.height);
  if (!target) return {
    placement: 'centered', anchored: false,
    left: clamp((viewport.width - card.width) / 2, margin, maxLeft),
    top: clamp((viewport.height - card.height) / 2, margin, maxTop),
    height: card.height,
  };

  const centeredLeft = clamp(target.left + target.width / 2 - card.width / 2, margin, maxLeft);
  const centeredTop = clamp(target.top + target.height / 2 - card.height / 2, margin, maxTop);
  const anchored: TourPlacement[] = [
    { placement: 'below', anchored: true, left: centeredLeft, top: bottom(target) + gap, height: card.height },
    { placement: 'above', anchored: true, left: centeredLeft, top: target.top - gap - card.height, height: card.height },
    { placement: 'right', anchored: true, left: right(target) + gap, top: centeredTop, height: card.height },
    { placement: 'left', anchored: true, left: target.left - gap - card.width, top: centeredTop, height: card.height },
  ];
  const bottomTarget = bottom(target) > viewport.height * 0.72;
  if (mobile && bottomTarget) anchored.sort((a, b) => ['above', 'left', 'right', 'below'].indexOf(a.placement) - ['above', 'left', 'right', 'below'].indexOf(b.placement));
  for (const candidate of anchored) {
    const rect = positionRect(candidate, card);
    if (tourRectInsideViewport(rect, viewport, margin) && !tourRectsOverlap(rect, target)) return candidate;
  }

  const topHeight = Math.min(card.height, Math.max(0, target.top - gap - margin));
  const bottomHeight = Math.min(card.height, Math.max(0, viewport.height - margin - bottom(target) - gap));
  const detached: TourPlacement[] = [
    ...(topHeight > 0 ? [
      { placement: 'detached-top' as const, anchored: false, left: margin, top: margin, height: topHeight },
      { placement: 'detached-top' as const, anchored: false, left: maxLeft, top: margin, height: topHeight },
      { placement: 'detached-top' as const, anchored: false, left: clamp((viewport.width - card.width) / 2, margin, maxLeft), top: margin, height: topHeight },
    ] : []),
    ...(bottomHeight > 0 ? [
      { placement: 'detached-bottom' as const, anchored: false, left: margin, top: bottom(target) + gap, height: bottomHeight },
      { placement: 'detached-bottom' as const, anchored: false, left: maxLeft, top: bottom(target) + gap, height: bottomHeight },
      { placement: 'detached-bottom' as const, anchored: false, left: clamp((viewport.width - card.width) / 2, margin, maxLeft), top: bottom(target) + gap, height: bottomHeight },
    ] : []),
  ];
  if (mobile && bottomTarget) detached.sort((a, b) => (a.placement === 'detached-top' ? -1 : 1) - (b.placement === 'detached-top' ? -1 : 1));
  const collisionFree = detached.find((candidate) => tourRectInsideViewport(positionRect(candidate, card), viewport, margin) && !tourRectsOverlap(positionRect(candidate, card), target));
  if (collisionFree) return collisionFree;

  // There is no "least overlap" escape hatch. If geometry leaves literally no
  // protected region, the controller withholds the callout and remeasures after
  // scrolling instead of obscuring the element it is explaining.
  return undefined;
}
