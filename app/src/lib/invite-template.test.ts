import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const template = readFileSync(new URL('../../../supabase/templates/invite.html', import.meta.url), 'utf8');
const config = readFileSync(new URL('../../../supabase/config.toml', import.meta.url), 'utf8');
const edgeFunction = readFileSync(new URL('../../../supabase/functions/invite-account/index.ts', import.meta.url), 'utf8');

describe('scanner-safe invite delivery', () => {
  it('renders a manual OTP and a static activation link without one-time URL material', () => {
    expect(template).toContain('{{ .Token }}');
    expect(template).toContain('https://dkyaya.github.io/OJ/?auth=activate');
    expect(template).not.toContain('{{ .ConfirmationURL }}');
    expect(template).not.toContain('{{ .TokenHash }}');
    expect(template).not.toContain('/auth/v1/verify');
  });

  it('keeps the Auth and application invite windows at one hour', () => {
    expect(config).toContain('otp_expiry = 3600');
    expect(config).toContain('content_path = "./supabase/templates/invite.html"');
    expect(edgeFunction).toContain('const inviteTtlMs = 60 * 60 * 1000;');
    expect(edgeFunction).not.toContain('redirectTo');
  });
});
