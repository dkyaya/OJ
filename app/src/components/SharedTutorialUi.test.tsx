// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuidedTutorialState } from '../features/tour/guided-tutorial';
import { demoWorkspace } from '../data/demo';
import { CatalystsPage } from '../pages/CatalystsPage';
import { GuidedWalkthrough } from './GuidedWalkthrough';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => 'shared-ui-session') });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('production and Tutorial UI reuse', () => {
  it('renders the same Catalyst editor layer in the production page and Guided stage', async () => {
    await act(async () => root.render(<CatalystsPage workspace={demoWorkspace} onSaved={() => undefined} />));
    const add = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.includes('Add Catalyst'));
    if (!add) throw new Error('Production Add Catalyst action was not rendered.');
    await act(async () => add.click());
    const productionEditor = container.querySelector('[data-shared-ui="catalyst-editor"]');
    expect(productionEditor).not.toBeNull();
    expect(productionEditor?.textContent).toContain('Schedule type');

    await act(async () => root.render(<GuidedWalkthrough open state={createGuidedTutorialState('in_progress', 0)} sessionKey={1} onStage={vi.fn()} onPause={vi.fn()} onFinish={vi.fn()} onExit={vi.fn()} onRestart={vi.fn()} />));
    const tutorialEditor = container.querySelector('[data-shared-ui="catalyst-editor"]');
    expect(tutorialEditor).not.toBeNull();
    expect(tutorialEditor?.textContent).toContain('Schedule type');
    expect(tutorialEditor?.querySelector<HTMLInputElement>('input[value="OJ Tutorial Co. Q2 Earnings"]')).not.toBeNull();
  });
});
