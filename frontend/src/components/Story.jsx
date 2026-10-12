import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { LANGUAGES } from '../strings'
import { speak, stopSpeaking, subscribeSpeaking, getSpeakingKey } from '../voice'
import { useRoute, hasWebGL } from './Stage'
import Icon from './Icon'
import { sampleRoute } from '../sampleRoutes'

const LINES = 11 // story_1 … story_11, one per chapter
const SAMPLE_STEPS = ['entry', 'checkin', 'emigration', 'security', 'gate', 'arrival'].map((id) => ({ id, title: id }))
const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// "See how it works": a narrated 3D story of a first flight, from photographing papers at home to arriving.
// Uses the signed-in traveller's own trip when there is one; otherwise an example from the home airport for their language.
export default function Story({ trip, onClose, onLanguage }) {
  const { t, lang } = useI18n()
  const [stage, setStage] = useState('start') // start → play → end
  const [caption, setCaption] = useState('')
  const host = useRef(null), globeHost = useRef(null), bar = useRef(null)
  const talking = useRef(false)
  // their own trip when signed in; otherwise an example from the home airport for their language
  const summary = useMemo(() => (trip?.summary?.origin_code ? trip.summary : sampleRoute(lang, 0)), [trip, lang])
  const route = useRoute(summary)

  // everything the story shows, from the trip (or the sample)
  const data = useMemo(() => {
    const steps = trip?.journey?.length ? trip.journey : SAMPLE_STEPS
    const ids = steps.map((s) => s.id)
    const gateIdx = ids.includes('gate') ? ids.indexOf('gate') : Math.max(0, ids.findIndex((id) => /arrival|baggage|transit/.test(id)) - 1)
    const arrivalIdx = ids.indexOf('arrival') >= 0 ? ids.indexOf('arrival') : null
    const first = trip?.travellers?.[0]?.name?.split(' ')[0]
    return {
      steps, gateIdx, arrivalIdx,
      from: summary.origin_code, to: summary.destination_code, dest: summary.destination_city, flight: summary.flights?.[0],
      placard: first ? first.toUpperCase() : 'WELCOME',
      info: { flight: summary.flights?.[0], dest: summary.destination_city, time: summary.departure_time, airline: steps.find((s) => s.id === 'checkin')?.where?.[0], gate: trip?.boarding?.gate },
    }
  }, [trip, summary])

  // speak a line; `talking` stays true until the voice has finished, so the story waits for it
  const lineId = useRef(0)
  const say = (text) => {
    const id = ++lineId.current
    talking.current = true
    let started = false, guard = 0
    const done = () => { if (lineId.current === id) talking.current = false; un(); clearTimeout(guard) }
    const un = subscribeSpeaking(() => { if (getSpeakingKey() === 'story') started = true; else if (started) done() })
    guard = setTimeout(done, 15000) // never wait forever on one line
    speak(text, lang, 'story').then((ok) => { if (!ok) done() })
  }

  useEffect(() => {
    if (stage !== 'play') return
    let story, globe, globeMade = false, gone = false, ticker
    const still = reduced() || !hasWebGL()
    const chapterLine = (i) => { if (i < LINES) { const line = t(`story_${i + 1}`); setCaption(line); say(line) } }
    if (!hasWebGL()) { // no 3D on this phone: the story is told in words and voice alone
      let i = 0; chapterLine(0)
      ticker = setInterval(() => { if (!talking.current && ++i <= LINES) { if (i === LINES) setStage('end'); else chapterLine(i) } }, 1200)
      return () => { clearInterval(ticker); stopSpeaking() }
    }
    import('../three/story').then(({ createStory, CHAPTERS, GLOBE_FROM, GLOBE_TO }) => {
      if (gone) return
      story = createStory(host.current, {
        data, labels: { ready: t('ready_title') }, still,
        shouldHold: () => talking.current,
        onChapter: chapterLine,
        onEnd: () => setStage('end'),
        onLost: () => setStage('end'), // the browser dropped 3D (low graphics memory): go to the end card, never a white screen
        onTime: (T) => {
          if (bar.current) bar.current.style.width = `${Math.min(100, (T / CHAPTERS[CHAPTERS.length - 1]) * 100)}%`
          // the flight is shown on the globe, faded in over the plane at the gate and out into arrivals
          if (route && !globeMade && T >= GLOBE_FROM - 0.5) {
            globeMade = true
            import('../three/globe').then((m) => { if (!gone) globe = m.createGlobe(globeHost.current, { from: route.from, to: route.to, km: route.km, mode: 'flight', duration: GLOBE_TO - GLOBE_FROM - 1, still }) })
          }
          if (globeHost.current) globeHost.current.style.opacity = Math.max(0, Math.min(1, T - GLOBE_FROM, GLOBE_TO - T))
          if (globe && T > GLOBE_TO + 0.2) { globe.dispose(); globe = null } // landed: free its graphics memory
        },
      })
      if (still) { // reduced motion: one settled frame per chapter, moving on when the voice is done
        let i = 0
        const show = () => story.goTo(CHAPTERS[i] + (CHAPTERS[i + 1] - CHAPTERS[i]) * 0.85)
        show()
        ticker = setInterval(() => { if (!talking.current) { if (++i >= LINES) { clearInterval(ticker); setStage('end') } else show() } }, 1500)
      }
    }).catch(() => setStage('end'))
    return () => { gone = true; clearInterval(ticker); story?.dispose(); globe?.dispose(); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  return (
    <div className="story" role="dialog" aria-modal="true" aria-label={t('story_title')}>
      {stage === 'start' && (
        <div className="story-card">
          <div className="story-mark" aria-hidden="true"><Icon name="speaker" size={34} /></div>
          <h2>{t('story_title')}</h2>
          <p>{t('story_sub')}</p>
          <label className="story-lang">
            <span>{t('language_label')}</span>
            <select className="lang" value={lang} onChange={(e) => onLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}</option>)}
            </select>
          </label>
          <button className="btn pri full" onClick={() => setStage('play')} autoFocus>▶ {t('story_play')}</button>
          <button className="btn sec full" onClick={onClose}>{t('skip')}</button>
        </div>
      )}
      {stage === 'play' && (
        <>
          <div className="story-scene" ref={host} />
          <div className="story-scene story-globe" ref={globeHost} style={{ opacity: 0 }} />
          <div className="story-bar"><i ref={bar} /></div>
          <button className="btn sec story-skip" onClick={onClose}>{t('skip')}</button>
          {caption && <p className="story-caption" aria-live="polite">{caption}</p>}
        </>
      )}
      {stage === 'end' && (
        <div className="story-card">
          <div className="story-mark" aria-hidden="true">✈</div>
          <h2>{t('story_end')}</h2>
          <button className="btn pri full" onClick={onClose} autoFocus>{t('story_start')} →</button>
          <button className="btn sec full" onClick={() => { setCaption(''); setStage('start'); setTimeout(() => setStage('play'), 0) }}>{t('story_replay')}</button>
        </div>
      )}
    </div>
  )
}
