// Two short 3D moments in the airport steps, in the same architect's-model style as the terminal walk:
//  'board'  — at the gate: she walks down the jet bridge to the aircraft door; the plane carries HER airline's name.
//  'arrive' — after bags and customs: she walks out through the arrivals doors to the family member waiting for her.
// Everything written in the scene comes from the trip (gate, flight, airline, destination, her name).
import * as THREE from 'three'
import { M, mat, box, cyl, person, lakshmi, suitcase, textTex, FONT, fit, board, airliner } from './terminal'

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const lerp = (a, b, k) => a + (b - a) * k
const DUR = { board: 9, arrive: 8.5 }

export function createMoment(host, { kind, airline, flight, gate, dest, placard, still = false, onDone }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe3ebf2); scene.fog = new THREE.Fog(0xe3ebf2, 24, 70)
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 150)
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfbf, 1.45))
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.8); sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 })
  sun.position.set(-8, 16, -4); sun.target.position.set(0, 0, 6); scene.add(sun, sun.target)
  const fontReady = document.fonts?.load(FONT(48)).catch(() => {}) || Promise.resolve()
  const textures = [], own = []
  const tex = (w, h, paint) => { const t = textTex(w, h, paint, fontReady); textures.push(t); return t }
  const mk = (c, o) => { const x = mat(c, o); own.push(x); return x }
  const sign = (text, w, h, x, y, z, bg = '#0A1F3C', fg = '#FFC83D') => board(w, h, tex(1024, Math.round((1024 * h) / w), (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, c.canvas.width, c.canvas.height); fit(c, text, Math.round(c.canvas.height * 0.55), 960); c.fillStyle = fg; c.textBaseline = 'middle'; c.fillText(text, 32, c.canvas.height / 2 + 4)
  }), x, y, z, scene)

  const L = lakshmi(); scene.add(L.root)
  let path, cams, extras = () => {}

  if (kind === 'board') {
    // the gate, at the upper level of the terminal
    const carpet = mk(0x5b6b7d, { roughness: 0.95 })
    box(10, 0.05, 7, carpet, 0, -0.05, -3.5, scene)
    box(1.6, 1.05, 0.7, M.desk, 2.4, 0, -2.2, scene)
    const staff = person({ top: 0x1b2f4a, bottom: 0x1b2f4a }); staff.root.position.set(2.4, 0, -1.6); staff.root.rotation.y = Math.PI; scene.add(staff.root)
    sign([gate ? `Gate ${gate}` : 'Gate', flight, 'BOARDING'].filter(Boolean).join('  ·  '), 4.2, 0.6, 0, 3.0, 0.4) // what the real gate screen shows
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { box(0.5, 0.45, 0.5, M.seat, -3.6 + i * 0.6, 0, -4.6 + r * 1.4, scene); box(0.5, 0.5, 0.08, M.seat, -3.6 + i * 0.6, 0.45, -4.82 + r * 1.4, scene) }
    // the jet bridge: carpeted, glass along the left, lights overhead
    box(2.6, 0.08, 13, carpet, 0, -0.08, 7, scene)
    box(0.1, 2.6, 13, M.wall, 1.3, 0, 7, scene); box(2.6, 0.1, 13, M.wall, 0, 2.6, 7, scene, false)
    for (let z = 1; z < 13.5; z += 2) { if (z < 7) box(0.08, 2.6, 0.08, M.metal, -1.3, 0, z, scene); box(1.4, 0.03, 0.3, M.light, 0, 2.54, z, scene, false) } // frameless glass near the plane: nothing crosses its name
    box(0.04, 1.6, 13, M.glass, -1.3, 0.7, 7, scene, false)
    // the aircraft at the end, with her airline's name beside the open door
    const plane = airliner(airline || flight || '', fontReady, 3.6); plane.rotation.y = Math.PI / 2; plane.position.set(-8, -2.2, 15.3); scene.add(plane)
    box(0.95, 1.95, 0.12, mk(0xfaf7f0), 0, 0, 13.62, scene, false) // the open door, cabin light inside
    const crew = person({ top: 0x1b4f9c, bottom: 0x1b2f4a, bun: true }); crew.root.position.set(0.55, 0, 13.1); crew.root.rotation.y = Math.PI; scene.add(crew.root)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), M.tarmac); ground.rotation.x = -Math.PI / 2; ground.position.y = -3.4; scene.add(ground)
    path = [[0.4, -3.6], [7.4, 12.7]] // [time, z]
    cams = [[0, [0.5, 1.75, -6.8], [0, 1.3, 0]], [0.6, [0.5, 1.75, -6.6], [0, 1.3, 0.4]], [7.2, [0.45, 1.75, 9.5], [0, 1.3, 16]], [9, [0.3, 1.9, 7.2], [-3.4, 1.7, 13.6]]] // last: step back to see the airline's name beside the door
  } else {
    // arrivals: through the open doors, waiting crowd behind the rails, her family member holding her name
    const floor = mk(0xe9e4da, { roughness: 0.3 })
    box(16, 0.05, 30, floor, 0, -0.05, 6, scene)
    box(16, 0.1, 30, M.wall, 0, 4.4, 6, scene, false)
    for (let z = -6; z < 20; z += 3) for (const x of [-3.5, 0, 3.5]) box(2.2, 0.04, 0.4, M.light, x, 4.32, z, scene, false)
    box(0.3, 4.4, 30, M.wall, 7.6, 0, 6, scene); box(0.05, 4.4, 30, M.glass, -7.4, 0, 6, scene, false)
    for (const x of [-4.6, 4.6]) box(5.4, 3, 0.15, M.wall, x, 0, 4, scene)
    box(1.6, 2.6, 0.04, M.glass, -2.6, 0, 4, scene); box(1.6, 2.6, 0.04, M.glass, 2.6, 0, 4, scene) // the doors, slid open
    box(15, 1.4, 0.15, M.wall, 0, 3, 4, scene)
    sign(`Welcome to ${dest || ''}`.trim(), 4.2, 0.6, 0, 3.6, 3.85, '#0A1F3C', '#ffffff')
    for (const x of [-1.2, 1.2]) for (let z = 6; z < 12; z += 1.2) cyl(0.03, 1, M.metal, x, 0, z, scene, 8)
    ;[-1.2, 1.2].forEach((x) => box(0.03, 0.05, 6, M.dark, x, 0.95, 9, scene))
    const crowd = [[-2.2, 7.2], [-2.6, 8.6], [2.3, 7.6], [2.7, 9.2], [-2.4, 10.4], [2.2, 10.8]]
    crowd.forEach(([x, z]) => { const p = person({}); p.root.position.set(x, 0, z); p.root.rotation.y = Math.PI + (x < 0 ? 0.5 : -0.5); scene.add(p.root) })
    const family = person({ top: 0x2f4f6f, bottom: 0x3f3f46, skin: 0x8d5b3e, hair: 0x1e1a17, h: 1.06 }); family.root.position.set(0.2, 0, 12.4); family.root.rotation.y = Math.PI; scene.add(family.root)
    const card = board(0.8, 0.45, tex(400, 220, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 400, 220); c.fillStyle = '#0A1F3C'; fit(c, placard || 'WELCOME', 90, 360); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(placard || 'WELCOME', 200, 115) }), 0, 0, 0, family.root)
    card.position.set(0, 1.35, 0.32); card.rotation.y = Math.PI
    for (let i = 0; i < 2; i++) suitcase(-5 + i * 0.6, -2 + i, scene, {})
    path = [[0.3, -4], [6.6, 11.2]]
    cams = [[0, [0.6, 1.8, -7.4], [0, 1.3, 0]], [6.6, [0.55, 1.8, 8], [0, 1.35, 15]], [8.5, [2.4, 1.75, 9.6], [0.1, 1.4, 12]]]
    extras = (t, now) => { family.arms[1].rotation.x = t > 4 ? -2.4 + Math.sin(now / 170) * 0.25 : 0; family.update(0, 0, now) }
  }

  const camAt = (t) => {
    let i = cams.findIndex((k) => k[0] > t); if (i === -1) i = cams.length; if (i === 0) i = 1
    const a = cams[Math.min(i - 1, cams.length - 1)], b = cams[Math.min(i, cams.length - 1)], k = ease((t - a[0]) / ((b[0] - a[0]) || 1))
    return [a[1].map((v, j) => lerp(v, b[1][j], k)), a[2].map((v, j) => lerp(v, b[2][j], k))]
  }
  const total = DUR[kind]
  let raf = 0, gone = false, phase = 0, last = performance.now(), ended = false
  const t0 = performance.now()
  const draw = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    const t = still ? total : (now - t0) / 1000
    const [[ta, za], [tb, zb]] = path, k = Math.max(0, Math.min(1, (t - ta) / (tb - ta)))
    const moving = k > 0 && k < 1 && !still
    L.root.position.set(0, 0, lerp(za, zb, k)); if (moving) phase += dt * 5.4
    L.update(phase, moving ? 1 : 0, now); extras(t, now)
    const [p, l] = camAt(t); camera.position.set(...p); camera.lookAt(...l)
    renderer.render(scene, camera)
    if (!ended && t >= total) { ended = true; setTimeout(() => onDone?.(), still ? 2500 : 0) }
    if (!gone && !ended) raf = requestAnimationFrame(draw)
  }
  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
    camera.aspect = w / h; camera.fov = w / h < 1 ? 64 : 50; camera.updateProjectionMatrix()
    if (ended) renderer.render(scene, camera)
  }
  const ro = new ResizeObserver(resize); ro.observe(host)
  resize(); renderer.compile(scene, camera); raf = requestAnimationFrame(draw)
  return {
    dispose() {
      gone = true; cancelAnimationFrame(raf); ro.disconnect()
      scene.traverse((o) => { o.geometry?.dispose(); if (o.userData?.dispose) o.userData.dispose() })
      own.forEach((x) => x.dispose()); textures.forEach((x) => x.dispose()); renderer.dispose(); renderer.domElement.remove()
    },
  }
}
