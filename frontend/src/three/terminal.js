// 3D terminal walk, built to look like a real departures hall: polished floor, ceiling light panels, glass facade
// with aircraft outside, other passengers queuing and waiting, luggage everywhere, staff at the counters.
// One stop per airport step (equipment chosen by the step id); signs, departures board and airline come from the trip.
// The traveller is Lakshmi from the design's user story, followed by a camera just behind her shoulder.
import * as THREE from 'three'

export const SP = 7 // metres between stops
const SPEED = 1.2 // m/s: an unhurried, elderly pace
export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o })
export const M = {
  wall: mat(0xf2efe9), desk: mat(0xf7f5f1, { roughness: 0.5 }), dark: mat(0x2f3a48, { roughness: 0.6 }), metal: mat(0xc6cbd0, { roughness: 0.35, metalness: 0.5 }),
  belt: mat(0x2e3237, { roughness: 0.7 }), seat: mat(0x3d5a80, { roughness: 0.6 }), stick: mat(0x5b4636), wheel: mat(0x1c1c1c),
  glass: new THREE.MeshStandardMaterial({ color: 0xbcd6ea, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28 }),
  plane: mat(0xf5f7f9, { roughness: 0.35 }), tail: mat(0x1b4f9c, { roughness: 0.4 }), tarmac: mat(0x8c8f93), light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  plant: mat(0x4f7a4a), pot: mat(0xd9d3c7), tray: mat(0x6b7480),
}
const SKINS = [0x8d5b3e, 0x6e4630, 0xa87554, 0xc59a78, 0x5a3a28]
const CLOTH = [0x7a2e3a, 0x2f4f6f, 0x5c6b4a, 0x8a6d3b, 0x3f3f46, 0x6b4c7a, 0x9a4f2f, 0x2e5d62, 0xb8b2a6, 0x4a5568]
const BAGS = [0x2e5d62, 0x34495e, 0x7a2e3a, 0x3f3f46, 0x8a6d3b, 0x1b4f9c]
const cache = new Map()
export const m = (c, o) => { const k = c + JSON.stringify(o || {}); if (!cache.has(k)) cache.set(k, mat(c, o)); return cache.get(k) }

export function box(w, h, d, mm, x, y, z, parent, shadow = true) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm)
  o.position.set(x, y + h / 2, z); o.castShadow = shadow; o.receiveShadow = true; parent.add(o); return o
}
export function cyl(r, h, mm, x, y, z, parent, seg = 16) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mm)
  o.position.set(x, y + h / 2, z); o.castShadow = true; parent.add(o); return o
}
const lathe = (profile, mm) => { const o = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 24), mm); o.castShadow = true; return o }
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (a) => a[Math.floor(rnd() * a.length)]

// Text painted onto a board, for signs and screens.
export function textTex(w, h, paint, fontReady) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  const run = () => { paint(cv.getContext('2d')); tex.needsUpdate = true }
  run(); fontReady.then(run)
  return tex
}
export const FONT = (px) => `700 ${px}px "Atkinson Hyperlegible", "Segoe UI", sans-serif`
export const fit = (g, text, px, max) => { g.font = FONT(px); while (g.measureText(text).width > max && px > 24) g.font = FONT((px -= 3)) }
// a board whose painted face points back at the camera (the -z side)
export function board(w, h, tex, x, y, z, parent) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [M.dark, M.dark, M.dark, M.dark, M.dark, new THREE.MeshBasicMaterial({ map: tex })])
  b.position.set(x, y, z); parent.add(b); return b
}

