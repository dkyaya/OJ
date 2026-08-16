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
});
