import { useState } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { auth, firebaseConfigured } from '../firebase'

export default function AuthGate({ text, language, languages, onLanguageChange }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!firebaseConfigured) return
    setBusy(true)
    try {
      if (mode === 'create') await createUserWithEmailAndPassword(auth, email.trim(), password)
      else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email.trim())
        setMessage(text.resetSent)
        return
      } else await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (reason) {
      const messages = {
        'auth/invalid-credential': text.signInError,
        'auth/email-already-in-use': text.emailInUse,
        'auth/weak-password': text.weakPassword,
        'auth/invalid-email': text.invalidEmail,
        'auth/too-many-requests': text.tryLater,
      }
      setError(messages[reason.code] || text.authError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell" lang={language}>
      <section className="auth-panel">
        <a className="brand" href="#top"><span className="brand-mark">✈</span><span>FirstFlight<span className="brand-ai"> AI</span></span></a>
        <label className="auth-language">{text.chooseLanguage}<select value={language} onChange={(event) => onLanguageChange(event.target.value)}>{languages.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}</select></label>
        <h1>{text.accountTitle}</h1>
        <p>{text.accountIntro}</p>
        <p className="auth-privacy">{text.accountPrivacy}</p>
        {!firebaseConfigured ? <p className="auth-error" role="alert">{text.firebaseMissing}</p> : (
          <form className="auth-form" onSubmit={submit}>
            <label className="field-label">{text.email}<input className="text-field" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {mode !== 'reset' && <label className="field-label">{text.password}<input className="text-field" type="password" minLength="6" autoComplete={mode === 'create' ? 'new-password' : 'current-password'} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message" role="status">{message}</p>}
            <button className="review-button" type="submit" disabled={busy}>{busy ? text.working : mode === 'create' ? text.createAccount : mode === 'reset' ? text.sendReset : text.signIn}</button>
          </form>
        )}
        {firebaseConfigured && <div className="auth-actions">
          {mode === 'signin' && <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}>{text.forgotPassword}</button>}
          <button type="button" onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(''); setMessage('') }}>{mode === 'create' ? text.haveAccount : text.needAccount}</button>
          {mode === 'reset' && <button type="button" onClick={() => { setMode('signin'); setError(''); setMessage('') }}>{text.backToSignIn}</button>}
        </div>}
      </section>
    </main>
  )
}