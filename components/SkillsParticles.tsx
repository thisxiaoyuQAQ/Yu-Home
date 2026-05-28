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
const MAX_LINKS = isMobile ? 500 : 1200
const LINK_DIST = isMobile ? 60 : 80
const LINK_DIST_SQ = LINK_DIST * LINK_DIST

const SPREAD_X = 2400
const SPREAD_Y = 1400
const SPREAD_Z = 200

const GRID_COLS = 16
const GRID_ROWS = 12
const CELL_W = SPREAD_X / GRID_COLS
const CELL_H = SPREAD_Y / GRID_ROWS

const MOUSE_HIT = 5         // closest N nodes activated by mouse
const BURST_HIT = 3         // closest N nodes activated by skill-bar burst
const SPONT_PER_FRAME = 2   // spontaneous activations per frame
const DECAY = 0.94
const PROPAGATE = 0.6

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

  attribute float aSize;
  attribute vec4  aShift;        // (phaseA, phaseB, frequency, amplitude) — Hero-style
  attribute float aActivation;

  varying vec3  vColor;
  varying float vAlpha;

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

    float glow = 0.3 + aActivation * 0.7;

    float t = clamp((transformed.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.667, 0.235);
    vec3 purple = vec3(0.431, 0.235, 0.902);
    vColor = mix(purple, amber, t) * glow;
    vAlpha = 0.5 + aActivation * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (600.0 / -mvPosition.z) * (1.0 + aActivation * 0.5);
  }
`

const NODE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`

const LINE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSpreadY;

  attribute float aLineActivation;
  attribute float aLinePhase;
  attribute float aLineEnd;       // 0 = start vertex, 1 = end vertex (for pulse direction)

  varying vec3  vColor;
  varying float vAlpha;
  varying float vPulseT;

  void main() {
    float t = clamp((position.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.667, 0.235);
    vec3 purple = vec3(0.431, 0.235, 0.902);
    vColor = mix(purple, amber, t);
    vAlpha = 0.03 + aLineActivation * 0.5;
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

  void main() {
    float phase = fract(uTime * 0.5 + vPulseT);
    float pulse = smoothstep(0.0, 0.3, phase) * smoothstep(1.0, 0.7, phase);
    float a = vAlpha * (0.3 + pulse * 0.7);
    gl_FragColor = vec4(vColor, a);
  }
`

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
      const speed = 4 + Math.random() * 8
      drift[i * 3]     = Math.cos(angle) * speed
      drift[i * 3 + 1] = Math.sin(angle) * speed
      drift[i * 3 + 2] = (Math.random() - 0.5) * 2
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

    // 5) seed nextAct with decayed current
    for (let i = 0; i < NODE_COUNT; i++) nextAct[i] = activation[i] * DECAY

    // 6) Mouse activates nearest MOUSE_HIT nodes (only if active)
    if (skillsMouseState.active) {
      const top: { i: number; d: number }[] = []
      for (let i = 0; i < NODE_COUNT; i++) {
        const dxv = positions[i * 3] - mx
        const dyv = positions[i * 3 + 1] - my
        const d = dxv * dxv + dyv * dyv
        if (top.length < MOUSE_HIT) {
          top.push({ i, d })
          top.sort((a, b) => a.d - b.d)
        } else if (d < top[MOUSE_HIT - 1].d) {
          top[MOUSE_HIT - 1] = { i, d }
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
      if (nextAct[i] < 0.5) nextAct[i] = 0.5
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
        <NeuralNetwork />
      </Canvas>
    </div>
  )
}
