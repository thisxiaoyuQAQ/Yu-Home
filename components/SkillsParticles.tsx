'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Neuron Field — dense cluster of "cell body + dendrite tendrils" neurons.
// No connecting lines. Each neuron is its own particle cluster:
//   - a dense glowing soma (cell body) of ~SOMA_PARTICLES points
//   - DENDRITES_PER_NEURON tendrils, each ~DENDRITE_PARTICLES points,
//     radiating outward from the soma with a curved walk
// Behaviors:
//   - whole field drifts + per-particle Hero-style wobble
//   - per-neuron breathing (dendrite reach pulses in/out)
//   - electric pulse travels along each dendrite from soma to tip
//   - mouse proximity ignites nearby neurons (soma burst + accelerated pulse)
//   - skill-bar hover burst still works via skillsMouseState.burstRequest

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

// Dense neural forest: 70 neurons desktop, 35 mobile
const NEURON_COUNT = isMobile ? 35 : 70
const DENDRITES_PER_NEURON = 6      // 6 tendrils per soma (range 5-8 in design)
const SOMA_PARTICLES = 22           // dense core particles per neuron
const DENDRITE_PARTICLES = 12       // particles per tendril
const PARTICLES_PER_NEURON = SOMA_PARTICLES + DENDRITES_PER_NEURON * DENDRITE_PARTICLES
const TOTAL_PARTICLES = NEURON_COUNT * PARTICLES_PER_NEURON

// Soma radius (random per neuron)
const SOMA_R_MIN = 8
const SOMA_R_MAX = 14
// Dendrite reach (tip distance from soma center)
const DENDRITE_LEN_MIN = 55
const DENDRITE_LEN_MAX = 110

// Backdrop dust layer — Hero-style ambient stars, sits behind neurons.
const DUST_COUNT = isMobile ? 1500 : 4000
const DUST_SPREAD_X = 3600
const DUST_SPREAD_Y = 2400
const DUST_Z_MIN = -300
const DUST_Z_MAX = 200

// Neuron field spread
const SPREAD_X = 2400
const SPREAD_Y = 1400
const SPREAD_Z = 200

// Mouse activation tiers
const MOUSE_INFLUENCE_R = 600
const MOUSE_SHOCK_R = 320
const MOUSE_CORE_R = 140

// Activation dynamics
const DECAY = 0.94
const BASE_GLOW = 0.35
const SPONT_PER_FRAME = 2    // random spontaneous activations per frame (neuron-level)
const SPONT_LEVEL = 0.85

export const skillsMouseState = {
  x: 0,
  y: 0,
  active: false,
  hoverBarY: 0,
  burstRequest: 0,
}

