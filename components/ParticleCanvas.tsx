'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const NEBULA_PARTICLES = 3000
const STAR_PARTICLES = 200
const MOUSE_RADIUS = 250
const MOUSE_STRENGTH = 3
const RETURN_SPEED = 0.004
const DAMPING = 0.98

const mouseState = { x: 0, y: 0, active: false }

function NebulaParticles() {
  const { camera, size } = useThree()
  const timeRef = useRef(0)
  const groupRef = useRef<THREE.Group>(null)
  
  const nebulaData = useMemo(() => {
    const positions = new Float32Array(NEBULA_PARTICLES * 3)
    const originalPositions = new Float32Array(NEBULA_PARTICLES * 3)
    const velocities = new Float32Array(NEBULA_PARTICLES * 3)
    const colors = new Float32Array(NEBULA_PARTICLES * 3)
    const sizes = new Float32Array(NEBULA_PARTICLES)
    const phases = new Float32Array(NEBULA_PARTICLES * 3)
    
    const colorPalette = [
      [0.4, 0.2, 0.8],
      [0.2, 0.4, 0.9],
      [0.6, 0.3, 0.7],
      [0.3, 0.5, 0.9],
      [0.5, 0.2, 0.6],
      [0.2, 0.3, 0.8],
    ]
    
    for (let i = 0; i < NEBULA_PARTICLES; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.pow(Math.random(), 0.4) * 600
      
      const spiralOffset = theta + r * 0.008
      const x = r * Math.sin(phi) * Math.cos(spiralOffset) * 1.5
      const y = r * Math.sin(phi) * Math.sin(spiralOffset) * 0.8
      const z = r * Math.cos(phi) * 0.6
      
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      
      originalPositions[i * 3] = x
      originalPositions[i * 3 + 1] = y
      originalPositions[i * 3 + 2] = z
      
      velocities[i * 3] = 0
      velocities[i * 3 + 1] = 0
      velocities[i * 3 + 2] = 0
      
      const colorIdx = Math.floor(Math.random() * colorPalette.length)
      const color = colorPalette[colorIdx]
      const variation = 0.8 + Math.random() * 0.4
      colors[i * 3] = color[0] * variation
      colors[i * 3 + 1] = color[1] * variation
      colors[i * 3 + 2] = color[2] * variation
      
      const distFromCenter = Math.sqrt(x * x + y * y + z * z)
      const normalizedDist = distFromCenter / 600
      sizes[i] = (2 + Math.random() * 4) * (1 - normalizedDist * 0.5)
      
      phases[i * 3] = Math.random() * Math.PI * 2
      phases[i * 3 + 1] = 0.2 + Math.random() * 0.6
      phases[i * 3 + 2] = Math.random() * Math.PI * 2
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    
    return { positions, originalPositions, velocities, colors, sizes, phases, geometry }
  }, [])
  
  const starData = useMemo(() => {
    const positions = new Float32Array(STAR_PARTICLES * 3)
    const sizes = new Float32Array(STAR_PARTICLES)
    const twinklePhases = new Float32Array(STAR_PARTICLES)
    
    for (let i = 0; i < STAR_PARTICLES; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 200 + Math.random() * 500
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.5
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.8
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.6
      
      sizes[i] = 1 + Math.random() * 2
      twinklePhases[i] = Math.random() * Math.PI * 2
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(twinklePhases, 1))
    
    return { positions, sizes, twinklePhases, geometry }
  }, [])

  const nebulaMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        uniform float uTime;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float dist = length(position);
          vAlpha = 0.6 - dist * 0.0005;
          float pulse = 1.0 + sin(uTime * 0.3 + position.x * 0.005 + position.y * 0.005) * 0.15;
          gl_PointSize = size * uPixelRatio * (500.0 / -mvPosition.z) * pulse;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float glow = exp(-dist * 2.5) * 0.9;
          float soft = smoothstep(0.5, 0.0, dist) * 0.4;
          float alpha = (glow + soft) * vAlpha;
          
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  }, [])
  
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute float twinklePhase;
        varying float vTwinkle;
        uniform float uPixelRatio;
        uniform float uTime;

        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vTwinkle = 0.5 + 0.5 * sin(uTime * 2.0 + twinklePhase * 6.28);
          gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z) * (0.8 + vTwinkle * 0.4);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vTwinkle;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float core = exp(-dist * 8.0);
          float glow = exp(-dist * 3.0) * 0.5;
          float alpha = (core + glow) * vTwinkle;
          
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  }, [])

  useFrame((_, delta) => {
    timeRef.current += delta
    const time = timeRef.current
    
    nebulaMaterial.uniforms.uTime.value = time
    starMaterial.uniforms.uTime.value = time
    
    const { positions, originalPositions, velocities, phases, geometry } = nebulaData
    
    const mouseWorldX = (mouseState.x / size.width) * 2 - 1
    const mouseWorldY = -(mouseState.y / size.height) * 2 + 1
    
    const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const mousePos = camera.position.clone().add(dir.multiplyScalar(distance))
    
    for (let i = 0; i < NEBULA_PARTICLES; i++) {
      const ix = i * 3
      const iy = i * 3 + 1
      const iz = i * 3 + 2
      
      const phase = phases[ix]
      const speed = phases[iy]
      const phaseZ = phases[iz]
      
      const orbitSpeed = 0.02 * speed
      const wobbleX = Math.sin(time * 0.1 * speed + phase) * 30
      const wobbleY = Math.cos(time * 0.08 * speed + phase * 1.3) * 25
      const wobbleZ = Math.sin(time * 0.06 + phaseZ) * 15
      
      const baseX = originalPositions[ix]
      const baseY = originalPositions[iy]
      const baseZ = originalPositions[iz]
      
      const rotAngle = time * orbitSpeed
      const cos = Math.cos(rotAngle)
      const sin = Math.sin(rotAngle)
      const rotatedX = baseX * cos - baseZ * sin
      const rotatedZ = baseX * sin + baseZ * cos
      
      const targetX = rotatedX + wobbleX
      const targetY = baseY + wobbleY
      const targetZ = rotatedZ + wobbleZ
      
      velocities[ix] += (targetX - positions[ix]) * RETURN_SPEED
      velocities[iy] += (targetY - positions[iy]) * RETURN_SPEED
      velocities[iz] += (targetZ - positions[iz]) * RETURN_SPEED
      
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
      velocities[iz] *= DAMPING
      
      positions[ix] += velocities[ix]
      positions[iy] += velocities[iy]
      positions[iz] += velocities[iz]
    }
    
    geometry.attributes.position.needsUpdate = true
    
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.01
      groupRef.current.rotation.x = Math.sin(time * 0.05) * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      <points geometry={nebulaData.geometry} material={nebulaMaterial} />
      <points geometry={starData.geometry} material={starMaterial} />
    </group>
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
        <NebulaParticles />
      </Canvas>
    </div>
  )
}
