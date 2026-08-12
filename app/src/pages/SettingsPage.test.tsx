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
});
