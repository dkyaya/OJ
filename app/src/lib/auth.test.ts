import { describe, expect, it } from 'vitest';
import { authCallbackError, authModeFromUrl, authRedirectUrl, friendlyAuthError, MINIMUM_PASSWORD_LENGTH } from './auth';

describe('authentication routing and errors', () => {
  it('keeps GitHub Pages callbacks inside the OJ base path', () => {
    expect(authRedirectUrl('reset', 'https://dkyaya.github.io/OJ/#/settings', '/OJ/')).toBe('https://dkyaya.github.io/OJ/?auth=reset');
  });

  it('recognizes reset and invitation callbacks without reading tokens', () => {
    expect(authModeFromUrl('https://dkyaya.github.io/OJ/?auth=reset')).toBe('reset');
    expect(authModeFromUrl('https://dkyaya.github.io/OJ/?auth=activate')).toBe('activate');
    expect(authModeFromUrl('https://dkyaya.github.io/OJ/#/ideas')).toBe('sign-in');
  });

  it('treats repeated activation-page GET navigation as inert routing', () => {
    const activationUrl = 'https://dkyaya.github.io/OJ/?auth=activate';
    expect(authModeFromUrl(activationUrl)).toBe('activate');
    expect(authModeFromUrl(activationUrl)).toBe('activate');
    expect(new URL(activationUrl).searchParams.has('token')).toBe(false);
    expect(new URL(activationUrl).searchParams.has('token_hash')).toBe(false);
  });

  it('turns callback and credential failures into concise copy', () => {
    expect(authCallbackError('https://dkyaya.github.io/OJ/?error_code=otp_expired')).toContain('expired');
    expect(friendlyAuthError({ code: 'invalid_credentials' })).toBe('Incorrect email or password.');
    expect(friendlyAuthError({ code: 'weak_password' }, 'password')).toContain(String(MINIMUM_PASSWORD_LENGTH));
  });
});
