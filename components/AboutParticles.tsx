'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

// "Wormhole" — single diagonal channel sweeping behind the text.
//   - One long swirling tube of particles cuts diagonally across the page.
//   - No mouths, no end rings — just an open pipe that flows endlessly.
//   - Palette mirrors HeroParticles: warm amber core → deep purple rim.
//   - Mouse repulsion + UnrealBloom postprocessing preserved.

// -----------------------------------------------------------------------------
// Tunables
// -----------------------------------------------------------------------------
const TUNNEL_PARTICLES = 22000
const STAR_COUNT       = 700

// Channel endpoints — diagonal from bottom-left to top-right, extended past the
// screen so the tube reads as endless instead of capped.
const PATH_START = new THREE.Vector3(-1600, -800, -200)
const PATH_END   = new THREE.Vector3( 1600,  800,  200)

const TUBE_RADIUS  = 220
const MOUSE_RADIUS = 260

const mouseState = { x: 0, y: 0, active: false }

// -----------------------------------------------------------------------------
// Shared color palette (matches HeroParticles)
// -----------------------------------------------------------------------------
const PALETTE_GLSL = /* glsl */ `
  vec3 wormholePalette(float t) {
    vec3 amber  = vec3(255.0, 170.0,  60.0) / 255.0;
    vec3 white  = vec3(255.0, 230.0, 200.0) / 255.0;
    vec3 purple = vec3(110.0,  60.0, 230.0) / 255.0;
    vec3 deep   = vec3( 30.0,  10.0,  70.0) / 255.0;
    vec3 c = mix(amber, white,  smoothstep(0.0, 0.25, t));
    c       = mix(c,    purple, smoothstep(0.25, 0.80, t));
    c       = mix(c,    deep,   smoothstep(0.88, 1.0, t));
    return c;
  }
`

// =============================================================================
// TUNNEL FLOW — particles spiral along a diagonal axis from PATH_START → PATH_END
// =============================================================================
const TUNNEL_VS = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec3  uPathStart;
  uniform vec3  uPathEnd;
  uniform float uTubeRadius;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  uniform float uMouseRadius;

  // aPath: (lifeOffset, speed, spiralPhase, spiralTurns)
  // aTube: (radialOffset, radialWobbleAmp, radialWobbleFreq, sizeScale)
  attribute vec4 aPath;
  attribute vec4 aTube;

  varying vec3  vColor;
  varying float vLife;
  varying float vBright;

  ${PALETTE_GLSL}

  void main() {
    float lifeOff   = aPath.x;
    float speed     = aPath.y;
    float spiralPh  = aPath.z;
    float spiralTurns = aPath.w;

    // Loop life along the path.
    float life = fract(uTime * speed * 0.06 + lifeOff);
    vLife = life;

    // Straight diagonal axis.
    vec3 axis = uPathEnd - uPathStart;
    vec3 T    = normalize(axis);
    vec3 center = uPathStart + axis * life;

    // Stable frame around the tangent.
    vec3 up = abs(T.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 N  = normalize(cross(T, up));
    vec3 B  = normalize(cross(T, N));

    // Swirl: more turns over the length of the tube → reads as wormhole spin.
    float swirl = spiralPh + uTime * 0.7 + life * spiralTurns;
    float rWobble = sin(uTime * aTube.z + spiralPh) * aTube.y;
    float radius  = (aTube.x + rWobble) * uTubeRadius;

    vec3 offset = (cos(swirl) * N + sin(swirl) * B) * radius;
    vec3 transformed = center + offset;

    // Mouse repulsion.
    vec3 toParticle = transformed - uMouse;
    float md = length(toParticle);
    if (md < uMouseRadius && md > 0.0001) {
      float falloff = 1.0 - md / uMouseRadius;
      falloff = falloff * falloff;
      transformed += normalize(toParticle) * falloff * uMouseStrength;
    }

    // Color travels through the palette as the particle rides the tube.
    vColor = wormholePalette(life);

    // Brightness pulses with the swirl — fakes light bands along the channel.
    float band = 0.6 + 0.4 * sin(swirl * 0.5 + life * 12.0);
    vBright = band * (0.8 + 0.4 * sin(life * 6.28318));

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aTube.w * uPixelRatio * (700.0 / -mvPosition.z);
  }
`

const TUNNEL_FS = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vLife;
  varying float vBright;

  void main() {
    vec2 c = gl_PointCoord.xy - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float halo = exp(-d * 5.5) * 0.4;
    float alpha = (core * 0.95 + halo) * vBright * 0.75;
    gl_FragColor = vec4(vColor * (1.0 + vBright * 0.4), alpha);
  }
`

function TunnelFlow() {
  const { gl } = useThree()

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(TUNNEL_PARTICLES * 3)
    const path = new Float32Array(TUNNEL_PARTICLES * 4)
    const tube = new Float32Array(TUNNEL_PARTICLES * 4)

    for (let i = 0; i < TUNNEL_PARTICLES; i++) {
      path[i * 4]     = Math.random()                         // life offset
      path[i * 4 + 1] = 0.55 + Math.random() * 0.9            // speed
      path[i * 4 + 2] = Math.random() * Math.PI * 2           // spiral phase
      path[i * 4 + 3] = 24 + Math.random() * 18               // spiral turns over the tube

      tube[i * 4]     = 0.45 + Math.random() * 0.75           // base radial offset (wider spread)
      tube[i * 4 + 1] = 0.08 + Math.random() * 0.25           // wobble amplitude
      tube[i * 4 + 2] = 0.4 + Math.random() * 1.6             // wobble freq
      tube[i * 4 + 3] = 2.6 + Math.pow(Math.random(), 2.0) * 9 // point size scale (thicker)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aPath',    new THREE.BufferAttribute(path, 4))
    geo.setAttribute('aTube',    new THREE.BufferAttribute(tube, 4))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3000)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uPathStart: { value: PATH_START.clone() },
        uPathEnd:   { value: PATH_END.clone() },
        uTubeRadius: { value: TUBE_RADIUS },
        uMouse: { value: new THREE.Vector3(9999, 9999, 0) },
        uMouseStrength: { value: 0 },
        uMouseRadius: { value: MOUSE_RADIUS },
      },
      vertexShader: TUNNEL_VS,
      fragmentShader: TUNNEL_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  return <points geometry={geometry} material={material} userData={{ kind: 'tunnel' }} />
}

