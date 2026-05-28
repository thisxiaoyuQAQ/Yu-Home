'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// "Black hole" — particles orbit around a central text region in a flat accretion disk.
//  - GPU-driven point cloud with per-particle orbital radius/angle/speed
//  - Particles swirl tangentially around centre, gently bobbing in Z
//  - Inner "event horizon" region kept clear so the page text stays readable
//  - Colour gradient: hot white-amber near the horizon → deep purple at the rim
//  - Soft mouse repulsion preserved (spherical falloff via uMouse / uMouseStrength)

const PARTICLE_COUNT = 2200

const INNER_RADIUS = 220   // event-horizon clearance around the text
const OUTER_RADIUS = 780   // outer rim of the accretion disk
const DISK_THICKNESS = 60  // vertical jitter of the disk

const MOUSE_RADIUS = 150

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3  uMouse;
  uniform float uMouseStrength;
  uniform float uMouseRadius;
  uniform float uInnerRadius;
  uniform float uOuterRadius;

  // (radius, angle, angularSpeed, zPhase)
  attribute vec4  aOrbit;
  // (sizeScale, wobbleAmp, wobbleFreq, colorMix)
  attribute vec4  aShift;

  varying vec3 vColor;
  varying float vRadiusT;

  void main() {
    float radius       = aOrbit.x;
    float baseAngle    = aOrbit.y;
    float angularSpeed = aOrbit.z;
    float zPhase       = aOrbit.w;

    // Differential rotation — inner rings spin faster (Keplerian-ish feel).
    float speedBoost = mix(2.2, 0.7, clamp((radius - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0));
    float angle = baseAngle + uTime * angularSpeed * speedBoost;

    // Tiny radial wobble so the disk breathes instead of looking like a CD.
    float radialWobble = sin(uTime * aShift.z + aShift.x * 6.28) * aShift.y * 6.0;
    float r = radius + radialWobble;

    vec3 transformed = vec3(
      cos(angle) * r,
      sin(uTime * 0.6 + zPhase) * aShift.y * 8.0, // gentle vertical bob
      sin(angle) * r
    );

    // Soft spherical mouse repulsion (preserved from the nebula version).
    vec3 toParticle = transformed - uMouse;
    float md = length(toParticle);
    if (md < uMouseRadius && md > 0.0001) {
      float falloff = 1.0 - md / uMouseRadius;
      falloff = falloff * falloff;
      transformed += normalize(toParticle) * falloff * uMouseStrength;
    }

    // Colour by orbital radius: hot near the horizon, cool at the rim.
    float t = clamp((r - uInnerRadius) / (uOuterRadius - uInnerRadius), 0.0, 1.0);
    vRadiusT = t;
    vec3 hot    = vec3(255.0, 220.0, 150.0) / 255.0; // hot amber/white
    vec3 warm   = vec3(255.0, 120.0, 60.0)  / 255.0; // amber
    vec3 purple = vec3(110.0, 60.0, 230.0)  / 255.0; // deep purple
    vec3 mid    = mix(hot, warm, smoothstep(0.0, 0.4, t));
    vColor      = mix(mid, purple, smoothstep(0.4, 1.0, t));

    float breathe = 1.0 + sin(uTime * 1.5 + aShift.x * 4.0) * 0.2;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aShift.x * breathe * uPixelRatio * (900.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vRadiusT;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;
    // Hotter near the horizon → brighter core.
    float core = smoothstep(0.5, 0.0, d);
    float alpha = core * mix(0.85, 0.45, vRadiusT) + 0.05;
    gl_FragColor = vec4(vColor, alpha);
  }
`

const mouseState = { x: 0, y: 0, active: false }

function BlackHole() {
  const { gl, camera, size } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const mouseTargetRef = useRef(new THREE.Vector3(9999, 9999, 0))
  const mouseStrengthRef = useRef(0)

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3) // unused but required
    const orbit = new Float32Array(PARTICLE_COUNT * 4)
    const shift = new Float32Array(PARTICLE_COUNT * 4)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Bias radius toward the inner edge so the disk looks denser near the horizon.
      const rNorm = Math.pow(Math.random(), 1.7)
      const radius = INNER_RADIUS + rNorm * (OUTER_RADIUS - INNER_RADIUS)

      orbit[i * 4]     = radius
      orbit[i * 4 + 1] = Math.random() * Math.PI * 2          // start angle
      orbit[i * 4 + 2] = (0.18 + Math.random() * 0.22) * (Math.random() < 0.5 ? -1 : 1) * 0.0 + (0.25 + Math.random() * 0.25) // angular speed (uniform direction)
      orbit[i * 4 + 3] = Math.random() * Math.PI * 2          // z phase

      // Size mostly small with a few bright bubbles, plus wobble params.
      shift[i * 4]     = 1.5 + Math.pow(Math.random(), 2.2) * 18
      shift[i * 4 + 1] = Math.random() * 1.0 + 0.4            // wobble amplitude
      shift[i * 4 + 2] = 0.4 + Math.random() * 1.2            // wobble frequency
      shift[i * 4 + 3] = Math.random()                        // colour jitter (unused for now)

      // Seed positions so the BufferGeometry has a valid bounding sphere.
      positions[i * 3]     = Math.cos(orbit[i * 4 + 1]) * radius
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(orbit[i * 4 + 1]) * radius
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4))
    geo.setAttribute('aShift', new THREE.BufferAttribute(shift, 4))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), OUTER_RADIUS * 1.5)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uMouse: { value: new THREE.Vector3(9999, 9999, 0) },
        uMouseStrength: { value: 0 },
        uMouseRadius: { value: MOUSE_RADIUS },
        uInnerRadius: { value: INNER_RADIUS },
        uOuterRadius: { value: OUTER_RADIUS },
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

    // Slow tilt of the whole disk so it reads as a 3D ring, not a flat circle.
    if (groupRef.current) {
      groupRef.current.rotation.x = Math.PI * 0.28 + Math.sin(mat.uniforms.uTime.value * 0.15) * 0.05
      groupRef.current.rotation.z = Math.cos(mat.uniforms.uTime.value * 0.12) * 0.04
    }

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

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} />
    </group>
  )
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
        camera={{ position: [0, 0, 900], fov: 55, near: 1, far: 3000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0a0010']} />
        <BlackHole />
      </Canvas>
    </div>
  )
}