// ---------- people ----------
// A passenger: saree (skirt) or trousers, shirt/blouse, skin and hair tones, optionally sitting.
export function person({ dress = 'trousers', top = pick(CLOTH), bottom = pick(CLOTH), skin = pick(SKINS), hair = rnd() < 0.3 ? 0xbab6ae : 0x1e1a17, bun = false, sit = false, stoop = 0.05, h = 0.95 + rnd() * 0.1 } = {}) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.scale.set(h * (0.94 + rnd() * 0.14), h, h) // people differ in build
  const SK = m(skin, { roughness: 0.6 }), TOP = m(top, { roughness: 0.9 }), BOT = m(bottom, { roughness: 0.9 }), HR = m(hair, { roughness: 1 })
  const hipY = sit ? 0.47 : 0.92
  const legs = []
  if (dress === 'saree') {
    const skirt = new THREE.Group(); skirt.position.y = hipY; if (sit) skirt.scale.y = 0.55; body.add(skirt) // seated: the saree falls from the knees
    skirt.add(lathe([[0.001, 0.02], [0.17, 0], [0.19, -0.2], [0.22, -0.5], [0.26, -0.78], [0.27, -0.86], [0.001, -0.86]], BOT))
    skirt.add(lathe([[0.268, -0.79], [0.272, -0.86], [0.262, -0.86], [0.258, -0.79]], m(0xb8913a, { roughness: 0.7 })))
    legs.push({ skirt })
  } else {
    ;[-0.095, 0.095].forEach((x) => {
      const hip = new THREE.Group(); hip.position.set(x, hipY, 0); body.add(hip)
      hip.add(lathe([[0.001, 0], [0.085, -0.02], [0.075, -0.42], [0.001, -0.44]], BOT))
      const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee)
      knee.add(lathe([[0.001, 0], [0.065, -0.02], [0.058, -0.42], [0.001, -0.44]], BOT))
      box(0.1, 0.07, 0.25, m(0x2b2622), 0, -0.48, 0.05, knee)
      if (sit) { hip.rotation.x = -1.45; knee.rotation.x = 1.45 }
      legs.push({ hip, knee })
    })
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.178, 0.04, 20), m(0x2b2622)); belt.position.y = hipY + 0.01; body.add(belt)
  }
  const torso = new THREE.Group(); torso.position.y = hipY; torso.rotation.x = stoop; body.add(torso)
  torso.add(lathe([[0.001, 0], [0.165, 0], [0.175, 0.12], [0.19, 0.3], [0.175, 0.42], [0.1, 0.52], [0.05, 0.55], [0.001, 0.55]], TOP))
  if (dress === 'saree') { // the pallu across the shoulder
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.24, 24, 1, true, -0.9, 2.6), BOT); p.position.y = 0.3; p.rotation.z = -0.5; p.scale.set(1, 1.6, 1.05); p.castShadow = true; torso.add(p)
  }
  torso.add(lathe([[0.045, 0.5], [0.042, 0.62], [0.001, 0.62]], SK))
  const head = new THREE.Group(); head.position.set(0, 0.7, 0.03); torso.add(head)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 16), SK); skull.scale.set(0.92, 1.12, 1); skull.castShadow = true; head.add(skull)
  const hr = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), HR); hr.scale.set(0.95, 1.1, 1.02); hr.rotation.x = -0.35; head.add(hr)
  if (bun) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), HR); b.position.z = -0.1; head.add(b) }
  else if (dress === 'saree') { const br = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.012, 0.42, 8), HR); br.position.set(0, -0.2, -0.09); br.rotation.x = 0.12; head.add(br) }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.04, 8), SK); nose.rotation.x = Math.PI / 2; nose.position.set(0, -0.012, 0.095); head.add(nose)
  ;[-1, 1].forEach((sx) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), SK); ear.scale.set(0.5, 1, 0.8); ear.position.set(sx * 0.088, -0.005, 0); head.add(ear) })
  const arms = [-0.205, 0.205].map((x) => {
    const sh = new THREE.Group(); sh.position.set(x, 0.43, 0); sh.rotation.z = x < 0 ? -0.07 : 0.07; torso.add(sh)
    sh.add(lathe([[0.001, 0], [0.058, -0.01], [0.05, -0.16], [0.001, -0.17]], TOP))
    sh.add(lathe([[0.044, -0.15], [0.04, -0.3], [0.001, -0.3]], dress === 'saree' ? SK : TOP))
    const el = new THREE.Group(); el.position.y = -0.3; el.rotation.x = sit ? -0.9 : -0.25; sh.add(el)
    el.add(lathe([[0.001, 0], [0.038, -0.01], [0.031, -0.22], [0.034, -0.26], [0.001, -0.29]], SK))
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), SK); hand.scale.set(0.75, 1.25, 0.55); hand.position.y = -0.32; hand.castShadow = true; el.add(hand)
    return sh
  })
  return {
    root, body, arms,
    update(phase, walk, now) {
      const s = Math.sin(phase)
      if (legs[0]?.skirt) { legs[0].skirt.rotation.x = s * 0.035 * walk; legs[0].skirt.rotation.z = Math.cos(phase) * 0.02 * walk }
      else if (!sit && legs.length) {
        legs[0].hip.rotation.x = -s * 0.34 * walk; legs[1].hip.rotation.x = s * 0.34 * walk
        legs[0].knee.rotation.x = Math.max(0, s) * 0.5 * walk; legs[1].knee.rotation.x = Math.max(0, -s) * 0.5 * walk
      }
      body.rotation.z = Math.cos(phase) * 0.02 * walk
      body.position.y = Math.abs(Math.cos(phase)) * 0.014 * walk + Math.sin(now / 1100 + h * 9) * 0.003
    },
  }
}
// hard-shell roller case, handle up
export function suitcase(x, z, parent, { color = pick(BAGS), big = true, rot = 0, handle = true } = {}) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g)
  const w = big ? 0.42 : 0.36, h = big ? 0.66 : 0.52, d = big ? 0.26 : 0.22
  const shell = box(w, h, d, m(color, { roughness: 0.45 }), 0, 0.05, 0, g)
  for (let i = -1; i <= 1; i += 2) box(0.012, h * 0.9, d + 0.01, m(color, { roughness: 0.3 }), i * w * 0.22, 0.08, 0, g, false) // ribs
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl(0.025, 0.05, M.wheel, a * (w / 2 - 0.04), 0, b * (d / 2 - 0.04), g, 10))
  if (handle) { cyl(0.008, 0.42, M.metal, -0.06, h + 0.05, -d / 2 + 0.03, g, 6); cyl(0.008, 0.42, M.metal, 0.06, h + 0.05, -d / 2 + 0.03, g, 6); box(0.16, 0.025, 0.025, M.dark, 0, h + 0.47, -d / 2 + 0.03, g) }
  return { g, shell }
}
export function trolley(x, z, parent, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g)
  box(0.6, 0.03, 0.9, M.metal, 0, 0.18, 0, g); box(0.6, 0.6, 0.03, M.metal, 0, 0.2, -0.45, g); box(0.62, 0.03, 0.03, M.dark, 0, 1, -0.55, g)
  ;[[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]].forEach(([a, b]) => cyl(0.05, 0.1, M.wheel, a, 0, b, g, 10))
  suitcase(0, 0.05, g, { handle: false }).g.position.y = 0.21
  const s2 = suitcase(0, 0.05, g, { handle: false, big: false }); s2.g.position.y = 0.92; s2.g.rotation.z = Math.PI / 2
  return g
}
function standAt(p, x, z, parent, rot = 0) { p.root.position.set(x, 0, z); p.root.rotation.y = rot; parent.add(p.root); return p }

