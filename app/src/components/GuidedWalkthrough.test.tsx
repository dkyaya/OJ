// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGuidedTutorialState, guidedTutorialSteps, type GuidedTutorialState } from '../features/tour/guided-tutorial';
import { GuidedWalkthrough } from './GuidedWalkthrough';

let root: Root;
let container: HTMLDivElement;

function button(label: string) {
  const match = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.includes(label));
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

async function click(label: string) {
  await act(async () => { button(label).click(); await Promise.resolve(); });
}

function FullStoryHarness({ onFinish }: { onFinish: () => void }) {
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<GuidedTutorialState>(() => createGuidedTutorialState('in_progress', 0, new Date('2026-08-15T12:00:00Z')));
  return <GuidedWalkthrough
    open={open}
    state={state}
    sessionKey={1}
    onStage={(stage) => setState(createGuidedTutorialState('in_progress', stage, new Date('2026-08-15T12:00:00Z')))}
    onPause={() => setOpen(false)}
    onFinish={onFinish}
    onExit={() => setOpen(false)}
    onRestart={() => setState(createGuidedTutorialState('in_progress', 0, new Date('2026-08-15T12:00:00Z')))}
  />;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis.crypto, 'randomUUID', { configurable: true, value: vi.fn(() => 'tutorial-session-id') });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Guided Walkthrough behavior', () => {
  it('completes the hands-on synthetic story without a provider request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const onFinish = vi.fn();
    await act(async () => root.render(<FullStoryHarness onFinish={onFinish} />));

    await click('Create Tutorial Catalyst');
    expect(container.textContent).toContain('Tutorial Catalyst created');
    await click('Next');

    expect(container.textContent).toContain('Tutorial Fixture');
    expect(container.textContent).toContain('Straddle estimate');
    expect(container.querySelector('[data-shared-ui="catalyst-intelligence"]')).not.toBeNull();
    await click('Mark Intelligence Reviewed');
    await click('Next');

    expect(container.querySelector('[data-shared-ui="idea-editor"]')).not.toBeNull();
    await click('Next');
    await click('Next');
    await click('Save Tutorial Idea');
    await click('Next');

    expect(container.querySelector('[data-shared-ui-section="candidate-editor"]')).not.toBeNull();
    expect(container.textContent).toContain('$140.00');
    expect(container.textContent).toContain('$360.00');
    await click('Save Candidate');
    await click('Next');

    expect(container.querySelector('[data-shared-ui="record-trade-editor"]')).not.toBeNull();
    const confirmation = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!confirmation) throw new Error('Trade boundary confirmation was not rendered.');
    await act(async () => { confirmation.click(); });
    expect(container.textContent).toContain('$132.00');
    expect(container.textContent).toContain('$368.00');
    expect(container.textContent).toContain('101.32');
    await click('Record Trade');
    await click('Next');

    expect(container.querySelector('[data-shared-ui="trade-detail-surface"]')).not.toBeNull();
    expect(container.querySelector('[data-shared-ui="trade-checkin-editor"]')).not.toBeNull();
    await click('Save Check-In');
    expect(container.textContent).toContain('saved outside the Journal');
    await click('Next');

    expect(container.textContent).toContain('+$78.00');
    const exitConfirmation = container.querySelector<HTMLInputElement>('.confirm-row input[type="checkbox"]');
    if (!exitConfirmation) throw new Error('Exit boundary confirmation was not rendered.');
    await act(async () => { exitConfirmation.click(); });
    await click('Record Exit & Debrief');
    await click('Next');

    expect(container.querySelector('[data-shared-ui="debrief-editor"]')).not.toBeNull();
    await click('Save Debrief');
    await click('Next');
    expect(container.textContent).toContain('Excluded from real analytics');
    expect(container.querySelector('[data-tour-id="insights-shell"]')).not.toBeNull();
    expect(container.textContent).toContain('No risk capacity, Journal, calibration, collaboration, export, or provider cache was touched.');
    await click('Finish & Clear Tutorial');

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Confirmed Trades0');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('preserves editable arrows and Escape pause behavior', async () => {
    const onStage = vi.fn(); const onPause = vi.fn();
    await act(async () => root.render(<GuidedWalkthrough open state={createGuidedTutorialState('in_progress', 0)} sessionKey={2} onStage={onStage} onPause={onPause} onFinish={vi.fn()} onExit={vi.fn()} onRestart={vi.fn()} />));
    const input = container.querySelector<HTMLInputElement>('input');
    if (!input) throw new Error('Tutorial Catalyst input did not render.');

    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(onStage).not.toHaveBeenCalled();
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('serializes Finish and releases the lock after settlement', async () => {
    let settle!: () => void;
    const pending = new Promise<void>((resolve) => { settle = resolve; });
    const onFinish = vi.fn(() => pending);
    await act(async () => root.render(<GuidedWalkthrough open state={createGuidedTutorialState('in_progress', guidedTutorialSteps.length - 1)} sessionKey={3} onStage={vi.fn()} onPause={vi.fn()} onFinish={onFinish} onExit={vi.fn()} onRestart={vi.fn()} />));
    const finish = button('Finish & Clear Tutorial');

    await act(async () => { finish.click(); finish.click(); });
    expect(onFinish).toHaveBeenCalledTimes(1);
    await act(async () => { settle(); await pending; });
  });

  it('releases the Guided transition lock after a failed persistence action', async () => {
    const onFinish = vi.fn()
      .mockRejectedValueOnce(new Error('Preference save failed.'))
      .mockResolvedValueOnce(undefined);
    await act(async () => root.render(<GuidedWalkthrough open state={createGuidedTutorialState('in_progress', guidedTutorialSteps.length - 1)} sessionKey={4} onStage={vi.fn()} onPause={vi.fn()} onFinish={onFinish} onExit={vi.fn()} onRestart={vi.fn()} />));

    await click('Finish & Clear Tutorial');
    expect(container.textContent).toContain('Preference save failed.');
    await click('Finish & Clear Tutorial');
    expect(onFinish).toHaveBeenCalledTimes(2);
  });
});
