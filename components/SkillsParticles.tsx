'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Neural Network — Hero-aligned aesthetic:
//  - ~400 nodes floating in 3D, slow drift + Hero-style (aShift) wobble in vertex shader
//  - dynamic links rebuilt each frame via uniform spatial grid (distance threshold)
//  - hybrid activation: spontaneous random pulses + mouse proximity propagation along links
//  - amber↔purple vertical gradient, AdditiveBlending, depthWrite:false (matches Hero)
//  - skill-bar hover burst via skillsMouseState.burstRequest

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
const NODE_COUNT = isMobile ? 200 : 400
const MAX_LINKS = isMobile ? 900 : 2200
const LINK_DIST = isMobile ? 80 : 115
const LINK_DIST_SQ = LINK_DIST * LINK_DIST

// Backdrop dust layer — Hero-style ambient stars, sits behind neural network.
const DUST_COUNT = isMobile ? 1500 : 4000
const DUST_SPREAD_X = 3600
const DUST_SPREAD_Y = 2400
// Place dust IN FRONT of camera (camera at z=400), spread across whole field
// but deeper than nodes (nodes at z=±100). Z range below puts dust at distance
// 200-700 from camera — visible at proper size.
const DUST_Z_MIN = -300
const DUST_Z_MAX = 200

const SPREAD_X = 2400
const SPREAD_Y = 1400
const SPREAD_Z = 200

const GRID_COLS = 16
const GRID_ROWS = 12
const CELL_W = SPREAD_X / GRID_COLS
const CELL_H = SPREAD_Y / GRID_ROWS

const MOUSE_HIT = 40        // closest N nodes fully lit by mouse
const MOUSE_INFLUENCE_R = 900 // soft halo radius (world units; SPREAD_X=2400)
const MOUSE_SHOCK_R = 450   // inner shock ring — full-power boost
const MOUSE_CORE_R = 180    // inner core — extreme glow + size bonus
const BURST_HIT = 8         // closest N nodes activated by skill-bar burst
const SPONT_PER_FRAME = 6   // spontaneous activations per frame — keeps field lively
const SPONT_LEVEL = 0.7
const BASE_GLOW = 0.5       // baseline activation everywhere (always-on look)
const DECAY = 0.97          // slower decay → trails linger
const PROPAGATE = 0.88      // strong neighbor propagation for shockwave

export const skillsMouseState = {
  x: 0,
  y: 0,
  active: false,
  hoverBarY: 0,
  burstRequest: 0,
}