// ---------- stops ----------
// x > 1.6 is the right side of the walkway, x < -1.6 the left; her lane at x = 0 stays clear.
const BUILD = {
  entry(g, z, info, crowd, tex) { // doors slid open, trolleys, and the departures board with her flight on it
    box(0.14, 2.8, 0.14, M.metal, -2.3, 0, z + 2.2, g); box(0.14, 2.8, 0.14, M.metal, 2.3, 0, z + 2.2, g); box(4.8, 0.25, 0.25, M.metal, 0, 2.8, z + 2.2, g)
    box(1.6, 2.7, 0.04, M.glass, -3.1, 0, z + 2.2, g); box(1.6, 2.7, 0.04, M.glass, 3.1, 0, z + 2.2, g)
    for (let i = 0; i < 3; i++) trolley(-3.6 - i * 0.25, z + 0.5 + i * 0.35, g, 0.2)
    board(3.4, 1.4, tex(1024, 420, (c) => {
      c.fillStyle = '#071425'; c.fillRect(0, 0, 1024, 420); c.fillStyle = '#FFC83D'; c.font = FONT(46); c.fillText('DEPARTURES', 30, 64)
      c.font = FONT(30); c.fillStyle = '#9fb3c8'; ['TIME', 'FLIGHT', 'TO', 'STATUS'].forEach((t, i) => c.fillText(t, [30, 200, 400, 760][i], 120))
      c.fillStyle = '#132a45'; c.fillRect(16, 145, 992, 70)
      c.font = FONT(38); c.fillStyle = '#fff'; [info.time || '--:--', info.flight || '', (info.dest || '').toUpperCase(), 'CHECK-IN'].forEach((t, i) => c.fillText(t, [30, 200, 400, 760][i], 194))
      c.fillStyle = 'rgba(255,255,255,.18)'; for (let r = 0; r < 3; r++) c.fillRect(30, 250 + r * 56, 960, 30)
    }), 3.2, 3.3, z + 3.6, g)
    crowd(z + 1.2, -2.6, 'walk')
  },
  checkin(g, z, info, crowd, tex) { // desks with staff and screens, a backdrop with the airline, a queue with luggage
    const name = `${info.airline || 'Check-in'}   ·   ${info.flight || ''}`
    board(5.2, 0.7, tex(1024, 140, (c) => { c.fillStyle = '#0A1F3C'; c.fillRect(0, 0, 1024, 140); fit(c, name, 64, 960); c.fillStyle = '#fff'; c.fillText(name, 30, 92) }), 4.4, 2.6, z + 1.6, g)
    for (let i = 0; i < 3; i++) {
      const x = 2.7 + i * 1.6
      box(1.3, 1.05, 0.7, M.desk, x, 0, z + 0.6, g); box(0.5, 0.36, 0.04, M.dark, x, 1.05, z + 0.4, g); box(0.95, 0.22, 0.75, M.belt, x, 0, z - 0.25, g)
      standAt(person({ top: 0x1b2f4a, bottom: 0x1b2f4a }), x, z + 1.15, g, Math.PI) // staff
      if (i < 2) suitcase(x, z - 0.25, g, { handle: false }).g.position.y = 0.22
    }
    for (let i = 0; i < 5; i++) cyl(0.03, 1, M.metal, -1.4, 0, z - 2.2 + i * 1.1, g, 8)
    box(0.02, 0.06, 4.4, M.dark, -1.4, 0.92, z, g)
    crowd(z - 1.6, -2.2, 'queue', 4)
  },
  emigration(g, z, info, crowd) { // officer booths behind glass, a short queue
    for (let i = 0; i < 3; i++) {
      const x = 2.4 + i * 1.7
      box(1.2, 1.2, 1.4, M.dark, x, 0, z + 0.7, g); box(1.2, 0.8, 0.04, M.glass, x, 1.2, z, g)
      const off = standAt(person({ top: 0xe8e6e0, bottom: 0x1b2f4a, sit: true }), x, z + 0.9, g, Math.PI); off.root.position.y = 0.1
    }
    crowd(z - 1.2, -1.7, 'queue', 3)
  },
  security(g, z, info, crowd) { // walk-through arch on her path, x-ray machine, trays, an officer
    box(0.16, 2.2, 0.55, M.desk, -0.72, 0, z + 2.2, g); box(0.16, 2.2, 0.55, M.desk, 0.72, 0, z + 2.2, g); box(1.6, 0.24, 0.55, M.desk, 0, 2.2, z + 2.2, g)
    box(0.9, 0.75, 4.4, M.belt, 2.3, 0, z + 1, g); box(1.15, 1.2, 1.4, M.desk, 2.3, 0.75, z + 1.3, g); box(1.16, 0.6, 0.02, M.dark, 2.3, 1.1, z + 0.59, g, false)
    for (let i = 0; i < 4; i++) box(0.55, 0.1, 0.4, M.tray, 2.3, 0.75, z - 0.9 + i * 0.5, g)
    standAt(person({ top: 0x2a3d5c, bottom: 0x1b2f4a }), 1.2, z + 2.6, g, Math.PI)
    crowd(z - 0.2, 3.4, 'queue', 2)
  },
  gate(g, z, info, crowd, tex) { // seating with waiting passengers, the gate desk and number, an airliner at the window
    const gate = info.gate ? `Gate ${info.gate}` : 'Gate'
    board(2.6, 0.6, tex(512, 120, (c) => { c.fillStyle = '#FFC83D'; c.fillRect(0, 0, 512, 120); c.fillStyle = '#0A1F3C'; fit(c, gate, 70, 460); c.fillText(gate, 26, 86) }), -2.6, 2.6, z + 2.4, g)
    box(1.6, 1.05, 0.7, M.desk, -2.6, 0, z + 2.0, g)
    for (let r = 0; r < 3; r++) for (let s = 0; s < 6; s++) {
      const x = 2.0 + s * 0.6, zz = z - 1.2 + r * 1.4
      box(0.52, 0.45, 0.5, M.seat, x, 0, zz, g); box(0.52, 0.5, 0.08, M.seat, x, 0.45, zz - 0.22, g)
      if (rnd() < 0.55) { standAt(person({ sit: true }), x, zz, g, 0); if (rnd() < 0.5) suitcase(x + 0.3, zz + 0.4, g, { big: false, handle: false, rot: 0.3 }) }
    }
    crowd(z + 0.5, -1.9, 'stand', 2)
    const p = airliner(); p.position.set(-14, 0, z + 1); g.add(p) // airliner outside
    box(1.4, 1.6, 6.5, M.metal, 3.2, 2.4, 8, p) // the jet bridge reaching the terminal
  },
  transit(g, z, info, crowd) { box(1.4, 0.06, 6, M.belt, 2.4, 0, z, g); box(0.08, 0.95, 6, M.metal, 1.68, 0, z, g); box(0.08, 0.95, 6, M.metal, 3.12, 0, z, g); crowd(z, 2.4, 'stand', 2) },
  arrival(g, z, info, crowd) { BUILD.emigration(g, z, info, crowd) },
  baggage(g, z, info, crowd) { // carousel with bags going round, people waiting with trolleys
    const c = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.38, 10, 48), M.belt); c.rotation.x = Math.PI / 2; c.scale.set(1.7, 1, 1); c.position.set(4.2, 0.42, z + 0.6); c.castShadow = true; g.add(c)
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; suitcase(4.2 + Math.cos(a) * 2.7, z + 0.6 + Math.sin(a) * 1.6, g, { handle: false, rot: a }).g.position.y = 0.62 }
    trolley(1.9, z - 0.6, g, -0.3)
    crowd(z - 0.4, 2.3, 'stand', 3)
  },
}
// A narrow-body airliner, nose towards +z, sitting on its gear. `livery` is painted along both sides of the body.
export function airliner(livery, fontReady = Promise.resolve(), liveryZ = -0.6) {
  const p = new THREE.Group()
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.7, 20, 10, 24), M.plane); fus.rotation.x = Math.PI / 2; fus.position.y = 3.2; fus.castShadow = true; p.add(fus)
  // swept wings and tailplane, from top-view outlines
  const wing = (span, root, tip, sweep, y, z, thick) => {
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(span, -sweep), new THREE.Vector2(span, -sweep - tip), new THREE.Vector2(0, -root)])
    ;[1, -1].forEach((side) => { const w = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false }), M.plane); w.rotation.x = Math.PI / 2; w.scale.x = side; w.position.set(0, y, z); w.castShadow = true; p.add(w) })
  }
  wing(14.5, 4.2, 1.3, 4.2, 2.55, 3.2, 0.28); wing(5.5, 2.4, 0.9, 1.8, 3.9, -8.6, 0.18)
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-3.4, 0), new THREE.Vector2(-5.2, 5.2), new THREE.Vector2(-3.4, 5.2)]), { depth: 0.3, bevelEnabled: false }), M.tail)
  fin.rotation.y = -Math.PI / 2; fin.position.set(-0.15, 4.4, -7.6); fin.castShadow = true; p.add(fin)
  ;[-5.2, 5.2].forEach((x) => { // engines under the wings, dark intakes
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.7, 3, 24), M.metal); e.rotation.x = Math.PI / 2; e.position.set(x, 1.55, 3.6); e.castShadow = true; p.add(e)
    const intake = new THREE.Mesh(new THREE.CircleGeometry(0.66, 24), M.dark); intake.position.set(x, 1.55, 5.11); p.add(intake)
    box(0.2, 0.7, 1.6, M.plane, x, 1.9, 3.4, p, false)
  })
  ;[[0, 9.5], [-2, -0.5], [2, -0.5]].forEach(([x, z]) => { cyl(0.06, 1.4, M.metal, x, 0.25, z, p, 8); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), M.wheel); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); p.add(w) })
  ;[-1.69, 1.69].forEach((x) => { for (let i = 0; i < 26; i++) box(0.02, 0.22, 0.16, M.dark, x, 3.35, -9 + i * 0.7, p, false); box(0.03, 0.12, 21, M.tail, x * 1.004, 2.75, 0.4, p, false) })
  ;[-0.55, 0, 0.55].forEach((x) => box(0.42, 0.3, 0.05, M.dark, x, 3.75, 11.2, p, false))
  if (livery) {
    // the painted name is as long as the name itself (a short airline name isn't stretched along the body)
    const g = document.createElement('canvas').getContext('2d'); fit(g, livery, 150, 1980)
    const cw = Math.ceil(Math.min(1980, g.measureText(livery).width) + 50), wm = (cw / 220) * 1.5
    const t = textTex(cw, 220, (c) => { c.clearRect(0, 0, cw, 220); c.fillStyle = '#0A1F3C'; fit(c, livery, 150, cw - 40); c.textBaseline = 'middle'; c.fillText(livery, 20, 118) }, fontReady)
    const mm = new THREE.MeshBasicMaterial({ map: t, transparent: true })
    ;[1, -1].forEach((side) => { const d = new THREE.Mesh(new THREE.PlaneGeometry(wm, 1.5), mm); d.rotation.y = side * Math.PI / 2; d.position.set(side * 1.705, 4.05, liveryZ); p.add(d) }) // reads left to right from either side
    p.userData.dispose = () => { t.dispose(); mm.dispose() }
  }
  return p
}

