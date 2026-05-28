'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Knowledge Matrix Rain — Hero-aligned aesthetic:
//  - column grid streaming downward via per-column GPU phase (CPU never touches positions)
//  - per-particle (shift) wobble matching HeroParticles' (phaseA, phaseB, frequency, amplitude)
//  - amber→purple vertical gradient, AdditiveBlending, depthWrite:false
//  - mouse repulsion done in the vertex shader against a world-space uniform

const COLUMNS = 80
const ROWS = 130
const TOTAL = COLUMNS * ROWS

const SPREAD_X = 2400
const SPREAD_Y = 1400
const MOUSE_RADIUS = 200

export const skillsMouseState = { x: 0, y: 0, active: false }

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec2  uMouse;
  uniform float uMouseActive;
  uniform float uSpreadX;
  uniform float uSpreadY;

  attribute float aSize;
  attribute vec4  aShift;   // (phaseA, phaseB, frequency, amplitude)
  attribute vec3  aDrift;   // (dirX, dirY, speed) — per-particle free drift

  varying vec3  vColor;
  varying float vGlow;

  const float PI2 = 6.2831853;

  void main() {
    // Hero-style per-particle wobble (independent tiny sphere walk).
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.a * 8.0;

    // Free chaotic drift — every particle moves in its own direction at its own speed.
    vec3 transformed = position + wobble;
    transformed.x += aDrift.x * aDrift.z * uTime * 30.0;
    transformed.y += aDrift.y * aDrift.z * uTime * 30.0;

    // Wrap across the canvas so the field stays full edge-to-edge.
    transformed.x = mod(transformed.x + uSpreadX * 0.5, uSpreadX) - uSpreadX * 0.5;
    transformed.y = mod(transformed.y + uSpreadY * 0.5, uSpreadY) - uSpreadY * 0.5;

    // Mouse repulsion in world XY plane.
    vec2 toMouse = transformed.xy - uMouse;
    float dist = length(toMouse);
    float push = (1.0 - smoothstep(0.0, ${MOUSE_RADIUS.toFixed(1)}, dist)) * uMouseActive;
    transformed.xy += normalize(toMouse + vec2(0.0001)) * push * 60.0;

    // Vertical color blend: amber top → deep purple bottom.
    float t = clamp((transformed.y + uSpreadY * 0.5) / uSpreadY, 0.0, 1.0);
    vec3 amber  = vec3(255.0, 170.0, 60.0)  / 255.0;
    vec3 purple = vec3(110.0, 60.0, 230.0)  / 255.0;
    vColor = mix(purple, amber, t);
    vGlow = 0.8 + push * 0.6;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (600.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * vGlow;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function MatrixRainPoints() {
  const { camera, size, gl } = useThree()
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const mouseWorld = useRef(new THREE.Vector3())

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3)
    const sizes = new Float32Array(TOTAL)
    const shift = new Float32Array(TOTAL * 4)
    const drift = new Float32Array(TOTAL * 3)

    for (let i = 0; i < TOTAL; i++) {
      // Uniform random placement across the full canvas — no column structure.
      const x = (Math.random() - 0.5) * SPREAD_X
      const y = (Math.random() - 0.5) * SPREAD_Y
      const z = (Math.random() - 0.5) * 80

      positions[i * 3]     = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      sizes[i] = Math.random() * 0.7 + 0.35

      shift[i * 4]     = Math.random() * Math.PI
      shift[i * 4 + 1] = Math.random() * Math.PI * 2
      shift[i * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      shift[i * 4 + 3] = Math.random() * 1.6 + 0.4

      // Per-particle drift: random direction on unit circle, random speed.
      const angle = Math.random() * Math.PI * 2
      drift[i * 3]     = Math.cos(angle)
      drift[i * 3 + 1] = Math.sin(angle)
      drift[i * 3 + 2] = 0.3 + Math.random() * 1.4
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))
    geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 3))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 4.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uMouse: { value: new THREE.Vector2(99999, 99999) },
        uMouseActive: { value: 0 },
        uSpreadX: { value: SPREAD_X },
        uSpreadY: { value: SPREAD_Y },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geo, material: mat }
  }, [gl])

  materialRef.current = material as THREE.ShaderMaterial

  useFrame((_, delta) => {
    const mat = material as THREE.ShaderMaterial
    mat.uniforms.uTime.value += delta
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    // Unproject mouse into the z=0 plane (matches particle local space since group is at origin).
    const ndcX = (skillsMouseState.x / size.width) * 2 - 1
    const ndcY = -(skillsMouseState.y / size.height) * 2 + 1
    const vec = mouseWorld.current.set(ndcX, ndcY, 0.5)
    vec.unproject(camera)
    const dir = vec.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const world = camera.position.clone().add(dir.multiplyScalar(distance))

    mat.uniforms.uMouse.value.set(world.x, world.y)
    const targetActive = skillsMouseState.active ? 1 : 0
    mat.uniforms.uMouseActive.value += (targetActive - mat.uniforms.uMouseActive.value) * 0.1
  })

  return <points geometry={geometry} material={material} />
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
        <MatrixRainPoints />
      </Canvas>
    </div>
  )
}
