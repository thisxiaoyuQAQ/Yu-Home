'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// "Spectacular black hole" — multi-layer scene around the page text:
//  - Accretion disk: 4000 GPU points orbiting in spiral arms with curl-noise turbulence
//  - Infalling stream: spiral particles being sucked toward the horizon
//  - Photon ring: thin glowing halo at the photon sphere
//  - Event horizon: pitch-black sphere with a fresnel rim of hot light
//  - Lensed starfield: distant stars warped near the hole
//  - UnrealBloom postprocessing for the glow
//  - Mouse repulsion preserved from the original component

// -----------------------------------------------------------------------------
// Tunables
// -----------------------------------------------------------------------------
const DISK_PARTICLES = 4200
const STREAM_PARTICLES = 900
const STAR_COUNT = 600

const HORIZON_RADIUS = 110   // black sphere radius — clears the text area
const PHOTON_RADIUS  = 150   // bright photon ring radius
const INNER_RADIUS   = 175   // accretion disk inner edge
const OUTER_RADIUS   = 820   // accretion disk outer edge

const MOUSE_RADIUS = 160

const mouseState = { x: 0, y: 0, active: false }

// -----------------------------------------------------------------------------
// Shared GLSL noise — cheap 3D hash + value-noise blend
// -----------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z);
  }
`

// =============================================================================
// 1) ACCRETION DISK — orbiting + spiral arms + turbulent breathing
// =============================================================================
const DISK_VS = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  uniform float uMouseRadius;
  uniform float uInnerRadius;
  uniform float uOuterRadius;

  attribute vec4 aOrbit;  // (radius, angle0, angularSpeed, armOffset)
  attribute vec4 aShift;  // (sizeScale, wobbleAmp, wobbleFreq, brightness)

  varying vec3 vColor;
  varying float vT;
  varying float vBright;

  ${NOISE_GLSL}

  void main() {
    float radius       = aOrbit.x;
    float baseAngle    = aOrbit.y;
    float angularSpeed = aOrbit.z;
    float armOffset    = aOrbit.w;

    // Keplerian-style differential rotation: inner rings spin much faster.
    float rNorm = clamp((radius - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);
    float speedBoost = mix(3.2, 0.55, rNorm);
    float angle = baseAngle + uTime * angularSpeed * speedBoost;

    // Spiral arm winding — pulls particles into 3 logarithmic arms.
    float armPhase = angle * 3.0 + log(max(radius, 1.0)) * 1.8 + armOffset;
    float armPull  = sin(armPhase) * 0.45 + 0.55; // 0.1..1.0
    float r = radius + sin(uTime * 0.3 + armOffset) * 4.0;

    // Curl-noise turbulence in cylindrical space (radial + vertical wiggle).
    vec3 np = vec3(cos(angle) * r, 0.0, sin(angle) * r) * 0.005 + vec3(uTime * 0.08, 0.0, 0.0);
    float nz = noise3(np) - 0.5;
    float nr = noise3(np + vec3(11.3, 4.2, 7.7)) - 0.5;
    r += nr * 18.0;

    // Vertical thickness — disk is razor-thin at the rim, slightly puffier inside.
    float thickness = mix(28.0, 6.0, rNorm);
    float y = nz * thickness + sin(uTime * 0.9 + armOffset * 2.0) * aShift.y * 3.0;

    vec3 transformed = vec3(cos(angle) * r, y, sin(angle) * r);

    // Mouse repulsion (preserved).
    vec3 toParticle = transformed - uMouse;
    float md = length(toParticle);
    if (md < uMouseRadius && md > 0.0001) {
      float falloff = 1.0 - md / uMouseRadius;
      falloff = falloff * falloff;
      transformed += normalize(toParticle) * falloff * uMouseStrength;
    }

    // Color: white-hot near horizon → amber → magenta → deep violet at the rim.
    vT = rNorm;
    vec3 white  = vec3(1.00, 0.95, 0.80);
    vec3 amber  = vec3(1.00, 0.55, 0.15);
    vec3 magma  = vec3(0.85, 0.18, 0.45);
    vec3 violet = vec3(0.35, 0.15, 0.85);
    vec3 c1 = mix(white, amber,  smoothstep(0.0, 0.25, rNorm));
    vec3 c2 = mix(c1,    magma,  smoothstep(0.25, 0.6, rNorm));
    vColor   = mix(c2,    violet, smoothstep(0.6,  1.0, rNorm));

    // Brightness modulated by spiral arms (creates bright/dark bands).
    float breathe = 1.0 + sin(uTime * 1.6 + armOffset * 4.0) * 0.25;
    vBright = aShift.w * armPull * mix(2.0, 0.7, rNorm);

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aShift.x * breathe * uPixelRatio * (900.0 / -mvPosition.z);
  }
`

