import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useI18n } from '../i18n';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthScreen({ onLogged }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [confirmResult, setConfirmResult] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { requestPhoneOtp, loginWithGoogle } = useAuth();
  const { t } = useI18n();
  // Generate a unique ID for this mount so Firebase doesn't trip over old detached DOM nodes
  const [recaptchaId] = useState(() => 'recaptcha-' + Math.random().toString(36).substring(2, 9));

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, []);

  const handleError = (err) => {
    setError(err.message || t('err_auth_default'));
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaId, {
          size: 'invisible'
        });
        await window.recaptchaVerifier.render();
      }
      const confirmation = await requestPhoneOtp(phoneNumber, window.recaptchaVerifier);
      setConfirmResult(confirmation);
      setMessage(t('auth_otp_sent'));
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-phone-number') {
        setError(t('err_auth_invalid_phone'));
      } else {
        handleError(err);
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await confirmResult.confirm(code);
      if (onLogged) onLogged();
    } catch (err) {
      console.error(err);
      setError(t('err_auth_invalid_otp'));
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
      <div id={recaptchaId}></div>
      <div className="card" style={{ padding: '24px', display: 'grid', gap: '20px', maxWidth: '420px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>{t('auth_sign_in_up')}</h2>
        <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--muted)', marginTop: '-12px' }}>
          {t('auth_phone_desc')}
        </p>
        
        {error && <div className="err" role="alert">{error}</div>}
        {message && <div style={{ color: 'var(--ok)', background: 'var(--ok-soft)', padding: '10px 12px', borderRadius: '12px', fontWeight: '600', fontSize: '15px' }} role="status">{message}</div>}
        
        {!confirmResult ? (
          <form onSubmit={handleSendOtp} className="form" style={{ gap: '16px' }}>
            <label>
              {t('auth_phone')}
              <input 
                type="tel" 
                placeholder={t('auth_phone_placeholder')}
                required 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ border: '1px solid var(--line)', background: 'var(--app)', borderRadius: '12px', padding: '12px', fontSize: '16px', color: 'var(--ink)', width: '100%', marginTop: '6px' }}
              />
            </label>
            
            <button className="btn pri full" type="submit" disabled={busy} style={{ marginTop: '4px' }}>
              {busy ? <span className="spin" style={{width: '20px', height: '20px', borderTopColor: 'var(--brand-ink)'}} /> : t('auth_send_otp')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="form" style={{ gap: '16px' }}>
            <label>
              {t('auth_otp')}
              <input 
                type="text" 
                placeholder={t('auth_otp_placeholder')}
                required 
                value={code} 
                onChange={(e) => setCode(e.target.value)}
                style={{ border: '1px solid var(--line)', background: 'var(--app)', borderRadius: '12px', padding: '12px', fontSize: '16px', color: 'var(--ink)', width: '100%', marginTop: '6px' }}
              />
            </label>
            
            <button className="btn pri full" type="submit" disabled={busy} style={{ marginTop: '4px' }}>
              {busy ? <span className="spin" style={{width: '20px', height: '20px', borderTopColor: 'var(--brand-ink)'}} /> : t('auth_verify_otp')}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button className="link" onClick={() => { setConfirmResult(null); setError(''); setMessage(''); setCode(''); }} type="button">
                {t('back')}
              </button>
            </div>
          </form>
        )}

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
