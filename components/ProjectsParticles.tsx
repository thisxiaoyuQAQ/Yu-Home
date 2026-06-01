'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

// Orbital System — a central star with orbiting particle rings and comets.
//
// Concept: Projects are celestial bodies orbiting a shared core.
//   - Central pulsing star (small, bright)
//   - Multiple elliptical orbit rings made of flowing particles
//   - Each ring has different speed, tilt, eccentricity
//   - Comet-like bright heads with trailing tails on some orbits
//   - Asteroid belt: dense ring of tiny particles
//   - Mouse interaction: gravitational lens distortion near cursor
//
// Palette: same amber/purple family as the rest of the site.
// All motion in vertex shader for GPU efficiency (~80k particles).

const RING_COUNT = 5
const PARTICLES_PER_RING = 9000
const COMET_COUNT = 8
const COMET_TAIL = 220
const ASTEROID_BELT = 32000
const CORE_PARTICLES = 5000
const TOTAL = RING_COUNT * PARTICLES_PER_RING + COMET_COUNT * COMET_TAIL
  + ASTEROID_BELT + CORE_PARTICLES

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec2  uMouse;
  uniform float uMouseActive;

  attribute float aSize;
  attribute float aOrbitRadius;
  attribute float aOrbitSpeed;
  attribute float aOrbitPhase;
  attribute float aOrbitTiltX;
  attribute float aOrbitTiltZ;
  attribute float aEccentricity;
  attribute vec3  aColor;
  attribute float aTrail;       // 0 = normal, 1 = comet head/tail

  varying vec3  vColor;
  varying float vAlpha;
  varying float vTrail;

  void main() {
    // Elliptical orbit: r = a(1-e²) / (1 + e·cos(θ))
    float theta = uTime * aOrbitSpeed + aOrbitPhase;
    float e = aEccentricity;
    float r = aOrbitRadius * (1.0 - e * e) / (1.0 + e * cos(theta));

    // Position on orbit plane
    float x = r * cos(theta);
    float y = 0.0;
    float z = r * sin(theta);

    // Apply orbit tilt (rotation around X and Z axes)
    float cx = cos(aOrbitTiltX);
    float sx = sin(aOrbitTiltX);
    float cz = cos(aOrbitTiltZ);
    float sz = sin(aOrbitTiltZ);

    // Rotate around X
    float y1 = y * cx - z * sx;
    float z1 = y * sx + z * cx;
    // Rotate around Z
    float x2 = x * cz - y1 * sz;
    float y2 = x * sz + y1 * cz;

    vec3 pos = vec3(x2, y2, z1);

    // Mouse glow — particles near cursor brighten and warm up
    // like shining a light through dust, no position distortion.
    // Dampened near the core so cursor-over-center doesn't blow out.
    vec2 mouseWorld = uMouse * vec2(80.0, 50.0);
    float mouseDist = length(pos.xy - mouseWorld);
    float coreDist = length(pos.xy);
    float coreShield = smoothstep(8.0, 30.0, coreDist);  // 0 near core, 1 outside
    float mouseGlow = smoothstep(40.0, 0.0, mouseDist) * uMouseActive * coreShield;

    // Trail particles: alpha fades along tail
    float trailAlpha = 1.0 - aTrail * 0.85;

    // Distance-based alpha: inner orbits slightly brighter
    float distFade = smoothstep(110.0, 15.0, aOrbitRadius) * 0.25 + 0.85;

    vColor = aColor;
    // Warm the color toward white where the mouse is, subtle effect
    vColor = mix(vColor, vec3(1.0, 0.95, 0.9), mouseGlow * 0.3);
    vAlpha = trailAlpha * distFade * (0.75 + 0.25 * sin(theta * 2.0 + aOrbitPhase)) + mouseGlow * 0.18;
    vTrail = aTrail;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float sizeBoost = 1.0 + mouseGlow * 0.3;
    gl_PointSize = uSize * aSize * uPixelRatio * sizeBoost * (100.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vTrail;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;

    float core = smoothstep(0.5, 0.0, d);
    // Comet heads get a sharper, brighter core; regular particles also punchy
    float brightness = mix(core * 0.9 + 0.35, core * 1.2 + 0.5, step(0.01, vTrail));
    float alpha = vAlpha * brightness;

    gl_FragColor = vec4(vColor, alpha);
  }
`

// Ring definitions
type RingDef = {
  radius: number
  speed: number
  tiltX: number
  tiltZ: number
  eccentricity: number
  colorInner: [number, number, number]
  colorOuter: [number, number, number]
}

// Unified disk tilt — all orbits share the main plane orientation,
// only mild per-ring deviation, so the whole system reads as a coherent
// galaxy disc rather than a tangle of unrelated rings.
const DISK_TILT_X = 0.45   // ~26° forward tilt of the disk plane
const DISK_TILT_Z = 0.18

const RINGS: RingDef[] = [
  // Inner amber ring — close to the hot core, dimmed to avoid bloom blowout
  { radius: 14, speed: 0.40, tiltX: DISK_TILT_X + 0.02, tiltZ: DISK_TILT_Z + 0.01, eccentricity: 0.05, colorInner: [200, 150, 90], colorOuter: [180, 100, 60] },
  // Mid amber-magenta transition
  { radius: 26, speed: 0.28, tiltX: DISK_TILT_X - 0.03, tiltZ: DISK_TILT_Z + 0.04, eccentricity: 0.10, colorInner: [255, 170, 80],  colorOuter: [220, 90, 160] },
  // Mid purple ring — main visual mass
  { radius: 42, speed: 0.18, tiltX: DISK_TILT_X + 0.04, tiltZ: DISK_TILT_Z - 0.03, eccentricity: 0.08, colorInner: [180, 110, 220], colorOuter: [110, 60, 200] },
  // Outer violet ring
  { radius: 64, speed: 0.11, tiltX: DISK_TILT_X - 0.02, tiltZ: DISK_TILT_Z + 0.02, eccentricity: 0.13, colorInner: [140, 80, 220],  colorOuter: [80, 40, 170] },
  // Far cool ring — recedes to the rim
  { radius: 90, speed: 0.07, tiltX: DISK_TILT_X + 0.01, tiltZ: DISK_TILT_Z - 0.04, eccentricity: 0.06, colorInner: [120, 90, 200],  colorOuter: [60, 50, 150] },
]

function OrbitalSystem() {
  const pointsRef = useRef<THREE.Points>(null)
  const { gl, size } = useThree()
  const mouseRef = useRef({ x: 0, y: 0, active: 0 })

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3)
    const sizes = new Float32Array(TOTAL)
    const orbitRadius = new Float32Array(TOTAL)
    const orbitSpeed = new Float32Array(TOTAL)
    const orbitPhase = new Float32Array(TOTAL)
    const orbitTiltX = new Float32Array(TOTAL)
    const orbitTiltZ = new Float32Array(TOTAL)
    const eccentricity = new Float32Array(TOTAL)
    const colors = new Float32Array(TOTAL * 3)
    const trail = new Float32Array(TOTAL)

    let idx = 0

    // Orbit rings
    for (let r = 0; r < RING_COUNT; r++) {
      const ring = RINGS[r]
      for (let p = 0; p < PARTICLES_PER_RING; p++) {
        positions[idx * 3] = 0
        positions[idx * 3 + 1] = 0
        positions[idx * 3 + 2] = 0

        sizes[idx] = 0.8 + Math.random() * 1.0
        orbitRadius[idx] = ring.radius + (Math.random() - 0.5) * 4
        orbitSpeed[idx] = ring.speed * (0.85 + Math.random() * 0.3)
        orbitPhase[idx] = Math.random() * Math.PI * 2
        orbitTiltX[idx] = ring.tiltX + (Math.random() - 0.5) * 0.05
        orbitTiltZ[idx] = ring.tiltZ + (Math.random() - 0.5) * 0.05
        eccentricity[idx] = ring.eccentricity + (Math.random() - 0.5) * 0.03

        // Brighten ring colors by boosting toward 1.0
        const t = Math.random()
        const boost = 1.15
        colors[idx * 3]     = Math.min(1, (ring.colorInner[0] + (ring.colorOuter[0] - ring.colorInner[0]) * t) / 255 * boost)
        colors[idx * 3 + 1] = Math.min(1, (ring.colorInner[1] + (ring.colorOuter[1] - ring.colorInner[1]) * t) / 255 * boost)
        colors[idx * 3 + 2] = Math.min(1, (ring.colorInner[2] + (ring.colorOuter[2] - ring.colorInner[2]) * t) / 255 * boost)

        trail[idx] = 0
        idx++
      }
    }

    // Comets with tails — wildly inclined orbits, span the full system
    for (let c = 0; c < COMET_COUNT; c++) {
      const cRadius = 20 + Math.random() * 75
      const cSpeed = 0.18 + Math.random() * 0.22
      const cPhase = Math.random() * Math.PI * 2
      // Comets break free of the disk plane for visual contrast
      const cTiltX = DISK_TILT_X + (Math.random() - 0.5) * 1.8
      const cTiltZ = DISK_TILT_Z + (Math.random() - 0.5) * 1.4
      const cEcc = 0.35 + Math.random() * 0.4

      for (let t = 0; t < COMET_TAIL; t++) {
        positions[idx * 3] = 0
        positions[idx * 3 + 1] = 0
        positions[idx * 3 + 2] = 0

        const tailPos = t / COMET_TAIL
        sizes[idx] = t === 0 ? 3.2 : (2.0 - tailPos * 1.7)
        orbitRadius[idx] = cRadius
        orbitSpeed[idx] = cSpeed
        orbitPhase[idx] = cPhase - tailPos * 0.35
        orbitTiltX[idx] = cTiltX
        orbitTiltZ[idx] = cTiltZ
        eccentricity[idx] = cEcc

        // Comet color: bright white head → warm amber tail
        colors[idx * 3]     = 1.0 - tailPos * 0.15
        colors[idx * 3 + 1] = 0.95 - tailPos * 0.35
        colors[idx * 3 + 2] = 0.85 - tailPos * 0.65

        trail[idx] = tailPos
        idx++
      }
    }

    // Asteroid belt — dense ring between rings 4 and 5, sharing disk tilt
    const BELT_RADIUS = 76
    const BELT_WIDTH = 6
    for (let i = 0; i < ASTEROID_BELT; i++) {
      positions[idx * 3] = 0
      positions[idx * 3 + 1] = 0
      positions[idx * 3 + 2] = 0

      sizes[idx] = 0.25 + Math.random() * 0.45
      orbitRadius[idx] = BELT_RADIUS + (Math.random() - 0.5) * BELT_WIDTH
      orbitSpeed[idx] = 0.085 + Math.random() * 0.03
      orbitPhase[idx] = Math.random() * Math.PI * 2
      orbitTiltX[idx] = DISK_TILT_X + (Math.random() - 0.5) * 0.04
      orbitTiltZ[idx] = DISK_TILT_Z + (Math.random() - 0.5) * 0.04
      eccentricity[idx] = Math.random() * 0.04

      // Warm dusty palette — amber-toned, brighter than before
      const warm = 0.55 + Math.random() * 0.35
      colors[idx * 3]     = warm * 1.0
      colors[idx * 3 + 1] = warm * 0.65
      colors[idx * 3 + 2] = warm * 0.55

      trail[idx] = 0
      idx++
    }

    // Core star particles — dense bright cluster, the heart of the system
    for (let i = 0; i < CORE_PARTICLES; i++) {
      positions[idx * 3] = 0
      positions[idx * 3 + 1] = 0
      positions[idx * 3 + 2] = 0

      // Gaussian distribution: most particles very close to center
      const rr = Math.abs(Math.random() + Math.random() + Math.random() - 1.5) * 6
      sizes[idx] = 0.7 + Math.random() * 1.2
      orbitRadius[idx] = rr
      orbitSpeed[idx] = 0.6 + Math.random() * 0.8
      orbitPhase[idx] = Math.random() * Math.PI * 2
      orbitTiltX[idx] = (Math.random() - 0.5) * Math.PI
      orbitTiltZ[idx] = (Math.random() - 0.5) * Math.PI
      eccentricity[idx] = Math.random() * 0.08

      // Warm amber core — subtle glow, not blown out
      const bright = 0.4 + Math.random() * 0.15
      colors[idx * 3]     = bright
      colors[idx * 3 + 1] = bright * (0.65 + Math.random() * 0.15)
      colors[idx * 3 + 2] = bright * (0.3 + Math.random() * 0.15)

      trail[idx] = 0
      idx++
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aOrbitRadius', new THREE.BufferAttribute(orbitRadius, 1))
    geo.setAttribute('aOrbitSpeed', new THREE.BufferAttribute(orbitSpeed, 1))
    geo.setAttribute('aOrbitPhase', new THREE.BufferAttribute(orbitPhase, 1))
    geo.setAttribute('aOrbitTiltX', new THREE.BufferAttribute(orbitTiltX, 1))
    geo.setAttribute('aOrbitTiltZ', new THREE.BufferAttribute(orbitTiltZ, 1))
    geo.setAttribute('aEccentricity', new THREE.BufferAttribute(eccentricity, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aTrail', new THREE.BufferAttribute(trail, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uSize: { value: 2.8 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  useEffect(() => {
    const canvas = gl.domElement
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height * 2 - 1)
      mouseRef.current = { x, y, active: 1 }
    }
    const onLeave = () => { mouseRef.current.active = 0 }
    window.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [gl])

  useFrame((_, delta) => {
    const mat = material as THREE.ShaderMaterial
    mat.uniforms.uTime.value += delta
    mat.uniforms.uMouse.value.x += (mouseRef.current.x - mat.uniforms.uMouse.value.x) * 0.08
    mat.uniforms.uMouse.value.y += (mouseRef.current.y - mat.uniforms.uMouse.value.y) * 0.08
    mat.uniforms.uMouseActive.value += (mouseRef.current.active - mat.uniforms.uMouseActive.value) * 0.06
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}

function PostFX() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)
  const bloomRef = useRef<UnrealBloomPass | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.0,   // strength - softer glow
      0.8,   // radius
      0.15,  // threshold - only brighter pixels bloom
    )
    composer.addPass(bloom)
    composer.setSize(size.width, size.height)
    composerRef.current = composer
    bloomRef.current = bloom

    return () => composer.dispose()
  }, [gl, scene, camera])

  useEffect(() => {
    if (composerRef.current && bloomRef.current) {
      composerRef.current.setSize(size.width, size.height)
      bloomRef.current.resolution.set(size.width, size.height)
    }
  }, [size.width, size.height])

  useFrame(() => {
    composerRef.current?.render()
  }, 1)

  return null
}

export default function ProjectsParticles({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', background: '#0a0010' }}
    >
      <Canvas
        camera={{ position: [0, 35, 110], fov: 55, near: 1, far: 500 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <OrbitalSystem />
        <PostFX />
      </Canvas>
    </div>
  )
}
