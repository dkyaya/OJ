// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductTourState, productTourSteps } from '../features/tour/product-tour';
import { ProductTour, ProductTourInvitation } from './ProductTour';

type TourCallbacks = {
  onStep: (step: number) => void | Promise<void>;
  onPause: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
};

let root: Root;
let container: HTMLDivElement;

function press(target: Element, key: string, modifiers: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }));
}

async function renderTour(callbacks: Partial<TourCallbacks> = {}, step = 1) {
  const anchor = document.createElement('div');
  anchor.dataset.tourId = productTourSteps[step].target;
  document.body.append(anchor);
  const handlers: TourCallbacks = {
    onStep: callbacks.onStep || vi.fn(),
    onPause: callbacks.onPause || vi.fn(),
    onFinish: callbacks.onFinish || vi.fn(),
  };
  await act(async () => {
    root.render(<ProductTour
      state={createProductTourState('in_progress', step, new Date('2026-08-15T12:00:00Z'))}
      {...handlers}
    />);
  });
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
  const card = container.querySelector<HTMLElement>('.product-tour-card');
  if (!card) throw new Error('Product Tour card did not render.');
  return { card, handlers };
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  window.location.hash = '#/';
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Product Tour keyboard safety', () => {
  it('moves forward and backward when focus is on the Tour', async () => {
    const onStep = vi.fn();
    const { card } = await renderTour({ onStep });
    expect(document.activeElement).toBe(card);

    await act(async () => { press(card, 'ArrowRight'); });
    expect(onStep).toHaveBeenLastCalledWith(2);

    await act(async () => { press(card, 'ArrowLeft'); });
    expect(onStep).toHaveBeenLastCalledWith(0);
  });

  it.each([
    ['input', () => document.createElement('input'), 'ArrowRight'],
    ['textarea', () => document.createElement('textarea'), 'ArrowLeft'],
    ['select', () => document.createElement('select'), 'ArrowRight'],
    ['contenteditable', () => {
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      const child = document.createElement('span');
      editable.append(child);
      return child;
    }, 'ArrowLeft'],
  ])('leaves %s arrow-key behavior with the editable route control', async (_label, createTarget, key) => {
    const onStep = vi.fn();
    await renderTour({ onStep });
    const target = createTarget();
    document.body.append(target.parentElement || target);

    await act(async () => { press(target, key); });
    expect(onStep).not.toHaveBeenCalled();
  });

  it.each([
    ['Meta', { metaKey: true }],
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
  ])('preserves %s + Arrow shortcuts', async (_label, modifiers) => {
    const onStep = vi.fn();
    const { card } = await renderTour({ onStep });

    await act(async () => { press(card, 'ArrowRight', modifiers); });
    expect(onStep).not.toHaveBeenCalled();
  });

  it('keeps Escape mapped to Pause', async () => {
    const onPause = vi.fn();
    const { card } = await renderTour({ onPause });

    await act(async () => { press(card, 'Escape'); });
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('shares a synchronous lock between button and keyboard transitions, then unlocks', async () => {
    let settle!: () => void;
    const pending = new Promise<void>((resolve) => { settle = resolve; });
    const onStep = vi.fn(() => pending);
    const { card } = await renderTour({ onStep });
    const next = container.querySelector<HTMLButtonElement>('button.primary');
    if (!next) throw new Error('Next button did not render.');

    await act(async () => {
      next.click();
      press(card, 'ArrowRight');
    });
    expect(onStep).toHaveBeenCalledTimes(1);

    await act(async () => { settle(); await pending; });
    await act(async () => { press(card, 'ArrowRight'); });
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('releases the transition lock after a failed save', async () => {
    const onStep = vi.fn()
      .mockRejectedValueOnce(new Error('Preference save failed.'))
      .mockResolvedValueOnce(undefined);
    const { card } = await renderTour({ onStep });

    await act(async () => { press(card, 'ArrowRight'); await Promise.resolve(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Preference save failed.');

    await act(async () => { press(card, 'ArrowRight'); await Promise.resolve(); });
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it('serializes the first-use Take and Skip actions', async () => {
    let settle!: () => void;
    const pending = new Promise<void>((resolve) => { settle = resolve; });
    const onQuick = vi.fn(() => pending);
    const onGuided = vi.fn();
    const onSkip = vi.fn();
    await act(async () => {
      root.render(<ProductTourInvitation onQuick={onQuick} onGuided={onGuided} onSkip={onSkip} />);
    });
    const take = container.querySelector<HTMLButtonElement>('button.primary');
    const skip = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Skip'));
    if (!take || !skip) throw new Error('Product Tour invitation actions did not render.');

    await act(async () => {
      take.click();
      skip.click();
    });
    expect(onQuick).toHaveBeenCalledTimes(1);
    expect(onGuided).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();

    await act(async () => { settle(); await pending; });
    await act(async () => { skip.click(); });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
