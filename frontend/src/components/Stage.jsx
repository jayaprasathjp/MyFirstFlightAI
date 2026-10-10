import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useStage } from '../StageContext'
import { W as MW, H as MH, TY as MTY, LAND } from '../assets/worldmap'

// Illustrated "stage" above each screen. Everything is drawn from the traveller's own trip data:
// a real map of their route, their papers on a table, their travel date, their airport route.
// Decorative only (aria-hidden); every fact on it is also in the text of the screen below.

const R = MW / (2 * Math.PI)
const project = (lat, lon) => {
  const x = ((lon + 180) / 360) * MW
  const phi = (Math.max(-80, Math.min(84, lat)) * Math.PI) / 180
  const y = MTY - R * Math.log(Math.tan(Math.PI / 4 + phi / 2))
  return [x, y]
}

// IATA table is ~120 KB, so it is loaded only when a map is first shown.
let airportsPromise = null
const loadAirports = () => {
  airportsPromise ||= import('../assets/airports').then((m) => {
    const out = {}
    for (const row of m.default.split('|')) {
      const [code, ll] = row.split(':')
      const [lat, lon] = ll.split(',').map(Number)
      out[code] = [lat, lon]
    }
    return out
  })
  return airportsPromise
}

export function useRoute(summary) {
  const [table, setTable] = useState(null)
  useEffect(() => {
    let alive = true
    loadAirports().then((t) => alive && setTable(t)).catch(() => {})
    return () => { alive = false }
  }, [])
  return useMemo(() => {
    if (!table || !summary) return null
    const o = table[(summary.origin_code || '').toUpperCase()]
    const d = table[(summary.destination_code || '').toUpperCase()]
    if (!o || !d) return null
    const a = project(...o), b = project(...d)
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const dist = Math.hypot(dx, dy)
    // lift the line into a gentle arc, always bending away from the equator-side so it reads as a flight path
    const mx = (a[0] + b[0]) / 2 - (dy / (dist || 1)) * dist * 0.12
    const my = (a[1] + b[1]) / 2 + (dx / (dist || 1)) * dist * 0.12 - dist * 0.04
    return { a, b, c: [mx, my], dist, d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}` }
  }, [table, summary])
}

function MapView({ summary, trip }) {
  const route = useRoute(summary)
  const { t } = useI18n()
  const AR = 2.1 // stage aspect ratio (width / height)
  let vb
  if (route) {
    const cx = (route.a[0] + route.b[0]) / 2, cy = (route.a[1] + route.b[1]) / 2
    const w = Math.max(route.dist * 1.55, Math.abs(route.b[1] - route.a[1]) * 1.9 * AR, 260)
    vb = [cx - w / 2, cy - w / AR / 2, w, w / AR]
  } else {
    vb = [260, 330, 1500, 1500 / AR] // wide view when the route cannot be placed
  }
  const k = vb[2] / 480 // map units per screen px
  const o = summary?.origin_code, d = summary?.destination_code
  const oc = summary?.origin_city || o, dc = summary?.destination_city || d
  const label = (p, text, anchor, dyp) => (
    <text x={p[0]} y={p[1] + dyp * k} textAnchor={anchor} fontSize={15 * k} fontWeight="700" fill="#fff"
      stroke="#0A1F3C" strokeWidth={5 * k} paintOrder="stroke" strokeLinejoin="round">{text}</text>
  )
  return (
    <svg className="stage-svg" viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid slice" role="img" aria-label={trip ? `${oc} → ${dc}` : t('step_language')}>
      <defs>
        <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B4A63" /><stop offset="1" stopColor="#0E2F47" /></linearGradient>
        <filter id="seaNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" /><feColorMatrix type="saturate" values="0" /></filter>
      </defs>
      <rect x="0" y="0" width={MW} height={MH} fill="url(#seaG)" />
      <path d={LAND} fill="#BDB79A" stroke="#8F8A6E" strokeWidth={0.8 * k} strokeLinejoin="round" />
      <rect x="0" y="0" width={MW} height={MH} filter="url(#seaNoise)" opacity=".13" style={{ mixBlendMode: 'overlay' }} />
      {route && (
        <>
          <path d={route.d} fill="none" stroke="#FFC83D" strokeWidth={3.2 * k} strokeDasharray={`${9 * k} ${7 * k}`} strokeLinecap="round" />
          {[route.a, route.b].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={7 * k} fill="#FFC83D" stroke="#0A1F3C" strokeWidth={2.4 * k} />)}
          {label(route.a, oc, 'middle', -14)}
          {label(route.b, dc, 'middle', 24)}
        </>
      )}
    </svg>
  )
}

// Passport, visa and boarding pass on a wooden table, filled from the real trip.
function DeskView({ trip, flagged }) {
  const { t, fmtDate } = useI18n()
  const s = trip?.summary || {}
  const p = trip?.travellers?.[0]
  const docs = p?.documents || {}
  const name = (p?.name || '').toUpperCase()
  const dim = (k) => (trip && !docs[k] ? 0.28 : 1)
  return (
    <div className="desk" aria-hidden="true">
      <svg className="desk-noise"><rect width="100%" height="100%" filter="url(#seaNoise)" opacity=".2" style={{ mixBlendMode: 'multiply' }} /></svg>
      <div className="doc passport" style={{ opacity: dim('passport') }}>
        <div className="emb"><i /></div>
        <b>PASSPORT</b><small>{t('passport')}</small>
      </div>
      <div className="doc visa" style={{ opacity: dim('visa') }}>
        <b>VISA · {(s.destination_country || s.destination_city || s.destination_code || '').toUpperCase()}</b>
        <span>{name}</span>
        <small>{docs.passport?.number || ''}</small>
        <div className="stamp">{s.destination_code || ''}<br />ENTRY</div>
      </div>
      <div className="doc ticket" style={{ opacity: dim('ticket') }}>
        <b className="tk-h">{(s.flights || [])[0] || ''}</b>
        <div className="tk-r"><strong>{s.origin_code || '···'}</strong><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><use href="#planeIcon" /></svg><strong>{s.destination_code || '···'}</strong></div>
        <small>{t('flight')}</small>
        <span className={'tk-name' + (flagged === 'bad' ? ' bad' : flagged === 'ok' ? ' ok' : '')}>{name || '—'}</span>
        <small>{s.departure_date ? fmtDate(s.departure_date, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</small>
        <div className="barcode" />
      </div>
    </div>
  )
}

function CalendarView({ summary }) {
  const { lang, fmtDate } = useI18n()
  const iso = summary?.departure_date
  let day = '', month = '', weekday = ''
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number)
    try {
      const dt = new Date(y, m - 1, d)
      day = String(d)
      month = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(dt)
      weekday = new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(dt)
    } catch { day = String(d); month = fmtDate(iso) }
  }
  return (
    <div className="desk" aria-hidden="true">
      <div className="calendar">
        <div className="cal-h">{month || '—'}</div>
        <div className="cal-d">{day || '—'}</div>
        <div className="cal-w">{weekday}</div>
        <div className="cal-f">{(summary?.flights || [])[0] || ''}</div>
      </div>
      <div className="pouch"><i /><b>{summary?.origin_code || ''} → {summary?.destination_code || ''}</b></div>
    </div>
  )
}

// Terminal floor plan; the glowing dot is where the traveller is in the airport steps.
const PLAN = [[40, 176], [102, 120], [176, 164], [246, 108], [298, 168], [348, 112]]
const at = (n, i) => {
  // spread n steps along the fixed 6-point path
  const f = n <= 1 ? 0 : (i / (n - 1)) * (PLAN.length - 1)
  const a = Math.floor(f), b = Math.min(PLAN.length - 1, a + 1), u = f - a
  return [PLAN[a][0] + (PLAN[b][0] - PLAN[a][0]) * u, PLAN[a][1] + (PLAN[b][1] - PLAN[a][1]) * u]
}
function PlanView({ trip }) {
  const { jstep } = useStage()
  const steps = trip?.journey || []
  const n = Math.max(steps.length, 1)
  const pts = Array.from({ length: n }, (_, i) => at(n, i))
  const cur = Math.min(jstep, n - 1)
  const line = (arr) => arr.map((p) => p.join(',')).join(' ')
  return (
    <div className="plan" aria-hidden="true">
      <svg viewBox="0 0 390 186" preserveAspectRatio="xMidYMid slice">
        <defs><pattern id="pGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.07)" /></pattern></defs>
        <rect width="390" height="186" fill="#0C2748" /><rect width="390" height="186" fill="url(#pGrid)" />
        <rect x="14" y="30" width="300" height="140" rx="4" fill="rgba(255,255,255,.04)" stroke="#6F93C4" strokeWidth="2" />
        <g fill="#6F93C4" opacity=".55"><rect x="82" y="44" width="8" height="26" /><rect x="96" y="44" width="8" height="26" /><rect x="110" y="44" width="8" height="26" /><rect x="124" y="44" width="8" height="26" /></g>
        <path d="M150 90V170M150 90H200V170M214 36V90H262M262 90V130" stroke="#6F93C4" strokeWidth="1.5" fill="none" opacity=".6" />
        <g fill="#6F93C4" opacity=".5"><rect x="270" y="122" width="9" height="9" /><rect x="284" y="122" width="9" height="9" /><rect x="298" y="122" width="9" height="9" /></g>
        <path d="M314 90H390M314 112H390" stroke="#6F93C4" strokeWidth="1.5" opacity=".6" />
        <g transform="translate(352,70) rotate(-90) scale(1.3)" fill="rgba(255,255,255,.75)"><path d="M18 0 L6-3 L2-14 L-1-14 L0-3 L-11-2 L-13-6 L-16-6 L-15 0 L-16 6 L-13 6 L-11 2 L0 3 L-1 14 L2 14 L6 3Z" /></g>
        <g transform="translate(0,-34)">
          <polyline points={line(pts)} fill="none" stroke="rgba(255,200,61,.35)" strokeWidth="4" strokeDasharray="3 6" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={line(pts.slice(0, cur + 1))} fill="none" stroke="#FFC83D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r="11" fill={i === cur ? '#FFC83D' : i < cur ? '#6FB38F' : '#3E5E8A'} stroke="#0C2748" strokeWidth="3" />
              <text x={p[0]} y={p[1] + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={i === cur ? '#0A1F3C' : '#fff'}>{i + 1}</text>
            </g>
          ))}
          <g style={{ transform: `translate(${pts[cur][0]}px,${pts[cur][1]}px)`, transition: 'transform 1.1s cubic-bezier(.4,0,.2,1)' }}>
            <circle r="19" fill="rgba(255,200,61,.28)" className="pulse" />
            <circle r="8" fill="#FFC83D" stroke="#0A1F3C" strokeWidth="3" />
          </g>
        </g>
      </svg>
      {steps[cur] && <div className="plan-label">{cur + 1}. {steps[cur].title}</div>}
    </div>
  )
}

export default function Stage({ step, trip }) {
  const flagged = trip ? (trip.status === 'ready' ? 'ok' : 'bad') : undefined
  let body = null
  if (step === 'language' || step === 'contacts') body = <MapView summary={trip?.summary} trip={trip} />
  else if (step === 'travellers' || step === 'check') body = <DeskView trip={trip} flagged={step === 'check' ? flagged : undefined} />
  else if (step === 'checklist') body = <CalendarView summary={trip?.summary} />
  else if (step === 'journey') body = <PlanView trip={trip} />
  if (!body) return null
  return (
    <div className={'stage stage-' + step} aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <symbol id="planeIcon" viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.2.4c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></symbol>
      </svg>
      {body}
    </div>
  )
}

// Cabin-window view of the flight, panning from origin to destination along the real route.
export function FlightScene({ trip, onDone }) {
  const { t } = useI18n()
  const route = useRoute(trip?.summary)
  const [DUR] = useState(() => (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1.5 : 9))
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    const id = setTimeout(() => done.current(), DUR * 1000 + 600)
    return () => clearTimeout(id)
  }, [DUR])
  const WW = 270, WH = 400
  let from, to, vw
  if (route) {
    vw = Math.min(Math.max(route.dist * 0.5, 220), 900)
    const vh = (vw * WH) / WW
    from = [route.a[0] - vw / 2, route.a[1] - vh / 2]
    to = [route.b[0] - vw / 2, route.b[1] - vh / 2]
  } else { vw = 600; const vh = (vw * WH) / WW; from = [800, 500 - vh / 2]; to = [1000, 500 - vh / 2] }
  const vh = (vw * WH) / WW
  const k = vw / WW
  return (
    <div className="flightscene" role="dialog" aria-label={t('flight_started')}>
      <div className="fs-window"><div className="fs-glass">
        <svg viewBox={`${from[0]} ${from[1]} ${vw} ${vh}`} preserveAspectRatio="xMidYMid slice">
          <animate attributeName="viewBox" dur={`${DUR}s`} fill="freeze" from={`${from[0]} ${from[1]} ${vw} ${vh}`} to={`${to[0]} ${to[1]} ${vw} ${vh}`} />
          <defs><linearGradient id="seaF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B4A63" /><stop offset="1" stopColor="#0E2F47" /></linearGradient></defs>
          <rect x="0" y="0" width={MW} height={MH} fill="url(#seaF)" />
          <path d={LAND} fill="#BDB79A" stroke="#8F8A6E" strokeWidth={0.8 * k} />
          {route && <path d={route.d} fill="none" stroke="#FFC83D" strokeWidth={2.6 * k} strokeDasharray={`${8 * k} ${6 * k}`} strokeLinecap="round" />}
          {route && (
            <g fill="#fff" stroke="#0A1F3C" strokeWidth={1.4 * k}>
              <g transform={`scale(${0.9 * k})`}>
                <path d="M30 0 L10 -4 L4 -24 L-3 -24 L0 -4 L-18 -3 L-23 -10 L-27 -10 L-25 0 L-27 10 L-23 10 L-18 3 L0 4 L-3 24 L4 24 L10 4 Z" />
              </g>
              <animateMotion dur={`${DUR}s`} fill="freeze" rotate="auto" path={route.d} />
            </g>
          )}
        </svg>
        <div className="fs-shine" />
      </div></div>
      <p className="fs-t">{t('flight_started')}</p>
      <button className="btn sec fs-skip" onClick={onDone}>{t('skip')}</button>
    </div>
  )
}
