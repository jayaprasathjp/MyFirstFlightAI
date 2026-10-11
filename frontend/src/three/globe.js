// 3D globe for a trip: the route rises off the Earth between the two airports and a plane flies it.
// mode 'route': camera starts over the origin, eases out to frame the whole route, plane keeps flying it.
// mode 'flight': chase camera follows the plane once, origin to destination (the window view of the flight).
import * as THREE from 'three'
import { W as MW, H as MH, TY as MTY, LAND } from '../assets/worldmap'

const SEA = '#16405A', SAND = '#BDB79A', ICE = '#DCDDD6', GOLD = 0xffc83d

// The app's own world map (Mercator) re-projected to the equirectangular texture a sphere needs.
let earthTex = null
function earthTexture() {
  if (earthTex) return earthTex
  const m = document.createElement('canvas'); m.width = MW; m.height = MH
  const g = m.getContext('2d'); g.fillStyle = SEA; g.fillRect(0, 0, MW, MH); g.fillStyle = SAND; g.fill(new Path2D(LAND))
  const E = document.createElement('canvas'); E.width = 2048; E.height = 1024
  const e = E.getContext('2d'); e.fillStyle = SEA; e.fillRect(0, 0, 2048, 1024)
  const R = MW / (2 * Math.PI)
  for (let j = 0; j < 1024; j++) {
    const lat = 90 - ((j + 0.5) * 180) / 1024
    if (lat < -80) { e.fillStyle = ICE; e.fillRect(0, j, 2048, 1); continue } // the map stops at 80°S: Antarctica
    if (lat > 84) continue
    const y = MTY - R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    e.drawImage(m, 0, y, MW, 1, 0, j, 2048, 1)
  }
  earthTex = new THREE.CanvasTexture(E)
  earthTex.colorSpace = THREE.SRGBColorSpace
  earthTex.anisotropy = 4
  return earthTex
}

// lat/lon (degrees) → point on the unit sphere, matching SphereGeometry's texture layout
const toVec = ([lat, lon]) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180
  return new THREE.Vector3(Math.cos(lo) * Math.cos(la), Math.sin(la), -Math.sin(lo) * Math.cos(la))
}
const AIRLINER = [[30, 0], [10, -4], [4, -24], [-3, -24], [0, -4], [-18, -3], [-23, -10], [-27, -10], [-25, 0], [-27, 10], [-23, 10], [-18, 3], [0, 4], [-3, 24], [4, 24], [10, 4]]
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

