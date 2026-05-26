# 粒子效果配置指南

本文档说明如何修改各个页面的粒子效果参数。

---

## 目录

1. [Hero 页面 - 星云粒子网络](#hero-页面---星云粒子网络)
2. [About 页面 - 浮动气泡](#about-页面---浮动气泡)
3. [Skills 页面 - 数据流矩阵](#skills-页面---数据流矩阵)
4. [Projects 页面 - 螺旋旋转](#projects-页面---螺旋旋转)
5. [Contact 页面 - 星空连线](#contact-页面---星空连线)

---

## Hero 页面 - 星云粒子网络

**文件位置**: `components/ParticleCanvas.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 2000      // 粒子数量（增加=更密集，减少=更稀疏）
const MOUSE_RADIUS = 180         // 鼠标影响半径（增加=影响范围更大）
const MOUSE_STRENGTH = 1.5       // 鼠标推力强度（增加=推力更强）
const CONNECTION_DISTANCE = 80   // 粒子连线距离阈值（增加=更多连线）
const RETURN_SPEED = 0.008       // 粒子回归原位速度（增加=回归更快）
const DAMPING = 0.96             // 速度衰减系数（接近1=更平滑，接近0=更急停）
```

### 粒子分布调整

```typescript
// 在 data useMemo 中修改
const spreadX = 1600   // 水平分布范围
const spreadY = 1200   // 垂直分布范围
const z = (Math.random() - 0.5) * 150  // Z轴深度范围
```

### 视觉效果调整

```typescript
// 粒子材质
const pointsMaterial = new THREE.PointsMaterial({
  color: 0xffffff,    // 颜色（十六进制）
  size: 2,            // 粒子大小
  opacity: 0.6,       // 透明度 (0-1)
})

// 连线材质
const lineMaterial = new THREE.LineBasicMaterial({
  opacity: 0.3,       // 连线透明度
})

// 连线透明度计算（在 useFrame 中）
const alpha = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.25
```

### 相机位置

```typescript
camera={{ position: [0, 0, 500], fov: 75 }}
// position: [x, y, z] - z值越大，看到的范围越广
// fov: 视场角度 - 越大视野越广
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
// 在 data useMemo 中
const spreadX = 1200             // 水平分布
const spreadY = 800              // 垂直分布

// 上升速度
velocities[i * 3 + 1] = 0.2 + Math.random() * 0.5  // Y轴速度

// 气泡大小范围
baseSizes[i] = 2 + Math.random() * 6  // 2-8

// 透明度范围
opacities[i] = 0.3 + Math.random() * 0.3  // 0.3-0.6
```

### 呼吸效果

```typescript
// 在 useFrame 中
const breathe = 1 + Math.sin(time * 1.5 + phases[i]) * 0.2
// 1.5 = 呼吸频率（越大越快）
// 0.2 = 呼吸幅度（越大变化越明显）
```

### 水平摆动

```typescript
positions[ix] += velocities[ix] + Math.sin(time * 0.5 + phases[i]) * 0.15
// 0.5 = 摆动频率
// 0.15 = 摆动幅度
```

---

## Skills 页面 - 数据流矩阵

**文件位置**: `components/SkillsParticles.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 800       // 粒子总数
const COLUMNS = 40               // 列数
const ROWS = 20                  // 行数
const MOUSE_RADIUS = 150         // 鼠标波纹触发半径
const RIPPLE_SPEED = 3           // 波纹扩散速度
const RIPPLE_DECAY = 0.95        // 波纹衰减速度（越接近1衰减越慢）
```

### 网格布局

```typescript
const spreadX = 800              // 网格宽度
const spreadY = 600              // 网格高度
const spacingX = spreadX / COLUMNS  // 列间距
const spacingY = spreadY / ROWS     // 行间距
```

### 流动速度

```typescript
// 每列不同速度
columnSpeeds[col] = 0.5 + Math.random() * 1.5  // 0.5-2x 速度

// 流动动画
newY = baseY - ((time * speed * 30 + offset) % spreadY)
// speed * 30 中的 30 控制整体流动速度
```

### 亮度渐变

```typescript
// 顶部亮，底部暗
const normalizedY = (newY + spreadY / 2) / spreadY
const baseAlpha = 0.15 + normalizedY * 0.7  // 亮度范围 0.15-0.85
```

### 波纹效果

```typescript
const rippleWidth = 30           // 波纹宽度
rippleEffect = Math.max(rippleEffect, rippleFactor * ripple.strength)
const finalAlpha = Math.min(1, baseAlpha + rippleEffect * 0.8)  // 波纹增强亮度
```

---

## Projects 页面 - 螺旋旋转

**文件位置**: `components/ProjectsParticles.tsx`

### 核心参数

```typescript
const PARTICLE_COUNT = 600       // 粒子数量
const SPIRAL_LAYERS = 5          // 螺旋层数
const CONNECTION_DISTANCE = 60   // 连线距离
```

### 螺旋结构

```typescript
// 每层螺旋配置
const layerRadius = 80 + layer * 60      // 每层半径（80, 140, 200...）
const direction = layer % 2 === 0 ? 1 : -1  // 奇偶层旋转方向相反
const baseSpeed = 0.15 + Math.random() * 0.1  // 基础旋转速度
const spiralTurns = 2 + layer * 0.5      // 螺旋圈数

// 螺旋变形
const radiusVariation = layerRadius + Math.sin(angle * 3) * 15
const heightOffset = (t - 0.5) * 200     // 垂直分布范围
```

### 鼠标扭曲效果

```typescript
// 在 useFrame 中
if (dist < 150 && dist > 0) {
  const force = Math.pow(1 - dist / 150, 2) * 40  // 扭曲力度
  const twistAngle = (1 - dist / 150) * 0.5       // 旋转扭曲角度
  // ...
}
```

### 整体旋转

```typescript
// 在 useFrame 末尾
groupRef.current.rotation.y = time * 0.02   // Y轴旋转速度
groupRef.current.rotation.x = Math.sin(time * 0.1) * 0.05  // X轴摇摆
```

### 连线规则

```typescript
// 只连接相邻层
if (Math.abs(pd1.layer - pd2.layer) > 1) continue

// 连线透明度
const alpha = (1 - Math.sqrt(distSq) / CONNECTION_DISTANCE) * 0.35
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

// 粒子大小
sizes[i] = mainStarIndices.has(i) ? 4 : 1.5 + Math.random() * 1
// 主星: 4, 普通星: 1.5-2.5
```

### 动态连线

```typescript
// 连线阈值随时间变化（产生闪烁效果）
const connectionThreshold = CONNECTION_DISTANCE * (0.8 + 0.4 * Math.sin(timeOffset + i * 0.1 + j * 0.05))
```

### 主星闪烁

```typescript
// 主星透明度呼吸
mainMaterial.opacity = 0.7 + Math.sin(time * 1.5) * 0.3  // 0.4-1.0
```

### 暖色调

```typescript
// 连线颜色（暖白色）
const warmWhite = 0.95 + Math.sin(time + i) * 0.05
lineColArray[li] = warmWhite           // R
lineColArray[li + 1] = warmWhite * 0.95  // G
lineColArray[li + 2] = warmWhite * 0.9   // B

// 粒子颜色
color="#fffaf0"  // 暖白色
```

---

## 通用技巧

### 性能优化

1. **减少粒子数量**: 降低 `PARTICLE_COUNT` 可显著提升性能
2. **减少连线计算**: 降低 `CONNECTION_DISTANCE` 减少连线数量
3. **简化几何体**: 使用 `THREE.Points` 而非单独的 mesh

### 颜色调整

```typescript
// 十六进制颜色
color: 0xffffff  // 白色
color: 0xff0000  // 红色
color: 0x00ff00  // 绿色

// CSS 颜色字符串
color="#fffaf0"  // 暖白色
color="#ffffff"  // 纯白色
```

### 透明度与混合

```typescript
transparent: true,
opacity: 0.6,                    // 基础透明度
blending: THREE.AdditiveBlending // 叠加混合（发光效果）
// 其他混合模式: THREE.NormalBlending, THREE.MultiplyBlending
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
| Hero | ParticleCanvas.tsx | 2000 | 网络连线 + 鼠标排斥 |
| About | AboutParticles.tsx | 500 | 气泡上升 + 呼吸效果 |
| Skills | SkillsParticles.tsx | 800 | 数据流 + 波纹扩散 |
| Projects | ProjectsParticles.tsx | 600 | 螺旋旋转 + 连线 |
| Contact | ContactParticles.tsx | 400 | 星空 + 动态连线 |
