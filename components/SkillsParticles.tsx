'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 800
const COLUMNS = 40
const ROWS = 20
const MOUSE_RADIUS = 150
const RIPPLE_SPEED = 3
const RIPPLE_DECAY = 0.95

interface RippleState {
  x: number
  y: number
  radius: number
  strength: number
  active: boolean
}

const mouseState = { x: 0, y: 0, prevX: 0, prevY: 0 }
const ripples: RippleState[] = []

function DataFlowParticles() {
  const { camera, size } = useThree()
  const timeRef = useRef(0)
  const lastRippleTime = useRef(0)

  const data = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const originalPositions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const columnSpeeds = new Float32Array(COLUMNS)
    const columnOffsets = new Float32Array(COLUMNS)

    const spreadX = 800
    const spreadY = 600
    const spacingX = spreadX / COLUMNS
    const spacingY = spreadY / ROWS

    for (let col = 0; col < COLUMNS; col++) {
      columnSpeeds[col] = 0.5 + Math.random() * 1.5
      columnOffsets[col] = Math.random() * spreadY
    }

    let index = 0
    for (let col = 0; col < COLUMNS; col++) {
      for (let row = 0; row < ROWS; row++) {
        if (index >= PARTICLE_COUNT) break

        const x = (col - COLUMNS / 2) * spacingX + (Math.random() - 0.5) * 8
        const y = (row - ROWS / 2) * spacingY
        const z = (Math.random() - 0.5) * 50

        positions[index * 3] = x
        positions[index * 3 + 1] = y
        positions[index * 3 + 2] = z

        originalPositions[index * 3] = x
        originalPositions[index * 3 + 1] = y
        originalPositions[index * 3 + 2] = z

        colors[index * 3] = 1
        colors[index * 3 + 1] = 1
        colors[index * 3 + 2] = 1

        sizes[index] = 2 + Math.random() * 2

        index++
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    return { positions, originalPositions, colors, sizes, columnSpeeds, columnOffsets, geometry, spreadY }
  }, [])

  const shaderMaterial = useMemo(() => {
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
          
          float alpha = smoothstep(0.5, 0.1, dist) * vAlpha;
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha * 0.8);
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

    const { positions, originalPositions, colors, columnSpeeds, columnOffsets, geometry, spreadY } = data

    const mouseWorldX = (mouseState.x / size.width) * 2 - 1
    const mouseWorldY = -(mouseState.y / size.height) * 2 + 1

    const vector = new THREE.Vector3(mouseWorldX, mouseWorldY, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const mousePos = camera.position.clone().add(dir.multiplyScalar(distance))

    const mouseMoved = Math.abs(mouseState.x - mouseState.prevX) > 2 || 
                       Math.abs(mouseState.y - mouseState.prevY) > 2

    if (mouseMoved && time - lastRippleTime.current > 0.1) {
      ripples.push({
        x: mousePos.x,
        y: mousePos.y,
        radius: 0,
        strength: 1,
        active: true
      })
      lastRippleTime.current = time
      mouseState.prevX = mouseState.x
      mouseState.prevY = mouseState.y
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const ripple = ripples[i]
      ripple.radius += RIPPLE_SPEED
      ripple.strength *= RIPPLE_DECAY
      if (ripple.strength < 0.01) {
        ripples.splice(i, 1)
      }
    }

    let index = 0
    for (let col = 0; col < COLUMNS; col++) {
      const speed = columnSpeeds[col]
      const offset = columnOffsets[col]

      for (let row = 0; row < ROWS; row++) {
        if (index >= PARTICLE_COUNT) break

        const baseY = originalPositions[index * 3 + 1]
        let newY = baseY - ((time * speed * 30 + offset) % spreadY)

        if (newY < -spreadY / 2) {
          newY += spreadY
        }

        positions[index * 3 + 1] = newY

        const normalizedY = (newY + spreadY / 2) / spreadY
        const baseAlpha = 0.15 + normalizedY * 0.7

        let rippleEffect = 0
        for (const ripple of ripples) {
          const dx = positions[index * 3] - ripple.x
          const dy = newY - ripple.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const rippleWidth = 30

          if (dist > ripple.radius - rippleWidth && dist < ripple.radius + rippleWidth) {
            const rippleFactor = 1 - Math.abs(dist - ripple.radius) / rippleWidth
            rippleEffect = Math.max(rippleEffect, rippleFactor * ripple.strength)
          }
        }

        const finalAlpha = Math.min(1, baseAlpha + rippleEffect * 0.8)

        colors[index * 3] = finalAlpha
        colors[index * 3 + 1] = finalAlpha
        colors[index * 3 + 2] = finalAlpha

        index++
      }
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  return <points geometry={data.geometry} material={shaderMaterial} />
}

function MouseTracker() {
  const { size } = useThree()

  useFrame(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.querySelector('#skills-canvas')?.getBoundingClientRect()
      if (rect) {
        mouseState.x = e.clientX - rect.left
        mouseState.y = e.clientY - rect.top
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', handleMouseMove)
      return () => window.removeEventListener('mousemove', handleMouseMove)
    }
  })

  return null
}

export default function SkillsParticles({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    mouseState.x = e.clientX - rect.left
    mouseState.y = e.clientY - rect.top
  }

  return (
    <div 
      id="skills-canvas"
      className={className} 
      style={{ width: '100%', height: '100%' }}
      onMouseMove={handleMouseMove}
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
