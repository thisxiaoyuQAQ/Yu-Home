'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 600
const SPIRAL_LAYERS = 5
const CONNECTION_DISTANCE = 60

const mouseState = { x: 0, y: 0, active: false }

function SpiralParticles() {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)

  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const basePositions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const particleData: { layer: number; angle: number; radius: number; speed: number; direction: number }[] = []

    const particlesPerLayer = Math.floor(PARTICLE_COUNT / SPIRAL_LAYERS)

    for (let layer = 0; layer < SPIRAL_LAYERS; layer++) {
      const layerRadius = 80 + layer * 60
      const direction = layer % 2 === 0 ? 1 : -1
      const baseSpeed = 0.15 + Math.random() * 0.1
      const spiralTurns = 2 + layer * 0.5

      for (let i = 0; i < particlesPerLayer; i++) {
        const idx = layer * particlesPerLayer + i
        if (idx >= PARTICLE_COUNT) break

        const t = i / particlesPerLayer
        const angle = t * Math.PI * 2 * spiralTurns
        const heightOffset = (t - 0.5) * 200
        const radiusVariation = layerRadius + Math.sin(angle * 3) * 15

        const x = Math.cos(angle) * radiusVariation
        const y = heightOffset + Math.sin(angle * 2) * 30
        const z = Math.sin(angle) * radiusVariation * 0.6

        positions[idx * 3] = x
        positions[idx * 3 + 1] = y
        positions[idx * 3 + 2] = z

        basePositions[idx * 3] = x
        basePositions[idx * 3 + 1] = y
        basePositions[idx * 3 + 2] = z

        velocities[idx * 3] = 0
        velocities[idx * 3 + 1] = 0
        velocities[idx * 3 + 2] = 0

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

    const linePositions = new Float32Array(30000 * 6)
    const lineColors = new Float32Array(30000 * 6)
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
    lineGeometry.setDrawRange(0, 0)

    return { positions, basePositions, velocities, geometry, lineGeometry, linePositions, lineColors, particleData }
  }, [])

  const pointsMaterial = useMemo(() => new THREE.PointsMaterial({
    color: 0xffffff,
    size: 3,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  }), [])

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
  }), [])

  useFrame((_, delta) => {
    timeRef.current += delta
    const time = timeRef.current

    const { positions, basePositions, velocities, geometry, lineGeometry, linePositions, lineColors, particleData } = data

    const mouseWorldX = (mouseState.x / window.innerWidth) * 2 - 1
    const mouseWorldY = -(mouseState.y / window.innerHeight) * 2 + 1

    const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const mousePos = camera.position.clone().add(dir.multiplyScalar(distance))

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pd = particleData[i]
      if (!pd) continue

      const newAngle = pd.angle + time * pd.speed * pd.direction
      const layerRadius = 80 + pd.layer * 60
      const radiusVariation = layerRadius + Math.sin(newAngle * 3) * 15

      const baseX = Math.cos(newAngle) * radiusVariation
      const baseY = basePositions[i * 3 + 1] + Math.sin(time * 0.5 + pd.layer) * 10
      const baseZ = Math.sin(newAngle) * radiusVariation * 0.6

      let targetX = baseX
      let targetY = baseY
      let targetZ = baseZ

      if (mouseState.active) {
        const dx = baseX - mousePos.x
        const dy = baseY - mousePos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < 150 && dist > 0) {
          const force = Math.pow(1 - dist / 150, 2) * 40
          const twistAngle = (1 - dist / 150) * 0.5
          
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

      velocities[ix] = (targetX - positions[ix]) * 0.08
      velocities[iy] = (targetY - positions[iy]) * 0.08
      velocities[iz] = (targetZ - positions[iz]) * 0.08

      positions[ix] += velocities[ix]
      positions[iy] += velocities[iy]
      positions[iz] += velocities[iz]
    }

    let lineCount = 0
    const maxLines = 30000
    const connDistSq = CONNECTION_DISTANCE * CONNECTION_DISTANCE

    for (let i = 0; i < PARTICLE_COUNT && lineCount < maxLines; i++) {
      const pd1 = particleData[i]
      if (!pd1) continue

      for (let j = i + 1; j < PARTICLE_COUNT && lineCount < maxLines; j++) {
        const pd2 = particleData[j]
        if (!pd2) continue

        if (Math.abs(pd1.layer - pd2.layer) > 1) continue

        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
        const distSq = dx * dx + dy * dy + dz * dz

        if (distSq < connDistSq) {
          const alpha = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.35

          const idx = lineCount * 6
          linePositions[idx] = positions[i * 3]
          linePositions[idx + 1] = positions[i * 3 + 1]
          linePositions[idx + 2] = positions[i * 3 + 2]
          linePositions[idx + 3] = positions[j * 3]
          linePositions[idx + 4] = positions[j * 3 + 1]
          linePositions[idx + 5] = positions[j * 3 + 2]

          lineColors[idx] = alpha
          lineColors[idx + 1] = alpha
          lineColors[idx + 2] = alpha
          lineColors[idx + 3] = alpha
          lineColors[idx + 4] = alpha
          lineColors[idx + 5] = alpha

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

function Scene() {
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouseState.x = e.clientX
      mouseState.y = e.clientY
      mouseState.active = true
    }

    const onMouseLeave = () => {
      mouseState.active = false
    }

    window.addEventListener('mousemove', onMouseMove)
    document.body.addEventListener('mouseleave', onMouseLeave)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      document.body.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return <SpiralParticles />
}

export default function ProjectsParticles({ className }: { className?: string }) {
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 400], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
