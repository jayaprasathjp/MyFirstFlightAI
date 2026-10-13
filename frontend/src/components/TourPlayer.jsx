import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n'
import { pauseSpeaking, resumeSpeaking, speak, speakToEnd, stopSpeaking } from '../voice'

const MIN_MS = 4000 // shortest time a scene stays on screen
const TICK_MS = 100

// Rough reading time, used when there is no voice (muted, or the phone cannot speak).
const estimate = (text) => Math.max(MIN_MS, text.length * 70)

const STEPS = ['travellers', 'check', 'contacts', 'checklist', 'journey']

// Renders children inside a phone-width iframe (so the app's mobile layout applies, not the desktop one),
// with the app's styles copied in. Read-only: the content is inert and takes no taps.
export function PhoneFrame({ className, children, onDoc }) {
  const [doc, setDoc] = useState(null)
  const setup = (e) => {
    const d = e.currentTarget.contentDocument
    if (!d?.head || d.head.dataset.ready) return
    d.head.dataset.ready = '1'
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => d.head.appendChild(n.cloneNode(true)))
    for (const a of document.documentElement.attributes) d.documentElement.setAttribute(a.name, a.value)
    d.body.setAttribute('inert', '')
    setDoc(d)
    onDoc?.(d)
  }
  return (
    <span className={className} aria-hidden="true">
      <iframe title="" tabIndex={-1} srcDoc="<!doctype html><html><head></head><body></body></html>" onLoad={setup} />
      {doc && createPortal(children, doc.body)}
    </span>
  )
}

