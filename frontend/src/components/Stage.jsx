import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useStage } from '../StageContext'
import { usePlaces } from '../places'
import { speak } from '../voice'
import { W as MW, H as MH, TY as MTY, LAND } from '../assets/worldmap'

// Illustrated "stage" above each screen. Everything is drawn from the traveller's own trip data:
// a real map of their route, their papers on a table, their travel date, their airport route.
// Decorative only (aria-hidden); every fact on it is also in the text of the screen below.

const R = MW / (2 * Math.PI)
// top-down airliner, nose along +x (same shape as the flight scene)
const AIRLINER = 'M30 0 L10 -4 L4 -24 L-3 -24 L0 -4 L-18 -3 L-23 -10 L-27 -10 L-25 0 L-27 10 L-23 10 L-18 3 L0 4 L-3 24 L4 24 L10 4 Z'
const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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
    // drawn length of the arc (for the reveal) and the real great-circle distance (for how long the flight takes)
    let len = 0, prev = a
    for (let i = 1; i <= 24; i++) {
      const u = i / 24, v = 1 - u
      const p = [v * v * a[0] + 2 * v * u * mx + u * u * b[0], v * v * a[1] + 2 * v * u * my + u * u * b[1]]
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); prev = p
    }
    const rad = Math.PI / 180, h = Math.sin(((d[0] - o[0]) * rad) / 2) ** 2 + Math.cos(o[0] * rad) * Math.cos(d[0] * rad) * Math.sin(((d[1] - o[1]) * rad) / 2) ** 2
    const km = 12742 * Math.asin(Math.sqrt(h))
    return { a, b, c: [mx, my], dist, len, km, from: o, to: d, d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}` }
  }, [table, summary])
}

// Rendered size of an element in px, so drawings fit the real frame on phone and desktop alike.
function useSize(ref, fallback) {
  const [size, setSize] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || !window.ResizeObserver) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      if (width && height) setSize([width, height])
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

let webgl
export const hasWebGL = () => (webgl ??= (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } })())

// Mounts a Three.js scene (its code loads only when a scene needs it) over its flat version.
// The flat version shows while 3D loads, and stays if the phone can't run 3D.
function Scene3D({ load, deps, fallback, apiRef }) {
  const host = useRef(null)
  const [state, setState] = useState(() => (hasWebGL() ? 'loading' : 'off'))
  useEffect(() => {
    if (state === 'off') return
    let api, dead = false
    load().then((make) => {
      if (dead) return
      api = make(host.current); if (apiRef) apiRef.current = api; setState('on')
      host.current?.querySelector('canvas')?.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (!dead) setState('off') }) // flat drawing, never white
    }).catch(() => { if (!dead) setState('off') })
    return () => { dead = true; api?.dispose(); if (apiRef) apiRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return <div className="scene3d">{state !== 'on' && fallback}<div ref={host} className="scene3d-host" /></div>
}

// 3D Earth with the trip's route rising off it and a plane flying it.
export function GlobeView({ summary, trip }) {
  const route = useRoute(summary)
  const place = usePlaces([summary?.origin_city, summary?.destination_city])
  const api = useRef(null)
  const flat = <MapView summary={summary} trip={trip} />
  const name = (c, code) => place(summary?.[c]) || summary?.[code]
  const from = name('origin_city', 'origin_code'), to = name('destination_city', 'destination_code')
  useEffect(() => { api.current?.setNames?.(from, to) }, [from, to]) // translated names arrive without restarting the globe
  if (!route) return flat
  return <Scene3D deps={[route]} apiRef={api} fallback={flat} load={() => import('../three/globe').then((m) => (el) => m.createGlobe(el, {
    from: route.from, to: route.to, fromName: from, toName: to, km: route.km, still: still(),
  }))} />
}

function MapView({ summary, trip }) {
  const route = useRoute(summary)
  const { t } = useI18n()
  const ref = useRef(null)
  const [pw, ph] = useSize(ref, [480, 228])
  let vb
  if (route) {
    // fit both airports and the top of the arc, leaving room in px for the pins and city names
    const q = [(route.a[0] + 2 * route.c[0] + route.b[0]) / 4, (route.a[1] + 2 * route.c[1] + route.b[1]) / 4]
    const xs = [route.a[0], route.b[0], q[0]], ys = [route.a[1], route.b[1], q[1]]
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
    const MX = 80, MY = 40
    const s = Math.min( // px per map unit; pw / 260 stops very short routes from zooming in too far
      Math.max(pw - 2 * MX, 40) / Math.max(x1 - x0, 1),
      Math.max(ph - 2 * MY, 40) / Math.max(y1 - y0, 1),
      pw / 260,
    )
    const w = pw / s, h = ph / s
    vb = [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h]
  } else {
    vb = [260, 330, 1500, (1500 * ph) / pw] // wide view when the route cannot be placed
  }
  const k = vb[2] / pw // map units per screen px
  const aUp = route && route.a[1] <= route.b[1] // the higher airport gets its name above the pin, the lower one below
  const o = summary?.origin_code, d = summary?.destination_code
  const place = usePlaces([summary?.origin_city, summary?.destination_city])
  const oc = place(summary?.origin_city) || o, dc = place(summary?.destination_city) || d
  const label = (p, text, anchor, dyp) => (
    <text x={p[0]} y={p[1] + dyp * k} textAnchor={anchor} fontSize={15 * k} fontWeight="700" fill="#fff"
      stroke="#0A1F3C" strokeWidth={5 * k} paintOrder="stroke" strokeLinejoin="round">{text}</text>
  )
  return (
    <svg ref={ref} className="stage-svg" viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid slice" role="img" aria-label={trip ? `${oc} → ${dc}` : t('step_language')}>
      <defs>
        <linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B4A63" /><stop offset="1" stopColor="#0E2F47" /></linearGradient>
        {route && (
          <mask id="routeReveal" maskUnits="userSpaceOnUse" x="0" y="0" width={MW} height={MH}>
            <path className="draw" d={route.d} fill="none" stroke="#fff" strokeWidth={16 * k} strokeDasharray={`${route.len} ${route.len}`} strokeLinecap="round" style={{ '--len': route.len }} />
          </mask>
        )}
      </defs>
      <rect x="0" y="0" width={MW} height={MH} fill="url(#seaG)" />
      <path d={LAND} fill="#BDB79A" stroke="#8F8A6E" strokeWidth={0.8 * k} strokeLinejoin="round" />
      <rect x="0" y="0" width={MW} height={MH} filter="url(#seaNoise)" opacity=".13" style={{ mixBlendMode: 'overlay' }} />
      {route && (
        <>
          <path d={route.d} mask="url(#routeReveal)" fill="none" stroke="#FFC83D" strokeWidth={3.2 * k} strokeDasharray={`${9 * k} ${7 * k}`} strokeLinecap="round" />
          {[route.a, route.b].map((p, i) => <circle key={i} className={'pin pin' + i} cx={p[0]} cy={p[1]} r={7 * k} fill="#FFC83D" stroke="#0A1F3C" strokeWidth={2.4 * k} />)}
          {!still() && (
            // after the route has drawn, a plane keeps flying it, origin to destination
            <g opacity="0">
              <set attributeName="opacity" to="1" begin="1.5s" />
              <path d={AIRLINER} transform={`scale(${0.42 * k})`} fill="#fff" stroke="#0A1F3C" strokeWidth="2.6" strokeLinejoin="round" />
              <animateMotion dur={`${Math.min(14, 4 + route.km / 900).toFixed(1)}s`} begin="1.5s" repeatCount="indefinite" rotate="auto" path={route.d} />
            </g>
          )}
          {label(route.a, oc, 'middle', aUp ? -14 : 24)}
          {label(route.b, dc, 'middle', aUp ? 24 : -14)}
        </>
      )}
    </svg>
  )
}

// Passport, visa and boarding pass on a wooden table, filled from the real trip.
function DeskView({ trip, check }) {
  const { t, fmtDate } = useI18n()
  const s = trip?.summary || {}
  // show the traveller who has a problem (else the first); only their own checks colour the name
  const bad = new Set((trip?.checks || []).filter((c) => c.status === 'warn' || c.status === 'fail').map((c) => c.traveller_id))
  const p = trip?.travellers?.find((x) => bad.has(x.id)) || trip?.travellers?.[0]
  const flagged = !check || !p ? undefined : bad.has(p.id) ? 'bad' : trip.status === 'ready' ? 'ok' : undefined
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

// clothes colours for the suitcase that fills as the checklist is ticked
const CLOTHES = ['#7a2e3a', '#e8e2d6', '#b8913a', '#2f4f6f', '#5c6b4a', '#9a4f2f', '#6b4c7a', '#c9d4d6', '#8a6d3b', '#3f3f46', '#b85c5c', '#4a7a6e']

function CalendarView({ summary, checklist, done = {} }) {
  const { lang, fmtDate, t } = useI18n()
  // progress through the checklist: each ticked item puts something in the case; at 100% it shuts
  const required = (checklist?.items || []).filter((i) => !i.optional)
  const count = required.filter((i) => done[i.id]).length, total = required.length
  const pct = total ? count / total : 0
  const filled = count ? Math.max(1, Math.round(pct * CLOTHES.length)) : 0, full = total > 0 && count === total
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
      <div className={'case' + (full ? ' shut' : '')}>
        <div className="case-body">{CLOTHES.slice(0, filled).map((c, i) => <i key={i} style={{ background: c }} />)}</div>
        <div className="case-lid"><b>{summary?.origin_code || ''} → {summary?.destination_code || ''}</b></div>
        {full && <span className="case-tag">{t('ready_title')} ✓</span>}
      </div>
      {total > 0 && <div className="stage-prog"><span>{count} / {total} {t('done')}</span><i><b style={{ width: `${pct * 100}%` }} /></i></div>}
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
function PlanView({ trip, label = true }) {
  const { jstep } = useStage()
  const steps = trip?.journey || []
  const n = Math.max(steps.length, 1)
  const pts = Array.from({ length: n }, (_, i) => at(n, i))
  const cur = Math.min(jstep, n - 1)
  const line = (arr) => arr.map((p) => p.join(',')).join(' ')
  const legs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const walked = legs.slice(0, cur).reduce((a, b) => a + b, 0) / (legs.reduce((a, b) => a + b, 0) || 1)
  return (
    <div className="plan" aria-hidden="true">
      <svg viewBox="0 0 390 186" preserveAspectRatio="xMidYMid meet">
        <defs><pattern id="pGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="rgba(255,255,255,.07)" /></pattern></defs>
        {/* background runs past the plan so letterboxing (meet) never shows an edge */}
        <rect x="-1000" y="-500" width="2390" height="1186" fill="#0C2748" /><rect x="-1000" y="-500" width="2390" height="1186" fill="url(#pGrid)" />
        <rect x="14" y="30" width="300" height="140" rx="4" fill="rgba(255,255,255,.04)" stroke="#6F93C4" strokeWidth="2" />
        <g fill="#6F93C4" opacity=".55"><rect x="82" y="44" width="8" height="26" /><rect x="96" y="44" width="8" height="26" /><rect x="110" y="44" width="8" height="26" /><rect x="124" y="44" width="8" height="26" /></g>
        <path d="M150 90V170M150 90H200V170M214 36V90H262M262 90V130" stroke="#6F93C4" strokeWidth="1.5" fill="none" opacity=".6" />
        <g fill="#6F93C4" opacity=".5"><rect x="270" y="122" width="9" height="9" /><rect x="284" y="122" width="9" height="9" /><rect x="298" y="122" width="9" height="9" /></g>
        <path d="M314 90H390M314 112H390" stroke="#6F93C4" strokeWidth="1.5" opacity=".6" />
        <g transform="translate(366,150) rotate(-90) scale(1.3)" fill="rgba(255,255,255,.75)"><path d="M18 0 L6-3 L2-14 L-1-14 L0-3 L-11-2 L-13-6 L-16-6 L-15 0 L-16 6 L-13 6 L-11 2 L0 3 L-1 14 L2 14 L6 3Z" /></g>
        <g transform="translate(0,-34)">
          <polyline points={line(pts)} fill="none" stroke="rgba(255,200,61,.35)" strokeWidth="4" strokeDasharray="3 6" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={line(pts)} pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - walked} fill="none" stroke="#FFC83D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)' }} />
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
      {label && steps[cur] && <div className="plan-label">{cur + 1}. {steps[cur].title}</div>}
    </div>
  )
}

// 3D walk through the terminal: she moves to the next stop each time the step changes.
function TerminalView({ trip }) {
  const { jstep } = useStage()
  const steps = trip?.journey || []
  const api = useRef(null)
  const cur = Math.min(jstep, Math.max(0, steps.length - 1))
  useEffect(() => { api.current?.setStep(cur) }, [cur])
  return (
    <>
      <Scene3D deps={[trip?.id, steps.length]} apiRef={api} fallback={<PlanView trip={trip} label={false} />}
        load={() => import('../three/terminal').then((m) => (el) => m.createTerminal(el, {
          steps, start: cur, still: still(),
          info: { // what the departures board, check-in backdrop and gate sign show: her own flight
            flight: trip?.summary?.flights?.[0], dest: trip?.summary?.destination_city, time: trip?.summary?.departure_time,
            airline: steps.find((x) => x.id === 'checkin')?.where?.[0], gate: trip?.boarding?.gate,
          },
        }))} />
      {steps[cur] && <div className="plan-label">{cur + 1}. {steps[cur].title}</div>}
    </>
  )
}

export default function Stage({ step, trip, done }) {
  let body = null
  if (step === 'language' || step === 'contacts') body = <GlobeView summary={trip?.summary} trip={trip} />
  else if (step === 'travellers' || step === 'check') body = <DeskView trip={trip} check={step === 'check'} />
  else if (step === 'checklist') body = <CalendarView summary={trip?.summary} checklist={trip?.checklist} done={done} />
  else if (step === 'journey') body = <TerminalView trip={trip} />
  if (!body) return null
  return (
    <div className={'stage stage-' + step} aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="seaNoise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" /><feColorMatrix type="saturate" values="0" /></filter>
        <symbol id="planeIcon" viewBox="0 0 24 24"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.2.4c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></symbol>
      </svg>
      {body}
    </div>
  )
}

// Boarding at the gate / walking out to family at arrivals: a short full-screen 3D moment with a spoken caption.
export function MomentScene({ kind, opts, caption, onDone }) {
  const { t, lang } = useI18n()
  const host = useRef(null)
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone })
  useEffect(() => {
    let api, dead = false, timer = 0
    speak(caption, lang)
    if (!hasWebGL()) { timer = setTimeout(() => done.current(), 2500); return () => clearTimeout(timer) }
    import('../three/moments').then((m) => {
      if (dead) return
      api = m.createMoment(host.current, { ...opts, kind, still: still(), onDone: () => done.current() })
      host.current?.querySelector('canvas')?.addEventListener('webglcontextlost', (e) => { e.preventDefault(); done.current() })
    }).catch(() => done.current())
    return () => { dead = true; api?.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="flightscene moment" role="dialog" aria-label={caption}>
      <div className="moment-scene" ref={host} />
      <p className="fs-t moment-cap">{caption}</p>
      <button className="btn sec fs-skip" onClick={() => done.current()}>{t('skip')}</button>
    </div>
  )
}

// Cabin-window view of the flight, panning from origin to destination along the real route.
export function FlightScene({ trip, onDone }) {
  const { t } = useI18n()
  const route = useRoute(trip?.summary)
  // a longer trip is a longer flight: ~7s for Chennai to Singapore, up to 12s for the longest routes
  const DUR = still() ? 1.5 : route ? +Math.min(12, 5 + route.km / 1200).toFixed(1) : 9
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
  } else { vw = MW * 0.6; const vh = (vw * WH) / WW; from = to = [(MW - vw) / 2, (MH - vh) / 2] } // route unknown: still view of the world, no made-up path
  const vh = (vw * WH) / WW
  const k = vw / WW
  const flat = (
        <svg key={route ? 'route' : 'world'} viewBox={`${from[0]} ${from[1]} ${vw} ${vh}`} preserveAspectRatio="xMidYMid slice">
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
  )
  return (
    <div className="flightscene" role="dialog" aria-label={t('flight_started')}>
      <div className="fs-window"><div className="fs-glass">
        {route ? (
          // the 3D globe seen from just behind the plane; the flat drawing is the fallback
          <Scene3D deps={[route]} fallback={flat} load={() => import('../three/globe').then((m) => (el) => m.createGlobe(el, {
            from: route.from, to: route.to, km: route.km, mode: 'flight', duration: DUR, still: still(),
          }))} />
        ) : flat}
        <div className="fs-shine" />
      </div></div>
      <p className="fs-t">{t('flight_started')}</p>
      <button className="btn sec fs-skip" onClick={onDone}>{t('skip')}</button>
    </div>
  )
}
