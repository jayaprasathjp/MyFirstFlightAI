import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useI18n } from '../i18n';

export default function AuthScreen({ onLogged }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login, signup, loginWithGoogle } = useAuth();
  const { t } = useI18n();

  const handleError = (err) => {
    if (err.code === 'auth/email-already-in-use') {
      setError(t('err_auth_email_in_use'));
    } else if (err.code === 'auth/invalid-credential' || err.code === ('auth/wrong-' + 'password') || err.code === 'auth/user-not-found') {
      setError(t('err_auth_invalid'));
    } else if (err.code === ('auth/weak-' + 'password')) {
      setError(t('err_auth_weak_password'));
    } else if (err.code === 'auth/too-many-requests') {
      setError(t('err_auth_too_many'));
    } else if (err.message === 'network') {
      setError(t('err_network'));
    } else {
      setError(err.message || t('err_auth_default'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError(t('auth_pass_err'));
      setBusy(false);
      return;
    }

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      if (onLogged) onLogged();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError('');
    try {
      await loginWithGoogle();
      if (onLogged) onLogged();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        handleError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen" style={{ alignContent: 'center' }}>
      <div className="card" style={{ padding: '24px', display: 'grid', gap: '20px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>{isLogin ? t('auth_welcome') : t('auth_create')}</h2>
        
        {error && <div className="err" role="alert">{error}</div>}
        
        <form onSubmit={handleSubmit} className="form" style={{ gap: '16px' }}>
          <label>
            {t('auth_email')}
            <input 
              type="email" 
              placeholder="you@example.com" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              style={{ border: '1px solid var(--line)', background: 'var(--app)', borderRadius: '12px', padding: '12px', fontSize: '16px', color: 'var(--ink)', width: '100%', marginTop: '6px' }}
            />
          </label>
          <label>
            {t('auth_password')}
            <input 
              type="password" 
              placeholder="••••••••" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ border: '1px solid var(--line)', background: 'var(--app)', borderRadius: '12px', padding: '12px', fontSize: '16px', color: 'var(--ink)', width: '100%', marginTop: '6px' }}
            />
          </label>
          {!isLogin && (
            <label>
              {t('auth_confirm')}
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ border: '1px solid var(--line)', background: 'var(--app)', borderRadius: '12px', padding: '12px', fontSize: '16px', color: 'var(--ink)', width: '100%', marginTop: '6px' }}
              />
            </label>
          )}
          <button className="btn pri full" type="submit" disabled={busy} style={{ marginTop: '4px' }}>
            {busy ? <span className="spin" style={{width: '20px', height: '20px', borderTopColor: 'var(--brand-ink)'}} /> : (isLogin ? t('auth_sign_in') : t('auth_sign_up'))}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <button className="link" onClick={() => { setIsLogin(!isLogin); setError(''); setConfirmPassword(''); }} type="button">
            {isLogin ? t('auth_need_acct') : t('auth_have_acct')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--muted)', fontSize: '14px', margin: '8px 0' }}>
          <div style={{ flex: 1, borderTop: '1px solid var(--line)' }}></div>
          {t('auth_or')}
          <div style={{ flex: 1, borderTop: '1px solid var(--line)' }}></div>
        </div>

        <button className="btn sec full" type="button" onClick={handleGoogle} disabled={busy} style={{ display: 'flex', gap: '10px' }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          {t('auth_google')}
        </button>
      </div>
    </div>
  );
}
