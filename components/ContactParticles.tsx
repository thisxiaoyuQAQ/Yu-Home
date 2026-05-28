'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Constellation network — companion piece to HeroParticles.
// Shares the warm-amber → deep-purple palette, per-particle GPU wobble,
// additive blending and lerp'd parallax tilt. Adds dynamic line links
// between nearby stars plus larger, breathing "main" stars.

const PARTICLE_COUNT = 600
const MAIN_STAR_COUNT = 12
const SPACE_X = 16
const SPACE_Y = 10
const SPACE_Z = 6
const CONNECTION_DISTANCE = 2.4
const MOUSE_INFLUENCE_RADIUS = 3
const MOUSE_ATTRACTION_STRENGTH = 0.02
const MOUSE_PARALLAX = 0.12

const STAR_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;

  attribute float aSize;
  attribute vec4  aShift;   // (phaseA, phaseB, frequency, amplitude)
  attribute float aDepth;   // 0..1 → palette mix

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

    vec3 core = vec3(255.0, 170.0, 60.0)  / 255.0; // amber
    vec3 rim  = vec3(110.0, 60.0, 230.0)  / 255.0; // deep purple
    vColor = mix(core, rim, clamp(aDepth, 0.0, 1.0));

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (110.0 / -mvPosition.z);
  }
`

const STAR_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d) * 0.55 + 0.12;
    gl_FragColor = vec4(vColor, alpha);
  }
`

const MAIN_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPulse;

  attribute float aSize;
  attribute float aPhase;
  attribute float aDepth;

  varying vec3 vColor;
  varying float vPulse;

  void main() {
    vec3 core = vec3(255.0, 200.0, 110.0) / 255.0;
    vec3 rim  = vec3(150.0, 90.0, 240.0)  / 255.0;
    vColor = mix(core, rim, clamp(aDepth, 0.0, 1.0));

    vPulse = 0.6 + 0.4 * sin(uTime * 1.4 + aPhase);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * uPulse * (180.0 / -mvPosition.z);
  }
`

const MAIN_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vPulse;

  void main() {
    vec2 uv = gl_PointCoord.xy - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    // Double-layer glow: tight hot core + soft halo.
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.12, d) * 0.55;
    float alpha = (core + halo) * vPulse;
    gl_FragColor = vec4(vColor, alpha);
  }
`

interface SystemProps {
  mouse: React.MutableRefObject<THREE.Vector2>
  active: React.MutableRefObject<boolean>
}

