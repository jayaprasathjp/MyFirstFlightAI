import { useCallback, useEffect, useState } from 'react'
import { store } from '../api'
import { useI18n } from '../i18n'
import { stopSpeaking, speak } from '../voice'
import Listen from '../components/Listen'
import { FlightScene } from '../components/Stage'
import { useStage } from '../StageContext'

function BoardingForm({ boarding, onSave, busy }) {
  const { t } = useI18n()
  const [gate, setGate] = useState(boarding.gate || '')
  // Until the real time is saved, start from the estimate (45 min before departure) so the field is never empty.
  const [time, setTime] = useState(boarding.boarding_time || boarding.boarding_estimate || '')
  const saved = gate === (boarding.gate || '') && time === (boarding.boarding_time || '') && (gate || time)
  const estimated = !boarding.boarding_time && boarding.boarding_estimate && time === boarding.boarding_estimate
  return (
    <div className="card form boardingform">
      <h3>{t('boarding_title')}</h3>
      <div className="row2 even">
        <label>{t('gate')}<input type="text" value={gate} maxLength={8} placeholder="B7" onChange={(e) => setGate(e.target.value)} /></label>
        <label>{t('boarding_time')}<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      {estimated && <small className="muted">{t('boarding_estimated')}</small>}
      <button className="btn sec" disabled={busy || saved} onClick={() => onSave(gate.trim(), time)}>
        {saved ? '✓ ' + t('saved') : t('save')}
      </button>
    </div>
  )
}

export default function JourneyScreen({ trip, onSaveBoarding, busy, toast, auto }) {
  const { t, lang } = useI18n()
  const steps = trip.journey
  const key = `mff-jstep-${trip.id}`
  const [n, setN] = useState(() => Math.min(store.get(key, 0), steps.length - 1))
  const [big, setBig] = useState(false)
  const [showArrived, setShowArrived] = useState(false)
  const [flying, setFlying] = useState(false)
  const { setJstep } = useStage()
  const landed = useCallback(() => { setFlying(false); setShowArrived(true); speak(t('arrived'), lang) }, [t, lang])
  const go = (i) => { stopSpeaking(); setN(i); store.set(key, i); window.scrollTo({ top: 0 }) }
  useEffect(() => stopSpeaking, []) // stop reading if the traveller leaves this screen mid-playback
  useEffect(() => { setJstep(n); return () => setJstep(0) }, [n, setJstep]) // moves the dot on the floor plan
  const s = steps[n]
  const last = n === steps.length - 1
  const stepText = () => s && [s.title, ...s.where, ...s.do,
    ...s.qa.map((x) => [`${t('they_ask')}: ${x.q}. ${t('you_say')}: ${x.a}`,
      ...(x.alts || []).map((alt) => `${t('or_say')}: ${alt.tr}`)].join('. '))].join('. ')
  // "Read to me": each airport step is read aloud when it opens.
  useEffect(() => {
    if (!auto || !s || flying || showArrived) return
    const id = setTimeout(() => speak(stepText(), lang), 1000)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, n, lang])
  if (!s) return null

  return (
    <>
      <h2>{t('journey_title')}</h2>
      <div className="dots" role="tablist">
        {steps.map((x, i) => (
          <button key={x.id} role="tab" aria-selected={i === n} aria-label={t('step_of', { n: i + 1, t: steps.length }) + ': ' + x.title}
            className={i === n ? 'on' : i < n ? 'past' : ''} onClick={() => go(i)} />
        ))}
      </div>
      <article className="stepcard">
        <div className="gh">
          <div className="stepno">{t('step_of', { n: n + 1, t: steps.length })}</div>
          <Listen text={stepText} toast={toast} />
        </div>
        <h2>{s.title}</h2>
        {s.where.length > 0 && <div className="where">{s.where.map((w) => <span key={w}>{w}</span>)}</div>}
        <ul className="do">{s.do.map((d) => <li key={d}><span>{d}</span><Listen text={d} toast={toast} /></li>)}</ul>
        {s.qa.length > 0 && (
          <div className="qa">
            <h3>{t('they_ask')}</h3>
            {s.qa.map((x) => (
              <div key={x.q_en}>
                <div className="qline">
                  <div><q lang="en">{x.q_en}</q>{x.q !== x.q_en && <span className="loc">{x.q}</span>}</div>
                  <span className="qbtns">
                    {x.q !== x.q_en && <Listen text={x.q} toast={toast} />}
                    <Listen text={x.q_en} lang="en" toast={toast} />
                  </span>
                </div>
                <div className="qline">
                  <div><span className="ans">{t('you_say')}: <b lang="en">{x.a_en}</b></span>
                  {x.a !== x.a_en && <span className="loc">{x.a}</span>}</div>
                  <span className="qbtns">
                    {x.a !== x.a_en && <Listen text={x.a} toast={toast} />}
                    <Listen text={x.a_en} lang="en" toast={toast} />
                  </span>
                </div>
                {x.alts?.length > 0 && (
                  <details className="alts">
                    <summary>{t('or_say')}</summary>
                    <ul>
                      {x.alts.map((alt) => (
                        <li key={alt.en}>
                          <div><b lang="en">{alt.en}</b>{alt.tr !== alt.en && <span className="loc">{alt.tr}</span>}</div>
                          <span className="qbtns">
                            {alt.tr !== alt.en && <Listen text={alt.tr} toast={toast} />}
                            <Listen text={alt.en} lang="en" toast={toast} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="sayrow">
          <button className="say" onClick={() => setBig(true)} aria-label={t('tap_big')}>
            <small>{t('show_staff')}</small>
            <b lang="en">{s.staff_en}</b>
            {s.staff !== s.staff_en && <span className="loc">{s.staff}</span>}
          </button>
          <span className="qbtns col">
            {s.staff !== s.staff_en && <Listen text={s.staff} toast={toast} />}
            <Listen text={s.staff_en} lang="en" toast={toast} />
          </span>
        </div>
      </article>
      {(s.id === 'checkin' || s.id === 'gate') && <BoardingForm key={s.id} boarding={trip.boarding} onSave={onSaveBoarding} busy={busy} />}
      <div className="nav2">
        <button className="btn sec" disabled={n === 0} onClick={() => go(n - 1)}>{t('back')}</button>
        <button className="btn pri" onClick={() => {
          if (last) {
            stopSpeaking()
            setFlying(true)
          } else {
            go(n + 1)
          }
        }}>
          {last ? t('done_btn') + ' ✓' : t('next_step') + ' →'}
        </button>
      </div>
      {big && (
        <div className="bigtext" role="dialog" aria-label={t('show_staff')} onClick={() => setBig(false)}>
          <p lang="en">{s.staff_en}</p>
          <button className="btn sec">{t('close')}</button>
        </div>
      )}
      {flying && <FlightScene trip={trip} onDone={landed} />}
      {showArrived && (
        <div className="modal-overlay" onClick={() => setShowArrived(false)}>
          <div className="modal-content arrived-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="arrived-tick-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="arrived-tick">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2 className="arrived-msg">{t('arrived')}</h2>
            <button className="btn pri full" onClick={() => setShowArrived(false)}>{t('done_btn')}</button>
          </div>
        </div>
      )}
    </>
  )
}
