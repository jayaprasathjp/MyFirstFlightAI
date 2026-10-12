import { useRef, useState } from 'react'
import { api, errorText } from '../api'
import { useI18n } from '../i18n'
import { LANGUAGES } from '../strings'
import { stopSpeaking, useRecorder } from '../voice'
import Listen from '../components/Listen'
import Icon from '../components/Icon'

const SAY_MS = 6000 // naming a language takes a few seconds; stop by itself after that

// "Say your language": record, let Gemini name the language, then ask to confirm (a wrong guess is one tap away).
export function VoicePick({ onPick }) {
  const { t } = useI18n()
  const { recording, start, stop } = useRecorder()
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState(null) // language object to confirm
  const [msg, setMsg] = useState('')
  const timer = useRef(null)

  const finish = async () => {
    clearTimeout(timer.current)
    const audio = await stop()
    if (!audio?.size) return
    setBusy(true)
    try {
      const r = await api.pickLanguage(audio)
      const l = LANGUAGES.find((x) => x.code === r.code)
      if (l) setFound(l)
      else setMsg(t('lang_voice_fail'))
    } catch (e) {
      setMsg(errorText(e, t))
    } finally {
      setBusy(false)
    }
  }
  const mic = async () => {
    if (recording) return finish()
    setFound(null)
    setMsg('')
    stopSpeaking() // the mic must not record the app's own voice
    try {
      await start()
      timer.current = setTimeout(finish, SAY_MS)
    } catch {
      setMsg(t('lang_mic_denied'))
    }
  }

  return (
    <section className="card voicepick">
      <button className={'micbtn' + (recording ? ' rec' : '')} onClick={mic} disabled={busy}
        aria-label={recording ? t('listening') : t('lang_voice')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
      <div role="status">
        <b>{recording ? t('listening') : t('lang_voice')}</b>
        <span className="muted">
          {busy ? <><span className="spin" aria-hidden="true"></span> {t('thinking')}</> : recording ? '' : t('lang_voice_hint')}
        </span>
      </div>
      <Listen text={() => t('lang_choose_below', { list: LANGUAGES.map((l) => l.english).join(', ') })} toast={() => {}} />
      {found && (
        <div className="vp-found">
          <span><b lang={found.code}>{found.native}</b> <small>{found.english}</small></span>
          <div className="row2">
            <button className="btn pri" onClick={() => { onPick(found.code); setFound(null) }}>✓ {t('continue')}</button>
            <button className="btn sec" onClick={mic}>🎤 {t('lang_voice_again')}</button>
          </div>
        </div>
      )}
      {msg && <div className="err" role="alert">{msg}</div>}
    </section>
  )
}

// Read out which languages there are and how to choose one (on 🔊 only, never by itself).
function LanguagesIntro() {
  const { t } = useI18n()
  const text = `${t('choose_language')}. ${t('lang_intro', { list: LANGUAGES.map((l) => l.english).join(', ') })}`
  return <Listen text={text} toast={noop} />
}
const noop = () => {}

export default function LanguageScreen({ onPick, busy, toast, onStory, voice }) {
  const { lang, t } = useI18n()
  return (
    <>
      <div className="gh">
        <h2>{t('choose_language')}</h2>
        {voice ? <LanguagesIntro /> : <Listen text={`${t('choose_language')}. ${t('choose_language_hint')}`} toast={toast} />}
      </div>
      <p className="muted">{t('choose_language_hint')}</p>
      {onStory && <button className="btn sec full storybtn" onClick={onStory}><Icon name="speaker" /> {t('story_title')}</button>}
      {voice && <VoicePick onPick={onPick} />}
      <div className="langs">
        {LANGUAGES.map((l) => (
          <button key={l.code} className={l.code === lang ? 'on' : ''} disabled={busy} onClick={() => onPick(l.code)}>
            <b lang={l.code}>{l.native}</b>
            <span>{l.english}</span>
          </button>
        ))}
      </div>
    </>
  )
}
