'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 4000
const COLUMNS = 50
const ROWS = 25
const MOUSE_RADIUS = 120
const MOUSE_STRENGTH = 25
const RETURN_SPEED = 0.03
const DAMPING = 0.92

const mouseState = { x: 0, y: 0, active: false }

function DataFlowParticles() {
  const { camera, size } = useThree()
  const timeRef = useRef(0)

  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const basePositions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities = new Float32Array(PARTICLE_COUNT * 3)
    const offsets = new Float32Array(PARTICLE_COUNT * 2)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const columnSpeeds = new Float32Array(COLUMNS)

    const spreadX = 900
    const spreadY = 700
    const spacingX = spreadX / COLUMNS
    const spacingY = spreadY / ROWS

    for (let col = 0; col < COLUMNS; col++) {
      columnSpeeds[col] = 0.3 + Math.random() * 1.2
    }

    let index = 0
    for (let col = 0; col < COLUMNS; col++) {
      for (let row = 0; row < ROWS; row++) {
        if (index >= PARTICLE_COUNT) break

        const x = (col - COLUMNS / 2) * spacingX + (Math.random() - 0.5) * 10
        const y = (row - ROWS / 2) * spacingY + (Math.random() - 0.5) * 10
        const z = (Math.random() - 0.5) * 30

        positions[index * 3] = x
        positions[index * 3 + 1] = y
        positions[index * 3 + 2] = z

        basePositions[index * 3] = x
        basePositions[index * 3 + 1] = y
        basePositions[index * 3 + 2] = z

        velocities[index * 3] = 0
        velocities[index * 3 + 1] = 0
        velocities[index * 3 + 2] = 0

        offsets[index * 2] = col
        offsets[index * 2 + 1] = Math.random() * spreadY

        colors[index * 3] = 0.6
        colors[index * 3 + 1] = 0.6
        colors[index * 3 + 2] = 0.6

        sizes[index] = 3 + Math.random() * 3

        index++
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    return { positions, basePositions, velocities, offsets, colors, sizes, columnSpeeds, geometry, spreadY }
  }, [])

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vAlpha = color.r;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.05, dist) * vAlpha;
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

    const { positions, basePositions, velocities, offsets, colors, columnSpeeds, geometry, spreadY } = data

    const mouseWorldX = (mouseState.x / size.width) * 2 - 1
    const mouseWorldY = -(mouseState.y / size.height) * 2 + 1

    const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const mousePos = camera.position.clone().add(dir.multiplyScalar(distance))

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const col = offsets[i * 2]
      const yOffset = offsets[i * 2 + 1]
      const speed = columnSpeeds[col]

      const baseX = basePositions[i * 3]
      let flowY = basePositions[i * 3 + 1] - ((time * speed * 40 + yOffset) % spreadY)
      if (flowY < -spreadY / 2) {
        flowY += spreadY
      }

      const currentX = positions[i * 3]
      const currentY = positions[i * 3 + 1]

      const dx = currentX - mousePos.x
      const dy = currentY - mousePos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (mouseState.active && dist < MOUSE_RADIUS && dist > 0) {
        const force = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH
        const angle = Math.atan2(dy, dx)
        velocities[i * 3] += Math.cos(angle) * force
        velocities[i * 3 + 1] += Math.sin(angle) * force
      }

      velocities[i * 3] *= DAMPING
      velocities[i * 3 + 1] *= DAMPING

      const targetX = baseX
      const targetY = flowY

      velocities[i * 3] += (targetX - currentX) * RETURN_SPEED
      velocities[i * 3 + 1] += (targetY - currentY) * RETURN_SPEED

      positions[i * 3] += velocities[i * 3]
      positions[i * 3 + 1] += velocities[i * 3 + 1]

      const velMag = Math.sqrt(velocities[i * 3] ** 2 + velocities[i * 3 + 1] ** 2)
      const normalizedY = (positions[i * 3 + 1] + spreadY / 2) / spreadY
      const baseAlpha = 0.4 + normalizedY * 0.5
      const motionBoost = Math.min(velMag * 0.1, 0.5)
      const finalAlpha = Math.min(1, baseAlpha + motionBoost)

      colors[i * 3] = finalAlpha
      colors[i * 3 + 1] = finalAlpha
      colors[i * 3 + 2] = finalAlpha
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  return <points geometry={data.geometry} material={shaderMaterial} />
}

export default function SkillsParticles({ className }: { className?: string }) {
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
      id="skills-canvas"
      className={className} 
      style={{ width: '100%', height: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 400], fov: 75 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <DataFlowParticles />
      </Canvas>
    </div>
  )
}