const kind = (id = '') => (BUILD[id] ? id : id.startsWith('transit') ? 'transit' : null)
// The English word she will actually see on the sign at that spot: she may not read it, but she can match its shape.
const SIGN = { entry: 'Departures', checkin: 'Check-in', emigration: 'Emigration', security: 'Security', gate: 'Gates', transit: 'Transfers', arrival: 'Immigration', baggage: 'Baggage Claim' }

// A real person, if the project supplies one: public/models/traveller.glb (rigged, with walk and idle clips).
export async function realPerson() {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
  const gltf = await new GLTFLoader().loadAsync('/models/traveller.glb')
  const root = gltf.scene
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
  root.scale.setScalar(1.58 / (size.y || 1))
  root.traverse((o) => { if (o.isMesh) o.castShadow = true })
  const mixer = new THREE.AnimationMixer(root)
  const clip = (re) => gltf.animations.find((a) => re.test(a.name))
  const walkA = clip(/walk/i) && mixer.clipAction(clip(/walk/i)), idleA = clip(/idle|stand/i) && mixer.clipAction(clip(/idle|stand/i))
  walkA?.play(); idleA?.play()
  let lastNow = performance.now()
  return {
    root,
    update(phase, walk, now) {
      walkA?.setEffectiveWeight(walk).setEffectiveTimeScale(0.85); idleA?.setEffectiveWeight(1 - walk)
      mixer.update(Math.min(0.05, (now - lastNow) / 1000)); lastNow = now
    },
  }
}

