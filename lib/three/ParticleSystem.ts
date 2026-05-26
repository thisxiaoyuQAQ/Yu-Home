import * as THREE from 'three'

export interface ParticleSystemConfig {
  count: number
  connectionDistance: number
  mouseInfluenceRadius: number
  mouseForceStrength: number
  particleMinSize: number
  particleMaxSize: number
  depthRange: number
  velocityDamping: number
  returnForce: number
}

export const defaultConfig: ParticleSystemConfig = {
  count: 4000,
  connectionDistance: 120,
  mouseInfluenceRadius: 200,
  mouseForceStrength: 0.8,
  particleMinSize: 1.5,
  particleMaxSize: 4.0,
  depthRange: 400,
  velocityDamping: 0.96,
  returnForce: 0.01,
}

interface Particle {
  position: THREE.Vector3
  originalPosition: THREE.Vector3
  velocity: THREE.Vector3
  size: number
  depth: number
}

export class ParticleSystem {
  private particles: Particle[] = []
  private positions: Float32Array
  private sizes: Float32Array
  private alphas: Float32Array
  private config: ParticleSystemConfig
  private bounds: { width: number; height: number }
  private mousePosition: THREE.Vector2 = new THREE.Vector2(9999, 9999)
  private mouseVelocity: THREE.Vector2 = new THREE.Vector2(0, 0)
  private lastMousePosition: THREE.Vector2 = new THREE.Vector2(9999, 9999)
  private isMouseInCanvas: boolean = false
  private ripples: Array<{ center: THREE.Vector2; radius: number; strength: number; maxRadius: number }> = []

  public geometry: THREE.BufferGeometry
  public lineGeometry: THREE.BufferGeometry
  private linePositions: Float32Array
  private lineColors: Float32Array
  private maxLines: number

  constructor(
    width: number,
    height: number,
    config: Partial<ParticleSystemConfig> = {}
  ) {
    this.config = { ...defaultConfig, ...config }
    this.bounds = { width, height }
    this.maxLines = Math.min(this.config.count * 6, 50000)

    this.positions = new Float32Array(this.config.count * 3)
    this.sizes = new Float32Array(this.config.count)
    this.alphas = new Float32Array(this.config.count)
    this.linePositions = new Float32Array(this.maxLines * 6)
    this.lineColors = new Float32Array(this.maxLines * 6)

    this.geometry = new THREE.BufferGeometry()
    this.lineGeometry = new THREE.BufferGeometry()

    this.initParticles()
    this.setupGeometry()
  }

  private initParticles(): void {
    const { count, depthRange, particleMinSize, particleMaxSize } = this.config
    const halfWidth = this.bounds.width / 2
    const halfHeight = this.bounds.height / 2

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * this.bounds.width * 1.2
      const y = (Math.random() - 0.5) * this.bounds.height * 1.2
      const z = (Math.random() - 0.5) * depthRange

      const depthFactor = (z + depthRange / 2) / depthRange
      const size = particleMinSize + depthFactor * (particleMaxSize - particleMinSize)

      this.particles.push({
        position: new THREE.Vector3(x, y, z),
        originalPosition: new THREE.Vector3(x, y, z),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.1
        ),
        size,
        depth: depthFactor,
      })