const DISK_FS = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vT;
  varying float vBright;

  void main() {
    vec2 c = gl_PointCoord.xy - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = exp(-d * 6.0) * 0.6;
    float alpha = (core * 0.9 + halo) * mix(0.95, 0.35, vT) * vBright;
    gl_FragColor = vec4(vColor * (1.0 + vBright * 0.6), alpha);
  }
`

function AccretionDisk() {
  const { gl } = useThree()

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(DISK_PARTICLES * 3)
    const orbit = new Float32Array(DISK_PARTICLES * 4)
    const shift = new Float32Array(DISK_PARTICLES * 4)

    for (let i = 0; i < DISK_PARTICLES; i++) {
      // Bias radius density toward the inner edge.
      const rNorm = Math.pow(Math.random(), 1.8)
      const radius = INNER_RADIUS + rNorm * (OUTER_RADIUS - INNER_RADIUS)
      const angle0 = Math.random() * Math.PI * 2

      orbit[i * 4]     = radius
      orbit[i * 4 + 1] = angle0
      orbit[i * 4 + 2] = 0.18 + Math.random() * 0.12
      orbit[i * 4 + 3] = Math.random() * Math.PI * 2

      shift[i * 4]     = 1.2 + Math.pow(Math.random(), 2.4) * 16
      shift[i * 4 + 1] = 0.4 + Math.random() * 1.2
      shift[i * 4 + 2] = 0.4 + Math.random() * 1.4
      shift[i * 4 + 3] = 0.4 + Math.random() * 0.8 // brightness jitter

      positions[i * 3]     = Math.cos(angle0) * radius
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle0) * radius
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aOrbit',   new THREE.BufferAttribute(orbit, 4))
    geo.setAttribute('aShift',   new THREE.BufferAttribute(shift, 4))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), OUTER_RADIUS * 1.6)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uMouse: { value: new THREE.Vector3(9999, 9999, 0) },
        uMouseStrength: { value: 0 },
        uMouseRadius: { value: MOUSE_RADIUS },
        uInnerRadius: { value: INNER_RADIUS },
        uOuterRadius: { value: OUTER_RADIUS },
      },
      vertexShader: DISK_VS,
      fragmentShader: DISK_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  return <points geometry={geometry} material={material} userData={{ kind: 'disk' }} />
}

// =============================================================================
// 2) INFALLING STREAM — spirals plunging toward the horizon
// =============================================================================
const STREAM_VS = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  uniform float uMouseRadius;
  uniform float uInnerRadius;
  uniform float uOuterRadius;

  attribute vec4 aStream; // (startRadius, angle0, speed, lifeOffset)
  attribute vec4 aShift;  // (sizeScale, _, _, _)

  varying vec3 vColor;
  varying float vLife;

  void main() {
    float startR = aStream.x;
    float angle0 = aStream.y;
    float speed  = aStream.z;
    float lifeOff= aStream.w;

    // Lifetime [0..1] — particle is born at the outer disk, falls to horizon, respawns.
    float life = fract(uTime * speed * 0.13 + lifeOff);
    vLife = life;

    // Radius shrinks following a power curve (accelerates near horizon).
    float r = mix(startR, uInnerRadius * 0.55, pow(life, 1.6));
    // Angle tightens — conservation of angular momentum cartoon.
    float angle = angle0 + life * 14.0;

    float y = sin(life * 8.0 + lifeOff * 6.28) * 6.0 * (1.0 - life);

    vec3 transformed = vec3(cos(angle) * r, y, sin(angle) * r);

    // Mouse repulsion.
    vec3 toParticle = transformed - uMouse;
    float md = length(toParticle);
    if (md < uMouseRadius && md > 0.0001) {
      float falloff = 1.0 - md / uMouseRadius;
      falloff = falloff * falloff;
      transformed += normalize(toParticle) * falloff * uMouseStrength;
    }

    // Color: starts amber, blueshifts as it falls in.
    vec3 cool = vec3(0.45, 0.75, 1.00); // doppler blueshift near horizon
    vec3 warm = vec3(1.00, 0.65, 0.25);
    vColor = mix(warm, cool, smoothstep(0.4, 1.0, life));

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aShift.x * uPixelRatio * (900.0 / -mvPosition.z) * mix(1.4, 0.5, life);
  }
`

