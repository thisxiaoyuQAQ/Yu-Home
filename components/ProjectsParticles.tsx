'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Full-page nebula field for the Projects section:
//  - 3 LARGE nebula clouds with bigger, brighter particles forming the
//    composition's hero shapes
//  - ~24 SMALL nebula clusters scattered across the whole viewport,
//    filling negative space with secondary detail
//  - A dense halo of drifting dust for atmospheric continuity
//  - All clouds share the Hero color family (purple / magenta / amber / cyan)
//
// Total ~250k particles. Curl-noise flow shreds cluster edges into
// filaments; group rotation + cursor push add cinematic motion.

const LARGE_PARTICLES = 36000     // particles per large nebula
const SMALL_PARTICLES = 4500      // particles per small nebula
const HALO_PARTICLES = 40000      // background dust

type ColorPair = {
  core: [number, number, number]  // hot, bright center color
  edge: [number, number, number]  // cooler, darker rim color
}

type ClusterDef = {
  x: number; y: number; z: number
  r: number
  palette: ColorPair
  large: number // 1 for large hero nebula, 0 for small accent
}

// A small, deliberate palette in the Hero color family — only 3 pairs.
// Each pair fades from a hot core to a cool rim, giving every cloud
// internal gradient depth without introducing new hues.
const PALETTE_AMBER:  ColorPair = { core: [255, 180,  90], edge: [180,  70, 200] }  // amber → magenta
const PALETTE_PURPLE: ColorPair = { core: [200, 130, 255], edge: [ 70,  40, 140] }  // bright violet → deep purple
const PALETTE_MAGENTA:ColorPair = { core: [230, 110, 200], edge: [ 90,  50, 180] }  // hot pink → indigo

// Three hero nebulae spread across the page — they anchor the eye.
const LARGE_CLUSTERS: ClusterDef[] = [
  { x: -70, y:  15, z:  -5, r: 32, palette: PALETTE_PURPLE,  large: 1 }, // upper-left
  { x:  60, y: -10, z:   8, r: 36, palette: PALETTE_MAGENTA, large: 1 }, // mid-right
  { x:   5, y:  30, z: -15, r: 28, palette: PALETTE_AMBER,   large: 1 }, // upper-center
]

// Procedurally place ~24 small clusters across the full page.
// Small clusters reuse the same 3 palettes — no new colors introduced.
const SMALL_CLUSTERS: ClusterDef[] = (() => {
  const palettes: ColorPair[] = [PALETTE_PURPLE, PALETTE_MAGENTA, PALETTE_AMBER]
  const out: ClusterDef[] = []
  // 6 cols x 4 rows = 24 cells across the ±140 / ±60 working area
  const cols = 6
  const rows = 4
  const spanX = 280
  const spanY = 110
  // Deterministic PRNG so the layout is stable across renders.
  let s = 1
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let ix = 0; ix < cols; ix++) {
    for (let iy = 0; iy < rows; iy++) {
      const cx = -spanX / 2 + (ix + 0.5) * (spanX / cols) + (rand() - 0.5) * 30
      const cy = -spanY / 2 + (iy + 0.5) * (spanY / rows) + (rand() - 0.5) * 18
      const cz = (rand() - 0.5) * 40
      // Skip cells that overlap the large-cluster centers too much,
      // so the heroes stay legible.
      let skip = false
      for (const big of LARGE_CLUSTERS) {
        const dx = cx - big.x
        const dy = cy - big.y
        if (Math.hypot(dx, dy) < big.r * 0.7) { skip = true; break }
      }
      if (skip) continue
      const palette = palettes[Math.floor(rand() * palettes.length)]
      out.push({
        x: cx, y: cy, z: cz,
        r: 5 + rand() * 6,
        palette,
        large: 0,
      })
    }
  }
  return out
})()

const ALL_CLUSTERS = [...LARGE_CLUSTERS, ...SMALL_CLUSTERS]

const TOTAL =
  LARGE_CLUSTERS.length * LARGE_PARTICLES +
  SMALL_CLUSTERS.length * SMALL_PARTICLES +
  HALO_PARTICLES

