'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

// Contact black hole — modeled directly on HeroParticles.
// Same idea: a single GPU points cloud where the disk geometry itself draws
// the eye. No event-horizon mesh, no glow rings — the void at the center
// is just where particles aren't. Adds two things over Hero:
//   1. The disk is dramatically tilted (yaw + pitch) so it visibly leans.
//   2. Cool-color micro lightning bolts strike from the void to disk
//      particles, both on auto interval and on mouse hover.
//
// All particle motion is vertex-shader wobble (aShift). CPU only ticks
// uTime and the group rotation.

const HALO_COUNT = 0       // halo removed — no central sphere
const DISK_COUNT = 160000  // densified to keep particle density at the larger radius
const TOTAL = HALO_COUNT + DISK_COUNT

// Disk in local coords. Inner radius is 0 (void filled). Outer radius pushed
// out so the disk visibly extends past the viewport edges — the user reads
// it as a full-screen swirl rather than a contained circle.
const INNER_RADIUS = 0
const OUTER_RADIUS = 110
const DISK_HEIGHT = 1.6

// Rest rotation — disk now faces the user head-on (XY plane, Z normal).
// Only roll (Z) is kept so the wobble pattern doesn't look axis-aligned;
// pitch and yaw are zero so the disk reads as a flat ring facing camera.
const REST_PITCH = -Math.PI / 2  // X: tip disk up so its plane faces camera
const REST_YAW = 0
const REST_ROLL = 0