const STREAM_FS = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vLife;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    // Fade in at birth, brighten as it accelerates inward.
    float alpha = core * smoothstep(0.0, 0.15, vLife) * mix(0.4, 1.2, vLife);
    gl_FragColor = vec4(vColor * (1.0 + vLife * 1.5), alpha);
  }
`

function InfallStream() {
  const { gl } = useThree()

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(STREAM_PARTICLES * 3)
    const stream = new Float32Array(STREAM_PARTICLES * 4)
    const shift = new Float32Array(STREAM_PARTICLES * 4)

    for (let i = 0; i < STREAM_PARTICLES; i++) {
      const startR = INNER_RADIUS + Math.random() * (OUTER_RADIUS - INNER_RADIUS) * 0.7
      const angle0 = Math.random() * Math.PI * 2
      stream[i * 4]     = startR
      stream[i * 4 + 1] = angle0
      stream[i * 4 + 2] = 0.7 + Math.random() * 1.6
      stream[i * 4 + 3] = Math.random()

      shift[i * 4]     = 2.5 + Math.random() * 4.0
      positions[i * 3]     = Math.cos(angle0) * startR
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle0) * startR
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aStream',  new THREE.BufferAttribute(stream, 4))
    geo.setAttribute('aShift',   new THREE.BufferAttribute(shift, 4))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), OUTER_RADIUS * 1.6)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uMouse: { value: new THREE.Vector3(9999, 9999, 0) },
        uMouseStrength: { value: 0 },
        uMouseRadius: { value: MOUSE_RADIUS },
        uInnerRadius: { value: INNER_RADIUS },
        uOuterRadius: { value: OUTER_RADIUS },
      },
      vertexShader: STREAM_VS,
      fragmentShader: STREAM_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  return <points geometry={geometry} material={material} userData={{ kind: 'stream' }} />
}

// =============================================================================
// 3) PHOTON RING — thin bright halo where light orbits the hole
// =============================================================================
function PhotonRing() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta
  })
  return (
    // Slightly oblate ring — looks lensed.
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[PHOTON_RADIUS - 6, PHOTON_RADIUS + 14, 256, 1]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          varying vec3 vLocal;
          void main() {
            vUv = uv;
            vLocal = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vLocal;
          void main() {
            // Radial falloff across the thin ring.
            float t = vUv.x;
            float core = exp(-pow((t - 0.32) * 9.0, 2.0));
            // Azimuthal flicker — Doppler beaming on the approaching side.
            float a = atan(vLocal.y, vLocal.x);
            float doppler = 0.55 + 0.45 * cos(a + uTime * 0.4);
            vec3 c = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.95, 0.85), doppler);
            float alpha = core * (0.6 + doppler * 0.8);
            gl_FragColor = vec4(c * (1.0 + doppler), alpha);
          }
        `}
      />
    </mesh>
  )
}

// =============================================================================
// 4) EVENT HORIZON — pitch-black sphere with hot fresnel rim
// =============================================================================
function EventHorizon() {
  return (
    <mesh>
      <sphereGeometry args={[HORIZON_RADIUS, 64, 64]} />
      <shaderMaterial
        transparent
        depthWrite
        uniforms={{}}
        vertexShader={/* glsl */ `
          varying vec3 vNormal;
          varying vec3 vViewPos;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewPos = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vNormal;
          varying vec3 vViewPos;
          void main() {
            vec3 V = normalize(-vViewPos);
            float fres = pow(1.0 - max(dot(V, vNormal), 0.0), 3.5);
            // Pure black interior, glowing rim.
            vec3 rim = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.9, 0.7), fres);
            gl_FragColor = vec4(rim * fres * 2.0, 1.0);
          }
        `}
      />
    </mesh>
  )
}

// =============================================================================
// 5) STARFIELD — lensed background stars
// =============================================================================
const STARS_VS = /* glsl */ `
  uniform float uPixelRatio;
  uniform float uTime;
  attribute float aSize;
  attribute float aTwinkle;
  varying float vTwinkle;
  void main() {
    vTwinkle = 0.6 + 0.4 * sin(uTime * 1.7 + aTwinkle * 6.28);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (1200.0 / -mv.z);
  }
`
const STARS_FS = /* glsl */ `
  precision highp float;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * vTwinkle, core * 0.85);
  }
`

