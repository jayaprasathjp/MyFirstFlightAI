// "See how it works": one continuous 3D story, so a first-time flyer can picture herself using the app.
// Home table: photograph ticket, passport, visa → a second traveller joins with his papers → the checks →
// the days before → out of the window, the drive to the airport → in through the doors, check-in, security,
// the gate → (the flight, on the globe; drawn by the player) → arrivals, where her son is waiting.
// Time runs in story seconds; the player can hold the clock at a chapter's end until its narration finishes.
import * as THREE from 'three'
import { M, mat, box, cyl, person, suitcase, textTex, FONT, fit, board, buildAirport, lakshmi, reseed, airliner } from './terminal'

// chapter starts (s); the last entry is the end. Narration line i is spoken at CHAPTERS[i].
export const CHAPTERS = [0, 6, 15, 22, 29, 36, 45, 54, 64, 80, 89, 97] // the flight (64–80) is one chapter; it ends on the plane's name
export const GLOBE_FROM = 70.5, GLOBE_TO = 80 // the flight is shown on the globe between these times
const HOLDS = new Set([6, 15, 22, 29, 36, 45, 64, 80, 89, 97]) // where the clock may wait for the voice (not mid-walk)

const HOME = -70 // z of the dining table
const Z0 = 12 // first airport stop (the departures doors)
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const lerp = (a, b, k) => a + (b - a) * k
const span = (t, a, b) => ease((t - a) / (b - a))
// piecewise path [[t, x, z], ...] → position at t, and whether it is moving
function along(keys, t) {
  if (t <= keys[0][0]) return { x: keys[0][1], z: keys[0][2], moving: false }
  for (let i = 1; i < keys.length; i++) {
    const [t1, x1, z1] = keys[i], [t0, x0, z0] = keys[i - 1]
    if (t <= t1) { const k = (t - t0) / (t1 - t0 || 1); return { x: lerp(x0, x1, k), z: lerp(z0, z1, k), moving: x0 !== x1 || z0 !== z1 } }
  }
  const l = keys[keys.length - 1]; return { x: l[1], z: l[2], moving: false }
}
// camera keyframes [[t, [px,py,pz], [lx,ly,lz]], ...], eased between neighbours
function camAt(keys, t) {
  let i = keys.findIndex((k) => k[0] > t); if (i === -1) i = keys.length; if (i === 0) i = 1
  const a = keys[Math.min(i - 1, keys.length - 1)], b = keys[Math.min(i, keys.length - 1)], k = span(t, a[0], b[0] || a[0] + 1)
  return { pos: a[1].map((v, j) => lerp(v, b[1][j], k)), look: a[2].map((v, j) => lerp(v, b[2][j], k)) }
}

// realistic-looking papers, painted from the trip
function paintDoc(kind, c, w, h, d) {
  if (kind === 'passport') {
    c.fillStyle = '#16305a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#E5C26A'; c.lineWidth = 6
    c.beginPath(); c.arc(w / 2, h * 0.38, w * 0.2, 0, 7); c.stroke(); c.beginPath(); c.arc(w / 2, h * 0.38, w * 0.1, 0, 7); c.stroke()
    c.fillStyle = '#E5C26A'; c.font = FONT(30); c.textAlign = 'center'; c.fillText('PASSPORT', w / 2, h * 0.75)
  } else if (kind === 'visa') {
    c.fillStyle = '#E8E1CB'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(60,110,90,.18)'; c.lineWidth = 4
    for (let x = -h; x < w; x += 16) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + h, 0); c.stroke() }
    c.fillStyle = '#2F5D4C'; c.font = FONT(30); c.fillText(`VISA · ${(d.dest || '').toUpperCase()}`, 22, 46)
    c.fillRect(22, 80, w * 0.45, 10); c.fillRect(22, 104, w * 0.32, 10)
    c.strokeStyle = 'rgba(179,38,30,.8)'; c.lineWidth = 5; c.beginPath(); c.arc(w - 70, h - 60, 42, 0, 7); c.stroke()
    c.fillStyle = 'rgba(179,38,30,.85)'; c.font = FONT(20); c.textAlign = 'center'; c.fillText(d.to || '', w - 70, h - 62); c.fillText('ENTRY', w - 70, h - 40)
  } else {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1B4F9C'; c.font = FONT(26); c.fillText(d.flight || 'BOARDING PASS', 18, 40)
    c.fillStyle = '#0A1F3C'; c.font = FONT(56); c.fillText(d.from || '', 18, 120); c.fillText(d.to || '', 18, 190)
    for (let x = 18; x < w - 18; x += 7) { c.fillRect(x, h - 70, x % 3 ? 3 : 5, 52) }
  }
}