// The departures hall (and, after the flight, an arrivals hall far down the same line), with its crowd.
// Used by the airport step and by the story; z0 is where the first stop is.
export function buildAirport(scene, { steps, info = {}, z0 = 0, pre = 12 }) {
  const fontReady = document.fonts?.load(FONT(48)).catch(() => {}) || Promise.resolve()
  const textures = []
  const tex = (w, h, paint) => { const t = textTex(w, h, paint, fontReady); textures.push(t); return t }

  // where each stop is; the steps after the flight (transit, arrival, baggage) are in another airport, so they start a new hall far away
  const AWAY = ['arrival', 'baggage', 'transit']
  const stopZ = []
  steps.forEach((s, i) => { const prev = steps[i - 1]; stopZ.push(i === 0 ? z0 : stopZ[i - 1] + SP + (AWAY.includes(kind(s.id)) && !AWAY.includes(kind(prev.id)) ? 90 : 0)) })
  if (!stopZ.length) stopZ.push(z0)
  const world = new THREE.Group(); scene.add(world)
  const len = stopZ[stopZ.length - 1] - z0 + pre + 12 + SP, mid = z0 + len / 2 - pre
  // polished tiled floor
  const ft = tex(512, 512, (c) => { c.fillStyle = '#e9e4da'; c.fillRect(0, 0, 512, 512); c.strokeStyle = 'rgba(120,110,95,.18)'; c.lineWidth = 3; c.strokeRect(0, 0, 512, 512); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, 0, 256, 256); c.fillRect(256, 256, 256, 256) })
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(20, len / 2)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, len), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.28, metalness: 0.05 }))
  floor.rotation.x = -Math.PI / 2; floor.position.z = mid; floor.receiveShadow = true; world.add(floor)
  // ceiling with rows of light panels, columns, the right wall with shopfronts and planters, the glass facade on the left
  box(16, 0.1, len, M.wall, 0, 5.2, mid, world, false)
  for (let z = z0 - pre; z < z0 + len - pre; z += 3) for (const x of [-3.5, 0, 3.5]) box(2.4, 0.04, 0.5, M.light, x, 5.12, z, world, false)
  for (let z = z0 - pre + 6; z < z0 + len - pre; z += 10) { cyl(0.3, 5.2, M.wall, 6.4, 0, z, world); cyl(0.3, 5.2, M.wall, -6.4, 0, z, world) }
  box(0.3, 5.2, len, M.wall, 7.6, 0, mid, world)
  for (let z = z0 - pre + 8; z < z0 + len - pre; z += 9) { box(3, 2.4, 0.1, M.glass, 7.4, 0.2, z, world); box(0.5, 0.45, 0.5, M.pot, 6.8, 0, z + 4, world); const pl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), M.plant); pl.position.set(6.8, 0.95, z + 4); pl.castShadow = true; world.add(pl) }
  for (let z = z0 - pre; z < z0 + len - pre; z += 3) box(0.12, 5.2, 0.12, M.metal, -7.2, 0, z, world)
  box(0.05, 5.2, len, M.glass, -7.2, 0, mid, world, false)
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(60, len + 40), M.tarmac); apron.rotation.x = -Math.PI / 2; apron.position.set(-38, -0.02, mid); world.add(apron)

  // other passengers: queues with luggage, people standing, people walking through the hall
  const walkers = []
  const crowd = (z, x, how, n = 1) => {
    for (let i = 0; i < n; i++) {
      const p = person({ dress: rnd() < 0.4 ? 'saree' : 'trousers', bun: rnd() < 0.5 })
      const zz = how === 'queue' ? z + i * 0.95 : z + (rnd() - 0.5) * 1.2, xx = x + (how === 'queue' ? 0 : (rnd() - 0.5) * 0.8)
      standAt(p, xx, zz, world, how === 'queue' ? 0 : rnd() * Math.PI * 2)
      if (how !== 'walk' && rnd() < 0.8) suitcase(xx + 0.32, zz - 0.1, world, { rot: 0.2 })
      if (how === 'walk') walkers.push({ p, z: zz, home: zz, dir: rnd() < 0.5 ? 1 : -1, phase: rnd() * 6 })
    }
  }
  stopZ.forEach((z, i) => crowd(z + 3.5, i % 2 ? 2.6 : -2.8, 'walk')) // people passing through the hall

  steps.forEach((s, i) => {
    const z = stopZ[i], k = kind(s.id)
    if (k) BUILD[k](world, z, info, crowd, tex)
    const label = `${i + 1}   ${SIGN[k] || s.title}`
    board(3.6, 0.56, tex(1024, 160, (c) => { c.fillStyle = '#0A1F3C'; c.fillRect(0, 0, 1024, 160); fit(c, label, 84, 940); c.fillStyle = '#FFC83D'; c.textBaseline = 'middle'; c.fillText(label, 42, 84) }), 0, 3.4, z + 2.9, world)
    ;[-1.5, 1.5].forEach((x) => cyl(0.012, 1.5, M.metal, x, 3.68, z + 2.9, world, 6))
  })

  return {
    world, stopZ, len, textures,
    // passers-by keep walking up and down their part of the hall
    update(dt, now) {
      for (const w of walkers) {
        w.z += w.dir * 1.1 * dt; if (w.z > w.home + 12) w.dir = -1; if (w.z < w.home - 12) w.dir = 1
        w.phase += dt * 5.6; w.p.root.position.z = w.z; w.p.root.rotation.y = w.dir > 0 ? 0 : Math.PI; w.p.update(w.phase, 1, now)
      }
    },
    dispose() { textures.forEach((x) => x.dispose()); floor.material.dispose() },
  }
}