      this.positions[i * 3] = x
      this.positions[i * 3 + 1] = y
      this.positions[i * 3 + 2] = z
      this.sizes[i] = size
      this.alphas[i] = 0.3 + depthFactor * 0.7
    }
  }

  private setupGeometry(): void {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1))
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1))

    this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3))
    this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3))
    this.lineGeometry.setDrawRange(0, 0)
  }

  public setMousePosition(x: number, y: number, isInCanvas: boolean): void {
    this.lastMousePosition.copy(this.mousePosition)
    this.mousePosition.set(x, y)
    this.mouseVelocity.set(
      x - this.lastMousePosition.x,
      y - this.lastMousePosition.y
    )
    this.isMouseInCanvas = isInCanvas

    if (isInCanvas && this.mouseVelocity.length() > 5) {
      this.addRipple(x, y, this.mouseVelocity.length() * 0.5)
    }
  }

  private addRipple(x: number, y: number, strength: number): void {
    this.ripples.push({
      center: new THREE.Vector2(x, y),
      radius: 0,
      strength: Math.min(strength, 30),
      maxRadius: 300 + strength * 10,
    })

    if (this.ripples.length > 5) {
      this.ripples.shift()
    }
  }

  public update(deltaTime: number): void {
    const {
      mouseInfluenceRadius,
      mouseForceStrength,
      velocityDamping,
      returnForce,
      connectionDistance,
      particleMinSize,
      particleMaxSize,
      depthRange,
    } = this.config

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].radius += deltaTime * 200
      this.ripples[i].strength *= 0.98
      if (this.ripples[i].radius > this.ripples[i].maxRadius || this.ripples[i].strength < 0.1) {
        this.ripples.splice(i, 1)
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]

      const toOriginal = particle.originalPosition.clone().sub(particle.position)
      particle.velocity.add(toOriginal.multiplyScalar(returnForce))

      if (this.isMouseInCanvas) {
        const dx = particle.position.x - this.mousePosition.x
        const dy = particle.position.y - this.mousePosition.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < mouseInfluenceRadius && distance > 0) {
          const force = (1 - distance / mouseInfluenceRadius) * mouseForceStrength
          const angle = Math.atan2(dy, dx)
          
          particle.velocity.x += Math.cos(angle) * force * 2
          particle.velocity.y += Math.sin(angle) * force * 2
        }
      }

      for (const ripple of this.ripples) {
        const dx = particle.position.x - ripple.center.x
        const dy = particle.position.y - ripple.center.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const rippleWidth = 50

        if (Math.abs(distance - ripple.radius) < rippleWidth) {
          const rippleEffect = 1 - Math.abs(distance - ripple.radius) / rippleWidth
          const angle = Math.atan2(dy, dx)
          const force = rippleEffect * ripple.strength * 0.1

          particle.velocity.x += Math.cos(angle) * force
          particle.velocity.y += Math.sin(angle) * force
        }
      }

      particle.velocity.multiplyScalar(velocityDamping)
      particle.position.add(particle.velocity)

      const depthFactor = (particle.position.z + depthRange / 2) / depthRange
      particle.size = particleMinSize + Math.max(0, Math.min(1, depthFactor)) * (particleMaxSize - particleMinSize)
      particle.depth = depthFactor

      this.positions[i * 3] = particle.position.x
      this.positions[i * 3 + 1] = particle.position.y
      this.positions[i * 3 + 2] = particle.position.z
      this.sizes[i] = particle.size
      this.alphas[i] = 0.3 + Math.max(0, Math.min(1, depthFactor)) * 0.7
    }

    this.updateConnections()

    const positionAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute
    const sizeAttr = this.geometry.getAttribute('size') as THREE.BufferAttribute
    const alphaAttr = this.geometry.getAttribute('alpha') as THREE.BufferAttribute

    positionAttr.needsUpdate = true
    sizeAttr.needsUpdate = true
    alphaAttr.needsUpdate = true
  }

  private updateConnections(): void {
    const { connectionDistance } = this.config
    let lineIndex = 0
    const maxConnections = this.maxLines

    const gridSize = connectionDistance
    const grid: Map<string, number[]> = new Map()

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      const cellX = Math.floor(p.position.x / gridSize)
      const cellY = Math.floor(p.position.y / gridSize)
      const key = `${cellX},${cellY}`

      if (!grid.has(key)) {
        grid.set(key, [])
      }
      grid.get(key)!.push(i)
    }

    for (let i = 0; i < this.particles.length && lineIndex < maxConnections; i++) {
      const p1 = this.particles[i]
      const cellX = Math.floor(p1.position.x / gridSize)
      const cellY = Math.floor(p1.position.y / gridSize)

      for (let dx = -1; dx <= 1 && lineIndex < maxConnections; dx++) {
        for (let dy = -1; dy <= 1 && lineIndex < maxConnections; dy++) {
          const key = `${cellX + dx},${cellY + dy}`
          const cell = grid.get(key)
          if (!cell) continue

          for (const j of cell) {
            if (j <= i) continue
            if (lineIndex >= maxConnections) break

            const p2 = this.particles[j]
            const dx = p1.position.x - p2.position.x
            const dy = p1.position.y - p2.position.y
            const dz = p1.position.z - p2.position.z
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

            if (distance < connectionDistance) {
              const alpha = (1 - distance / connectionDistance) * 0.5
              const avgDepth = (p1.depth + p2.depth) / 2

              this.linePositions[lineIndex * 6] = p1.position.x
              this.linePositions[lineIndex * 6 + 1] = p1.position.y
              this.linePositions[lineIndex * 6 + 2] = p1.position.z
              this.linePositions[lineIndex * 6 + 3] = p2.position.x
              this.linePositions[lineIndex * 6 + 4] = p2.position.y
              this.linePositions[lineIndex * 6 + 5] = p2.position.z

              const colorValue = alpha * (0.3 + avgDepth * 0.7)
              this.lineColors[lineIndex * 6] = colorValue
              this.lineColors[lineIndex * 6 + 1] = colorValue
              this.lineColors[lineIndex * 6 + 2] = colorValue
              this.lineColors[lineIndex * 6 + 3] = colorValue
              this.lineColors[lineIndex * 6 + 4] = colorValue
              this.lineColors[lineIndex * 6 + 5] = colorValue

              lineIndex++
            }
          }
        }
      }
    }

    const linePositionAttr = this.lineGeometry.getAttribute('position') as THREE.BufferAttribute
    const lineColorAttr = this.lineGeometry.getAttribute('color') as THREE.BufferAttribute
    linePositionAttr.needsUpdate = true
    lineColorAttr.needsUpdate = true
    this.lineGeometry.setDrawRange(0, lineIndex * 2)
  }

  public resize(width: number, height: number): void {
    const scaleX = width / this.bounds.width
    const scaleY = height / this.bounds.height

    this.bounds.width = width
    this.bounds.height = height

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]
      particle.position.x *= scaleX
      particle.position.y *= scaleY
      particle.originalPosition.x *= scaleX
      particle.originalPosition.y *= scaleY
    }
  }

  public dispose(): void {
    this.geometry.dispose()
    this.lineGeometry.dispose()
    this.particles = []
  }
}

export const particleVertexShader = `
  attribute float size;
  attribute float alpha;
  varying float vAlpha;
  
  void main() {
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const particleFragmentShader = `
  varying float vAlpha;
  
  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;
    
    float softEdge = 1.0 - smoothstep(0.3, 0.5, dist);
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * softEdge);
  }
`
