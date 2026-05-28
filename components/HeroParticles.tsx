'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Galaxy modeled on actium.co.jp's first-view scene:
//  - thin disk of stars with cylindrical-radius bias toward the rim
//  - sparse spherical halo around the core
//  - per-particle (shift) wobble done entirely in the vertex shader
//  - 2-color radial gradient: warm amber core → cool purple rim
//
// All motion happens on the GPU via a custom ShaderMaterial. The CPU
// only ticks one time uniform and the group rotation — cheap at 75k pts.

const HALO_COUNT = 40000
const DISK_COUNT = 90000
const TOTAL = HALO_COUNT + DISK_COUNT

const INNER_RADIUS = 10
const OUTER_RADIUS = 40
const DISK_HEIGHT = 2
const HALO_RADIUS = 10

const MOUSE_PARALLAX = 0.18

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;

  attribute float aSize;
  attribute vec4  aShift; // (phaseA, phaseB, frequency, amplitude)

  varying vec3 vColor;

  const float PI2 = 6.2831853;

  void main() {
    // Per-particle wobble — every star drifts on its own tiny sphere.
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.a;

    vec3 transformed = position + wobble;

    // Color by normalized cylindrical distance: warm core → cool rim.
    float d = length(abs(position) / vec3(40.0, 10.0, 40.0));
    d = clamp(d, 0.0, 1.0);
    vec3 core = vec3(255.0, 170.0, 60.0)  / 255.0; // amber
    vec3 rim  = vec3(110.0, 60.0, 230.0)  / 255.0; // deep purple
    vColor = mix(core, rim, d);

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Perspective-scaled point size.
    gl_PointSize = uSize * aSize * uPixelRatio * (110.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    // Sharper falloff so each star reads as a crisp dot rather than a blob,
    // since density is now high enough to carry the glow by accumulation.
    float alpha = smoothstep(0.5, 0.0, d) * 0.35 + 0.15;
    gl_FragColor = vec4(vColor, alpha);
  }
`

function GalaxyPoints() {
  const groupRef = useRef<THREE.Group>(null)
  const { size, gl } = useThree()
  const mouseRef = useRef({ x: 0, y: 0 })

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3)
    const sizes = new Float32Array(TOTAL)
    const shift = new Float32Array(TOTAL * 4)

    const tmp = new THREE.Vector3()

    // Halo — thin spherical shell.
    for (let i = 0; i < HALO_COUNT; i++) {
      tmp.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize().multiplyScalar(Math.random() * 0.5 + HALO_RADIUS)
      positions[i * 3] = tmp.x
      positions[i * 3 + 1] = tmp.y
      positions[i * 3 + 2] = tmp.z

      sizes[i] = Math.random() * 0.7 + 0.25
      shift[i * 4]     = Math.random() * Math.PI
      shift[i * 4 + 1] = Math.random() * Math.PI * 2
      shift[i * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      shift[i * 4 + 3] = Math.random() * 0.9 + 0.1
    }

    // Disk — cylindrical radius biased toward the rim, then flattened.
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

    return { geometry: geo, material: mat }
  }, [gl])

  useFrame((_, delta) => {
    const mat = material as THREE.ShaderMaterial
    const t = (mat.uniforms.uTime.value += delta * Math.PI * 0.5)
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.04

      const targetX = mouseRef.current.y * MOUSE_PARALLAX
      const targetZ = 0.2 + mouseRef.current.x * MOUSE_PARALLAX * 0.5
      groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.04
      groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 0.04
    }

    const m = (window as unknown as { __galaxyMouse?: { x: number; y: number } }).__galaxyMouse
    if (m) {
      mouseRef.current.x = (m.x / size.width) * 2 - 1
      mouseRef.current.y = -((m.y / size.height) * 2 - 1)
    }
  })

  return (
    <group ref={groupRef} rotation={[0, 0, 0.2]}>
      <points geometry={geometry} material={material} />
    </group>
  )
}

export default function HeroParticles({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    ;(window as unknown as { __galaxyMouse: { x: number; y: number } }).__galaxyMouse = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', background: '#0a0010' }}
      onMouseMove={handleMouseMove}
    >
      <Canvas
        camera={{ position: [0, 4, 22], fov: 60, near: 1, far: 1000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <GalaxyPoints />
      </Canvas>
    </div>
  )
}