// Lightning system — auto-burst every 1s: fires 1–5 bolts in sequence,
// each separated by 0.1s. If the cursor is over the canvas, every bolt
// in the burst targets the cursor position (projected onto the disk
// plane); otherwise bolts hit random disk particles.
const MAX_BOLTS = 16
const SEGMENTS_PER_BOLT = 12
const FORKS_PER_BOLT = 2
const SEGMENTS_PER_FORK = 5
const BOLT_LIFETIME = 0.32
const BURST_INTERVAL = 1.0          // seconds between bursts
const BURST_MIN = 1                 // min bolts per burst
const BURST_MAX = 5                 // max bolts per burst
const BURST_BOLT_GAP = 0.1          // seconds between bolts within a burst

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;

  attribute float aSize;
  attribute vec4  aShift;

  varying vec3 vColor;

  const float PI2 = 6.2831853;

  void main() {
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.a;

    vec3 transformed = position + wobble;

    // Color by normalized cylindrical distance — matches HeroParticles'
    // two-stop palette exactly so the contact scene reads as the same galaxy:
    // warm amber core → deep purple rim. The normalization denominator is
    // intentionally LARGER than OUTER_RADIUS so the amber core region
    // stretches out to ~half the disk in world units — that's the bright
    // yellow halo that visually wraps the contact content.
    float d = length(abs(position) / vec3(220.0, 14.0, 220.0));
    d = clamp(d, 0.0, 1.0);
    vec3 core = vec3(255.0, 170.0, 60.0)  / 255.0; // amber (Hero)
    vec3 rim  = vec3(110.0, 60.0, 230.0)  / 255.0; // deep purple (Hero)
    vColor = mix(core, rim, d);

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (110.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    // Same alpha curve as Hero — soft falloff, no color boost. Bloom does
    // the heavy lifting downstream so the points themselves stay restrained.
    float alpha = smoothstep(0.5, 0.0, d) * 0.35 + 0.15;
    gl_FragColor = vec4(vColor, alpha);
  }
`

interface Bolt {
  startTime: number
  vertexStart: number
  active: boolean
}

function GalaxyPoints() {
  const groupRef = useRef<THREE.Group>(null)
  const lightningRef = useRef<THREE.LineSegments>(null)
  const { gl, viewport, size } = useThree()
  const mouseRef = useRef({ x: 0, y: 0 })
  const activeRef = useRef(false)

  const data = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3)
    const sizes = new Float32Array(TOTAL)
    const shift = new Float32Array(TOTAL * 4)

    // Disk — annular ring biased toward rim, flattened.
    for (let i = 0; i < DISK_COUNT; i++) {
      const rand = Math.pow(Math.random(), 1.5)
      const radius = Math.sqrt(
        OUTER_RADIUS * OUTER_RADIUS * rand +
        (1 - rand) * INNER_RADIUS * INNER_RADIUS,
      )
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * DISK_HEIGHT
      const x = Math.cos(theta) * radius
      const z = Math.sin(theta) * radius

      const idx = HALO_COUNT + i
      positions[idx * 3]     = x
      positions[idx * 3 + 1] = y
      positions[idx * 3 + 2] = z

      sizes[idx] = Math.random() * 0.7 + 0.25
      shift[idx * 4]     = Math.random() * Math.PI
      shift[idx * 4 + 1] = Math.random() * Math.PI * 2
      shift[idx * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      shift[idx * 4 + 3] = Math.random() * 0.9 + 0.1
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Lightning buffers — preallocate.
    const segmentsPerBolt = (SEGMENTS_PER_BOLT - 1) + FORKS_PER_BOLT * (SEGMENTS_PER_FORK - 1)
    const lineVertCount = MAX_BOLTS * segmentsPerBolt * 2
    const linePositions = new Float32Array(lineVertCount * 3)
    const lineColors = new Float32Array(lineVertCount * 3)
    const lineAlphas = new Float32Array(lineVertCount)

    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
    lineGeo.setAttribute('aAlpha', new THREE.BufferAttribute(lineAlphas, 1))

    const lineMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const bolts: Bolt[] = []
    for (let i = 0; i < MAX_BOLTS; i++) {
      bolts.push({
        startTime: -1,
        vertexStart: i * segmentsPerBolt * 2,
        active: false,
      })
    }

    return {
      positions,
      geometry: geo,
      material: mat,
      lineGeo,
      lineMat,
      linePositions,
      lineColors,
      lineAlphas,
      bolts,
      segmentsPerBolt,
      nextBoltSlot: { current: 0 },
      nextBurstAt: { current: 0.5 },          // when next burst kicks off
      burstRemaining: { current: 0 },         // bolts left in current burst
      nextBurstBoltAt: { current: 0 },        // when next bolt in burst fires
    }
  }, [gl])

  const spawnBolt = (from: THREE.Vector3, to: THREE.Vector3, elapsed: number) => {
    const slot = data.nextBoltSlot.current
    const bolt = data.bolts[slot]
    data.nextBoltSlot.current = (slot + 1) % MAX_BOLTS
    bolt.startTime = elapsed
    bolt.active = true

    const dir = new THREE.Vector3().subVectors(to, from)
    const length = dir.length()
    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const perp1 = new THREE.Vector3().crossVectors(dir, up).normalize()
    const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize()

    const main: THREE.Vector3[] = []
    for (let i = 0; i < SEGMENTS_PER_BOLT; i++) {
      const t = i / (SEGMENTS_PER_BOLT - 1)
      const point = new THREE.Vector3().lerpVectors(from, to, t)
      if (i > 0 && i < SEGMENTS_PER_BOLT - 1) {
        const jitter = (1 - Math.abs(t - 0.5) * 1.6) * length * 0.08
        point.addScaledVector(perp1, (Math.random() - 0.5) * jitter)
        point.addScaledVector(perp2, (Math.random() - 0.5) * jitter)
      }
      main.push(point)
    }

    let writeIdx = bolt.vertexStart
    for (let i = 0; i < SEGMENTS_PER_BOLT - 1; i++) {
      const a = main[i], b = main[i + 1]
      data.linePositions[writeIdx * 3]     = a.x
      data.linePositions[writeIdx * 3 + 1] = a.y
      data.linePositions[writeIdx * 3 + 2] = a.z
      data.linePositions[(writeIdx + 1) * 3]     = b.x
      data.linePositions[(writeIdx + 1) * 3 + 1] = b.y
      data.linePositions[(writeIdx + 1) * 3 + 2] = b.z
      writeIdx += 2
    }

    for (let f = 0; f < FORKS_PER_BOLT; f++) {
      const startIdx = 2 + Math.floor(Math.random() * (SEGMENTS_PER_BOLT - 4))
      const origin = main[startIdx]
      const forkDir = new THREE.Vector3()
        .subVectors(main[startIdx + 1], origin)
        .normalize()
        .addScaledVector(perp1, (Math.random() - 0.5) * 1.4)
        .addScaledVector(perp2, (Math.random() - 0.5) * 1.4)
        .normalize()
      const forkLen = length * (0.15 + Math.random() * 0.18)
      const forkEnd = new THREE.Vector3().copy(origin).addScaledVector(forkDir, forkLen)

      const forkPts: THREE.Vector3[] = []
      for (let i = 0; i < SEGMENTS_PER_FORK; i++) {
        const t = i / (SEGMENTS_PER_FORK - 1)
        const p = new THREE.Vector3().lerpVectors(origin, forkEnd, t)
        if (i > 0 && i < SEGMENTS_PER_FORK - 1) {
          p.addScaledVector(perp1, (Math.random() - 0.5) * forkLen * 0.15)
          p.addScaledVector(perp2, (Math.random() - 0.5) * forkLen * 0.15)
        }
        forkPts.push(p)
      }
      for (let i = 0; i < SEGMENTS_PER_FORK - 1; i++) {
        const a = forkPts[i], b = forkPts[i + 1]
        data.linePositions[writeIdx * 3]     = a.x
        data.linePositions[writeIdx * 3 + 1] = a.y
        data.linePositions[writeIdx * 3 + 2] = a.z
        data.linePositions[(writeIdx + 1) * 3]     = b.x
        data.linePositions[(writeIdx + 1) * 3 + 1] = b.y
        data.linePositions[(writeIdx + 1) * 3 + 2] = b.z
        writeIdx += 2
      }
    }

    const startVert = bolt.vertexStart
    const endVert = bolt.vertexStart + data.segmentsPerBolt * 2
    const cyan = new THREE.Color(0xffb53c)    // amber root — matches disk core
    const violet = new THREE.Color(0x9d6cff)  // purple tip — matches disk rim
    for (let v = startVert; v < endVert; v++) {
      const t = (v - startVert) / (endVert - startVert)
      const c = new THREE.Color().lerpColors(cyan, violet, t)
      data.lineColors[v * 3]     = c.r
      data.lineColors[v * 3 + 1] = c.g
      data.lineColors[v * 3 + 2] = c.b
      data.lineAlphas[v] = 1.0
    }
  }

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    const mat = data.material as THREE.ShaderMaterial
    const t = (mat.uniforms.uTime.value += delta * Math.PI * 0.5)
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    if (groupRef.current) {
      // Disk faces camera (outer group tilts by REST_PITCH). The inner spin
      // group rotates around the disk's own normal axis (local Y), so the
      // accretion disk and the orbiting text ring revolve together.
      groupRef.current.rotation.y = t * 0.03
    }

    // Read mouse from window-global (same pattern as Hero).
    const m = (window as unknown as { __contactMouse?: { x: number; y: number; active: boolean } }).__contactMouse
    if (m) {
      mouseRef.current.x = (m.x / size.width) * 2 - 1
      mouseRef.current.y = -((m.y / size.height) * 2 - 1)
      activeRef.current = m.active
    }

    // Burst scheduler: every BURST_INTERVAL seconds, queue 1–5 bolts spaced
    // BURST_BOLT_GAP apart. If cursor is over the canvas, every bolt in the
    // burst targets the cursor's current position on the disk plane; otherwise
    // bolts strike random disk particles.
    if (data.burstRemaining.current === 0 && elapsed >= data.nextBurstAt.current) {
      data.burstRemaining.current = BURST_MIN + Math.floor(Math.random() * (BURST_MAX - BURST_MIN + 1))
      data.nextBurstBoltAt.current = elapsed
      data.nextBurstAt.current = elapsed + BURST_INTERVAL
    }

    while (data.burstRemaining.current > 0 && elapsed >= data.nextBurstBoltAt.current) {
      let target: THREE.Vector3
      if (activeRef.current) {
        // Lightning runs in world space; the disk faces the camera at z=0.
        // Convert cursor NDC → world XY directly, clamp to disk radius so the
        // bolt always lands on the visible disk.
        const wx = (mouseRef.current.x * viewport.width) / 2
        const wy = (mouseRef.current.y * viewport.height) / 2
        const r = Math.sqrt(wx * wx + wy * wy)
        const maxR = OUTER_RADIUS * 0.98
        if (r > maxR) {
          const s = maxR / r
          target = new THREE.Vector3(wx * s, wy * s, 0)
        } else {
          target = new THREE.Vector3(wx, wy, 0)
        }
      } else {
        // Idle target: random point on the disk in world space. The disk in
        // local space is (x, 0, z); after REST_PITCH = -π/2 around X that
        // maps to world (x, z, 0).
        const idx = HALO_COUNT + Math.floor(Math.random() * DISK_COUNT)
        const lx = data.positions[idx * 3]
        const lz = data.positions[idx * 3 + 2]
        target = new THREE.Vector3(lx, lz, 0)
      }
      spawnBolt(new THREE.Vector3(0, 0, 0), target, elapsed)
      data.burstRemaining.current -= 1
      data.nextBurstBoltAt.current += BURST_BOLT_GAP
    }

    // Fade bolts.
    for (let i = 0; i < MAX_BOLTS; i++) {
      const bolt = data.bolts[i]
      if (!bolt.active) continue
      const age = elapsed - bolt.startTime
      const startVert = bolt.vertexStart
      const endVert = bolt.vertexStart + data.segmentsPerBolt * 2
      if (age >= BOLT_LIFETIME) {
        bolt.active = false
        for (let v = startVert; v < endVert; v++) data.lineAlphas[v] = 0
        continue
      }
      const u = age / BOLT_LIFETIME
      const alpha = u < 0.15 ? u / 0.15 : Math.pow(1 - (u - 0.15) / 0.85, 1.7)
      for (let v = startVert; v < endVert; v++) data.lineAlphas[v] = alpha
    }
    data.lineGeo.setDrawRange(0, MAX_BOLTS * data.segmentsPerBolt * 2)
    ;(data.lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(data.lineGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true
    ;(data.lineGeo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <>
      {/* Lightning lives in world space — bolts are computed in world coords
          so they don't ride the disk's rotation, which lets the cursor-tracked
          burst actually strike where the user's pointer is. */}
      <lineSegments ref={lightningRef} geometry={data.lineGeo} material={data.lineMat} />
      <group rotation={[REST_PITCH, REST_YAW, REST_ROLL]}>
        <group ref={groupRef}>
          <points geometry={data.geometry} material={data.material} />
        </group>
      </group>
    </>
  )
}

// Custom shader: radial gravitational lens + chromatic aberration.
// Pulls the rendered image toward a virtual event horizon at screen center,
// darkens the core, and splits R/G/B channels along the warp direction so
// the rim shimmers. This is what gives the scene "black hole feel" instead
// of just being a glowing donut.
const LENS_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uHoleRadius: { value: 0.06 },     // dark core size (NDC-ish)
    uLensStrength: { value: 0.35 },   // how much UVs bend toward center
    uAberration: { value: 0.0 },      // disabled — rainbow split clashes with Hero's clean palette
    uDarkness: { value: 0.92 },       // how black the event horizon is
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform vec2 uCenter;
    uniform float uHoleRadius;
    uniform float uLensStrength;
    uniform float uAberration;
    uniform float uDarkness;
    varying vec2 vUv;

    void main() {
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      vec2 dir = (vUv - uCenter) * aspect;
      float dist = length(dir);
      vec2 ndir = dir / max(dist, 1e-5);

      // Lens warp: pull UVs toward center, strongest near event horizon,
      // falling off with 1/r so distant stars are barely affected.
      float lens = uLensStrength / (dist + 0.15);
      vec2 warpUv = vUv - (ndir / aspect) * lens * 0.02;

      // Chromatic aberration along the radial direction — color separation
      // increases near the rim of the disk.
      float ab = uAberration * smoothstep(0.0, 0.4, dist) * (1.0 - smoothstep(0.45, 0.8, dist));
      vec2 abShift = (ndir / aspect) * ab;

      float r = texture2D(tDiffuse, warpUv + abShift).r;
      float g = texture2D(tDiffuse, warpUv).g;
      float b = texture2D(tDiffuse, warpUv - abShift).b;
      vec3 col = vec3(r, g, b);

      // Event horizon: smooth black disc at the center with a thin photon
      // ring lift on the boundary so the void doesn't look like a flat hole.
      float horizon = smoothstep(uHoleRadius + 0.015, uHoleRadius - 0.005, dist);
      float photonRing = smoothstep(uHoleRadius + 0.025, uHoleRadius + 0.005, dist) -
                         smoothstep(uHoleRadius + 0.005, uHoleRadius - 0.005, dist);
      col = mix(col, vec3(0.0), horizon * uDarkness);
      col += vec3(1.0, 0.75, 0.45) * photonRing * 0.55;

      // Subtle outer vignette to deepen the void of space.
      float vig = smoothstep(0.95, 0.4, dist);
      col *= mix(0.65, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

function PostFX() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)
  const lensRef = useRef<ShaderPass | null>(null)
  const bloomRef = useRef<UnrealBloomPass | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))

    // Bloom — expanded amber core needs more bleed so the yellow halo
    // visibly wraps the contact content. Threshold lowered so the larger
    // warm-toned interior actually lifts into glow, radius widened so the
    // halo spreads out past the inner cards.
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.1,   // strength
      0.9,   // radius — wider bleed
      0.25,  // threshold — let the warm core region glow, not just the brightest pixels
    )
    composer.addPass(bloom)

    const lens = new ShaderPass(LENS_SHADER)
    lens.uniforms.uResolution.value.set(size.width, size.height)
    composer.addPass(lens)

    composer.setSize(size.width, size.height)
    composerRef.current = composer
    lensRef.current = lens
    bloomRef.current = bloom

    return () => {
      composer.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => {
    if (!composerRef.current || !lensRef.current || !bloomRef.current) return
    composerRef.current.setSize(size.width, size.height)
    lensRef.current.uniforms.uResolution.value.set(size.width, size.height)
    bloomRef.current.resolution.set(size.width, size.height)
  }, [size.width, size.height])

  // Take over the render loop. Priority 1 ensures we run after R3F's default
  // scene updates but before any other post-processing in the tree.
  useFrame(() => {
    composerRef.current?.render()
  }, 1)

  return null
}

export default function ContactBlackHole({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    ;(window as unknown as { __contactMouse: { x: number; y: number; active: boolean } }).__contactMouse = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    }
  }
  const handleMouseLeave = () => {
    const w = window as unknown as { __contactMouse?: { x: number; y: number; active: boolean } }
    if (w.__contactMouse) w.__contactMouse.active = false
  }

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', background: '#000000' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 140], fov: 60, near: 1, far: 600 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#000000']} />
        <GalaxyPoints />
        <PostFX />
      </Canvas>
    </div>
  )
}
