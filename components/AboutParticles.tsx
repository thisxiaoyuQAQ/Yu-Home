'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 500
const MOUSE_RADIUS = 120
const MOUSE_STRENGTH = 0.8

const mouseState = { x: 0, y: 0, active: false }

function Bubbles() {
  const { viewport, camera } = useThree()
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const timeRef = useRef(0)
  
  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const baseSizes = new Float32Array(PARTICLE_COUNT)
    const phases = new Float32Array(PARTICLE_COUNT)
    const opacities = new Float32Array(PARTICLE_COUNT)
    
    const spreadX = 1200
    const spreadY = 800
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spreadX
      positions[i * 3 + 1] = (Math.random() - 0.5) * spreadY
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.3
      velocities[i * 3 + 1] = 0.2 + Math.random() * 0.5
      velocities[i * 3 + 2] = 0
      
      baseSizes[i] = 2 + Math.random() * 6
      phases[i] = Math.random() * Math.PI * 2
      opacities[i] = 0.3 + Math.random() * 0.3
    }
    
    return { positions, velocities, baseSizes, phases, opacities, spreadX, spreadY }
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [])

  const geometry = useMemo(() => new THREE.CircleGeometry(1, 32), [])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    
    timeRef.current += delta
    const time = timeRef.current
    
    const { positions, velocities, baseSizes, phases, opacities, spreadX, spreadY } = data
    
    const mouseWorldX = (mouseState.x / window.innerWidth) * 2 - 1
    const mouseWorldY = -(mouseState.y / window.innerHeight) * 2 + 1
    
    const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const mousePos = camera.position.clone().add(dir.multiplyScalar(distance))
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2
      
      positions[ix] += velocities[ix] + Math.sin(time * 0.5 + phases[i]) * 0.15
      positions[iy] += velocities[iy]
      
      if (mouseState.active) {
        const mdx = positions[ix] - mousePos.x
        const mdy = positions[iy] - mousePos.y
        const dist = Math.sqrt(mdx * mdx + mdy * mdy)
        
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = Math.pow(1 - dist / MOUSE_RADIUS, 2) * MOUSE_STRENGTH
          positions[ix] += (mdx / dist) * force
          positions[iy] += (mdy / dist) * force
        }
      }
      
      if (positions[iy] > spreadY / 2 + 50) {
        positions[iy] = -spreadY / 2 - 50
        positions[ix] = (Math.random() - 0.5) * spreadX
      }
      
      if (positions[ix] > spreadX / 2 + 50) {
        positions[ix] = -spreadX / 2 - 50
      } else if (positions[ix] < -spreadX / 2 - 50) {
        positions[ix] = spreadX / 2 + 50
      }
      
      const breathe = 1 + Math.sin(time * 1.5 + phases[i]) * 0.2
      const scale = baseSizes[i] * breathe
      
      dummy.position.set(positions[ix], positions[iy], positions[iz])
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      
      meshRef.current.setMatrixAt(i, dummy.matrix)
      
      const color = new THREE.Color()
      color.setRGB(1, 1, 1)
      meshRef.current.setColorAt(i, color)
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, PARTICLE_COUNT]}>
    </instancedMesh>
  )
}

function Scene() {
  return (
    <>
      <Bubbles />
    </>
  )
}

export default function AboutParticles({ className }: { className?: string }) {
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', (e: MouseEvent) => {
      mouseState.x = e.clientX
      mouseState.y = e.clientY
      mouseState.active = true
    })
    
    document.body.addEventListener('mouseleave', () => {
      mouseState.active = false
    })
  }

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0, 400], fov: 75 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
