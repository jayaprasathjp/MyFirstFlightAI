import { useId, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { speak, stopSpeaking, subscribeSpeaking, getSpeakingKey } from '../voice'

// Read-aloud button: for someone who can speak and understand but not read.
// `text` may be a string or a function returning one, so callers can build it lazily.
// `lang` overrides the app language (used for the English phrases staff will hear).
// Tap again while it is playing to stop.
export default function Listen({ text, toast, className = '', lang: forceLang, label }) {
  const { lang, t } = useI18n()
  const id = useId()
  const playing = useSyncExternalStore(subscribeSpeaking, () => getSpeakingKey() === id)
  const play = async (e) => {
    e.preventDefault(); e.stopPropagation() // safe inside a <label> or a row that has its own onClick
    if (playing) return stopSpeaking()
    const value = typeof text === 'function' ? text() : text
    if (!value) return
    if (!(await speak(value, forceLang || lang, id))) toast?.(t('no_voice'))
  }
  return (
    <button type="button" className={`listenbtn ${playing ? 'playing' : ''} ${className}`} aria-label={label || t('read_aloud')}
      aria-pressed={playing} onClick={play}>
      {playing ? (
        <span className="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
        </svg>
      )}
      {forceLang === 'en' && !playing && <b className="listenlang" aria-hidden="true">EN</b>}
    </button>
  )
}
