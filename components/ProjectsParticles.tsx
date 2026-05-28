'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 2000
const MOUSE_RADIUS = 180
const MOUSE_STRENGTH = 1.5
const CONNECTION_DISTANCE = 80
const RETURN_SPEED = 0.008
const DAMPING = 0.96
const DRIFT_SPEED = 0.3
const DRIFT_AMPLITUDE = 30

const mouseState = { x: 0, y: 0, active: false }

function Particles() {
  const { camera, size } = useThree()
  const timeRef = useRef(0)
  
  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const originalPositions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const phases = new Float32Array(PARTICLE_COUNT * 2)
    
    const spreadX = 1600
    const spreadY = 1200
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const x = (Math.random() - 0.5) * spreadX
      const y = (Math.random() - 0.5) * spreadY
      const z = (Math.random() - 0.5) * 150
      
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      
      originalPositions[i * 3] = x
      originalPositions[i * 3 + 1] = y
      originalPositions[i * 3 + 2] = z
      
      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0
      
      phases[i * 2] = Math.random() * Math.PI * 2
      phases[i * 2 + 1] = 0.5 + Math.random() * 1.0
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    
    const linePositions = new Float32Array(50000 * 6)
    const lineColors = new Float32Array(50000 * 6)
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3))
    lineGeometry.setDrawRange(0, 0)
    
    return { positions, originalPositions, velocities, phases, geometry, lineGeometry, linePositions, lineColors }
  }, [])

  const pointsMaterial = useMemo(() => new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  }), [])

  const lineMaterial = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  }), [])

  useFrame((_, delta) => {
    timeRef.current += delta
    const time = timeRef.current
    
    const { positions, originalPositions, velocities, phases, geometry, lineGeometry, linePositions, lineColors } = data
    
    const mouseWorldX = (mouseState.x / size.width) * 2 - 1
    const mouseWorldY = -(mouseState.y / size.height) * 2 + 1
    
    const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const mousePos = camera.position.clone().add(dir.multiplyScalar(distance))
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      
      const phase = phases[i * 2]
      const speed = phases[i * 2 + 1]
      const driftX = Math.sin(time * DRIFT_SPEED * speed + phase) * DRIFT_AMPLITUDE
      const driftY = Math.cos(time * DRIFT_SPEED * speed * 0.7 + phase * 1.3) * DRIFT_AMPLITUDE * 0.6
      
      const targetX = originalPositions[ix] + driftX
      const targetY = originalPositions[iy] + driftY
      
      const dx = targetX - positions[ix]
      const dy = targetY - positions[iy]
      
      velocities[ix] += dx * RETURN_SPEED
      velocities[iy] += dy * RETURN_SPEED
      
      if (mouseState.active) {
        const mdx = positions[ix] - mousePos.x
        const mdy = positions[iy] - mousePos.y
        const dist = Math.sqrt(mdx * mdx + mdy * mdy)
        
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = Math.pow(1 - dist / MOUSE_RADIUS, 2) * MOUSE_STRENGTH
          velocities[ix] += (mdx / dist) * force
          velocities[iy] += (mdy / dist) * force
        }
      }
      
      velocities[ix] *= DAMPING
      velocities[iy] *= DAMPING
      
      positions[ix] += velocities[ix]
      positions[iy] += velocities[iy]
    }
    
    let lineCount = 0
    const maxLines = 50000
    const connDistSq = CONNECTION_DISTANCE * CONNECTION_DISTANCE
    
    for (let i = 0; i < PARTICLE_COUNT && lineCount < maxLines; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT && lineCount < maxLines; j++) {
        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const distSq = dx * dx + dy * dy
        
        if (distSq < connDistSq) {
          const alpha = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.25
          
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
  })

  return (
    <>
      <points geometry={data.geometry} material={pointsMaterial} />
      <lineSegments geometry={data.lineGeometry} material={lineMaterial} />
    </>
  )
}

export default function ParticleCanvas({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseState.x = e.clientX - rect.left
    mouseState.y = e.clientY - rect.top
  }

  const handleMouseEnter = () => {
    mouseState.active = true
  }

  const handleMouseLeave = () => {
    mouseState.active = false
  }

  return (
    <div 
      className={className} 
      style={{ width: '100%', height: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 500], fov: 75 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Particles />
      </Canvas>
    </div>
  )
}
