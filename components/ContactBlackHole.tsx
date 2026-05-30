'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

// Contact black hole — CPU-driven accretion disk.
//
// The physics state (position, velocity, mass, life) lives in plain
// Float32Arrays. Every frame we integrate Newtonian gravity toward the
// center (+ an optional mouse gravity well) on the CPU and write the
// results straight into the geometry's position/color BufferAttributes.
//
// Physics runs in pure 2D (z=0). The whole points group is tilted by
// REST_PITCH so the disk reads as a tilted ellipse (fake 3D). The center
// region inside HORIZON stays empty so the HTML text overlay sits in a
// clean void wrapped by the disk + photon ring (lens post-process).

const PARTICLE_COUNT = 14000

// World-space scales. HORIZON is sized so the disc visually wraps the
// centered text content. Particles crossing inside HORIZON are killed,
// which keeps the text region empty.
const HORIZON = 60
const SPAWN_MIN = 95
const SPAWN_MAX = 120
const KILL_RADIUS = 140

// Physics constants.
const G = 90000
const G_MOUSE = 18000
const SOFTENING = 40
const DAMPING = 0.9985

// Visual tilt.
const REST_PITCH = -Math.PI / 3 // ~-60°

const CORE = new THREE.Color(255 / 255, 170 / 255, 60 / 255) // amber
const RIM = new THREE.Color(110 / 255, 60 / 255, 230 / 255) // deep purple

const RENDER_VERTEX = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uSize;

  attribute float aSize;
  attribute float aAlpha;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (110.0 / -mvPosition.z);
  }
`

const RENDER_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`

