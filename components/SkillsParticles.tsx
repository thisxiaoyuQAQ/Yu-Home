'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Horizontal spindle tornado — particles flow along a long X axis, swirling
// around it with a sin-envelope radius (fat in the middle, thin at the ends).
// All motion is computed in the vertex shader from a few per-particle scalars;
// the CPU only updates uTime, uMouse and uMouseActive.

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

const PARTICLE_COUNT = isMobile ? 22000 : 60000
const L = isMobile ? 1200 : 1800
const R_MAX = isMobile ? 120 : 180
const K = 0.55
const FLOW = 0.10
const OMEGA = 0.45
const TWIST = 1.8
const MOUSE_R = 280

export const skillsMouseState = {
  x: 0,
  y: 0,
  active: false,
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uFlow;
  uniform float uL;
  uniform float uRMax;
  uniform float uK;
  uniform float uOmega;
  uniform float uTwist;
  uniform vec2  uMouse;
  uniform float uMouseActive;
  uniform float uMouseR;

  attribute float aT0;
  attribute float aTheta0;
  attribute float aRadiusJitter;
  attribute float aSize;
  attribute vec4  aShift;

  varying vec3  vColor;
  varying float vAlpha;

  const float PI  = 3.14159265;
  const float PI2 = 6.2831853;

  void main() {
    // 1) axial position (loops)
    float t = fract(aT0 + uFlow * uTime);

    // 2) spindle envelope + per-particle jitter
    float env = pow(sin(PI * t), uK);
    float r   = uRMax * env * aRadiusJitter;

    // 3) spin + axial twist
    float theta = aTheta0 + uOmega * uTime - uTwist * t;

    // 4) mouse warp (use pre-warp world XY for distance)
    float x0 = -uL * 0.5 + uL * t;
    float y0 = r * cos(theta);
    float dM   = length(vec2(x0, y0) - uMouse);
    float prox = (1.0 - smoothstep(0.0, uMouseR, dM)) * uMouseActive;
    r     *= 1.0 + prox * 0.55;
    theta += prox * 1.4;

    // 5) final world position
    float x = -uL * 0.5 + uL * t;
    float y = r * cos(theta);
    float z = r * sin(theta);

    // 6) Hero-style per-particle wobble
    float moveT = mod(aShift.x + aShift.z * uTime, PI2);
    float moveS = mod(aShift.y + aShift.z * uTime, PI2);
    vec3 wobble = vec3(
      cos(moveS) * sin(moveT),
      cos(moveT),
      sin(moveS) * sin(moveT)
    ) * aShift.w * 3.0;

    vec3 transformed = vec3(x, y, z) + wobble;

    // 7) coloring: purple → amber along the axis, hot cyan-white on high energy
    vec3 amber  = vec3(255.0, 170.0, 60.0)  / 255.0;
    vec3 purple = vec3(110.0,  60.0, 230.0) / 255.0;
    vec3 base   = mix(purple, amber, t);
    vec3 hot    = vec3(0.75, 0.95, 1.0);
    float energy = env * 0.6 + prox;
    vColor = mix(base, hot, clamp(energy * 0.55, 0.0, 0.85)) * (1.35 + env * 0.6);

    vAlpha = 0.65 + env * 0.55 + prox * 0.35;

    vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSize * uPixelRatio * (320.0 / -mv.z) * (1.0 + prox * 1.2);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d);
    float a = (halo * 0.65 + core * 0.7) * vAlpha;
    gl_FragColor = vec4(vColor * (1.0 + core * 0.6), a);
  }
`

function TornadoField() {
  const { camera, size, gl } = useThree()
  const mouseWorld = useRef(new THREE.Vector3())

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3) // all zeros — shader computes final pos
    const aT0 = new Float32Array(PARTICLE_COUNT)
    const aTheta0 = new Float32Array(PARTICLE_COUNT)
    const aRadiusJitter = new Float32Array(PARTICLE_COUNT)
    const aSize = new Float32Array(PARTICLE_COUNT)
    const aShift = new Float32Array(PARTICLE_COUNT * 4)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      aT0[i] = Math.random()
      aTheta0[i] = Math.random() * Math.PI * 2
      aRadiusJitter[i] = 0.85 + Math.random() * 0.30
      aSize[i] = Math.random() * 0.7 + 0.4
      aShift[i * 4]     = Math.random() * Math.PI
      aShift[i * 4 + 1] = Math.random() * Math.PI * 2
      aShift[i * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1
      aShift[i * 4 + 3] = Math.random() * 0.9 + 0.2
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aT0', new THREE.BufferAttribute(aT0, 1))
    geo.setAttribute('aTheta0', new THREE.BufferAttribute(aTheta0, 1))
    geo.setAttribute('aRadiusJitter', new THREE.BufferAttribute(aRadiusJitter, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    geo.setAttribute('aShift', new THREE.BufferAttribute(aShift, 4))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uSize: { value: 3.2 },
        uFlow: { value: FLOW },
        uL: { value: L },
        uRMax: { value: R_MAX },
        uK: { value: K },
        uOmega: { value: OMEGA },
        uTwist: { value: TWIST },
        uMouse: { value: new THREE.Vector2(99999, 99999) },
        uMouseActive: { value: 0 },
        uMouseR: { value: MOUSE_R },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
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

    // Unproject screen mouse → world XY on z=0 plane
    const ndcX = (skillsMouseState.x / size.width) * 2 - 1
    const ndcY = -(skillsMouseState.y / size.height) * 2 + 1
    const v = mouseWorld.current.set(ndcX, ndcY, 0.5)
    v.unproject(camera)
    const dir = v.sub(camera.position).normalize()
    const distZ = -camera.position.z / dir.z
    const mWorld = camera.position.clone().add(dir.multiplyScalar(distZ))
    mat.uniforms.uMouse.value.set(mWorld.x, mWorld.y)

    const targetActive = skillsMouseState.active ? 1 : 0
    const curActive = mat.uniforms.uMouseActive.value as number
    mat.uniforms.uMouseActive.value = curActive + (targetActive - curActive) * 0.15
  })

  return <points geometry={geometry} material={material} />
}

export default function SkillsParticles({ className }: { className?: string }) {
  return (
    <div
      id="skills-canvas"
      className={className}
      style={{ width: '100%', height: '100%', pointerEvents: 'none', background: '#0a0010' }}
    >
      <Canvas
        camera={{ position: [0, 0, 600], fov: 60, near: 1, far: 3000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <TornadoField />
      </Canvas>
    </div>
  )
}
