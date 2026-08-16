import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoWorkspace } from '../data/demo';
import { SettingsPage } from './SettingsPage';

describe('settings mobile navigation preferences', () => {
  it('offers four ordered shortcut slots and a five-item preview', () => {
    const markup = renderToStaticMarkup(<SettingsPage workspace={demoWorkspace} onSaved={() => undefined} />);

    expect(markup).toContain('Choose and order four shortcuts');
    expect(markup).toContain('<span>Shortcut 1</span>');
    expect(markup).toContain('<span>Shortcut 4</span>');
    expect(markup).toContain('aria-label="Mobile navigation preview"');
    expect(markup).toContain('4 + More');
  });

  it('offers both versioned onboarding modes without using a primary navigation slot', () => {
    const markup = renderToStaticMarkup(<SettingsPage workspace={demoWorkspace} onSaved={() => undefined} />);
    expect(markup).toContain('data-tour-id="tour-guidance"');
    expect(markup).toContain('Product Tour');
    expect(markup).toContain('Quick Tour');
    expect(markup).toContain('Start Quick Tour');
    expect(markup).toContain('Guided Walkthrough');
    expect(markup).toContain('Start Guided Walkthrough');
    expect(markup).toContain('disposable synthetic example');
  });

  it('shows one replay action for each completed onboarding mode', () => {
    const markup = renderToStaticMarkup(<SettingsPage workspace={demoWorkspace} onSaved={() => undefined} tourState={{ version: 1, status: 'completed', step: 10 }} guidedState={{ version: 1, status: 'completed', stage: 8 }} />);
    expect(markup).toContain('Replay Quick Tour');
    expect(markup).toContain('Replay Guided Walkthrough');
    expect(markup).not.toContain('>Restart<');
  });

  it('offers resume plus restart only while onboarding is paused', () => {
    const markup = renderToStaticMarkup(<SettingsPage workspace={demoWorkspace} onSaved={() => undefined} tourState={{ version: 1, status: 'in_progress', step: 4 }} guidedState={{ version: 1, status: 'paused', stage: 3 }} />);
    expect(markup).toContain('Resume Quick Tour');
    expect(markup).toContain('Resume Guided Walkthrough');
    expect(markup).toContain('>Restart<');
  });

  it('makes the workspace privacy boundary visible before inviting a collaborator', () => {
    const markup = renderToStaticMarkup(<SettingsPage workspace={demoWorkspace} onSaved={() => undefined} />);
    expect(markup).toContain('Shared research');
    expect(markup).toContain('Always personal');
    expect(markup).toContain('Trades, fills, and Journal entries');
  });
});