// Radial gravitational-lens + photon ring post-process.
const LENS_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uPhotonRadius: { value: 0.30 },
    uLensStrength: { value: 0.18 },
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
    uniform vec2  uResolution;
    uniform vec2  uCenter;
    uniform float uPhotonRadius;
    uniform float uLensStrength;
    varying vec2  vUv;

    void main() {
      vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
      vec2 dir = (vUv - uCenter) * aspect;
      float dist = length(dir);
      vec2 ndir = dir / max(dist, 1e-5);

      // Gentle lens warp — pull UVs toward center so the disk warps
      // slightly inward, hinting at gravitational lensing without
      // distorting the centered text area too aggressively.
      float lens = uLensStrength / (dist + 0.25);
      vec2 warpUv = vUv - (ndir / aspect) * lens * 0.012;
      vec3 col = texture2D(tDiffuse, warpUv).rgb;

      // Soft outer vignette to deepen the void of space.
      float vig = smoothstep(0.95, 0.35, dist);
      col *= mix(0.85, 1.0, vig);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

function GalaxyPoints() {
  const pointsRef = useRef<THREE.Points>(null)
  const { gl, size, camera } = useThree()
  const mouseRef = useRef({ x: 0, y: 0, active: false })

  // Physics state lives outside React render — plain typed arrays.
  const sim = useRef<{
    px: Float32Array
    py: Float32Array
    vx: Float32Array
    vy: Float32Array
    mass: Float32Array
    life: Float32Array
  } | null>(null)

  const { geometry, material } = useMemo(() => {
    const px = new Float32Array(PARTICLE_COUNT)
    const py = new Float32Array(PARTICLE_COUNT)
    const vx = new Float32Array(PARTICLE_COUNT)
    const vy = new Float32Array(PARTICLE_COUNT)
    const mass = new Float32Array(PARTICLE_COUNT)
    const life = new Float32Array(PARTICLE_COUNT)

    // Seed a full rotating disk so the first frame already reads as one.
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2
      const rand = Math.pow(Math.random(), 0.7)
      const r = HORIZON + rand * (KILL_RADIUS - HORIZON)
      px[i] = Math.cos(a) * r
      py[i] = Math.sin(a) * r

      // Tangential orbital velocity ~ sqrt(G / r), mild scatter.
      const orbit = Math.sqrt(G / (r + SOFTENING)) * (0.8 + Math.random() * 0.4)
      vx[i] = -Math.sin(a) * orbit
      vy[i] = Math.cos(a) * orbit

      mass[i] = 0.3 + Math.random() * 0.7
      life[i] = Math.random() // staggered fade-in
    }

    sim.current = { px, py, vx, vy, mass, life }

    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const alphas = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = px[i]
      positions[i * 3 + 1] = py[i]
      positions[i * 3 + 2] = 0
      sizes[i] = mass[i] * 0.7 + 0.25
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), KILL_RADIUS * 2)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: gl.getPixelRatio() },
        uSize: { value: 6.0 },
      },
      vertexShader: RENDER_VERTEX,
      fragmentShader: RENDER_FRAGMENT,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state, delta) => {
    const s = sim.current
    if (!s) return
    const dt = Math.min(delta, 1 / 30)

    // Read latest mouse → world-plane coords (project onto the tilted disk).
    const m = (window as unknown as {
      __contactMouse?: { x: number; y: number; active: boolean }
    }).__contactMouse
    if (m) {
      mouseRef.current.x = m.x
      mouseRef.current.y = m.y
      mouseRef.current.active = m.active
    }

    let mouseX = 0
    let mouseY = 0
    let mouseOn = false
    if (mouseRef.current.active) {
      const ndcX = (mouseRef.current.x / size.width) * 2 - 1
      const ndcY = -((mouseRef.current.y / size.height) * 2 - 1)
      const ray = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera)
      const origin = camera.position.clone()
      const dir = ray.sub(origin).normalize()
      const c = Math.cos(-REST_PITCH)
      const sn = Math.sin(-REST_PITCH)
      const oy = c * origin.y + sn * origin.z
      const oz = -sn * origin.y + c * origin.z
      const dy = c * dir.y + sn * dir.z
      const dz = -sn * dir.y + c * dir.z
      if (Math.abs(dz) > 1e-5) {
        const t = -oz / dz
        if (t > 0) {
          mouseX = origin.x + dir.x * t
          mouseY = oy + dy * t
          mouseOn = true
        }
      }
    }

    const { px, py, vx, vy, mass, life } = s
    const geo = (pointsRef.current!.geometry as THREE.BufferGeometry)
    const posArr = (geo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    const colArr = (geo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array
    const sizeArr = (geo.getAttribute('aSize') as THREE.BufferAttribute).array as Float32Array
    const alphaArr = (geo.getAttribute('aAlpha') as THREE.BufferAttribute).array as Float32Array

    const cr = CORE.r, cg = CORE.g, cb = CORE.b
    const rr_ = RIM.r, rg = RIM.g, rb = RIM.b
    const seedT = state.clock.elapsedTime

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let x = px[i]
      let y = py[i]

      // Central gravity.
      const r2 = x * x + y * y
      const r = Math.sqrt(r2)
      const inv = 1 / (r2 + SOFTENING)
      const a = G * inv
      // Acceleration toward center (-x/r, -y/r) * a.
      vx[i] -= (x / r) * a * dt
      vy[i] -= (y / r) * a * dt

      // Mouse gravity well.
      if (mouseOn) {
        const mdx = mouseX - x
        const mdy = mouseY - y
        const md2 = mdx * mdx + mdy * mdy
        const mdist = Math.sqrt(md2)
        const ma = G_MOUSE / (md2 + SOFTENING)
        vx[i] += (mdx / (mdist + 1e-3)) * ma * dt
        vy[i] += (mdy / (mdist + 1e-3)) * ma * dt
      }

      vx[i] *= DAMPING
      vy[i] *= DAMPING

      x += vx[i] * dt
      y += vy[i] * dt

      // Life fade-in.
      if (life[i] < 1) life[i] = Math.min(1, life[i] + dt * 1.5)

      // Death + respawn on the outer ring with a fresh orbital velocity.
      const rr = Math.sqrt(x * x + y * y)
      if (rr < HORIZON || rr > KILL_RADIUS) {
        const na = (hash(i * 0.123 + seedT)) * Math.PI * 2
        const nr = SPAWN_MIN + hash(i * 0.731 + seedT * 0.9) * (SPAWN_MAX - SPAWN_MIN)
        x = Math.cos(na) * nr
        y = Math.sin(na) * nr
        const orbit = Math.sqrt(G / (nr + SOFTENING)) * (0.8 + hash(i * 1.97 + seedT) * 0.4)
        vx[i] = -Math.sin(na) * orbit
        vy[i] = Math.cos(na) * orbit
        mass[i] = 0.3 + hash(i * 2.51 + seedT) * 0.7
        life[i] = 0
      }

      px[i] = x
      py[i] = y

      posArr[i * 3] = x
      posArr[i * 3 + 1] = y
      posArr[i * 3 + 2] = 0

      // Color by distance (temperature gradient) and alpha by life.
      const d = Math.min(rr / KILL_RADIUS, 1)
      colArr[i * 3] = cr + (rr_ - cr) * d
      colArr[i * 3 + 1] = cg + (rg - cg) * d
      colArr[i * 3 + 2] = cb + (rb - cb) * d
      sizeArr[i] = mass[i] * 0.7 + 0.25
      alphaArr[i] = (0.25 + (1 - d) * 0.55) * life[i]
    }

    ;(geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true
    ;(geo.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true

    ;(material as THREE.ShaderMaterial).uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  return (
    <group rotation={[REST_PITCH, 0, 0]}>
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}

// Cheap deterministic-ish hash for respawn jitter (fract of a sine).
function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

function PostFX() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)
  const lensRef = useRef<ShaderPass | null>(null)
  const bloomRef = useRef<UnrealBloomPass | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.1,   // strength
      0.9,   // radius
      0.25,  // threshold
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

  useFrame(() => {
    composerRef.current?.render()
  }, 1)

  return null
}

export default function ContactBlackHole({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    ;(window as unknown as {
      __contactMouse: { x: number; y: number; active: boolean }
    }).__contactMouse = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    }
  }
  const handleMouseLeave = () => {
    const w = window as unknown as {
      __contactMouse?: { x: number; y: number; active: boolean }
    }
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