const NODE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uSpreadY;
  uniform vec2  uMouse;
  uniform float uMouseActive;
  uniform float uMouseR;

  attribute float aSize;
  attribute vec4  aShift;        // (phaseA, phaseB, frequency, amplitude) — Hero-style
  attribute float aActivation;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vMouseProx;

  const float PI2 = 6.2831853;

  void main() {
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.w * 6.0;

    vec3 transformed = position + wobble;

    // Mouse proximity (smooth 0→1 from edge of radius to center)
    float dM = length(transformed.xy - uMouse);
    float prox = (1.0 - smoothstep(0.0, uMouseR, dM)) * uMouseActive;
    vMouseProx = prox;

    // Push nodes slightly AWAY from mouse for a subtle parallax effect.
    vec2 push = normalize(transformed.xy - uMouse + vec2(0.0001)) * prox * 18.0;
    transformed.xy += push;

    float glow = 0.65 + aActivation * 1.1 + prox * 0.8;

    float t = clamp((transformed.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.72, 0.30);
    vec3 purple = vec3(0.56, 0.36, 1.0);
    vec3 base = mix(purple, amber, t);
    // Cyan/white tint near the mouse for a "scanning" feel.
    vec3 cursor = vec3(0.6, 0.95, 1.0);
    vColor = mix(base, cursor, prox * 0.7) * glow;
    vAlpha = 0.85 + aActivation * 0.15 + prox * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (600.0 / -mvPosition.z) * (1.0 + aActivation * 1.2 + prox * 2.5);
  }
`

const NODE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vMouseProx;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    // Hot core + soft halo for a glowing star look.
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.1, d);
    float a = (halo * 0.55 + core * 0.9) * vAlpha;
    // Mouse-near nodes get an extra outer glow ring.
    float ring = smoothstep(0.5, 0.25, d) * vMouseProx * 0.6;
    gl_FragColor = vec4(vColor * (1.0 + core * 0.6 + vMouseProx * 0.5), a + ring);
  }
`

const LINE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSpreadY;
  uniform vec2  uMouse;
  uniform float uMouseActive;
  uniform float uMouseR;

  attribute float aLineActivation;
  attribute float aLinePhase;
  attribute float aLineEnd;       // 0 = start vertex, 1 = end vertex (for pulse direction)

  varying vec3  vColor;
  varying float vAlpha;
  varying float vPulseT;
  varying float vMouseProx;

  void main() {
    float t = clamp((position.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.72, 0.30);
    vec3 purple = vec3(0.56, 0.36, 1.0);
    vec3 cursor = vec3(0.6, 0.95, 1.0);

    float dM = length(position.xy - uMouse);
    float prox = (1.0 - smoothstep(0.0, uMouseR, dM)) * uMouseActive;
    vMouseProx = prox;

    vColor = mix(mix(purple, amber, t), cursor, prox * 0.7);
    vAlpha = 0.18 + aLineActivation * 0.7 + prox * 0.6;
    vPulseT = aLineEnd;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const LINE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vPulseT;
  varying float vMouseProx;

  void main() {
    // Two-band pulse: a fast one and a slow one — line never feels static.
    // Pulses near mouse run faster, like the network is reacting.
    float speedBoost = 1.0 + vMouseProx * 1.5;
    float p1 = fract(uTime * 1.1 * speedBoost + vPulseT);
    float p2 = fract(uTime * 0.45 * speedBoost + vPulseT * 0.5);
    float pulse1 = smoothstep(0.0, 0.22, p1) * smoothstep(1.0, 0.6, p1);
    float pulse2 = smoothstep(0.0, 0.28, p2) * smoothstep(1.0, 0.55, p2);
    float pulse = max(pulse1, pulse2 * 0.7);
    float a = vAlpha * (0.55 + pulse * 1.1);
    gl_FragColor = vec4(vColor * (1.0 + pulse * 0.7 + vMouseProx * 0.4), a);
  }
`

const DUST_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uSpreadY;

  attribute float aSize;
  attribute vec4  aShift;  // (phaseA, phaseB, frequency, amplitude) — Hero-style

  varying vec3  vColor;
  varying float vAlpha;

  const float PI2 = 6.2831853;

  void main() {
    // Hero-style per-particle wobble — independent tiny sphere walk.
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.w * 3.0;

    vec3 transformed = position + wobble;

    // Same amber↔purple Y-gradient as Hero.
    float t = clamp((transformed.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.72, 0.30);
    vec3 purple = vec3(0.56, 0.36, 1.0);
    vColor = mix(purple, amber, t);

    // Twinkle: slow alpha oscillation per-particle so the field shimmers.
    float twinkle = 0.7 + 0.3 * sin(uTime * 0.9 + aShift.y);
    vAlpha = twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Larger distance constant so dust reads at this scene scale.
    gl_PointSize = uSize * aSize * uPixelRatio * (450.0 / -mvPosition.z);
  }
`

const DUST_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    // Bright star with hot core + soft halo so dust reads clearly.
    float core = smoothstep(0.2, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d);
    float a = (halo * 0.55 + core * 0.45) * vAlpha;
    gl_FragColor = vec4(vColor * (1.0 + core * 0.5), a);
  }
`

function StarDust() {
  const { gl } = useThree()
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const groupRef = useRef<THREE.Group>(null)

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3)
    const sizes = new Float32Array(DUST_COUNT)
    const shift = new Float32Array(DUST_COUNT * 4)

    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * DUST_SPREAD_X
      positions[i * 3 + 1] = (Math.random() - 0.5) * DUST_SPREAD_Y
      positions[i * 3 + 2] = DUST_Z_MIN + Math.random() * (DUST_Z_MAX - DUST_Z_MIN)

      sizes[i] = Math.random() * 1.2 + 0.5
      shift[i * 4]     = Math.random() * Math.PI
      shift[i * 4 + 1] = Math.random() * Math.PI * 2
      shift[i * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      shift[i * 4 + 3] = Math.random() * 1.5 + 0.3
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.2 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uSpreadY: { value: DUST_SPREAD_Y },
      },
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  matRef.current = material as THREE.ShaderMaterial

  useFrame((_, delta) => {
    const mat = material as THREE.ShaderMaterial
    mat.uniforms.uTime.value += delta * Math.PI * 0.5
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    // Slow rotation — mirrors Hero galaxy's gentle drift.
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.01
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} />
    </group>
  )
}

function NeuralNetwork() {
  const { camera, size, gl } = useThree()
  const mouseWorld = useRef(new THREE.Vector3())
  const lastBurst = useRef(0)

  const ctx = useMemo(() => {
    const positions = new Float32Array(NODE_COUNT * 3)
    const sizes = new Float32Array(NODE_COUNT)
    const shift = new Float32Array(NODE_COUNT * 4)
    const activation = new Float32Array(NODE_COUNT)
    const nextAct = new Float32Array(NODE_COUNT)
    const drift = new Float32Array(NODE_COUNT * 3)

    for (let i = 0; i < NODE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * SPREAD_X
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z

      sizes[i] = Math.random() * 0.6 + 0.6

      shift[i * 4]     = Math.random() * Math.PI
      shift[i * 4 + 1] = Math.random() * Math.PI * 2
      shift[i * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      shift[i * 4 + 3] = Math.random() * 1.2 + 0.4

      const angle = Math.random() * Math.PI * 2
      const speed = 7 + Math.random() * 12
      drift[i * 3]     = Math.cos(angle) * speed
      drift[i * 3 + 1] = Math.sin(angle) * speed
      drift[i * 3 + 2] = (Math.random() - 0.5) * 3
    }

    const nodeGeo = new THREE.BufferGeometry()
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    nodeGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    nodeGeo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))
    nodeGeo.setAttribute('aActivation', new THREE.BufferAttribute(activation, 1).setUsage(THREE.DynamicDrawUsage))

    const nodeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 4.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uSpreadY: { value: SPREAD_Y },
        uMouse: { value: new THREE.Vector2(99999, 99999) },
        uMouseActive: { value: 0 },
        uMouseR: { value: MOUSE_INFLUENCE_R },
      },
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Lines geometry: each link = 2 vertices. Pre-allocate MAX_LINKS * 2 vertices.
    const linePositions = new Float32Array(MAX_LINKS * 2 * 3)
    const lineActivation = new Float32Array(MAX_LINKS * 2)
    const linePhase = new Float32Array(MAX_LINKS * 2)
    const lineEnd = new Float32Array(MAX_LINKS * 2)
    for (let i = 0; i < MAX_LINKS; i++) {
      const phase = Math.random()
      linePhase[i * 2]     = phase
      linePhase[i * 2 + 1] = phase
      lineEnd[i * 2]     = 0.0
      lineEnd[i * 2 + 1] = 1.0
    }

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage))
    lineGeo.setAttribute('aLineActivation', new THREE.BufferAttribute(lineActivation, 1).setUsage(THREE.DynamicDrawUsage))
    lineGeo.setAttribute('aLinePhase', new THREE.BufferAttribute(linePhase, 1))
    lineGeo.setAttribute('aLineEnd', new THREE.BufferAttribute(lineEnd, 1))
    lineGeo.setDrawRange(0, 0)

    const lineMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSpreadY: { value: SPREAD_Y },
        uMouse: { value: new THREE.Vector2(99999, 99999) },
        uMouseActive: { value: 0 },
        uMouseR: { value: MOUSE_INFLUENCE_R },
      },
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Spatial grid: cell -> node indices
    const grid: number[][] = new Array(GRID_COLS * GRID_ROWS)
    for (let i = 0; i < grid.length; i++) grid[i] = []

    // Adjacency: flat pairs for propagation (max MAX_LINKS pairs)
    const adjA = new Int32Array(MAX_LINKS)
    const adjB = new Int32Array(MAX_LINKS)

    return {
      positions, sizes, shift, activation, nextAct, drift,
      nodeGeo, nodeMat,
      linePositions, lineActivation, lineGeo, lineMat,
      grid, adjA, adjB,
    }
  }, [gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    ctx.nodeMat.uniforms.uTime.value += dt
    ctx.nodeMat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    ctx.lineMat.uniforms.uTime.value += dt

    const positions = ctx.positions
    const drift = ctx.drift
    const activation = ctx.activation
    const nextAct = ctx.nextAct
    const grid = ctx.grid

    // 1) drift + wrap
    const halfX = SPREAD_X * 0.5
    const halfY = SPREAD_Y * 0.5
    const halfZ = SPREAD_Z * 0.5
    for (let i = 0; i < NODE_COUNT; i++) {
      const ix = i * 3
      positions[ix]     += drift[ix]     * dt
      positions[ix + 1] += drift[ix + 1] * dt
      positions[ix + 2] += drift[ix + 2] * dt
      if (positions[ix] >  halfX) positions[ix] -= SPREAD_X
      if (positions[ix] < -halfX) positions[ix] += SPREAD_X
      if (positions[ix + 1] >  halfY) positions[ix + 1] -= SPREAD_Y
      if (positions[ix + 1] < -halfY) positions[ix + 1] += SPREAD_Y
      if (positions[ix + 2] >  halfZ) positions[ix + 2] -= SPREAD_Z
      if (positions[ix + 2] < -halfZ) positions[ix + 2] += SPREAD_Z
    }

    // 2) spatial grid rebuild
    for (let i = 0; i < grid.length; i++) grid[i].length = 0
    for (let i = 0; i < NODE_COUNT; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      let cx = ((x + halfX) / CELL_W) | 0
      let cy = ((y + halfY) / CELL_H) | 0
      if (cx < 0) cx = 0; else if (cx >= GRID_COLS) cx = GRID_COLS - 1
      if (cy < 0) cy = 0; else if (cy >= GRID_ROWS) cy = GRID_ROWS - 1
      grid[cy * GRID_COLS + cx].push(i)
    }

    // 3) adjacency rebuild + line positions write
    const linePositions = ctx.linePositions
    const lineAct = ctx.lineActivation
    const adjA = ctx.adjA
    const adjB = ctx.adjB
    let linkCount = 0

    for (let cy = 0; cy < GRID_ROWS && linkCount < MAX_LINKS; cy++) {
      for (let cx = 0; cx < GRID_COLS && linkCount < MAX_LINKS; cx++) {
        const cell = grid[cy * GRID_COLS + cx]
        if (cell.length === 0) continue
        // pair with self + right + down + down-right + down-left (avoid dup)
        for (let dy = 0; dy <= 1; dy++) {
          const ny = cy + dy
          if (ny >= GRID_ROWS) continue
          for (let dx = (dy === 0 ? 0 : -1); dx <= 1; dx++) {
            const nx = cx + dx
            if (nx < 0 || nx >= GRID_COLS) continue
            const other = grid[ny * GRID_COLS + nx]
            if (other.length === 0) continue
            for (let a = 0; a < cell.length; a++) {
              const i = cell[a]
              const startB = (cell === other) ? a + 1 : 0
              for (let b = startB; b < other.length; b++) {
                const j = other[b]
                const dxv = positions[i * 3]     - positions[j * 3]
                const dyv = positions[i * 3 + 1] - positions[j * 3 + 1]
                const dzv = positions[i * 3 + 2] - positions[j * 3 + 2]
                const dsq = dxv * dxv + dyv * dyv + dzv * dzv
                if (dsq < LINK_DIST_SQ) {
                  const k2 = linkCount * 2
                  linePositions[k2 * 3]     = positions[i * 3]
                  linePositions[k2 * 3 + 1] = positions[i * 3 + 1]
                  linePositions[k2 * 3 + 2] = positions[i * 3 + 2]
                  linePositions[k2 * 3 + 3] = positions[j * 3]
                  linePositions[k2 * 3 + 4] = positions[j * 3 + 1]
                  linePositions[k2 * 3 + 5] = positions[j * 3 + 2]
                  adjA[linkCount] = i
                  adjB[linkCount] = j
                  linkCount++
                  if (linkCount >= MAX_LINKS) break
                }
              }
              if (linkCount >= MAX_LINKS) break
            }
            if (linkCount >= MAX_LINKS) break
          }
        }
      }
    }

    // 4) Mouse position → world XY
    const ndcX = (skillsMouseState.x / size.width) * 2 - 1
    const ndcY = -(skillsMouseState.y / size.height) * 2 + 1
    const v = mouseWorld.current.set(ndcX, ndcY, 0.5)
    v.unproject(camera)
    const dir = v.sub(camera.position).normalize()
    const distZ = -camera.position.z / dir.z
    const mWorld = camera.position.clone().add(dir.multiplyScalar(distZ))
    const mx = mWorld.x
    const my = mWorld.y

    // Feed mouse + active to GPU shaders (with smoothed active for fade in/out)
    ctx.nodeMat.uniforms.uMouse.value.set(mx, my)
    ctx.lineMat.uniforms.uMouse.value.set(mx, my)
    const targetActive = skillsMouseState.active ? 1 : 0
    const curActive = ctx.nodeMat.uniforms.uMouseActive.value as number
    const smoothed = curActive + (targetActive - curActive) * 0.15
    ctx.nodeMat.uniforms.uMouseActive.value = smoothed
    ctx.lineMat.uniforms.uMouseActive.value = smoothed

    // 5) seed nextAct with decayed current + always-on baseline
    for (let i = 0; i < NODE_COUNT; i++) {
      const decayed = activation[i] * DECAY
      nextAct[i] = decayed > BASE_GLOW ? decayed : BASE_GLOW
    }

    // 6) Mouse: three-tier radial activation
    //    - outer halo: soft falloff
    //    - shock ring: strong boost
    //    - core: instant 1.0 + sets up propagation seed
    if (skillsMouseState.active) {
      const rSq = MOUSE_INFLUENCE_R * MOUSE_INFLUENCE_R
      const shockSq = MOUSE_SHOCK_R * MOUSE_SHOCK_R
      const coreSq = MOUSE_CORE_R * MOUSE_CORE_R
      const top: { i: number; d: number }[] = []
      for (let i = 0; i < NODE_COUNT; i++) {
        const dxv = positions[i * 3] - mx
        const dyv = positions[i * 3 + 1] - my
        const dsq = dxv * dxv + dyv * dyv
        if (dsq < rSq) {
          const f = 1.0 - dsq / rSq
          let halo = f * f * 0.85
          if (dsq < shockSq) {
            const sf = 1.0 - dsq / shockSq
            halo = Math.max(halo, 0.75 + sf * 0.2)
          }
          if (dsq < coreSq) {
            halo = 1.0
          }
          if (halo > nextAct[i]) nextAct[i] = halo
        }
        if (top.length < MOUSE_HIT) {
          top.push({ i, d: dsq })
          top.sort((a, b) => a.d - b.d)
        } else if (dsq < top[MOUSE_HIT - 1].d) {
          top[MOUSE_HIT - 1] = { i, d: dsq }
          top.sort((a, b) => a.d - b.d)
        }
      }
      for (const t of top) nextAct[t.i] = 1
    }

    // 7) Burst request: activate BURST_HIT nodes nearest to hoverBarY (world y)
    if (skillsMouseState.burstRequest !== lastBurst.current) {
      lastBurst.current = skillsMouseState.burstRequest
      // Convert hoverBarY (screen) to world y
      const bndcY = -(skillsMouseState.hoverBarY / size.height) * 2 + 1
      const bv = new THREE.Vector3(0, bndcY, 0.5).unproject(camera)
      const bdir = bv.sub(camera.position).normalize()
      const bdist = -camera.position.z / bdir.z
      const wy = camera.position.y + bdir.y * bdist
      const top: { i: number; d: number }[] = []
      for (let i = 0; i < NODE_COUNT; i++) {
        const d = Math.abs(positions[i * 3 + 1] - wy)
        if (top.length < BURST_HIT) {
          top.push({ i, d })
          top.sort((a, b) => a.d - b.d)
        } else if (d < top[BURST_HIT - 1].d) {
          top[BURST_HIT - 1] = { i, d }
          top.sort((a, b) => a.d - b.d)
        }
      }
      for (const t of top) nextAct[t.i] = 1
    }

    // 8) Spontaneous activation
    for (let s = 0; s < SPONT_PER_FRAME; s++) {
      const i = (Math.random() * NODE_COUNT) | 0
      if (nextAct[i] < SPONT_LEVEL) nextAct[i] = SPONT_LEVEL
    }

    // 9) Propagate along adjacency
    for (let k = 0; k < linkCount; k++) {
      const i = adjA[k]
      const j = adjB[k]
      const ai = activation[i] * PROPAGATE
      const aj = activation[j] * PROPAGATE
      if (ai > nextAct[j]) nextAct[j] = ai
      if (aj > nextAct[i]) nextAct[i] = aj
    }

    // 10) swap
    for (let i = 0; i < NODE_COUNT; i++) activation[i] = nextAct[i]

    // 11) Write line activations
    for (let k = 0; k < linkCount; k++) {
      const a = activation[adjA[k]]
      const b = activation[adjB[k]]
      const m = a > b ? a : b
      lineAct[k * 2]     = m
      lineAct[k * 2 + 1] = m
    }

    // 12) Upload to GPU
    const nodePosAttr = ctx.nodeGeo.getAttribute('position') as THREE.BufferAttribute
    const nodeActAttr = ctx.nodeGeo.getAttribute('aActivation') as THREE.BufferAttribute
    nodePosAttr.needsUpdate = true
    nodeActAttr.needsUpdate = true

    const linePosAttr = ctx.lineGeo.getAttribute('position') as THREE.BufferAttribute
    const lineActAttr = ctx.lineGeo.getAttribute('aLineActivation') as THREE.BufferAttribute
    linePosAttr.needsUpdate = true
    lineActAttr.needsUpdate = true
    ctx.lineGeo.setDrawRange(0, linkCount * 2)
  })

  return (
    <group>
      <points geometry={ctx.nodeGeo} material={ctx.nodeMat} />
      <lineSegments geometry={ctx.lineGeo} material={ctx.lineMat} />
    </group>
  )
}

export default function SkillsParticles({ className }: { className?: string }) {
  return (
    <div
      id="skills-canvas"
      className={className}
      style={{ width: '100%', height: '100%', pointerEvents: 'none', background: '#0a0010' }}
    >
      <Canvas
        camera={{ position: [0, 0, 400], fov: 75, near: 1, far: 2000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <StarDust />
        <NeuralNetwork />
      </Canvas>
    </div>
  )
}