function Starfield() {
  const { gl } = useThree()
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3)
    const sizes = new Float32Array(STAR_COUNT)
    const tw = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      // Spherical shell well behind the black hole.
      const u = Math.random(), v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const R = 1600 + Math.random() * 400
      positions[i * 3]     = R * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = R * Math.sin(phi) * Math.sin(theta) * 0.4 // flatten
      positions[i * 3 + 2] = R * Math.cos(phi) - 400
      sizes[i] = 1.0 + Math.pow(Math.random(), 3.0) * 4.0
      tw[i]    = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aTwinkle', new THREE.BufferAttribute(tw, 1))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: gl.getPixelRatio() },
        uTime: { value: 0 },
      },
      vertexShader: STARS_VS,
      fragmentShader: STARS_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry: geo, material: mat }
  }, [gl])
  return <points geometry={geometry} material={material} userData={{ kind: 'stars' }} />
}

// =============================================================================
// SCENE — animation loop drives every layer's uniforms + mouse repulsion
// =============================================================================
function BlackHoleScene() {
  const { gl, camera, size, scene } = useThree()
  const tiltRef = useRef<THREE.Group>(null)
  const mouseTargetRef = useRef(new THREE.Vector3(9999, 9999, 0))
  const mouseStrengthRef = useRef(0)

  useFrame((_, delta) => {
    const time = (mouseTargetRef.current.userData?.t ?? 0) + delta
    if (mouseTargetRef.current.userData) mouseTargetRef.current.userData.t = time

    // Update mouse world position (z=0 plane).
    if (mouseState.active) {
      const ndcX = (mouseState.x / size.width) * 2 - 1
      const ndcY = -((mouseState.y / size.height) * 2 - 1)
      const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera)
      const dir = v.sub(camera.position).normalize()
      const dist = -camera.position.z / dir.z
      const worldPos = camera.position.clone().add(dir.multiplyScalar(dist))
      mouseTargetRef.current.lerp(worldPos, 0.15)
      mouseStrengthRef.current += (45 - mouseStrengthRef.current) * 0.08
    } else {
      mouseStrengthRef.current += (0 - mouseStrengthRef.current) * 0.06
    }

    // Push uniforms into every layer that exposes them.
    scene.traverse((obj) => {
      const mat = (obj as THREE.Points).material as THREE.ShaderMaterial | undefined
      if (!mat || !mat.uniforms) return
      if (mat.uniforms.uTime) mat.uniforms.uTime.value += delta
      if (mat.uniforms.uMouse) mat.uniforms.uMouse.value.copy(mouseTargetRef.current)
      if (mat.uniforms.uMouseStrength) mat.uniforms.uMouseStrength.value = mouseStrengthRef.current
      if (mat.uniforms.uPixelRatio) mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    })

    // Disk tilt — gives the ring a 3D presence.
    if (tiltRef.current) {
      tiltRef.current.rotation.x = Math.PI * 0.32 + Math.sin(time * 0.12) * 0.05
      tiltRef.current.rotation.z = Math.cos(time * 0.09) * 0.04
    }
  })

  // init userData carrier for the time accumulator
  useEffect(() => {
    mouseTargetRef.current.userData = { t: 0 }
  }, [])

  return (
    <>
      <Starfield />
      <group ref={tiltRef}>
        <EventHorizon />
        <PhotonRing />
        <AccretionDisk />
        <InfallStream />
      </group>
    </>
  )
}

// =============================================================================
// Post-processing: UnrealBloom for the glow
// =============================================================================
function Bloom() {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      1.3, // strength
      0.85, // radius
      0.15, // threshold — low so the disk lights up
    )
    composer.addPass(bloom)
    composer.setSize(size.width, size.height)
    composer.setPixelRatio(gl.getPixelRatio())
    composerRef.current = composer
    return () => { composer.dispose() }
  }, [gl, scene, camera])

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height)
  }, [size.width, size.height])

  useFrame(() => {
    composerRef.current?.render()
  }, 1) // priority 1 → takes over rendering from R3F's default

  return null
}

// =============================================================================
// Wrapper component (mouse handlers preserved)
// =============================================================================
export default function AboutParticles({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseState.x = e.clientX - rect.left
    mouseState.y = e.clientY - rect.top
  }
  const handleMouseEnter = () => { mouseState.active = true }
  const handleMouseLeave = () => { mouseState.active = false }

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', background: '#05000a' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 950], fov: 55, near: 1, far: 4000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#05000a']} />
        <BlackHoleScene />
        <Bloom />
      </Canvas>
    </div>
  )
}
