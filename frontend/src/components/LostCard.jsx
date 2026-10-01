import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../api'
import { EN } from '../strings'
import { useI18n } from '../i18n'

// Field label: English for staff, with the user's language underneath.
function Label({ k }) {
  const { lang, t } = useI18n()
  return <>{EN[k]}{lang !== 'en' && <small>{t(k)}</small>}</>
}

// Big card for airport staff. English first (staff read English), the user's language underneath.
// Built only from the trip cached on the phone, so it works without internet.
export default function LostCard({ trip, onTrip, onClose, toast }) {
  const { lang, t } = useI18n()
  const [who, setWho] = useState(0)
  const closeRef = useRef(null)
  const person = trip.travellers[who] || trip.travellers[0]
  const s = trip.summary || {}
  const flight = (s.flights || []).join(' + ')
  const gate = trip.boarding?.gate
  const boardingTime = trip.boarding?.boarding_time

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const [alerting, setAlerting] = useState(false)
  const alertDesk = async () => {
    setAlerting(true)
    try {
      const r = await api.assist(trip.id, { traveller_id: person.id, kind: 'lost', location: 'unknown' })
      onTrip(r.trip)
      toast(t('alert_sent', { id: r.request.id }))
    } catch (e) { toast(errorText(e, t)) } finally { setAlerting(false) }
  }

  const readAloud = () => {
    const text = `I am a first time traveller. Please help me. My name is ${person.name}. My flight is ${flight} to ${s.destination_city || ''}`
      + (gate ? `, gate ${gate}` : '') + (boardingTime ? `, boarding at ${boardingTime}` : '') + '.'
      + (trip.contacts[0] ? ` Please call my family, ${trip.contacts[0].name}, on ${trip.contacts[0].phone.replace(/(\d)/g, '$1 ')}.` : '')
    try {
      const voices = speechSynthesis.getVoices()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-IN'
      u.voice = voices.find((v) => /en[-_]IN/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang)) || null
      u.rate = 0.9
      speechSynthesis.cancel()
      speechSynthesis.speak(u)
    } catch {
      toast(t('no_voice'))
    }
  }

  return (
    <div className="lost" role="dialog" aria-modal="true" aria-label={t('lost')}>
      <div className="head">
        <strong lang="en">I AM A FIRST-TIME TRAVELLER. PLEASE HELP ME.</strong>
        {lang !== 'en' && <span>{t('lost_line')}</span>}
      </div>
      {trip.travellers.length > 1 && (
        <div className="whotabs">
          {trip.travellers.map((p, i) => <button key={p.id} className={i === who ? 'on' : ''} onClick={() => setWho(i)}>{p.name}</button>)}
        </div>
      )}
      <div className="lostgrid">
        <div><span><Label k="l_name" /></span><b>{person.name}</b></div>
        <div><span><Label k="l_flight" /></span><b className="m">{flight} → {s.destination_city || s.destination_code}</b></div>
        <div><span><Label k="l_gate" /></span><b className="m">{gate || <em>{t('on_pass')}</em>}</b></div>
        <div><span><Label k="l_boarding" /></span><b className="m">{boardingTime || <em>{t('on_pass')}</em>}</b></div>
        <div><span><Label k="l_help" /></span><b className="help">{EN.help_val}{lang !== 'en' && <small>{t('help_val')}</small>}</b></div>
      </div>
      <section className="family">
        <h3><Label k="l_family" /></h3>
        {trip.contacts.length === 0 && <p className="muted">{t('no_contacts')}</p>}
        {trip.contacts.map((c) => (
          <a key={c.phone} className="callrow" href={`tel:${c.phone.replace(/[^+0-9]/g, '')}`}>
            <span><span><b>{c.name}</b>{c.relation && <small> ({c.relation})</small>}</span><span className="m">{c.phone}</span></span>
            <span className="callbtn">📞 {t('call')}</span>
          </a>
        ))}
      </section>
      <button className="btn pri full" onClick={readAloud}>🔊 {t('read_aloud')}</button>
      <button className="btn sec full alertbtn" onClick={alertDesk} disabled={alerting}>🚨 {t('alert_desk')}</button>
      <button ref={closeRef} className="btn sec full" onClick={onClose}>{t('close')}</button>
    </div>
  )
}