export function createStory(host, { data, labels, still = false, shouldHold = () => false, onChapter, onEnd, onTime, onLost }) {
  reseed()
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gone = true; onLost?.() })
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xdfe9f2); scene.fog = new THREE.Fog(0xdfe9f2, 40, 110)
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 200)
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xcfc6b6, 1.35))
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.8); sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 }); sun.shadow.bias = -0.0006
  scene.add(sun, sun.target)
  const fontReady = document.fonts?.load(FONT(48)).catch(() => {}) || Promise.resolve()
  const textures = []
  const tex = (w, h, paint) => { const t = textTex(w, h, paint, fontReady); textures.push(t); return t }
  const W = new THREE.Group(); scene.add(W)
  const own = [] // materials made here, disposed at the end
  const mk = (c, o) => { const x = mat(c, o); own.push(x); return x }

  // ---------- home: a dining room in Chennai, early evening ----------
  const wood = mk(0x8a5a3b, { roughness: 0.6 }), wallC = mk(0xeadfcd), floorC = mk(0xb98b5e, { roughness: 0.5 }), rug = mk(0x8f3b2e)
  box(9, 0.05, 8, floorC, 0, -0.05, HOME, W)
  box(3.2, 0.012, 2.2, rug, 0, 0, HOME, W, false)
  box(9, 3.2, 0.15, wallC, 0, 0, HOME - 4, W) // back wall
  box(0.15, 3.2, 8, wallC, -4.5, 0, HOME, W); box(0.15, 3.2, 8, wallC, 4.5, 0, HOME, W)
  // front wall with a window to the street (the camera leaves through it)
  const fz = HOME + 4
  box(3.1, 3.2, 0.15, wallC, -2.95, 0, fz, W); box(3.1, 3.2, 0.15, wallC, 2.95, 0, fz, W)
  box(2.8, 1.0, 0.15, wallC, 0, 0, fz, W); box(2.8, 0.7, 0.15, wallC, 0, 2.5, fz, W)
  box(9.2, 0.2, 8.2, mk(0xd9cbb3), 0, 3.2, HOME, W) // roof
  box(0.5, 2.1, 0.04, mk(0xc9a45c, { roughness: 0.9 }), -1.2, 0.9, fz - 0.1, W, false); box(0.5, 2.1, 0.04, mk(0xc9a45c, { roughness: 0.9 }), 1.2, 0.9, fz - 0.1, W, false) // curtains
  box(1.1, 2.1, 0.06, mk(0x6b4a33), -4.42, 0, HOME - 1.5, W) // side door the second traveller comes through (shown ajar)
  // table, chairs, a lamp, a ceiling fan, a cupboard, a framed photo, a plant
  box(1.9, 0.05, 1.0, wood, 0, 0.72, HOME, W)
  ;[[-0.88, -0.44], [0.88, -0.44], [-0.88, 0.44], [0.88, 0.44]].forEach(([x, z]) => box(0.06, 0.72, 0.06, wood, x, 0, HOME + z, W))
  ;[-0.45, 0.45].forEach((x) => { box(0.46, 0.05, 0.44, wood, x, 0.44, HOME - 0.9, W); box(0.46, 0.55, 0.05, wood, x, 0.49, HOME - 1.12, W); [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([a, b]) => box(0.04, 0.44, 0.04, wood, x + a, 0, HOME - 0.9 + b, W)) })
  const fan = new THREE.Group(); fan.position.set(0, 2.95, HOME); W.add(fan)
  cyl(0.08, 0.2, M.metal, 0, 0, 0, fan, 12); for (let i = 0; i < 3; i++) { const bl = box(1.1, 0.012, 0.13, mk(0xe9e4da), 0, 0.02, 0, fan, false); bl.position.x = 0; bl.geometry.translate(0.55, 0, 0); bl.rotation.y = (i * Math.PI * 2) / 3 }
  box(1.6, 2.0, 0.5, wood, -3.5, 0, HOME - 3.6, W); box(0.6, 0.45, 0.03, mk(0x3b2f2a), -1.6, 1.75, HOME - 3.92, W, false)
  const lamp = new THREE.PointLight(0xffd9a0, 0.9, 8, 1.6); lamp.position.set(0, 2.5, HOME); W.add(lamp)
  box(0.4, 0.4, 0.4, M.pot, 3.8, 0, HOME + 3, W); const pl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), M.plant); pl.position.set(3.8, 0.85, HOME + 3); W.add(pl)
  // the wall calendar counts down the days
  let calText = '3'
  const calTex = tex(256, 320, (c) => { c.fillStyle = '#FBF8F0'; c.fillRect(0, 0, 256, 320); c.fillStyle = '#B3261E'; c.fillRect(0, 0, 256, 70); c.fillStyle = '#0A1F3C'; c.font = FONT(170); c.textAlign = 'center'; c.fillText(calText, 128, 250) })
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshStandardMaterial({ map: calTex, roughness: 0.9 })); own.push(cal.material)
  cal.position.set(1.4, 1.62, HOME - 3.91); W.add(cal)
  const calPage = (n) => { if (calText !== n) { calText = n; const c = calTex.image.getContext('2d'); c.fillStyle = '#FBF8F0'; c.fillRect(0, 70, 256, 250); c.fillStyle = '#0A1F3C'; c.font = FONT(170); c.textAlign = 'center'; c.fillText(n, 128, 250); calTex.needsUpdate = true } }
  // the open suitcase being packed, closed on the last day
  box(1.1, 0.55, 0.62, wood, 1.4, 0, HOME - 3.45, W) // a low bench against the wall, under the calendar
  const case0 = new THREE.Group(); case0.position.set(1.4, 0.55, HOME - 3.45); W.add(case0)
  const caseM = mk(0x2e5d62, { roughness: 0.45 })
  // an open shell: floor and four sides, so what is packed can be seen
  box(0.72, 0.03, 0.5, caseM, 0, 0, 0, case0); box(0.72, 0.16, 0.03, caseM, 0, 0, 0.235, case0); box(0.72, 0.16, 0.03, caseM, 0, 0, -0.235, case0)
  box(0.03, 0.16, 0.5, caseM, 0.345, 0, 0, case0); box(0.03, 0.16, 0.5, caseM, -0.345, 0, 0, case0)
  const clothes = [[0x7a2e3a, -0.16, 0], [0xe8e2d6, 0.16, 0], [0xb8913a, -0.14, 1], [0x2f4f6f, 0.14, 1]].map(([c, x, layer]) => { const o = box(0.3, 0.05, 0.4, mk(c, { roughness: 0.95 }), x, 0.03 + layer * 0.05, 0, case0, false); o.userData.y = o.position.y; return o })
  const lidHinge = new THREE.Group(); lidHinge.position.set(0, 0.16, -0.25); case0.add(lidHinge)
  const lid = box(0.72, 0.06, 0.5, caseM, 0, 0, 0.25, lidHinge); lid.position.y = 0.03

  // the people at home
  const L0 = lakshmi({ bag: false, sit: true }); L0.root.position.set(-0.45, 0, HOME - 0.85); W.add(L0.root)
  const husband = { top: 0xe8e2d6, bottom: 0xcfc6b4, skin: 0x7a4e35, hair: 0xbab6ae, stoop: 0.1, h: 1.02 }
  const R0walk = person({ ...husband }); W.add(R0walk.root)
  const R0sit = person({ ...husband, sit: true }); R0sit.root.position.set(0.45, 0, HOME - 0.85); W.add(R0sit.root)

  // papers on the table: three for her, three for him (slid in when he is added)
  const doc = (kind, x, z, dz = 0) => {
    const [w, h] = kind === 'passport' ? [0.125, 0.176] : kind === 'visa' ? [0.19, 0.125] : [0.1, 0.2]
    const tx = tex(kind === 'visa' ? 380 : 256, kind === 'visa' ? 250 : kind === 'passport' ? 360 : 512, (c) => paintDoc(kind, c, c.canvas.width, c.canvas.height, data))
    const mm = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.7 }); own.push(mm)
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, 0.004, h), [M.desk, M.desk, mm, M.desk, M.desk, M.desk])
    o.position.set(x, 0.772, HOME + 0.25 + dz); o.rotation.y = (z || 0); o.castShadow = true; W.add(o); return { o, tx, kind }
  }
  const herDocs = [doc('ticket', -0.82, 0.08), doc('passport', -0.5, -0.05), doc('visa', -0.16, 0.04)]
  const hisDocs = [doc('ticket', 0.16, -0.06), doc('passport', 0.48, 0.05), doc('visa', 0.82, -0.04)]
  // a green tick over each paper once it has been read
  const tickTex = tex(128, 128, (c) => { c.fillStyle = '#1F7A4D'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 14; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(36, 66); c.lineTo(56, 86); c.lineTo(92, 46); c.stroke() })
  const tickMat = new THREE.SpriteMaterial({ map: tickTex, depthTest: false }); own.push(tickMat)
  const ticks = [...herDocs, ...hisDocs].map((d) => { const s = new THREE.Sprite(tickMat); s.position.set(d.o.position.x, 0.86, d.o.position.z); s.scale.setScalar(0); W.add(s); return s })
  // the phone "you" hold: its screen shows the paper being photographed, then a flash
  const phone = new THREE.Group(); W.add(phone)
  phone.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.008), mk(0x15181d, { roughness: 0.3 })))
  let shot = null
  const scrTex = tex(160, 320, (c) => { c.fillStyle = '#0b1220'; c.fillRect(0, 0, 160, 320) })
  const paintScreen = (d, flash) => {
    const c = scrTex.image.getContext('2d'); c.fillStyle = flash ? '#ffffff' : '#0b1220'; c.fillRect(0, 0, 160, 320)
    if (d && !flash) { c.save(); c.translate(20, 50); c.drawImage(d.tx.image, 0, 0, 120, d.kind === 'visa' ? 80 : 190); c.restore(); c.strokeStyle = '#FFC83D'; c.lineWidth = 5; [[14, 44], [146, 44], [14, 276], [146, 276]].forEach(([x, y], i) => { c.beginPath(); c.moveTo(x, y + (i < 2 ? 18 : -18)); c.lineTo(x, y); c.lineTo(x + (i % 2 ? -18 : 18), y); c.stroke() }) }
    scrTex.needsUpdate = true
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.15), new THREE.MeshBasicMaterial({ map: scrTex })); own.push(screen.material)
  screen.position.z = 0.0045; phone.add(screen)
  const flashLight = new THREE.PointLight(0xffffff, 0, 1.5); W.add(flashLight)
  // the checks: a scan line across all the papers, then the verdict card rises
  const scan = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.004, 0.03), new THREE.MeshBasicMaterial({ color: 0xffc83d })); own.push(scan.material); scan.visible = false; W.add(scan)
  const verdictTex = tex(640, 160, (c) => { c.fillStyle = '#DCEFE5'; c.fillRect(0, 0, 640, 160); c.strokeStyle = '#1F7A4D'; c.lineWidth = 10; c.strokeRect(5, 5, 630, 150); c.fillStyle = '#1F7A4D'; fit(c, `${labels.ready || 'Ready to fly'} ✓`, 72, 580); c.textBaseline = 'middle'; c.fillText(`${labels.ready || 'Ready to fly'} ✓`, 30, 84) })
  const verdictMat = new THREE.SpriteMaterial({ map: verdictTex, depthTest: false }); own.push(verdictMat)
  const verdict = new THREE.Sprite(verdictMat); verdict.scale.set(0, 0, 1); verdict.position.set(0, 1.05, HOME); W.add(verdict)
  const shots = [[7.4, herDocs[0]], [8.8, herDocs[1]], [10.2, herDocs[2]], [19.0, hisDocs[0]], [19.5, hisDocs[1]], [20.0, hisDocs[2]]]
  // which paper the phone is framing over time (x along the table); it rises into view and drops away again
  const aimKeys = [[6, -0.82, 0], [7.0, -0.82, 0], [7.8, -0.5, 0], [8.4, -0.5, 0], [9.2, -0.16, 0], [10.6, -0.16, 0], [18.2, 0.16, 0], [18.7, 0.16, 0], [19.25, 0.48, 0], [19.75, 0.82, 0], [20.6, 0.82, 0]]
  const phoneUp = (t) => Math.min(span(t, 6, 6.7) - span(t, 10.7, 11.5), 1) + Math.min(span(t, 18, 18.6) - span(t, 20.4, 21.1), 1)

  const HG = new THREE.Group(); scene.add(HG); W.children.slice().forEach((c) => HG.add(c)) // everything so far is the home

  // ---------- the street to the airport ----------
  const asphalt = mk(0x55595e, { roughness: 0.9 }), pave = mk(0xc9c3b8), grass = mk(0x8fa66b)
  box(140, 0.02, 160, grass, 0, -0.08, -20, W, false)
  box(7, 0.02, 80, asphalt, 0, -0.04, -36, W, false)
  for (let z = -74; z < 2; z += 4) box(0.15, 0.022, 2, mk(0xf2f2ee), 0, -0.04, z, W, false)
  ;[-4.6, 4.6].forEach((x) => box(2.2, 0.12, 80, pave, x, -0.06, -36, W, false))
  const building = (x, z, w, h, d, c) => {
    const winTex = tex(256, 256, (g) => { g.fillStyle = c; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(40,60,80,.55)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(24 + i * 58, 24 + j * 58, 34, 38) })
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.repeat.set(Math.max(1, Math.round(d / 4)), Math.max(1, Math.round(h / 4)))
    const mm = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85 }); own.push(mm); box(w, h, d, mm, x, 0, z, W)
  }
  const tones = ['#e8d7b9', '#d9c3a5', '#c9d4d6', '#e3cfc0', '#d6d9c4']
  for (let i = 0; i < 9; i++) { building(-11 - (i % 2) * 1.5, -60 + i * 7.2, 6, 5 + ((i * 7) % 9), 6, tones[i % 5]); building(11 + (i % 3), -57 + i * 7.2, 6, 6 + ((i * 5) % 8), 6, tones[(i + 2) % 5]) }
  for (let z = -62; z < -4; z += 8) [-5.2, 5.2].forEach((x) => { cyl(0.12, 2.2, mk(0x6b4a33), x, 0, z, W, 8); const c = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), M.plant); c.position.set(x, 2.8, z); c.castShadow = true; W.add(c); cyl(0.05, 4.5, M.metal, -x * 1.08, 0, z + 4, W, 6) })
  // the taxi that takes them: a sedan, nose towards +z, with glass cabin, lights, mirrors, rims and the roof sign
  const car = new THREE.Group(); W.add(car)
  const paint = mk(0xf1f3f5, { roughness: 0.25, metalness: 0.35 }), glass = mk(0x1d2733, { roughness: 0.08, metalness: 0.6 })
  const side = new THREE.Shape(); // side profile: length along x, height along y
  side.moveTo(-2.2, 0.28); side.lineTo(2.15, 0.28); side.quadraticCurveTo(2.36, 0.3, 2.34, 0.6); side.lineTo(1.25, 0.8); side.lineTo(-1.55, 0.84); side.quadraticCurveTo(-2.26, 0.8, -2.24, 0.52); side.lineTo(-2.2, 0.28)
  const cab = new THREE.Shape(); cab.moveTo(1.2, 0.79); cab.lineTo(0.4, 1.3); cab.lineTo(-0.95, 1.32); cab.lineTo(-1.55, 0.83)
  const ext = (shape, depth, mm, bevel) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3 }); g.translate(0, 0, -depth / 2); const o = new THREE.Mesh(g, mm); o.castShadow = true; return o }
  const shell = new THREE.Group(); shell.rotation.y = -Math.PI / 2; car.add(shell)
  shell.add(ext(side, 1.62, paint, true), ext(cab, 1.46, glass, true))
  box(1.25, 0.05, 1.5, paint, -0.3, 1.31, 0, shell) // roof
  box(0.5, 0.14, 0.18, mk(0xffc83d), -0.3, 1.36, 0, shell) // TAXI sign
  ;[[1.4, 1], [1.4, -1], [-1.35, 1], [-1.35, -1]].forEach(([x, sz]) => {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20), M.wheel); tyre.rotation.x = Math.PI / 2; tyre.position.set(x, 0.34, sz * 0.82); shell.add(tyre)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 16), M.metal); rim.rotation.x = Math.PI / 2; rim.position.copy(tyre.position); shell.add(rim)
  })
  ;[-0.58, 0.58].forEach((z) => { box(0.05, 0.1, 0.32, mk(0xfff6d8, { emissive: 0xfff2c0, emissiveIntensity: 0.6 }), 2.33, 0.52, z, shell, false); box(0.05, 0.1, 0.3, mk(0xb3261e, { emissive: 0x7a1812, emissiveIntensity: 0.4 }), -2.25, 0.58, z, shell, false); box(0.14, 0.08, 0.06, paint, 1.05, 0.86, z * 1.52, shell) })
  const carKeys = [[0, 1.6, -60], [38, 1.6, -60], [44.4, 1.6, 7.5]]
  const SG = new THREE.Group(); scene.add(SG); W.children.slice().forEach((c) => SG.add(c)) // the street

  // ---------- the airport (same hall as the airport step), and arrivals with her son waiting ----------
  const airport = buildAirport(scene, { steps: data.steps, info: data.info, z0: Z0, pre: 11 })
  const stops = airport.stopZ, gate = stops[data.gateIdx], arr = stops[data.arrivalIdx] ?? gate + 97
  box(3.3, 5.2, 0.12, M.glass, -5.6, 0, Z0 + 2.2, W); box(3.3, 5.2, 0.12, M.glass, 5.6, 0, Z0 + 2.2, W); box(15, 2.3, 0.12, M.glass, 0, 2.9, Z0 + 2.2, W) // the terminal front
  const son = person({ top: 0x2f4f6f, bottom: 0x3f3f46, skin: 0x8d5b3e, hair: 0x1e1a17, h: 1.06 }); son.root.position.set(0.2, 0, arr + 11); son.root.rotation.y = Math.PI; W.add(son.root)
  const placard = board(0.8, 0.45, tex(400, 220, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 400, 220); c.fillStyle = '#0A1F3C'; fit(c, data.placard, 90, 360); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(data.placard, 200, 115) }), 0, 0, 0, son.root)
  placard.position.set(0, 1.35, 0.32); placard.rotation.y = Math.PI // facing her as she walks out

  const homePlane = airliner('Welcome to MyFirstFlightAI', fontReady); homePlane.position.set(-34, 0, arr + 6); W.add(homePlane)

  // the two of them travelling (with their cases), walking as one
  const L = lakshmi(); W.add(L.root)
  const R = person({ ...husband }); W.add(R.root); suitcase(0.38, -0.36, R.root, { color: 0x34495e }).g.rotation.x = -0.32
  const walkKeys = [[44.6, 0.9, 9.6], [46, 0, Z0], [50, 0, stops[1] ?? Z0 + 7], [52, 0, stops[1] ?? Z0 + 7]]
  for (let i = 2; i <= data.gateIdx; i++) walkKeys.push([52 + (i - 1) * 3.6, 0, stops[i]], [52.6 + (i - 1) * 3.6, 0, stops[i]])
  const arrivalKeys = [[76, 0, arr - 6], [83, 0, arr], [84, 0, arr], [88, 0, arr + 9.2]]

  // ---------- camera ----------
  const camKeys = [
    [0, [0, 1.6, HOME + 3.6], [0, 0.95, HOME]], [5.2, [-0.2, 1.5, HOME + 1.7], [-0.4, 0.8, HOME]],
    [6.2, [-0.45, 1.5, HOME + 1.2], [-0.45, 0.77, HOME + 0.25]], [10.8, [-0.35, 1.5, HOME + 1.2], [-0.4, 0.77, HOME + 0.25]],
    [15.2, [0.2, 1.7, HOME + 2.2], [-0.6, 0.95, HOME - 1]], [17.6, [0.3, 1.65, HOME + 1.7], [0.2, 0.9, HOME - 0.4]],
    [18.3, [0.45, 1.5, HOME + 1.2], [0.45, 0.77, HOME + 0.25]], [21, [0.3, 1.55, HOME + 1.2], [0.4, 0.77, HOME + 0.25]],
    [22.3, [0, 1.95, HOME + 1.05], [0, 0.75, HOME + 0.2]], [28.6, [0, 1.8, HOME + 1.4], [0, 0.95, HOME]],
    [29.6, [1.75, 1.85, HOME - 1.55], [1.4, 1.05, HOME - 3.6]], [35.4, [1.7, 1.8, HOME - 1.65], [1.4, 1.0, HOME - 3.6]], // looking down into the case, calendar above
    [36.6, [0, 1.6, HOME + 2.2], [0, 1.6, HOME + 10]], [38, [0, 2.3, HOME + 5], [0, 1.2, HOME + 14]],
  ]
  // the last shot: from beside her, the camera turns to the window and the airliner's name
  // square on to the name, far enough back that all of it fits: further on a portrait phone (the camera always stays outside the glass)
  const endKeys = () => { const x = camera.aspect < 1 ? -7.45 : -18.5; return [[88, [0.55, 1.8, arr + 6], [0, 1.35, arr + 13]], [91.5, [x + 2, 3.5, arr + 4.6], [-34, 4, arr + 5.4]], [97, [x, 3.9, arr + 5.4], [-34, 4.05, arr + 5.4]]] }
  const gateKeys = [[63.5, [0.55, 1.8, gate - 3.2], [0, 1.3, gate + 4]], [66, [-2.5, 2.6, gate - 1], [-12, 3, gate + 2]], [69.5, [-6.5, 7, gate - 4], [-14, 3.5, gate + 1]], [71, [-9, 14, gate - 6], [-14, 6, gate + 1]]]
  const desired = (t) => {
    if (t < 38) return camAt(camKeys, t)
    if (t < 44.4) { const c = along(carKeys, t); return { pos: [c.x - 2.6, 2.4, c.z - 5.6], look: [c.x, 0.9, c.z + 6] } }
    if (t < 63.5) { const p = along(walkKeys, t); return { pos: [p.x + 0.55, 1.8, p.z - 3.2], look: [p.x, 1.3, p.z + 4] } }
    if (t < 75) return camAt(gateKeys, t)
    if (t >= 88) return camAt(endKeys(), t)
    const p = along(arrivalKeys, t); return { pos: [p.x + 0.55, 1.8, p.z - 3.2], look: [p.x, 1.35, p.z + 4] }
  }

  // ---------- run ----------
  let T = 0, raf = 0, last = performance.now(), gone = false, chapter = -1, phaseL = 0, phaseR = 0
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), v = new THREE.Vector3()
  let first = true
  const pose = (t, dt, now) => {
    // home
    fan.rotation.y += dt * 4
    // draw only the part of the world the camera is in
    HG.visible = t < 38.5; SG.visible = t > 35.5 && t < 47; airport.world.visible = t > 40
    const r0 = along([[15, -3.9, HOME - 1.6], [17.4, 0.45, HOME - 1.6], [17.8, 0.45, HOME - 1.4]], t)
    R0walk.root.visible = t >= 15 && t < 17.8; R0sit.root.visible = t >= 17.8 && t < 38.5; L0.root.visible = t < 38.5
    if (R0walk.root.visible) { R0walk.root.position.set(r0.x, 0, r0.z); R0walk.root.rotation.y = Math.PI / 2; phaseR += dt * 5.2; R0walk.update(phaseR, 1, now) }
    hisDocs.forEach((d, i) => { const k = span(t, 17.9 + i * 0.2, 18.5 + i * 0.2); d.o.visible = k > 0; d.o.position.y = 0.772 + (1 - k) * 0.35 })
    // phone: on the line from your eye to the paper it is framing, screen turned to you, rising in and dropping away
    const p = along(aimKeys, t), up = phoneUp(t)
    phone.visible = up > 0.01 && t < 22
    if (phone.visible) {
      v.set(p.x, 0.78, HOME + 0.25); phone.position.copy(camPos).lerp(v, 0.42); phone.position.y -= (1 - up) * 0.5
      phone.lookAt(camPos)
    }
    let flash = 0
    shots.forEach(([ts, d], i) => { const k = t - ts; if (k > -0.6 && k < 0.15) shot = d; if (k >= 0 && k < 0.18) flash = 1 - k / 0.18; ticks[i].scale.setScalar(0.07 * ease((t - ts - 0.2) / 0.3)) })
    if (phone.visible) paintScreen(shot, flash > 0.3)
    flashLight.intensity = flash * 4; flashLight.position.set(p.x, 0.92, HOME + 0.27) // lights the paper being photographed
    scan.visible = t > 22.3 && t < 24.9; scan.position.set(0, 0.79, HOME + 0.25 + Math.sin((t - 22.3) * 2.4) * 0.25)
    const vk = span(t, 25, 26) - span(t, 28.3, 28.9); verdict.scale.set(0.62 * vk, 0.155 * vk, 1); verdict.position.y = 1.0 + vk * 0.12
    calPage(t < 30.8 ? '3' : t < 32.4 ? '2' : t < 34 ? '1' : '✈')
    // each piece of clothing drops into the case in turn, then the lid closes
    clothes.forEach((o, i) => { const k = span(t, 29.6 + i * 0.9, 30.3 + i * 0.9); o.visible = k > 0; o.position.y = o.userData.y + (1 - k) * 0.7; o.rotation.z = (1 - k) * 0.6 })
    lidHinge.rotation.x = -1.75 * (1 - span(t, 33.6, 35.2)) // open lid leans back on the wall, then closes
    // road
    const c = along(carKeys, t); car.position.set(c.x, 0, c.z)
    // airport walk, then arrivals
    const away = t >= 75
    const w = away ? along(arrivalKeys, t) : along(walkKeys, t)
    L.root.visible = R.root.visible = t >= 44.6 && !(t >= 70 && t < 75)
    L.root.position.set(w.x, 0, w.z); R.root.position.set(w.x + 0.8, 0, w.z - 0.75)
    if (w.moving) { phaseL += dt * 5.6 } L.update(phaseL, w.moving ? 1 : 0, now); R.update(phaseL + 1.3, w.moving ? 1 : 0, now)
    son.arms[1].rotation.x = t > 82 ? -2.4 + Math.sin(now / 180) * 0.25 : 0 // waving when he sees her
    son.update(0, 0, now)
    if (!still) airport.update(dt, now)
  }
  const draw = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    const next = CHAPTERS.find((c) => c > T)
    if (!still) { const nt = T + dt; T = next !== undefined && nt >= next && HOLDS.has(next) && shouldHold() ? next - 0.0001 : nt }
    const ch = CHAPTERS.filter((c) => c <= T).length - 1
    if (ch !== chapter) { chapter = ch; onChapter?.(ch) }
    onTime?.(T)
    const d = desired(T)
    // the camera eases towards where it should be: never a jump, except the cuts hidden by the flight
    const k = first || still || (T >= 75 && T < 75.2) ? 1 : 1 - Math.exp(-dt * 2.4); first = false
    camPos.lerp(v.set(...d.pos), k); camLook.lerp(v.set(...d.look), k)
    camera.position.copy(camPos); camera.lookAt(camLook)
    pose(T, still ? 0 : dt, now)
    sun.position.set(camLook.x - 8, camLook.y + 14, camLook.z - 6); sun.target.position.copy(camLook)
    if (!(T > GLOBE_FROM + 1 && T < GLOBE_TO - 1)) renderer.render(scene, camera) // while the globe covers the screen, don't draw underneath
    if (T >= CHAPTERS[CHAPTERS.length - 1]) { onEnd?.(); return }
    if (!gone) raf = requestAnimationFrame(draw)
  }
  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
    camera.aspect = w / h; camera.fov = w / h < 1 ? 66 : 48; camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize); ro.observe(host)
  resize()
  renderer.compile(scene, camera) // prepare every material and texture now, so the street and airport don't stutter when they first appear
  scene.traverse((o) => [].concat(o.material || []).forEach((mm) => mm.map && renderer.initTexture(mm.map)))
  raf = requestAnimationFrame(draw)

  return {
    // reduced motion: the player moves chapter by chapter; each shows its settled moment
    goTo(t) { T = t; first = true; if (still) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) } },
    dispose() {
      gone = true; cancelAnimationFrame(raf); ro.disconnect()
      scene.traverse((o) => o.geometry?.dispose())
      own.forEach((x) => x.dispose()); textures.forEach((x) => x.dispose()); homePlane.userData.dispose?.(); airport.dispose(); renderer.dispose(); renderer.domElement.remove()
    },
  }
}
