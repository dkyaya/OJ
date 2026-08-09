import { supabase } from './supabase';

export type AuthMode = 'sign-in' | 'forgot' | 'activate' | 'reset';
export const MINIMUM_PASSWORD_LENGTH = 12;

const authModes = new Set<AuthMode>(['sign-in', 'forgot', 'activate', 'reset']);

export function authModeFromUrl(input: string): AuthMode {
  const url = new URL(input);
  const requested = url.searchParams.get('auth');
  if (requested && authModes.has(requested as AuthMode)) return requested as AuthMode;
  const fragment = url.hash.startsWith('#/') ? new URLSearchParams() : new URLSearchParams(url.hash.replace(/^#/, ''));
  const type = fragment.get('type');
  if (type === 'recovery') return 'reset';
  if (type === 'invite') return 'activate';
  return 'sign-in';
}

export function authCallbackError(input: string) {
  const url = new URL(input);
  const fragment = url.hash.startsWith('#/') ? new URLSearchParams() : new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('error_code') || fragment.get('error_code') || '';
  if (code.includes('expired') || code === 'otp_expired') return 'This account link expired. Request a new email.';
  if (code) return 'This account link is invalid or has already been used.';
  return '';
}

export function authRedirectUrl(mode: 'activate' | 'reset', currentUrl = window.location.href, baseUrl = import.meta.env.BASE_URL) {
  const root = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, currentUrl);
  root.search = `?auth=${mode}`;
  root.hash = '';
  return root.toString();
}

export function friendlyAuthError(error: { code?: string; message?: string } | null | undefined, context: 'sign-in' | 'reset' | 'password' | 'invite' = 'sign-in') {
  const code = error?.code?.toLowerCase() || '';
  const message = error?.message?.toLowerCase() || '';
  if (code.includes('invalid_credentials') || message.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (code.includes('email_not_confirmed') || message.includes('email not confirmed')) return 'Check your email to verify this account.';
  if (code.includes('otp_expired') || message.includes('expired')) return context === 'reset' ? 'Password reset link expired.' : 'This invitation has expired.';
  if (code.includes('over_email_send_rate_limit') || message.includes('rate limit')) return 'Please wait before requesting another email.';
  if (code.includes('weak_password') || message.includes('password should be')) return `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
  if (code.includes('same_password') || message.includes('same password')) return 'Choose a password you have not used for this account.';
  if (context === 'invite') return 'The invitation could not be sent.';
  if (context === 'password') return 'The password could not be updated.';
  if (context === 'reset') return 'The reset email could not be sent.';
  return 'Sign in failed. Try again.';
}

function validPassword(password: string, confirmation: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) throw new Error(`Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
  if (password !== confirmation) throw new Error('Passwords do not match.');
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('OJ cloud is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendlyAuthError(error, 'sign-in'));
}

export async function requestPasswordReset(email: string) {
  if (!supabase) throw new Error('OJ cloud is not configured.');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirectUrl('reset') });
  if (error) throw new Error(friendlyAuthError(error, 'reset'));
}

export async function setAccountPassword(password: string, confirmation: string, currentPassword?: string) {
  if (!supabase) throw new Error('OJ cloud is not configured.');
  validPassword(password, confirmation);
  const attributes = currentPassword ? { password, current_password: currentPassword } : { password };
  const { error } = await supabase.auth.updateUser(attributes);
  if (error) throw new Error(friendlyAuthError(error, 'password'));
}

export async function activateInvitedAccount(password: string, confirmation: string) {
  if (!supabase) throw new Error('OJ cloud is not configured.');
  await setAccountPassword(password, confirmation);
  const { error } = await supabase.rpc('activate_invited_account');
  if (error) throw new Error('This invitation is invalid or has expired.');
}

export async function updateAccountProfile(displayName: string, initials: string) {
  if (!supabase) throw new Error('OJ cloud is not configured.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your session expired. Sign in again.');
  const cleanName = displayName.trim(); const cleanInitials = initials.trim().toUpperCase();
  if (!cleanName || cleanName.length > 80) throw new Error('Enter a display name under 80 characters.');
  if (!/^[A-Z0-9]{1,4}$/.test(cleanInitials)) throw new Error('Use 1–4 letters or numbers for initials.');
  const { error } = await supabase.from('profiles').update({ display_name: cleanName, initials: cleanInitials }).eq('id', user.id);
  if (error) throw new Error('Profile changes could not be saved.');
}

export async function inviteAccount(email: string) {
  if (!supabase) throw new Error('OJ cloud is not configured.');
  const { error } = await supabase.functions.invoke('invite-account', { body: { email: email.trim() } });
  if (error) throw new Error(friendlyAuthError(error, 'invite'));
}