const NEURON_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uSpreadY;
  uniform vec2  uMouse;
  uniform float uMouseActive;
  uniform float uMouseR;

  // Per-particle attributes
  attribute float aSize;
  attribute vec4  aShift;          // (phaseA, phaseB, frequency, amplitude) — Hero-style wobble
  attribute vec3  aSomaCenter;     // world-space soma center for this particle's neuron
  attribute float aRole;           // 0 = soma, 1 = dendrite
  attribute float aDendriteT;      // for dendrites: 0 at soma end → 1 at tip
  attribute float aNeuronPhase;    // per-neuron 0..1 phase (breathing + pulse offset)
  attribute float aNeuronAct;      // per-neuron activation 0..1 (updated CPU-side via instanced-ish broadcast)

  varying vec3  vColor;
  varying float vAlpha;
  varying float vMouseProx;
  varying float vPulse;
  varying float vRole;

  const float PI2 = 6.2831853;

  void main() {
    // Per-particle Hero-style wobble (independent micro-walk)
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.w * (aRole > 0.5 ? 3.5 : 2.0);

    // Per-neuron breathing: dendrite reach in/out (only affects dendrite particles)
    float breath = 0.85 + 0.18 * sin(uTime * 0.7 + aNeuronPhase * PI2);
    vec3 fromSoma = position - aSomaCenter;
    vec3 transformed = aSomaCenter + fromSoma * (aRole > 0.5 ? breath : 1.0) + wobble;

    // Mouse proximity in XY (per-neuron position is a good proxy via aSomaCenter)
    float dM = length(aSomaCenter.xy - uMouse);
    float prox = (1.0 - smoothstep(0.0, uMouseR, dM)) * uMouseActive;
    vMouseProx = prox;

    // Electric pulse along dendrite (traveling wave from soma → tip)
    // Pulse only meaningful for dendrites (aRole == 1)
    float pulseSpeed = 0.55 + prox * 1.6 + aNeuronAct * 0.9;
    float wave = fract(uTime * pulseSpeed + aNeuronPhase * 2.0 - aDendriteT);
    // Sharp leading edge, gentle tail
    float pulse = smoothstep(0.0, 0.12, wave) * smoothstep(0.55, 0.0, wave);
    vPulse = aRole > 0.5 ? pulse : 0.0;

    // Activation-driven glow (soma gets the big boost; dendrites glow with pulse)
    float somaGlow = aRole < 0.5 ? (0.9 + aNeuronAct * 1.6) : 0.0;
    float dendriteGlow = aRole > 0.5 ? (0.45 + pulse * 1.2 + aNeuronAct * 0.6) : 0.0;
    float glow = 0.4 + somaGlow + dendriteGlow + prox * 0.7;

    // amber↔purple gradient by world Y
    float t = clamp((aSomaCenter.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.72, 0.30);
    vec3 purple = vec3(0.56, 0.36, 1.0);
    vec3 base = mix(purple, amber, t);
    vec3 cursor = vec3(0.6, 0.95, 1.0);
    // Pulse itself adds a hot cyan-white streak
    vec3 pulseTint = mix(base, vec3(1.0, 0.98, 0.9), pulse * 0.8);
    vec3 mixed = aRole > 0.5 ? pulseTint : base;
    vColor = mix(mixed, cursor, prox * 0.55) * glow;

    vAlpha = (aRole < 0.5 ? 0.95 : (0.55 + pulse * 0.45)) + prox * 0.2;
    vRole = aRole;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Soma particles bigger than dendrite particles; mouse + pulse + activation enlarge
    float baseScale = aRole < 0.5 ? 1.6 : 0.9;
    float sizeBoost = 1.0 + aNeuronAct * 0.9 + prox * 1.8 + pulse * 1.5;
    gl_PointSize = uSize * aSize * baseScale * uPixelRatio * (600.0 / -mvPosition.z) * sizeBoost;
  }
`

const NEURON_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vMouseProx;
  varying float vPulse;
  varying float vRole;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.1, d);
    // Soma reads as hot core + soft halo. Dendrite particles get extra ring on pulse.
    float baseA = halo * 0.55 + core * 0.9;
    float ring = smoothstep(0.5, 0.2, d) * (vMouseProx * 0.5 + vPulse * 0.7);
    float a = baseA * vAlpha + ring;
    vec3 col = vColor * (1.0 + core * 0.6 + vMouseProx * 0.4 + vPulse * 0.6);
    gl_FragColor = vec4(col, a);
  }
`

const DUST_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uSpreadY;

  attribute float aSize;
  attribute vec4  aShift;

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
    ) * aShift.w * 3.0;

    vec3 transformed = position + wobble;

    float t = clamp((transformed.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(1.0, 0.72, 0.30);
    vec3 purple = vec3(0.56, 0.36, 1.0);
    vColor = mix(purple, amber, t);

    float twinkle = 0.7 + 0.3 * sin(uTime * 0.9 + aShift.y);
    vAlpha = twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
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
    float core = smoothstep(0.2, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d);
    float a = (halo * 0.55 + core * 0.45) * vAlpha;
    gl_FragColor = vec4(vColor * (1.0 + core * 0.5), a);
  }
`

function StarDust() {
  const { gl } = useThree()
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

  useFrame((_, delta) => {
    const mat = material as THREE.ShaderMaterial
    mat.uniforms.uTime.value += delta * Math.PI * 0.5
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.01
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} />
    </group>
  )
}

function NeuronField() {
  const { camera, size, gl } = useThree()
  const mouseWorld = useRef(new THREE.Vector3())
  const lastBurst = useRef(0)

  const ctx = useMemo(() => {
    const positions = new Float32Array(TOTAL_PARTICLES * 3)
    const sizes = new Float32Array(TOTAL_PARTICLES)
    const shift = new Float32Array(TOTAL_PARTICLES * 4)
    const somaCenters = new Float32Array(TOTAL_PARTICLES * 3)
    const roles = new Float32Array(TOTAL_PARTICLES)
    const dendriteT = new Float32Array(TOTAL_PARTICLES)
    const neuronPhase = new Float32Array(TOTAL_PARTICLES)
    const neuronAct = new Float32Array(TOTAL_PARTICLES) // broadcast per-particle

    // Per-neuron state (CPU side)
    const neuronCenters = new Float32Array(NEURON_COUNT * 3)
    const neuronDrift = new Float32Array(NEURON_COUNT * 3)
    const neuronActLevel = new Float32Array(NEURON_COUNT)
    const neuronNextAct = new Float32Array(NEURON_COUNT)

    let p = 0 // running particle index

    for (let n = 0; n < NEURON_COUNT; n++) {
      // Neuron center
      const cx = (Math.random() - 0.5) * SPREAD_X
      const cy = (Math.random() - 0.5) * SPREAD_Y
      const cz = (Math.random() - 0.5) * SPREAD_Z
      neuronCenters[n * 3]     = cx
      neuronCenters[n * 3 + 1] = cy
      neuronCenters[n * 3 + 2] = cz

      // Slow drift
      const angle = Math.random() * Math.PI * 2
      const speed = 4 + Math.random() * 8
      neuronDrift[n * 3]     = Math.cos(angle) * speed
      neuronDrift[n * 3 + 1] = Math.sin(angle) * speed
      neuronDrift[n * 3 + 2] = (Math.random() - 0.5) * 2

      neuronActLevel[n] = BASE_GLOW
      const phase = Math.random()

      const somaR = SOMA_R_MIN + Math.random() * (SOMA_R_MAX - SOMA_R_MIN)

      // --- SOMA particles: dense sphere around center ---
      for (let s = 0; s < SOMA_PARTICLES; s++) {
        // Random point in sphere with falloff toward center
        const u = Math.random()
        const v = Math.random()
        const theta = u * Math.PI * 2
        const phi = Math.acos(2 * v - 1)
        const r = somaR * Math.pow(Math.random(), 0.4) // bias toward center
        const sx = cx + r * Math.sin(phi) * Math.cos(theta)
        const sy = cy + r * Math.sin(phi) * Math.sin(theta)
        const sz = cz + r * Math.cos(phi)

        positions[p * 3]     = sx
        positions[p * 3 + 1] = sy
        positions[p * 3 + 2] = sz
        somaCenters[p * 3]     = cx
        somaCenters[p * 3 + 1] = cy
        somaCenters[p * 3 + 2] = cz
        sizes[p] = Math.random() * 0.5 + 0.7
        shift[p * 4]     = Math.random() * Math.PI
        shift[p * 4 + 1] = Math.random() * Math.PI * 2
        shift[p * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.08
        shift[p * 4 + 3] = Math.random() * 0.8 + 0.3
        roles[p] = 0.0
        dendriteT[p] = 0.0
        neuronPhase[p] = phase
        neuronAct[p] = BASE_GLOW
        p++
      }

      // --- DENDRITES: tendrils radiating from soma ---
      for (let d = 0; d < DENDRITES_PER_NEURON; d++) {
        // Random outward direction (mostly in XY plane with a bit of Z)
        const dTheta = Math.random() * Math.PI * 2
        const dPhi = (Math.random() - 0.5) * 0.6 // mostly equatorial
        const dirX = Math.cos(dTheta) * Math.cos(dPhi)
        const dirY = Math.sin(dTheta) * Math.cos(dPhi)
        const dirZ = Math.sin(dPhi)

        const length = DENDRITE_LEN_MIN + Math.random() * (DENDRITE_LEN_MAX - DENDRITE_LEN_MIN)

        // Curve: gentle perpendicular bend
        const bendStrength = (Math.random() - 0.5) * 0.6
        // Perpendicular vector (XY rotate 90deg)
        const perpX = -dirY
        const perpY = dirX
        const perpZ = (Math.random() - 0.5) * 0.3

        for (let k = 0; k < DENDRITE_PARTICLES; k++) {
          // t goes from near-soma (0.15) to tip (1.0) — skip 0 so dendrite starts outside soma surface
          const t = 0.15 + (k / (DENDRITE_PARTICLES - 1)) * 0.85
          const bend = bendStrength * t * t // bend grows toward tip
          // Small jitter perpendicular to the dendrite to give it organic thickness
          const jitter = (Math.random() - 0.5) * 3.0
          const jitterDir = (Math.random() - 0.5) * 3.0

          const lx = cx + dirX * length * t + (perpX * bend * length * 0.3) + perpX * jitter + dirX * jitterDir * 0.2
          const ly = cy + dirY * length * t + (perpY * bend * length * 0.3) + perpY * jitter + dirY * jitterDir * 0.2
          const lz = cz + dirZ * length * t + (perpZ * bend * length * 0.3) + perpZ * jitter * 0.5

          positions[p * 3]     = lx
          positions[p * 3 + 1] = ly
          positions[p * 3 + 2] = lz
          somaCenters[p * 3]     = cx
          somaCenters[p * 3 + 1] = cy
          somaCenters[p * 3 + 2] = cz
          sizes[p] = (1.0 - t * 0.55) * (Math.random() * 0.4 + 0.5) // taper toward tip
          shift[p * 4]     = Math.random() * Math.PI
          shift[p * 4 + 1] = Math.random() * Math.PI * 2
          shift[p * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
          shift[p * 4 + 3] = Math.random() * 1.2 + 0.4
          roles[p] = 1.0
          dendriteT[p] = t
          neuronPhase[p] = phase
          neuronAct[p] = BASE_GLOW
          p++
        }
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))
    geo.setAttribute('aSomaCenter', new THREE.BufferAttribute(somaCenters, 3).setUsage(THREE.DynamicDrawUsage))
    geo.setAttribute('aRole', new THREE.BufferAttribute(roles, 1))
    geo.setAttribute('aDendriteT', new THREE.BufferAttribute(dendriteT, 1))
    geo.setAttribute('aNeuronPhase', new THREE.BufferAttribute(neuronPhase, 1))
    geo.setAttribute('aNeuronAct', new THREE.BufferAttribute(neuronAct, 1).setUsage(THREE.DynamicDrawUsage))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 4.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uSpreadY: { value: SPREAD_Y },
        uMouse: { value: new THREE.Vector2(99999, 99999) },
        uMouseActive: { value: 0 },
        uMouseR: { value: MOUSE_INFLUENCE_R },
      },
      vertexShader: NEURON_VERTEX_SHADER,
      fragmentShader: NEURON_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return {
      positions, somaCenters, neuronAct, geo, mat,
      neuronCenters, neuronDrift, neuronActLevel, neuronNextAct,
    }
  }, [gl])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    ctx.mat.uniforms.uTime.value += dt
    ctx.mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    const halfX = SPREAD_X * 0.5
    const halfY = SPREAD_Y * 0.5
    const halfZ = SPREAD_Z * 0.5

    // 1) Drift each neuron + wrap
    for (let n = 0; n < NEURON_COUNT; n++) {
      const nx = n * 3
      ctx.neuronCenters[nx]     += ctx.neuronDrift[nx]     * dt
      ctx.neuronCenters[nx + 1] += ctx.neuronDrift[nx + 1] * dt
      ctx.neuronCenters[nx + 2] += ctx.neuronDrift[nx + 2] * dt
      if (ctx.neuronCenters[nx]     >  halfX) ctx.neuronCenters[nx]     -= SPREAD_X
      if (ctx.neuronCenters[nx]     < -halfX) ctx.neuronCenters[nx]     += SPREAD_X
      if (ctx.neuronCenters[nx + 1] >  halfY) ctx.neuronCenters[nx + 1] -= SPREAD_Y
      if (ctx.neuronCenters[nx + 1] < -halfY) ctx.neuronCenters[nx + 1] += SPREAD_Y
      if (ctx.neuronCenters[nx + 2] >  halfZ) ctx.neuronCenters[nx + 2] -= SPREAD_Z
      if (ctx.neuronCenters[nx + 2] < -halfZ) ctx.neuronCenters[nx + 2] += SPREAD_Z
    }

    // 2) Mouse → world XY
    const ndcX = (skillsMouseState.x / size.width) * 2 - 1
    const ndcY = -(skillsMouseState.y / size.height) * 2 + 1
    const v = mouseWorld.current.set(ndcX, ndcY, 0.5)
    v.unproject(camera)
    const dir = v.sub(camera.position).normalize()
    const distZ = -camera.position.z / dir.z
    const mWorld = camera.position.clone().add(dir.multiplyScalar(distZ))
    const mx = mWorld.x
    const my = mWorld.y

    ctx.mat.uniforms.uMouse.value.set(mx, my)
    const targetActive = skillsMouseState.active ? 1 : 0
    const curActive = ctx.mat.uniforms.uMouseActive.value as number
    ctx.mat.uniforms.uMouseActive.value = curActive + (targetActive - curActive) * 0.15

    // 3) Per-neuron activation: decay + base + mouse tiers + spontaneous + burst
    const nextAct = ctx.neuronNextAct
    for (let n = 0; n < NEURON_COUNT; n++) {
      const decayed = ctx.neuronActLevel[n] * DECAY
      nextAct[n] = decayed > BASE_GLOW ? decayed : BASE_GLOW
    }

    if (skillsMouseState.active) {
      const rSq = MOUSE_INFLUENCE_R * MOUSE_INFLUENCE_R
      const shockSq = MOUSE_SHOCK_R * MOUSE_SHOCK_R
      const coreSq = MOUSE_CORE_R * MOUSE_CORE_R
      for (let n = 0; n < NEURON_COUNT; n++) {
        const dx = ctx.neuronCenters[n * 3]     - mx
        const dy = ctx.neuronCenters[n * 3 + 1] - my
        const dsq = dx * dx + dy * dy
        if (dsq < rSq) {
          const f = 1.0 - dsq / rSq
          let lvl = f * f * 0.7
          if (dsq < shockSq) {
            const sf = 1.0 - dsq / shockSq
            lvl = Math.max(lvl, 0.7 + sf * 0.25)
          }
          if (dsq < coreSq) lvl = 1.0
          if (lvl > nextAct[n]) nextAct[n] = lvl
        }
      }
    }

    // Skill-bar burst: activate the few neurons nearest hover Y line
    if (skillsMouseState.burstRequest !== lastBurst.current) {
      lastBurst.current = skillsMouseState.burstRequest
      const bndcY = -(skillsMouseState.hoverBarY / size.height) * 2 + 1
      const bv = new THREE.Vector3(0, bndcY, 0.5).unproject(camera)
      const bdir = bv.sub(camera.position).normalize()
      const bdist = -camera.position.z / bdir.z
      const wy = camera.position.y + bdir.y * bdist
      const BURST_HIT = 6
      const top: { i: number; d: number }[] = []
      for (let n = 0; n < NEURON_COUNT; n++) {
        const d = Math.abs(ctx.neuronCenters[n * 3 + 1] - wy)
        if (top.length < BURST_HIT) {
          top.push({ i: n, d })
          top.sort((a, b) => a.d - b.d)
        } else if (d < top[BURST_HIT - 1].d) {
          top[BURST_HIT - 1] = { i: n, d }
          top.sort((a, b) => a.d - b.d)
        }
      }
      for (const t of top) nextAct[t.i] = 1
    }

    // Spontaneous firings
    for (let s = 0; s < SPONT_PER_FRAME; s++) {
      const n = (Math.random() * NEURON_COUNT) | 0
      if (nextAct[n] < SPONT_LEVEL) nextAct[n] = SPONT_LEVEL
    }

    // Commit neuron activation
    for (let n = 0; n < NEURON_COUNT; n++) ctx.neuronActLevel[n] = nextAct[n]

    // 4) Push per-neuron data to per-particle buffers
    let p = 0
    for (let n = 0; n < NEURON_COUNT; n++) {
      const cx = ctx.neuronCenters[n * 3]
      const cy = ctx.neuronCenters[n * 3 + 1]
      const cz = ctx.neuronCenters[n * 3 + 2]
      const act = ctx.neuronActLevel[n]
      // Find delta from previous soma center for this neuron and translate particles
      const prevCx = ctx.somaCenters[p * 3]
      const prevCy = ctx.somaCenters[p * 3 + 1]
      const prevCz = ctx.somaCenters[p * 3 + 2]
      const dCx = cx - prevCx
      const dCy = cy - prevCy
      const dCz = cz - prevCz
      // Detect wrap (large jump) and shift particles by full SPREAD to keep them attached
      const wrapX = Math.abs(dCx) > SPREAD_X * 0.5 ? (dCx > 0 ? -SPREAD_X : SPREAD_X) : 0
      const wrapY = Math.abs(dCy) > SPREAD_Y * 0.5 ? (dCy > 0 ? -SPREAD_Y : SPREAD_Y) : 0
      const wrapZ = Math.abs(dCz) > SPREAD_Z * 0.5 ? (dCz > 0 ? -SPREAD_Z : SPREAD_Z) : 0
      const tx = dCx + wrapX
      const ty = dCy + wrapY
      const tz = dCz + wrapZ

      for (let k = 0; k < PARTICLES_PER_NEURON; k++) {
        ctx.positions[p * 3]     += tx
        ctx.positions[p * 3 + 1] += ty
        ctx.positions[p * 3 + 2] += tz
        ctx.somaCenters[p * 3]     = cx
        ctx.somaCenters[p * 3 + 1] = cy
        ctx.somaCenters[p * 3 + 2] = cz
        ctx.neuronAct[p] = act
        p++
      }
    }

    const posAttr = ctx.geo.getAttribute('position') as THREE.BufferAttribute
    const somaAttr = ctx.geo.getAttribute('aSomaCenter') as THREE.BufferAttribute
    const actAttr = ctx.geo.getAttribute('aNeuronAct') as THREE.BufferAttribute
    posAttr.needsUpdate = true
    somaAttr.needsUpdate = true
    actAttr.needsUpdate = true
  })

  return <points geometry={ctx.geo} material={ctx.mat} />
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
        <NeuronField />
      </Canvas>
    </div>
  )
}