// =============================================================================
// STARFIELD — distant ambient stars
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
    gl_FragColor = vec4(vec3(0.85, 0.8, 1.0) * vTwinkle, core * 0.75);
  }
`

function Starfield() {
  const { gl } = useThree()
  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3)
    const sizes = new Float32Array(STAR_COUNT)
    const tw = new Float32Array(STAR_COUNT)
    for (let i = 0; i < STAR_COUNT; i++) {
      const u = Math.random(), v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const R = 1700 + Math.random() * 500
      positions[i * 3]     = R * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = R * Math.sin(phi) * Math.sin(theta) * 0.45
      positions[i * 3 + 2] = R * Math.cos(phi) - 500
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
// SCENE — drives uniforms, mouse repulsion, gentle breathing
// =============================================================================
function WormholeScene() {
  const { gl, camera, size, scene } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const mouseTargetRef = useRef(new THREE.Vector3(9999, 9999, 0))
  const mouseStrengthRef = useRef(0)
  const tRef = useRef(0)

  useFrame((_, delta) => {
    tRef.current += delta

    if (mouseState.active) {
      const ndcX = (mouseState.x / size.width) * 2 - 1
      const ndcY = -((mouseState.y / size.height) * 2 - 1)
      const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera)
      const dir = v.sub(camera.position).normalize()
      const dist = -camera.position.z / dir.z
      const worldPos = camera.position.clone().add(dir.multiplyScalar(dist))
      mouseTargetRef.current.lerp(worldPos, 0.15)
      mouseStrengthRef.current += (90 - mouseStrengthRef.current) * 0.08
    } else {
      mouseStrengthRef.current += (0 - mouseStrengthRef.current) * 0.06
    }

    scene.traverse((obj) => {
      const mat = (obj as THREE.Points).material as THREE.ShaderMaterial | undefined
      if (!mat || !mat.uniforms) return
      if (mat.uniforms.uTime) mat.uniforms.uTime.value += delta
      if (mat.uniforms.uMouse) mat.uniforms.uMouse.value.copy(mouseTargetRef.current)
      if (mat.uniforms.uMouseStrength) mat.uniforms.uMouseStrength.value = mouseStrengthRef.current
      if (mat.uniforms.uPixelRatio) mat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    })

    if (groupRef.current) {
      groupRef.current.rotation.x = Math.sin(tRef.current * 0.18) * 0.04
      groupRef.current.rotation.y = Math.cos(tRef.current * 0.13) * 0.04
    }
  })

  return (
    <>
      <Starfield />
      <group ref={groupRef}>
        <TunnelFlow />
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
      1.15, 0.9, 0.12,
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
  }, 1)

  return null
}

// =============================================================================
// Wrapper
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
      style={{ width: '100%', height: '100%', background: '#0a0010' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 950], fov: 55, near: 1, far: 4000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <WormholeScene />
        <Bloom />
      </Canvas>
    </div>
  )
}