const HALO_X = 160
const HALO_Y = 80
const HALO_Z = 70

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec2  uMouse;
  uniform float uMouseActive;

  attribute float aSize;
  attribute float aSeed;
  attribute vec3  aColor;
  attribute float aCluster;     // 0 halo, 0.5 small cluster, 1 large cluster

  varying vec3  vColor;
  varying float vCluster;
  varying float vNoise;

  // Ashima Arts 3D simplex noise (public domain).
  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    float n1 = snoise(vec3(p.x, p.y + e, p.z));
    float n2 = snoise(vec3(p.x, p.y - e, p.z));
    float n3 = snoise(vec3(p.x, p.y, p.z + e));
    float n4 = snoise(vec3(p.x, p.y, p.z - e));
    float n5 = snoise(vec3(p.x + e, p.y, p.z));
    float n6 = snoise(vec3(p.x - e, p.y, p.z));
    float x = (n1 - n2) - (n3 - n4);
    float y = (n3 - n4) - (n5 - n6);
    float z = (n5 - n6) - (n1 - n2);
    return normalize(vec3(x, y, z) + 1e-5);
  }

  void main() {
    float clusterStrength = aCluster;
    float flowScale = mix(0.010, 0.028, clusterStrength);
    float flowAmp   = mix(7.0, 14.0, clusterStrength);

    vec3 sampleP = position * flowScale
                 + vec3(uTime * 0.04, uTime * 0.025, uTime * 0.03)
                 + aSeed;
    vec3 flow = curlNoise(sampleP) * flowAmp;

    // Cursor push — generous radius so it feels like parting the clouds.
    vec3 mouseWorld = vec3(uMouse.x * 110.0, uMouse.y * 60.0, 0.0);
    vec3 toMouse = position - mouseWorld;
    float dist = length(toMouse);
    float falloff = smoothstep(40.0, 0.0, dist) * uMouseActive;
    vec3 push = normalize(toMouse + 1e-5) * falloff * 12.0;

    vec3 transformed = position + flow + push;

    float density = snoise(position * 0.04 + uTime * 0.06);
    vNoise = density * 0.5 + 0.5;
    vColor = aColor;
    vCluster = clusterStrength;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aSize * uPixelRatio * (160.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vCluster;
  varying float vNoise;

  void main() {
    float d = length(gl_PointCoord.xy - 0.5);
    if (d > 0.5) discard;

    // Soft circular falloff.
    float core = smoothstep(0.5, 0.0, d);

    // Three-tier alpha: halo dust faint, small clusters mid, large clusters punchy.
    float halo  = core * 0.20 + 0.05;
    float small = core * 0.45 + 0.15;
    float large = core * 0.65 + 0.22;

    float alpha;
    if (vCluster < 0.25) {
      alpha = halo;
    } else if (vCluster < 0.75) {
      alpha = small;
    } else {
      alpha = large;
    }

    // Internal smoke texture.
    float bright = mix(0.65, 1.5, vNoise);
    vec3 col = vColor * bright;

    gl_FragColor = vec4(col, alpha);
  }
`

function NebulaPoints() {
  const groupRef = useRef<THREE.Group>(null)
  const { size, gl } = useThree()
  const mouseRef = useRef({ x: 0, y: 0, active: 0 })

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(TOTAL * 3)
    const sizes = new Float32Array(TOTAL)
    const seeds = new Float32Array(TOTAL)
    const colors = new Float32Array(TOTAL * 3)
    const cluster = new Float32Array(TOTAL)

    const gauss = () => {
      const u = 1 - Math.random()
      const v = Math.random()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }

    let idx = 0

    for (const c of ALL_CLUSTERS) {
      const count = c.large ? LARGE_PARTICLES : SMALL_PARTICLES
      const coreR = c.palette.core[0] / 255
      const coreG = c.palette.core[1] / 255
      const coreB = c.palette.core[2] / 255
      const edgeR = c.palette.edge[0] / 255
      const edgeG = c.palette.edge[1] / 255
      const edgeB = c.palette.edge[2] / 255

      // Large clusters get visibly bigger, brighter particles.
      const sizeBase = c.large ? 2.2 : 0.95
      const sizeJitter = c.large ? 1.3 : 0.7

      for (let i = 0; i < count; i++) {
        const ox = gauss() * c.r * 0.55
        const oy = gauss() * c.r * 0.55
        const oz = gauss() * c.r * 0.30   // squashed → sheet-like

        positions[idx * 3]     = c.x + ox
        positions[idx * 3 + 1] = c.y + oy
        positions[idx * 3 + 2] = c.z + oz

        const r = Math.min(1, Math.sqrt(ox * ox + oy * oy + oz * oz) / c.r)
        sizes[idx] = (sizeBase - r * (sizeBase * 0.35)) * (Math.random() * sizeJitter + 0.5)

        seeds[idx] = Math.random() * 100

        // Radial gradient: core color at center, edge color at the rim.
        // Smoothstep gives a soft transition; tiny jitter avoids banding.
        const t = Math.min(1, Math.max(0, r * r))   // bias gradient toward edge
        const j = (Math.random() - 0.5) * 0.06
        colors[idx * 3]     = Math.max(0, Math.min(1, coreR + (edgeR - coreR) * t + j))
        colors[idx * 3 + 1] = Math.max(0, Math.min(1, coreG + (edgeG - coreG) * t + j))
        colors[idx * 3 + 2] = Math.max(0, Math.min(1, coreB + (edgeB - coreB) * t + j))

        cluster[idx] = c.large ? 1.0 : 0.5
        idx++
      }
    }

    // Halo background dust — a quiet desaturated purple, matched to the palette.
    for (let i = 0; i < HALO_PARTICLES; i++) {
      positions[idx * 3]     = (Math.random() * 2 - 1) * HALO_X
      positions[idx * 3 + 1] = (Math.random() * 2 - 1) * HALO_Y
      positions[idx * 3 + 2] = (Math.random() * 2 - 1) * HALO_Z

      sizes[idx] = Math.random() * 0.5 + 0.25
      seeds[idx] = Math.random() * 100
      const t = Math.random() * 0.35 + 0.45
      colors[idx * 3]     = t * 0.55
      colors[idx * 3 + 1] = t * 0.40
      colors[idx * 3 + 2] = t * 0.85
      cluster[idx] = 0
      idx++
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aCluster', new THREE.BufferAttribute(cluster, 1))

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 1.0 },
        uPixelRatio: { value: gl.getPixelRatio() },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
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
    const t = (mat.uniforms.uTime.value += delta)
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio()

    const m = (window as unknown as { __nebulaMouse?: { x: number; y: number; active: number } }).__nebulaMouse
    if (m) {
      const targetX = (m.x / size.width) * 2 - 1
      const targetY = -((m.y / size.height) * 2 - 1)
      mouseRef.current.x += (targetX - mouseRef.current.x) * 0.08
      mouseRef.current.y += (targetY - mouseRef.current.y) * 0.08
      mouseRef.current.active += (m.active - mouseRef.current.active) * 0.06
    } else {
      mouseRef.current.active += (0 - mouseRef.current.active) * 0.06
    }
    mat.uniforms.uMouse.value.set(mouseRef.current.x, mouseRef.current.y)
    mat.uniforms.uMouseActive.value = mouseRef.current.active

    if (groupRef.current) {
      // Very slow drift — keep large nebulae approximately anchored.
      groupRef.current.rotation.y = Math.sin(t * 0.04) * 0.06
      groupRef.current.rotation.x = Math.sin(t * 0.06) * 0.04

      const targetZ = mouseRef.current.x * 0.06
      groupRef.current.rotation.z += (targetZ - groupRef.current.rotation.z) * 0.04
    }
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} />
    </group>
  )
}

export default function ProjectsParticles({ className }: { className?: string }) {
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    ;(window as unknown as { __nebulaMouse: { x: number; y: number; active: number } }).__nebulaMouse = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: 1,
    }
  }

  const handleMouseLeave = () => {
    const w = window as unknown as { __nebulaMouse?: { x: number; y: number; active: number } }
    if (w.__nebulaMouse) w.__nebulaMouse.active = 0
  }

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Canvas
        camera={{ position: [0, 0, 150], fov: 60, near: 1, far: 800 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        <NebulaPoints />
      </Canvas>
    </div>
  )
}
