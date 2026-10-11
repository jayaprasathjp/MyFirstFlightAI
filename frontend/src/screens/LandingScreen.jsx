import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { LANGUAGES } from '../strings'
import { store } from '../api'
import { speak, stopSpeaking } from '../voice'
import Listen from '../components/Listen'
import Icon from '../components/Icon'
import { GlobeView } from '../components/Stage'
import { sampleRoute, SAMPLE_COUNT } from '../sampleRoutes'

const STEPS = [
  ['camera', 'land_s1_t', 'land_s1_d'],
  ['check', 'land_s2_t', 'land_s2_d'],
  ['calendar', 'land_s3_t', 'land_s3_d'],
  ['route', 'land_s4_t', 'land_s4_d'],
  ['help', 'land_s5_t', 'land_s5_d'],
]

// The front page for anyone not signed in: what the app does, in the visitor's language, every part readable aloud.
export default function LandingScreen({ onStart, onStory, onLanguage, toast }) {
  const { t, lang } = useI18n()
  const hero = `${t('land_title')} ${t('land_sub')}`
  // the globe flies from a home airport for the chosen language, to a new destination every few seconds
  const [n, setN] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setN((x) => (x + 1) % SAMPLE_COUNT), 9000)
    return () => clearInterval(id)
  }, [])
  const pick = sampleRoute(lang, n)
  // the same object while the airports are the same, so a language change doesn't restart the globe
  const route = useMemo(() => pick, [pick.origin_code, pick.destination_code]) // eslint-disable-line react-hooks/exhaustive-deps
  // "Read to me": the opening lines are read when the page opens (after the first tap anywhere, as browsers require)
  useEffect(() => {
    if (!store.get('mff-ui-auto', true)) return
    const id = setTimeout(() => speak(hero, lang), 1200)
    return () => { clearTimeout(id); stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  return (
    <main className="landing">
      <section className="land-hero">
        <div className="land-copy">
          <h1>{t('land_title')}</h1>
          <p>{t('land_sub')}</p>
          <div className="land-ctas">
            <button className="btn pri" onClick={onStart}>{t('land_start')} →</button>
            <button className="btn sec storybtn" onClick={onStory}>▶ {t('story_title')}</button>
            <Listen text={hero} toast={toast} />
          </div>
        </div>
        <div className="land-globe" aria-hidden="true"><GlobeView summary={route} /></div>
      </section>

      <section className="land-band">
        <div className="gh"><h2>{t('land_langs')}</h2><Listen text={`${t('land_langs')}. ${t('land_langs_d')}`} toast={toast} /></div>
        <p className="muted">{t('land_langs_d')}</p>
        <div className="land-langs">
          {LANGUAGES.map((l) => (
            <button key={l.code} className={l.code === lang ? 'on' : ''} lang={l.code} onClick={() => onLanguage(l.code)} aria-pressed={l.code === lang}>{l.native}</button>
          ))}
        </div>
      </section>

      <section className="land-band">
        <div className="gh"><h2>{t('land_how')}</h2><Listen text={[t('land_how'), ...STEPS.map(([, a, b]) => `${t(a)}. ${t(b)}`)].join('. ')} toast={toast} /></div>
        <ol className="land-steps">
          {STEPS.map(([icon, a, b], i) => (
            <li key={a}>
              <span className="land-n" aria-hidden="true"><Icon name={icon} size={26} /></span>
              <div><b>{i + 1}. {t(a)}</b><p>{t(b)}</p></div>
              <Listen text={`${t(a)}. ${t(b)}`} toast={toast} />
            </li>
          ))}
        </ol>
      </section>

      <section className="land-band land-family">
        <span className="land-n" aria-hidden="true"><Icon name="family" size={28} /></span>
        <div>
          <div className="gh"><h2>{t('land_family')}</h2><Listen text={`${t('land_family')}. ${t('land_family_d')}`} toast={toast} /></div>
          <p>{t('land_family_d')}</p>
        </div>
      </section>

      <section className="land-end">
        <button className="btn pri" onClick={onStart}>{t('land_start')} →</button>
      </section>
    </main>
  )
}
