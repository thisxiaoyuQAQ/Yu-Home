'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 400
const MAIN_STAR_COUNT = 8
const CONNECTION_DISTANCE = 2.5
const MOUSE_INFLUENCE_RADIUS = 3
const MOUSE_ATTRACTION_STRENGTH = 0.02

interface ParticleSystemProps {
  mouse: React.MutableRefObject<THREE.Vector2>
}

function ParticleSystem({ mouse }: ParticleSystemProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const mainStarsRef = useRef<THREE.Points>(null)
  const { viewport } = useThree()

  const { positions, velocities, originalPositions, mainStarIndices } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3)
    const vel = new Float32Array(PARTICLE_COUNT * 3)
    const origPos = new Float32Array(PARTICLE_COUNT * 3)
    const mainIndices = new Set<number>()

    while (mainIndices.size < MAIN_STAR_COUNT) {
      mainIndices.add(Math.floor(Math.random() * PARTICLE_COUNT))
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3
      pos[i3] = (Math.random() - 0.5) * 16
      pos[i3 + 1] = (Math.random() - 0.5) * 10
      pos[i3 + 2] = (Math.random() - 0.5) * 6

      origPos[i3] = pos[i3]
      origPos[i3 + 1] = pos[i3 + 1]
      origPos[i3 + 2] = pos[i3 + 2]

      vel[i3] = (Math.random() - 0.5) * 0.002
      vel[i3 + 1] = (Math.random() - 0.5) * 0.002
      vel[i3 + 2] = (Math.random() - 0.5) * 0.001
    }

    return {
      positions: pos,
      velocities: vel,
      originalPositions: origPos,
      mainStarIndices: mainIndices,
    }
  }, [])

  const mainStarPositions = useMemo(() => {
    const pos = new Float32Array(MAIN_STAR_COUNT * 3)
    return pos
  }, [])

  const linePositions = useMemo(() => {
    return new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6)
  }, [])

  const lineColors = useMemo(() => {
    return new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6)
  }, [])

  const particleSizes = useMemo(() => {
    const sizes = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = mainStarIndices.has(i) ? 4 : 1.5 + Math.random() * 1
    }
    return sizes
  }, [mainStarIndices])

  useFrame((state) => {
    if (!pointsRef.current || !linesRef.current || !mainStarsRef.current) return

    const time = state.clock.elapsedTime
    const positionAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const posArray = positionAttr.array as Float32Array

    const mouseX = (mouse.current.x * viewport.width) / 2
    const mouseY = (mouse.current.y * viewport.height) / 2

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3

      posArray[i3] += velocities[i3]
      posArray[i3 + 1] += velocities[i3 + 1]
      posArray[i3 + 2] += velocities[i3 + 2]

      const dx = mouseX - posArray[i3]
      const dy = mouseY - posArray[i3 + 1]
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < MOUSE_INFLUENCE_RADIUS && dist > 0.1) {
        const force = (MOUSE_INFLUENCE_RADIUS - dist) / MOUSE_INFLUENCE_RADIUS
        posArray[i3] += dx * force * MOUSE_ATTRACTION_STRENGTH
        posArray[i3 + 1] += dy * force * MOUSE_ATTRACTION_STRENGTH
      }

      const returnStrength = 0.001
      posArray[i3] += (originalPositions[i3] - posArray[i3]) * returnStrength
      posArray[i3 + 1] += (originalPositions[i3 + 1] - posArray[i3 + 1]) * returnStrength
      posArray[i3 + 2] += (originalPositions[i3 + 2] - posArray[i3 + 2]) * returnStrength

      if (Math.abs(posArray[i3]) > 10) velocities[i3] *= -1
      if (Math.abs(posArray[i3 + 1]) > 6) velocities[i3 + 1] *= -1
      if (Math.abs(posArray[i3 + 2]) > 4) velocities[i3 + 2] *= -1
    }

    positionAttr.needsUpdate = true

    let lineIndex = 0
    const lineGeo = linesRef.current.geometry
    const linePosAttr = lineGeo.attributes.position as THREE.BufferAttribute
    const lineColAttr = lineGeo.attributes.color as THREE.BufferAttribute
    const linePosArray = linePosAttr.array as Float32Array
    const lineColArray = lineColAttr.array as Float32Array

    const timeOffset = time * 0.3

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const i3 = i * 3
        const j3 = j * 3

        const dx = posArray[i3] - posArray[j3]
        const dy = posArray[i3 + 1] - posArray[j3 + 1]
        const dz = posArray[i3 + 2] - posArray[j3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        const connectionThreshold = CONNECTION_DISTANCE * (0.8 + 0.4 * Math.sin(timeOffset + i * 0.1 + j * 0.05))

        if (dist < connectionThreshold && lineIndex < linePosArray.length / 6) {
          const li = lineIndex * 6

          linePosArray[li] = posArray[i3]
          linePosArray[li + 1] = posArray[i3 + 1]
          linePosArray[li + 2] = posArray[i3 + 2]
          linePosArray[li + 3] = posArray[j3]
          linePosArray[li + 4] = posArray[j3 + 1]
          linePosArray[li + 5] = posArray[j3 + 2]

          const alpha = 1 - dist / connectionThreshold
          const warmWhite = 0.95 + Math.sin(time + i) * 0.05

          lineColArray[li] = warmWhite
          lineColArray[li + 1] = warmWhite * 0.95
          lineColArray[li + 2] = warmWhite * 0.9
          lineColArray[li + 3] = warmWhite
          lineColArray[li + 4] = warmWhite * 0.95
          lineColArray[li + 5] = warmWhite * 0.9

          lineIndex++
        }
      }
    }

    for (let i = lineIndex * 6; i < linePosArray.length; i++) {
      linePosArray[i] = 0
      lineColArray[i] = 0
    }

    linePosAttr.needsUpdate = true
    lineColAttr.needsUpdate = true
    lineGeo.setDrawRange(0, lineIndex * 2)

    const mainPosAttr = mainStarsRef.current.geometry.attributes.position as THREE.BufferAttribute
    const mainPosArray = mainPosAttr.array as Float32Array
    let mi = 0
    mainStarIndices.forEach((idx) => {
      mainPosArray[mi * 3] = posArray[idx * 3]
      mainPosArray[mi * 3 + 1] = posArray[idx * 3 + 1]
      mainPosArray[mi * 3 + 2] = posArray[idx * 3 + 2]
      mi++
    })
    mainPosAttr.needsUpdate = true

    const mainMaterial = mainStarsRef.current.material as THREE.PointsMaterial
    mainMaterial.opacity = 0.7 + Math.sin(time * 1.5) * 0.3
  })

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={PARTICLE_COUNT}
            array={particleSizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={2}
          color="#fffaf0"
          transparent
          opacity={0.6}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePositions.length / 3}
            array={linePositions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={lineColors.length / 3}
            array={lineColors}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={mainStarsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={MAIN_STAR_COUNT}
            array={mainStarPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={6}
          color="#fff8e7"
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  )
}

function Scene() {
  const mouse = useRef(new THREE.Vector2(0, 0))

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <>
      <color attach="background" args={['#000000']} />
      <ParticleSystem mouse={mouse} />
    </>
  )
}

export default function ContactParticles() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
