// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { createTutorialFixture } from '../features/tour/tutorial-fixtures';
import { CatalystIntelligence, type CatalystIntelligenceActions } from './CatalystIntelligence';

let root: Root;
let container: HTMLDivElement;

function button(label: string) {
  const match = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent?.includes(label));
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Catalyst Intelligence production presentation', () => {
  it('keeps the production manual snapshot action and success copy unchanged', async () => {
    const saveSnapshot = vi.fn(async () => undefined);
    const setMessage = vi.fn();
    const actions: CatalystIntelligenceActions = { saveSnapshot, loadProviderStatus: async () => [], loadDelayedOptions: async () => ({ snapshots: [] }) };
    await act(async () => root.render(<CatalystIntelligence
      catalyst={demoWorkspace.catalysts[0]}
      workspace={demoWorkspace}
      actions={actions}
      onSaved={() => undefined}
      setMessage={setMessage}
      presentation={{ initialManual: { observedAt: '2026-08-15T12:00', ticker: 'DEMO', underlying: '100', methodology: 'Named production test source.' } }}
    />));

    await act(async () => { button('Save Snapshot').click(); await Promise.resolve(); });
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    expect(setMessage).toHaveBeenCalledWith('Manual market snapshot appended to the private Research Ledger.');
  });

  it('keeps the production provider snapshot action and success copy unchanged', async () => {
    const saveSnapshot = vi.fn(async () => undefined);
    const setMessage = vi.fn();
    const actions: CatalystIntelligenceActions = { saveSnapshot, loadProviderStatus: async () => [], loadDelayedOptions: async () => ({ snapshots: [] }) };
    await act(async () => root.render(<CatalystIntelligence
      catalyst={demoWorkspace.catalysts[0]}
      workspace={demoWorkspace}
      actions={actions}
      onSaved={() => undefined}
      setMessage={setMessage}
      presentation={{
        initialOptions: createTutorialFixture(new Date('2026-08-15T12:00:00Z')).options,
        initialManual: { observedAt: '2026-08-15T12:00', ticker: 'DEMO', underlying: '100', expiration: '2026-09-18', methodology: 'Named production test source.' },
      }}
    />));

    await act(async () => { button('Save 6 Contracts').click(); await Promise.resolve(); });
    expect(saveSnapshot).toHaveBeenCalledTimes(1);
    expect(setMessage).toHaveBeenCalledWith('Provider snapshot appended to the private Research Ledger.');
  });
});
