import { useI18n } from '../i18n'
import { speak } from '../voice'

// What the live status means for the traveller. No live data (not travel day yet, or a test flight the API
// does not know) counts as on time: nothing has changed. Delays under 15 minutes count as on time too.
export function flightState(status) {
  const s = status?.status
  if (s === 'cancelled') return { kind: 'bad', key: 'fs_cancelled' }
  if (s === 'diverted' || s === 'incident') return { kind: 'warn', key: 'fs_check' }
  if ((status?.delay_min || 0) >= 15) return { kind: 'warn', key: 'fs_delayed', n: status.delay_min, time: status.estimated }
  if (s === 'landed') return { kind: 'ok', key: 'fs_landed' }
  if (s === 'active') return { kind: 'ok', key: 'fs_inair' }
  return { kind: 'ok', key: 'fs_ontime' }
}

// Top bar: "✈ SU 572 · On time". Tap to hear it (voice only on tap).
export default function FlightChip({ flight, status }) {
  const { t, lang } = useI18n()
  const st = flightState(status)
  const label = t(st.key, { n: st.n })
  const say = () => {
    const more = st.time ? ` ${t('fs_new_time', { time: st.time })}` : ''
    speak(`${t('fs_say', { flight, status: label })}.${more}`, lang)
  }
  return (
    <button type="button" className={'flightchip ' + st.kind} onClick={say} aria-label={`${t('fs_title')}: ${flight}, ${label}`}
      title={t('fs_title')}>
      <span className="fc-dot" aria-hidden="true"></span>
      <span className="fc-flight">✈ {flight}</span>
      <b>{label}</b>
    </button>
  )
}
