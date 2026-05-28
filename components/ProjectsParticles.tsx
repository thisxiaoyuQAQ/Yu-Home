'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 1000
const SPIRAL_LAYERS = 6
const CONNECTION_DISTANCE = 70

// Hero-aligned palette: warm amber (inner layers) → deep purple (outer layers).
const AMBER  = new THREE.Color(255 / 255, 170 / 255, 60 / 255)
const PURPLE = new THREE.Color(110 / 255, 60 / 255, 230 / 255)

// Sentinel position keeps the mouse "far away" until a real pointer event
// places it. `active=false` alone wasn't enough: when the user scrolled away
// while inside the section, the leave event sometimes never fired, leaving
// stale (0, 0) coords that pulled every particle toward the screen's left edge.
const mouseState = { x: Infinity, y: Infinity, active: false }

function SpiralParticles() {
  const { camera, gl, size } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  // When the canvas is scrolled out of view and back, R3F sometimes keeps a
  // stale viewport. Force a recompute whenever the container size changes
  // so the right half doesn't get clipped on return.
  useEffect(() => {
    if (size.width === 0 || size.height === 0) return
    const cam = camera as THREE.PerspectiveCamera
    cam.aspect = size.width / size.height
    cam.updateProjectionMatrix()
    gl.setSize(size.width, size.height, false)
  }, [size.width, size.height, camera, gl])

  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const basePositions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const particleData: { layer: number; angle: number; radius: number; speed: number; direction: number }[] = []

    const particlesPerLayer = Math.floor(PARTICLE_COUNT / SPIRAL_LAYERS)

    for (let layer = 0; layer < SPIRAL_LAYERS; layer++) {
      const layerRadius = 120 + layer * 80
      const direction = layer % 2 === 0 ? 1 : -1
      const baseSpeed = 0.12 + Math.random() * 0.08
      const spiralTurns = 2.5 + layer * 0.6

      // Per-layer color along amber → purple ramp.
      const layerColor = new THREE.Color().lerpColors(AMBER, PURPLE, layer / (SPIRAL_LAYERS - 1))

      for (let i = 0; i < particlesPerLayer; i++) {
        const idx = layer * particlesPerLayer + i
        if (idx >= PARTICLE_COUNT) break

        const t = i / particlesPerLayer
        const angle = t * Math.PI * 2 * spiralTurns
        const heightOffset = (t - 0.5) * 300
        const radiusVariation = layerRadius + Math.sin(angle * 3) * 25

        const x = Math.cos(angle) * radiusVariation
        const y = heightOffset + Math.sin(angle * 2) * 40
        const z = Math.sin(angle) * radiusVariation * 0.5

        positions[idx * 3] = x
        positions[idx * 3 + 1] = y
        positions[idx * 3 + 2] = z

        basePositions[idx * 3] = x
        basePositions[idx * 3 + 1] = y
        basePositions[idx * 3 + 2] = z

        velocities[idx * 3] = 0
        velocities[idx * 3 + 1] = 0
        velocities[idx * 3 + 2] = 0

        // Slight per-particle hue jitter for organic variation.
        const jitter = (Math.random() - 0.5) * 0.15
        colors[idx * 3]     = THREE.MathUtils.clamp(layerColor.r + jitter, 0, 1)
        colors[idx * 3 + 1] = THREE.MathUtils.clamp(layerColor.g + jitter * 0.7, 0, 1)
        colors[idx * 3 + 2] = THREE.MathUtils.clamp(layerColor.b + jitter, 0, 1)

        particleData.push({
          layer,
          angle,
          radius: radiusVariation,
          speed: baseSpeed * (0.8 + Math.random() * 0.4),
          direction,
        })
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const linePositions = new Float32Array(30000 * 6)
    const lineColors = new Float32Array(30000 * 6)
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
    lineGeometry.setDrawRange(0, 0)

    return { positions, basePositions, velocities, colors, geometry, lineGeometry, linePositions, lineColors, particleData }
  }, [])

  const pointsMaterial = useMemo(() => new THREE.PointsMaterial({
    vertexColors: true,
    size: 3,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [])

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [])

  useFrame((_, delta) => {
    // Clamp delta — when the tab is backgrounded or the browser stalls,
    // a huge delta would advance newAngle by hundreds of radians in one frame
    // and the trig precision collapses, producing the "occasional jump" bug.
    const dt = Math.min(delta, 1 / 30)
    timeRef.current += dt
    const time = timeRef.current

    const { positions, basePositions, velocities, geometry, lineGeometry, linePositions, lineColors, particleData } = data

    // Skip the mouse math entirely if no real pointer is over the section.
    // This avoids the stale-coords drift that pulled the whole field leftward
    // after returning from another section.
    const hasMouse =
      mouseState.active &&
      Number.isFinite(mouseState.x) &&
      Number.isFinite(mouseState.y)

    let mousePos: THREE.Vector3 | null = null
    if (hasMouse) {
      const mouseWorldX = (mouseState.x / window.innerWidth) * 2 - 1
      const mouseWorldY = -(mouseState.y / window.innerHeight) * 2 + 1

      const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
      vector.unproject(camera)
      const dir = vector.sub(camera.position).normalize()
      const distance = -camera.position.z / dir.z
      mousePos = camera.position.clone().add(dir.multiplyScalar(distance))
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pd = particleData[i]
      if (!pd) continue

      // Wrap the accumulated angle into [0, 2π) so sin/cos stay in a precise range
      // even after many minutes — eliminates the late-stage position glitches.
      const rawAngle = pd.angle + time * pd.speed * pd.direction
      const newAngle = rawAngle - Math.floor(rawAngle / (Math.PI * 2)) * Math.PI * 2

      const layerRadius = 120 + pd.layer * 80
      const radiusVariation = layerRadius + Math.sin(newAngle * 3) * 25

      const baseX = Math.cos(newAngle) * radiusVariation
      const baseY = basePositions[i * 3 + 1] + Math.sin(time * 0.5 + pd.layer) * 10
      const baseZ = Math.sin(newAngle) * radiusVariation * 0.5

      let targetX = baseX
      let targetY = baseY
      let targetZ = baseZ

      if (mousePos) {
        const dx = baseX - mousePos.x
        const dy = baseY - mousePos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Guard the dist→0 division (was producing NaN bursts → particle pops).
        if (dist > 1 && dist < 150) {
          const norm = 1 - dist / 150
          const force = norm * norm * 40
          const twistAngle = norm * 0.5

          const cos = Math.cos(twistAngle)
          const sin = Math.sin(twistAngle)
          const rotatedX = baseX * cos - baseZ * sin
          const rotatedZ = baseX * sin + baseZ * cos

          targetX = rotatedX + (dx / dist) * force
          targetY = baseY + (dy / dist) * force
          targetZ = rotatedZ
        }
      }

      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2

      // Critical-damped follow: compute velocity then clamp to avoid teleport
      // when a layer wraps or a huge mouse step lands far from current position.
      let vx = (targetX - positions[ix]) * 0.08
      let vy = (targetY - positions[iy]) * 0.08
      let vz = (targetZ - positions[iz]) * 0.08

      const MAX_STEP = 12
      if (vx >  MAX_STEP) vx =  MAX_STEP
      if (vx < -MAX_STEP) vx = -MAX_STEP
      if (vy >  MAX_STEP) vy =  MAX_STEP
      if (vy < -MAX_STEP) vy = -MAX_STEP
      if (vz >  MAX_STEP) vz =  MAX_STEP
      if (vz < -MAX_STEP) vz = -MAX_STEP

      velocities[ix] = vx
      velocities[iy] = vy
      velocities[iz] = vz

      positions[ix] += vx
      positions[iy] += vy
      positions[iz] += vz
    }

    let lineCount = 0
    const maxLines = 30000
    const connDistSq = CONNECTION_DISTANCE * CONNECTION_DISTANCE

    for (let i = 0; i < PARTICLE_COUNT && lineCount < maxLines; i++) {
      const pd1 = particleData[i]
      if (!pd1) continue
      const ci = i * 3
      const cr = data.colors[ci]
      const cg = data.colors[ci + 1]
      const cb = data.colors[ci + 2]

      for (let j = i + 1; j < PARTICLE_COUNT && lineCount < maxLines; j++) {
        const pd2 = particleData[j]
        if (!pd2) continue

        if (Math.abs(pd1.layer - pd2.layer) > 1) continue

        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
        const distSq = dx * dx + dy * dy + dz * dz

        if (distSq < connDistSq) {
          const alpha = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.5

          const idx = lineCount * 6
          linePositions[idx]     = positions[i * 3]
          linePositions[idx + 1] = positions[i * 3 + 1]
          linePositions[idx + 2] = positions[i * 3 + 2]
          linePositions[idx + 3] = positions[j * 3]
          linePositions[idx + 4] = positions[j * 3 + 1]
          linePositions[idx + 5] = positions[j * 3 + 2]

          // Tint each endpoint by its own particle color, scaled by proximity.
          const cj = j * 3
          lineColors[idx]     = cr * alpha
          lineColors[idx + 1] = cg * alpha
          lineColors[idx + 2] = cb * alpha
          lineColors[idx + 3] = data.colors[cj]     * alpha
          lineColors[idx + 4] = data.colors[cj + 1] * alpha
          lineColors[idx + 5] = data.colors[cj + 2] * alpha

          lineCount++
        }
      }
    }

    geometry.attributes.position.needsUpdate = true
    lineGeometry.attributes.position.needsUpdate = true
    lineGeometry.attributes.color.needsUpdate = true
    lineGeometry.setDrawRange(0, lineCount * 2)

    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.02
      groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      <points geometry={data.geometry} material={pointsMaterial} />
      <lineSegments geometry={data.lineGeometry} material={lineMaterial} />
    </group>
  )
}

export default function ProjectsParticles({ className }: { className?: string }) {
  // Listen on the section itself instead of relying on enter/leave bubbling:
  // when the user scroll-snaps between sections, the leave handler is often
  // skipped, and the stale active state pulled the whole field to the left.
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      if (inside) {
        mouseState.x = e.clientX
        mouseState.y = e.clientY
        mouseState.active = true
      } else {
        mouseState.active = false
        mouseState.x = Infinity
        mouseState.y = Infinity
      }
    }
    const onLeave = () => {
      mouseState.active = false
      mouseState.x = Infinity
      mouseState.y = Infinity
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('blur', onLeave)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', background: '#0a0010' }}
    >
      <Canvas
        camera={{ position: [0, 0, 500], fov: 75 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        resize={{ scroll: true, debounce: 0 }}
      >
        <color attach="background" args={['#0a0010']} />
        <SpiralParticles />
      </Canvas>
    </div>
  )
}
