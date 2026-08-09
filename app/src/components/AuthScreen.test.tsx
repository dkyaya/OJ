import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthScreen } from './AuthScreen';

describe('account screens', () => {
  beforeEach(() => Object.defineProperty(globalThis, 'location', { configurable: true, value: { href: 'https://dkyaya.github.io/OJ/' } }));
  afterEach(() => Reflect.deleteProperty(globalThis, 'location'));
  const props = { authenticated: false, onMode: () => undefined, onComplete: () => undefined };

  it('renders an invite-only password-manager-friendly sign-in form', () => {
    const html = renderToStaticMarkup(<AuthScreen {...props} mode="sign-in" />);
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('Forgot Password');
    expect(html).not.toContain('Sign Up');
  });

  it('renders matching new-password fields for a verified reset session', () => {
    const html = renderToStaticMarkup(<AuthScreen {...props} authenticated mode="reset" />);
    expect(html).toContain('Reset Password');
    expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2);
  });

  it('does not expose an activation form before the invite link creates a session', () => {
    const html = renderToStaticMarkup(<AuthScreen {...props} mode="activate" />);
    expect(html).toContain('Open your invitation email');
    expect(html).not.toContain('<form');
  });
});