export function createGlobe(host, { from, to, fromName, toName, km, mode = 'route', duration = 8, still = false }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(mode === 'flight' ? 50 : 32, 2, 0.01, 50)

  // Earth, lit like daylight from the upper left, with a thin atmosphere at the rim
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 1, metalness: 0 }))
  scene.add(earth)
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.055, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 n; void main(){ float i = pow(0.72 - dot(n, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.45,0.7,1.0,1.0) * i; }',
  }))
  scene.add(atmo)
  scene.add(new THREE.AmbientLight(0xffffff, 0.75))
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.9)
  scene.add(sun)

  // great-circle route lifted off the surface: longer trips arc higher
  const a = toVec(from), b = toVec(to)
  const ang = a.angleTo(b)
  const lift = 0.03 + (0.22 * ang) / Math.PI
  const pts = []
  for (let i = 0; i <= 64; i++) {
    const t = i / 64
    const p = new THREE.Vector3().copy(a).lerp(b, t).normalize() // slerp-equivalent after normalising for ang < π
    if (ang > 3) p.copy(a).applyAxisAngle(new THREE.Vector3().crossVectors(a, b).normalize(), ang * t)
    pts.push(p.multiplyScalar(1 + lift * Math.sin(Math.PI * t)))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const SEG = 160, RAD = 8
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, mode === 'flight' ? 0.0035 : 0.006, RAD), new THREE.MeshBasicMaterial({ color: GOLD }))
  scene.add(tube)
  const fullIdx = tube.geometry.index.count
  const pinGeo = new THREE.SphereGeometry(mode === 'flight' ? 0.008 : 0.016, 16, 12)
  const pinMat = new THREE.MeshBasicMaterial({ color: GOLD })
  const pins = [a, b].map((v) => { const p = new THREE.Mesh(pinGeo, pinMat); p.position.copy(v).multiplyScalar(1.004); scene.add(p); return p })

  // plane: the same top-down airliner as the 2D scenes, extruded thin, white with a navy edge
  const shape = new THREE.Shape(AIRLINER.map(([x, y]) => new THREE.Vector2(x, y)))
  const pg = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false }); pg.translate(0, 0, -1)
  const plane = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }))
  plane.scale.setScalar(mode === 'flight' ? 0.0016 : 0.0016)
  scene.add(plane)
  const placePlane = (u) => {
    const p = curve.getPointAt(u), f = curve.getTangentAt(u), up = p.clone().normalize()
    const side = new THREE.Vector3().crossVectors(up, f).normalize()
    plane.position.copy(p)
    plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f, side, new THREE.Vector3().crossVectors(f, side)))
    return { p, f, up }
  }

  // city names as HTML so they stay crisp and use the app's font
  const labels = [fromName, toName].map((txt) => {
    const el = document.createElement('div'); el.className = 'g-label'; el.textContent = txt || ''; host.appendChild(el); return el
  })

  // framing for 'route': look down on the middle of the route from a height that fits both ends
  const north = (v) => new THREE.Vector3(0, 1, 0).addScaledVector(v, -v.y).normalize()
  const mid = a.clone().add(b).normalize()
  const altEnd = clamp(ang * 2.3, 0.5, 3.4), altStart = Math.min(0.75, altEnd)
  const frame = (dir, alt) => {
    const n = north(dir)
    camera.position.copy(dir).multiplyScalar(1 + alt).addScaledVector(n, -alt * 0.55 * Math.max(0, 1 - ang / 1.8)) // a little south, tilted like a map on a table; long routes look straight down so both ends stay in view
    camera.up.copy(n)
    camera.lookAt(dir.clone().multiplyScalar(1 + lift * 0.4))
  }

  const flyFor = clamp(4 + km / 900, 4, 14) // seconds per lap on the route view; longer trips are slower
  const t0 = performance.now()
  let raf = 0, visible = true, gone = false
  const v3 = new THREE.Vector3()
  const draw = (now) => {
    const t = still ? 99 : (now - t0) / 1000
    if (mode === 'route') {
      const k = ease(clamp((t - 0.2) / 1.8, 0, 1))
      const dir = a.clone().lerp(mid, k).normalize()
      frame(dir, altStart + (altEnd - altStart) * k)
      tube.geometry.setDrawRange(0, Math.floor((fullIdx * clamp((t - 0.2) / 1.4, 0, 1)) / (RAD * 6)) * RAD * 6)
      plane.visible = t > 1.6
      if (plane.visible) placePlane(still ? 0.5 : ((t - 1.6) / flyFor) % 1)
    } else {
      const u = clamp(t / duration, 0, 1)
      const { p, f, up } = placePlane(0.02 + 0.96 * ease(u))
      camera.position.copy(p).addScaledVector(up, 0.34).addScaledVector(f, -0.22) // above and just behind: looking down at the land below, as from a window seat
      camera.up.copy(f)
      camera.lookAt(v3.copy(p).addScaledVector(f, 0.12))
    }
    sun.position.copy(camera.position).add(camera.up.clone().multiplyScalar(2)).applyAxisAngle(camera.up, 0.6)
    labels.forEach((el, i) => {
      const p = pins[i].position, s = v3.copy(p).project(camera)
      const facing = p.clone().normalize().dot(camera.position.clone().sub(p)) > 0
      el.style.opacity = facing && s.z < 1 ? 1 : 0
      el.style.transform = `translate(${((s.x + 1) / 2) * host.clientWidth}px, ${((1 - s.y) / 2) * host.clientHeight}px) translate(-50%, ${i === 0 ? '-150%' : '50%'})`
    })
    renderer.render(scene, camera)
    if (!still && visible && !gone) raf = requestAnimationFrame(draw)
  }

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1
    renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'
    camera.aspect = w / h; camera.updateProjectionMatrix()
    if (still || !visible) draw(performance.now())
  }
  const ro = new ResizeObserver(resize); ro.observe(host)
  // pause while scrolled away or the tab is hidden: saves battery on older phones
  const io = new IntersectionObserver(([e]) => { const was = visible; visible = e.isIntersecting && !document.hidden; if (visible && !was && !still) raf = requestAnimationFrame(draw) })
  io.observe(host)
  resize(); if (!still) raf = requestAnimationFrame(draw)

  return {
    // a language change only renames the cities; the globe keeps flying
    setNames(a, b) { if (a) labels[0].textContent = a; if (b) labels[1].textContent = b },
    dispose() {
      gone = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material && o.material.map !== earthTex) o.material.dispose?.() })
      renderer.dispose(); renderer.domElement.remove(); labels.forEach((el) => el.remove())
    },
  }
}
