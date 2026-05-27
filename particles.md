# 粒子效果配置指南

本文档说明如何修改各个页面的粒子效果参数。

---

## 目录

1. [Hero 页面 - 星云粒子系统](#hero-页面---星云粒子系统)
2. [About 页面 - 浮动气泡](#about-页面---浮动气泡)
3. [Skills 页面 - 数据流矩阵](#skills-页面---数据流矩阵)
4. [Projects 页面 - 螺旋旋转](#projects-页面---螺旋旋转)
5. [Contact 页面 - 星空连线](#contact-页面---星空连线)
6. [通用粒子系统类](#通用粒子系统类)

---

## Hero 页面 - 星云粒子系统

**文件位置**: `components/ParticleCanvas.tsx`

### 核心参数

```typescript
const NEBULA_PARTICLES = 3000    // 星云粒子数量
const STAR_PARTICLES = 200       // 背景星星数量
const MOUSE_RADIUS = 250         // 鼠标影响半径
const MOUSE_STRENGTH = 3         // 鼠标推力强度
const RETURN_SPEED = 0.004       // 粒子回归原位速度
const DAMPING = 0.98             // 速度衰减系数
```

### 星云粒子分布

```typescript
// 球形分布 + 螺旋变形
const theta = Math.random() * Math.PI * 2
const phi = Math.acos(2 * Math.random() - 1)
const r = Math.pow(Math.random(), 0.4) * 600  // 半径范围

// 螺旋偏移
const spiralOffset = theta + r * 0.008

// 三轴缩放比例
const x = r * Math.sin(phi) * Math.cos(spiralOffset) * 1.5  // X轴拉伸1.5倍
const y = r * Math.sin(phi) * Math.sin(spiralOffset) * 0.8  // Y轴压缩0.8倍
const z = r * Math.cos(phi) * 0.6                           // Z轴压缩0.6倍
```

### 颜色配置

```typescript
// 星云颜色调色板（RGB 归一化值）
const colorPalette = [
  [0.4, 0.2, 0.8],   // 紫色
  [0.2, 0.4, 0.9],   // 蓝色
  [0.6, 0.3, 0.7],   // 淡紫色
  [0.3, 0.5, 0.9],   // 亮蓝色
  [0.5, 0.2, 0.6],   // 深紫色
  [0.2, 0.3, 0.8],   // 深蓝色
]

// 颜色变化范围
const variation = 0.8 + Math.random() * 0.4  // 0.8-1.2
```

### Shader 效果

```glsl
// 顶点着色器 - 脉冲大小
float pulse = 1.0 + sin(uTime * 0.3 + position.x * 0.005 + position.y * 0.005) * 0.15;
// 0.3 = 脉冲频率
// 0.005 = 位置影响因子
// 0.15 = 脉冲幅度

// 片段着色器 - 发光效果
float glow = exp(-dist * 2.5) * 0.9;   // 中心发光强度
float soft = smoothstep(0.5, 0.0, dist) * 0.4;  // 边缘柔化
```

### 动画参数

```typescript
// 轨道运动
const orbitSpeed = 0.02 * speed  // 基础轨道速度

// 摆动效果
const wobbleX = Math.sin(time * 0.1 * speed + phase) * 30
const wobbleY = Math.cos(time * 0.08 * speed + phase * 1.3) * 25
const wobbleZ = Math.sin(time * 0.06 + phaseZ) * 15

// 整体旋转
groupRef.current.rotation.y = time * 0.01   // Y轴旋转
groupRef.current.rotation.x = Math.sin(time * 0.05) * 0.05  // X轴摇摆
```

### 相机位置

```typescript
camera={{ position: [0, 0, 500], fov: 75 }}
```

---

## About 页面 - 浮动气泡

**文件位置**: `components/AboutParticles.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 500       // 气泡数量
const MOUSE_RADIUS = 120         // 鼠标影响半径
const MOUSE_STRENGTH = 0.8       // 鼠标排斥力
```

### 气泡属性

```typescript
// 分布范围
const spreadX = 1200             // 水平分布
const spreadY = 800              // 垂直分布

// 初始速度
velocities[i * 3] = (Math.random() - 0.5) * 0.3    // 水平漂移
velocities[i * 3 + 1] = 0.2 + Math.random() * 0.5  // 上升速度 0.2-0.7
velocities[i * 3 + 2] = 0                          // Z轴不移动

// 气泡大小范围
baseSizes[i] = 2 + Math.random() * 6  // 2-8

// 透明度范围
opacities[i] = 0.3 + Math.random() * 0.3  // 0.3-0.6
```

### 呼吸效果

```typescript
// 大小呼吸
const breathe = 1 + Math.sin(time * 1.5 + phases[i]) * 0.2
// 1.5 = 呼吸频率（越大越快）
// 0.2 = 呼吸幅度（越大变化越明显）
const scale = baseSizes[i] * breathe
```

### 水平摆动

```typescript
positions[ix] += velocities[ix] + Math.sin(time * 0.5 + phases[i]) * 0.15
// 0.5 = 摆动频率
// 0.15 = 摆动幅度
```

### 边界循环

```typescript
// 垂直循环
if (positions[iy] > spreadY / 2 + 50) {
  positions[iy] = -spreadY / 2 - 50
  positions[ix] = (Math.random() - 0.5) * spreadX
}

// 水平循环
if (positions[ix] > spreadX / 2 + 50) {
  positions[ix] = -spreadX / 2 - 50
} else if (positions[ix] < -spreadX / 2 - 50) {
  positions[ix] = spreadX / 2 + 50
}
```

### 相机位置

```typescript
camera={{ position: [0, 0, 400], fov: 75 }}
```

---

## Skills 页面 - 数据流矩阵

**文件位置**: `components/SkillsParticles.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 4000      // 粒子总数
const COLUMNS = 50               // 列数
const ROWS = 25                  // 行数（每列粒子数）
const MOUSE_RADIUS = 200         // 鼠标推动半径
const MOUSE_STRENGTH = 60        // 鼠标推力强度
const RETURN_SPEED = 0.015       // 粒子回归速度
const DAMPING = 0.94             // 速度衰减系数
```

### 网格布局

```typescript
const spreadX = 900              // 网格宽度
const spreadY = 700              // 网格高度
const spacingX = spreadX / COLUMNS  // 列间距
const spacingY = spreadY / ROWS     // 行间距

// 粒子位置（带随机抖动）
const x = (col - COLUMNS / 2) * spacingX + (Math.random() - 0.5) * 10
const y = (row - ROWS / 2) * spacingY + (Math.random() - 0.5) * 10
const z = (Math.random() - 0.5) * 30
```

### 流动速度

```typescript
// 每列不同速度
columnSpeeds[col] = 0.3 + Math.random() * 1.2  // 0.3-1.5x 速度

// 流动动画
flowY = basePositions[i * 3 + 1] - ((time * speed * 40 + yOffset) % spreadY)
// speed * 40 中的 40 控制整体流动速度
```

### 鼠标推动效果

```typescript
if (skillsMouseState.active && dist < MOUSE_RADIUS && dist > 0) {
  const force = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH
  const angle = Math.atan2(dy, dx)
  velocities[i * 3] += Math.cos(angle) * force
  velocities[i * 3 + 1] += Math.sin(angle) * force
}

// 速度衰减（产生惯性效果）
velocities[i * 3] *= DAMPING
velocities[i * 3 + 1] *= DAMPING

// 回归原位
velocities[i * 3] += (targetX - currentX) * RETURN_SPEED
velocities[i * 3 + 1] += (targetY - currentY) * RETURN_SPEED
```

### 亮度渐变

```typescript
// 顶部亮，底部暗
const normalizedY = (positions[i * 3 + 1] + spreadY / 2) / spreadY
const baseAlpha = 0.4 + normalizedY * 0.5  // 亮度范围 0.4-0.9

// 运动增强亮度
const velMag = Math.sqrt(velocities[i * 3] ** 2 + velocities[i * 3 + 1] ** 2)
const motionBoost = Math.min(velMag * 0.1, 0.5)  // 最大增强 0.5
const finalAlpha = Math.min(1, baseAlpha + motionBoost)
```

### 粒子大小

```typescript
sizes[index] = 3 + Math.random() * 3  // 3-6 范围
```

### 相机位置

```typescript
camera={{ position: [0, 0, 400], fov: 75 }}
```

---

## Projects 页面 - 螺旋旋转

**文件位置**: `components/ProjectsParticles.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 1000      // 粒子数量
const SPIRAL_LAYERS = 6          // 螺旋层数
const CONNECTION_DISTANCE = 70   // 连线距离阈值
```

### 螺旋结构

```typescript
// 每层螺旋配置
const layerRadius = 120 + layer * 80     // 每层半径（120, 200, 280...）
const direction = layer % 2 === 0 ? 1 : -1  // 奇偶层旋转方向相反
const baseSpeed = 0.12 + Math.random() * 0.08  // 基础旋转速度 0.12-0.2
const spiralTurns = 2.5 + layer * 0.6    // 螺旋圈数 (2.5, 3.1, 3.7...)

// 螺旋位置计算
const t = i / particlesPerLayer
const angle = t * Math.PI * 2 * spiralTurns
const heightOffset = (t - 0.5) * 300     // 垂直分布范围 ±150
const radiusVariation = layerRadius + Math.sin(angle * 3) * 25  // 半径波动 ±25

// 三维坐标
const x = Math.cos(angle) * radiusVariation
const y = heightOffset + Math.sin(angle * 2) * 40  // Y轴额外波动 ±40
const z = Math.sin(angle) * radiusVariation * 0.5  // Z轴压缩
```

### 鼠标扭曲效果

```typescript
if (dist < 150 && dist > 0) {
  const force = Math.pow(1 - dist / 150, 2) * 40  // 扭曲力度
  const twistAngle = (1 - dist / 150) * 0.5       // 旋转扭曲角度
  
  // 扭曲旋转
  const cos = Math.cos(twistAngle)
  const sin = Math.sin(twistAngle)
  const rotatedX = baseX * cos - baseZ * sin
  const rotatedZ = baseX * sin + baseZ * cos
  
  // 应用推力
  targetX = rotatedX + (dx / dist) * force
  targetY = baseY + (dy / dist) * force
  targetZ = rotatedZ
}
```

### 整体旋转

```typescript
groupRef.current.rotation.y = time * 0.02   // Y轴旋转速度
groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.05  // X轴摇摆幅度
```

### 连线规则

```typescript
// 只连接相邻层（层差 ≤ 1）
if (Math.abs(pd1.layer - pd2.layer) > 1) continue

// 连线透明度（距离越近越亮）
const alpha = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.35
```

### 材质配置

```typescript
// 粒子材质
const pointsMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 3,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
})

// 连线材质
const lineMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  opacity: 0.2,
  blending: THREE.AdditiveBlending,
})
```

### 相机位置

```typescript
camera={{ position: [0, 0, 500], fov: 75 }}
```

---

## Contact 页面 - 星空连线

**文件位置**: `components/ContactParticles.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 400       // 星星数量
const MAIN_STAR_COUNT = 8        // 主星数量（更大更亮）
const CONNECTION_DISTANCE = 2.5  // 连线距离阈值
const MOUSE_INFLUENCE_RADIUS = 3 // 鼠标吸引半径
const MOUSE_ATTRACTION_STRENGTH = 0.02  // 吸引力强度
```

### 星星分布

```typescript
// 分布范围
pos[i3] = (Math.random() - 0.5) * 16      // X: -8 到 8
pos[i3 + 1] = (Math.random() - 0.5) * 10  // Y: -5 到 5
pos[i3 + 2] = (Math.random() - 0.5) * 6   // Z: -3 到 3

// 初始速度
vel[i3] = (Math.random() - 0.5) * 0.002
vel[i3 + 1] = (Math.random() - 0.5) * 0.002
vel[i3 + 2] = (Math.random() - 0.5) * 0.001

// 粒子大小
sizes[i] = mainStarIndices.has(i) ? 4 : 1.5 + Math.random() * 1
// 主星: 4, 普通星: 1.5-2.5
```

### 鼠标吸引

```typescript
if (dist < MOUSE_INFLUENCE_RADIUS && dist > 0.1) {
  const force = (MOUSE_INFLUENCE_RADIUS - dist) / MOUSE_INFLUENCE_RADIUS
  posArray[i3] += dx * force * MOUSE_ATTRACTION_STRENGTH
  posArray[i3 + 1] += dy * force * MOUSE_ATTRACTION_STRENGTH
}

// 回归原位
const returnStrength = 0.001
posArray[i3] += (originalPositions[i3] - posArray[i3]) * returnStrength
```

### 动态连线

```typescript
// 连线阈值随时间变化（产生闪烁效果）
const connectionThreshold = CONNECTION_DISTANCE * (0.8 + 0.4 * Math.sin(timeOffset + i * 0.1 + j * 0.05))
// 范围: CONNECTION_DISTANCE * 0.4 到 CONNECTION_DISTANCE * 1.2
```

### 主星闪烁

```typescript
// 主星透明度呼吸
mainMaterial.opacity = 0.7 + Math.sin(time * 1.5) * 0.3  // 0.4-1.0
```

### 暖色调

```typescript
// 连线颜色（暖白色）
const warmWhite = 0.95 + Math.sin(time + i) * 0.05  // 0.9-1.0
lineColArray[li] = warmWhite           // R
lineColArray[li + 1] = warmWhite * 0.95  // G
lineColArray[li + 2] = warmWhite * 0.9   // B

// 粒子颜色
color="#fffaf0"  // 暖白色
color="#fff8e7"  // 主星暖白色
```

### 材质配置

```typescript
// 普通星星材质
const pointsMaterial = new THREE.PointsMaterial({
  size: 2,
  color: '#fffaf0',
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
})

// 主星材质
const mainStarMaterial = new THREE.PointsMaterial({
  size: 6,
  color: '#fff8e7',
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
})

// 连线材质
const lineMaterial = new THREE.LineBasicMaterial({
  vertexColors: true,
  opacity: 0.15,
  blending: THREE.AdditiveBlending,
})
```

### 相机位置

```typescript
camera={{ position: [0, 0, 8], fov: 60 }}
```

---

## 通用粒子系统类

**文件位置**: `lib/three/ParticleSystem.ts`

### 配置接口

```typescript
interface ParticleSystemConfig {
  count: number              // 粒子数量，默认 4000
  connectionDistance: number // 连线距离，默认 120
  mouseInfluenceRadius: number  // 鼠标影响半径，默认 200
  mouseForceStrength: number    // 鼠标推力，默认 0.8
  particleMinSize: number    // 最小粒子大小，默认 1.5
  particleMaxSize: number    // 最大粒子大小，默认 4.0
  depthRange: number         // 深度范围，默认 400
  velocityDamping: number    // 速度衰减，默认 0.96
  returnForce: number        // 回归力度，默认 0.01
}
```

### 默认配置

```typescript
const defaultConfig: ParticleSystemConfig = {
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
```

### 特性

- **深度感知**: 粒子大小和透明度随深度变化
- **波纹效果**: 鼠标快速移动时产生波纹
- **空间网格优化**: 使用网格加速连线计算
- **自定义着色器**: 支持自定义顶点和片段着色器

### 使用示例

```typescript
import { ParticleSystem, particleVertexShader, particleFragmentShader } from '@/lib/three/ParticleSystem'

const system = new ParticleSystem(width, height, {
  count: 2000,
  connectionDistance: 100,
  mouseForceStrength: 1.2,
})

// 更新鼠标位置
system.setMousePosition(mouseX, mouseY, isInCanvas)

// 每帧更新
system.update(deltaTime)

// 获取几何体
const geometry = system.geometry
const lineGeometry = system.lineGeometry

// 清理
system.dispose()
```

---

## 通用技巧

### 性能优化

1. **减少粒子数量**: 降低 `PARTICLE_COUNT` 可显著提升性能
2. **减少连线计算**: 降低 `CONNECTION_DISTANCE` 减少连线数量
3. **使用空间分割**: 网格化加速邻近查询
4. **限制最大连线数**: 设置 `maxLines` 上限

### 颜色调整

```typescript
// 十六进制颜色
color: 0xffffff  // 白色
color: 0xff0000  // 红色
color: 0x00ff00  // 绿色

// CSS 颜色字符串
color="#fffaf0"  // 暖白色
color="#ffffff"  // 纯白色

// RGB 归一化（用于着色器）
vec3(1.0, 0.9, 0.8)  // 暖白色
```

### 透明度与混合

```typescript
transparent: true,
opacity: 0.6,                    // 基础透明度
blending: THREE.AdditiveBlending // 叠加混合（发光效果）
// 其他混合模式: THREE.NormalBlending, THREE.MultiplyBlending
depthWrite: false                // 关闭深度写入（透明物体必需）
```

### 相机调整

```typescript
camera={{ position: [0, 0, 400], fov: 75 }}
// Z 值越小: 粒子看起来越近/越大
// fov 越大: 视野越广，边缘形变越明显
```

---

## 快速参考表

| 页面 | 文件 | 粒子数 | 特效类型 |
|------|------|--------|----------|
| Hero | ParticleCanvas.tsx | 3000+200 | 星云 + 背景星星 + 鼠标排斥 |
| About | AboutParticles.tsx | 500 | 气泡上升 + 呼吸效果 |
| Skills | SkillsParticles.tsx | 4000 | 数据流 + 鼠标推动 |
| Projects | ProjectsParticles.tsx | 1000 | 螺旋旋转 + 连线 |
| Contact | ContactParticles.tsx | 400+8 | 星空 + 主星 + 动态连线 |
