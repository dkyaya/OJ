import { useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, LogIn, Mail } from 'lucide-react';
import { activateInvitedAccount, authCallbackError, type AuthMode, requestPasswordReset, setAccountPassword, signInWithPassword } from '../lib/auth';

type Props = { mode: AuthMode; authenticated: boolean; onMode: (mode: AuthMode) => void; onComplete: () => void; onLocalStateCleared?: () => void };

function PasswordFields({ password, confirmation, setPassword, setConfirmation }: { password: string; confirmation: string; setPassword: (value: string) => void; setConfirmation: (value: string) => void }) {
  return <><label><span>New Password</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label><span>Confirm Password</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label></>;
}

export function AuthScreen({ mode, authenticated, onMode, onComplete, onLocalStateCleared }: Props) {
  const [email, setEmail] = useState(''); const [inviteCode, setInviteCode] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(() => authCallbackError(location.href));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'sign-in') { await signInWithPassword(email, password); onComplete(); }
      if (mode === 'forgot') { await requestPasswordReset(email); setMessage('Check your email for a password reset link.'); }
      if (mode === 'reset') { await setAccountPassword(password, confirmation); setMessage('Password updated.'); onComplete(); }
      if (mode === 'activate') { await activateInvitedAccount(email, inviteCode, password, confirmation, onLocalStateCleared); setMessage('Account activated.'); onComplete(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'OJ could not complete that request.'); }
    finally { setBusy(false); }
  };

  const title = mode === 'forgot' ? 'Forgot Password' : mode === 'reset' ? 'Reset Password' : mode === 'activate' ? 'Activate Account' : 'Sign In';
  const subtitle = mode === 'forgot' ? 'Request a secure reset link.' : mode === 'reset' ? 'Choose a new account password.' : mode === 'activate' ? 'Set up your OJ account.' : 'Access your OJ account.';
  const needsLink = mode === 'reset' && !authenticated;

  return <main className="auth-screen"><section className="auth-card" aria-labelledby="auth-title">
    <img src={`${import.meta.env.BASE_URL}brand/oj-logo-primary-light.svg`} alt="OJ" />
    <header><span className="eyebrow">Options Journey</span><h1 id="auth-title">{title}</h1><p>{subtitle}</p></header>
    {needsLink ? <div className="auth-link-state"><KeyRound aria-hidden="true" /><p>{message || (mode === 'reset' ? 'Open the latest reset email on this device.' : 'Open your invitation email to create a password.')}</p><button type="button" onClick={() => onMode('sign-in')}><ArrowLeft size={16} />Back to Sign In</button></div> : <form onSubmit={(event) => void submit(event)}>
      {mode === 'sign-in' && <><label><span>Email</span><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label></>}
      {(mode === 'forgot' || mode === 'activate') && <label><span>Email</span><input type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
      {mode === 'activate' && <label><span>Invite Code</span><input className="invite-code-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>}
      {(mode === 'activate' || mode === 'reset') && <PasswordFields password={password} confirmation={confirmation} setPassword={setPassword} setConfirmation={setConfirmation} />}
      {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
      <button className="primary auth-submit" type="submit" disabled={busy}>{mode === 'forgot' ? <Mail size={17} /> : <LogIn size={17} />}{busy ? 'Working' : mode === 'forgot' ? 'Send Reset Link' : mode === 'activate' ? 'Activate Account' : mode === 'reset' ? 'Save Password' : 'Sign In'}</button>
      <div className="auth-actions">{mode === 'sign-in' ? <><button type="button" className="text-button" onClick={() => onMode('forgot')}>Forgot Password</button><button type="button" className="text-button" onClick={() => onMode('activate')}>Activate Account</button></> : <button type="button" className="text-button" onClick={() => onMode('sign-in')}><ArrowLeft size={15} />Back to Sign In</button>}</div>
    </form>}
    <footer><span>Invite-only access</span><span>No brokerage connection</span></footer>
  </section></main>;
}