// Lakshmi: saree, stooped, stick in her right hand, her own big roller case in her left.
export function lakshmi({ bag = true, sit = false } = {}) {
  const t = person({ dress: 'saree', top: 0x5a2430, bottom: 0x7a2e3a, skin: 0x8d5b3e, hair: 0xbab6ae, bun: true, stoop: sit ? 0.08 : 0.17, h: 0.97, sit })
  if (!sit) cyl(0.012, 0.84, M.stick, -0.29, 0, 0.2, t.root, 8)
  if (bag) { const own = suitcase(0.38, -0.36, t.root, { color: 0x2e5d62 }); own.g.rotation.x = -0.32 }
  const update = t.update
  t.update = (phase, walk, now) => { update(phase, walk, now); if (sit) return; t.arms[0].rotation.x = -0.3 - Math.sin(phase) * 0.1 * walk; t.arms[1].rotation.x = bag ? 0.45 : 0.1 }
  return t
}

export const reseed = () => { seed = 7 }

export function createTerminal(host, { steps, start = 0, still = false, info = {} }) {
  reseed() // same crowd every time for the same trip
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe7eef4); scene.fog = new THREE.Fog(0xe7eef4, 22, 55)
  const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 120)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfbf, 1.5))
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.9); sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 45 }); sun.shadow.bias = -0.0006
  scene.add(sun, sun.target)
  const airport = buildAirport(scene, { steps, info })
  const { stopZ } = airport

  let raf = 0, last = performance.now(), visible = true, gone = false
  const zOf = (i) => stopZ[Math.max(0, Math.min(stopZ.length - 1, i))]
  let pos = zOf(start), target = pos, phase = 0, walk = 0, heading = 0
  // Lakshmi: saree, stooped, stick in her right hand, her own big roller case in her left
  let t = lakshmi()
  t.root.position.z = pos; scene.add(t.root)
  realPerson().then((real) => { if (gone) return; scene.remove(t.root); t = real; t.root.position.z = pos; scene.add(t.root); if (still || !visible) draw(performance.now()) }).catch(() => {})

  const camPos = new THREE.Vector3(0.55, 1.8, pos - 3.2), look = new THREE.Vector3()
  const draw = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    const dz = target - pos, dir = Math.sign(dz)
    if (Math.abs(dz) > 0.01 && !still) { pos += dir * Math.min(Math.abs(dz), Math.max(SPEED, Math.abs(dz) / 4) * dt); walk = Math.min(1, walk + dt * 3) } else { pos = target; walk = Math.max(0, walk - dt * 3) }
    heading += ((dir < 0 && walk > 0 ? Math.PI : 0) - heading) * Math.min(1, dt * 6)
    phase += dt * 5.2 * walk
    t.root.position.z = pos; t.root.rotation.y = heading
    t.update(phase, walk, now)
    if (!still) airport.update(dt, now)
    // camera: just behind and above her shoulder, looking where she walks; it trails gently, no sudden swings
    const k = still ? 1 : 1 - Math.exp(-dt * 1.8)
    camPos.lerp(look.set(0.55, 1.8, pos - 3.2), k); camera.position.copy(camPos)
    camera.lookAt(0, 1.3, pos + 4)
    sun.position.set(-8, 14, pos - 4); sun.target.position.set(0, 0, pos + 3)
    renderer.render(scene, camera)
    if (!still && visible && !gone) raf = requestAnimationFrame(draw)
  }
  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
    camera.aspect = w / h; camera.fov = w / h > 2.4 ? 40 : 52; camera.updateProjectionMatrix()
    if (still || !visible) draw(performance.now())
  }
  const ro = new ResizeObserver(resize); ro.observe(host)
  const io = new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting && !document.hidden; if (visible && !was && !still) { last = performance.now(); raf = requestAnimationFrame(draw) } })
  io.observe(host)
  resize(); if (!still) raf = requestAnimationFrame(draw)

  return {
    setStep(i) {
      target = zOf(i)
      if (still || Math.abs(target - pos) > SP * 3) { pos = target; camPos.set(0.55, 1.8, pos - 3.2) } // big jumps cut straight there
      if (still || !visible) draw(performance.now())
    },
    dispose() {
      gone = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      scene.traverse((o) => { o.geometry?.dispose() })
      ;[...Object.values(M), ...cache.values()].forEach((x) => x.dispose()); cache.clear()
      airport.dispose(); renderer.dispose(); renderer.domElement.remove()
    },
  }
}