// A real app screen in a phone frame, scrolled slowly from top to bottom as the scene plays.
function Phone({ step, progress, children }) {
  const { t } = useI18n()
  const docRef = useRef(null)
  const want = useRef(0)
  want.current = progress
  useEffect(() => {
    let id
    const loop = () => {
      const d = docRef.current
      // Overlays (Help, I'm Lost) scroll inside themselves; pages scroll the whole page.
      const el = d && (d.querySelector('.sheet, .lost') || d.scrollingElement)
      if (el) {
        const share = Math.min(1, Math.max(0, (want.current - 0.15) / 0.7)) // hold the top a moment, end before the scene does
        el.scrollTop += ((el.scrollHeight - el.clientHeight) * share - el.scrollTop) * 0.08
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <PhoneFrame className="tv-phone" onDoc={(d) => { docRef.current = d }}>
      <div className="app">
        <header className="top"><div className="brand"><span className="mark">✈</span><span>MyFirstFlightAI</span></div></header>
        {step != null && ( // no step bar before login (language page)
          <nav className="stepper">
            {STEPS.map((s, n) => (
              <button key={s} className={n === step ? 'on' : n < step ? 'past' : ''}><i>{n + 1}</i><span>{t('step_' + s)}</span></button>
            ))}
          </nav>
        )}
        <main className="screen">{children}</main>
      </div>
    </PhoneFrame>
  )
}

// Narrated player: plays scenes of real app screens ({id, step, screen, title, body, say}) one after another,
// each moving on when its voice-over ends.
export default function TourPlayer({ heading, scenes, endTitle, onClose, onDone, doneLabel }) {
  const { t, lang } = useI18n()
  const count = scenes.length
  const [pos, setPos] = useState({ i: 0 }) // a new object restarts the scene, even at the same index
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const closeRef = useRef(null)
  const live = useRef({}) // values the timer reads without re-subscribing
  live.current = { ...live.current, scenes, count, i: pos.i, playing, muted }
  const timing = useRef({ elapsed: 0, doneAt: Infinity, token: 0 })

  const i = pos.i
  const ended = i >= count
  const go = (n) => {
    if (!playing) { resumeSpeaking(); setPlaying(true) } // jumping to a scene plays it
    setPos({ i: Math.max(0, Math.min(n, count)) })
  }

  // Narrate the current scene; the scene ends a moment after the voice does.
  const narrate = (scene) => {
    const tm = timing.current
    const token = ++tm.token
    if (live.current.muted) { tm.doneAt = estimate(scene.say); return }
    tm.doneAt = Infinity
    speakToEnd(scene.say, lang).then((ok) => {
      if (token === tm.token) tm.doneAt = ok ? tm.elapsed + 600 : estimate(scene.say)
    })
  }

  useEffect(() => {
    const tm = timing.current
    tm.elapsed = 0
    setProgress(0)
    if (i >= live.current.count) {
      tm.token++
      if (!live.current.muted) speak(endTitle, lang)
      return
    }
    narrate(live.current.scenes[i])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos])

  useEffect(() => {
    const id = setInterval(() => {
      const { playing, i, count, scenes } = live.current
      const tm = timing.current
      if (!playing || i >= count) return
      tm.elapsed += TICK_MS
      const est = estimate(scenes[i].say)
      const target = Math.max(MIN_MS, tm.doneAt === Infinity ? est : tm.doneAt)
      setProgress(Math.min(tm.doneAt === Infinity ? 0.97 : 1, tm.elapsed / target))
      // Next scene when the voice is done, or if it never reports done (blocked audio).
      if (tm.elapsed >= Math.max(MIN_MS, tm.doneAt) || (tm.doneAt === Infinity && tm.elapsed > est * 2.5)) {
        tm.elapsed = 0
        tm.doneAt = Infinity
        setPos({ i: i + 1 })
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
      stopSpeaking()
    }
  }, [onClose])

  const togglePlay = () => {
    if (playing) pauseSpeaking()
    else resumeSpeaking()
    setPlaying(!playing)
  }
  const toggleSound = () => {
    const next = !muted
    setMuted(next)
    live.current.muted = next
    const tm = timing.current
    if (next) {
      tm.token++
      stopSpeaking()
      tm.doneAt = tm.elapsed + 1500 // a moment to finish reading
    } else if (!ended) {
      setPlaying(true)
      tm.elapsed = 0
      narrate(scenes[i])
    }
  }

  const sc = scenes[i]
  return createPortal(
    <div
      className="tripvideo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="tripvideo">
        <div className="tv-head">
          <h2>📱 {heading}</h2>
          <button ref={closeRef} className="btn sec tv-x" onClick={onClose} aria-label={t('close')}>✕</button>
        </div>
        <div className="dots">
          {scenes.map((x, n) => (
            <button key={x.id} aria-label={t('step_of', { n: n + 1, t: count }) + ': ' + x.title}
              className={n === i ? 'on' : n < i || ended ? 'past' : ''} onClick={() => go(n)} />
          ))}
        </div>
        <div className="tv-bar" aria-hidden="true"><i style={{ width: `${(ended ? 1 : progress) * 100}%` }} /></div>

        {ended ? (
          <div className="tv-scene tv-end" key="end">
            <div className="arrived-tick-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="arrived-tick">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2>{endTitle}</h2>
            <div className="nav2">
              <button className="btn sec" onClick={() => go(0)}>↺ {t('video_replay')}</button>
              <button className="btn pri" onClick={onDone}>{doneLabel}</button>
            </div>
          </div>
        ) : (
          <div className="tv-scene tv-tour" key={`${i}-${sc.id}`} aria-live="polite">
            <Phone step={sc.step} progress={progress}>{sc.screen}</Phone>
            <div className="stepno">{t('step_of', { n: i + 1, t: count })}</div>
            <h2>{sc.title}</h2>
            <p className="tv-body">{sc.body}</p>
          </div>
        )}

        {!ended && (
          <div className="tv-ctrl">
            <button className="btn sec" onClick={() => go(i - 1)} disabled={i === 0} aria-label={t('video_prev')}>⏮</button>
            <button className="btn pri" onClick={togglePlay} aria-label={playing ? t('video_pause') : t('video_play')}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button className="btn sec" onClick={() => go(i + 1)} aria-label={t('video_next')}>⏭</button>
            <button className="btn sec" onClick={toggleSound} aria-label={muted ? t('video_sound_on') : t('video_sound_off')}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
