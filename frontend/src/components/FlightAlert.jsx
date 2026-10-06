import { useEffect, useState } from 'react'
import { api, store } from '../api'
import { useI18n } from '../i18n'
import Listen from './Listen'

const CHECK_EVERY_MS = 10 * 60 * 1000

// Checks the trip's flight (on open, then every 10 minutes) and pops up delays, cancellations and gate changes.
// Each distinct message is shown once; it also goes to the phone's notifications if the user allowed them.
export default function FlightAlert({ tripId, toast }) {
  const { lang, t } = useI18n()
  const [alert, setAlert] = useState(null)
  const seenKey = `mff-alert-${tripId}`

  useEffect(() => {
    if (!tripId) return
    let alive = true
    const check = () => api.flightStatus(tripId).then((r) => {
      const a = r.alert
      if (!alive || !a) return
      const id = `${a.title_en}|${a.message_en}`
      if (store.get(seenKey, '') === id) return
      setAlert({ ...a, id })
      try {
        if ('Notification' in window && Notification.permission === 'granted') new Notification(a.title, { body: a.message })
      } catch { /* notifications unavailable */ }
    }).catch(() => {})
    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [tripId, seenKey])

  if (!alert) return null
  const close = () => {
    store.set(seenKey, alert.id)
    setAlert(null)
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission() } catch { /* ignore */ }
  }
  return (
    <div className="modalbg" role="alertdialog" aria-modal="true" aria-label={alert.title}>
      <div className={'flightalert ' + alert.level}>
        <div className="gh"><strong>{alert.level === 'bad' ? '⛔' : '⚠️'} {alert.title}</strong><Listen text={`${alert.title}. ${alert.message}`} toast={toast} /></div>
        <p>{alert.message}</p>
        {lang !== 'en' && <p className="muted small" lang="en">{alert.title_en}. {alert.message_en}</p>}
        <button className="btn pri full" onClick={close} autoFocus>{t('ok_got_it')}</button>
      </div>
    </div>
  )
}
