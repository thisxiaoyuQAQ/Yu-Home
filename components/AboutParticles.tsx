'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// "Rising warm-light nebula" — companion piece to HeroParticles.
//  - GPU-driven point cloud in a wide rectangular volume (1200 x 800)
//  - Slow global upward drift + horizontal sine sway
//  - Per-particle 4-float aShift for independent wobble (Hero parity)
//  - Inverted palette gradient: warm amber at bottom → deep purple top
//  - Soft mouse repulsion in a spherical falloff via uMouse / uMouseStrength

const PARTICLE_COUNT = 800

const SPREAD_X = 1200
const SPREAD_Y = 800
const SPREAD_Z = 100

const MOUSE_RADIUS = 150

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  uniform float uMouseRadius;
  uniform float uSpreadY;

  attribute float aSize;
  attribute vec4  aShift; // (phaseA, phaseB, frequency, amplitude)

  varying vec3 vColor;

  const float PI2 = 6.2831853;

  void main() {
    // Rising drift + horizontal sway, wrap vertically so the column never empties.
    float riseSpeed = 18.0;
    float swayAmp   = 22.0;

    vec3 base = position;
    base.y = mod(base.y + uTime * riseSpeed + uSpreadY * 0.5, uSpreadY) - uSpreadY * 0.5;
    base.x += sin(uTime * 0.4 + aShift.x * 3.0) * swayAmp;

    // Per-particle micro wobble — independent tiny sphere walk.
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.a * 10.0;

    vec3 transformed = base + wobble;

    // Soft spherical mouse repulsion in world-ish space.
    vec3 toParticle = transformed - uMouse;
    float md = length(toParticle);
    if (md < uMouseRadius && md > 0.0001) {
      float falloff = 1.0 - md / uMouseRadius;
      falloff = falloff * falloff;
      transformed += normalize(toParticle) * falloff * uMouseStrength;
    }

    // Inverted gradient: amber at bottom (low y) → purple at top (high y).
    float t = clamp(transformed.y / uSpreadY + 0.5, 0.0, 1.0);
    vec3 warm   = vec3(255.0, 170.0, 60.0)  / 255.0; // amber
    vec3 purple = vec3(110.0, 60.0, 230.0)  / 255.0; // deep purple
    vColor = mix(warm, purple, t);

    // Breathing scale (matches the original bubble pulse).
    float breathe = 1.0 + sin(uTime * 1.5 + aShift.y * 4.0) * 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * breathe * uPixelRatio * (900.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vColor;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    // Soft disc — bright centre, gentle halo (matches the original bubble feel).
    float alpha = smoothstep(0.5, 0.0, d) * 0.55 + 0.05;
    gl_FragColor = vec4(vColor, alpha);
  }
`

const mouseState = { x: 0, y: 0, active: false }

function Nebula() {
  const { gl, camera, size } = useThree()
  const pointsRef = useRef<THREE.Points>(null)
  const mouseTargetRef = useRef(new THREE.Vector3(9999, 9999, 0))
  const mouseStrengthRef = useRef(0)

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const sizes = new Float32Array(PARTICLE_COUNT)
    const shift = new Float32Array(PARTICLE_COUNT * 4)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * SPREAD_X
      positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z

      // Wider size spread: most small, a few large bubbles (pow biases toward small)
      sizes[i] = 2 + Math.pow(Math.random(), 2.2) * 25  // ~2-22, mostly small with rare big ones
      shift[i * 4]     = Math.random() * Math.PI
      shift[i * 4 + 1] = Math.random() * Math.PI * 2
      shift[i * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      shift[i * 4 + 3] = Math.random() * 0.9 + 0.1
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
        uMouse: { value: new THREE.Vector3(9999, 9999, 0) },
        uMouseStrength: { value: 0 },
        uMouseRadius: { value: MOUSE_RADIUS },
        uSpreadY: { value: SPREAD_Y },
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
    mat.uniforms.uTime.value += delta
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    // Unproject mouse to a world-space point on the z=0 plane.
    if (mouseState.active) {
      const ndcX = (mouseState.x / size.width) * 2 - 1
      const ndcY = -((mouseState.y / size.height) * 2 - 1)
      const v = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera)
      const dir = v.sub(camera.position).normalize()
      const dist = -camera.position.z / dir.z
      const worldPos = camera.position.clone().add(dir.multiplyScalar(dist))
      mouseTargetRef.current.lerp(worldPos, 0.15)
      mouseStrengthRef.current += (40 - mouseStrengthRef.current) * 0.08
    } else {
      mouseStrengthRef.current += (0 - mouseStrengthRef.current) * 0.06
    }

    mat.uniforms.uMouse.value.copy(mouseTargetRef.current)
    mat.uniforms.uMouseStrength.value = mouseStrengthRef.current
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

export default function AboutParticles({ className }: { className?: string }) {
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
      style={{ width: '100%', height: '100%', background: '#0a0010' }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 600], fov: 60, near: 1, far: 3000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <Nebula />
      </Canvas>
    </div>
  )
}