function ConstellationSystem({ mouse, active }: SystemProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { gl, viewport } = useThree()

  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const original = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const shift = new Float32Array(PARTICLE_COUNT * 4)
    const depth = new Float32Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      const x = (Math.random() - 0.5) * SPACE_X
      const y = (Math.random() - 0.5) * SPACE_Y
      const z = (Math.random() - 0.5) * SPACE_Z

      positions[i3] = x
      positions[i3 + 1] = y
      positions[i3 + 2] = z
      original[i3] = x
      original[i3 + 1] = y
      original[i3 + 2] = z

      velocities[i3] = (Math.random() - 0.5) * 0.002
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.002
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.001

      sizes[i] = 1.2 + Math.random() * 1.4
      shift[i * 4]     = Math.random() * Math.PI
      shift[i * 4 + 1] = Math.random() * Math.PI * 2
      shift[i * 4 + 2] = (Math.random() * 0.6 + 0.1) * Math.PI * 0.08
      shift[i * 4 + 3] = Math.random() * 0.18 + 0.05
      // Depth 0 (front, amber) → 1 (back, purple)
      depth[i] = (z + SPACE_Z * 0.5) / SPACE_Z
    }

    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    starGeo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))
    starGeo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1))

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 2.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Main stars — sample a subset of particle indices.
    const mainIndices: number[] = []
    const used = new Set<number>()
    while (mainIndices.length < MAIN_STAR_COUNT) {
      const k = Math.floor(Math.random() * PARTICLE_COUNT)
      if (!used.has(k)) {
        used.add(k)
        mainIndices.push(k)
      }
    }

    const mainPos = new Float32Array(MAIN_STAR_COUNT * 3)
    const mainSizes = new Float32Array(MAIN_STAR_COUNT)
    const mainPhase = new Float32Array(MAIN_STAR_COUNT)
    const mainDepth = new Float32Array(MAIN_STAR_COUNT)
    for (let i = 0; i < MAIN_STAR_COUNT; i++) {
      mainSizes[i] = 22 + Math.random() * 14
      mainPhase[i] = Math.random() * Math.PI * 2
      mainDepth[i] = depth[mainIndices[i]]
    }
    const mainGeo = new THREE.BufferGeometry()
    mainGeo.setAttribute('position', new THREE.BufferAttribute(mainPos, 3))
    mainGeo.setAttribute('aSize', new THREE.BufferAttribute(mainSizes, 1))
    mainGeo.setAttribute('aPhase', new THREE.BufferAttribute(mainPhase, 1))
    mainGeo.setAttribute('aDepth', new THREE.BufferAttribute(mainDepth, 1))

    const mainMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uPulse: { value: 1.0 },
      },
      vertexShader: MAIN_VERT,
      fragmentShader: MAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    // Line buffers — capacity heuristic, ~8 neighbours per star.
    const maxLines = PARTICLE_COUNT * 8
    const linePositions = new Float32Array(maxLines * 6)
    const lineColors = new Float32Array(maxLines * 6)
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    return {
      positions,
      velocities,
      original,
      depth,
      starGeo,
      starMat,
      mainGeo,
      mainMat,
      mainIndices,
      lineGeo,
      lineMat,
      linePositions,
      lineColors,
      maxLines,
    }
  }, [gl])

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const t = (data.starMat.uniforms.uTime.value += delta * Math.PI * 0.5)
    data.mainMat.uniforms.uTime.value = time
    data.starMat.uniforms.uPixelRatio.value = gl.getPixelRatio()
    data.mainMat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    const posArray = data.positions
    const vel = data.velocities
    const orig = data.original

    const mouseX = (mouse.current.x * viewport.width) / 2
    const mouseY = (mouse.current.y * viewport.height) / 2

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3

      posArray[i3]     += vel[i3]
      posArray[i3 + 1] += vel[i3 + 1]
      posArray[i3 + 2] += vel[i3 + 2]

      if (active.current) {
        const dx = mouseX - posArray[i3]
        const dy = mouseY - posArray[i3 + 1]
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_INFLUENCE_RADIUS && dist > 0.1) {
          const force = (MOUSE_INFLUENCE_RADIUS - dist) / MOUSE_INFLUENCE_RADIUS
          posArray[i3]     += dx * force * MOUSE_ATTRACTION_STRENGTH
          posArray[i3 + 1] += dy * force * MOUSE_ATTRACTION_STRENGTH
        }
      }

      const ret = 0.001
      posArray[i3]     += (orig[i3]     - posArray[i3])     * ret
      posArray[i3 + 1] += (orig[i3 + 1] - posArray[i3 + 1]) * ret
      posArray[i3 + 2] += (orig[i3 + 2] - posArray[i3 + 2]) * ret

      if (Math.abs(posArray[i3])     > SPACE_X * 0.6) vel[i3]     *= -1
      if (Math.abs(posArray[i3 + 1]) > SPACE_Y * 0.6) vel[i3 + 1] *= -1
      if (Math.abs(posArray[i3 + 2]) > SPACE_Z * 0.6) vel[i3 + 2] *= -1
    }

    ;(data.starGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true

    // Lines — depth-mixed warm→purple per endpoint.
    const linePos = data.linePositions
    const lineCol = data.lineColors
    const timeOffset = time * 0.3
    let lineIndex = 0
    const coreR = 1.0, coreG = 0.78, coreB = 0.4
    const rimR  = 0.55, rimG = 0.35, rimB = 0.95

    outer: for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const i3 = i * 3, j3 = j * 3
        const dx = posArray[i3]     - posArray[j3]
        const dy = posArray[i3 + 1] - posArray[j3 + 1]
        const dz = posArray[i3 + 2] - posArray[j3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const threshold = CONNECTION_DISTANCE *
          (0.85 + 0.35 * Math.sin(timeOffset + i * 0.1 + j * 0.05))

        if (dist < threshold) {
          const li = lineIndex * 6
          linePos[li]     = posArray[i3]
          linePos[li + 1] = posArray[i3 + 1]
          linePos[li + 2] = posArray[i3 + 2]
          linePos[li + 3] = posArray[j3]
          linePos[li + 4] = posArray[j3 + 1]
          linePos[li + 5] = posArray[j3 + 2]

          const di = data.depth[i]
          const dj = data.depth[j]
          lineCol[li]     = coreR + (rimR - coreR) * di
          lineCol[li + 1] = coreG + (rimG - coreG) * di
          lineCol[li + 2] = coreB + (rimB - coreB) * di
          lineCol[li + 3] = coreR + (rimR - coreR) * dj
          lineCol[li + 4] = coreG + (rimG - coreG) * dj
          lineCol[li + 5] = coreB + (rimB - coreB) * dj

          lineIndex++
          if (lineIndex >= data.maxLines) break outer
        }
      }
    }
    ;(data.lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(data.lineGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true
    data.lineGeo.setDrawRange(0, lineIndex * 2)

    // Sync main star positions.
    const mainPosArr = data.mainGeo.attributes.position.array as Float32Array
    for (let i = 0; i < MAIN_STAR_COUNT; i++) {
      const src = data.mainIndices[i] * 3
      mainPosArr[i * 3]     = posArray[src]
      mainPosArr[i * 3 + 1] = posArray[src + 1]
      mainPosArr[i * 3 + 2] = posArray[src + 2]
    }
    ;(data.mainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true

    // Parallax tilt — lerp toward mouse-driven targets.
    if (groupRef.current) {
      const targetX = mouse.current.y * MOUSE_PARALLAX
      const targetY = mouse.current.x * MOUSE_PARALLAX
      groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.04
      groupRef.current.rotation.y += (targetY - groupRef.current.rotation.y) * 0.04
    }

    // Silence unused-var warning.
    void t
  })

  return (
    <group ref={groupRef}>
      <points geometry={data.starGeo} material={data.starMat} />
      <lineSegments geometry={data.lineGeo} material={data.lineMat} />
      <points geometry={data.mainGeo} material={data.mainMat} />
    </group>
  )
}

export default function ContactParticles() {
  const mouse = useRef(new THREE.Vector2(0, 0))
  const active = useRef(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  const handleMouseEnter = () => { active.current = true }
  const handleMouseLeave = () => { active.current = false }

  return (
    <div
      className="absolute inset-0 z-0"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#0a0010']} />
        <ConstellationSystem mouse={mouse} active={active} />
      </Canvas>
    </div>
  )
}
